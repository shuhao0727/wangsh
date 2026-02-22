import { parsePythonToIR } from "./python_sync";

type CodeIRBlock = { kind: "block"; items: CodeIRNode[] };
type CodeIRNode = CodeIRStmt | CodeIRIf | CodeIRWhile | CodeIRForRange | CodeIRDef;
type SourceLoc = { line: number };
type CodeIRStmt = { kind: "stmt"; text: string; loc: SourceLoc; focusRole?: string };
type CodeIRIf = { kind: "if"; cond: string; then: CodeIRBlock; else: CodeIRBlock | null; loc: SourceLoc };
type CodeIRWhile = { kind: "while"; cond: string; body: CodeIRBlock; loc: SourceLoc; focusRole?: string };
type CodeIRForRange = { kind: "for_range"; v: string; start: string; end: string; step: string | null; body: CodeIRBlock; loc: SourceLoc };
type CodeIRDef = { kind: "def"; name: string; params: string[]; body: CodeIRBlock; loc: SourceLoc };

type PyValue = number | string | boolean | null;
type Env = Record<string, PyValue>;

type Expr =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "none" }
  | { kind: "var"; name: string }
  | { kind: "unary"; op: "+" | "-" | "not"; expr: Expr }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "//" | "%" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "and" | "or"; left: Expr; right: Expr }
  | { kind: "call"; name: string; args: Expr[] }
  | { kind: "tuple"; items: Expr[] };

type Stmt =
  | { kind: "pass" }
  | { kind: "assign"; name: string; expr: Expr }
  | { kind: "aug_assign"; name: string; op: "+=" | "-="; expr: Expr }
  | { kind: "multi_assign"; names: string[]; exprs: Expr[] }
  | { kind: "print"; args: Expr[] }
  | { kind: "expr"; expr: Expr }
  | { kind: "return"; expr: Expr | null };

type StrictValidationResult = { ok: true; ir: CodeIRBlock; warnings: string[] } | { ok: false; errors: string[]; warnings: string[] };

export function validatePythonStrict(code: string): StrictValidationResult {
  const parsed = parsePythonToIR(code);
  if (!parsed.ok) return { ok: false, errors: parsed.warnings, warnings: [] };
  const errors: string[] = [];
  const warnings: string[] = [...parsed.warnings];

  const moduleDefs = new Set<string>();
  for (const it of (parsed.ir as any as CodeIRBlock).items) {
    if (it.kind === "def") {
      if (moduleDefs.has(it.name)) errors.push(`函数重复定义: ${it.name}`);
      moduleDefs.add(it.name);
    }
  }

  const checkCalls = (expr: Expr, allowed: Set<string>) => {
    const walkExpr = (e: Expr) => {
      if (e.kind === "call") {
        if (!allowed.has(e.name)) errors.push(`函数未定义: ${e.name}`);
        for (const a of e.args) walkExpr(a);
        return;
      }
      if (e.kind === "unary") {
        walkExpr(e.expr);
        return;
      }
      if (e.kind === "bin") {
        walkExpr(e.left);
        walkExpr(e.right);
        return;
      }
      if (e.kind === "tuple") {
        for (const a of e.items) walkExpr(a);
        return;
      }
    };
    walkExpr(expr);
  };

  const walk = (b: CodeIRBlock, inFunc: boolean, topLevelSeenDefs: Set<string>) => {
    for (const it of b.items) {
      if (it.kind === "stmt") {
        const r = parseStmtStrict(it.text);
        if (!r.ok) {
          errors.push(r.error);
        } else {
          if (r.stmt.kind === "return" && !inFunc) errors.push("return 只能出现在函数 def 内");
          const allowed = inFunc ? moduleDefs : topLevelSeenDefs;
          if (r.stmt.kind === "assign") checkCalls(r.stmt.expr, allowed);
          if (r.stmt.kind === "aug_assign") checkCalls(r.stmt.expr, allowed);
          if (r.stmt.kind === "multi_assign") for (const e of r.stmt.exprs) checkCalls(e, allowed);
          if (r.stmt.kind === "print") for (const e of r.stmt.args) checkCalls(e, allowed);
          if (r.stmt.kind === "expr") checkCalls(r.stmt.expr, allowed);
          if (r.stmt.kind === "return" && r.stmt.expr) checkCalls(r.stmt.expr, allowed);
        }
      } else if (it.kind === "if") {
        const c = parseExprStrict(it.cond);
        if (!c.ok) errors.push(c.error);
        else checkCalls(c.expr, inFunc ? moduleDefs : topLevelSeenDefs);
        walk(it.then, inFunc, topLevelSeenDefs);
        if (it.else) walk(it.else, inFunc, topLevelSeenDefs);
      } else if (it.kind === "while") {
        const c = parseExprStrict(it.cond);
        if (!c.ok) errors.push(c.error);
        else checkCalls(c.expr, inFunc ? moduleDefs : topLevelSeenDefs);
        walk(it.body, inFunc, topLevelSeenDefs);
      } else if (it.kind === "for_range") {
        const s = parseExprStrict(it.start);
        const e = parseExprStrict(it.end);
        if (!s.ok) errors.push(s.error);
        if (!e.ok) errors.push(e.error);
        if (s.ok) checkCalls(s.expr, inFunc ? moduleDefs : topLevelSeenDefs);
        if (e.ok) checkCalls(e.expr, inFunc ? moduleDefs : topLevelSeenDefs);
        if (it.step) {
          const st = parseExprStrict(it.step);
          if (!st.ok) errors.push(st.error);
          else if (st.expr.kind !== "num" || typeof st.expr.value !== "number" || !Number.isFinite(st.expr.value) || st.expr.value <= 0) {
            errors.push("for range 的 step 目前仅支持正数常量");
          }
        }
        walk(it.body, inFunc, topLevelSeenDefs);
      } else {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(it.name)) errors.push(`函数名不合法: ${it.name}`);
        for (const p of it.params) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(p)) errors.push(`参数名不合法: ${p}`);
        if (!inFunc) topLevelSeenDefs.add(it.name);
        walk(it.body, true, topLevelSeenDefs);
      }
    }
  };

  walk(parsed.ir as any, false, new Set<string>());
  if (errors.length) {
    const src = String(code || "");
    const hints: string[] = [];
    if (src.includes("elif ")) hints.push("提示：当前不支持 elif，可改成嵌套 if/else。");
    if (/\bf["']/.test(src)) hints.push("提示：当前不支持 f-string（例如 f\"...{x}...\"），可改成字符串拼接或 print 多参数。");
    if (src.includes("len(")) hints.push("提示：当前运行器未实现 len()。");
    if (/[A-Za-z_][A-Za-z0-9_]*\s*\[/.test(src)) hints.push("提示：当前运行器未实现列表/下标访问（例如 arr[i]）。");
    if (src.includes("[") && src.includes("]")) hints.push("提示：当前运行器对列表字面量（例如 [1,2,3]）支持不完整。");
    if (hints.length) warnings.push(...hints);
    return { ok: false, errors, warnings };
  }
  return { ok: true, ir: parsed.ir as any, warnings };
}

type Token =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "id"; v: string }
  | { k: "op"; v: string }
  | { k: "paren"; v: "(" | ")" }
  | { k: "comma" }
  | { k: "eof" };

function tokenizeExpr(src: string): { ok: true; tokens: Token[] } | { ok: false; error: string } {
  const s = src.trim();
  const tokens: Token[] = [];
  let i = 0;
  const pushOp = (v: string) => tokens.push({ k: "op", v });
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ k: "paren", v: ch });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ k: "comma" });
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const q = ch;
      let j = i + 1;
      let out = "";
      while (j < s.length) {
        const c = s[j];
        if (c === "\\" && j + 1 < s.length) {
          out += s[j + 1];
          j += 2;
          continue;
        }
        if (c === q) break;
        out += c;
        j += 1;
      }
      if (j >= s.length || s[j] !== q) return { ok: false, error: "字符串缺少结束引号" };
      tokens.push({ k: "str", v: out });
      i = j + 1;
      continue;
    }
    if ((ch >= "0" && ch <= "9") || (ch === "." && i + 1 < s.length && s[i + 1] >= "0" && s[i + 1] <= "9")) {
      let j = i + 1;
      while (j < s.length) {
        const c = s[j];
        if ((c >= "0" && c <= "9") || c === "." || c === "_") j += 1;
        else break;
      }
      const raw = s.slice(i, j).replaceAll("_", "");
      const num = Number(raw);
      if (Number.isNaN(num)) return { ok: false, error: `数字解析失败: ${raw}` };
      tokens.push({ k: "num", v: num });
      i = j;
      continue;
    }
    if ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_") {
      let j = i + 1;
      while (j < s.length) {
        const c = s[j];
        if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "_") j += 1;
        else break;
      }
      const id = s.slice(i, j);
      tokens.push({ k: "id", v: id });
      i = j;
      continue;
    }
    const two = s.slice(i, i + 2);
    const three = s.slice(i, i + 3);
    if (three === "//=") return { ok: false, error: "不支持 //=" };
    if (two === "//" || two === "==" || two === "!=" || two === "<=" || two === ">=") {
      pushOp(two);
      i += 2;
      continue;
    }
    if ("+-*/%<>".includes(ch)) {
      pushOp(ch);
      i += 1;
      continue;
    }
    return { ok: false, error: `无法识别字符: ${ch}` };
  }
  tokens.push({ k: "eof" });
  return { ok: true, tokens };
}

type ParseExprOk = { ok: true; expr: Expr };
type ParseExprErr = { ok: false; error: string };

function parseExprStrict(src: string): ParseExprOk | ParseExprErr {
  const t = tokenizeExpr(src);
  if (!t.ok) return { ok: false, error: t.error };
  let i = 0;
  const peek = () => t.tokens[i];
  const eat = () => t.tokens[i++];
  const expect = (k: Token["k"], v?: any) => {
    const p = peek();
    if (p.k !== k) return false;
    if (v !== undefined && (p as any).v !== v) return false;
    eat();
    return true;
  };

  const parseAtom = (): Expr | null => {
    const p = peek();
    if (p.k === "num") {
      eat();
      return { kind: "num", value: p.v };
    }
    if (p.k === "str") {
      eat();
      return { kind: "str", value: p.v };
    }
    if (p.k === "id") {
      eat();
      if (p.v === "True") return { kind: "bool", value: true };
      if (p.v === "False") return { kind: "bool", value: false };
      if (p.v === "None") return { kind: "none" };
      const name = p.v;
      if (peek().k === "paren" && (peek() as any).v === "(") {
        eat();
        const args: Expr[] = [];
        if (peek().k === "paren" && (peek() as any).v === ")") {
          eat();
          return { kind: "call", name, args };
        }
        while (true) {
          const a = parseOr();
          if (!a) return null;
          args.push(a);
          if (peek().k === "comma") {
            eat();
            continue;
          }
          if (peek().k === "paren" && (peek() as any).v === ")") {
            eat();
            break;
          }
          return null;
        }
        return { kind: "call", name, args };
      }
      return { kind: "var", name };
    }
    if (p.k === "paren" && p.v === "(") {
      eat();
      const e = parseOr();
      if (!e) return null;
      if (!expect("paren", ")")) return null;
      return e;
    }
    return null;
  };

  const parseUnary = (): Expr | null => {
    const p = peek();
    if (p.k === "op" && (p.v === "+" || p.v === "-")) {
      eat();
      const e = parseUnary();
      if (!e) return null;
      return { kind: "unary", op: p.v as any, expr: e };
    }
    if (p.k === "id" && p.v === "not") {
      eat();
      const e = parseUnary();
      if (!e) return null;
      return { kind: "unary", op: "not", expr: e };
    }
    return parseAtom();
  };

  const parseMul = (): Expr | null => {
    let left = parseUnary();
    if (!left) return null;
    while (true) {
      const p = peek();
      if (p.k !== "op" || !(p.v === "*" || p.v === "/" || p.v === "//" || p.v === "%")) break;
      eat();
      const right = parseUnary();
      if (!right) return null;
      left = { kind: "bin", op: p.v as any, left, right };
    }
    return left;
  };

  const parseAdd = (): Expr | null => {
    let left = parseMul();
    if (!left) return null;
    while (true) {
      const p = peek();
      if (p.k !== "op" || !(p.v === "+" || p.v === "-")) break;
      eat();
      const right = parseMul();
      if (!right) return null;
      left = { kind: "bin", op: p.v as any, left, right };
    }
    return left;
  };

  const parseCmp = (): Expr | null => {
    let left = parseAdd();
    if (!left) return null;
    const p = peek();
    if (p.k === "op" && (p.v === "==" || p.v === "!=" || p.v === "<" || p.v === "<=" || p.v === ">" || p.v === ">=")) {
      eat();
      const right = parseAdd();
      if (!right) return null;
      return { kind: "bin", op: p.v as any, left, right };
    }
    return left;
  };

  const parseAnd = (): Expr | null => {
    let left = parseCmp();
    if (!left) return null;
    while (true) {
      const p = peek();
      if (p.k !== "id" || p.v !== "and") break;
      eat();
      const right = parseCmp();
      if (!right) return null;
      left = { kind: "bin", op: "and", left, right };
    }
    return left;
  };

  const parseOr = (): Expr | null => {
    let left = parseAnd();
    if (!left) return null;
    while (true) {
      const p = peek();
      if (p.k !== "id" || p.v !== "or") break;
      eat();
      const right = parseAnd();
      if (!right) return null;
      left = { kind: "bin", op: "or", left, right };
    }
    return left;
  };

  const expr = parseOr();
  if (!expr) return { ok: false, error: `表达式解析失败: ${src}` };
  if (peek().k !== "eof") return { ok: false, error: `表达式存在多余内容: ${src}` };
  return { ok: true, expr };
}

function splitTopLevelComma(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'" || ch === '"') {
      const q = ch;
      buf += ch;
      i += 1;
      while (i < src.length) {
        buf += src[i];
        if (src[i] === "\\" && i + 1 < src.length) {
          i += 1;
          buf += src[i];
          i += 1;
          continue;
        }
        if (src[i] === q) break;
        i += 1;
      }
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim().length) out.push(buf.trim());
  return out;
}

function parseStmtStrict(line: string): { ok: true; stmt: Stmt } | { ok: false; error: string } {
  const t = line.trim();
  if (!t.length) return { ok: true, stmt: { kind: "pass" } };
  if (t === "pass") return { ok: true, stmt: { kind: "pass" } };

  const mReturn = /^return(?:\s+(.+))?\s*$/.exec(t);
  if (mReturn) {
    const exprSrc = (mReturn[1] ?? "").trim();
    if (!exprSrc.length) return { ok: true, stmt: { kind: "return", expr: null } };
    const e = parseExprStrict(exprSrc);
    if (!e.ok) return { ok: false, error: e.error };
    return { ok: true, stmt: { kind: "return", expr: e.expr } };
  }

  const mPrint = /^print\s*\((.*)\)\s*$/.exec(t);
  if (mPrint) {
    const inside = mPrint[1].trim();
    const parts = inside.length ? splitTopLevelComma(inside) : [];
    const args: Expr[] = [];
    for (const p of parts) {
      const e = parseExprStrict(p);
      if (!e.ok) return { ok: false, error: e.error };
      args.push(e.expr);
    }
    return { ok: true, stmt: { kind: "print", args } };
  }

  if (t.includes("input(")) return { ok: false, error: "暂不支持 input()" };

  const mAug = /^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=)\s*(.+)$/.exec(t);
  if (mAug) {
    const name = mAug[1];
    const op = mAug[2] as "+=" | "-=";
    const e = parseExprStrict(mAug[3]);
    if (!e.ok) return { ok: false, error: e.error };
    return { ok: true, stmt: { kind: "aug_assign", name, op, expr: e.expr } };
  }

  const mAssign = /^(.+?)\s*=\s*(.+)$/.exec(t);
  if (mAssign) {
    const left = mAssign[1].trim();
    const right = mAssign[2].trim();
    if (left.includes(",")) {
      const names = left.split(",").map((x) => x.trim()).filter(Boolean);
      if (!names.length) return { ok: false, error: "并行赋值左侧为空" };
      for (const n of names) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) return { ok: false, error: `并行赋值左侧变量名不合法: ${n}` };
      const parts = splitTopLevelComma(right);
      const exprs: Expr[] = [];
      for (const p of parts) {
        const e = parseExprStrict(p);
        if (!e.ok) return { ok: false, error: e.error };
        exprs.push(e.expr);
      }
      return { ok: true, stmt: { kind: "multi_assign", names, exprs } };
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(left)) return { ok: false, error: `赋值左侧变量名不合法: ${left}` };
    const e = parseExprStrict(right);
    if (!e.ok) return { ok: false, error: e.error };
    return { ok: true, stmt: { kind: "assign", name: left, expr: e.expr } };
  }

  const e = parseExprStrict(t);
  if (e.ok && e.expr.kind === "call") {
    return { ok: true, stmt: { kind: "expr", expr: e.expr } };
  }

  return { ok: false, error: `暂不支持的语句: ${t}` };
}
