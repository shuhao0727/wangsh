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

    if (enabled > 0) {
        return { mode: "debug", runnerKind: "dap", debugFallbackReason: null };
    }
    if (String(params.pythonlabRuntime || "").toLowerCase() === "pyodide") {
        return { mode: "plain", runnerKind: "pyodide", debugFallbackReason: null };
    }
    return { mode: "plain", runnerKind: "dap", debugFallbackReason: null };
}
