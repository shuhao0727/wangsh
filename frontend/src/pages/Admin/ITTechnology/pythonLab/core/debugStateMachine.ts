export type DebugSessionStatus = "idle" | "starting" | "running" | "paused" | "stopped" | "error";

export type DebugStatusTrigger =
  | "launch"
  | "restart"
  | "executionStarted"
  | "pauseHit"
  | "resume"
  | "stop"
  | "fail"
  | "reset";

export interface DebugStatusTransition {
  from: DebugSessionStatus;
  to: DebugSessionStatus;
  trigger: DebugStatusTrigger;
  timestamp: number;
}

const TRANSITIONS: Record<DebugStatusTrigger, Partial<Record<DebugSessionStatus, DebugSessionStatus>>> = {
  launch: {
    idle: "starting",
    stopped: "starting",
    error: "starting",
  },
  restart: {
    starting: "starting",
    running: "starting",
    paused: "starting",
  },
  executionStarted: {
    starting: "running",
  },
  pauseHit: {
    running: "paused",
  },
  resume: {
    paused: "running",
  },
  stop: {
    idle: "stopped",
    starting: "stopped",
    running: "stopped",
    paused: "stopped",
    error: "stopped",
  },
  fail: {
    idle: "error",
    starting: "error",
    running: "error",
    paused: "error",
    stopped: "error",
  },
  reset: {
    idle: "idle",
    starting: "idle",
    running: "idle",
    paused: "idle",
    stopped: "idle",
    error: "idle",
  },
};

const DEFAULT_LOG_LIMIT = 50;

export function nextDebugStatus(status: DebugSessionStatus, trigger: DebugStatusTrigger): DebugSessionStatus {
  return TRANSITIONS[trigger][status] ?? status;
}

export function inferDebugStatusTrigger(
  from: DebugSessionStatus,
  to: DebugSessionStatus
): DebugStatusTrigger | null {
  if (from === to) return null;
  if (to === "starting") {
    return from === "idle" || from === "stopped" || from === "error" ? "launch" : "restart";
  }
  if (to === "running") {
    return from === "paused" ? "resume" : "executionStarted";
  }
  if (to === "paused") return "pauseHit";
  if (to === "stopped") return "stop";
  if (to === "error") return "fail";
  if (to === "idle") return "reset";
  return null;
}

export function applyDebugStatusTrigger(params: {
  status: DebugSessionStatus;
  transitions: DebugStatusTransition[];
  trigger: DebugStatusTrigger;
  timestamp?: number;
  limit?: number;
}): {
  status: DebugSessionStatus;
  transitions: DebugStatusTransition[];
  applied: boolean;
} {
  const { status, transitions, trigger, timestamp = Date.now(), limit = DEFAULT_LOG_LIMIT } = params;
  const next = nextDebugStatus(status, trigger);
  if (next === status) {
    return { status, transitions, applied: false };
  }
  const entry: DebugStatusTransition = { from: status, to: next, trigger, timestamp };
  return {
    status: next,
    transitions: [...transitions, entry].slice(-limit),
    applied: true,
  };
}

export function applyDebugStatusTarget(params: {
  status: DebugSessionStatus;
  transitions: DebugStatusTransition[];
  target: DebugSessionStatus;
  timestamp?: number;
  limit?: number;
}): {
  status: DebugSessionStatus;
  transitions: DebugStatusTransition[];
  applied: boolean;
  trigger: DebugStatusTrigger | null;
} {
  const { status, transitions, target, timestamp, limit } = params;
  const trigger = inferDebugStatusTrigger(status, target);
  if (!trigger) {
    return {
      status,
      transitions,
      applied: false,
      trigger: null,
    };
  }
  const next = applyDebugStatusTrigger({
    status,
    transitions,
    trigger,
    timestamp,
    limit,
  });
  return {
    ...next,
    trigger,
  };
}
