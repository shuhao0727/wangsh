/**
 * 用户认证 Hook
 * 用于管理用户登录状态和权限验证
 * 符合数据库设计文档v3.0，支持统一用户系统
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { authApi } from "@services";
import {
  AUTH_EXPIRED_EVENT,
  clearPersistedAuthExpiredDetail,
  extractAuthErrorDetail,
  getPersistedAuthExpiredDetail,
  getStoredAccessToken,
  getCookieToken,
  notifyAuthExpired,
} from "@services/api";
import { logger } from "@services/logger";

export interface User {
  id: number;
  role_code: string; // 'super_admin', 'admin', 'student', 'guest'
  username?: string | null;
  student_id?: string | null;
  full_name: string;
  class_name?: string | null;
  study_year?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const raceWithTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      onTimeout();
      resolve(null);
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

type AuthRequest = {
  epoch: number;
  controller: AbortController;
  signal: AbortSignal;
};

export class AuthRequestGate {
  private epoch = 0;
  private controller: AbortController | null = null;

  begin(): AuthRequest {
    this.controller?.abort();
    const controller = new AbortController();
    const request = {
      epoch: this.epoch + 1,
      controller,
      signal: controller.signal,
    };
    this.epoch = request.epoch;
    this.controller = controller;
    return request;
  }

  cancel() {
    this.epoch += 1;
    this.controller?.abort();
    this.controller = null;
  }

  isCurrent(request: AuthRequest) {
    return request.epoch === this.epoch && !request.signal.aborted;
  }

  release(request: AuthRequest) {
    if (this.controller === request.controller) {
      this.controller = null;
    }
  }
}

const AuthContext = createContext<ReturnType<typeof useAuthController> | null>(null);

const useAuthController = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const initialFetchRef = useRef(false);
  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const authRequestGateRef = useRef(new AuthRequestGate());

  const cancelCurrentRequest = useCallback(() => {
    requestSeqRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  }, []);

  const getToken = useCallback(() => {
    return getStoredAccessToken() || getCookieToken();
  }, []);

  // 获取当前用户信息（增强版，添加调试和错误处理）
  const fetchCurrentUser = useCallback((): Promise<User | null> => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const isCurrent = () =>
      mountedRef.current &&
      requestSeqRef.current === requestSeq &&
      !controller.signal.aborted;

    return (async (): Promise<User | null> => {
      try {
        logger.debug("fetchCurrentUser: 调用authApi.getCurrentUser()");
        const response = await authApi.getCurrentUser({
          silent: true,
          timeout: 8000,
          signal: controller.signal,
        } as import("axios").AxiosRequestConfig & { silent?: boolean });
        logger.debug("fetchCurrentUser: API响应成功", response);

        let userData = response.data;
        logger.debug("fetchCurrentUser: 原始响应数据", userData);

        if (userData && typeof userData === "object" && "data" in userData) {
          logger.debug("fetchCurrentUser: 检测到ApiResponse包装，解包...");
          userData = (userData as { data: User }).data;
        }

        if (!userData || typeof userData !== "object") {
          throw new Error("无效的用户数据格式");
        }

        if (isCurrent()) {
          setAuthState({
            user: userData as User,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        }

        return isCurrent() ? userData as User : null;
      } catch (error: any) {
        if (!isCurrent() || error?.code === "ERR_CANCELED") return null;
        const status = error?.response?.status;
        const hadStoredToken = Boolean(getStoredAccessToken() || getCookieToken());
        const responseDetail = extractAuthErrorDetail(error) || "";
        if (status === 401) {
          const resolvedDetail = responseDetail || (hadStoredToken ? "登录已过期，请重新登录" : "");
          if (hadStoredToken && resolvedDetail) {
            notifyAuthExpired(resolvedDetail);
          }
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: resolvedDetail || getPersistedAuthExpiredDetail(),
          });
          return null;
        }

        const errorMessage =
          responseDetail ||
          error.message ||
          "身份验证失败，请重新登录";

        const hasResponse = !!error?.response;
        const hasRequest = !!error?.request;
        const isTimeout = String(error?.code || "").toUpperCase() === "ECONNABORTED" || String(error?.message || "").includes("timeout");
        if (hasResponse) logger.error("fetchCurrentUser: 获取用户信息失败", error);
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: hasRequest || isTimeout ? null : errorMessage,
        });
        return null;
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
      }
    })();
  }, []);
  // 登录
  const login = useCallback(
    async (username: string, password: string) => {
      const request = authRequestGateRef.current.begin();
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        await authApi.login(username, password, { signal: request.signal });
        if (!authRequestGateRef.current.isCurrent(request)) {
          return { success: false, error: "登录已取消" };
        }
        clearPersistedAuthExpiredDetail();
        const user = await raceWithTimeout(
          fetchCurrentUser(),
          8000,
          cancelCurrentRequest,
        );
        if (!authRequestGateRef.current.isCurrent(request)) {
          return { success: false, error: "登录已取消" };
        }
        if (!user) {
          const msg = "登录成功但会话未建立，请检查部署域名/Cookie/反向代理配置";
          setAuthState((prev) => ({ ...prev, isLoading: false, error: msg }));
          return { success: false, error: msg };
        }
        setAuthState((prev) => ({ ...prev, isLoading: false, error: null }));
        return { success: true, user };
      } catch (error: any) {
        if (
          !authRequestGateRef.current.isCurrent(request) ||
          error?.code === "ERR_CANCELED"
        ) {
          return { success: false, error: "登录已取消" };
        }
        const errorMessage =
          error.response?.data?.detail ||
          error.response?.data?.message ||
          "登录失败";
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        return { success: false, error: errorMessage };
      } finally {
        authRequestGateRef.current.release(request);
      }
    },
    [cancelCurrentRequest, fetchCurrentUser],
  );

  // 登出
  const logout = useCallback(async () => {
    authRequestGateRef.current.cancel();
    cancelCurrentRequest();
    try {
      await authApi.logout();
    } catch (error) {
      logger.error("登出失败:", error);
    } finally {
      clearPersistedAuthExpiredDetail();
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, [cancelCurrentRequest]);

  // 获取用户角色
  const getUserRole = useCallback(() => {
    return authState.user?.role_code || "guest";
  }, [authState.user]);

  // 检查用户是否是超级管理员
  const isSuperAdmin = useCallback(() => {
    return getUserRole() === "super_admin";
  }, [getUserRole]);

  // 检查用户是否是管理员（包括超级管理员）
  const isAdmin = useCallback(() => {
    const role = getUserRole();
    return role === "admin" || role === "super_admin";
  }, [getUserRole]);

  // 检查用户是否是教师
  const isTeacher = useCallback(() => {
    return getUserRole() === "teacher";
  }, [getUserRole]);

  // 检查用户是否是教职工（教师/管理员/超级管理员均可）
  const isStaff = useCallback(() => {
    const role = getUserRole();
    return role === "teacher" || role === "admin" || role === "super_admin";
  }, [getUserRole]);

  // 检查用户是否是学生
  const isStudent = useCallback(() => {
    return getUserRole() === "student";
  }, [getUserRole]);

  // 检查用户是否已登录
  const isLoggedIn = useCallback(() => {
    return authState.isAuthenticated && authState.user !== null;
  }, [authState.isAuthenticated, authState.user]);

  // 获取显示名称
  const getDisplayName = useCallback(() => {
    if (!authState.user) return "";

    if (authState.user.role_code === "student") {
      return authState.user.full_name || "";
    } else {
      return authState.user.username || authState.user.full_name || "";
    }
  }, [authState.user]);

  // 初始化时获取用户信息（仅在有 token 时才请求，避免访客触发无谓 401）
  useEffect(() => {
    if (!initialFetchRef.current) {
      initialFetchRef.current = true;
      const token = getStoredAccessToken() || getCookieToken();
      try {
        const target = window as typeof window & { __wsInitialAuthToken?: string | null };
        target.__wsInitialAuthToken = token;
      } catch {
      }
      const currentPath =
        typeof window !== "undefined" ? window.location.pathname : "";
      const shouldProbeSession =
        currentPath.startsWith("/admin") ||
        currentPath.startsWith("/task-analysis");
      // 新标签打开后台时可能只有 HttpOnly Cookie、没有可读 token；
      // 对受保护路径额外探测一次 /auth/me 以恢复会话。
      if (token || shouldProbeSession) {
        void raceWithTimeout(
          fetchCurrentUser(),
          8000,
          cancelCurrentRequest,
        ).then((user) => {
          if (!user && mountedRef.current) {
            setAuthState((prev) =>
              prev.isLoading ? { ...prev, isLoading: false } : prev,
            );
          }
        });
      } else {
        // 无 token，直接设为未登录状态，不发请求
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: getPersistedAuthExpiredDetail(),
        });
      }
    }
  }, [cancelCurrentRequest, fetchCurrentUser]);

  useEffect(() => {
    const authRequestGate = authRequestGateRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      initialFetchRef.current = false;
      authRequestGate.cancel();
      cancelCurrentRequest();
    };
  }, [cancelCurrentRequest]);

  // 统一处理全局会话过期事件（由 API 层在 refresh 失败时触发）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onAuthExpired = (event: Event) => {
      authRequestGateRef.current.cancel();
      cancelCurrentRequest();
      const detail = (event as CustomEvent<{ reason?: string; kind?: string }>).detail;
      const reason =
        typeof detail?.reason === "string" && detail.reason.trim()
          ? detail.reason.trim()
          : getPersistedAuthExpiredDetail() || "登录已过期，请重新登录";
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: reason,
      });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired as EventListener);

    const cachedDetail = (
      window as typeof window & {
        __wsLastAuthExpiredDetail?: { reason?: string } | null;
      }
    ).__wsLastAuthExpiredDetail;
    if (cachedDetail?.reason) {
      onAuthExpired(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: cachedDetail }));
    }

    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired as EventListener);
  }, [cancelCurrentRequest]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const target = window as typeof window & {
        __wsAuthStateTrace?: Array<Record<string, unknown>>;
      };
      target.__wsAuthStateTrace = (target.__wsAuthStateTrace || []).slice(-20);
      target.__wsAuthStateTrace.push({
        at: Date.now(),
        isAuthenticated: authState.isAuthenticated,
        isLoading: authState.isLoading,
        userId: authState.user?.id ?? null,
        userName: authState.user?.full_name ?? authState.user?.username ?? null,
        error: authState.error ?? null,
      });
    } catch {
    }
  }, [authState]);

  return {
    ...authState,
    login,
    logout,
    fetchCurrentUser,
    getUserRole,
    isSuperAdmin,
    isAdmin,
    isTeacher,
    isStaff,
    isStudent,
    isLoggedIn,
    getDisplayName,
    getToken,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const controller = useAuthController();
  return React.createElement(AuthContext.Provider, { value: controller }, children);
};

const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
};

export default useAuth;
