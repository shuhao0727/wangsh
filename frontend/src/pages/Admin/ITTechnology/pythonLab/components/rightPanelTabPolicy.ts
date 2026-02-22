export type RightPanelTabKey = "terminal" | "debug" | "pipeline";

export function getNextActiveTabOnPipelineModeToggle(params: {
  prevPipelineMode: boolean;
  nextPipelineMode: boolean;
  activeTab: RightPanelTabKey;
}): RightPanelTabKey {
  const { prevPipelineMode, nextPipelineMode, activeTab } = params;
  if (!prevPipelineMode && nextPipelineMode) return "pipeline";
  if (prevPipelineMode && !nextPipelineMode && activeTab === "pipeline") return "terminal";
  return activeTab;
}

