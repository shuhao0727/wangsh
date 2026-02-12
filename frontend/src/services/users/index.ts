/**
 * 用户管理服务模块
 * 与后端 sys_users 表 API 交互
 */

import { api } from "../api";

// 用户数据类型（与后端 UserResponse 匹配）
export interface User {
  id: number;
  student_id: string | null;
  username: string | null;
  full_name: string;
  class_name: string | null;
  study_year: string | null;
  role_code: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// 用户创建请求类型
export interface UserCreateRequest {
  student_id?: string;
  username?: string;
  full_name: string;
  class_name?: string;
  study_year?: string;
  role_code?: string;
  is_active?: boolean;
}

// 用户更新请求类型
export interface UserUpdateRequest {
  student_id?: string | null;
  username?: string | null;
  full_name?: string;
  class_name?: string | null;
  study_year?: string | null;
  role_code?: string;
  is_active?: boolean;
}

// 用户列表响应类型
export interface UserListResponse {
  users: User[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

// 批量删除请求类型
export interface BatchDeleteRequest {
  user_ids: number[];
}

// 批量删除响应类型
export interface BatchDeleteResponse {
  success: boolean;
  message: string;
  deleted_ids: number[];
}

// 单行导入响应类型
export interface ImportUserResponse {
  row_number: number;
  student_id: string | null;
  full_name: string;
  status: string;  // success, error
  message: string | null;
  user_id: number | null;
}

// 用户导入结果类型
export interface UserImportResult {
  success: boolean;
  message: string;
  total_rows: number;
  imported_count: number;
  updated_count: number;
  error_count: number;
  errors: ImportUserResponse[];
}

// 用户管理 API 服务
export const userApi = {
  /**
   * 获取用户列表（需要管理员权限）
   * @param params 查询参数
   */
  getUsers: async (
    params?: {
      skip?: number;
      limit?: number;
      search?: string;
      role_code?: string;
      is_active?: boolean;
    },
    config?: any,
  ) => {
    try {
      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (params?.skip !== undefined)
        queryParams.append("skip", params.skip.toString());
      if (params?.limit !== undefined)
        queryParams.append("limit", params.limit.toString());
      if (params?.search) queryParams.append("search", params.search);
      if (params?.role_code) queryParams.append("role_code", params.role_code);
      if (params?.is_active !== undefined)
        queryParams.append("is_active", params.is_active.toString());

      const url = `/users/?${queryParams.toString()}`;
      const response = await api.client.get<UserListResponse>(url, config);
      // 后端直接返回 UserListResponse，而不是包装在 ApiResponse 中
      return response.data;
    } catch (error) {
      console.error("获取用户列表失败:", error);
      throw error;
    }
  },

  /**
   * 获取用户详情（需要管理员权限）
   * @param userId 用户ID
   */
  getUserById: async (userId: number, config?: any) => {
    try {
      const response = await api.client.get<User>(`/users/${userId}`, config);
      return response.data;
    } catch (error) {
      console.error(`获取用户详情失败 (ID: ${userId}):`, error);
      throw error;
    }
  },

  /**
   * 创建新用户（需要管理员权限）
   * @param userData 用户数据
   */
  createUser: async (userData: UserCreateRequest, config?: any) => {
    try {
      const response = await api.client.post<User>("/users/", userData, config);
      return response.data;
    } catch (error) {
      console.error("创建用户失败:", error);
      throw error;
    }
  },

  /**
   * 更新用户信息（需要管理员权限）
   * @param userId 用户ID
   * @param userData 更新数据
   */
  updateUser: async (
    userId: number,
    userData: UserUpdateRequest,
    config?: any,
  ) => {
    try {
      const response = await api.client.put<User>(
        `/users/${userId}`,
        userData,
        config,
      );
      return response.data;
    } catch (error) {
      console.error(`更新用户失败 (ID: ${userId}):`, error);
      throw error;
    }
  },

  /**
   * 删除用户（软删除，需要管理员权限）
   * @param userId 用户ID
   */
  deleteUser: async (userId: number, config?: any) => {
    try {
      const response = await api.client.delete(`/users/${userId}`, config);
      return response.data;
    } catch (error) {
      console.error(`删除用户失败 (ID: ${userId}):`, error);
      throw error;
    }
  },

  /**
   * 批量删除用户（软删除，需要管理员权限）
   * @param userIds 用户ID列表
   */
  batchDeleteUsers: async (userIds: number[], config?: any) => {
    try {
      const response = await api.client.post<BatchDeleteResponse>(
        "/users/batch-delete",
        { user_ids: userIds },
        config,
      );
      return response.data;
    } catch (error) {
      console.error("批量删除用户失败:", error);
      throw error;
    }
  },

  /**
   * 批量导入用户（CSV格式，需要管理员权限）
   * @param file CSV文件
   */
  importUsers: async (file: File, config?: any) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await api.client.post<UserImportResult>(
        "/users/import",
        formData,
        {
          ...config,
          headers: {
            ...config?.headers,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("导入用户失败:", error);
      throw error;
    }
  },
};

// 默认导出
export default userApi;
