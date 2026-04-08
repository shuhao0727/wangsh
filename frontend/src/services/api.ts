/**
 * API 服务
 * 基于配置的统一 API 调用封装
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { config } from "./config";
import { logger } from "./logger";

let refreshPromise: Promise<void> | null = null;
const ACCESS_TOKEN_KEY = "ws_access_token";
const REFRESH_TOKEN_KEY = "ws_refresh_token";
const REFRESH_ATTEMPT_AT_KEY = "ws_refresh_attempt_at";
const REFRESH_COOLDOWN_MS = 5200;
export const AUTH_EXPIRED_EVENT = "ws:auth-expired";
let lastAuthExpiredNotifyAt = 0;

const notifyAuthExpired = (reason?: string) => {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastAuthExpiredNotifyAt < 3000) return;
  lastAuthExpiredNotifyAt = now;
  const msg = typeof reason === "string" && reason.trim() ? reason.trim() : "登录已过期，请重新登录";
  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail: { reason: msg, at: now },
    }),
  );
};

export const getStoredAccessToken = () => {
  if (typeof window === "undefined") return null;
  try {
    // 跨 tab 刷新 token 以 localStorage 为准，避免旧 sessionStorage 覆盖新令牌
    return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const getStoredRefreshToken = () => {
  if (typeof window === "undefined") return null;
  try {
    // 跨 tab 刷新 token 以 localStorage 为准，避免旧 sessionStorage 覆盖新令牌
    return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
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
) => {
  await waitForRefreshCooldown();
  markRefreshAttemptAt(Date.now());
  return instance.post("/auth/refresh", refreshToken ? { refresh_token: refreshToken } : {}, requestConfig);
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
      }
      if (refreshToken) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch {
    }
  },
  clear() {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
    }
  },
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
      const originalRequest = error.config;
      
      // 防止无限重试
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        if (!isAuthEndpoint(originalRequest.url)) {
          const latestToken = getStoredAccessToken() || getCookieToken();
          const requestToken = readRequestToken(originalRequest);
          // 若该请求携带了旧 token，优先用最新 token 重试一次，减少不必要 refresh
          if (latestToken && latestToken !== requestToken) {
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${latestToken}`;
            return instance(originalRequest);
          }
        }

        const hadAuthContext = Boolean(getStoredAccessToken() || getStoredRefreshToken() || getCookieToken());
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

          if (!refreshPromise) {
            const storedRefreshToken = getStoredRefreshToken();
            refreshPromise = (async () => {
              const applyTokens = (resp: AxiosResponse) => {
                const raw = resp?.data as Record<string, unknown> | null;
                const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as Record<string, string> | null;
                if (data?.access_token || data?.refresh_token) {
                  authTokenStorage.set(data?.access_token ?? null, data?.refresh_token ?? null);
                }
              };

              try {
                const resp = await postRefreshRequest(instance, storedRefreshToken, { silent: true });
                applyTokens(resp);
                return;
              } catch (e: unknown) {
                const status = (e as ApiError)?.response?.status;
                if (status === 401 && storedRefreshToken) {
                  const resp2 = await postRefreshRequest(instance, null, { silent: true });
                  applyTokens(resp2);
                  return;
                }
                // refresh 接口存在 5s 速率限制，跨 tab 并发时先等待再补一次
                if (status === 429) {
                  const latestRefreshToken = getStoredRefreshToken();
                  const resp3 = await postRefreshRequest(instance, latestRefreshToken, { silent: true });
                  applyTokens(resp3);
                  return;
                }
                throw e;
              }
            })().finally(() => {
              refreshPromise = null;
            });
          }
          await refreshPromise;
          logger.debug("✅ API: 会话刷新成功，重试原始请求");
          
          // 更新原始请求的 Token Header
          const newToken = getStoredAccessToken() || getCookieToken();
          if (newToken) {
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          
          return instance(originalRequest);
        } catch (_refreshError) {
          const err = _refreshError as ApiError;
          const detail =
            err?.response?.data && typeof err.response.data === "object"
              ? (err.response.data as Record<string, unknown>)?.detail ||
                (err.response.data as Record<string, unknown>)?.message
              : err?.message;
          logger.debug("⚠️ API: 会话刷新失败", detail);
          if (err?.response?.status === 429) {
            return Promise.reject(error);
          }
          authTokenStorage.clear();
          if (hadAuthContext) {
            notifyAuthExpired(typeof detail === "string" ? detail : undefined);
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
          logger.error("❌ API 错误响应:", {
            url: error.config.url,
            status: error.response.status,
            data: loggedData,
          });
        }
      } else if (error.request) {
        // 请求发送但无响应
        const silent = !!(error.config as InternalAxiosRequestConfig & { silent?: boolean })?.silent;
        if (!silent) logger.error("❌ 网络错误，无响应:", error.request);
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
  login: (username: string, password: string) => {
    const params = new URLSearchParams();
    params.append("username", username);
    params.append("password", password);

    // 使用client直接调用，避免ApiResponse包装
    // 注意：baseURL已经包含/api/v1，这里只需要/auth/login
    return api.client
      .post("/auth/login", params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .then((resp) => {
        const data = resp?.data as Record<string, string> | null;
        if (data?.access_token || data?.refresh_token) {
          authTokenStorage.set(data?.access_token ?? null, data?.refresh_token ?? null);
        }
        return resp;
      });
  },

  // 注册
  register: (userData: Record<string, unknown>) => api.client.post("/auth/register", userData),

  // 获取用户信息 - 后端返回直接用户对象，没有包装
  getCurrentUser: (config?: AxiosRequestConfig) => api.client.get("/auth/me", config),

  // 登出
  logout: () =>
    api.client.post("/auth/logout").finally(() => {
      authTokenStorage.clear();
    }),

  // 刷新令牌
  refreshToken: (refreshToken?: string, requestConfig?: SilentAxiosRequestConfig) => {
    const token = refreshToken || getStoredRefreshToken();
    return postRefreshRequest(api.client, token, requestConfig);
  },

  // 验证令牌
  verifyToken: (token?: string) =>
    api.client.get("/auth/verify", token ? { headers: { Authorization: `Bearer ${token}` } } : undefined),
};

export default api;
