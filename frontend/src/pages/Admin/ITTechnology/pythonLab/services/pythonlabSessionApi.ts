import { pythonlabV2Client } from "./pythonlabApiBase";

export type PythonLabDebugLimits = {
  cpu_ms?: number;
  wall_ms?: number;
  memory_mb?: number;
  max_stdout_kb?: number;
};

export type PythonLabCreateSessionRequest = {
  title?: string;
  code: string;
  engine?: "remote";
  runtime_mode?: "plain" | "debug";
  python_version?: string;
  requirements?: string[];
  entry_path?: string;
  limits?: PythonLabDebugLimits;
};

export type PythonLabCreateSessionResponse = {
  session_id: string;
  status: string;
  ws_url: string;
};

export type PythonLabSessionMeta = {
  session_id: string;
  owner_user_id: number;
  status: string;
  created_at: string;
  last_heartbeat_at: string;
  ttl_seconds: number;
  limits: PythonLabDebugLimits & Record<string, unknown>;
  entry_path: string;
  runtime_mode?: "plain" | "debug";
  code_sha256: string;
  dap_host?: string | null;
  dap_port?: number | null;
  docker_container_id?: string | null;
  error_code?: string | null;
  error_detail?: string | null;
};

// Session recovery: persist last session ID in sessionStorage for browser refresh recovery
const SESSION_STORAGE_KEY = "pythonlab:last_session_id";

export const pythonlabSessionApi = {
  create: async (payload: PythonLabCreateSessionRequest): Promise<PythonLabCreateSessionResponse> => {
    const resp = await pythonlabV2Client.post<PythonLabCreateSessionResponse>("/sessions", {
      engine: "remote",
      ...payload,
    });
    const data = resp.data as PythonLabCreateSessionResponse;
    // Persist session ID for recovery after browser refresh
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, data.session_id);
    } catch {}
    return data;
  },
  get: async (sessionId: string): Promise<PythonLabSessionMeta> => {
    const resp = await pythonlabV2Client.get<PythonLabSessionMeta>(`/sessions/${sessionId}`, { silent: true });
    return resp.data as PythonLabSessionMeta;
  },
  stop: async (sessionId: string): Promise<{ ok: boolean }> => {
    const resp = await pythonlabV2Client.post<{ ok: boolean }>(`/sessions/${sessionId}/stop`);
    // Clear persisted session on stop
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored === sessionId) sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
    return resp.data as { ok: boolean };
  },
  list: async (): Promise<{ items: PythonLabSessionMeta[]; total: number }> => {
    const resp = await pythonlabV2Client.get<{ items: PythonLabSessionMeta[]; total: number }>("/sessions", { silent: true });
    return resp.data as { items: PythonLabSessionMeta[]; total: number };
  },
  /**
   * Try to recover a session after browser refresh.
   * Returns the session meta if it's still active, null otherwise.
   */
  tryRecover: async (): Promise<PythonLabSessionMeta | null> => {
    try {
      const storedId = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!storedId) return null;
      const meta = await pythonlabSessionApi.get(storedId);
      const activeStatuses = new Set(["READY", "ATTACHED", "RUNNING", "STOPPED", "PENDING", "STARTING"]);
      if (activeStatuses.has(meta.status)) {
        return meta;
      }
      // Session is dead, clean up
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  },
};
