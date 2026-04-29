/**
 * 用户管理自定义 Hook
 * 使用 TanStack Query 进行数据获取和缓存管理
 */

import { showMessage } from "@/lib/toast";
import { useState, useCallback, useMemo } from "react";
import {
  userApi,
  type User,
  type UserCreateRequest,
  type UserUpdateRequest,
} from "@services";
import { logger } from "@services/logger";
import type { UsersState, UserActions, SearchParams } from "../types";
import { useAdminSSE } from "@hooks/useAdminSSE";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUsersList,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useBatchDeleteUsers,
  useImportUsers,
} from "@hooks/queries/useUsersQuery";

/**
 * 用户管理 Hook
 * @param initialParams 初始搜索参数
 * @returns 用户状态和操作方法
 */
export const useUsers = (initialParams: SearchParams = {}) => {
  const queryClient = useQueryClient();

  // ── UI state ────────────────────────────────────────────
  const [searchKeyword, setSearchKeyword] = useState(
    initialParams.search || "",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialParams.limit || 20);
  const [selectedRowKeys, setSelectedRowKeysState] = useState<number[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | undefined>(
    initialParams.role_code,
  );
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(
    initialParams.is_active,
  );

  // ── Derived query params ────────────────────────────────
  const queryParams = useMemo(
    () => ({
      skip: (currentPage - 1) * pageSize,
      limit: pageSize,
      search: searchKeyword.trim() || undefined,
      role_code: roleFilter,
      is_active: statusFilter,
    }),
    [currentPage, pageSize, searchKeyword, roleFilter, statusFilter],
  );

  // ── TanStack Query hooks ────────────────────────────────
  const { data, isLoading, isFetching } = useUsersList(queryParams);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const batchDeleteMutation = useBatchDeleteUsers();
  const importMutation = useImportUsers();

  // ── Derived data ────────────────────────────────────────
  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    batchDeleteMutation.isPending ||
    importMutation.isPending;
  const loading = isLoading || isFetching || isMutating;

  // ── Actions ─────────────────────────────────────────────

  const handleSearch = useCallback((value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1);
  }, []);

  const handleReset = useCallback(() => {
    setSearchKeyword("");
    setCurrentPage(1);
    setSelectedRowKeysState([]);
    setRoleFilter(undefined);
    setStatusFilter(undefined);
  }, []);

  const handlePageChange = useCallback((page: number, size?: number) => {
    setCurrentPage(page);
    if (size !== undefined) setPageSize(size);
    setSelectedRowKeysState([]);
  }, []);

  const handleAddUser = useCallback(() => {
    setEditingUser(null);
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((record: User) => {
    setEditingUser(record);
    setFormVisible(true);
  }, []);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteMutation.mutateAsync(id);
        showMessage.success("用户删除成功");
      } catch (error) {
        logger.error("删除用户失败:", error);
        showMessage.error("删除用户失败");
      }
    },
    [deleteMutation],
  );

  const handleFormSubmit = useCallback(
    async (values: any) => {
      try {
        if (editingUser) {
          const updateData: UserUpdateRequest = {
            student_id: values.student_id,
            full_name: values.full_name,
            class_name: values.class_name,
            study_year: values.study_year,
            role_code: values.role_code || editingUser.role_code,
            is_active: values.is_active,
          };
          await updateMutation.mutateAsync({
            id: editingUser.id,
            data: updateData,
          });
          showMessage.success("用户信息更新成功");
        } else {
          const createData: UserCreateRequest = {
            student_id: values.student_id,
            username: values.username,
            full_name: values.full_name,
            class_name: values.class_name,
            study_year: values.study_year,
            role_code: values.role_code || "student",
            is_active: values.is_active ?? true,
          };
          await createMutation.mutateAsync(createData);
          showMessage.success("用户添加成功");
        }
        setFormVisible(false);
        setEditingUser(null);
      } catch (error: any) {
        logger.error("保存用户信息失败:", error);
        if (error.response?.data?.detail) {
          showMessage.error(error.response.data.detail);
        } else if (error.message) {
          showMessage.error(error.message);
        } else {
          showMessage.error("保存用户信息失败");
        }
      }
    },
    [editingUser, createMutation, updateMutation],
  );

  const handleView = useCallback((record: User) => {
    setCurrentUser(record);
    setDetailVisible(true);
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      showMessage.warning("请选择要删除的用户");
      return;
    }
    const count = selectedRowKeys.length;
    try {
      await batchDeleteMutation.mutateAsync(selectedRowKeys);
      setSelectedRowKeysState([]);
      showMessage.success(`成功删除 ${count} 个用户`);
    } catch (error) {
      logger.error("批量删除失败:", error);
      showMessage.error("批量删除失败");
    }
  }, [selectedRowKeys, batchDeleteMutation]);

  const handleDownloadTemplate = useCallback(
    async (format: "xlsx" | "csv" = "xlsx") => {
      try {
        const blob = await userApi.downloadImportTemplate(format);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `user_import_template.${format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showMessage.success(
          `模板下载成功（${format.toUpperCase()}），请按照模板格式填写数据`,
        );
      } catch (error) {
        logger.error("下载模板失败:", error);
        showMessage.error("下载模板失败");
      }
    },
    [],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        const result = await importMutation.mutateAsync(file);
        if (result.success) {
          const successMessage =
            result.message ||
            `导入完成。成功导入: ${result.imported_count}, 更新: ${result.updated_count}, 失败: ${result.error_count}`;
          if (result.error_count > 0) {
            showMessage.warning(successMessage);
            if (result.errors.length > 0) {
              logger.warn("导入错误详情:", result.errors);
            }
          } else {
            showMessage.success(successMessage);
          }
        } else {
          showMessage.error(result.message || "文件上传失败");
        }
        return false;
      } catch (error: any) {
        logger.error("文件上传失败:", error);
        if (error.response?.data?.detail) {
          showMessage.error(`文件上传失败: ${error.response.data.detail}`);
        } else if (error.message) {
          showMessage.error(`文件上传失败: ${error.message}`);
        } else {
          showMessage.error("文件上传失败");
        }
        return false;
      }
    },
    [importMutation],
  );

  const handleRoleFilter = useCallback((roleCode: string | undefined) => {
    setRoleFilter(roleCode);
    setCurrentPage(1);
  }, []);

  const handleStatusFilter = useCallback((isActive: boolean | undefined) => {
    setStatusFilter(isActive);
    setCurrentPage(1);
  }, []);

  const setSelectedRowKeys = useCallback((keys: number[]) => {
    setSelectedRowKeysState(keys);
  }, []);

  const closeForm = useCallback(() => {
    setFormVisible(false);
    setEditingUser(null);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailVisible(false);
    setCurrentUser(null);
  }, []);

  // ── SSE: invalidate cache on user_changed events ────────
  useAdminSSE("user_changed", () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
  });

  // ── State object (UsersState interface) ─────────────────
  const state: UsersState = {
    users,
    total,
    loading,
    currentPage,
    pageSize,
    searchKeyword,
    selectedRowKeys,
    formVisible,
    editingUser,
    detailVisible,
    currentUser,
    roleFilter,
    statusFilter,
  };

  // ── Actions object (UserActions interface) ──────────────
  const actions: UserActions = {
    loadUsers: async () => {
      // Kept for interface compatibility; TanStack Query handles auto-refetch
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    handleSearch,
    handleReset,
    handlePageChange,
    handleAddUser,
    handleEdit,
    handleDelete,
    handleFormSubmit,
    handleView,
    handleBatchDelete,
    handleDownloadTemplate,
    handleFileUpload,
    setSelectedRowKeys,
    handleRoleFilter,
    handleStatusFilter,
  };

  return {
    state,
    actions,
    closeForm,
    closeDetail,
  };
};
