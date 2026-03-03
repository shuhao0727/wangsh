import { loadPipelineRecords, savePipelineRecords, pythonLabPipelineRecordsKey, pythonLabPipelineRecordsKeyV1 } from "./pipeline/records";
import { loadRuleSetBundleV1, saveRuleSetBundleV1, pythonLabRuleSetBundleKey, pythonLabRuleSetBundleKeyV1, pythonLabRuleSetKey, pythonLabRuleSetKeyV1 } from "./pipeline/rules";
import { loadPythonLabExperiments, pythonLabStorageKey, savePythonLabExperiments } from "./storage";

export function ensurePythonLabStorageCompatible() {
  try {
    const hasStable = !!localStorage.getItem(pythonLabRuleSetBundleKey);
    const hasLegacyBundle = !!localStorage.getItem(pythonLabRuleSetBundleKeyV1);
    const hasLegacyGlobal = !!localStorage.getItem(pythonLabRuleSetKeyV1);
    const hasStableGlobal = !!localStorage.getItem(pythonLabRuleSetKey);
    if (!hasStable && (hasLegacyBundle || hasLegacyGlobal || hasStableGlobal)) {
      const bundle = loadRuleSetBundleV1();
      saveRuleSetBundleV1(bundle);
    }
  } catch {}

  try {
    const hasStable = !!localStorage.getItem(pythonLabPipelineRecordsKey);
    const hasLegacy = !!localStorage.getItem(pythonLabPipelineRecordsKeyV1);
    if (!hasStable && hasLegacy) {
      const records = loadPipelineRecords();
      savePipelineRecords(records);
    }
  } catch {}

  try {
    const raw = localStorage.getItem(pythonLabStorageKey);
    if (raw) {
      const merged = loadPythonLabExperiments();
      savePythonLabExperiments(merged);
    }
  } catch {}
}

