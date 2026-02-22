import type { FlowBeautifyParams, FlowBeautifyThresholds } from "../flow/beautify";
import type { FlowTidyRuleId } from "../flow/tidy";
import { DEFAULT_BEAUTIFY_PARAMS, DEFAULT_BEAUTIFY_THRESHOLDS } from "../flow/beautify";

export type PythonLabRuleSetV1 = {
  version: 1;
  tidy: { enabled: Record<FlowTidyRuleId, boolean> };
  beautify: { params: FlowBeautifyParams; thresholds: FlowBeautifyThresholds };
};

export type PythonLabRuleSetBundleV1 = {
  version: 1;
  global: PythonLabRuleSetV1;
  overrides?: Record<string, PythonLabRuleSetV1>;
};

export const DEFAULT_RULESET_V1: PythonLabRuleSetV1 = {
  version: 1,
  tidy: {
    enabled: {
      R_TIDY_START_END: true,
      R_TIDY_CONNECT_DEG0: true,
      R_TIDY_JOIN_MERGE: true,
      R_TIDY_COLLAPSE_CONNECTOR: true,
      R_TIDY_MERGE_LINEAR_PROCESS: true,
      R_TIDY_MARK_CRITICAL: true,
    },
  },
  beautify: { params: DEFAULT_BEAUTIFY_PARAMS, thresholds: DEFAULT_BEAUTIFY_THRESHOLDS },
};

export const pythonLabRuleSetKey = "python_lab_ruleset_v1";
export const pythonLabRuleSetBundleKey = "python_lab_ruleset_bundle_v1";

export const RULESET_PRESETS_V1: Array<{ key: string; label: string; ruleSet: PythonLabRuleSetV1 }> = [
  { key: "classroom", label: "课堂演示（默认）", ruleSet: DEFAULT_RULESET_V1 },
  {
    key: "strict",
    label: "严格阈值",
    ruleSet: normalizeRuleSetV1({
      ...DEFAULT_RULESET_V1,
      beautify: {
        ...DEFAULT_RULESET_V1.beautify,
        thresholds: { ...DEFAULT_RULESET_V1.beautify.thresholds, maxNodes: 20, maxCrossings: 2, maxFlowAngle: 12 },
      },
    }),
  },
  {
    key: "relaxed",
    label: "宽松阈值",
    ruleSet: normalizeRuleSetV1({
      ...DEFAULT_RULESET_V1,
      beautify: {
        ...DEFAULT_RULESET_V1.beautify,
        thresholds: { ...DEFAULT_RULESET_V1.beautify.thresholds, maxNodes: 40, maxCrossings: 6, maxFlowAngle: 25 },
      },
    }),
  },
];

function isObj(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function normalizeRuleSetV1(raw: any): PythonLabRuleSetV1 {
  const base = DEFAULT_RULESET_V1;
  if (!isObj(raw) || raw.version !== 1) return base;
  const tidyRaw = isObj(raw.tidy) ? raw.tidy : {};
  const enabledRaw = isObj(tidyRaw.enabled) ? tidyRaw.enabled : {};
  const enabled: any = { ...base.tidy.enabled };
  (Object.keys(base.tidy.enabled) as FlowTidyRuleId[]).forEach((k) => {
    if (typeof enabledRaw[k] === "boolean") enabled[k] = enabledRaw[k];
  });

  const beautifyRaw = isObj(raw.beautify) ? raw.beautify : {};
  const paramsRaw = isObj(beautifyRaw.params) ? beautifyRaw.params : {};
  const thresholdsRaw = isObj(beautifyRaw.thresholds) ? beautifyRaw.thresholds : {};
  const params: any = { ...DEFAULT_BEAUTIFY_PARAMS, ...paramsRaw };
  const thresholds: any = { ...DEFAULT_BEAUTIFY_THRESHOLDS, ...thresholdsRaw };

  return { version: 1, tidy: { enabled }, beautify: { params, thresholds } };
}

export function normalizeRuleSetBundleV1(raw: any): PythonLabRuleSetBundleV1 {
  const base: PythonLabRuleSetBundleV1 = { version: 1, global: DEFAULT_RULESET_V1, overrides: {} };
  if (!isObj(raw) || raw.version !== 1) return base;
  const global = normalizeRuleSetV1(raw.global);
  const overridesRaw = isObj(raw.overrides) ? raw.overrides : {};
  const overrides: Record<string, PythonLabRuleSetV1> = {};
  Object.keys(overridesRaw).forEach((k) => {
    overrides[String(k)] = normalizeRuleSetV1((overridesRaw as any)[k]);
  });
  return { version: 1, global, overrides };
}

export function loadRuleSetBundleV1(): PythonLabRuleSetBundleV1 {
  try {
    const raw = localStorage.getItem(pythonLabRuleSetBundleKey);
    if (raw) return normalizeRuleSetBundleV1(JSON.parse(raw));
  } catch {
  }
  try {
    const legacy = localStorage.getItem(pythonLabRuleSetKey);
    if (legacy) {
      return { version: 1, global: normalizeRuleSetV1(JSON.parse(legacy)), overrides: {} };
    }
  } catch {
  }
  return { version: 1, global: DEFAULT_RULESET_V1, overrides: {} };
}

export function saveRuleSetBundleV1(next: PythonLabRuleSetBundleV1) {
  localStorage.setItem(pythonLabRuleSetBundleKey, JSON.stringify(next));
  localStorage.setItem(pythonLabRuleSetKey, JSON.stringify(next.global));
}

export function loadEffectiveRuleSetV1(experimentId: string): PythonLabRuleSetV1 {
  const bundle = loadRuleSetBundleV1();
  const overrides = bundle.overrides || {};
  if (experimentId && overrides[experimentId]) return normalizeRuleSetV1(overrides[experimentId]);
  return normalizeRuleSetV1(bundle.global);
}

export function saveRuleSetGlobalV1(next: PythonLabRuleSetV1) {
  const bundle = loadRuleSetBundleV1();
  saveRuleSetBundleV1({ ...bundle, global: normalizeRuleSetV1(next) });
}

export function saveRuleSetOverrideV1(experimentId: string, next: PythonLabRuleSetV1) {
  const id = String(experimentId || "").trim();
  if (!id) return;
  const bundle = loadRuleSetBundleV1();
  const overrides = { ...(bundle.overrides || {}) };
  overrides[id] = normalizeRuleSetV1(next);
  saveRuleSetBundleV1({ ...bundle, overrides });
}

export function clearRuleSetOverrideV1(experimentId: string) {
  const id = String(experimentId || "").trim();
  if (!id) return;
  const bundle = loadRuleSetBundleV1();
  const overrides = { ...(bundle.overrides || {}) };
  delete overrides[id];
  saveRuleSetBundleV1({ ...bundle, overrides });
}

export function loadRuleSetV1(): PythonLabRuleSetV1 {
  return loadRuleSetBundleV1().global;
}

export function saveRuleSetV1(next: PythonLabRuleSetV1) {
  saveRuleSetGlobalV1(next);
}

export async function sha256Hex(text: string): Promise<string> {
  const input = new TextEncoder().encode(text);
  const subtle = (globalThis as any)?.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== "function") {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) h = (h ^ input[i]) * 16777619;
    return `fnv1a_${(h >>> 0).toString(16)}`;
  }
  const buf = await subtle.digest("SHA-256", input);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}
