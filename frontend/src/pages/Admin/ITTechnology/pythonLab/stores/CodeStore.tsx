import React, { createContext, useContext } from "react";
import type { IRBlock } from "../flow/ir";
import type { PythonLabFlowDiagnostic } from "../services/pythonlabDebugApi";
import type { DebugMap } from "../flow/debugMap";

export interface CodeApi {
  code: string;
  setCode: React.Dispatch<React.SetStateAction<string>>;
  codeMode: "auto" | "manual";
  setCodeMode: React.Dispatch<React.SetStateAction<"auto" | "manual">>;
  codeIr: IRBlock | null;
  generated: { python: string };
  debugMap: DebugMap | null;
  flowDiagnostics: PythonLabFlowDiagnostic[];
  flowExpandFunctions: "all" | "top" | "none";
  setFlowExpandFunctions: React.Dispatch<React.SetStateAction<"all" | "top" | "none">>;
  rebuildFlowFromCode: () => Promise<void>;
}

const CodeCtx = createContext<CodeApi | null>(null);

export const CodeCtxProvider = CodeCtx.Provider;

export function useCode(): CodeApi {
  const ctx = useContext(CodeCtx);
  if (!ctx) throw new Error("useCode must be used within CodeProvider");
  return ctx;
}
