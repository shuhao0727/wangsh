import { showMessage } from "@/lib/toast";

import type { PythonLabRunnerKind } from "../launchPlan";

type PythonLabLaunchBreakpoint = {
  line: number;
  enabled: boolean;
  condition?: string;
  hitCount?: number;
};

type DapRunnerLike = {
  state?: { status?: string | null } | null;
  runPlain?: (arg?: any) => Promise<void> | void;
  startDebug?: (arg?: any) => Promise<void> | void;
  stopDebug?: () => Promise<void> | void;
};

type PyodideRunnerLike = {
  runPlain?: (arg?: any) => Promise<void> | void;
  startDebug?: (arg?: any) => Promise<void> | void;
  reset?: () => void;
};

function isActiveDapStatus(status: unknown): boolean {
  return status === "starting" || status === "running" || status === "paused";
}

function reportLaunchFailure(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (message.includes("会话正在启动中")) {
    showMessage.info(message);
    return;
  }
  showMessage.error(message);
}

export function switchPythonlabRunner(params: {
  runnerKind: PythonLabRunnerKind;
  setActiveRunnerKind: (runnerKind: PythonLabRunnerKind) => void;
  dapRunner: DapRunnerLike;
  pyRunner: PyodideRunnerLike;
}): void {
  const { runnerKind, setActiveRunnerKind, dapRunner, pyRunner } = params;

  if (runnerKind === "dap") {
    setActiveRunnerKind("dap");
    pyRunner.reset?.();
    return;
  }

  setActiveRunnerKind("pyodide");
  if (isActiveDapStatus(dapRunner?.state?.status)) {
    Promise.resolve(dapRunner.stopDebug?.()).catch(() => {});
  }
}

export function launchPythonlabRunAction(params: {
  runnerKind: PythonLabRunnerKind;
  dapRunner: DapRunnerLike;
  pyRunner: PyodideRunnerLike;
  stdinLines?: string[];
}): void {
  const { runnerKind, dapRunner, pyRunner, stdinLines } = params;

  if (runnerKind === "dap") {
    const run = dapRunner.runPlain;
    if (typeof run !== "function") {
      showMessage.error("运行器未就绪，请刷新页面后重试");
      return;
    }
    Promise.resolve(run(stdinLines)).catch((error: unknown) => {
      reportLaunchFailure(error, "启动运行失败");
    });
    return;
  }

  const run = pyRunner.runPlain;
  if (typeof run !== "function") {
    showMessage.error("前端运行器未就绪，请刷新页面后重试");
    return;
  }
  Promise.resolve(run(stdinLines)).catch((error: unknown) => {
    reportLaunchFailure(error, "启动运行失败");
  });
}

export function launchPythonlabDebugAction(params: {
  runnerKind: PythonLabRunnerKind;
  dapRunner: DapRunnerLike;
  pyRunner: PyodideRunnerLike;
  breakpoints?: PythonLabLaunchBreakpoint[];
  onDapFailure?: () => void;
}): void {
  const { runnerKind, dapRunner, pyRunner, breakpoints, onDapFailure } = params;
  const launchArg = breakpoints ? { initialBreakpoints: breakpoints } : undefined;

  if (runnerKind === "dap") {
    const start = dapRunner.startDebug;
    if (typeof start !== "function") {
      showMessage.error("调试器未就绪，请刷新页面后重试");
      onDapFailure?.();
      return;
    }
    Promise.resolve(start(launchArg)).catch((error: unknown) => {
      showMessage.error(error instanceof Error ? error.message : "启动调试失败");
      onDapFailure?.();
    });
    return;
  }

  const start = pyRunner.startDebug;
  if (typeof start !== "function") {
    showMessage.error("前端调试器未就绪，请刷新页面后重试");
    return;
  }
  Promise.resolve(start(launchArg)).catch((error: unknown) => {
    showMessage.error(error instanceof Error ? error.message : "启动调试失败");
  });
}
