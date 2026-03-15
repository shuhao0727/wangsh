// AI智能体API - 连接真实后端服务
// 使用真实的数据库驱动API

import type {
  AIAgent,
  AgentFormValues,
  AgentStatisticsData,
  BaseResponse,
  PaginatedResponse,
  // 模型发现相关类型
  AIServiceProvider,
  AIModelInfo,
  ModelDiscoveryRequest,
  ModelDiscoveryResponse,
  ProviderDetectionResult,
  SupportedProvidersResponse,
} from "../types";
import { api } from "../../api";
import { logger } from "../../logger";

// 从 unknown 错误中提取 message 和 response.data
interface ApiErrorShape {
  message?: string;
  response?: { data?: { detail?: unknown; message?: unknown } };
}
const asApiError = (e: unknown): ApiErrorShape =>
  (e && typeof e === "object" ? e : {}) as ApiErrorShape;

// API路径常量
const AI_AGENTS_BASE_PATH = "/ai-agents/";
const MODEL_DISCOVERY_BASE_PATH = "/model-discovery";

const toDetailMessage = (detail: unknown): string | undefined => {
  if (!detail) return undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d: unknown) => {
        if (!d) return "";
        if (typeof d === "string") return d;
        const obj = d as Record<string, unknown>;
        const loc = Array.isArray(obj.loc) ? (obj.loc as (string | number)[]).join(".") : "";
        const msg = String(obj.msg || obj.message || "");
        return [loc, msg].filter(Boolean).join(": ");
      })
      .filter(Boolean);
    return parts.join("；") || undefined;
  }
  if (typeof detail === "object") {
    const obj = detail as Record<string, unknown>;
    return String(obj.msg || obj.message || JSON.stringify(detail));
  }
  return String(detail);
};

// 后端返回的原始 agent 数据结构
type AgentRaw = Record<string, unknown>;

// 辅助：安全取字符串
const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const bool = (v: unknown, fallback = false): boolean =>
  typeof v === "boolean" ? v : fallback;
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" ? v : fallback;

// 格式化API响应，添加前端兼容字段
const formatAgentResponse = (agent: AgentRaw): AIAgent => {
  return {
    id: num(agent.id),
    name: str(agent.name),
    agent_name: str(agent.agent_name) || str(agent.name),
    agent_type: str(agent.agent_type) as AIAgent["agent_type"],
    description: str(agent.description),
    api_endpoint: str(agent.api_endpoint),
    api_key: typeof agent.api_key === "string" ? agent.api_key : undefined,
    has_api_key: bool(agent.has_api_key),
    api_key_last4: typeof agent.api_key_last4 === "string" ? agent.api_key_last4 : undefined,
    is_active: bool(agent.is_active),
    status: bool(agent.status) || bool(agent.is_active),
    is_deleted: bool(agent.is_deleted),
    created_at: str(agent.created_at),
    deleted_at: typeof agent.deleted_at === "string" ? agent.deleted_at : undefined,
    model_name: typeof agent.model_name === "string" ? agent.model_name : undefined,
  };
};

// 格式化分页响应
const formatPaginatedResponse = (response: AgentRaw): PaginatedResponse<AIAgent> => {
  const items = (Array.isArray(response.items) ? response.items as AgentRaw[] : []).map(formatAgentResponse);
  return {
    items,
    total: num(response.total),
    page: num(response.page, 1),
    page_size: num(response.page_size, 20),
    total_pages: num(response.total_pages),
  };
};

// 真实的API实现
const aiAgentsApi = {
  // 获取智能体列表
  getAgents: async (params?: {
    skip?: number;
    limit?: number;
    search?: string;
    agent_type?: string;
    is_active?: boolean;
  }): Promise<BaseResponse<PaginatedResponse<AIAgent>>> => {
    try {
      const queryParams: Record<string, any> = {};
      if (params?.skip !== undefined) queryParams.skip = params.skip;
      if (params?.limit !== undefined) queryParams.limit = params.limit;
      if (params?.search) queryParams.search = params.search;
      if (params?.agent_type) queryParams.agent_type = params.agent_type;
      if (params?.is_active !== undefined) queryParams.is_active = params.is_active;

      const response = await api.get(AI_AGENTS_BASE_PATH, { params: queryParams });
      
      return {
        data: formatPaginatedResponse(response.data as unknown as AgentRaw),
        success: true,
        message: "获取智能体列表成功",
      };
    } catch (error: unknown) {
      logger.error("获取智能体列表失败:", error);
      return {
        data: {
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          total_pages: 0,
        },
        success: false,
        message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "获取智能体列表失败",
      };
    }
  },

  // 获取启用的智能体列表（用于AIAgents页面）
  getActiveAgents: async (): Promise<BaseResponse<AIAgent[]>> => {
    try {
      const response = await api.get(`${AI_AGENTS_BASE_PATH}active`);
      
      // 后端直接返回AIAgentResponse[]数组
      const responseData = response.data;
      const agents = Array.isArray(responseData)
        ? (responseData as AgentRaw[]).map(formatAgentResponse)
        : [];
      
      return {
        data: agents as unknown as AIAgent[],
        success: true,
        message: "获取启用智能体列表成功",
      };
    } catch (error: unknown) {
      logger.error("获取启用智能体列表失败:", error);
      return {
        data: [],
        success: false,
        message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "获取启用智能体列表失败",
      };
    }
  },

  // 获取智能体详情
  getAgent: async (id: number): Promise<BaseResponse<AIAgent>> => {
    try {
      const response = await api.get(`${AI_AGENTS_BASE_PATH}${id}`);
      
      return {
        data: formatAgentResponse(response.data as unknown as AgentRaw),
        success: true,
        message: "获取智能体详情成功",
      };
    } catch (error: unknown) {
      logger.error(`获取智能体详情失败 ID=${id}:`, error);
      return {
        data: {
          id,
          name: "未知智能体",
          agent_name: "未知智能体",
          agent_type: "general",
          is_active: false,
          status: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
        } as AIAgent,
        success: false,
        message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "获取智能体详情失败",
      };
    }
  },

  // 创建智能体
  createAgent: async (data: AgentFormValues): Promise<BaseResponse<AIAgent>> => {
    try {
      // 转换前端表单数据为API请求格式
      const requestData = {
        name: data.name,
        description: data.description,
        agent_type: data.agent_type,
        model_name: data.model_name,
        api_endpoint: data.api_endpoint,
        api_key: data.api_key,
        is_active: data.is_active,
      };

      const response = await api.post(AI_AGENTS_BASE_PATH, requestData);
      
      return {
        data: formatAgentResponse(response.data as unknown as AgentRaw),
        success: true,
        message: "创建智能体成功",
      };
    } catch (error: unknown) {
      logger.error("创建智能体失败:", error);
      return {
        data: {
          id: Date.now(),
          name: data.name,
          agent_name: data.name,
          agent_type: data.agent_type,
          api_endpoint: data.api_endpoint,
          api_key: data.api_key,
          is_active: data.is_active,
          status: data.is_active,
          is_deleted: false,
          created_at: new Date().toISOString(),
        } as AIAgent,
        success: false,
        message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "创建智能体失败",
      };
    }
  },

  // 更新智能体
  updateAgent: async (
    id: number,
    data: Partial<AgentFormValues>,
  ): Promise<BaseResponse<AIAgent>> => {
    try {
      // 这里的路径拼接需要注意，AI_AGENTS_BASE_PATH 已经包含末尾斜杠
      // 后端 update 接口不带尾随斜杠 (PUT /{agent_id})
      // 所以我们要去掉末尾的斜杠，或者使用不带斜杠的 base path
      const url = `${AI_AGENTS_BASE_PATH}${id}`;
      // 如果 AI_AGENTS_BASE_PATH 是 "/ai-agents/"，那么 url 就是 "/ai-agents/2"
      // 但是如果后端要求不带斜杠，我们需要处理一下
      // 目前后端定义是 @router.put("/{agent_id}")，在 /ai-agents 路由下
      // FastAPI 对于 PUT /ai-agents/2 和 /ai-agents/2/ 处理方式可能不同
      // 之前的测试表明 PUT /ai-agents/2 是 OK 的，PUT /ai-agents/2/ 会 307
      
      const response = await api.put(url, data);
      
      return {
        data: formatAgentResponse(response.data as unknown as AgentRaw),
        success: true,
        message: "更新智能体成功",
      };
    } catch (error: unknown) {
      logger.error(`更新智能体失败 ID=${id}:`, error);
      return {
        data: {
          id,
          name: data.name || "未知智能体",
          agent_name: data.name || "未知智能体",
          agent_type: data.agent_type || "general",
          api_endpoint: data.api_endpoint,
          api_key: data.api_key,
          is_active: data.is_active !== undefined ? data.is_active : true,
          status: data.is_active !== undefined ? data.is_active : true,
          is_deleted: false,
          created_at: new Date().toISOString(),
        } as AIAgent,
        success: false,
        message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "更新智能体信息失败",
      };
    }
  },

  // 删除智能体（软删除）
  deleteAgent: async (id: number): Promise<BaseResponse<boolean>> => {
    try {
      await api.delete(`${AI_AGENTS_BASE_PATH}${id}`);
      
      return {
        data: true,
        success: true,
        message: "删除智能体成功",
      };
    } catch (error: unknown) {
      logger.error(`删除智能体失败 ID=${id}:`, error);
      return {
        data: false,
        success: false,
        message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "删除智能体失败",
      };
    }
  },

  // 测试智能体
  testAgent: async (
    agentId: number,
    testMessage: string,
  ): Promise<BaseResponse<Record<string, unknown>>> => {
    try {
      const response = await api.post(
        `${AI_AGENTS_BASE_PATH}test`,
        {
          agent_id: agentId,
          test_message: testMessage,
        },
        { timeout: 60000 },
      );
      
      return {
        data: response.data as unknown as Record<string, unknown>,
        success: true,
        message: "智能体测试成功",
      };
    } catch (error: unknown) {
      logger.error(`测试智能体失败 ID=${agentId}:`, error);
      return {
        data: {
          success: false,
          message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "智能体测试失败",
          response_time: null,
          timestamp: new Date().toISOString(),
        },
        success: false,
        message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "智能体测试失败",
      };
    }
  },

  revealApiKey: async (agentId: number, adminPassword: string): Promise<BaseResponse<string>> => {
    try {
      const response = await api.post(`${AI_AGENTS_BASE_PATH}${agentId}/reveal-api-key`, {
        admin_password: adminPassword,
      });
      return {
        data: String((response.data as unknown as Record<string, unknown>)?.api_key || ""),
        success: true,
        message: "获取API密钥成功",
      };
    } catch (error: unknown) {
      logger.error(`获取API密钥失败 ID=${agentId}:`, error);
      return {
        data: "",
        success: false,
        message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "获取API密钥失败",
      };
    }
  },

  // 获取智能体统计数据
  getAgentStatistics: async (): Promise<BaseResponse<AgentStatisticsData>> => {
    try {
      const response = await api.get(`${AI_AGENTS_BASE_PATH}statistics`);
      
      return {
        data: response.data as unknown as AgentStatisticsData,
        success: true,
        message: "获取智能体统计数据成功",
      };
    } catch (error: unknown) {
      logger.error("获取智能体统计数据失败:", error);
      return {
        data: {
          total: 0,
          generalCount: 0,
          difyCount: 0,
          activeCount: 0,
          total_agents: 0,
          active_agents: 0,
          deleted_agents: 0,
          api_errors: 0,
        },
        success: false,
        message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "获取统计数据失败",
      };
    }
  },

  // 批量导入智能体（暂时不支持）
  importAgents: async (_file: File): Promise<BaseResponse<Record<string, unknown>>> => {
    return {
      data: {
        success: false,
        message: "智能体导入功能暂未实现",
      },
      success: true,
      message: "功能暂未实现",
    };
  },

  // 批量删除智能体（暂时不支持）
  batchDeleteAgents: async (_ids: number[]): Promise<BaseResponse<boolean>> => {
    return {
      data: false,
      success: false,
      message: "批量删除功能暂未实现",
    };
  },

  // ==============================================
  // 模型发现相关 API
  // ==============================================

  // 发现可用模型列表
  discoverModels: async (request: ModelDiscoveryRequest): Promise<ModelDiscoveryResponse> => {
    try {
      const response = await api.post(`${MODEL_DISCOVERY_BASE_PATH}/discover`, request);
      return response.data as unknown as ModelDiscoveryResponse;
    } catch (error: unknown) {
      logger.error("发现模型失败:", error);
      return {
        success: false,
        provider: "custom" as AIServiceProvider,
        models: [],
        total_count: 0,
        error_message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "发现模型失败",
        response_time_ms: 0,
      };
    }
  },

  // 根据Agent ID发现可用模型列表（使用后端存储的密钥）
  discoverModelsByAgentId: async (agentId: number): Promise<ModelDiscoveryResponse> => {
    try {
      const response = await api.post(`${MODEL_DISCOVERY_BASE_PATH}/discover/${agentId}`);
      return response.data as unknown as ModelDiscoveryResponse;
    } catch (error: unknown) {
      logger.error("发现模型失败:", error);
      return {
        success: false,
        provider: "custom" as AIServiceProvider,
        models: [],
        total_count: 0,
        error_message: toDetailMessage(asApiError(error).response?.data?.detail) || asApiError(error).message || "发现模型失败",
        response_time_ms: 0,
      };
    }
  },

  // 获取预设模型列表
  getPresetModels: async (provider?: AIServiceProvider): Promise<AIModelInfo[]> => {
    try {
      const params = provider ? { provider } : {};
      const response = await api.get(`${MODEL_DISCOVERY_BASE_PATH}/preset-models`, { params });
      return response.data as unknown as AIModelInfo[];
    } catch (error: unknown) {
      logger.error("获取预设模型失败:", error);
      return [];
    }
  },

  // 根据API端点检测服务商类型
  detectProvider: async (apiEndpoint: string): Promise<ProviderDetectionResult> => {
    try {
      const response = await api.get(`${MODEL_DISCOVERY_BASE_PATH}/detect-provider`, {
        params: { api_endpoint: apiEndpoint },
      });
      return response.data as unknown as ProviderDetectionResult;
    } catch (error: unknown) {
      logger.error("检测服务商失败:", error);
      return {
        provider: "custom" as AIServiceProvider,
        confidence: 0.1,
        detection_method: "error",
        original_endpoint: apiEndpoint,
      };
    }
  },

  // 获取支持的服务商列表
  getSupportedProviders: async (): Promise<SupportedProvidersResponse> => {
    try {
      const response = await api.get(`${MODEL_DISCOVERY_BASE_PATH}/supported-providers`);
      return response.data as unknown as SupportedProvidersResponse;
    } catch (error: unknown) {
      logger.error("获取支持的服务商列表失败:", error);
      return {
        providers: [],
        total: 0,
        has_model_discovery: false,
      };
    }
  },
};

// ZNT模型统计类型（兼容现有代码）
export type ZntMoxingStats = {
  total_records: number;
  today_records: number;
  unique_agents: number;
  unique_users: number;
  avg_response_time: number;
  last_updated: string;
};

export default aiAgentsApi;
