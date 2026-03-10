import { resolveFlowActivation, toDebugPauseEvent } from "./debugEventBridge";

test("toDebugPauseEvent returns null when no active anchor exists", () => {
  const event = toDebugPauseEvent({
    source: "legacy",
    runner: { status: "paused", activeLine: null, activeFlowLine: null, activeNodeId: null, activeFocusRole: null },
  });
  expect(event).toBeNull();
});

test("toDebugPauseEvent builds normalized event", () => {
  const event = toDebugPauseEvent({
    source: "mature_web_embed",
    runner: { status: "paused", activeLine: 6, activeFlowLine: 5, activeNodeId: "n5", activeFocusRole: "while_check" },
  });
  expect(event).toMatchObject({
    source: "mature_web_embed",
    status: "paused",
    activeLine: 6,
    activeFlowLine: 5,
    activeNodeId: "n5",
    activeFocusRole: "while_check",
  });
});

test("resolveFlowActivation prefers event payload and computes enabled by status", () => {
  const activation = resolveFlowActivation({
    event: {
      source: "legacy",
      status: "running",
      activeLine: 6,
      activeFlowLine: 5,
      activeNodeId: "n5",
      activeFocusRole: "while_check",
      happenedAt: Date.now(),
    },
    runner: { status: "stopped", activeLine: 6, activeNodeId: "n6", activeFocusRole: null },
  });
  expect(activation).toEqual({
    activeLine: 5,
    activeNodeId: "n5",
    activeFocusRole: "while_check",
    activeEnabled: true,
  });
});
