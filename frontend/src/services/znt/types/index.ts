// ZNT 类型定义 - 前端保留，后端已移除
// 这些类型现在仅供前端编译使用

// AI智能体类型
export interface AIAgent {
  id: number;
  name: string;
  agent_name?: string; // 兼容旧代码
  agent_type: string;
  model_name?: string; // 模型名称
  description?: string;
  api_endpoint?: string;
  api_key?: string;
  is_active: boolean;
  status?: boolean; // 用于前端状态显示
  is_deleted: boolean;
  created_at: string;
  deleted_at?: string;
}

export type AgentType =
  | "general"
  | "dify";

export const AgentTypeValues = {
  GENERAL: "general" as const,
  DIFY: "dify" as const,
};

export interface AgentFormValues {
  name: string;
  agent_type: AgentType;
  model_name?: string;
  description?: string;
  api_endpoint?: string;
  api_key?: string;
  is_active: boolean;
}

export interface AgentStatisticsData {
  total: number;
  generalCount: number;
  difyCount: number;
  activeCount: number;
  total_agents?: number; // 兼容旧字段
  active_agents?: number; // 兼容旧字段
  deleted_agents?: number; // 兼容旧字段
  api_errors?: number; // 兼容旧字段
}

// 模型发现相关类型
export type AIServiceProvider = 
  | "openai"
  | "deepseek"
  | "azure"
  | "anthropic"
  | "google"
  | "cohere"
  | "together"
  | "grok"
  | "ollama"
  | "openrouter"
  | "siliconflow"
  | "volcengine"
  | "aliyun"
  | "dify"
  | "custom";

export interface AIModelInfo {
  id: string;
  name: string;
  provider: AIServiceProvider;
  context_length?: number;
  max_tokens?: number;
  is_chat: boolean;
  is_vision: boolean;
  is_audio: boolean;
  is_reasoning: boolean;
  description?: string;
  available: boolean;
}

export interface ModelDiscoveryRequest {
  api_endpoint: string;
  api_key: string;
  provider?: AIServiceProvider;
}

export interface ModelDiscoveryResponse {
  success: boolean;
  provider: AIServiceProvider;
  models: AIModelInfo[];
  total_count: number;
  error_message?: string;
  detection_method?: string;
  request_url?: string;
  response_time_ms?: number;
}

export interface ProviderDetectionResult {
  provider: AIServiceProvider;
  confidence: number;
  detection_method: string;
  base_url?: string;
  suggested_endpoint?: string;
  original_endpoint?: string;
}

export interface SupportedProviderInfo {
  id: string;
  name: string;
  description: string;
  default_endpoint: string;
  model_list_endpoint: string;
  has_preset_models: boolean;
  preset_model_count: number;
}

export interface SupportedProvidersResponse {
  providers: SupportedProviderInfo[];
  total: number;
  has_model_discovery: boolean;
}

// 智能体使用数据
export interface AgentUsageData {
  id: number;
  user_id: number;
  moxing_id: number;
  question?: string;
  answer?: string;
  session_id?: string;
  response_time_ms?: number;
  used_at?: string;
  created_at?: string;

  // 关联对象（前端展示用）
  user?: {
    id: number;
    student_id: string;
    name: string;
    grade?: string;
    class_name?: string;
    is_active?: boolean;
  };

  moxing?: {
    id: number;
    agent_name: string;
    agent_type: string;
    model_name?: string;
    user_id?: number;
    status?: boolean;
    description?: string;
  };

  additional_data?: Record<string, any>;
}

// 搜索筛选参数
export interface SearchFilterParams {
  keyword?: string;
  agent_name?: string;
  student_name?: string;
  student_id?: string;
  class_name?: string;
  grade?: string;
  start_date?: string;
  end_date?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  skip?: number;
  limit?: number;
  page?: number;
  page_size?: number;
}

// 统计数据
export interface StatisticsData {
  // 兼容两种格式
  total_records?: number;
  unique_agents?: number;
  unique_students?: number;
  total_messages?: number;
  avg_messages_per_session?: number;
  most_active_agent?: string;
  most_active_student?: string;

  // Admin/AgentData页面使用的格式
  total_usage?: number;
  active_students?: number;
  active_agents?: number;
  avg_response_time?: number;
  today_usage?: number;
  week_usage?: number;
  month_usage?: number;
}

// 导出格式
export enum ExportFormat {
  CSV = "csv",
  Excel = "excel",
  PDF = "pdf",
  JSON = "json",
}

// ZNT用户类型
export interface ZntUser {
  id: number;
  student_id: string;
  full_name: string;
  class_name: string;
  study_year: string;
  role_code: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// 测试结果
export interface TestResult {
  success: boolean;
  message?: string;
  response_time?: number;
  error?: string;
  timestamp: string;
}

// 学生信息
export interface StudentInfo {
  id: number;
  student_id: string;
  full_name: string;
  class_name: string;
  study_year: string;
  role_code: string;
  is_active: boolean;
}

// 登录相关类型
export interface StudentLoginRequest {
  username: string;
  password: string;
}

export interface StudentLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  role_code: string;
  full_name: string;
  student_id: string;
  class_name: string;
  study_year: string;
}

export interface TokenValidationResult {
  valid: boolean;
  user_id?: string;
  expires_at?: string;
  issued_at?: string;
}

// 基础类型
export interface BaseResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
