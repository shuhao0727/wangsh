import { createDebugCapabilityMapV1, type DebugCapabilityMapV1 } from "./debugCapabilityMap";

export type DebugFrontendMode = "legacy" | "mature_web_embed";

export type DebugFrontendAdapterActions = {
  run: (stdinLines?: string[]) => void;
  debug: () => void;
  continueRun: () => void;
  pause: () => void;
  stepOver: () => void;
  stepInto: () => void;
  stepOut: () => void;
  reset: () => void;
};

export type DebugFrontendAdapter = {
  mode: DebugFrontendMode;
  id: string;
  capabilities: DebugCapabilityMapV1;
  run: (stdinLines?: string[]) => void;
  debug: () => void;
  continueRun: () => void;
  pause: () => void;
  stepOver: () => void;
  stepInto: () => void;
  stepOut: () => void;
  reset: () => void;
};

export function resolveDebugFrontendMode(): DebugFrontendMode {
  const raw = String(process.env.REACT_APP_PYTHONLAB_DEBUG_FRONTEND_MODE || "legacy").toLowerCase().trim();
  return raw === "mature_web_embed" ? "mature_web_embed" : "legacy";
}

export function createDebugFrontendAdapter(actions: DebugFrontendAdapterActions): DebugFrontendAdapter {
  const mode = resolveDebugFrontendMode();
  return {
    mode,
    id: mode === "mature_web_embed" ? "mature-web-embed-adapter" : "legacy-adapter",
    capabilities: createDebugCapabilityMapV1(mode),
    run: (stdinLines?: string[]) => actions.run(stdinLines),
    debug: () => actions.debug(),
    continueRun: () => actions.continueRun(),
    pause: () => actions.pause(),
    stepOver: () => actions.stepOver(),
    stepInto: () => actions.stepInto(),
    stepOut: () => actions.stepOut(),
    reset: () => actions.reset(),
  };
}
