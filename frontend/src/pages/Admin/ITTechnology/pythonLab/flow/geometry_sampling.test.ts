import { sampleBezierToPolyline, smoothPointsToPolyline } from "./geometry";

function isFinitePoint(p: { x: number; y: number }) {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

test("sampleBezierToPolyline samples cubic segments and preserves endpoints", () => {
  const bez = [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 0 },
  ];
  const poly = sampleBezierToPolyline(bez, 10);
  expect(poly.length).toBe(11);
  expect(poly[0]).toEqual({ x: 0, y: 0 });
  expect(poly[poly.length - 1]).toEqual({ x: 100, y: 0 });
  expect(poly.every(isFinitePoint)).toBe(true);
});

test("smoothPointsToPolyline samples bezier input to a longer polyline", () => {
  const bez = [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 0 },
  ];
  const poly = smoothPointsToPolyline(bez, { input: "bezier", stepsPerSegment: 12 });
  expect(poly.length).toBeGreaterThan(4);
  expect(poly[0]).toEqual({ x: 0, y: 0 });
  expect(poly[poly.length - 1]).toEqual({ x: 100, y: 0 });
  expect(poly.every(isFinitePoint)).toBe(true);
});

test("smoothPointsToPolyline samples polyline input via Catmull-Rom", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 50, y: 100 },
    { x: 100, y: 0 },
  ];
  const poly = smoothPointsToPolyline(pts, { input: "polyline", stepsPerSegment: 10 });
  expect(poly.length).toBeGreaterThan(pts.length);
  expect(poly[0]).toEqual({ x: 0, y: 0 });
  expect(poly[poly.length - 1]).toEqual({ x: 100, y: 0 });
  expect(poly.every(isFinitePoint)).toBe(true);
});
