import {
  applyDapNegotiatedCapabilities,
  createDebugCapabilityMapV1,
  diffDebugControlMatrix,
  getDebugCapabilityLabel,
  getDebugCapabilityNote,
  isDebugCapabilitySupported,
  listNegotiatedCapabilities,
  resolveDebugControlMatrix,
  summarizeDebugCapabilities,
} from "./debugCapabilityMap";

test("createDebugCapabilityMapV1 returns stable capability set", () => {
  const cap = createDebugCapabilityMapV1("mature_web_embed");
  expect(cap.version).toBe("v1");
  expect(cap.mode).toBe("mature_web_embed");
  expect(cap.items.length).toBeGreaterThanOrEqual(10);
  expect(cap.items.some((x) => x.key === "stepBack" && x.supported === false)).toBe(true);
});

test("summarizeDebugCapabilities exposes unsupported stepBack label", () => {
  const cap = createDebugCapabilityMapV1("legacy");
  const summary = summarizeDebugCapabilities(cap);
  expect(summary.supported).toContain("下一步");
  expect(summary.unsupported).toContain("上一步");
});

test("capability support and note helpers are consistent for stepBack", () => {
  const cap = createDebugCapabilityMapV1("legacy");
  expect(isDebugCapabilitySupported(cap, "stepBack")).toBe(false);
  expect(getDebugCapabilityLabel("stepBack")).toBe("上一步");
  expect(getDebugCapabilityNote(cap, "stepBack")).toContain("暂不支持");
});

test("applyDapNegotiatedCapabilities enables stepBack when adapter declares support", () => {
  const cap = createDebugCapabilityMapV1("mature_web_embed");
  const negotiated = applyDapNegotiatedCapabilities(cap, { supportsStepBack: true });
  expect(isDebugCapabilitySupported(negotiated, "stepBack")).toBe(true);
  expect(getDebugCapabilityNote(negotiated, "stepBack")).toContain("支持上一步");
});

test("applyDapNegotiatedCapabilities keeps stepBack disabled when unsupported", () => {
  const cap = createDebugCapabilityMapV1("legacy");
  const negotiated = applyDapNegotiatedCapabilities(cap, { supportsStepBack: false });
  expect(isDebugCapabilitySupported(negotiated, "stepBack")).toBe(false);
  expect(getDebugCapabilityNote(negotiated, "stepBack")).toContain("未声明支持");
});

test("listNegotiatedCapabilities exposes key fields with dap_initialize source", () => {
  const rows = listNegotiatedCapabilities({
    supportsStepBack: true,
    supportsEvaluateForHovers: false,
    supportsCompletionsRequest: true,
    supportsSetVariable: false,
    supportsConfigurationDoneRequest: true,
  });
  expect(rows.length).toBe(5);
  expect(rows.every((x) => x.source === "dap_initialize")).toBe(true);
  expect(rows.find((x) => x.key === "supportsStepBack")?.supported).toBe(true);
  expect(rows.find((x) => x.key === "supportsSetVariable")?.supported).toBe(false);
});

test("resolveDebugControlMatrix enables stepping controls only when paused", () => {
  const cap = createDebugCapabilityMapV1("legacy");
  const paused = resolveDebugControlMatrix("paused", cap);
  expect(paused.run).toBe(true);
  expect(paused.pause).toBe(false);
  expect(paused.continue).toBe(true);
  expect(paused.stepOver).toBe(true);
  expect(paused.stepInto).toBe(true);
  expect(paused.stepOut).toBe(true);
  expect(paused.stepBack).toBe(false);
});

test("resolveDebugControlMatrix disables run/debug while running", () => {
  const cap = createDebugCapabilityMapV1("mature_web_embed");
  const running = resolveDebugControlMatrix("running", cap);
  expect(running.run).toBe(false);
  expect(running.debug).toBe(false);
  expect(running.pause).toBe(true);
  expect(running.continue).toBe(false);
  expect(running.stepOver).toBe(false);
});

test("control matrix updates stepBack when negotiated capability changes", () => {
  const base = createDebugCapabilityMapV1("mature_web_embed");
  const unsupported = applyDapNegotiatedCapabilities(base, { supportsStepBack: false });
  const supported = applyDapNegotiatedCapabilities(base, { supportsStepBack: true });
  const pausedUnsupported = resolveDebugControlMatrix("paused", unsupported);
  const pausedSupported = resolveDebugControlMatrix("paused", supported);
  const diffs = diffDebugControlMatrix(pausedUnsupported, pausedSupported);
  expect(diffs).toEqual([{ key: "stepBack", from: false, to: true }]);
});

test("control matrix state evolution stays stable across lifecycle statuses", () => {
  const cap = applyDapNegotiatedCapabilities(createDebugCapabilityMapV1("legacy"), { supportsStepBack: true });
  const idle = resolveDebugControlMatrix("idle", cap);
  const starting = resolveDebugControlMatrix("starting", cap);
  const running = resolveDebugControlMatrix("running", cap);
  const paused = resolveDebugControlMatrix("paused", cap);
  expect(idle).toEqual({ run: true, debug: true, pause: false, continue: false, stepOver: false, stepInto: false, stepOut: false, stepBack: false, reset: true });
  expect(starting).toEqual({ run: false, debug: false, pause: false, continue: false, stepOver: false, stepInto: false, stepOut: false, stepBack: false, reset: true });
  expect(running).toEqual({ run: false, debug: false, pause: true, continue: false, stepOver: false, stepInto: false, stepOut: false, stepBack: false, reset: true });
  expect(paused).toEqual({ run: true, debug: true, pause: false, continue: true, stepOver: true, stepInto: true, stepOut: true, stepBack: true, reset: true });
  expect(diffDebugControlMatrix(starting, running)).toEqual([{ key: "pause", from: false, to: true }]);
});
