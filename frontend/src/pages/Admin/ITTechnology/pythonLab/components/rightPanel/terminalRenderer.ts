export function shouldUseBackendTerminal(params: {
  activeRunnerKind: "pyodide" | "dap";
  sessionId?: string | null;
}): boolean {
  return params.activeRunnerKind === "dap" || Boolean(params.sessionId);
}

export function shouldConnectBackendTerminal(params: {
  sessionId?: string | null;
  runnerStatus?: string | null;
}): boolean {
  return Boolean(params.sessionId) && params.runnerStatus !== "starting";
}
