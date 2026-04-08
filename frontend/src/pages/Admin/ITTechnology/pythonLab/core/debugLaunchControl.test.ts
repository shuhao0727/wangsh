import {
  launchPythonlabDebugAction,
  launchPythonlabRunAction,
  switchPythonlabRunner,
} from "./debugLaunchControl";

test("launchPythonlabDebugAction forwards launch breakpoint snapshot to dap runner", () => {
  const breakpoints = [
    { line: 2, enabled: true },
    { line: 4, enabled: true, condition: "total > 0", hitCount: 2 },
  ];
  let receivedArg: unknown = null;

  launchPythonlabDebugAction({
    runnerKind: "dap",
    dapRunner: {
      startDebug: (arg?: unknown) => {
        receivedArg = arg;
      },
    },
    breakpoints,
  });

  expect(receivedArg).toEqual({ initialBreakpoints: breakpoints });
});

test("launchPythonlabRunAction forwards stdin lines to dap plain runner", () => {
  const stdinLines = ["1", "2"];
  let receivedArg: unknown = null;

  launchPythonlabRunAction({
    runnerKind: "dap",
    dapRunner: {
      runPlain: (arg?: unknown) => {
        receivedArg = arg;
      },
    },
    pyRunner: {},
    stdinLines,
  });

  expect(receivedArg).toEqual(stdinLines);
});

test("switchPythonlabRunner stops active dap session when switching back to pyodide", () => {
  const calls: string[] = [];

  switchPythonlabRunner({
    runnerKind: "pyodide",
    setActiveRunnerKind: (runnerKind) => {
      calls.push(`set:${runnerKind}`);
    },
    dapRunner: {
      state: { status: "paused" },
      stopDebug: () => {
        calls.push("stop");
      },
    },
    pyRunner: {},
  });

  expect(calls[0]).toBe("set:pyodide");
  expect(calls.includes("stop")).toBe(true);
});
