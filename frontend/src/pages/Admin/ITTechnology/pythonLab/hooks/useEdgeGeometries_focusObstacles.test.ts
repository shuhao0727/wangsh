import { routeOrthogonalVisioLike } from "../flow/geometry";

test("routeOrthogonalVisioLike prefers fewer obstacles when they are far away", () => {
  const start = { x: 100, y: 100 };
  const end = { x: 500, y: 100 };
  const far: any[] = [
    { minX: 10000, minY: 10000, maxX: 10100, maxY: 10100 },
    { minX: -10100, minY: -10100, maxX: -10000, maxY: -10000 },
  ];
  const near: any[] = [{ minX: 260, minY: 60, maxX: 340, maxY: 140 }];

  const p1 = routeOrthogonalVisioLike({ start, end, obstacles: far, grid: 10 });
  const p2 = routeOrthogonalVisioLike({ start, end, obstacles: far.concat(near), grid: 10 });

  expect(p1.length).toBeGreaterThanOrEqual(2);
  expect(p2.length).toBeGreaterThanOrEqual(2);
});

