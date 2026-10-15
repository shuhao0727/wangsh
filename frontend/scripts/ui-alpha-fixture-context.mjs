import ts from "typescript";

// A direct compiler input is not a DOM class. This does not exempt test files,
// arbitrary HTML strings, snapshots, comments, or strings later passed to JSX.
export function compilerFixtureRanges(text, fileName) {
  if (!/\.(test|spec)\.[jt]sx?$/.test(fileName)) return [];
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (source.parseDiagnostics.length) return [];
  const host = {
    getSourceFile: (name) => name === fileName ? source : undefined,
    getDefaultLibFileName: () => "", writeFile: () => {}, getCurrentDirectory: () => "/",
    getDirectories: () => [], fileExists: (name) => name === fileName,
    readFile: (name) => name === fileName ? text : undefined,
    getCanonicalFileName: (name) => name, useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  const checker = ts.createProgram([fileName], { noLib: true, noResolve: true }, host).getTypeChecker();
  const bindings = new Map();
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const module = node.moduleSpecifier.text;
    const clause = node.importClause;
    if (clause?.isTypeOnly) continue;
    if (clause?.name && ["postcss", "tailwindcss"].includes(module)) {
      bindings.set(checker.getSymbolAtLocation(clause.name), module);
    }
    if (module === "vitest" && clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const item of clause.namedBindings.elements) {
        if (item.isTypeOnly) continue;
        if (["it", "test"].includes((item.propertyName || item.name).text)) {
          bindings.set(checker.getSymbolAtLocation(item.name), "vitest-test");
        }
      }
    }
  }
  const visit = (node, fn) => { fn(node); ts.forEachChild(node, (child) => visit(child, fn)); };
  const isBinding = (node, name) => ts.isIdentifier(node) && bindings.get(checker.getSymbolAtLocation(node)) === name;
  const isCall = (node, name) => ts.isCallExpression(node) && isBinding(node.expression, name);
  // Do not prove compiler identity when it is mocked, mutated, or escapes.
  let unsafe = false;
  visit(source, (node) => {
    if (ts.isPropertyAccessExpression(node)
      && /^(?:mock|doMock|spyOn|stubGlobal)$/.test(node.name.text)) unsafe = true;
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)
      && /^(?:mock|doMock|spyOn|stubGlobal)$/.test(node.argumentExpression.text)) unsafe = true;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && /^(?:eval|Function)$/.test(node.expression.text)) unsafe = true;
    if (!ts.isIdentifier(node)) return;
    const kind = bindings.get(checker.getSymbolAtLocation(node));
    if (!["postcss", "tailwindcss"].includes(kind)) return;
    if (ts.isImportClause(node.parent) || (ts.isCallExpression(node.parent) && node.parent.expression === node)) return;
    if (kind === "postcss" && ts.isPropertyAccessExpression(node.parent)
      && node.parent.expression === node && node.parent.name.text === "parse"
      && ts.isCallExpression(node.parent.parent) && node.parent.parent.expression === node.parent) return;
    unsafe = true;
  });
  if (unsafe) return [];
  const ranges = [];
  visit(source, (literal) => {
    if (!ts.isStringLiteral(literal)) return;
    const raw = literal.parent;
    if (!ts.isPropertyAssignment(raw) || raw.initializer !== literal
      || !ts.isIdentifier(raw.name) || raw.name.text !== "raw") return;
    const item = raw.parent;
    if (!ts.isObjectLiteralExpression(item) || item.properties.length !== 2) return;
    const extension = item.properties.find((p) => ts.isPropertyAssignment(p)
      && ts.isIdentifier(p.name) && p.name.text === "extension");
    if (!extension || !ts.isStringLiteral(extension.initializer) || extension.initializer.text !== "html") return;
    const list = item.parent;
    if (!ts.isArrayLiteralExpression(list) || list.elements.length !== 1 || list.elements[0] !== item) return;
    const content = list.parent;
    if (!ts.isPropertyAssignment(content) || !ts.isIdentifier(content.name) || content.name.text !== "content") return;
    const config = content.parent;
    if (!ts.isObjectLiteralExpression(config) || config.properties.some((p) => p !== content && !ts.isSpreadAssignment(p))) return;
    const tailwind = config.parent;
    if (!isCall(tailwind, "tailwindcss") || tailwind.arguments.length !== 1 || tailwind.arguments[0] !== config) return;
    const plugins = tailwind.parent;
    if (!ts.isArrayLiteralExpression(plugins) || plugins.elements.length !== 1) return;
    const postcss = plugins.parent;
    if (!isCall(postcss, "postcss") || postcss.arguments.length !== 1) return;
    const process = postcss.parent;
    if (!ts.isPropertyAccessExpression(process) || process.name.text !== "process") return;
    const compile = process.parent;
    if (!ts.isCallExpression(compile) || compile.expression !== process
      || !ts.isStringLiteral(compile.arguments[0]) || compile.arguments[0].text !== "@tailwind utilities;") return;
    let inTest = false;
    for (let parent = compile.parent; parent; parent = parent.parent) {
      if ((ts.isArrowFunction(parent) || ts.isFunctionExpression(parent))
        && isCall(parent.parent, "vitest-test") && parent.parent.arguments[1] === parent) inTest = true;
    }
    if (inTest) ranges.push({ start: literal.getStart(source), end: literal.end, rule: "tailwind-compile-only-v1" });
  });
  return ranges;
}
