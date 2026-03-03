import { shortenEndForArrow } from "./useEdgeGeometries";

test("shortenEndForArrow retreats end point along last segment", () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
  ];
  const out = shortenEndForArrow(poly, 10);
  expect(out.length).toBe(2);
  expect(out[0]).toEqual({ x: 0, y: 0 });
  expect(out[1].x).toBe(0);
  expect(out[1].y).toBe(90);
});

test("shortenEndForArrow preserves bezier end tangent by moving cp2 and end together", () => {
  const bezier = [
    { x: 0, y: 0 },
    { x: 0, y: 50 },
    { x: 50, y: 100 },
    { x: 100, y: 100 },
  ];
  const out = shortenEndForArrow(bezier, 10, { preserveBezierTangent: true });
  expect(out.length).toBe(4);

  const cp2Before = bezier[2];
  const endBefore = bezier[3];
  const cp2After = out[2];
  const endAfter = out[3];

  const dx0 = endBefore.x - cp2Before.x;
  const dy0 = endBefore.y - cp2Before.y;
  const dx1 = endAfter.x - cp2After.x;
  const dy1 = endAfter.y - cp2After.y;
  const cross = dx0 * dy1 - dy0 * dx1;
  expect(Math.abs(cross)).toBeLessThan(1e-6);

  const dcp2 = { x: cp2After.x - cp2Before.x, y: cp2After.y - cp2Before.y };
  const dend = { x: endAfter.x - endBefore.x, y: endAfter.y - endBefore.y };
  expect(dcp2.x).toBeCloseTo(dend.x, 6);
  expect(dcp2.y).toBeCloseTo(dend.y, 6);
});

