import {
  applyDebugStatusTarget,
  applyDebugStatusTrigger,
  inferDebugStatusTrigger,
  nextDebugStatus,
  type DebugSessionStatus,
  type DebugStatusTransition,
} from "./debugStateMachine";

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

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
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

test("launch transitions idle to starting", () => {
  assertEqual(nextDebugStatus("idle", "launch"), "starting");
});

test("nextDebugStatus covers full trigger matrix", () => {
  const statuses: DebugSessionStatus[] = ["idle", "starting", "running", "paused", "stopped", "error"];
  const cases = {
    launch: {
      idle: "starting",
      starting: "starting",
      running: "running",
      paused: "paused",
      stopped: "starting",
      error: "starting",
    },
    restart: {
      idle: "idle",
      starting: "starting",
      running: "starting",
      paused: "starting",
      stopped: "stopped",
      error: "error",
    },
    executionStarted: {
      idle: "idle",
      starting: "running",
      running: "running",
      paused: "paused",
      stopped: "stopped",
      error: "error",
    },
    pauseHit: {
      idle: "idle",
      starting: "starting",
      running: "paused",
      paused: "paused",
      stopped: "stopped",
      error: "error",
    },
    resume: {
      idle: "idle",
      starting: "starting",
      running: "running",
      paused: "running",
      stopped: "stopped",
      error: "error",
    },
    stop: {
      idle: "stopped",
      starting: "stopped",
      running: "stopped",
      paused: "stopped",
      stopped: "stopped",
      error: "stopped",
    },
    fail: {
      idle: "error",
      starting: "error",
      running: "error",
      paused: "error",
      stopped: "error",
      error: "error",
    },
    reset: {
      idle: "idle",
      starting: "idle",
      running: "idle",
      paused: "idle",
      stopped: "idle",
      error: "idle",
    },
  } satisfies Record<DebugStatusTransition["trigger"], Record<DebugSessionStatus, DebugSessionStatus>>;

  for (const [trigger, mapping] of Object.entries(cases) as Array<[DebugStatusTransition["trigger"], Record<DebugSessionStatus, DebugSessionStatus>]>) {
    for (const status of statuses) {
      assertEqual(nextDebugStatus(status, trigger), mapping[status], `${trigger} should map ${status} -> ${mapping[status]}`);
    }
  }
});

test("restart transitions paused back to starting", () => {
  assertEqual(nextDebugStatus("paused", "restart"), "starting");
});

test("executionStarted only advances from starting to running", () => {
  assertEqual(nextDebugStatus("starting", "executionStarted"), "running");
  assertEqual(nextDebugStatus("paused", "executionStarted"), "paused");
});

test("pauseHit only advances from running to paused", () => {
  assertEqual(nextDebugStatus("running", "pauseHit"), "paused");
  assertEqual(nextDebugStatus("starting", "pauseHit"), "starting");
});

test("resume only advances from paused to running", () => {
  assertEqual(nextDebugStatus("paused", "resume"), "running");
  assertEqual(nextDebugStatus("running", "resume"), "running");
});

test("stop and reset are terminal helpers", () => {
  assertEqual(nextDebugStatus("running", "stop"), "stopped");
  assertEqual(nextDebugStatus("error", "reset"), "idle");
});

test("infer trigger maps direct target transitions", () => {
  assertEqual(inferDebugStatusTrigger("idle", "starting"), "launch");
  assertEqual(inferDebugStatusTrigger("running", "starting"), "restart");
  assertEqual(inferDebugStatusTrigger("starting", "running"), "executionStarted");
  assertEqual(inferDebugStatusTrigger("paused", "running"), "resume");
  assertEqual(inferDebugStatusTrigger("running", "paused"), "pauseHit");
  assertEqual(inferDebugStatusTrigger("running", "stopped"), "stop");
  assertEqual(inferDebugStatusTrigger("stopped", "error"), "fail");
  assertEqual(inferDebugStatusTrigger("error", "idle"), "reset");
});

test("infer trigger and target application stay consistent across all statuses", () => {
  const statuses: DebugSessionStatus[] = ["idle", "starting", "running", "paused", "stopped", "error"];
  for (const from of statuses) {
    for (const to of statuses) {
      const trigger = inferDebugStatusTrigger(from, to);
      const applied = applyDebugStatusTarget({
        status: from,
        transitions: [],
        target: to,
        timestamp: 555,
      });
      if (from === to) {
        assertEqual(trigger, null, `${from} -> ${to} should not infer a trigger`);
        assertEqual(applied.applied, false, `${from} -> ${to} should not apply`);
        continue;
      }
      assert(trigger !== null, `${from} -> ${to} should infer a trigger`);
      if (trigger === null) {
        throw new Error(`${from} -> ${to} unexpectedly inferred null trigger`);
      }
      assertEqual(applied.trigger, trigger, `${from} -> ${to} should report the inferred trigger`);
      assertEqual(applied.status, nextDebugStatus(from, trigger), `${from} -> ${to} should resolve through the inferred trigger`);
      assertEqual(applied.applied, applied.status !== from, `${from} -> ${to} should only apply when status changes`);
    }
  }
});

test("applyDebugStatusTrigger records bounded transition history", () => {
  const transitions: DebugStatusTransition[] = [];
  const first = applyDebugStatusTrigger({
    status: "idle",
    transitions,
    trigger: "launch",
    timestamp: 100,
    limit: 1,
  });
  assertEqual(first.status, "starting");
  assertDeepEqual(first.transitions, [
    { from: "idle", to: "starting", trigger: "launch", timestamp: 100 },
  ]);

  const second = applyDebugStatusTrigger({
    status: first.status,
    transitions: first.transitions,
    trigger: "executionStarted",
    timestamp: 200,
    limit: 1,
  });
  assertEqual(second.status, "running");
  assertDeepEqual(second.transitions, [
    { from: "starting", to: "running", trigger: "executionStarted", timestamp: 200 },
  ]);
});

test("applyDebugStatusTrigger returns not-applied for noop transitions", () => {
  const result = applyDebugStatusTrigger({
    status: "paused",
    transitions: [],
    trigger: "pauseHit",
    timestamp: 123,
  });
  assertEqual(result.applied, false);
  assertEqual(result.status, "paused");
  assertDeepEqual(result.transitions, []);
});

test("applyDebugStatusTarget returns metadata and ignores self-targets", () => {
  const base: DebugStatusTransition[] = [];
  const changed = applyDebugStatusTarget({
    status: "running",
    transitions: base,
    target: "paused",
    timestamp: 300,
  });
  assertEqual(changed.applied, true);
  assertEqual(changed.trigger, "pauseHit");
  assertEqual(changed.status, "paused");

  const unchanged = applyDebugStatusTarget({
    status: "paused",
    transitions: changed.transitions,
    target: "paused",
    timestamp: 400,
  });
  assertEqual(unchanged.applied, false);
  assertEqual(unchanged.trigger, null);
  assertEqual(unchanged.status, "paused");
});

test("applyDebugStatusTarget records restart and reset correctly", () => {
  const restart = applyDebugStatusTarget({
    status: "running",
    transitions: [],
    target: "starting",
    timestamp: 600,
  });
  assertEqual(restart.applied, true);
  assertEqual(restart.trigger, "restart");
  assertDeepEqual(restart.transitions, [
    { from: "running", to: "starting", trigger: "restart", timestamp: 600 },
  ]);

  const reset = applyDebugStatusTarget({
    status: "error",
    transitions: restart.transitions,
    target: "idle",
    timestamp: 700,
  });
  assertEqual(reset.applied, true);
  assertEqual(reset.trigger, "reset");
  assertDeepEqual(reset.transitions[1], {
    from: "error",
    to: "idle",
    trigger: "reset",
    timestamp: 700,
  });
});

test("full lifecycle path stays consistent", () => {
  const targets: DebugSessionStatus[] = ["starting", "running", "paused", "running", "stopped", "idle"];
  let status: DebugSessionStatus = "idle";
  let transitions: DebugStatusTransition[] = [];
  let timestamp = 500;

  for (const target of targets) {
    const next = applyDebugStatusTarget({
      status,
      transitions,
      target,
      timestamp,
    });
    status = next.status;
    transitions = next.transitions;
    timestamp += 100;
  }

  assertEqual(status, "idle");
  assertDeepEqual(
    transitions.map((entry) => entry.trigger),
    ["launch", "executionStarted", "pauseHit", "resume", "stop", "reset"]
  );
});
