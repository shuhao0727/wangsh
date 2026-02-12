/**
 * 用户管理相关类型定义
 */

import { User } from "@services";

// 用户表单组件 props
export interface UserFormProps {
  visible: boolean;
  editingUser: User | null;
  onSubmit: (values: any) => void;
  onCancel: () => void;
}

// 用户详情弹窗 props
export interface UserDetailModalProps {
  visible: boolean;
  currentUser: User | null;
  onCancel: () => void;
  onEdit: (user: User) => void;
}

// 表格列配置 props
export interface ColumnConfigProps {
  handleEdit: (record: User) => void;
  handleDelete: (id: number) => void;
  handleView: (record: User) => void;
}

// 搜索和过滤参数
export interface SearchParams {
  search?: string;
  role_code?: string;
  is_active?: boolean;
  skip?: number;
  limit?: number;
}

// 用户管理状态
export interface UsersState {
  users: User[];
  total: number;
  loading: boolean;
  currentPage: number;
  pageSize: number;
  searchKeyword: string;
  selectedRowKeys: React.Key[];
  formVisible: boolean;
  editingUser: User | null;
  detailVisible: boolean;
  currentUser: User | null;
}

// 用户操作函数
export interface UserActions {
  loadUsers: () => Promise<void>;
  handleSearch: (value: string) => void;
  handleReset: () => void;
  handlePageChange: (page: number, size?: number) => void;
  handleAddUser: () => void;
  handleEdit: (record: User) => void;
  handleDelete: (id: number) => void;
  handleFormSubmit: (values: any) => Promise<void>;
  handleView: (record: User) => void;
  handleBatchDelete: () => void;
  handleDownloadTemplate: () => Promise<void>;
  handleFileUpload: (file: File) => Promise<boolean>;
  setSelectedRowKeys: (keys: React.Key[]) => void;
  handleRoleFilter: (roleCode: string | undefined) => void;
  handleStatusFilter: (isActive: boolean | undefined) => void;
}

export type { User } from "@services";
