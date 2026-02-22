import { buildUnifiedFlowFromPython } from "./python_sync";
import { arrangeFromIRElk } from "./ir_layout_elk";
import { nodeSize } from "./ports";

function rectFor(n: { x: number; y: number; shape: any }) {
  const s = nodeSize(n.shape);
  return { minX: n.x, minY: n.y, maxX: n.x + s.w, maxY: n.y + s.h };
}

function rectIntersects(a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }) {
  return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxY <= b.minY || a.minY >= b.maxY);
}

async function assertLayoutOk(code: string) {
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const laid = await arrangeFromIRElk(built.nodes, built.edges, { width: 1200, height: 800 });
  for (let i = 0; i < laid.nodes.length; i++) {
    for (let j = i + 1; j < laid.nodes.length; j++) {
      expect(rectIntersects(rectFor(laid.nodes[i]), rectFor(laid.nodes[j]))).toBe(false);
    }
  }
}

test("baseline: straight-line statements", async () => {
  await assertLayoutOk(["a = 1", "b = 2", "c = a + b", "print(c)", ""].join("\n"));
});

test("baseline: nested branches (else contains if)", async () => {
  await assertLayoutOk(
    [
      "score = 83",
      "if score >= 90:",
      "  grade = 'A'",
      "else:",
      "  if score >= 60:",
      "    grade = 'B'",
      "  else:",
      "    grade = 'C'",
      "print(grade)",
      "",
    ].join("\n")
  );
});

test("baseline: while loop", async () => {
  await assertLayoutOk(["i = 0", "total = 0", "while i < 10:", "  total += i", "  i += 1", "print(total)", ""].join("\n"));
});

test("baseline: for range loop", async () => {
  await assertLayoutOk(["total = 0", "for i in range(10):", "  total += i", "print(total)", ""].join("\n"));
});

test("baseline: function definition + main", async () => {
  await assertLayoutOk(
    [
      "def sum_n(n):",
      "  total = 0",
      "  for i in range(n):",
      "    total += i",
      "  return total",
      "",
      "ans = sum_n(10)",
      "print(ans)",
      "",
    ].join("\n")
  );
});

