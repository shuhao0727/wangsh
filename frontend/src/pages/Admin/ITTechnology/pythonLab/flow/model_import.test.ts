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

