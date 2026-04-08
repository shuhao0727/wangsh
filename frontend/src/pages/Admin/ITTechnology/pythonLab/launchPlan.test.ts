import { decidePythonLabLaunchPlan } from "./launchPlan";

test("断点分流：0 个启用断点走普通运行（runPlain）", () => {
    const plan = decidePythonLabLaunchPlan({ enabledBreakpointCount: 0, pythonlabRuntime: "pyodide" });
    expect(plan).toEqual({ mode: "plain", runnerKind: "pyodide", debugFallbackReason: null });
});

test("普通运行：检测到 input() 也仍走当前 plain-run 运行器", () => {
    const plan = decidePythonLabLaunchPlan({ enabledBreakpointCount: 0, pythonlabRuntime: "pyodide" });
    expect(plan.mode).toBe("plain");
    expect(plan.runnerKind).toBe("pyodide");
    expect(plan.debugFallbackReason).toBeNull();
});

test("普通运行：runtime= dap 时走后端运行（DAP）", () => {
    const plan = decidePythonLabLaunchPlan({ enabledBreakpointCount: 0, pythonlabRuntime: "dap" });
    expect(plan).toEqual({ mode: "plain", runnerKind: "dap", debugFallbackReason: null });
});

test("断点分流：>0 个启用断点走调试（startDebug）并使用 DAP", () => {
    const plan = decidePythonLabLaunchPlan({ enabledBreakpointCount: 1, pythonlabRuntime: "pyodide" });
    expect(plan).toEqual({ mode: "debug", runnerKind: "dap", debugFallbackReason: null });
});

test("断点分流：>0 个启用断点时仍走 dap，无回退原因", () => {
    const plan = decidePythonLabLaunchPlan({ enabledBreakpointCount: 2, pythonlabRuntime: "pyodide" });
    expect(plan.mode).toBe("debug");
    expect(plan.runnerKind).toBe("dap");
    expect(plan.debugFallbackReason).toBeNull();
});

test("断点分流：存在 input() 也必须优先进入调试分支（不应被普通运行策略影响）", () => {
    const plan = decidePythonLabLaunchPlan({ enabledBreakpointCount: 1, pythonlabRuntime: "pyodide" });
    expect(plan.mode).toBe("debug");
    expect(plan.runnerKind).toBe("dap");
});

test("断点分流：runtime= dap 时始终走后端调试（startDebug），不需要回退原因", () => {
    const plan = decidePythonLabLaunchPlan({ enabledBreakpointCount: 1, pythonlabRuntime: "dap" });
    expect(plan).toEqual({ mode: "debug", runnerKind: "dap", debugFallbackReason: null });
});
