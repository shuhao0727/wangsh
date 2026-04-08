export type PythonLabRuntime = "pyodide" | "dap" | string;

export type PythonLabLaunchMode = "plain" | "debug";

export type PythonLabRunnerKind = "pyodide" | "dap";

export type PythonLabLaunchPlan = {
    mode: PythonLabLaunchMode;
    runnerKind: PythonLabRunnerKind;
    debugFallbackReason: string | null;
};

export function decidePythonLabLaunchPlan(params: {
    enabledBreakpointCount: number;
    pythonlabRuntime: PythonLabRuntime;
    canFrontendDebug: boolean;
    needsStdin?: boolean;
}): PythonLabLaunchPlan {
    const enabled = Number(params.enabledBreakpointCount || 0);
    const runtime = String(params.pythonlabRuntime || "").toLowerCase();

    if (enabled > 0) {
        // Breakpoint debugging is always handled by the remote DAP runner.
        return { mode: "debug", runnerKind: "dap", debugFallbackReason: null };
    }
    if (runtime === "dap") {
        return { mode: "plain", runnerKind: "dap", debugFallbackReason: null };
    }
    return { mode: "plain", runnerKind: "pyodide", debugFallbackReason: null };
}
