import { __resetIrElkCacheForTest, arrangeFromIRElk } from "./ir_layout_elk";

test("arrangeFromIRElk returns cached result for identical input", async () => {
  __resetIrElkCacheForTest();
  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "a", shape: "process", title: "A", x: 0, y: 0 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 0 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "a", style: "straight" },
    { id: "e2", from: "a", to: "e", style: "straight" },
  ];

  const first = await arrangeFromIRElk(nodes as any, edges as any, { width: 800, height: 600 });
  const second = await arrangeFromIRElk(nodes as any, edges as any, { width: 800, height: 600 });

  expect(first.nodes.map((n: any) => `${n.id}:${n.x},${n.y}`).join("|")).toBe(second.nodes.map((n: any) => `${n.id}:${n.x},${n.y}`).join("|"));
  expect(first.edges.map((e: any) => `${e.id}:${e.fromPort}->${e.toPort}`).join("|")).toBe(second.edges.map((e: any) => `${e.id}:${e.fromPort}->${e.toPort}`).join("|"));
});

