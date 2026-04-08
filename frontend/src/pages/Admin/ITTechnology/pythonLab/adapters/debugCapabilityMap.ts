import type { DebugFrontendMode } from "./debugFrontendAdapter";

export type DebugCapabilityKey =
  | "breakpoint"
  | "continue"
  | "pause"
  | "stepOver"
  | "stepInto"
  | "stepOut"
  | "callStack"
  | "variables"
  | "watch"
  | "evaluate"
  | "terminalAttach"
  | "stepBack";

export type DebugCapabilityItem = {
  key: DebugCapabilityKey;
  supported: boolean;
  note: string;
};

export type DebugCapabilityMapV1 = {
  version: "v1";
  mode: DebugFrontendMode;
  items: DebugCapabilityItem[];
};

export type DapNegotiatedCapabilities = {
  supportsStepBack?: boolean;
  supportsEvaluateForHovers?: boolean;
  supportsCompletionsRequest?: boolean;
  supportsSetVariable?: boolean;
  supportsConfigurationDoneRequest?: boolean;
} | null;

export type NegotiatedCapabilityView = {
  key: keyof NonNullable<DapNegotiatedCapabilities>;
  label: string;
  supported: boolean;
  source: "dap_initialize";
};

export type DebugControlKey = "run" | "debug" | "pause" | "continue" | "stepOver" | "stepInto" | "stepOut" | "stepBack" | "reset";
export type DebugRunnerStatus = "idle" | "starting" | "running" | "paused" | "stopped" | "error";
export type DebugControlMatrix = Record<DebugControlKey, boolean>;
export type DebugControlDiffItem = { key: DebugControlKey; from: boolean; to: boolean };
export type DebugRunnerPolicy = "dap" | "pyodide";

const CAPABILITY_LABELS: Record<DebugCapabilityKey, string> = {
  breakpoint: "断点",
  continue: "继续",
  pause: "暂停",
  stepOver: "下一步",
  stepInto: "步入",
  stepOut: "步出",
  callStack: "调用栈",
  variables: "变量",
  watch: "监视",
  evaluate: "求值",
  terminalAttach: "终端附着",
  stepBack: "上一步",
};

const BASE_ITEMS: DebugCapabilityItem[] = [
  { key: "breakpoint", supported: true, note: "支持断点与条件断点下发" },
  { key: "continue", supported: true, note: "支持继续运行" },
  { key: "pause", supported: true, note: "支持暂停运行" },
  { key: "stepOver", supported: true, note: "支持下一步（Step Over）" },
  { key: "stepInto", supported: true, note: "支持步入（Step Into）" },
  { key: "stepOut", supported: true, note: "支持步出（Step Out）" },
  { key: "callStack", supported: true, note: "支持调用栈展示" },
  { key: "variables", supported: true, note: "支持变量面板展示" },
  { key: "watch", supported: true, note: "支持监视表达式" },
  { key: "evaluate", supported: true, note: "支持表达式求值" },
  { key: "terminalAttach", supported: true, note: "支持终端附着与输入" },
  { key: "stepBack", supported: false, note: "暂不支持上一步（逆向调试）" },
];

export function createDebugCapabilityMapV1(mode: DebugFrontendMode): DebugCapabilityMapV1 {
  const items = BASE_ITEMS.map((item) => ({ ...item }));
  return { version: "v1", mode, items };
}

export function applyDebugRunnerPolicy(baseMap: DebugCapabilityMapV1, runnerPolicy: DebugRunnerPolicy): DebugCapabilityMapV1 {
  if (runnerPolicy === "dap") return baseMap;
  const items = baseMap.items.map((item) => {
    if (item.key === "terminalAttach") {
      return { ...item, supported: true, note: "普通运行支持终端输出与输入" };
    }
    if (item.key === "breakpoint") {
      return { ...item, supported: true, note: "支持设置断点；点击调试时将切换到后端 DAP 会话" };
    }
    return { ...item, supported: false, note: "Pyodide 普通运行模式下不提供该调试能力" };
  });
  return { ...baseMap, items };
}

export function applyDapNegotiatedCapabilities(baseMap: DebugCapabilityMapV1, negotiated: DapNegotiatedCapabilities): DebugCapabilityMapV1 {
  if (!negotiated) return baseMap;
  const items = baseMap.items.map((item) => {
    if (item.key === "stepBack") {
      if (negotiated.supportsStepBack) {
        return { ...item, supported: true, note: "支持上一步（逆向调试）" };
      }
      return { ...item, supported: false, note: "适配器未声明支持上一步（逆向调试）" };
    }
    if (item.key === "evaluate" && negotiated.supportsEvaluateForHovers === false) {
      return { ...item, supported: true, note: "支持表达式求值（悬浮求值能力未声明）" };
    }
    if (item.key === "variables" && negotiated.supportsSetVariable === false) {
      return { ...item, supported: true, note: "支持变量查看（变量写入能力未声明）" };
    }
    return item;
  });
  return { ...baseMap, items };
}

export function listNegotiatedCapabilities(negotiated: DapNegotiatedCapabilities): NegotiatedCapabilityView[] {
  if (!negotiated) return [];
  return [
    { key: "supportsStepBack", label: "上一步", supported: !!negotiated.supportsStepBack, source: "dap_initialize" },
    { key: "supportsEvaluateForHovers", label: "悬浮求值", supported: !!negotiated.supportsEvaluateForHovers, source: "dap_initialize" },
    { key: "supportsCompletionsRequest", label: "补全请求", supported: !!negotiated.supportsCompletionsRequest, source: "dap_initialize" },
    { key: "supportsSetVariable", label: "变量写入", supported: !!negotiated.supportsSetVariable, source: "dap_initialize" },
    { key: "supportsConfigurationDoneRequest", label: "配置完成握手", supported: !!negotiated.supportsConfigurationDoneRequest, source: "dap_initialize" },
  ];
}

export function summarizeDebugCapabilities(map: DebugCapabilityMapV1): { supported: string[]; unsupported: string[] } {
  const supported: string[] = [];
  const unsupported: string[] = [];
  for (const item of map.items) {
    const label = CAPABILITY_LABELS[item.key] || item.key;
    if (item.supported) supported.push(label);
    else unsupported.push(label);
  }
  return { supported, unsupported };
}

export function getDebugCapabilityItem(map: DebugCapabilityMapV1 | undefined, key: DebugCapabilityKey): DebugCapabilityItem | null {
  if (!map) return null;
  return map.items.find((item) => item.key === key) ?? null;
}

export function isDebugCapabilitySupported(map: DebugCapabilityMapV1 | undefined, key: DebugCapabilityKey): boolean {
  const item = getDebugCapabilityItem(map, key);
  if (!item) return false;
  return !!item.supported;
}

export function getDebugCapabilityNote(map: DebugCapabilityMapV1 | undefined, key: DebugCapabilityKey): string | null {
  const item = getDebugCapabilityItem(map, key);
  if (!item) return null;
  return item.note;
}

export function getDebugCapabilityLabel(key: DebugCapabilityKey): string {
  return CAPABILITY_LABELS[key] || key;
}

export function resolveDebugControlMatrix(status: DebugRunnerStatus, map?: DebugCapabilityMapV1): DebugControlMatrix {
  const canRun = true; // Always allow run to support "restart"
  const canStep = status === "paused";
  const canPause = status === "running" && isDebugCapabilitySupported(map, "pause");
  const canContinue = status === "paused" && isDebugCapabilitySupported(map, "continue");
  return {
    run: canRun,
    debug: status !== "running" && status !== "starting", // Keep debug stricter for now, or relax if needed
    pause: canPause,
    continue: canContinue,
    stepOver: canStep && isDebugCapabilitySupported(map, "stepOver"),
    stepInto: canStep && isDebugCapabilitySupported(map, "stepInto"),
    stepOut: canStep && isDebugCapabilitySupported(map, "stepOut"),
    stepBack: canStep && isDebugCapabilitySupported(map, "stepBack"),
    reset: true,
  };
}

export function diffDebugControlMatrix(prev: DebugControlMatrix, next: DebugControlMatrix): DebugControlDiffItem[] {
  const keys: DebugControlKey[] = ["run", "debug", "pause", "continue", "stepOver", "stepInto", "stepOut", "stepBack", "reset"];
  const diffs: DebugControlDiffItem[] = [];
  for (const key of keys) {
    if (prev[key] !== next[key]) {
      diffs.push({ key, from: prev[key], to: next[key] });
    }
  }
  return diffs;
}
