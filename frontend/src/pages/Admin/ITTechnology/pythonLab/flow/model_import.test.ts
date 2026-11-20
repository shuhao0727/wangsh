import { normalizeFlowImport } from "./model";

test("normalizeFlowImport keeps free endpoints, attach points, anchors and label position", () => {
  const input: any = {
    nodes: [
      { id: "a", shape: "process", title: "A", x: 10, y: 20 },
      { id: "b", shape: "process", title: "B", x: 110, y: 120 },
    ],
    edges: [
      {
        id: "e1",
        from: "a",
        to: "b",
        style: "bezier",
        routeMode: "manual",
        routeShape: "bezier",
        fromFree: { x: 12, y: 34 },
        toFree: { x: 98, y: 76 },
        fromAttach: { x: 0.1, y: 0.2 },
        toAttach: { x: -6, y: 7 },
        anchors: [
          { x: 20, y: 20 },
          { x: 40, y: 40 },
          { x: 60, y: 60 },
          { x: 80, y: 80 },
        ],
        label: "是",
        labelPosition: { x: 55, y: 66 },
      },
    ],
  };

  const out = normalizeFlowImport(input);
  expect(out).not.toBeNull();
  if (!out) return;
  expect(out.nodes.length).toBe(2);
  expect(out.edges.length).toBe(1);
  const e = out.edges[0];
  expect(e.fromFree).toEqual({ x: 12, y: 34 });
  expect(e.toFree).toEqual({ x: 98, y: 76 });
  expect(e.fromAttach).toEqual({ x: 0.1, y: 0.2 });
  expect(e.toAttach).toEqual({ x: -6, y: 7 });
  expect(e.anchors?.length).toBe(4);
  expect(e.anchors?.[3]).toEqual({ x: 80, y: 80 });
  expect(e.label).toBe("是");
  expect(e.labelPosition).toEqual({ x: 55, y: 66 });
});

test("normalizeFlowImport drops invalid points but keeps edge", () => {
  const input: any = {
    nodes: [{ id: "a", shape: "process", title: "A", x: 0, y: 0 }],
    edges: [
      {
        id: "e1",
        from: "a",
        to: "a",
        fromFree: { x: "bad", y: 1 },
        toFree: { x: 2, y: NaN },
        anchor: { x: 3, y: Infinity },
        labelPosition: { x: 4, y: 5 },
      },
    ],
  };
  const out = normalizeFlowImport(input);
  expect(out).not.toBeNull();
  if (!out) return;
  const e = out.edges[0];
  expect(e.fromFree).toBeUndefined();
  expect(e.toFree).toBeUndefined();
  expect(e.anchor).toBeUndefined();
  expect(e.labelPosition).toEqual({ x: 4, y: 5 });
});

test.each([
  ["限长标题", `text = '${"x".repeat(504)}…`],
  ["超时占位", "解析超时，已回退到稳定展示"],
])("旧版%s导入后禁用整图回写", (_label: string, title: string) => {
  const restored = normalizeFlowImport({
    format: "pythonlab-flow-v1",
    nodes: [
      { id: "__cfg_start__", shape: "start_end", title: "开始", x: 0, y: 0 },
      { id: "legacy-display", shape: "process", title, x: 0, y: 80 },
    ],
    edges: [{ id: "edge", from: "__cfg_start__", to: "legacy-display" }],
  });
  expect(restored?.nodes.map(node => node.title)).toEqual(["开始", title]);
  expect(restored?.nodes.map(node => node.writebackBlocked)).toEqual([true, true]);
});

test("旧图的普通说明和 Python 省略号仍可回写", () => {
  const restored = normalizeFlowImport({
    nodes: [
      { id: "code", shape: "process", title: "items = ...", x: 0, y: 0 },
      { id: "note", shape: "note", title: "请思考…", x: 120, y: 0 },
    ],
    edges: [],
  });
  expect(restored?.nodes.map(node => node.writebackBlocked)).toEqual([undefined, undefined]);
});

test("normalizeFlowImport migrates legacy collection shape to list_op/dict_op", () => {
  const input: any = {
    nodes: [
      { id: "a", shape: "collection", title: "nums = [1,2,3]", x: 0, y: 0 },
      { id: "b", shape: "collection", title: "counter = {}", x: 120, y: 0 },
    ],
    edges: [],
  };
  const out = normalizeFlowImport(input);
  expect(out).not.toBeNull();
  if (!out) return;
  expect(out.nodes.find((n) => n.id === "a")?.shape).toBe("list_op");
  expect(out.nodes.find((n) => n.id === "b")?.shape).toBe("dict_op");
});
