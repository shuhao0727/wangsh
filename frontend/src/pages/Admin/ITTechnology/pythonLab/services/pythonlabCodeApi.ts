import { pythonlabV2Client } from "./pythonlabApiBase";

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

export const pythonlabCfgApi = {
  parseCfg: async (code: string): Promise<PythonLabCfgResponse> => {
    const resp = await pythonlabV2Client.post<PythonLabCfgResponse>("/cfg/parse", { code });
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

export type PythonLabFlowParseOptions = {
  expand?: {
    functions?: "all" | "top" | "none";
    maxDepth?: number;
  };
  limits?: {
    maxParseMs?: number;
    maxNodes?: number;
    maxEdges?: number;
  };
  [k: string]: unknown;
};

export const pythonlabFlowApi = {
  parseFlow: async (code: string, options?: PythonLabFlowParseOptions): Promise<PythonLabFlowResponse> => {
    const resp = await pythonlabV2Client.post<PythonLabFlowResponse>("/flow/parse", { code, options: options ?? {} });
    return resp.data as PythonLabFlowResponse;
  },
  generateCode: async (flow: any, options?: { timeoutMs?: number; silent?: boolean }): Promise<{ code?: string; error?: string }> => {
    const resp = await pythonlabV2Client.post<{ code?: string; error?: string }>(
      "/flow/generate_code",
      { flow },
      { timeout: options?.timeoutMs, silent: options?.silent },
    );
    return resp.data;
  },
  testAgent: async (
    config: { api_url: string; api_key: string; prompt_template?: string; model?: string },
    options?: { timeoutMs?: number; silent?: boolean }
  ): Promise<{ success: boolean; error?: string }> => {
    const resp = await pythonlabV2Client.post<{ success: boolean; error?: string }>(
      "/flow/test_agent_connection",
      config,
      { timeout: options?.timeoutMs, silent: options?.silent },
    );
    return resp.data;
  },
  getPromptTemplate: async (): Promise<{ content: string }> => {
    const resp = await pythonlabV2Client.get<{ content: string }>("/flow/prompt_template");
    return resp.data;
  },
  savePromptTemplate: async (content: string): Promise<{ success: boolean }> => {
    const resp = await pythonlabV2Client.post<{ success: boolean }>("/flow/prompt_template", { content });
    return resp.data;
  },
  chatWithAI: async (messages: Array<{ role: string; content: string }>): Promise<{ message?: string; error?: string }> => {
    const resp = await pythonlabV2Client.post<{ message?: string; error?: string }>("/ai/chat", { messages });
    return resp.data;
  },
  optimizeCode: async (code: string): Promise<{ optimized_code: string; log_id: number; rollback_id: string }> => {
    const resp = await pythonlabV2Client.post<{ optimized_code: string; log_id: number; rollback_id: string }>(
      "/optimize/code",
      { code },
      { timeout: 60000 },
    );
    return resp.data;
  },
  applyOptimization: async (logId: number): Promise<{ success: boolean }> => {
    const resp = await pythonlabV2Client.post<{ success: boolean }>(`/optimize/apply/${logId}`);
    return resp.data;
  },
  rollbackOptimization: async (logId: number): Promise<{ original_content: string | any; type: string }> => {
    const resp = await pythonlabV2Client.get<{ original_content: string | any; type: string }>(`/optimize/rollback/${logId}`);
    return resp.data;
  }
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
    const resp = await pythonlabV2Client.post<PythonLabSyntaxResponse>("/syntax/check", { code });
    return resp.data as PythonLabSyntaxResponse;
  },
};
