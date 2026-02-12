/**
 * Services 统一导出文件
 * 将所有服务模块通过路径别名统一导出，便于统一导入和管理
 */

// 核心 API 服务
export { api, authApi, healthApi } from "./api";
export type { ApiResponse, ValidationErrorResponse } from "./api";

// 配置服务
export { config } from "./config";
export type { AppConfig, FeatureFlags } from "./config";

// 文章相关服务 (wz 模块)
export { articleApi } from "./wz/articles";
export { categoryApi } from "./wz/categories";
export type {
  Article,
  ArticleWithRelations,
  ArticleListResponse,
  ArticleFilterParams,
  Category,
  CategoryResponse,
  CategoryWithUsage,
  CategoryListResponse,
  CategoryFilterParams,
} from "./wz";

// ZNT 相关服务 (AI智能体测试等)
export {
  testAIAgent,
  quickTest,
  AIAgentTester,
  zntUsersApi,
  studentAuthApi,
} from "./znt";
export type {
  TestResult,
  ZntUser,
  StudentInfo,
  StudentLoginRequest,
  StudentLoginResponse,
  TokenValidationResult,
} from "./znt";

// 用户管理服务
export { userApi } from "./users";
export type {
  User,
  UserCreateRequest,
  UserUpdateRequest,
  UserListResponse,
  BatchDeleteRequest,
  BatchDeleteResponse,
} from "./users";

// XBK（校本课）模块服务
export { xbkPublicConfigApi, xbkDataApi } from "./xbk";
export type {
  XbkPublicConfig,
  XbkScope,
  XbkExportType,
  XbkListResponse,
  XbkStudentRow,
  XbkCourseRow,
  XbkSelectionRow,
  XbkCourseResultRow,
  XbkMeta,
  XbkImportPreview,
  XbkImportResult,
  XbkSummary,
  XbkCourseStatItem,
  XbkClassStatItem,
} from "./xbk";

export { systemMetricsApi } from "./system/typstMetrics";
export type { TypstMetricsResponse } from "./system/typstMetrics";

// Informatics（信息学）模块服务
export { typstNotesApi } from "./informatics";
export { publicTypstNotesApi } from "./informatics";
export { typstCategoriesApi, typstStylesApi } from "./informatics";
export type {
  TypstAssetListItem,
  TypstNote,
  TypstNoteListItem,
  PublicTypstNote,
  PublicTypstNoteListItem,
  TypstCategoryListItem,
  TypstStyleListItem,
  TypstStyleResponse,
} from "./informatics";

/**
 * 使用示例：
 *
 * 1. 导入所有需要的服务：
 *    import { api, config, articleApi, testAIAgent, userApi } from "@services";
 *
 * 2. 按需导入类型：
 *    import type { Article, ApiResponse, User } from "@services";
 *
 * 3. 导入单个服务：
 *    import { articleApi } from "@services";
 *
 * 优势：
 * - 统一管理所有服务导入
 * - 减少相对路径依赖
 * - 便于重构和维护
 * - 支持 TypeScript 路径别名
 */
