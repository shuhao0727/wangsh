/**
 * API 服务
 * 基于配置的统一 API 调用封装
 */

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import { config } from "./config";
import { logger } from "./logger";

// Identity generation fences JS effects, including other tabs. It cannot undo
// HttpOnly Set-Cookie processed by the browser or retract server-side effects.
let authEpoch = 0;
let pendingLoginEpoch: number | null = null;
let refreshPromise: { epoch: number; promise: Promise<void> } | null = null;
type AuthRequestConfig = InternalAxiosRequestConfig & { _authEpoch?: number };
const advanceAuthEpoch = () => {
  authEpoch += 1;
  pendingLoginEpoch = null;
  refreshPromise = null;
  return authEpoch;
};
const assertAuthEpoch = (epoch: number, signal?: AxiosRequestConfig["signal"]) => {
  syncSharedIdentity();
  if (epoch !== authEpoch || signal?.aborted) {
    throw new axios.CanceledError("Authentication identity changed");
  }
};
// Requests issued during login still use the prior identity's credentials.
// Their refresh must not commit tokens or expire/cancel the pending login.
const assertRefreshEpoch = (epoch: number, signal?: AxiosRequestConfig["signal"]) => {
  assertAuthEpoch(epoch, signal);
  if (pendingLoginEpoch === epoch || remoteLoginPending) {
    throw new axios.CanceledError("Authentication login is pending");
  }
};
const ACCESS_TOKEN_KEY = "ws_access_token";
// The marker announces login intent before a new token exists. Read the live
// snapshot at request/response boundaries: storage events can arrive late.
const IDENTITY_KEY = "ws_auth_identity";
const IDENTITY_EVENT = "ws:auth-identity-changed";
const readSharedIdentity = () => {
  try {
    return { marker: localStorage.getItem(IDENTITY_KEY), token: localStorage.getItem(ACCESS_TOKEN_KEY) };
  } catch { return null; }
};
let observedIdentity = readSharedIdentity();
const identityPending = (marker?: string | null) => {
  try { return JSON.parse(marker || "null")?.phase === "pending"; }
  catch { return false; }
};
let remoteLoginPending = identityPending(observedIdentity?.marker);
const syncSharedIdentity = () => {
  const current = readSharedIdentity();
  if (!current || (current.marker === observedIdentity?.marker && current.token === observedIdentity?.token)) return;
  observedIdentity = current;
  advanceAuthEpoch();
  remoteLoginPending = identityPending(current.marker);
  if (remoteLoginPending) pendingLoginEpoch = authEpoch;
  try {
    if (current.token) sessionStorage.setItem(ACCESS_TOKEN_KEY, current.token);
    else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch { /* Storage unavailable: cross-tab coordination is best effort. */ }
  window.dispatchEvent(new CustomEvent(IDENTITY_EVENT, {
    detail: { pending: remoteLoginPending, hasToken: !!current.token },
  }));
};
const publishIdentity = (phase: "pending" | "settled" | "signed-out") => {
  remoteLoginPending = false;
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ id: crypto.randomUUID(), phase }));
  } catch { /* No shared storage means no cross-tab guarantee. */ }
  observedIdentity = readSharedIdentity();
};
export const subscribeAuthIdentityChange = (listener: (identity: { pending: boolean; hasToken: boolean }) => void) => {
  const onIdentity = (event: Event) => listener((event as CustomEvent).detail);
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === localStorage && (!event.key || event.key === ACCESS_TOKEN_KEY || event.key === IDENTITY_KEY)) syncSharedIdentity();
  };
  window.addEventListener(IDENTITY_EVENT, onIdentity);
  window.addEventListener("storage", onStorage);
  syncSharedIdentity();
  // A new tab/reloaded provider did not receive the earlier storage event.
  // Do not bootstrap it from cookies while logout/pending intent is persisted.
  const marker = readSharedIdentity()?.marker;
  let signedOut = false;
  try { signedOut = JSON.parse(marker || "null")?.phase === "signed-out"; } catch { /* Legacy marker. */ }
  if (signedOut || identityPending(marker)) listener({ pending: identityPending(marker), hasToken: false });
  return () => {
    window.removeEventListener(IDENTITY_EVENT, onIdentity);
    window.removeEventListener("storage", onStorage);
  };
};
const REFRESH_ATTEMPT_AT_KEY = "ws_refresh_attempt_at";
const AUTH_EXPIRED_DETAIL_KEY = "ws_auth_expired_detail";
const AUTH_EXPIRED_DETAIL_TTL_MS = 60_000;
const REFRESH_COOLDOWN_MS = 5200;
export const AUTH_EXPIRED_EVENT = "ws:auth-expired";
export type AuthExpiredKind = "expired" | "replaced" | "ip_changed";
export type AuthExpiredDetail = {
  reason: string;
  kind: AuthExpiredKind;
  at: number;
  eventId: string;
};
type AuthExpiredWindow = typeof window & {
  __wsLastAuthExpiredDetail?: AuthExpiredDetail | null;
};
let lastAuthExpiredNotifyAt = 0;
let lastAuthExpiredReason = "";

const classifyAuthExpiredKind = (reason?: string): AuthExpiredKind => {
  const text = String(reason || "").trim();
  if (text.includes("其他地方登录")) return "replaced";
  if (text.includes("环境已变更")) return "ip_changed";
  return "expired";
};

const normalizeAuthExpiredReason = (reason?: string | null) => {
  const text = String(reason || "").trim();
  return text || "登录已过期，请重新登录";
};

const readAuthExpiredDetailFromUnknown = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const text = value.trim();
    return text || undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const direct = [record.detail, record.message, record.reason];
  for (const item of direct) {
    const text = readAuthExpiredDetailFromUnknown(item);
    if (text) return text;
  }
  if ("data" in record) {
    const nested = readAuthExpiredDetailFromUnknown(record.data);
    if (nested) return nested;
  }
  return undefined;
};

export const formatApiErrorLogMessage = (params: {
  method?: unknown;
  url?: unknown;
  status?: unknown;
  data?: unknown;
}): string => {
  const method = String(params.method || "REQUEST").toUpperCase();
  const url = String(params.url || "unknown").split(/[?#]/, 1)[0] || "unknown";
  const status = Number.isFinite(Number(params.status)) ? String(params.status) : "unknown";
  const detail = readAuthExpiredDetailFromUnknown(params.data)?.replace(/\s+/g, " ").trim();
  return `❌ API 错误响应: ${method} ${url} ${status}${detail ? ` - ${detail}` : ""}`;
};

export const extractAuthErrorDetail = (err?: ApiError | unknown): string | undefined => {
  const error = err as ApiError | undefined;
  const responseData = error?.response?.data;
  const direct = readAuthExpiredDetailFromUnknown(responseData);
  if (direct) return direct;
  const userMessage = readAuthExpiredDetailFromUnknown(error?.userMessage);
  if (userMessage) return userMessage;
  const message = readAuthExpiredDetailFromUnknown(error?.message);
  if (message) return message;
  return undefined;
};

const clearStoredAuthExpiredDetail = () => {
  if (typeof window === "undefined") return null;
  try {
    sessionStorage.removeItem(AUTH_EXPIRED_DETAIL_KEY);
    localStorage.removeItem(AUTH_EXPIRED_DETAIL_KEY);
  } catch {
  }
};

const readPersistedAuthExpiredDetail = (): AuthExpiredDetail | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AUTH_EXPIRED_DETAIL_KEY) || localStorage.getItem(AUTH_EXPIRED_DETAIL_KEY) || "";
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<AuthExpiredDetail>;
    const reason = normalizeAuthExpiredReason(parsed?.reason);
    const at = Number(parsed?.at);
    if (!Number.isFinite(at) || Date.now() - at > AUTH_EXPIRED_DETAIL_TTL_MS || Date.now() < at) {
      clearStoredAuthExpiredDetail();
      return null;
    }
    return {
      reason,
      kind: parsed?.kind === "replaced" || parsed?.kind === "ip_changed" ? parsed.kind : "expired",
      at,
      eventId: typeof parsed?.eventId === "string" && parsed.eventId ? parsed.eventId : `legacy:${at}`,
    };
  } catch {
    // Legacy plain-text values have no creation time and can be arbitrarily old.
    clearStoredAuthExpiredDetail();
    return null;
  }
};

export const getPersistedAuthExpiredDetail = (): string | null =>
  readPersistedAuthExpiredDetail()?.reason ?? null;

export const clearPersistedAuthExpiredDetail = () => {
  if (typeof window === "undefined") return;
  clearStoredAuthExpiredDetail();
  try {
    (window as AuthExpiredWindow).__wsLastAuthExpiredDetail = null;
  } catch {
  }
};

export const persistAuthExpiredDetail = (reason?: string) => {
  const msg = normalizeAuthExpiredReason(reason);
  if (typeof window === "undefined") return msg;
  const at = Date.now();
  const detail: AuthExpiredDetail = {
    reason: msg,
    kind: classifyAuthExpiredKind(msg),
    at,
    eventId: `${at}:${Math.random().toString(36).slice(2)}`,
  };
  try {
    // Keep this only for a same-tab reload/redirect. Cross-tab identity is
    // synchronized separately; a permanent localStorage error becomes stale UI.
    sessionStorage.setItem(AUTH_EXPIRED_DETAIL_KEY, JSON.stringify(detail));
    localStorage.removeItem(AUTH_EXPIRED_DETAIL_KEY);
  } catch {
  }
  try {
    (window as AuthExpiredWindow).__wsLastAuthExpiredDetail = detail;
  } catch {
  }
  return msg;
};

export const consumeAuthExpiredDetail = (): AuthExpiredDetail | null => {
  if (typeof window === "undefined") return null;
  const cached = (window as AuthExpiredWindow).__wsLastAuthExpiredDetail;
  const detail = cached && Date.now() >= cached.at && Date.now() - cached.at <= AUTH_EXPIRED_DETAIL_TTL_MS
    ? cached
    : readPersistedAuthExpiredDetail();
  clearPersistedAuthExpiredDetail();
  return detail;
};

export const notifyAuthExpired = (reason?: string) => {
  if (typeof window === "undefined") return;
  const msg = normalizeAuthExpiredReason(reason);
  const now = Date.now();
  if (now - lastAuthExpiredNotifyAt < 3000 && lastAuthExpiredReason === msg) return;
  lastAuthExpiredNotifyAt = now;
  lastAuthExpiredReason = msg;
  persistAuthExpiredDetail(msg);
  const detail = (window as AuthExpiredWindow).__wsLastAuthExpiredDetail || {
    reason: msg,
    kind: classifyAuthExpiredKind(msg),
    at: now,
    eventId: `${now}:fallback`,
  };
  logger.debug("[auth-expired] dispatch", detail);
  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail,
    }),
  );
};

export const getStoredAccessToken = () => {
  if (typeof window === "undefined") return null;
  try {
    syncSharedIdentity();
    // An explicit shared logout must not revive this tab's old session token.
    return localStorage.getItem(ACCESS_TOKEN_KEY) ||
      (localStorage.getItem(IDENTITY_KEY) ? null : sessionStorage.getItem(ACCESS_TOKEN_KEY));
  } catch {
    return null;
  }
};

export const getStoredRefreshToken = () => {
  // 安全迁移：refresh token 不再由 JS 持有，改由后端 HttpOnly cookie 管理。
  // 返回 null → 刷新请求不带 body token，后端自动用 cookie 续期。
  // （遗留的 local/sessionStorage 旧值忽略，避免陈旧 token 绕过 cookie）
  return null;
};

const parseBearerToken = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] || raw).trim() || null;
};

const readRequestToken = (requestConfig?: InternalAxiosRequestConfig | any): string | null => {
  const headers = (requestConfig?.headers || {}) as Record<string, unknown>;
  return parseBearerToken(headers.Authorization ?? headers.authorization);
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const readLastRefreshAttemptAt = () => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(REFRESH_ATTEMPT_AT_KEY) || sessionStorage.getItem(REFRESH_ATTEMPT_AT_KEY) || "";
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
};

const markRefreshAttemptAt = (timestamp: number) => {
  if (typeof window === "undefined") return;
  const value = String(timestamp);
  try {
    sessionStorage.setItem(REFRESH_ATTEMPT_AT_KEY, value);
    localStorage.setItem(REFRESH_ATTEMPT_AT_KEY, value);
  } catch {
  }
};

const waitForRefreshCooldown = async () => {
  const lastAttemptAt = readLastRefreshAttemptAt();
  if (!lastAttemptAt) return;
  const elapsed = Date.now() - lastAttemptAt;
  if (elapsed >= REFRESH_COOLDOWN_MS) return;
  await sleep(REFRESH_COOLDOWN_MS - elapsed);
};

type SilentAxiosRequestConfig = AxiosRequestConfig & { silent?: boolean };

const postRefreshRequest = async (
  instance: AxiosInstance,
  refreshToken?: string | null,
  requestConfig?: SilentAxiosRequestConfig,
  epoch = authEpoch,
) => {
  assertAuthEpoch(epoch, requestConfig?.signal);
  if (remoteLoginPending) throw new axios.CanceledError("Authentication login pending in another tab");
  await waitForRefreshCooldown();
  assertAuthEpoch(epoch, requestConfig?.signal);
  markRefreshAttemptAt(Date.now());
  const response = await instance.post("/auth/refresh", refreshToken ? { refresh_token: refreshToken } : {}, {
    ...requestConfig,
    _authEpoch: epoch,
  } as SilentAxiosRequestConfig);
  // Also guard direct refreshToken consumers that store response tokens themselves.
  assertRefreshEpoch(epoch, requestConfig?.signal);
  return response;
};

export const getCookieToken = () => {
  if (typeof document === "undefined") return null;
  try {
    const raw = document.cookie || "";
    const pairs = raw.split(";").map((s) => s.trim());
    for (const p of pairs) {
      const idx = p.indexOf("=");
      if (idx <= 0) continue;
      const k = p.slice(0, idx);
      const v = p.slice(idx + 1);
      if (k === "ws_access_token" || k === "access_token") {
        return decodeURIComponent(v);
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const authTokenStorage = {
  set(accessToken?: string | null, refreshToken?: string | null) {
    if (typeof window === "undefined") return;
    try {
      if (accessToken) {
        sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        // localStorage 用于跨 tab 共享登录状态（实际认证靠 HttpOnly cookie）
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        observedIdentity = readSharedIdentity();
      }
      // 安全：refresh token 不写入 JS 可读的 storage，交由后端 HttpOnly cookie 管理
      // （cookie 已 httponly=true，XSS 无法读取；避免 refresh token 明文暴露面）
    } catch {
    }
  },
  clear() {
    advanceAuthEpoch();
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
    }
    publishIdentity("signed-out");
  },
};

const extractErrorDetail = (err?: ApiError): unknown => {
  return extractAuthErrorDetail(err);
};

const isAuthEndpoint = (url?: string) => {
  if (!url) return false;
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout")
    // url.includes("/auth/me") // /auth/me 需要认证，不应排除
  );
};

// API 响应接口
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
  timestamp: string;
}

// 扩展 Error，附加 axios 相关字段
interface ApiError extends Error {
  response?: {
    data: unknown;
    status: number;
    statusText: string;
    headers: unknown;
    config: InternalAxiosRequestConfig;
  };
  config?: InternalAxiosRequestConfig;
  request?: unknown;
  userMessage?: string;
}

// 验证错误接口（用于422错误响应）
export interface ValidationErrorResponse {
  detail: Array<{
    type: string;
    loc: (string | number)[];
    msg: string;
    input: unknown;
    ctx?: Record<string, unknown>;
  }>;
}

// 创建 Axios 实例
const createApiClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: config.apiUrl,
    timeout: 15000,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  // 请求拦截器
  instance.interceptors.request.use(
    (requestConfig) => {
      syncSharedIdentity();
      if (remoteLoginPending && !isAuthEndpoint(requestConfig.url)) {
        throw new axios.CanceledError("Authentication login pending in another tab");
      }
      const authRequest = requestConfig as AuthRequestConfig;
      authRequest._authEpoch ??= authEpoch;
      assertAuthEpoch(authRequest._authEpoch, requestConfig.signal);
      const token = getStoredAccessToken() || getCookieToken();
      if (token && !isAuthEndpoint(requestConfig.url)) {
        requestConfig.headers = requestConfig.headers ?? {};
        requestConfig.headers.Authorization = `Bearer ${token}`;
      }
      if (typeof FormData !== "undefined" && requestConfig.data instanceof FormData) {
        requestConfig.headers = requestConfig.headers ?? {};
        delete requestConfig.headers["Content-Type"];
        delete requestConfig.headers["content-type"];
      }
      if (config.features.debug) {
        logger.debug("🚀 API 请求:", {
          url: `${requestConfig.baseURL}${requestConfig.url}`,
          method: requestConfig.method,
          data: requestConfig.data,
        });
      }

      return requestConfig;
    },
    (error) => {
      logger.error("❌ 请求拦截器错误:", error);
      return Promise.reject(error);
    },
  );

  // 响应拦截器
  instance.interceptors.response.use(
    (response: AxiosResponse<ApiResponse | ValidationErrorResponse>) => {
      assertAuthEpoch((response.config as AuthRequestConfig)._authEpoch ?? authEpoch, response.config.signal);
      if (config.features.debug) {
        logger.debug("✅ API 响应:", {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
      }

      // 特别检查：如果是验证错误对象（422错误），则转换为错误
      const data = response.data;
      if (response.status === 422 && data && typeof data === "object") {
        // 检查是否是Pydantic验证错误格式
        const isValidationError =
          (data as ValidationErrorResponse).detail &&
          Array.isArray((data as ValidationErrorResponse).detail) &&
          (data as ValidationErrorResponse).detail.length > 0 &&
          (data as ValidationErrorResponse).detail[0].type &&
          (data as ValidationErrorResponse).detail[0].msg;

        if (isValidationError) {
          logger.error("❌ API 响应中包含验证错误:", data);
          
          // 将 Pydantic 错误数组转换为用户友好的字符串
          const details = (data as ValidationErrorResponse).detail;
          const message = details.map(err => {
            const field = err.loc[err.loc.length - 1];
            // 简单的字段名翻译映射，可以根据需要扩展
            const fieldMap: Record<string, string> = {
              name: '名称',
              agent_type: '智能体类型',
              api_endpoint: 'API 地址',
              api_key: 'API 密钥',
              model_name: '模型名称',
              description: '描述'
            };
            const fieldName = fieldMap[String(field)] || field;
            return `${fieldName}: ${err.msg}`;
          }).join('; ');

          // 创建错误对象
          const error = new Error(message || "请求数据验证失败");
          (error as ApiError).response = {
            data: data,
            status: 422,
            statusText: "Unprocessable Content",
            headers: response.headers,
            config: response.config,
          };
          (error as ApiError).config = response.config;
          (error as ApiError).request = response.request;
          (error as ApiError).userMessage = message;
          return Promise.reject(error);
        }
      }

      // 处理标准 API 响应格式
      if (response.data && typeof response.data === "object") {
        // 可以在这里添加业务逻辑处理
        return response;
      }

      return response;
    },
    async (error) => {
      if (axios.isCancel(error) || error?.code === "ERR_CANCELED") {
        return Promise.reject(error);
      }

      const originalRequest = error.config;
      const requestEpoch = (originalRequest as AuthRequestConfig | undefined)?._authEpoch ?? authEpoch;
      assertAuthEpoch(requestEpoch, originalRequest?.signal);

      // 防止无限重试
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        if (!isAuthEndpoint(originalRequest.url)) {
          const latestToken = getStoredAccessToken() || getCookieToken();
          const requestToken = readRequestToken(originalRequest);
          // 若该请求携带了旧 token，优先用最新 token 重试一次，减少不必要 refresh
          if (latestToken && latestToken !== requestToken) {
            originalRequest._retry = true;
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${latestToken}`;
            return instance(originalRequest);
          }
        }

        const hadAuthContext = Boolean(getStoredAccessToken() || getCookieToken());
        const originalDetail = extractErrorDetail(error as ApiError);
        originalRequest._retry = true;

        // 访客（从未登录过）收到 401 时，直接拒绝，不尝试 refresh
        if (!hadAuthContext) {
          return Promise.reject(error);
        }

        try {
          if (isAuthEndpoint(originalRequest.url)) {
            return Promise.reject(error);
          }
          logger.debug("🔄 API: 检测到401错误，尝试刷新会话");
          if (originalRequest.url?.includes("/auth/refresh")) {
            throw new Error("刷新接口返回401");
          }

          if (!refreshPromise || refreshPromise.epoch !== requestEpoch) {
            const flight = { epoch: requestEpoch, promise: Promise.resolve() };
            flight.promise = (async () => {
              const applyTokens = (resp: AxiosResponse) => {
                assertAuthEpoch(requestEpoch);
                const raw = resp?.data as Record<string, unknown> | null;
                const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as Record<string, string> | null;
                if (data?.access_token || data?.refresh_token) {
                  // Token rotation is not a new identity; same-generation waiters may retry.
                  authTokenStorage.set(data?.access_token ?? null, data?.refresh_token ?? null);
                }
              };

              try {
                // refresh 续期走 HttpOnly cookie：请求不带 body token（getStoredRefreshToken 恒为 null）
                const resp = await postRefreshRequest(instance, null, { silent: true }, requestEpoch);
                applyTokens(resp);
                return;
              } catch (e: unknown) {
                assertRefreshEpoch(requestEpoch);
                const status = (e as ApiError)?.response?.status;
                // refresh 接口存在 5s 速率限制，跨 tab 并发时先等待再补一次
                if (status === 429) {
                  const resp3 = await postRefreshRequest(instance, null, { silent: true }, requestEpoch);
                  applyTokens(resp3);
                  return;
                }
                throw e;
              }
            })().finally(() => {
              if (refreshPromise === flight) refreshPromise = null;
            });
            refreshPromise = flight;
          }
          await refreshPromise.promise;
          assertAuthEpoch(requestEpoch, originalRequest.signal);
          logger.debug("✅ API: 会话刷新成功，重试原始请求");
          
          // 更新原始请求的 Token Header
          const newToken = getStoredAccessToken() || getCookieToken();
          if (newToken) {
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          
          return instance(originalRequest);
        } catch (_refreshError) {
          assertRefreshEpoch(requestEpoch, originalRequest.signal);
          if (axios.isCancel(_refreshError)) return Promise.reject(_refreshError);
          const err = _refreshError as ApiError;
          const detail = extractErrorDetail(err);
          const preferredDetail =
            typeof originalDetail === "string" && originalDetail.trim()
              ? originalDetail.trim()
              : typeof detail === "string"
                ? detail
                : undefined;
          logger.debug("⚠️ API: 会话刷新失败", detail);
          logger.debug("[auth-refresh-failed] preferredDetail", preferredDetail);
          if (err?.response?.status === 429) {
            return Promise.reject(error);
          }
          authTokenStorage.clear();
          if (hadAuthContext) {
            notifyAuthExpired(preferredDetail);
          }
          return Promise.reject(error);
        }
      }

      if (error.response?.status === 401 && originalRequest?._retry) {
        return Promise.reject(error);
      }
      
      // 记录错误
      if (error.response) {
        // 服务器返回错误状态码
        if (error.response.status === 401 && isAuthEndpoint(originalRequest?.url)) {
          return Promise.reject(error);
        }
        let loggedData = error.response.data;
        try {
          if (loggedData instanceof Blob) {
            const text = await loggedData.text();
            try {
              const obj = JSON.parse(text);
              loggedData = obj?.detail ?? obj;
            } catch {
              loggedData = text;
            }
          }
        } catch {
          loggedData = error.response.data;
        }
        const silent = !!(error.config as InternalAxiosRequestConfig & { silent?: boolean })?.silent;
        if (!silent) {
          const method = String(error.config.method || "REQUEST").toUpperCase();
          const url = String(error.config.url || "unknown").split(/[?#]/, 1)[0] || "unknown";
          logger.error(formatApiErrorLogMessage({
            method,
            url,
            status: error.response.status,
            data: loggedData,
          }), {
            method,
            url,
            status: error.response.status,
            data: loggedData,
          });
        }
      } else if (error.request) {
        // 请求发送但无响应
        const silent = !!(error.config as InternalAxiosRequestConfig & { silent?: boolean })?.silent;
        if (!silent) {
          logger.error("❌ 网络错误，无响应:", {
            url: `${error.config?.baseURL || ""}${error.config?.url || ""}`,
            method: error.config?.method,
            timeout: error.config?.timeout,
            message: error.message,
            status: error.request?.status,
          });
        }
      } else {
        // 请求配置错误
        const silent = !!(error.config as InternalAxiosRequestConfig & { silent?: boolean })?.silent;
        if (!silent) logger.error("❌ 请求配置错误:", error.message);
      }

      return Promise.reject(error);
    },
  );

  return instance;
};

// 全局 API 客户端实例
const apiClient = createApiClient();

// 导出常用的 HTTP 方法
export const api = {
  // GET 请求
  get: <T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> =>
    apiClient.get<ApiResponse<T>>(url, config),

  // POST 请求
  post: <T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> =>
    apiClient.post<ApiResponse<T>>(url, data, config),

  // PUT 请求
  put: <T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> =>
    apiClient.put<ApiResponse<T>>(url, data, config),

  // DELETE 请求
  delete: <T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> =>
    apiClient.delete<ApiResponse<T>>(url, config),

  // PATCH 请求
  patch: <T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> =>
    apiClient.patch<ApiResponse<T>>(url, data, config),

  // 原始实例（用于特殊配置）
  client: apiClient,
};

// 健康检查 API - 这些接口在根路径，不在/api/v1下
export const healthApi = {
  check: () => api.client.get("/health"),
  ping: () => api.client.get("/ping"),
  version: () => api.client.get("/version"),
};

// 认证 API
export const authApi = {
  // 登录 - 使用表单格式 (application/x-www-form-urlencoded)
  // 注意：后端auth端点返回直接响应，没有ApiResponse包装
  login: (
    username: string,
    password: string,
    config?: AxiosRequestConfig,
  ) => {
    syncSharedIdentity();
    const loginEpoch = advanceAuthEpoch();
    pendingLoginEpoch = loginEpoch;
    publishIdentity("pending");
    const params = new URLSearchParams();
    params.append("username", username);
    params.append("password", password);

    // 使用client直接调用，避免ApiResponse包装
    // 注意：baseURL已经包含/api/v1，这里只需要/auth/login
    return api.client
      .post("/auth/login", params.toString(), {
        ...config,
        _authEpoch: loginEpoch,
        headers: {
          ...config?.headers,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      } as AxiosRequestConfig)
      .then((resp) => {
        assertAuthEpoch(loginEpoch, config?.signal);
        // Also invalidate work issued while login was pending with the prior token.
        advanceAuthEpoch();
        const data = resp?.data as Record<string, string> | null;
        if (data?.access_token || data?.refresh_token) {
          authTokenStorage.set(data?.access_token ?? null, data?.refresh_token ?? null);
        }
        publishIdentity("settled");
        return resp;
      }).finally(() => {
        // Failure/abort preserves A's tokens but invalidates all work started
        // during this attempt. An older login must not release a newer fence.
        syncSharedIdentity();
        if (authEpoch === loginEpoch) {
          advanceAuthEpoch();
          publishIdentity("settled");
        }
      });
  },

  // 获取用户信息 - 后端返回直接用户对象，没有包装
  getCurrentUser: (config?: AxiosRequestConfig) => api.client.get("/auth/me", config),

  // 登出
  logout: () => {
    // Capture proof before clearing. Never clear in finally: a later login owns
    // its own storage, even when this logout fails (including server 503).
    const token = getStoredAccessToken() || getCookieToken();
    authTokenStorage.clear();
    return api.client.post("/auth/logout", undefined, {
      _authEpoch: authEpoch,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    } as AxiosRequestConfig);
  },

  // 刷新令牌
  refreshToken: (refreshToken?: string, requestConfig?: SilentAxiosRequestConfig) =>
    postRefreshRequest(api.client, refreshToken, requestConfig),
};

export default api;
