export function breakpointIsVisible(lineNumber) {
  const row = Array.from(document.querySelectorAll(".monaco-editor .margin-view-overlays > div"))
    .find((node) => node.querySelector(".line-numbers")?.textContent?.trim() === String(lineNumber));
  if (!row) return false;
  const bounds = row.getBoundingClientRect();
  return Array.from(document.querySelectorAll(".monaco-editor .wsMonacoBp")).some((marker) => {
    const box = marker.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    return box.width > 0 && box.height > 0 && middle >= bounds.top && middle < bounds.bottom;
  });
}

export function readDebugCompletionSnapshot(expectedOutput) {
  const button = (icon) => Array.from(document.querySelectorAll("button"))
    .find((node) => node.querySelector(`svg.${icon}`));
  const continueButton = button("lucide-fast-forward");
  const status = Array.from(document.querySelectorAll('[role="status"]'))
    .find((node) => /·\s*调试\s*·\s*DAP/.test(node.textContent || ""));
  const snapshot = {
    status: (status?.textContent || "").trim(),
    continueDisabled: continueButton?.disabled === true,
    hasSpinner: Boolean(document.querySelector("svg.lucide-loader-circle")),
    outputRows: Array.from(document.querySelectorAll(".xterm-rows > div"))
      .map((node) => (node.textContent || "").replace(/ /g, " ").trim()).filter(Boolean),
  };
  if (expectedOutput === undefined) return snapshot;
  return snapshot.status.startsWith("已停止") && snapshot.continueDisabled && !snapshot.hasSpinner &&
    snapshot.outputRows.includes(String(expectedOutput)) ? snapshot : false;
}

export function isDebugCompletion(snapshot, expectedOutput) {
  return snapshot.status.startsWith("已停止") && snapshot.continueDisabled === true &&
    !snapshot.hasSpinner && snapshot.outputRows.includes(String(expectedOutput));
}

export function smokeResultSummary(result) {
  return {
    id: result.id,
    status: result.status,
    stage: result.stage || (result.status === "FAIL" ? "unknown" : "complete"),
    error: result.status === "FAIL" ? "scenario_failed" : null,
  };
}
