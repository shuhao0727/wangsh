import { normalizeDebugSessionView } from "./debugSessionBridge";

test("normalizeDebugSessionView sanitizes arrays and frame index", () => {
  const normalized = normalizeDebugSessionView({
    frames: [{ id: 1 }, { id: 2 }],
    selectedFrameIndex: 99,
    variables: [{ name: "i", value: "1", type: "int" }],
    watchResults: null,
    watchExprs: ["x", 1, "y"],
    callStack: ["main", 3],
  });
  expect(normalized.frames).toEqual([{ id: 1 }, { id: 2 }]);
  expect(normalized.selectedFrameIndex).toBe(1);
  expect(normalized.variables.length).toBe(1);
  expect(normalized.watchResults).toEqual([]);
  expect(normalized.watchExprs).toEqual(["x", "y"]);
  expect(normalized.callStack).toEqual(["main"]);
});

test("normalizeDebugSessionView falls back for invalid input", () => {
  const normalized = normalizeDebugSessionView({
    frames: undefined,
    selectedFrameIndex: -2,
    variables: "bad",
    watchExprs: undefined,
    callStack: undefined,
    frame: 123,
  });
  expect(normalized.frames).toEqual([]);
  expect(normalized.selectedFrameIndex).toBe(0);
  expect(normalized.variables).toEqual([]);
  expect(normalized.watchExprs).toEqual([]);
  expect(normalized.callStack).toEqual([]);
  expect(normalized.frame).toBe("");
});
