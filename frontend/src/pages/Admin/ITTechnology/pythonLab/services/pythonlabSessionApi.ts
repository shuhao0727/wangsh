import { api } from "@/services";

export type PythonLabDebugLimits = {
  cpu_ms?: number;
  wall_ms?: number;
  memory_mb?: number;
  max_stdout_kb?: number;
};

export type PythonLabCreateSessionRequest = {
  title?: string;
  code: string;
  python_version?: string;
  requirements?: string[];
  entry_path?: string;
  limits?: PythonLabDebugLimits;
};

export type PythonLabCreateSessionResponse = {
  session_id: string;
  status: string;
  ws_url: string;
  cfg_url: string;
};

export type PythonLabSessionMeta = {
  session_id: string;
  owner_user_id: number;
  status: string;
  created_at: string;
  last_heartbeat_at: string;
  ttl_seconds: number;
  limits: Record<string, any>;
  entry_path: string;
  code_sha256: string;
  dap_host?: string | null;
  dap_port?: number | null;
  docker_container_id?: string | null;
  error_code?: string | null;
  error_detail?: string | null;
};

export type PythonLabSessionListResponse = {
  items: PythonLabSessionMeta[];
  total: number;
};

export type PythonLabCleanupResponse = {
  ok: boolean;
  stopped: string[];
  stopped_count: number;
};

export const pythonlabSessionApi = {
  create: async (payload: PythonLabCreateSessionRequest): Promise<PythonLabCreateSessionResponse> => {
    const resp = await api.client.post("/debug/sessions", payload);
    return resp.data as PythonLabCreateSessionResponse;
  },
  get: async (sessionId: string): Promise<PythonLabSessionMeta> => {
    const resp = await api.client.get(`/debug/sessions/${sessionId}`, { silent: true } as any);
    return resp.data as PythonLabSessionMeta;
  },
  list: async (): Promise<PythonLabSessionListResponse> => {
    const resp = await api.client.get(`/debug/sessions`, { silent: true } as any);
    return resp.data as PythonLabSessionListResponse;
  },
  stop: async (sessionId: string): Promise<{ ok: boolean }> => {
    const resp = await api.client.post(`/debug/sessions/${sessionId}/stop`);
    return resp.data as { ok: boolean };
  },
  cleanup: async (): Promise<PythonLabCleanupResponse> => {
    const resp = await api.client.post(`/debug/sessions/cleanup`);
    return resp.data as PythonLabCleanupResponse;
  },
};
