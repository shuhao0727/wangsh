import { createDebugFrontendAdapter, resolveDebugFrontendMode } from "./debugFrontendAdapter";

const OLD_MODE = process.env.REACT_APP_PYTHONLAB_DEBUG_FRONTEND_MODE;

test("resolveDebugFrontendMode defaults to legacy", () => {
  try {
    delete process.env.REACT_APP_PYTHONLAB_DEBUG_FRONTEND_MODE;
    expect(resolveDebugFrontendMode()).toBe("legacy");
  } finally {
    process.env.REACT_APP_PYTHONLAB_DEBUG_FRONTEND_MODE = OLD_MODE;
  }
});

test("resolveDebugFrontendMode accepts mature_web_embed", () => {
  try {
    process.env.REACT_APP_PYTHONLAB_DEBUG_FRONTEND_MODE = "mature_web_embed";
    expect(resolveDebugFrontendMode()).toBe("mature_web_embed");
  } finally {
    process.env.REACT_APP_PYTHONLAB_DEBUG_FRONTEND_MODE = OLD_MODE;
  }
});

test("createDebugFrontendAdapter forwards actions", () => {
  const called: string[] = [];
  const adapter = createDebugFrontendAdapter({
    run: () => called.push("run"),
    debug: () => called.push("debug"),
    continueRun: () => called.push("continue"),
    pause: () => called.push("pause"),
    stepOver: () => called.push("over"),
    stepInto: () => called.push("into"),
    stepOut: () => called.push("out"),
    reset: () => called.push("reset"),
  });
  adapter.run();
  adapter.debug();
  adapter.continueRun();
  adapter.pause();
  adapter.stepOver();
  adapter.stepInto();
  adapter.stepOut();
  adapter.reset();
  expect(called).toEqual(["run", "debug", "continue", "pause", "over", "into", "out", "reset"]);
  expect(adapter.capabilities.version).toBe("v1");
  expect(adapter.capabilities.items.some((x) => x.key === "stepBack" && x.supported === false)).toBe(true);
});

test("adapter contract stays consistent with capability map", () => {
  const adapter = createDebugFrontendAdapter({
    run: () => {},
    debug: () => {},
    continueRun: () => {},
    pause: () => {},
    stepOver: () => {},
    stepInto: () => {},
    stepOut: () => {},
    reset: () => {},
  });
  const callableKeys: Array<keyof typeof adapter> = ["run", "debug", "continueRun", "pause", "stepOver", "stepInto", "stepOut", "reset"];
  expect(callableKeys.every((k) => typeof adapter[k] === "function")).toBe(true);
  const requiredCaps = ["breakpoint", "continue", "pause", "stepOver", "stepInto", "stepOut", "callStack", "variables"];
  const capKeys = new Set(adapter.capabilities.items.map((x) => x.key));
  expect(requiredCaps.every((k) => capKeys.has(k as any))).toBe(true);
});
