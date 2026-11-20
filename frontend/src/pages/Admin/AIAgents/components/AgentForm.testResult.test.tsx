import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIAgent } from "@/services/znt/types";
import AgentForm from "./AgentForm";

// 外层 success 只表示 HTTP 请求完成；真正的测试结果在 data（后端 AgentTestResponse）里。
const mock = vi.hoisted(() => ({
  testAgent: vi.fn(),
  discoverModelsByAgentId: vi.fn(),
  discoverModels: vi.fn(),
  updateAgent: vi.fn(),
}));
vi.mock("@/services/znt/api", () => ({ aiAgentsApi: mock }));
vi.mock("@/lib/toast", () => ({
  showMessage: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const agent: AIAgent = {
  id: 7,
  name: "合成智能体",
  agent_type: "general",
  model_name: "synthetic-model",
  api_endpoint: "https://relay.example.test/v1",
  has_api_key: true,
  is_active: true,
  is_deleted: false,
  created_at: "2026-11-05T00:00:00Z",
};

const testResponse = (success: boolean, message: string) => ({
  success: true,
  message: "智能体测试成功",
  data: { success, message, response_time: 12, timestamp: "2026-11-05T00:00:00Z" },
});

async function runConnectivityTest() {
  render(<AgentForm visible editingAgent={agent} onSubmit={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "测试连接" }));
}

beforeEach(() => {
  mock.testAgent.mockReset();
  mock.updateAgent.mockReset();
  mock.discoverModels.mockReset();
  mock.discoverModelsByAgentId.mockReset();
  mock.discoverModelsByAgentId.mockResolvedValue({
    success: false,
    provider: "custom",
    models: [],
    total_count: 0,
    error_message: "合成发现失败",
    response_time_ms: 0,
  });
});
afterEach(cleanup);

describe("AgentForm connectivity result", () => {
  it("tests the saved connection without writing or trying draft connection fields", async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    mock.testAgent.mockResolvedValue(testResponse(true, "已保存配置通过"));
    mock.discoverModels.mockResolvedValue({ success: true, models: [], total_count: 0 });
    render(<AgentForm visible editingAgent={agent} onSubmit={onSubmit} onCancel={onCancel} />);

    fireEvent.change(screen.getByLabelText("API 地址"), { target: { value: "https://draft.example.test/v1" } });
    fireEvent.change(screen.getByLabelText("API 密钥"), { target: { value: "synthetic-draft-key" } });
    fireEvent.change(screen.getByLabelText("模型"), { target: { value: "draft-model" } });
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));
    await screen.findByText("已保存配置通过");
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(mock.testAgent).toHaveBeenCalledExactlyOnceWith(7, "测试API连接");
    expect(mock.updateAgent).not.toHaveBeenCalled();
    expect(mock.discoverModels).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/测试使用已保存的连接配置/)).toBeVisible();
  });

  it("uses only the stored agent for model discovery when the draft changes during testing", async () => {
    let finishTest!: (response: ReturnType<typeof testResponse>) => void;
    mock.testAgent.mockReturnValue(new Promise((resolve) => { finishTest = resolve; }));
    mock.discoverModels.mockResolvedValue({ success: true, models: [], total_count: 0 });
    await runConnectivityTest();
    fireEvent.change(screen.getByLabelText("API 地址"), { target: { value: "https://draft.example.test/v1" } });
    fireEvent.change(screen.getByLabelText("API 密钥"), { target: { value: "synthetic-draft-key" } });
    finishTest(testResponse(true, "连接测试成功"));
    await waitFor(() => expect(mock.discoverModelsByAgentId).toHaveBeenCalledExactlyOnceWith(7));
    expect(mock.discoverModels).not.toHaveBeenCalled();
  });

  it("requires a saved configuration before testing a new agent", async () => {
    render(<AgentForm visible editingAgent={null} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "合成新智能体" } });
    fireEvent.change(screen.getByLabelText("API 地址"), { target: { value: "https://draft.example.test/v1" } });
    fireEvent.change(screen.getByLabelText("API 密钥"), { target: { value: "synthetic-draft-key" } });
    expect(screen.getByRole("button", { name: "测试连接" })).toBeDisabled();
    expect(mock.testAgent).not.toHaveBeenCalled();
  });

  it("shows a failure when the backend test result is success:false even though the request succeeded", async () => {
    mock.testAgent.mockResolvedValue(testResponse(false, "❌ API连接测试失败"));
    await runConnectivityTest();

    const title = await screen.findByText("❌ API连接测试失败");
    const alert = title.closest('[role="alert"]') as HTMLElement;
    expect(alert).toHaveClass("text-destructive");
    expect(alert.querySelector(".lucide-circle-x")).not.toBeNull();
    expect(alert.querySelector(".lucide-circle-check")).toBeNull();
    expect(mock.testAgent).toHaveBeenCalledWith(7, "测试API连接");
  });

  it("shows a success check when the backend test result is success:true", async () => {
    mock.testAgent.mockResolvedValue(testResponse(true, "✅ 测试成功"));
    await runConnectivityTest();

    const title = await screen.findByText("✅ 测试成功");
    const alert = title.closest('[role="alert"]') as HTMLElement;
    expect(alert).not.toHaveClass("text-destructive");
    expect(alert.querySelector(".lucide-circle-check")).not.toBeNull();
  });
});
