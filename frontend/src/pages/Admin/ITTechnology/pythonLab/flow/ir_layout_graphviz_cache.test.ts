import { __resetGraphvizLayoutCacheForTest, arrangeWithGraphviz } from "./layout_graphviz";
import { __resetGraphvizForTest, __setGraphvizForTest } from "./graphviz";

test("arrangeWithGraphviz writes fromAttach/toAttach within 0..1 and is deterministic", async () => {
  __resetGraphvizLayoutCacheForTest();
  __resetGraphvizForTest();
  __setGraphvizForTest({
    layout: jest.fn((dot: string, format: string) => {
      if (format !== "plain") return "";

      const nodeNames = new Set<string>();
      const edgePairs: { from: string; to: string }[] = [];

      for (const line of dot.split("\n")) {
        const nm = line.match(/^\s*([A-Za-z0-9_]+)\s*\[/);
        if (nm) {
          const name = nm[1];
          if (name !== "graph" && name !== "node" && name !== "edge") nodeNames.add(name);
        }
        const em = line.match(/^\s*([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)\s*\[/);
        if (em) edgePairs.push({ from: em[1], to: em[2] });
      }

      const sortedNodes = Array.from(nodeNames).sort((a, b) => a.localeCompare(b));
      const heightIn = 20;
      const widthIn = 20;
      const pos = new Map<string, { xIn: number; yIn: number }>();
      for (let i = 0; i < sortedNodes.length; i++) {
        pos.set(sortedNodes[i], { xIn: 2 + i * 3, yIn: 2 + i * 3 });
      }

      const nodeLines = sortedNodes.map((n) => {
        const p = pos.get(n)!;
        return `node ${n} ${p.xIn} ${p.yIn} 0.5 0.3 "${n}" solid box black lightgrey`;
      });

      const edgeLines: string[] = [];
      for (const e of edgePairs) {
        const fp = pos.get(e.from);
        const tp = pos.get(e.to);
        if (!fp || !tp) continue;
        edgeLines.push(`edge ${e.from} ${e.to} 2 ${fp.xIn} ${fp.yIn} ${tp.xIn} ${tp.yIn} solid black`);
      }

      return [`graph ${widthIn} ${heightIn} 1.0`, ...nodeLines, ...edgeLines, "stop"].join("\n");
    }),
  });

  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "a", shape: "process", title: "A", x: 0, y: 0 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 0 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "a", style: "straight" },
    { id: "e2", from: "a", to: "e", style: "straight" },
  ];

  const first = await arrangeWithGraphviz(nodes as any, edges as any, { width: 800, height: 600 });
  const second = await arrangeWithGraphviz(nodes as any, edges as any, { width: 800, height: 600 });

  expect(first.nodes.map((n: any) => `${n.id}:${n.x},${n.y}`).join("|")).toBe(second.nodes.map((n: any) => `${n.id}:${n.x},${n.y}`).join("|"));
  expect(first.edges.map((e: any) => `${e.id}:${e.fromPort}->${e.toPort}`).join("|")).toBe(second.edges.map((e: any) => `${e.id}:${e.fromPort}->${e.toPort}`).join("|"));
  expect(first.edges.map((e: any) => `${e.id}:${JSON.stringify(e.fromAttach)}:${JSON.stringify(e.toAttach)}`).join("|")).toBe(
    second.edges.map((e: any) => `${e.id}:${JSON.stringify(e.fromAttach)}:${JSON.stringify(e.toAttach)}`).join("|")
  );

  for (const e of first.edges as any[]) {
    if (e.toEdge) continue;
    expect(e.fromAttach).toBeTruthy();
    expect(e.toAttach).toBeTruthy();
    expect(typeof e.fromAttach?.x).toBe("number");
    expect(typeof e.fromAttach?.y).toBe("number");
    expect(typeof e.toAttach?.x).toBe("number");
    expect(typeof e.toAttach?.y).toBe("number");
    expect(e.fromAttach.x).toBeGreaterThanOrEqual(0);
    expect(e.fromAttach.x).toBeLessThanOrEqual(1);
    expect(e.fromAttach.y).toBeGreaterThanOrEqual(0);
    expect(e.fromAttach.y).toBeLessThanOrEqual(1);
    expect(e.toAttach.x).toBeGreaterThanOrEqual(0);
    expect(e.toAttach.x).toBeLessThanOrEqual(1);
    expect(e.toAttach.y).toBeGreaterThanOrEqual(0);
    expect(e.toAttach.y).toBeLessThanOrEqual(1);
  }
});
