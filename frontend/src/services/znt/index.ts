// ZNT服务模块 - 前端保留，后端已移除
// 这些API现在返回空数据或模拟数据

// 导入类型
import type {
  TestResult,
  ZntUser,
  StudentInfo,
  StudentLoginRequest,
  StudentLoginResponse,
  TokenValidationResult,
} from "./types";

// 导入API
import aiAgentsApi from "./api/ai-agents-api";

// 模拟的测试功能
export const testAIAgent = () =>
  Promise.resolve({
    data: {
      success: true,
      message: "这是模拟测试结果",
      response_time: 100,
      timestamp: new Date().toISOString(),
    },
    success: true,
    message: "功能已简化",
  });

export const quickTest = testAIAgent; // 别名

export const AIAgentTester = {
  testAIAgent: testAIAgent,
};

// 用户API（空实现）
export const zntUsersApi = {
  getUsers: (params?: any) =>
    Promise.resolve({
      data: {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      },
      success: true,
      message: "功能已简化",
    }),
  getUser: (id: number) =>
    Promise.resolve({
      data: null,
      success: true,
      message: "功能已简化",
    }),
  createUser: (data: any) =>
    Promise.resolve({
      data: {
        id: Date.now(),
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
      },
      success: true,
      message: "功能已简化，数据未保存",
    }),
  updateUser: (id: number, data: any) =>
    Promise.resolve({
      data: {
        id,
        ...data,
        updated_at: new Date().toISOString(),
      },
      success: true,
      message: "功能已简化，数据未保存",
    }),
  deleteUser: (id: number) =>
    Promise.resolve({
      data: true,
      success: true,
      message: "功能已简化，数据未删除",
    }),
  downloadTemplate: () =>
    Promise.resolve({
      data: new Blob([""], { type: "application/octet-stream" }),
      success: true,
      message: "功能已简化",
    }),
  importUsers: (file: File) =>
    Promise.resolve({
      data: {
        success: true,
        message: "导入功能已简化",
        imported_count: 0,
        updated_count: 0,
        error_count: 0,
        errors: [],
      },
      success: true,
      message: "功能已简化",
    }),
};

// 学生认证API（空实现）
export const studentAuthApi = {
  login: (data: StudentLoginRequest) =>
    Promise.resolve({
      data: {
        access_token: "mock_token_" + Date.now(),
        token_type: "bearer",
        expires_in: 691200,
        role_code: "student",
        full_name: "模拟学生",
        student_id: "202300000",
        class_name: "模拟班级",
        study_year: "2025",
      } as StudentLoginResponse,
      success: true,
      message: "功能已简化",
    }),
  getCurrentStudent: () =>
    Promise.resolve({
      data: {
        id: 1,
        student_id: "202300000",
        full_name: "模拟学生",
        class_name: "模拟班级",
        study_year: "2025",
        role_code: "student",
        is_active: true,
      } as StudentInfo,
      success: true,
      message: "功能已简化",
    }),
  verifyToken: (token: string) =>
    Promise.resolve({
      data: {
        valid: true,
        user_id: "mock_user",
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        issued_at: new Date().toISOString(),
      } as TokenValidationResult,
      success: true,
      message: "功能已简化",
    }),
};

// 导出AI智能体API
export { aiAgentsApi };

// 导出类型
export type {
  TestResult,
  ZntUser,
  StudentInfo,
  StudentLoginRequest,
  StudentLoginResponse,
  TokenValidationResult,
};
