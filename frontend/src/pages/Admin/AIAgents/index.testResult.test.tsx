import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminAIAgents from "./index";

// 外层 success 只表示 HTTP 请求完成；真正的测试结果在 data（后端 AgentTestResponse）里。
const mock = vi.hoisted(() => ({
  testAgent: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  agent: {
    id: 7,
    name: "合成智能体",
    agent_type: "general",
    model_name: "synthetic-model",
    api_endpoint: "https://relay.example.test/v1",
    has_api_key: true,
    is_active: true,
    is_deleted: false,
    created_at: "2026-11-05T00:00:00Z",
  },
}));
vi.mock("@/lib/toast", () => ({ showMessage: mock.toast }));
vi.mock("@services/agents", () => ({ aiAgentsApi: { testAgent: mock.testAgent } }));
vi.mock("@/services/znt/api", () => ({ aiAgentsApi: { testAgent: mock.testAgent } }));
vi.mock("@hooks/useAdminSSE", () => ({ useAdminSSE: () => undefined }));
vi.mock("@hooks/queries/useAIAgentsQuery", () => {
  const mutation = { mutateAsync: vi.fn() };
  return {
    useAgentsList: () => ({ data: { items: [mock.agent], total: 1 }, isLoading: false }),
    useAgentStatistics: () => ({ data: undefined }),
    useCreateAgent: () => mutation,
    useUpdateAgent: () => mutation,
    useDeleteAgent: () => mutation,
    useBatchDeleteAgents: () => mutation,
  };
});

const testResponse = (success: boolean, message: string) => ({
  success: true,
  message: "智能体测试成功",
  data: { success, message, response_time: 12, timestamp: "2026-11-05T00:00:00Z" },
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdminAIAgents />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mock.testAgent.mockReset();
  Object.values(mock.toast).forEach((fn) => fn.mockReset());
  vi.spyOn(window, "prompt").mockReturnValue("你好");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AI agents list connectivity test", () => {
  it("only reports failure when the backend test result is success:false", async () => {
    mock.testAgent.mockResolvedValue(testResponse(false, "❌ API连接测试失败"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    await waitFor(() => expect(mock.toast.error).toHaveBeenCalledWith("❌ API连接测试失败"));
    expect(mock.toast.success).not.toHaveBeenCalled();
    expect(mock.testAgent).toHaveBeenCalledWith(7, "你好");
  });

  it("reports success and the detail when the backend test result is success:true", async () => {
    mock.testAgent.mockResolvedValue(testResponse(true, "✅ 测试成功"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    await waitFor(() => expect(mock.toast.success).toHaveBeenCalledWith("测试成功（12.00ms）"));
    expect(mock.toast.info).toHaveBeenCalledWith("✅ 测试成功");
    expect(mock.toast.error).not.toHaveBeenCalled();
  });
});
