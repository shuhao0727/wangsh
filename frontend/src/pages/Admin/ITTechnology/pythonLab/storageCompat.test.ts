/**
 * @jest-environment jsdom
 */
import { ensurePythonLabStorageCompatible } from "./storageCompat";
import { pythonLabPipelineRecordsKey, pythonLabPipelineRecordsKeyV1 } from "./pipeline/records";
import { pythonLabRuleSetBundleKey, pythonLabRuleSetBundleKeyV1, pythonLabRuleSetKey } from "./pipeline/rules";
import { pythonLabStorageKey } from "./storage";

test("ensurePythonLabStorageCompatible migrates legacy ruleset bundle to stable key", () => {
  localStorage.clear();
  expect(localStorage.getItem(pythonLabRuleSetBundleKey)).toBeNull();
  localStorage.setItem(
    pythonLabRuleSetBundleKeyV1,
    JSON.stringify({
      version: 1,
      global: { version: 1, tidy: { enabled: { R_TIDY_START_END: true } }, beautify: { params: { rankdir: "LR" }, thresholds: { maxNodes: 30 }, alignMode: false } },
      overrides: {},
    })
  );

  ensurePythonLabStorageCompatible();

  const stable = localStorage.getItem(pythonLabRuleSetBundleKey);
  expect(stable).not.toBeNull();
  const parsed = stable ? JSON.parse(stable) : null;
  expect(parsed?.version).toBe(1);
  expect(typeof localStorage.getItem(pythonLabRuleSetKey)).toBe("string");
});

test("ensurePythonLabStorageCompatible migrates legacy pipeline records to stable key", () => {
  localStorage.clear();
  expect(localStorage.getItem(pythonLabPipelineRecordsKey)).toBeNull();
  localStorage.setItem(
    pythonLabPipelineRecordsKeyV1,
    JSON.stringify([{ version: 1, id: "r1", createdAt: 1, experimentId: "seq_basic", ruleSetHash: "h1" }])
  );

  ensurePythonLabStorageCompatible();

  const stable = localStorage.getItem(pythonLabPipelineRecordsKey);
  expect(stable).not.toBeNull();
  const parsed = stable ? JSON.parse(stable) : null;
  expect(Array.isArray(parsed)).toBe(true);
  expect(parsed?.[0]?.id).toBe("r1");
});

test("ensurePythonLabStorageCompatible normalizes experiments and re-saves merged list", () => {
  localStorage.clear();
  localStorage.setItem(pythonLabStorageKey, JSON.stringify([{ id: "custom_1", title: "自定义", starterCode: "print(1)\n", tags: ["x"], scenario: "循环" }]));

  ensurePythonLabStorageCompatible();

  const raw = localStorage.getItem(pythonLabStorageKey);
  expect(raw).not.toBeNull();
  const merged = raw ? JSON.parse(raw) : null;
  expect(Array.isArray(merged)).toBe(true);
  expect(merged.length).toBeGreaterThanOrEqual(10);
});
