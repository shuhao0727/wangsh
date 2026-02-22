import { api } from "@/services";

export type PythonLabSourceRange = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

export type PythonLabCfgNode = {
  id: string;
  kind: string;
  title: string;
  fullTitle?: string;
  range: PythonLabSourceRange;
  parentId?: string | null;
};

export type PythonLabCfgEdge = {
  id: string;
  from: string;
  to: string;
  kind: string;
  label?: string;
};

export type PythonLabCfgResponse = {
  sourcePath: string;
  version: string;
  nodes: PythonLabCfgNode[];
  edges: PythonLabCfgEdge[];
  diagnostics: Array<{ level: string; message: string; line?: number }>;
  entryNodeId?: string;
  exitNodeIds?: string[];
  exitEdges?: Array<{ from: string; kind: string; label?: string }>;
};

export const pythonlabDebugApi = {
  parseCfg: async (code: string): Promise<PythonLabCfgResponse> => {
    const resp = await api.client.post("/debug/cfg/parse", { code });
    return resp.data as PythonLabCfgResponse;
  },
};

export type PythonLabFlowDiagnostic = { level: string; code?: string; message: string; range?: PythonLabSourceRange; hint?: string };
export type PythonLabFlowStats = { parseMs?: number; cacheHit?: boolean; nodeCount?: number; edgeCount?: number; truncated?: boolean };
export type PythonLabFlowResponse = {
  version: string;
  parserVersion: string;
  codeSha256: string;
  entryNodeId?: string;
  exitNodeIds?: string[];
  exitEdges?: Array<{ from: string; kind: string; label?: string }>;
  nodes: PythonLabCfgNode[];
  edges: PythonLabCfgEdge[];
  diagnostics: PythonLabFlowDiagnostic[];
  stats?: PythonLabFlowStats;
};

export const pythonlabFlowApi = {
  parseFlow: async (code: string, options?: any): Promise<PythonLabFlowResponse> => {
    const resp = await api.client.post("/debug/flow/parse", { code, options: options ?? {} });
    return resp.data as PythonLabFlowResponse;
  },
};

export type PythonLabPseudocodeRuleUsed = { id: string; count: number; description?: string };
export type PythonLabPseudocodeLossPoint = { code: string; message: string; range?: PythonLabSourceRange };
export type PythonLabPseudocodeItem = { text: string; range?: PythonLabSourceRange; source?: string };
export type PythonLabPseudocodeReversibility = { score: number; level: "high" | "medium" | "low"; reasons?: string[] };

export type PythonLabPseudocodeParseResponse = {
  version: string;
  parserVersion: string;
  codeSha256: string;
  input: { items: PythonLabPseudocodeItem[] };
  process: { items: PythonLabPseudocodeItem[] };
  output: { items: PythonLabPseudocodeItem[] };
  rulesUsed: PythonLabPseudocodeRuleUsed[];
  lossPoints: PythonLabPseudocodeLossPoint[];
  reversibility: PythonLabPseudocodeReversibility;
  diagnostics?: Array<{ level: string; code?: string; message: string; line?: number; col?: number }>;
  stats?: { parseMs?: number; cacheHit?: boolean };
};

export const pythonlabPseudocodeApi = {
  parsePseudocode: async (code: string, options?: any): Promise<PythonLabPseudocodeParseResponse> => {
    const resp = await api.client.post("/debug/pseudocode/parse", { code, options: options ?? {} });
    return resp.data as PythonLabPseudocodeParseResponse;
  },
};

export type PythonLabSyntaxError = {
  line: number;
  col: number;
  message: string;
  endLine?: number | null;
  endCol?: number | null;
  source?: string;
};

export type PythonLabSyntaxResponse = {
  ok: boolean;
  errors: PythonLabSyntaxError[];
  timestamp: number;
};

export const pythonlabSyntaxApi = {
  checkSyntax: async (code: string): Promise<PythonLabSyntaxResponse> => {
    const resp = await api.client.post("/debug/syntax/check", { code });
    return resp.data as PythonLabSyntaxResponse;
  },
};
