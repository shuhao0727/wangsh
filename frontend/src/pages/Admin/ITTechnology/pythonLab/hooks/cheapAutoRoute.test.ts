import { cheapAutoRoute } from "./useEdgeGeometries";

test("cheapAutoRoute direct returns straight segment", () => {
  const poly = cheapAutoRoute({ start: { x: 10, y: 10 }, end: { x: 110, y: 70 }, routingStyle: "direct" });
  expect(poly.length).toBe(2);
  expect(poly[0].x).toBe(10);
  expect(poly[1].y).toBe(70);
});

test("cheapAutoRoute orthogonal returns axis-aligned segments", () => {
  const poly = cheapAutoRoute({ start: { x: 10, y: 10 }, end: { x: 110, y: 70 }, routingStyle: "orthogonal", startDir: "right", endDir: "left" });
  expect(poly.length).toBeGreaterThanOrEqual(2);
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    expect(Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6).toBe(true);
  }
});

