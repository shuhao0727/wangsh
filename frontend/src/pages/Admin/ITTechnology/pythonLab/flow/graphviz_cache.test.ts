import { __resetGraphvizForTest, __setGraphvizForTest, renderGraphviz } from "./graphviz";

test("renderGraphviz caches per (format, engine, dot)", async () => {
  const mockLayout = jest.fn((dot: string, format: string, engine: string) => `${format}:${engine}:${dot.length}`);
  __resetGraphvizForTest();
  __setGraphvizForTest({ layout: mockLayout });
  const dot = "digraph G { a -> b }";
  const a1 = await renderGraphviz(dot, "dot", ["svg"]);
  const a2 = await renderGraphviz(dot, "dot", ["svg"]);
  expect(a1.svg).toBeTruthy();
  expect(a2.svg).toBeTruthy();
  const svgCalls = mockLayout.mock.calls.filter((c: any[]) => c[1] === "svg");
  expect(svgCalls.length).toBe(1);

  const b1 = await renderGraphviz(dot, "dot", ["plain"]);
  const b2 = await renderGraphviz(dot, "dot", ["plain"]);
  expect(b1.plain).toBeTruthy();
  expect(b2.plain).toBeTruthy();
  const plainCalls = mockLayout.mock.calls.filter((c: any[]) => c[1] === "plain");
  expect(plainCalls.length).toBe(1);
});
