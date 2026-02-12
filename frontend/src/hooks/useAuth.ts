/**
 * 用户认证 Hook
 * 用于管理用户登录状态和权限验证
 * 符合数据库设计文档v3.0，支持统一用户系统
 */

import { useState, useEffect, useCallback, useRef } from "react";
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

const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const initialFetchRef = useRef(false);
  const SESSION_FLAG_KEY = "auth_initial_fetched";

  const getToken = useCallback(() => {
    return null;
  }, []);

  // 获取当前用户信息（增强版，添加调试和错误处理）
  const fetchCurrentUser = useCallback(async () => {
    try {
      logger.debug("fetchCurrentUser: 调用authApi.getCurrentUser()");
      const response = await authApi.getCurrentUser();
      logger.debug("fetchCurrentUser: API响应成功", response);

      // 处理不同的响应格式
      let userData = response.data;
      logger.debug("fetchCurrentUser: 原始响应数据", userData);

      // 检查是否被ApiResponse包装
      if (userData && typeof userData === "object" && "data" in userData) {
        logger.debug("fetchCurrentUser: 检测到ApiResponse包装，解包...");
        userData = userData.data;
      }

      // 验证用户数据格式
      if (!userData || typeof userData !== "object") {
        logger.error("fetchCurrentUser: 用户数据格式无效", userData);
        throw new Error("无效的用户数据格式");
      }

      logger.debug("fetchCurrentUser: 设置用户状态", userData);
      setAuthState({
        user: userData,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return userData;
    } catch (error: any) {
      logger.error("fetchCurrentUser: 获取用户信息失败", error);
      logger.error("fetchCurrentUser: 错误详情", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      // 提取错误信息
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "身份验证失败，请重新登录";

      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      return null;
    }
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
        setAuthState((prev) => ({ ...prev, isLoading: false }));
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
      sessionStorage.removeItem(SESSION_FLAG_KEY);
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
    const alreadyFetched = sessionStorage.getItem(SESSION_FLAG_KEY) === "1";
    if (!initialFetchRef.current) {
      initialFetchRef.current = true;
      if (!authState.user || !authState.isAuthenticated || !alreadyFetched) {
        sessionStorage.setItem(SESSION_FLAG_KEY, "1");
        fetchCurrentUser();
      } else {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    }
  }, [fetchCurrentUser, authState.user, authState.isAuthenticated]);

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

export default useAuth;
