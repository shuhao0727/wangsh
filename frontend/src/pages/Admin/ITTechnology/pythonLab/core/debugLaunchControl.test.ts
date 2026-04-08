import {
  launchPythonlabDebugAction,
  launchPythonlabRunAction,
  switchPythonlabRunner,
} from "./debugLaunchControl";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message?: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(message || `Expected ${expectedJson}, got ${actualJson}`);
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (error) {
    console.error(`not ok ${name}`);
    throw error;
  }
}

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
    pyRunner: {},
    breakpoints,
  });

  assertDeepEqual(receivedArg, { initialBreakpoints: breakpoints });
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

  assertDeepEqual(receivedArg, stdinLines);
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

  assertEqual(calls[0], "set:pyodide");
  assert(calls.includes("stop"), "expected active dap runner to be stopped");
});
