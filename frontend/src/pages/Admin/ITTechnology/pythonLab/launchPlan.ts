export type PythonLabRuntime = "pyodide" | "dap" | string;

export type PythonLabLaunchMode = "plain" | "debug";

export type PythonLabRunnerKind = "pyodide" | "dap";

export type PythonLabLaunchPlan = {
    mode: PythonLabLaunchMode;
    runnerKind: PythonLabRunnerKind;
    debugFallbackReason: string | null;
};

export function pythonCodeUsesInteractiveInput(sourceCode?: string): boolean {
    return /\binput\s*\(/.test(String(sourceCode || ""));
}

export function decidePythonLabLaunchPlan(params: {
    enabledBreakpointCount: number;
    pythonlabRuntime: PythonLabRuntime;
    sourceCode?: string;
    supportsPyodideStdin?: boolean;
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
    if (params.supportsPyodideStdin === false && pythonCodeUsesInteractiveInput(params.sourceCode)) {
        return {
            mode: "plain",
            runnerKind: "dap",
            debugFallbackReason: "当前访问环境不支持浏览器本地交互输入，已自动切换到后端运行。",
        };
    }
    return { mode: "plain", runnerKind: "pyodide", debugFallbackReason: null };
}
