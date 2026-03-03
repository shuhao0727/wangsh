import type { FlowBeautifyParams, FlowBeautifyThresholds } from "../flow/beautify";
import type { FlowTidyRuleId } from "../flow/tidy";
import { DEFAULT_BEAUTIFY_PARAMS, DEFAULT_BEAUTIFY_THRESHOLDS } from "../flow/beautify";

export const PYTHONLAB_RULESET_SCHEMA_VERSION = 1 as const;

export type PythonLabRuleSetV1 = {
  version: 1;
  tidy: { enabled: Record<FlowTidyRuleId, boolean> };
  beautify: { params: FlowBeautifyParams; thresholds: FlowBeautifyThresholds; alignMode: boolean };
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
  beautify: { params: DEFAULT_BEAUTIFY_PARAMS, thresholds: DEFAULT_BEAUTIFY_THRESHOLDS, alignMode: false },
};

export const pythonLabRuleSetKey = "python_lab_ruleset";
export const pythonLabRuleSetBundleKey = "python_lab_ruleset_bundle";
export const pythonLabRuleSetKeyV1 = "python_lab_ruleset_v1";
export const pythonLabRuleSetBundleKeyV1 = "python_lab_ruleset_bundle_v1";

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

type AnyObj = Record<string, unknown>;

function isObj(v: unknown): v is AnyObj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeBeautifyParams(raw: unknown): FlowBeautifyParams {
  const base = DEFAULT_BEAUTIFY_PARAMS;
  if (!isObj(raw)) return base;
  const out: FlowBeautifyParams = { ...base };
  if (raw.rankdir === "TB" || raw.rankdir === "LR") out.rankdir = raw.rankdir;
  if (typeof raw.nodesep === "number") out.nodesep = raw.nodesep;
  if (typeof raw.ranksep === "number") out.ranksep = raw.ranksep;
  if (raw.theme === "light") out.theme = raw.theme;
  if (raw.engine === "dot" || raw.engine === "neato" || raw.engine === "fdp") out.engine = raw.engine;
  if (raw.splines === "spline" || raw.splines === "polyline" || raw.splines === "ortho") out.splines = raw.splines;
  if (typeof raw.concentrate === "boolean") out.concentrate = raw.concentrate;
  if (typeof raw.fontSize === "number") out.fontSize = raw.fontSize;
  if (typeof raw.pad === "number") out.pad = raw.pad;
  return out;
}

function normalizeBeautifyThresholds(raw: unknown): FlowBeautifyThresholds {
  const base = DEFAULT_BEAUTIFY_THRESHOLDS;
  if (!isObj(raw)) return base;
  const out: FlowBeautifyThresholds = { ...base };
  if (typeof raw.maxNodes === "number") out.maxNodes = raw.maxNodes;
  if (typeof raw.maxCrossings === "number") out.maxCrossings = raw.maxCrossings;
  if (typeof raw.minContrast === "number") out.minContrast = raw.minContrast;
  if (typeof raw.maxFlowAngle === "number") out.maxFlowAngle = raw.maxFlowAngle;
  return out;
}

export function normalizeRuleSetV1(raw: unknown): PythonLabRuleSetV1 {
  const base = DEFAULT_RULESET_V1;
  if (!isObj(raw) || raw.version !== 1) return base;
  const tidyRaw = isObj(raw.tidy) ? raw.tidy : null;
  const enabledRaw = tidyRaw && isObj(tidyRaw.enabled) ? tidyRaw.enabled : null;
  const enabled: Record<FlowTidyRuleId, boolean> = { ...base.tidy.enabled };
  (Object.keys(enabled) as FlowTidyRuleId[]).forEach((k) => {
    const v = enabledRaw ? enabledRaw[k] : undefined;
    if (typeof v === "boolean") enabled[k] = v;
  });

  const beautifyRaw = isObj(raw.beautify) ? raw.beautify : null;
  const params = normalizeBeautifyParams(beautifyRaw?.params);
  const thresholds = normalizeBeautifyThresholds(beautifyRaw?.thresholds);
  const alignMode = beautifyRaw && typeof beautifyRaw.alignMode === "boolean" ? beautifyRaw.alignMode : base.beautify.alignMode;

  return { version: 1, tidy: { enabled }, beautify: { params, thresholds, alignMode } };
}

export function normalizeRuleSetBundleV1(raw: unknown): PythonLabRuleSetBundleV1 {
  const base: PythonLabRuleSetBundleV1 = { version: 1, global: DEFAULT_RULESET_V1, overrides: {} };
  if (!isObj(raw) || raw.version !== 1) return base;
  const global = normalizeRuleSetV1(raw.global);
  const overridesRaw = isObj(raw.overrides) ? raw.overrides : {};
  const overrides: Record<string, PythonLabRuleSetV1> = {};
  Object.keys(overridesRaw).forEach((k) => {
    overrides[String(k)] = normalizeRuleSetV1(overridesRaw[k]);
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
    const raw = localStorage.getItem(pythonLabRuleSetBundleKeyV1);
    if (raw) {
      const normalized = normalizeRuleSetBundleV1(JSON.parse(raw));
      saveRuleSetBundleV1(normalized);
      return normalized;
    }
  } catch {
  }
  try {
    const legacy = localStorage.getItem(pythonLabRuleSetKey) ?? localStorage.getItem(pythonLabRuleSetKeyV1);
    if (legacy) {
      const normalized = { version: 1 as const, global: normalizeRuleSetV1(JSON.parse(legacy)), overrides: {} };
      saveRuleSetBundleV1(normalized);
      return normalized;
    }
  } catch {
  }
  return { version: 1, global: DEFAULT_RULESET_V1, overrides: {} };
}

export function saveRuleSetBundleV1(next: PythonLabRuleSetBundleV1) {
  localStorage.setItem(pythonLabRuleSetBundleKey, JSON.stringify(next));
  localStorage.setItem(pythonLabRuleSetKey, JSON.stringify(next.global));
  localStorage.setItem(pythonLabRuleSetBundleKeyV1, JSON.stringify(next));
  localStorage.setItem(pythonLabRuleSetKeyV1, JSON.stringify(next.global));
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
