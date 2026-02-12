/**
 * 用户管理相关数据
 */

import { User } from "@services";

// 模拟用户数据（保留为fallback）
export const mockUsers: User[] = [
  {
    id: 1,
    student_id: "20230001",
    username: null,
    full_name: "张三",
    study_year: "2025",
    class_name: "高一(1)班",
    role_code: "student",
    created_at: "2023-09-01T08:00:00",
    updated_at: "2024-02-01T10:30:00",
    is_active: true,
  },
  {
    id: 2,
    student_id: "20230002",
    username: null,
    full_name: "李四",
    study_year: "2025",
    class_name: "高一(2)班",
    role_code: "student",
    created_at: "2023-09-01T08:00:00",
    updated_at: "2024-01-15T14:20:00",
    is_active: true,
  },
  {
    id: 3,
    student_id: "20230003",
    username: null,
    full_name: "王五",
    study_year: "2025",
    class_name: "高一(3)班",
    role_code: "student",
    created_at: "2023-09-01T08:00:00",
    updated_at: "2024-01-10T09:15:00",
    is_active: false,
  },
  {
    id: 4,
    student_id: "20220001",
    username: null,
    full_name: "赵六",
    study_year: "2024",
    class_name: "高二(1)班",
    role_code: "student",
    created_at: "2022-09-01T08:00:00",
    updated_at: "2024-01-20T16:45:00",
    is_active: true,
  },
  {
    id: 5,
    student_id: "20220002",
    username: null,
    full_name: "钱七",
    study_year: "2024",
    class_name: "高二(2)班",
    role_code: "student",
    created_at: "2022-09-01T08:00:00",
    updated_at: "2024-01-25T11:30:00",
    is_active: true,
  },
];

// 角色选项（用户管理只显示学生，管理员角色已由后端过滤）
export const roleOptions = [{ value: "student", label: "学生" }];

// 状态选项
export const statusOptions = [
  { value: true, label: "活跃" },
  { value: false, label: "停用" },
];

// 学年选项
export const studyYearOptions = [
  { value: "2023", label: "2023" },
  { value: "2024", label: "2024" },
  { value: "2025", label: "2025" },
  { value: "2026", label: "2026" },
];

// 默认分页配置
export const defaultPagination = {
  pageSize: 20,
  pageSizeOptions: ["10", "20", "50", "100"],
};

// Excel模板列头
export const excelTemplateHeaders = ["学号", "姓名", "学年", "班级", "状态"];

// 表单验证规则
export const formRules = {
  student_id: [
    { required: true, message: "请输入学号" },
    { pattern: /^\S+$/, message: "学号不能包含空格" },
  ],
  full_name: [{ required: true, message: "请输入姓名" }],
  study_year: [
    { required: true, message: "请输入学年" },
    { pattern: /^\d{4}$/, message: "请输入4位数字的学年，例如：2025" },
  ],
  class_name: [{ required: true, message: "请输入班级" }],
};
