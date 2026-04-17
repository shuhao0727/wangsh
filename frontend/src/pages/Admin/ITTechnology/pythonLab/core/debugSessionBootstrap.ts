import {
  authApi,
  authTokenStorage,
  extractAuthErrorDetail,
  getCookieToken,
  getStoredAccessToken,
  notifyAuthExpired,
} from "@services/api";
import { logger } from "@services/logger";

import { parseDapMessageMeta, parseDapOutputMeta, wsCloseHint, wsUrl } from "../hooks/dapRunnerHelpers";
import { pythonlabApiPath } from "../services/pythonlabApiBase";
import {
  pythonlabSessionApi,
  type PythonLabCreateSessionResponse,
  type PythonLabSessionMeta,
} from "../services/pythonlabSessionApi";
import { DebugController, type DapMessage } from "./DebugController";

type TraceLifecycle = (phase: string, extra?: Record<string, unknown>) => void;

export async function createAndWaitForPythonlabSession(params: {
  code: string;
  mode: "debug" | "plain";
  isCurrent: () => boolean;
  traceLifecycle: TraceLifecycle;
  onSessionCreated?: (session: PythonLabCreateSessionResponse) => void;
  createTimeoutMs?: number;
  readyTimeoutMs?: number;
}): Promise<{ session: PythonLabCreateSessionResponse; readyMeta: PythonLabSessionMeta } | null> {
  const {
    code,
    mode,
    isCurrent,
    traceLifecycle,
    onSessionCreated,
    createTimeoutMs = 12000,
    readyTimeoutMs = 75000,
  } = params;

  const createPromise = pythonlabSessionApi.create({
    title: "pythonlab",
    code,
    runtime_mode: mode === "debug" ? "debug" : "plain",
    entry_path: "main.py",
    requirements: [],
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("请求响应超时，请检查网络或后端服务状态")), createTimeoutMs)
  );

  const session = await Promise.race([createPromise, timeoutPromise]);
  if (!isCurrent()) return null;

  onSessionCreated?.(session);
  traceLifecycle("session_created", { mode, sessionId: session.session_id });

  const readyStatuses = new Set(["READY", "ATTACHED", "RUNNING", "STOPPED"]);
  const failedStatuses = new Set(["FAILED", "TERMINATED", "TERMINATING"]);
  const startTime = Date.now();
  let waited = 0;
  let lastStatus = "";

  while (waited < readyTimeoutMs) {
    if (!isCurrent()) return null;

    let meta: PythonLabSessionMeta;
    try {
      meta = await pythonlabSessionApi.get(session.session_id);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } };
      if (err?.response?.status === 404) {
        throw new Error("会话不存在/已被清理，可点右侧会话查看后重试");
      }
      throw e;
    }

    const currentStatus = String(meta.status || "").toUpperCase();
    if (currentStatus && currentStatus !== lastStatus) {
      lastStatus = currentStatus;
      traceLifecycle("session_status", { sessionId: session.session_id, status: currentStatus });
    }

    if (readyStatuses.has(currentStatus)) {
      traceLifecycle("session_ready", { mode, sessionId: session.session_id, status: currentStatus });
      return { session, readyMeta: meta };
    }

    if (failedStatuses.has(currentStatus)) {
      const detail = String(meta.error_detail || "").trim();
      if (currentStatus === "FAILED") {
        throw new Error(detail || "Session failed to start");
      }
      throw new Error(detail || `调试会话已结束（${currentStatus}），请重试`);
    }

    const elapsed = Date.now() - startTime;
    const nextPoll = elapsed < 5000 ? 150 : elapsed < 15000 ? 350 : 700;
    await new Promise((resolve) => setTimeout(resolve, nextPoll));
    waited += nextPoll;
  }

  const suffix = lastStatus ? `（最后状态：${lastStatus}）` : "";
  throw new Error(`调试会话启动超时：容器/调试器仍在启动或队列拥堵；可点右侧“会话”查看后重试${suffix}`);
}

export async function resolvePythonlabWsToken(): Promise<string | null> {
  let token = getStoredAccessToken();
  if (!token) token = getCookieToken();
  if (token) return token;
  const hasLoginContext = Boolean(getStoredAccessToken() || getCookieToken());
  if (!hasLoginContext) return null;

  try {
    const resp = await authApi.refreshToken(undefined, { silent: true });
    const data = resp?.data as Record<string, string> | null;
    if (data?.access_token || data?.refresh_token) {
      authTokenStorage.set(data?.access_token ?? null, data?.refresh_token ?? null);
      return String(data?.access_token || "");
    }
  } catch (err) {
    const detail = extractAuthErrorDetail(err);
    if (detail) notifyAuthExpired(detail);
    return null;
  }

  return null;
}

export function buildPythonlabSessionWsUrl(params: {
  sessionId: string;
  clientConnId: string;
  token: string | null;
}): string {
  const wsPath = `${pythonlabApiPath(`/sessions/${params.sessionId}/ws`)}?client_conn_id=${encodeURIComponent(params.clientConnId)}`;
  return wsUrl(wsPath, params.token);
}

export async function connectPythonlabDapController(params: {
  client: DebugController;
  url: string;
  clientConnId: string;
  sessionId: string;
  refreshBreakpoints: () => Promise<void>;
  traceLifecycle: TraceLifecycle;
}): Promise<Record<string, unknown> | null> {
  const { client, url, clientConnId, sessionId, refreshBreakpoints, traceLifecycle } = params;

  let configuredSent = false;
  let initializedResolved = false;
  let resolveInitialized: (() => void) | null = null;
  const initializedPromise = new Promise<void>((resolve) => {
    resolveInitialized = () => {
      if (initializedResolved) return;
      initializedResolved = true;
      resolve();
    };
  });

  const configureSessionOnce = async () => {
    if (configuredSent) return;
    configuredSent = true;
    await refreshBreakpoints();
    await client.sendConfigurationDone(10000);
  };

  client.on("initialized", async () => {
    traceLifecycle("dap_initialized", { clientConnId });
    resolveInitialized?.();
    try {
      await configureSessionOnce();
    } catch (e) {
      logger.error("Failed to configure DAP", e);
    }
  });

  await client.connect(url);
  traceLifecycle("ws_connected", { sessionId });

  const initializeResp: DapMessage = await client.initializePythonSession(20000, 2);
  traceLifecycle("dap_initialize_ok");

  await client.attachPythonSession(20000, 1);
  traceLifecycle("dap_attach_ok");

  await Promise.race([initializedPromise, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);

  await configureSessionOnce();
  traceLifecycle("dap_configured");

  return (initializeResp.body as Record<string, unknown> | null) ?? null;
}

export function startPlainPythonlabSessionMonitor(params: {
  sessionId: string;
  isCurrent: () => boolean;
  onFailed: (message: string) => void;
  onTerminated: () => void;
  intervalMs?: number;
}): ReturnType<typeof setInterval> {
  const { sessionId, isCurrent, onFailed, onTerminated, intervalMs = 1000 } = params;

  return setInterval(async () => {
    if (!isCurrent()) {
      return;
    }
    try {
      const meta = await pythonlabSessionApi.get(sessionId);
      if (meta.status === "FAILED") {
        onFailed(meta.error_detail || "运行失败");
        return;
      }
      if (meta.status === "TERMINATED") {
        onTerminated();
      }
    } catch {
    }
  }, intervalMs);
}

export function attachPythonlabDapRuntimeHandlers(params: {
  client: DebugController;
  traceLifecycle: TraceLifecycle;
  updateConnectionMeta: (meta: { wsEpoch: number | null; wsConnId: string | null; clientConnId: string | null }) => void;
  shouldIgnoreClose: () => boolean;
  clearIgnoreClose: () => void;
  onOutput: (output: string) => void;
  onStopped: (threadId: number) => void;
  onContinued: () => void;
  onTerminated: () => void;
  onClose: (result: { ignored: boolean; errorMessage: string | null; code: number; reason: string }) => void;
}): void {
  const {
    client,
    traceLifecycle,
    updateConnectionMeta,
    shouldIgnoreClose,
    clearIgnoreClose,
    onOutput,
    onStopped,
    onContinued,
    onTerminated,
    onClose,
  } = params;

  client.on("output", (msg) => {
    const body = msg?.body;
    const meta = parseDapOutputMeta(body);
    updateConnectionMeta({
      wsEpoch: meta.wsEpoch,
      wsConnId: meta.connId,
      clientConnId: meta.clientConnId,
    });
    const category = String(body?.category || "").toLowerCase();
    if (body && typeof body.output === "string") {
      traceLifecycle("dap_output", {
        category: category || "unknown",
        length: body.output.length,
        outputSource: meta.source,
        sourceTs: meta.ts,
        sourceWsEpoch: meta.wsEpoch,
        sourceConnId: meta.connId,
        sourceClientConnId: meta.clientConnId,
      });
      onOutput(body.output);
    }
  });

  client.on("stopped", (msg) => {
    const meta = parseDapMessageMeta(msg);
    updateConnectionMeta({
      wsEpoch: meta.wsEpoch,
      wsConnId: meta.connId,
      clientConnId: meta.clientConnId,
    });
    const threadId = Number(msg?.body?.threadId) || 1;
    traceLifecycle("dap_stopped", {
      threadId,
      sourceWsEpoch: meta.wsEpoch,
      sourceConnId: meta.connId,
      sourceClientConnId: meta.clientConnId,
    });
    onStopped(threadId);
  });

  client.on("continued", (msg) => {
    const meta = parseDapMessageMeta(msg);
    updateConnectionMeta({
      wsEpoch: meta.wsEpoch,
      wsConnId: meta.connId,
      clientConnId: meta.clientConnId,
    });
    traceLifecycle("dap_continued", {
      sourceWsEpoch: meta.wsEpoch,
      sourceConnId: meta.connId,
      sourceClientConnId: meta.clientConnId,
    });
    onContinued();
  });

  client.on("terminated", (msg) => {
    const meta = parseDapMessageMeta(msg);
    updateConnectionMeta({
      wsEpoch: meta.wsEpoch,
      wsConnId: meta.connId,
      clientConnId: meta.clientConnId,
    });
    traceLifecycle("dap_terminated", {
      sourceWsEpoch: meta.wsEpoch,
      sourceConnId: meta.connId,
      sourceClientConnId: meta.clientConnId,
    });
    onTerminated();
  });

  client.on("close", (ev: CloseEvent) => {
    const reason = String(ev.reason || "");
    traceLifecycle("dap_close", { code: ev.code, reason });
    if (shouldIgnoreClose()) {
      clearIgnoreClose();
      onClose({ ignored: true, errorMessage: null, code: ev.code, reason });
      return;
    }

    const hint = wsCloseHint(ev.code);
    let errorMessage: string | null = null;
    if (ev.code === 4401) {
      errorMessage = "登录已过期，请刷新页面";
    } else if (ev.code === 4429 && reason.includes("taken_over")) {
      errorMessage = "当前调试会话已被新窗口接管";
    } else if (ev.code === 4429 && reason.includes("deny_in_use")) {
      errorMessage = "该会话正在其他窗口调试，请先停止原窗口后重试";
    } else if (ev.code === 4429) {
      errorMessage = "该会话触发互斥策略关闭，请稍后重试";
    } else if (ev.code !== 1000) {
      errorMessage = `连接已关闭（${ev.code}）：${hint || reason || "未知原因"}`;
    }

    onClose({ ignored: false, errorMessage, code: ev.code, reason });
  });
}
