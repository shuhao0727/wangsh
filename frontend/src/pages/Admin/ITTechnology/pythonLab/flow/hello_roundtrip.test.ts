import { buildUnifiedFlowFromPython } from "./python_sync";

test("hello code can be converted to flow and back to runnable python", () => {
  const { generatePythonFromFlow } = require("./ir");
  const { validatePythonStrict } = require("./python_runtime");

  const code = ['name = "Python"', 'print("Hello,", name)', ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  expect(built.nodes.some((n) => n.shape === "io" && String(n.title || "").includes("print"))).toBe(true);

  const gen = generatePythonFromFlow(built.nodes, built.edges);
  const v = validatePythonStrict(gen.python);
  expect(v.ok).toBe(true);
  expect(gen.python.includes("print(")).toBe(true);
});

