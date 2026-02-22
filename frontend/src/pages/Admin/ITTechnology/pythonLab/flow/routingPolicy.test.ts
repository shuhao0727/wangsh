import { routeOrthogonalVisioLike } from "./geometry";
import { chooseByPriority, firstLegDir, routeWithPolicy, tryFanInMerge } from "./routingPolicy";

test("routeOrthogonalVisioLike prefers vertical-first when target is clearly below", () => {
  const poly = routeOrthogonalVisioLike({
    start: { x: 0, y: 0 },
    end: { x: 200, y: 300 },
    sourceDir: "bottom",
    targetDir: "top",
    obstacles: [],
    grid: 10,
    minSeg: 60,
    stub: 30,
  });
  expect(poly.length).toBeGreaterThanOrEqual(2);
  expect(Math.abs(poly[1].x - poly[0].x)).toBeLessThan(1e-6);
});

test("tryFanInMerge produces a shared trunk when feasible", () => {
  const merged = tryFanInMerge({
    start: { x: 0, y: 0 },
    end: { x: 50, y: 200 },
    startDir: "bottom",
    endDir: "top",
    obstacles: [],
    grid: 10,
    minSeg: 60,
    fanIn: {
      incomings: [
        { start: { x: 0, y: 0 }, stub: 20, obstacles: [] },
        { start: { x: 100, y: 0 }, stub: 20, obstacles: [] },
      ],
    },
  });
  expect(merged).not.toBeNull();
  expect(Array.isArray(merged)).toBe(true);
  const poly = merged as { x: number; y: number }[];
  expect(poly.length).toBeGreaterThanOrEqual(3);
  expect(poly[0]).toEqual({ x: 0, y: 0 });
  expect(poly[poly.length - 1]).toEqual({ x: 50, y: 200 });
  expect(poly[1].y).toBeGreaterThanOrEqual(20);
  expect(firstLegDir(poly)).toBe("v");
});

test("chooseByPriority keeps base if first-leg direction would change", () => {
  const base = [
    { x: 0, y: 0 },
    { x: 0, y: 40 },
    { x: 40, y: 40 },
  ];
  const fanIn = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
  ];
  expect(firstLegDir(base)).toBe("v");
  expect(firstLegDir(fanIn)).toBe("h");
  const chosen = chooseByPriority({ base, fanIn, end: { x: 40, y: 40 }, minSeg: 10 });
  expect(chosen).toBe(base);
});

test("routeWithPolicy returns a valid polyline", () => {
  const poly = routeWithPolicy({
    start: { x: 0, y: 0 },
    end: { x: 50, y: 200 },
    startDir: "bottom",
    endDir: "top",
    obstacles: [],
    grid: 10,
    minSeg: 60,
    stub: 30,
    fanIn: {
      incomings: [
        { start: { x: 0, y: 0 }, stub: 30, obstacles: [] },
        { start: { x: 100, y: 0 }, stub: 30, obstacles: [] },
      ],
    },
  });
  expect(poly.length).toBeGreaterThanOrEqual(2);
});
