import fs from "fs";
import path from "path";

const readHookSource = () =>
  fs.readFileSync(path.join(__dirname, "hooks", "useStreamEngine.ts"), "utf8");

const readPageSource = () =>
  fs.readFileSync(path.join(__dirname, "index.tsx"), "utf8");

test("useStreamEngine treats empty terminal events as explicit error", () => {
  const src = readHookSource();
  expect(src).toContain("const finishError = (message: string) =>");
  expect(src).toContain("finishError(\"模型未返回内容\")");
  expect(src).toContain("if (hasVisibleText(fullText))");
});

test("useStreamEngine prevents onEnd after error event", () => {
  const src = readHookSource();
  expect(src).toContain("finishError(String(errMsg));");
  expect(src).toContain("if (finished) return;");
});

test("AIAgents page does not append blank assistant message on stream end", () => {
  const src = readPageSource();
  expect(src).toContain("if (!fullText || !fullText.trim())");
  expect(src).toContain("⚠️ 模型未返回内容");
});
