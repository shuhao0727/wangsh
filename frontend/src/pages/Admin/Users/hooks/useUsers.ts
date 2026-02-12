/**
 * 用户管理自定义 Hook
 * 连接真实的后端 API，不使用模拟数据
 */

import { useState, useCallback, useEffect } from "react";
import { message } from "antd";
import {
  userApi,
  User,
  UserCreateRequest,
  UserUpdateRequest,
  UserListResponse,
} from "@services";
import { UsersState, UserActions, SearchParams } from "../types";

/**
 * 用户管理 Hook
 * @param initialParams 初始搜索参数
 * @returns 用户状态和操作方法
 */
export const useUsers = (initialParams: SearchParams = {}) => {
  // 状态管理
  const [state, setState] = useState<UsersState>({
    users: [],
    total: 0,
    loading: false,
    currentPage: 1,
    pageSize: initialParams.limit || 20,
    searchKeyword: initialParams.search || "",
    selectedRowKeys: [],
    formVisible: false,
    editingUser: null,
    detailVisible: false,
    currentUser: null,
  });

  // 搜索参数
  const [searchParams, setSearchParams] = useState<SearchParams>({
    skip: initialParams.skip || 0,
    limit: initialParams.limit || 20,
    search: initialParams.search || "",
    role_code: initialParams.role_code,
    is_active: initialParams.is_active,
  });

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));

      const params = {
        skip: (state.currentPage - 1) * state.pageSize,
        limit: state.pageSize,
        search: state.searchKeyword.trim() || undefined,
        role_code: searchParams.role_code,
        is_active: searchParams.is_active,
      };

      const response = (await userApi.getUsers(
        params,
      )) as any as UserListResponse;

      setState((prev) => ({
        ...prev,
        users: response.users,
        total: response.total,
        loading: false,
      }));

      // 更新搜索参数
      setSearchParams((prev) => ({
        ...prev,
        skip: response.skip,
        limit: response.limit,
      }));
    } catch (error) {
      console.error("加载用户列表失败:", error);
      message.error("加载用户列表失败");
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [
    state.currentPage,
    state.pageSize,
    state.searchKeyword,
    searchParams.role_code,
    searchParams.is_active,
  ]);

  // 处理搜索
  const handleSearch = useCallback((value: string) => {
    setState((prev) => ({
      ...prev,
      searchKeyword: value,
      currentPage: 1,
    }));
  }, []);

  // 处理重置
  const handleReset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      searchKeyword: "",
      currentPage: 1,
      selectedRowKeys: [],
    }));
    setSearchParams((prev) => ({
      ...prev,
      search: "",
      role_code: undefined,
      is_active: undefined,
    }));
  }, []);

  // 处理分页变化
  const handlePageChange = useCallback((page: number, size?: number) => {
    setState((prev) => ({
      ...prev,
      currentPage: page,
      pageSize: size || prev.pageSize,
      selectedRowKeys: [],
    }));
  }, []);

  // 处理添加用户
  const handleAddUser = useCallback(() => {
    setState((prev) => ({
      ...prev,
      editingUser: null,
      formVisible: true,
    }));
  }, []);

  // 处理编辑用户
  const handleEdit = useCallback((record: User) => {
    setState((prev) => ({
      ...prev,
      editingUser: record,
      formVisible: true,
    }));
  }, []);

  // 处理删除用户
  const handleDelete = useCallback(
    async (id: number) => {
      try {
        setState((prev) => ({ ...prev, loading: true }));

        await userApi.deleteUser(id);

        // 重新加载用户列表
        await loadUsers();

        message.success("用户删除成功");
      } catch (error) {
        console.error("删除用户失败:", error);
        message.error("删除用户失败");
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [loadUsers],
  );

  // 处理表单提交
  const handleFormSubmit = useCallback(
    async (values: any) => {
      try {
        setState((prev) => ({ ...prev, loading: true }));

        if (state.editingUser) {
          // 更新用户
          const updateData: UserUpdateRequest = {
            student_id: values.student_id,
            full_name: values.full_name,
            class_name: values.class_name,
            study_year: values.study_year,
            role_code: values.role_code || state.editingUser.role_code,
            is_active: values.is_active,
          };

          await userApi.updateUser(state.editingUser.id, updateData);
          message.success("用户信息更新成功");
        } else {
          // 创建新用户
          const createData: UserCreateRequest = {
            student_id: values.student_id,
            username: values.username,
            full_name: values.full_name,
            class_name: values.class_name,
            study_year: values.study_year,
            role_code: values.role_code || "student",
            is_active: values.is_active ?? true,
          };

          await userApi.createUser(createData);
          message.success("用户添加成功");
        }

        // 关闭表单并重新加载数据
        setState((prev) => ({
          ...prev,
          formVisible: false,
          editingUser: null,
        }));
        await loadUsers();
      } catch (error: any) {
        console.error("保存用户信息失败:", error);

        // 显示具体的错误信息
        if (error.response?.data?.detail) {
          message.error(error.response.data.detail);
        } else if (error.message) {
          message.error(error.message);
        } else {
          message.error("保存用户信息失败");
        }

        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [state.editingUser, loadUsers],
  );

  // 处理查看详情
  const handleView = useCallback((record: User) => {
    setState((prev) => ({
      ...prev,
      currentUser: record,
      detailVisible: true,
    }));
  }, []);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (state.selectedRowKeys.length === 0) {
      message.warning("请选择要删除的用户");
      return;
    }

    try {
      setState((prev) => ({ ...prev, loading: true }));

      // 这里假设后端支持批量删除，如果不行就单个删除
      const deletePromises = state.selectedRowKeys.map((id) =>
        userApi.deleteUser(id as number),
      );

      await Promise.all(deletePromises);

      // 重新加载用户列表
      await loadUsers();

      setState((prev) => ({
        ...prev,
        selectedRowKeys: [],
      }));

      message.success(`成功删除 ${state.selectedRowKeys.length} 个用户`);
    } catch (error) {
      console.error("批量删除失败:", error);
      message.error("批量删除失败");
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [state.selectedRowKeys, loadUsers]);

  // 处理下载模板
  const handleDownloadTemplate = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));

      // 创建完整的CSV模板内容，包含示例数据和说明
      const templateContent = `学号,姓名,学年,班级,状态,用户名
# 注意：只能导入学生用户，不允许导入管理员
# 状态：true=激活，false=未激活（可选，默认为true）
# 用户名：可选字段，如果不填将使用学号作为登录账号
# 示例数据：
20230001,张三,2025,高一(1)班,true,zhangsan
20230002,李四,2025,高一(2)班,true,lisi
20230003,王五,2025,高一(3)班,false,wangwu
20230004,赵六,2025,高一(1)班,true,`;
      const blob = new Blob([templateContent], {
        type: "text/csv;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "user_import_template.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success("模板下载成功，请按照模板格式填写数据");
    } catch (error) {
      console.error("下载模板失败:", error);
      message.error("下载模板失败");
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  // 处理文件上传
  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        setState((prev) => ({ ...prev, loading: true }));

        // 调用真实的后端导入API
        const result = await userApi.importUsers(file);
        
        if (result.success) {
          // 显示详细的导入结果
          const successMessage = result.message || `导入完成。成功导入: ${result.imported_count}, 更新: ${result.updated_count}, 失败: ${result.error_count}`;
          
          if (result.error_count > 0) {
            // 如果有错误，显示警告消息
            message.warning(successMessage);
            
            // 可以在这里添加错误详情显示逻辑
            if (result.errors.length > 0) {
              console.warn("导入错误详情:", result.errors);
              // 可以在这里将错误详情存储到状态中，以便在UI中显示
            }
          } else {
            message.success(successMessage);
          }
        } else {
          // 导入失败
          message.error(result.message || "文件上传失败");
        }
        
        await loadUsers(); // 重新加载用户列表
        return false; // 阻止默认上传行为
      } catch (error: any) {
        console.error("文件上传失败:", error);
        
        // 显示具体的错误信息
        if (error.response?.data?.detail) {
          message.error(`文件上传失败: ${error.response.data.detail}`);
        } else if (error.message) {
          message.error(`文件上传失败: ${error.message}`);
        } else {
          message.error("文件上传失败");
        }
        
        return false;
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [loadUsers],
  );

  // 处理角色过滤
  const handleRoleFilter = useCallback((roleCode: string | undefined) => {
    setSearchParams((prev) => ({
      ...prev,
      role_code: roleCode,
    }));
    setState((prev) => ({
      ...prev,
      currentPage: 1,
    }));
  }, []);

  // 处理状态过滤
  const handleStatusFilter = useCallback((isActive: boolean | undefined) => {
    setSearchParams((prev) => ({
      ...prev,
      is_active: isActive,
    }));
    setState((prev) => ({
      ...prev,
      currentPage: 1,
    }));
  }, []);

  // 设置选中的行
  const setSelectedRowKeys = useCallback((keys: React.Key[]) => {
    setState((prev) => ({
      ...prev,
      selectedRowKeys: keys,
    }));
  }, []);

  // 关闭表单
  const closeForm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      formVisible: false,
      editingUser: null,
    }));
  }, []);

  // 关闭详情弹窗
  const closeDetail = useCallback(() => {
    setState((prev) => ({
      ...prev,
      detailVisible: false,
      currentUser: null,
    }));
  }, []);

  // 初始加载
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 操作方法集合
  const actions: UserActions = {
    loadUsers,
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
