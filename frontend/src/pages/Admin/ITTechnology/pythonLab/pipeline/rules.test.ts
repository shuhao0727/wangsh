import { DEFAULT_RULESET_V1, normalizeRuleSetBundleV1, normalizeRuleSetV1 } from "./rules";

test("normalizeRuleSetV1 merges defaults and keeps version=1", () => {
  const raw: any = { version: 1, beautify: { params: { rankdir: "LR" } }, tidy: { enabled: { R_TIDY_MARK_CRITICAL: false } } };
  const v = normalizeRuleSetV1(raw);
  expect(v.version).toBe(1);
  expect(v.beautify.params.rankdir).toBe("LR");
  expect(v.tidy.enabled.R_TIDY_MARK_CRITICAL).toBe(false);
  expect(v.tidy.enabled.R_TIDY_CONNECT_DEG0).toBe(true);
  expect(v.beautify.thresholds.maxNodes).toBe(DEFAULT_RULESET_V1.beautify.thresholds.maxNodes);
});

test("normalizeRuleSetBundleV1 accepts global+overrides", () => {
  const raw: any = {
    version: 1,
    global: { version: 1, beautify: { params: { rankdir: "LR" } }, tidy: { enabled: { R_TIDY_MARK_CRITICAL: false } } },
    overrides: { demo: { version: 1, beautify: { params: { rankdir: "TB" } }, tidy: { enabled: { R_TIDY_MARK_CRITICAL: true } } } },
  };
  const v = normalizeRuleSetBundleV1(raw);
  expect(v.version).toBe(1);
  expect(v.global.beautify.params.rankdir).toBe("LR");
  expect(v.overrides?.demo.beautify.params.rankdir).toBe("TB");
});
