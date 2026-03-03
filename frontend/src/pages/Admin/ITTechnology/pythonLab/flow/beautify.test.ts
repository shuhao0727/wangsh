import { applyPlainLayoutToCanvas, buildDot, computeBeautify, parsePlain, DEFAULT_BEAUTIFY_PARAMS } from "./beautify";
import { __resetGraphvizForTest, __setGraphvizForTest } from "./graphviz";
import { nodeSizeForTitle } from "./ports";

test("parsePlain reads graph size and node centers", () => {
  const plain = [
    "graph 4.0 3.0 1.0",
    "node n_1 1.0 2.0 0.5 0.3 A solid box black lightgrey",
    "node n_2 2.5 1.0 0.6 0.3 B solid box black lightgrey",
    'edge n_1 n_2 2 1.0 2.0 2.5 1.0 "是" 1.8 1.6 solid black',
    "stop",
  ].join("\n");
  const g = parsePlain(plain);
  expect(g.widthIn).toBeCloseTo(4.0);
  expect(g.heightIn).toBeCloseTo(3.0);
  expect(g.nodes.get("n_1")?.cxIn).toBeCloseTo(1.0);
  const e = g.edges.get("n_1__n_2")?.[0];
  expect(e?.label).toBe("是");
  expect(e?.labelPosIn?.xIn).toBeCloseTo(1.8);
  expect(e?.labelPosIn?.yIn).toBeCloseTo(1.6);
});

test("computeBeautify renders svg/plain from the same DOT", async () => {
  const mockLayout = jest.fn((dot: string, format: string, engine: string) => {
    if (format === "plain") {
      return [
        "graph 4.0 3.0 1.0",
        "node n_1 1.0 2.0 0.5 0.3 A solid box black lightgrey",
        "node n_2 2.0 1.0 0.5 0.3 B solid box black lightgrey",
        'edge n_1 n_2 2 1.0 2.0 2.0 1.0 "是" 1.5 1.5 solid black',
        "stop",
      ].join("\n");
    }
    return `<svg data-engine="${engine}" data-dot-len="${dot.length}"></svg>`;
  });
  __resetGraphvizForTest();
  __setGraphvizForTest({ layout: mockLayout });

  const nodes: any[] = [
    { id: "a", shape: "process", title: "A", x: 0, y: 0 },
    { id: "b", shape: "process", title: "B", x: 0, y: 0 },
  ];
  const edges: any[] = [{ id: "e1", from: "a", to: "b", style: "straight", label: "是" }];

  const res = await computeBeautify(nodes as any, edges as any, DEFAULT_BEAUTIFY_PARAMS);

  const svgCall = mockLayout.mock.calls.find((c: any[]) => c[1] === "svg");
  const plainCall = mockLayout.mock.calls.find((c: any[]) => c[1] === "plain");
  expect(svgCall).toBeTruthy();
  expect(plainCall).toBeTruthy();
  expect(svgCall?.[0]).toBe(plainCall?.[0]);
  expect(res.dot).toBe(svgCall?.[0]);
  expect(res.dot).not.toContain("e_1");
  expect(res.dot).not.toContain("shape=none");
  expect(res.dot).not.toContain("shape=point");
});

test("computeBeautify output is deterministic for different nodes/edges array order", async () => {
  const mockLayout = jest.fn((dot: string, format: string, engine: string) => {
    if (format === "plain") {
      const names = new Set<string>();
      for (const line of dot.split("\n")) {
        const m = line.match(/^\s*([A-Za-z0-9_]+)\s*\[/);
        if (!m) continue;
        const name = m[1];
        if (name === "graph" || name === "node" || name === "edge") continue;
        names.add(name);
      }
      const sorted = Array.from(names).sort((a, b) => a.localeCompare(b));
      return ["graph 10.0 10.0 1.0", ...sorted.map((n, i) => `node ${n} ${1 + i} ${1 + i} 0.5 0.3 "${n}" solid box black lightgrey`), "stop"].join("\n");
    }
    return `<svg data-engine="${engine}" data-dot-len="${dot.length}"></svg>`;
  });
  __resetGraphvizForTest();
  __setGraphvizForTest({ layout: mockLayout });

  const nodes1: any[] = [
    { id: "b", shape: "process", title: "B", x: 0, y: 0 },
    { id: "a", shape: "process", title: "A", x: 0, y: 0 },
    { id: "c", shape: "process", title: "C", x: 0, y: 0 },
  ];
  const edges1: any[] = [
    { id: "e2", from: "a", to: "c", style: "straight", label: "否" },
    { id: "e1", from: "a", to: "b", style: "straight", label: "是" },
  ];

  const nodes2: any[] = [nodes1[2], nodes1[0], nodes1[1]];
  const edges2: any[] = [edges1[1], edges1[0]];

  const r1 = await computeBeautify(nodes1 as any, edges1 as any, DEFAULT_BEAUTIFY_PARAMS);
  const r2 = await computeBeautify(nodes2 as any, edges2 as any, DEFAULT_BEAUTIFY_PARAMS);

  expect(r1.dot).toBe(r2.dot);
  expect(r1.svg).toBe(r2.svg);
  expect(r1.plain).toBe(r2.plain);
  expect(r1.layout.nodes).toEqual(r2.layout.nodes);
  expect(r1.layout.edges).toEqual(r2.layout.edges);
});

test("applyPlainLayoutToCanvas maps node centers into canvas x/y", () => {
  const nodes: any[] = [
    { id: "a", shape: "process", title: "A", x: 0, y: 0 },
    { id: "b", shape: "process", title: "B", x: 0, y: 0 },
  ];
  const edges: any[] = [{ id: "e1", from: "a", to: "b", style: "straight" }];
  const { nameById } = buildDot(nodes as any, edges as any, DEFAULT_BEAUTIFY_PARAMS);
  const plain = [
    "graph 4.0 3.0 1.0",
    "node n_1 1.0 2.0 0.5 0.3 A solid box black lightgrey",
    "node n_2 2.0 1.0 0.5 0.3 B solid box black lightgrey",
    "stop",
  ].join("\n");
  const out = applyPlainLayoutToCanvas(nodes as any, edges as any, plain, nameById);
  const a = out.nodes.find((n: any) => n.id === "a");
  const b = out.nodes.find((n: any) => n.id === "b");
  expect(a).toBeTruthy();
  expect(b).toBeTruthy();
  expect(typeof a?.x).toBe("number");
  expect(typeof a?.y).toBe("number");
});

test("applyPlainLayoutToCanvas writes FlowEdge.labelPosition from plain lp", () => {
  const nodes: any[] = [
    { id: "a", shape: "process", title: "A", x: 0, y: 0 },
    { id: "b", shape: "process", title: "B", x: 0, y: 0 },
  ];
  const edges: any[] = [{ id: "e1", from: "a", to: "b", style: "straight", label: "是" }];
  const { nameById } = buildDot(nodes as any, edges as any, DEFAULT_BEAUTIFY_PARAMS);

  const from = nameById.get("a")!;
  const to = nameById.get("b")!;

  const plain = [
    "graph 4.0 3.0 1.0",
    `node ${from} 1.0 2.0 0.5 0.3 A solid box black lightgrey`,
    `node ${to} 2.0 1.0 0.5 0.3 B solid box black lightgrey`,
    `edge ${from} ${to} 3 1.0 2.0 1.5 1.5 2.0 1.0 "是" 2.0 1.5 solid black`,
    "stop",
  ].join("\n");

  const out = applyPlainLayoutToCanvas(nodes as any, edges as any, plain, nameById);
  const e = out.edges.find((x: any) => x.id === "e1");
  expect(e).toBeTruthy();
  expect(e?.labelPosition).toBeTruthy();
  expect(e?.labelPosition?.x).toBeCloseTo(144);
  expect(e?.labelPosition?.y).toBeCloseTo(108);
});

test("applyPlainLayoutToCanvas writes fromAttach/toAttach and does not force decision ports", () => {
  const nodes: any[] = [
    { id: "d", shape: "decision", title: "D", x: 0, y: 0 },
    { id: "b", shape: "process", title: "B", x: 0, y: 0 },
  ];
  const edges: any[] = [{ id: "e1", from: "d", to: "b", style: "straight", label: "否" }];
  const { nameById } = buildDot(nodes as any, edges as any, DEFAULT_BEAUTIFY_PARAMS);

  const from = nameById.get("d")!;
  const to = nameById.get("b")!;

  const plain = [
    "graph 4.0 3.0 1.0",
    `node ${from} 1.0 2.0 0.5 0.3 D solid box black lightgrey`,
    `node ${to} 2.0 1.0 0.5 0.3 B solid box black lightgrey`,
    `edge ${from} ${to} 3 1.0 2.0 1.5 1.5 2.0 1.0 "否" 1.7 1.5 solid black`,
    "stop",
  ].join("\n");

  const out = applyPlainLayoutToCanvas(nodes as any, edges as any, plain, nameById);
  const e = out.edges.find((x: any) => x.id === "e1");
  expect(e?.fromPort).toBeUndefined();
  expect(e?.toPort).toBeUndefined();
  expect(e?.fromAttach).toBeTruthy();
  expect(e?.toAttach).toBeTruthy();
  expect(typeof e?.fromAttach?.x).toBe("number");
  expect(typeof e?.fromAttach?.y).toBe("number");
  expect(typeof e?.toAttach?.x).toBe("number");
  expect(typeof e?.toAttach?.y).toBe("number");
  expect(e?.fromAttach?.x).toBeGreaterThanOrEqual(0);
  expect(e?.fromAttach?.x).toBeLessThanOrEqual(1);
  expect(e?.fromAttach?.y).toBeGreaterThanOrEqual(0);
  expect(e?.fromAttach?.y).toBeLessThanOrEqual(1);
  expect(e?.toAttach?.x).toBeGreaterThanOrEqual(0);
  expect(e?.toAttach?.x).toBeLessThanOrEqual(1);
  expect(e?.toAttach?.y).toBeGreaterThanOrEqual(0);
  expect(e?.toAttach?.y).toBeLessThanOrEqual(1);
});

test("if/else applyPlainLayoutToCanvas keeps branches left/right and labelPosition stable", () => {
  const nodes: any[] = [
    { id: "cond", shape: "decision", title: "x % 2 == 0 ?", x: 0, y: 0 },
    { id: "then", shape: "process", title: "msg = 'even'", x: 0, y: 0 },
    { id: "else", shape: "process", title: "msg = 'odd'", x: 0, y: 0 },
    { id: "join", shape: "connector", title: "", x: 0, y: 0 },
  ];
  const edges: any[] = [
    { id: "e_yes", from: "cond", to: "then", style: "straight", label: "是" },
    { id: "e_no", from: "cond", to: "else", style: "straight", label: "否" },
    { id: "e_then", from: "then", to: "join", style: "straight" },
    { id: "e_else", from: "else", to: "join", style: "straight" },
  ];

  const { nameById } = buildDot(nodes as any, edges as any, DEFAULT_BEAUTIFY_PARAMS);

  const heightIn = 12;
  const pxPerIn = 72;
  const toIn = (px: number) => Number((px / pxPerIn).toFixed(4));
  const toGvYIn = (yPx: number) => Number((heightIn - yPx / pxPerIn).toFixed(4));
  const pt = (xPx: number, yPx: number) => `${toIn(xPx)} ${toGvYIn(yPx)}`;

  const centersPx: Record<string, { x: number; y: number }> = {
    cond: { x: 300, y: 200 },
    then: { x: 190, y: 360 },
    else: { x: 410, y: 360 },
    join: { x: 300, y: 540 },
  };

  const nodeSizePxById = new Map<string, { w: number; h: number }>();
  for (const n of nodes) nodeSizePxById.set(n.id, nodeSizeForTitle(n.shape, n.title));
  const boundary = (nodeId: string, side: "top" | "right" | "bottom" | "left") => {
    const c = centersPx[nodeId];
    const s = nodeSizePxById.get(nodeId)!;
    if (side === "top") return { x: c.x, y: c.y - s.h / 2 };
    if (side === "bottom") return { x: c.x, y: c.y + s.h / 2 };
    if (side === "left") return { x: c.x - s.w / 2, y: c.y };
    return { x: c.x + s.w / 2, y: c.y };
  };

  const nodeLines: string[] = [];
  for (const n of nodes) {
    const gv = nameById.get(n.id)!;
    const c = centersPx[n.id];
    const s = nodeSizeForTitle(n.shape, n.title);
    nodeLines.push(`node ${gv} ${toIn(c.x)} ${toGvYIn(c.y)} ${toIn(s.w)} ${toIn(s.h)} "${n.title}" solid box black lightgrey`);
  }

  const edgeLine = (from: string, to: string, pointsPx: { x: number; y: number }[], label?: string, labelPosPx?: { x: number; y: number }) => {
    const pts = pointsPx.map((p) => pt(p.x, p.y)).join(" ");
    const n = pointsPx.length;
    if (label && labelPosPx) return `edge ${from} ${to} ${n} ${pts} "${label}" ${toIn(labelPosPx.x)} ${toGvYIn(labelPosPx.y)} solid black`;
    return `edge ${from} ${to} ${n} ${pts} solid black`;
  };

  const lines: string[] = [];
  {
    const from = nameById.get("cond")!;
    const to = nameById.get("then")!;
    lines.push(edgeLine(from, to, [boundary("cond", "bottom"), { x: 260, y: 260 }, { x: 220, y: 320 }, boundary("then", "top")], "是", { x: 240, y: 300 }));
  }
  {
    const from = nameById.get("cond")!;
    const to = nameById.get("else")!;
    lines.push(edgeLine(from, to, [boundary("cond", "bottom"), { x: 340, y: 260 }, { x: 380, y: 320 }, boundary("else", "top")], "否", { x: 360, y: 300 }));
  }
  {
    const from = nameById.get("then")!;
    const to = nameById.get("join")!;
    lines.push(edgeLine(from, to, [boundary("then", "bottom"), { x: 210, y: 420 }, { x: 270, y: 500 }, boundary("join", "left")]));
  }
  {
    const from = nameById.get("else")!;
    const to = nameById.get("join")!;
    lines.push(edgeLine(from, to, [boundary("else", "bottom"), { x: 390, y: 420 }, { x: 330, y: 500 }, boundary("join", "right")]));
  }

  const plain = [`graph 12 ${heightIn} 1.0`, ...nodeLines, ...lines, "stop"].join("\n");
  const out1 = applyPlainLayoutToCanvas(nodes as any, edges as any, plain, nameById, { snapToGrid: false });
  const out2 = applyPlainLayoutToCanvas(nodes as any, edges as any, plain, nameById, { snapToGrid: false });

  expect(out1.nodes).toEqual(out2.nodes);
  expect(out1.edges).toEqual(out2.edges);

  const nodeById = new Map(out1.nodes.map((n: any) => [n.id, n] as const));
  const cond = nodeById.get("cond")!;
  const thenN = nodeById.get("then")!;
  const elseN = nodeById.get("else")!;
  expect(thenN.x).toBeLessThan(cond.x);
  expect(elseN.x).toBeGreaterThan(cond.x);
  expect(thenN.x).toBeLessThan(elseN.x);

  const yes = out1.edges.find((e: any) => e.id === "e_yes") as any;
  const no = out1.edges.find((e: any) => e.id === "e_no") as any;
  expect(yes?.labelPosition).toEqual({ x: 240, y: 300 });
  expect(no?.labelPosition).toEqual({ x: 360, y: 300 });
  expect(yes?.fromPort).toBeUndefined();
  expect(yes?.toPort).toBeUndefined();
  expect(yes?.fromAttach).toEqual({ x: 0.5, y: 1 });
  expect(yes?.toAttach).toEqual({ x: 0.5, y: 0 });
});

test("while-loop beautify output is stable; anchors do not penetrate nodes; labelPosition exists", () => {
  const nodes: any[] = [
    { id: "start", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "init", shape: "process", title: "i = 10", x: 0, y: 0 },
    { id: "cond", shape: "decision", title: "i >= 1 ?", x: 0, y: 0 },
    { id: "body", shape: "process", title: "total += i", x: 0, y: 0 },
    { id: "dec", shape: "process", title: "i -= 1", x: 0, y: 0 },
    { id: "end", shape: "start_end", title: "结束", x: 0, y: 0 },
  ];
  const edges: any[] = [
    { id: "e1", from: "start", to: "init", style: "straight" },
    { id: "e2", from: "init", to: "cond", style: "straight" },
    { id: "e3", from: "cond", to: "body", style: "straight", label: "是" },
    { id: "e4", from: "body", to: "dec", style: "straight" },
    { id: "e5", from: "dec", to: "cond", style: "straight" },
    { id: "e6", from: "cond", to: "end", style: "straight", label: "否" },
  ];

  const { nameById } = buildDot(nodes as any, edges as any, DEFAULT_BEAUTIFY_PARAMS);
  const heightIn = 10;
  const pxPerIn = 72;
  const graphHPx = heightIn * pxPerIn;
  const toIn = (px: number) => Number((px / pxPerIn).toFixed(4));
  const toGvYIn = (yPx: number) => Number((heightIn - yPx / pxPerIn).toFixed(4));
  const pt = (xPx: number, yPx: number) => `${toIn(xPx)} ${toGvYIn(yPx)}`;

  const centersPx: Record<string, { x: number; y: number }> = {
    start: { x: 180, y: 120 },
    init: { x: 180, y: 240 },
    cond: { x: 180, y: 360 },
    body: { x: 180, y: 500 },
    dec: { x: 180, y: 620 },
    end: { x: 520, y: 360 },
  };

  const nodeLines: string[] = [];
  for (const n of nodes) {
    const gv = nameById.get(n.id)!;
    const c = centersPx[n.id];
    const s = nodeSizeForTitle(n.shape, n.title);
    nodeLines.push(`node ${gv} ${toIn(c.x)} ${toGvYIn(c.y)} ${toIn(s.w)} ${toIn(s.h)} "${n.title}" solid box black lightgrey`);
  }
  const nodeSizePxById = new Map<string, { w: number; h: number }>();
  for (const n of nodes) nodeSizePxById.set(n.id, nodeSizeForTitle(n.shape, n.title));

  const boundary = (nodeId: string, side: "top" | "right" | "bottom" | "left") => {
    const c = centersPx[nodeId];
    const s = nodeSizePxById.get(nodeId)!;
    if (side === "top") return { x: c.x, y: c.y - s.h / 2 };
    if (side === "bottom") return { x: c.x, y: c.y + s.h / 2 };
    if (side === "left") return { x: c.x - s.w / 2, y: c.y };
    return { x: c.x + s.w / 2, y: c.y };
  };

  const lines: string[] = [];
  const edgeLine = (from: string, to: string, pointsPx: { x: number; y: number }[], label?: string, labelPosPx?: { x: number; y: number }) => {
    const pts = pointsPx.map((p) => pt(p.x, p.y)).join(" ");
    const n = pointsPx.length;
    if (label && labelPosPx) return `edge ${from} ${to} ${n} ${pts} "${label}" ${toIn(labelPosPx.x)} ${toGvYIn(labelPosPx.y)} solid black`;
    return `edge ${from} ${to} ${n} ${pts} solid black`;
  };

  {
    const from = nameById.get("start")!;
    const to = nameById.get("init")!;
    const pFrom = boundary("start", "bottom");
    const pTo = boundary("init", "top");
    lines.push(edgeLine(from, to, [pFrom, { x: pFrom.x, y: (pFrom.y + pTo.y) / 2 }, pTo]));
  }
  {
    const from = nameById.get("init")!;
    const to = nameById.get("cond")!;
    const pFrom = boundary("init", "bottom");
    const pTo = boundary("cond", "top");
    lines.push(edgeLine(from, to, [pFrom, { x: pFrom.x, y: (pFrom.y + pTo.y) / 2 }, pTo]));
  }
  {
    const from = nameById.get("cond")!;
    const to = nameById.get("body")!;
    const pFrom = boundary("cond", "bottom");
    const pTo = boundary("body", "top");
    lines.push(edgeLine(from, to, [pFrom, { x: 210, y: 420 }, pTo], "是", { x: 230, y: 430 }));
  }
  {
    const from = nameById.get("body")!;
    const to = nameById.get("dec")!;
    const pFrom = boundary("body", "bottom");
    const pTo = boundary("dec", "top");
    lines.push(edgeLine(from, to, [pFrom, { x: pFrom.x, y: (pFrom.y + pTo.y) / 2 }, pTo]));
  }
  {
    const from = nameById.get("dec")!;
    const to = nameById.get("cond")!;
    const pFrom = boundary("dec", "left");
    const pTo = boundary("cond", "left");
    const leftX = 20;
    lines.push(edgeLine(from, to, [pFrom, { x: leftX, y: pFrom.y }, { x: leftX, y: pTo.y }, pTo]));
  }
  {
    const from = nameById.get("cond")!;
    const to = nameById.get("end")!;
    const pFrom = boundary("cond", "right");
    const pTo = boundary("end", "left");
    lines.push(edgeLine(from, to, [pFrom, { x: 360, y: 360 }, pTo], "否", { x: 360, y: 330 }));
  }

  const plain = [`graph 9 10 1.0`, ...nodeLines, ...lines, "stop"].join("\n");
  const out1 = applyPlainLayoutToCanvas(nodes as any, edges as any, plain, nameById);
  const out2 = applyPlainLayoutToCanvas(nodes as any, edges as any, plain, nameById);

  expect(out1.nodes).toEqual(out2.nodes);
  expect(out1.edges).toEqual(out2.edges);

  const rects = out1.nodes.map((n: any) => {
    const s = nodeSizeForTitle(n.shape, n.title);
    return { id: n.id as string, x: n.x as number, y: n.y as number, w: s.w, h: s.h };
  });
  const deepInside = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => {
    const eps = 2;
    return p.x > r.x + eps && p.x < r.x + r.w - eps && p.y > r.y + eps && p.y < r.y + r.h - eps;
  };
  for (const e of out1.edges as any[]) {
    if (e.toEdge) continue;
    expect(e.style).toBe("bezier");
    expect(e.routeMode).toBe("manual");
    expect(Array.isArray(e.anchors)).toBe(true);
    expect(e.anchors.length).toBeGreaterThanOrEqual(3);
    const anchors = e.anchors as { x: number; y: number }[];
    for (const p of anchors.slice(1, anchors.length - 1)) {
      for (const r of rects) {
        expect(deepInside(p, r)).toBe(false);
      }
    }
  }

  const loop = out1.edges.find((e: any) => e.id === "e5") as any;
  if (!loop) throw new Error("loop edge missing");
  const minX = Math.min(...rects.map((r) => r.x));
  expect((loop.anchors as { x: number; y: number }[]).some((p) => p.x < minX - 20)).toBe(true);

  const yes = out1.edges.find((e: any) => e.id === "e3");
  const no = out1.edges.find((e: any) => e.id === "e6");
  expect(yes?.labelPosition).toBeTruthy();
  expect(no?.labelPosition).toBeTruthy();
  expect(typeof yes?.labelPosition?.x).toBe("number");
  expect(typeof yes?.labelPosition?.y).toBe("number");
  expect(typeof no?.labelPosition?.x).toBe("number");
  expect(typeof no?.labelPosition?.y).toBe("number");
});
