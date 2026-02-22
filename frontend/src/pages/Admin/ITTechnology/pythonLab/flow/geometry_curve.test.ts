import { catmullRomToBezierPath, polylineToPath } from "./geometry";

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

