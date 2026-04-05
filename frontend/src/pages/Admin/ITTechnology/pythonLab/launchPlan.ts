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
        if (runtime === "dap") {
            return { mode: "debug", runnerKind: "dap", debugFallbackReason: null };
        }
        if (params.canFrontendDebug) {
            return { mode: "debug", runnerKind: "pyodide", debugFallbackReason: null };
        }
        return {
            mode: "debug",
            runnerKind: "dap",
            debugFallbackReason: "当前环境不支持前端断点调试，已切换为后端调试",
        };
    }
    if (runtime === "dap") {
        return { mode: "plain", runnerKind: "dap", debugFallbackReason: null };
    }
    return { mode: "plain", runnerKind: "pyodide", debugFallbackReason: null };
}
