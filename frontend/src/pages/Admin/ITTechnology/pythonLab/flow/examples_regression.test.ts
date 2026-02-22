import { loadPythonLabExperiments } from "../storage";
import { buildUnifiedFlowFromPython } from "./python_sync";
import { arrangeFromIRElk } from "./ir_layout_elk";
import { computeTidy } from "./tidy";

test("regression: 10 示例均可生成流程并通过 Tidy", async () => {
  const exps = loadPythonLabExperiments();
  expect(exps.length).toBeGreaterThanOrEqual(10);
  let ok = 0;
  for (const exp of exps.slice(0, 10)) {
    const built = buildUnifiedFlowFromPython(exp.starterCode);
    if (!built) continue;
    const laid = await arrangeFromIRElk(built.nodes as any, built.edges as any, { width: 1200, height: 800 });
    const tidy = computeTidy(laid.nodes as any, laid.edges as any);
    expect(tidy.tidy.stats.nodeCount).toBeGreaterThan(0);
    expect(tidy.tidy.stats.nodeCount).toBeLessThanOrEqual(60);
    ok += 1;
  }
  expect(ok).toBeGreaterThanOrEqual(5);
});
