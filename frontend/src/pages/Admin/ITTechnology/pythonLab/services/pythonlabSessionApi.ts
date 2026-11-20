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
  stop_confirmed?: boolean;
  error_code?: string | null;
  error_detail?: string | null;
};

const recoveryKey = (scope: string) => `pythonlab:session:${scope}`;

export function trackedPythonlabSession(scope: string): string | null {
  try { return sessionStorage.getItem(recoveryKey(scope)); } catch { return null; }
}

export function trackPythonlabSession(scope: string, sessionId: string) {
  try { sessionStorage.setItem(recoveryKey(scope), sessionId); } catch { /* storage unavailable */ }
}

export function forgetPythonlabSession(scope: string, sessionId: string) {
  try {
    if (trackedPythonlabSession(scope) === sessionId) sessionStorage.removeItem(recoveryKey(scope));
  } catch { /* storage unavailable */ }
}

export function pythonlabSessionNotFound(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

export async function stopAndWaitForPythonlabSession(sessionId: string, scope?: string) {
  const result = await pythonlabSessionApi.stop(sessionId);
  if (!result.ok) throw new Error("停止请求未确认，请重试");
  if (result.status !== "TERMINATED") {
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      const meta = await pythonlabSessionApi.get(sessionId);
      if (meta.status === "TERMINATED" && meta.stop_confirmed) {
        if (scope) forgetPythonlabSession(scope, sessionId);
        return;
      }
      if (meta.error_code === "SANDBOX_STOP_FAILED") throw new Error("停止未能确认，请重试");
    }
    throw new Error("停止仍在处理，请稍后重试确认");
  }
  if (scope) forgetPythonlabSession(scope, sessionId);
}

export const pythonlabSessionApi = {
  create: async (payload: PythonLabCreateSessionRequest): Promise<PythonLabCreateSessionResponse> => {
    const resp = await pythonlabV2Client.post<PythonLabCreateSessionResponse>("/sessions", {
      engine: "remote",
      ...payload,
    });
    return resp.data;
  },
  get: async (sessionId: string): Promise<PythonLabSessionMeta> => {
    const resp = await pythonlabV2Client.get<PythonLabSessionMeta>(`/sessions/${sessionId}`, { silent: true });
    return resp.data as PythonLabSessionMeta;
  },
  stop: async (sessionId: string) => {
    const resp = await pythonlabV2Client.post<{ ok: boolean; status: "TERMINATING" | "TERMINATED" }>(
      `/sessions/${sessionId}/stop`, undefined, { silent: true },
    );
    return resp.data;
  },
  stopAndWait: stopAndWaitForPythonlabSession,
  list: async (): Promise<{ items: PythonLabSessionMeta[]; total: number }> => {
    const resp = await pythonlabV2Client.get<{ items: PythonLabSessionMeta[]; total: number }>("/sessions", { silent: true });
    return resp.data as { items: PythonLabSessionMeta[]; total: number };
  },
};
