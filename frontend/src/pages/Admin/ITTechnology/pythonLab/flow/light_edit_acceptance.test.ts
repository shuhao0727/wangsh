import { buildUnifiedFlowFromPython } from "./python_sync";
import { generatePythonFromFlow } from "./ir";
import { validatePythonStrict } from "./python_runtime";

test("示例图轻改后仍可生成可通过语法校验的代码", () => {
  const source = "for i in range(1, 10):\n  print(i)\n";
  const built = buildUnifiedFlowFromPython(source);
  expect(built).not.toBeNull();
  if (!built) return;

  const editedNodes = built.nodes.map((n) => {
    const title = String(n.title || "");
    if (title.includes("range(1, 10)")) {
      return { ...n, title: title.replace("range(1, 10)", "range(1, 12)") };
    }
    return n;
  });

  const editedEdges = built.edges.map((e) => {
    if (String(e.label || "") === "是") return { ...e, label: "True" };
    if (String(e.label || "") === "否") return { ...e, label: "False" };
    return e;
  });

  const generated = generatePythonFromFlow(editedNodes, editedEdges);
  const checked = validatePythonStrict(generated.python);
  expect(checked.ok).toBe(true);
  expect(generated.python).toContain("for i in range(1, 12):");
  expect(generated.python).toContain("print(i)");
});
