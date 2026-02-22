import { getNextActiveTabOnPipelineModeToggle } from "./rightPanelTabPolicy";

test("enabling pipeline switches to pipeline tab", () => {
  const next = getNextActiveTabOnPipelineModeToggle({ prevPipelineMode: false, nextPipelineMode: true, activeTab: "terminal" });
  expect(next).toBe("pipeline");
});

test("disabling pipeline while on pipeline switches back to terminal", () => {
  const next = getNextActiveTabOnPipelineModeToggle({ prevPipelineMode: true, nextPipelineMode: false, activeTab: "pipeline" });
  expect(next).toBe("terminal");
});

test("disabling pipeline while on debug keeps debug", () => {
  const next = getNextActiveTabOnPipelineModeToggle({ prevPipelineMode: true, nextPipelineMode: false, activeTab: "debug" });
  expect(next).toBe("debug");
});

