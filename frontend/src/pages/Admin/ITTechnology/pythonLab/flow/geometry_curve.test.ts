import { bezierPointsToPath, catmullRomToBezierPath, edgePointsToSmoothPath, polylineToPath } from "./geometry";

test("catmullRomToBezierPath falls back for short polylines", () => {
  expect(catmullRomToBezierPath([])).toBe("");
  expect(catmullRomToBezierPath([{ x: 1, y: 2 }])).toBe("");
  const p2 = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ];
  expect(catmullRomToBezierPath(p2)).toBe(polylineToPath(p2));
});

test("catmullRomToBezierPath produces cubic bezier segments", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 0 },
    { x: 30, y: 10 },
  ];
  const d = catmullRomToBezierPath(pts);
  expect(d.startsWith("M ")).toBe(true);
  expect(d.includes(" C ")).toBe(true);
});

test("edgePointsToSmoothPath falls back for short polylines", () => {
  const p2 = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ];
  expect(edgePointsToSmoothPath([])).toBe("");
  expect(edgePointsToSmoothPath(p2)).toBe(polylineToPath(p2));
});

test("edgePointsToSmoothPath prefers 3n+1 direct bezier translation", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ];
  expect(edgePointsToSmoothPath(pts)).toBe(bezierPointsToPath(pts));
});

test("edgePointsToSmoothPath uses Catmull-Rom for non-3n+1 point lists", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 0 },
    { x: 30, y: 10 },
    { x: 40, y: 0 },
  ];
  const d = edgePointsToSmoothPath(pts);
  expect(d.includes(" C ")).toBe(true);
  expect(d.includes(" L ")).toBe(false);
});

test("edgePointsToSmoothPath keeps C for non-(3n+1) lists in bezier input mode", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 0 },
    { x: 30, y: 10 },
    { x: 40, y: 0 },
  ];
  const d = edgePointsToSmoothPath(pts, { input: "bezier" });
  expect(d.includes(" C ")).toBe(true);
  expect(d.includes(" L ")).toBe(false);
});

test("edgePointsToSmoothPath drops near-duplicate endpoints to recover direct bezier translation", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 0.1, y: 0.1 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ];
  const d = edgePointsToSmoothPath(pts, { input: "bezier" });
  expect(d).toBe(bezierPointsToPath(pts.slice(1)));
  expect(d.includes(" C ")).toBe(true);
});
