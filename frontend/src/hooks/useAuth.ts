/**
 * 用户认证 Hook
 * 用于管理用户登录状态和权限验证
 * 符合数据库设计文档v3.0，支持统一用户系统
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { authApi } from "@services";
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

let sharedFetchPromise: Promise<User | null> | null = null;

const AuthContext = createContext<ReturnType<typeof createAuthController> | null>(null);

const ACCESS_TOKEN_KEY = "ws_access_token";

const createAuthController = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const initialFetchRef = useRef(false);

  const getToken = useCallback(() => {
    try {
      return sessionStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }, []);

  // 获取当前用户信息（增强版，添加调试和错误处理）
  const fetchCurrentUser = useCallback((): Promise<User | null> => {
    if (sharedFetchPromise) return sharedFetchPromise;

    sharedFetchPromise = (async (): Promise<User | null> => {
      try {
        logger.debug("fetchCurrentUser: 调用authApi.getCurrentUser()");
        const response = await authApi.getCurrentUser();
        logger.debug("fetchCurrentUser: API响应成功", response);

        let userData = response.data;
        logger.debug("fetchCurrentUser: 原始响应数据", userData);

        if (userData && typeof userData === "object" && "data" in userData) {
          logger.debug("fetchCurrentUser: 检测到ApiResponse包装，解包...");
          userData = (userData as any).data;
        }

        if (!userData || typeof userData !== "object") {
          throw new Error("无效的用户数据格式");
        }

        setAuthState({
          user: userData as User,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        return userData as User;
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 401) {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
          return null;
        }

        const errorMessage =
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message ||
          "身份验证失败，请重新登录";

        logger.error("fetchCurrentUser: 获取用户信息失败", error);
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: errorMessage,
        });
        return null;
      } finally {
        sharedFetchPromise = null;
      }
    })();

    return sharedFetchPromise;
  }, []);
  // 登录
  const login = useCallback(
    async (username: string, password: string) => {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        await authApi.login(username, password);
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 8000),
        );
        const user = (await Promise.race([fetchCurrentUser(), timeoutPromise])) as User | null;
        if (!user) {
          const msg = "登录成功但会话未建立，请检查部署域名/Cookie/反向代理配置";
          setAuthState((prev) => ({ ...prev, isLoading: false, error: msg }));
          return { success: false, error: msg };
        }
        setAuthState((prev) => ({ ...prev, isLoading: false, error: null }));
        return { success: true, user };
      } catch (error: any) {
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
      }
    },
    [fetchCurrentUser],
  );

  // 登出
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      logger.error("登出失败:", error);
    } finally {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, []);

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

  // 初始化时获取用户信息
  useEffect(() => {
    if (!initialFetchRef.current) {
      initialFetchRef.current = true;
      fetchCurrentUser();
    }
  }, [fetchCurrentUser]);

  return {
    ...authState,
    login,
    logout,
    fetchCurrentUser,
    getUserRole,
    isSuperAdmin,
    isAdmin,
    isStudent,
    isLoggedIn,
    getDisplayName,
    getToken,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const controller = createAuthController();
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
