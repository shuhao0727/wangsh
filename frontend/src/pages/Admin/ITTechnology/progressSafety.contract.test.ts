import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const pagePaths = ["ml", "ai", "agents"].map(
  (module) => `src/pages/Admin/ITTechnology/${module}/index.tsx`,
);

// Compare syntax and control-flow position, never source layout or comments.
const nodes = (root: ts.Node): ts.Node[] => {
  const result: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    result.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return result;
};
const unwrap = (node: ts.Node): ts.Node =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isNonNullExpression(node)
    ? unwrap(node.expression)
    : node;
const identifier = (node: ts.Node, name: string) =>
  ts.isIdentifier(unwrap(node)) &&
  (unwrap(node) as ts.Identifier).text === name;
const literal = (node: ts.Node, value: string) =>
  ts.isStringLiteral(unwrap(node)) &&
  (unwrap(node) as ts.StringLiteral).text === value;
const ref = (node: ts.Node, name: string) =>
  ts.isPropertyAccessExpression(unwrap(node)) &&
  identifier((unwrap(node) as ts.PropertyAccessExpression).expression, name) &&
  (unwrap(node) as ts.PropertyAccessExpression).name.text === "current";
const call = (node: ts.Node, name: string) =>
  ts.isCallExpression(node) && identifier(node.expression, name);
const containsCall = (node: ts.Node, name: string) =>
  nodes(node).some((child) => call(child, name));
const compare = (
  node: ts.Node,
  left: string,
  op: ts.SyntaxKind,
  right: string,
) => {
  const expression = unwrap(node);
  return (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === op &&
    identifier(expression.left, left) &&
    literal(expression.right, right)
  );
};
const statements = (node: ts.Node) =>
  ts.isBlock(node) ? Array.from(node.statements) : [node];
const exits = (node: ts.Node) =>
  statements(node).some(
    (statement) => ts.isReturnStatement(statement) && !statement.expression,
  );
const generationGuard = (node: ts.Node, id: string, reference: string) =>
  ts.isIfStatement(node) &&
  ts.isBinaryExpression(unwrap(node.expression)) &&
  identifier((unwrap(node.expression) as ts.BinaryExpression).left, id) &&
  (unwrap(node.expression) as ts.BinaryExpression).operatorToken.kind ===
    ts.SyntaxKind.ExclamationEqualsEqualsToken &&
  ref((unwrap(node.expression) as ts.BinaryExpression).right, reference) &&
  exits(node.thenStatement);
const increments = (node: ts.Node, reference: string) =>
  nodes(node).some(
    (child) =>
      (ts.isPrefixUnaryExpression(child) &&
        child.operator === ts.SyntaxKind.PlusPlusToken &&
        ref(child.operand, reference)) ||
      (ts.isBinaryExpression(child) &&
        child.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken &&
        ref(child.left, reference) &&
        ts.isNumericLiteral(child.right) &&
        child.right.text === "1"),
  );
const functionBody = (tree: ts.SourceFile, name: string): ts.Block => {
  const declaration = nodes(tree).find(
    (node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) && identifier(node.name, name),
  );
  const initial = declaration?.initializer;
  const callback =
    initial && ts.isCallExpression(initial) ? initial.arguments[0] : initial;
  expect(callback, `${name} callback`).toBeDefined();
  if (!callback || !ts.isArrowFunction(callback) || !ts.isBlock(callback.body))
    throw new Error(`${name} must have an inspectable body`);
  return callback.body;
};
const expectReadyGuard = (body: ts.Block, name: string) => {
  const first = body.statements[0];
  expect(
    ts.isIfStatement(first) &&
      compare(
        first.expression,
        "progressLoadState",
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        "ready",
      ) &&
      exits(first.thenStatement),
    `${name}: return before any write unless ready`,
  ).toBe(true);
};
const stateCall = (node: ts.Node, state: string) =>
  nodes(node).some(
    (child) =>
      ts.isCallExpression(child) &&
      identifier(child.expression, "setProgressLoadState") &&
      child.arguments.length === 1 &&
      literal(child.arguments[0], state),
  );
const retryHandler = (node: ts.Node) =>
  ts.isArrowFunction(unwrap(node)) &&
  containsCall((unwrap(node) as ts.ArrowFunction).body, "loadProgress") &&
  !containsCall(node, "saveProgress");
const jsxExpression = (element: ts.JsxOpeningLikeElement, name: string) => {
  const attribute = element.attributes.properties.find(
    (item): item is ts.JsxAttribute =>
      ts.isJsxAttribute(item) && item.name.getText() === name,
  );
  return attribute?.initializer &&
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression
    ? unwrap(attribute.initializer.expression)
    : undefined;
};

function assertProgressSafety(source: string, relativePath: string) {
  const tree = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const module = path.basename(path.dirname(relativePath));
  const read = functionBody(tree, "loadProgress");
  expect(
    increments(read.statements[0], "progressRequestRef"),
    "GET owns a new generation",
  ).toBe(true);
  expect(
    stateCall(read.statements[1], "loading"),
    "GET locks writes before awaiting",
  ).toBe(true);
  const readTry = read.statements.find((node): node is ts.TryStatement =>
    ts.isTryStatement(node),
  );
  expect(readTry).toBeDefined();
  if (!readTry?.catchClause) throw new Error("GET failure branch required");
  const get = nodes(readTry.tryBlock.statements[0]).find(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      identifier(node.expression.expression, "api") &&
      node.expression.name.text === "get",
  );
  expect(
    get && literal(get.arguments[0], `/learning/progress/${module}`),
    "GET reads this module",
  ).toBe(true);
  expect(
    generationGuard(
      readTry.tryBlock.statements[1],
      "requestId",
      "progressRequestRef",
    ),
    "late GET success cannot write baseline/version/ready",
  ).toBe(true);
  expect(
    generationGuard(
      readTry.catchClause.block.statements[0],
      "requestId",
      "progressRequestRef",
    ),
    "late GET failure cannot clear a newer baseline",
  ).toBe(true);
  expect(
    stateCall(readTry.tryBlock, "ready"),
    "successful GET becomes ready",
  ).toBe(true);
  expect(
    stateCall(readTry.catchClause.block, "error"),
    "failed GET remains error",
  ).toBe(true);
  expect(
    nodes(readTry.tryBlock).some(
      (node) =>
        ts.isBinaryExpression(node) &&
        ref(node.left, "progressVersionRef") &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.right) &&
        node.right.name.text === "version",
    ),
    "GET retains server version",
  ).toBe(true);

  for (const name of [
    "saveProgress",
    ...(module === "ml" ? ["handleStageStatusChange"] : []),
    "toggleCompletedItem",
    "toggleFavoriteItem",
    "toggleCompletedChapter",
    "toggleFavoriteChapter",
  ]) {
    expectReadyGuard(functionBody(tree, name), name);
  }
  const save = functionBody(tree, "saveProgress");
  expect(
    increments(save.statements[1], "progressSaveRequestRef"),
    "PATCH owns a new generation",
  ).toBe(true);
  const saveTry = save.statements.find((node): node is ts.TryStatement =>
    ts.isTryStatement(node),
  );
  if (!saveTry?.catchClause || !saveTry.finallyBlock)
    throw new Error("PATCH failure/finally branches required");
  const patchStatement = saveTry.tryBlock.statements.findIndex((statement) =>
    nodes(statement).some(
      (node) =>
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        identifier(node.expression.expression, "api") &&
        node.expression.name.text === "patch",
    ),
  );
  expect(patchStatement, "PATCH request exists").toBeGreaterThanOrEqual(0);
  const patch = nodes(saveTry.tryBlock.statements[patchStatement]).find(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      identifier(node.expression.expression, "api") &&
      node.expression.name.text === "patch",
  )!;
  expect(
    literal(patch.arguments[0], `/learning/progress/${module}`),
    "PATCH writes this module",
  ).toBe(true);
  const payload = unwrap(patch.arguments[1]);
  expect(
    ts.isCallExpression(payload) &&
      identifier(payload.expression, "withLearningProgressVersion") &&
      payload.arguments.length === 2 &&
      ref(payload.arguments[1], "progressVersionRef"),
    "PATCH carries the loaded version",
  ).toBe(true);
  expect(
    generationGuard(
      saveTry.tryBlock.statements[patchStatement + 1],
      "saveRequestId",
      "progressSaveRequestRef",
    ),
    "late PATCH success cannot replace version or toast",
  ).toBe(true);
  expect(
    generationGuard(
      saveTry.catchClause.block.statements[0],
      "saveRequestId",
      "progressSaveRequestRef",
    ),
    "late PATCH failure cannot trigger conflict reload/toast",
  ).toBe(true);
  const release = saveTry.finallyBlock.statements[0];
  expect(
    ts.isIfStatement(release) &&
      ts.isBinaryExpression(unwrap(release.expression)) &&
      identifier(
        (unwrap(release.expression) as ts.BinaryExpression).left,
        "saveRequestId",
      ) &&
      (unwrap(release.expression) as ts.BinaryExpression).operatorToken.kind ===
        ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ref(
        (unwrap(release.expression) as ts.BinaryExpression).right,
        "progressSaveRequestRef",
      ) &&
      containsCall(release.thenStatement, "setProgressSaving"),
    "only current PATCH releases saving",
  ).toBe(true);
  const conflict = nodes(saveTry.catchClause.block).find(
    (node): node is ts.IfStatement =>
      ts.isIfStatement(node) &&
      call(unwrap(node.expression), "isLearningProgressVersionConflict"),
  );
  expect(
    conflict && containsCall(conflict.thenStatement, "loadProgress"),
    "409 rereads the baseline",
  ).toBe(true);

  const effects = nodes(tree).filter(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) && identifier(node.expression, "useEffect"),
  );
  expect(
    effects.some((effect) => {
      const callback = effect.arguments[0];
      if (
        !callback ||
        !ts.isArrowFunction(callback) ||
        !ts.isBlock(callback.body) ||
        !containsCall(callback.body, "loadProgress")
      )
        return false;
      const cleanup = callback.body.statements.find(
        (node): node is ts.ReturnStatement => ts.isReturnStatement(node),
      );
      return (
        !!cleanup?.expression &&
        increments(cleanup.expression, "progressRequestRef") &&
        increments(cleanup.expression, "progressSaveRequestRef")
      );
    }),
    "unmount invalidates reads and saves",
  ).toBe(true);

  const buttons = nodes(tree).filter(
    (node): node is ts.JsxOpeningElement =>
      ts.isJsxOpeningElement(node) && identifier(node.tagName, "button"),
  );
  const book = buttons.find((element) =>
    nodes(element.parent).some((node) => literal(node, "保存进度")),
  );
  expect(book, "actual book page save/retry button").toBeDefined();
  if (!book) throw new Error("book page button missing");
  const handler = jsxExpression(book, "onClick");
  expect(
    handler &&
      ts.isConditionalExpression(handler) &&
      compare(
        handler.condition,
        "progressLoadState",
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        "error",
      ) &&
      retryHandler(handler.whenTrue) &&
      identifier(handler.whenFalse, "saveProgress"),
    "book GET failure binds retry, never save",
  ).toBe(true);
  const disabled = jsxExpression(book, "disabled");
  expect(
    disabled &&
      ts.isBinaryExpression(disabled) &&
      disabled.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
      identifier(disabled.left, "progressSaving") &&
      compare(
        disabled.right,
        "progressLoadState",
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        "loading",
      ),
    "book button disabled for GET loading and PATCH pending",
  ).toBe(true);
}

// Mutate parsed nodes in memory. The same validator must reject each broken branch.
type Mutation = {
  name: string;
  change: (node: ts.Node) => ts.Node | undefined;
};
const mutations: Mutation[] = [
  {
    name: "error button misbound to save",
    change: (node) =>
      ts.isConditionalExpression(node) &&
      compare(
        node.condition,
        "progressLoadState",
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        "error",
      ) &&
      retryHandler(node.whenTrue)
        ? ts.factory.updateConditionalExpression(
            node,
            node.condition,
            node.questionToken,
            ts.factory.createIdentifier("saveProgress"),
            node.colonToken,
            node.whenFalse,
          )
        : undefined,
  },
  {
    name: "ready guard removed",
    change: (node) =>
      ts.isIfStatement(node) &&
      compare(
        node.expression,
        "progressLoadState",
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        "ready",
      )
        ? ts.factory.createEmptyStatement()
        : undefined,
  },
  {
    name: "ready guard inverted",
    change: (node) =>
      ts.isBinaryExpression(node) &&
      compare(
        node,
        "progressLoadState",
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        "ready",
      )
        ? ts.factory.updateBinaryExpression(
            node,
            node.left,
            ts.factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
            node.right,
          )
        : undefined,
  },
  {
    name: "loading button guard removed",
    change: (node) =>
      ts.isBinaryExpression(node) &&
      compare(
        node,
        "progressLoadState",
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        "loading",
      )
        ? ts.factory.createFalse()
        : undefined,
  },
  {
    name: "PATCH changed to PUT",
    change: (node) =>
      ts.isPropertyAccessExpression(node) &&
      identifier(node.expression, "api") &&
      node.name.text === "patch"
        ? ts.factory.updatePropertyAccessExpression(
            node,
            node.expression,
            ts.factory.createIdentifier("put"),
          )
        : undefined,
  },
  {
    name: "version wrapper removed",
    change: (node) =>
      call(node, "withLearningProgressVersion")
        ? (node as ts.CallExpression).arguments[0]
        : undefined,
  },
  {
    name: "version replaced with null",
    change: (node) =>
      call(node, "withLearningProgressVersion")
        ? ts.factory.updateCallExpression(
            node as ts.CallExpression,
            (node as ts.CallExpression).expression,
            undefined,
            [(node as ts.CallExpression).arguments[0], ts.factory.createNull()],
          )
        : undefined,
  },
  ...["requestId", "saveRequestId"].flatMap((id): Mutation[] =>
    ["success", "failure"].map((branch) => ({
      name: `late ${id} ${branch} guard removed`,
      change: (node) =>
        ts.isIfStatement(node) &&
        generationGuard(
          node,
          id,
          id === "requestId" ? "progressRequestRef" : "progressSaveRequestRef",
        ) &&
        ts.isBlock(node.parent) &&
        (branch === "failure"
          ? ts.isCatchClause(node.parent.parent)
          : ts.isTryStatement(node.parent.parent))
          ? ts.factory.createEmptyStatement()
          : undefined,
    })),
  ),
  {
    name: "PATCH finally generation guard removed",
    change: (node) =>
      ts.isIfStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      identifier(node.expression.left, "saveRequestId") &&
      node.expression.operatorToken.kind ===
        ts.SyntaxKind.EqualsEqualsEqualsToken
        ? node.thenStatement
        : undefined,
  },
  {
    name: "unmount invalidation removed",
    change: (node) =>
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken &&
      ref(node.left, "progressRequestRef")
        ? ts.factory.createNumericLiteral(0)
        : undefined,
  },
  {
    name: "failed GET incorrectly marked ready",
    change: (node) =>
      ts.isCallExpression(node) &&
      identifier(node.expression, "setProgressLoadState") &&
      literal(node.arguments[0], "error")
        ? ts.factory.updateCallExpression(node, node.expression, undefined, [
            ts.factory.createStringLiteral("ready"),
          ])
        : undefined,
  },
];
const mutate = (source: string, file: string, mutation: Mutation) => {
  let changes = 0;
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const transformed = ts.transform(tree, [
    (context) => (root) => {
      const visit: ts.Visitor = (node) => {
        const changed = mutation.change(node);
        if (changed) {
          changes += 1;
          return changed;
        }
        return ts.visitEachChild(node, visit, context);
      };
      return ts.visitNode(root, visit) as ts.SourceFile;
    },
  ]);
  const result = ts.createPrinter().printFile(transformed.transformed[0]);
  transformed.dispose();
  expect(changes, `${mutation.name} actually injected`).toBeGreaterThan(0);
  return result;
};

describe.each(pagePaths)("learning progress AST safety: %s", (relativePath) => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    "utf8",
  );
  it("guards reads, retries, writes, versions and request generations", () =>
    assertProgressSafety(source, relativePath));
  it("accepts equivalent formatting and comments", () => {
    const tree = ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    assertProgressSafety(
      ts
        .createPrinter({
          removeComments: true,
          newLine: ts.NewLineKind.CarriageReturnLineFeed,
        })
        .printFile(tree),
      relativePath,
    );
  });
  it.each(mutations)("rejects $name", (mutation) => {
    const broken = mutate(source, relativePath, mutation);
    expect(() => assertProgressSafety(broken, relativePath)).toThrow();
  });
});
