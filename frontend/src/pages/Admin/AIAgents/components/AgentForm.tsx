/**
 * AI智能体表单组件
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Form, Input, Select, Switch, Button, Space, Modal, Spin, Alert, Tooltip,
} from "antd";
import {
  ThunderboltOutlined, CloudOutlined,
  CloseCircleOutlined, LoadingOutlined, PlayCircleOutlined, EyeOutlined,
} from "@ant-design/icons";

import { aiAgentsApi } from "@/services/znt/api";
import type { AgentFormValues, AIAgent, AIModelInfo, ModelDiscoveryResponse } from "@/services/znt/types";
import { logger } from "@services/logger";

const AgentTypeOptions = [
  { value: "general", label: "通用智能体", icon: <ThunderboltOutlined /> },
  { value: "dify", label: "Dify智能体", icon: <CloudOutlined /> },
];

interface AgentFormProps {
  visible: boolean;
  editingAgent: AIAgent | null;
  onSubmit: (values: AgentFormValues) => void;
  onCancel: () => void;
}

const AgentForm: React.FC<AgentFormProps> = ({ visible, editingAgent, onSubmit, onCancel }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [canTest, setCanTest] = useState(false);
  const [availableModels, setAvailableModels] = useState<AIModelInfo[]>([]);
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [modelDiscoveryResult, setModelDiscoveryResult] = useState<ModelDiscoveryResponse | null>(null);
  const [revealVisible, setRevealVisible] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  const checkCanTest = useCallback(() => {
    const url = form.getFieldValue("api_endpoint");
    const apiKey = form.getFieldValue("api_key");
    const name = form.getFieldValue("name");
    setCanTest(editingAgent?.id ? Boolean(name && url) : Boolean(name && url && apiKey));
  }, [editingAgent?.id, form]);

  useEffect(() => {
    if (editingAgent) {
      form.setFieldsValue({
        name: editingAgent.name || editingAgent.agent_name,
        agent_type: editingAgent.agent_type,
        model_name: editingAgent.model_name,
        description: editingAgent.description,
        api_endpoint: editingAgent.api_endpoint,
        api_key: "",
        is_active: editingAgent.is_active,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ agent_type: "general", is_active: true });
    }
    setTestResult(null);
    checkCanTest();
  }, [checkCanTest, editingAgent, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const cleaned: any = { ...values };
      if (typeof cleaned.api_key === "string" && cleaned.api_key.trim() === "") {
        delete cleaned.api_key;
      }
      delete cleaned.clear_api_key;
      onSubmit(cleaned);
    } catch (error) {
      logger.warn("表单验证失败:", error);
    }
  };

  const handleRevealApiKey = async () => {
    if (!editingAgent?.id) return;
    try {
      setRevealLoading(true);
      const resp = await aiAgentsApi.revealApiKey(editingAgent.id, adminPassword);
      if (!resp.success || !resp.data) {
        Modal.error({ title: "获取失败", content: resp.message || "获取API密钥失败" });
        return;
      }
      form.setFieldValue("api_key", resp.data);
      setRevealVisible(false);
      Modal.success({
        title: "API密钥",
        content: (
          <div className="font-mono bg-gray-50 p-3 rounded-lg break-all">
            {resp.data}
          </div>
        ),
      });
    } catch (error: any) {
      Modal.error({ title: "获取失败", content: error?.message || "请求失败" });
    } finally {
      setRevealLoading(false);
    }
  };

  const handleTest = async () => {
    if (!canTest) return;
    try {
      setTesting(true);
      setDiscoveringModels(true);
      setTestResult(null);
      setAvailableModels([]);
      setModelDiscoveryResult(null);

      const apiEndpoint = form.getFieldValue("api_endpoint");
      const apiKey = form.getFieldValue("api_key");
      if (!apiEndpoint) throw new Error("API端点不能为空");

      // 如果有新 key，先保存再测试
      if (editingAgent?.id && apiKey?.trim()) {
        try { await aiAgentsApi.updateAgent(editingAgent.id, { api_key: apiKey.trim() }); } catch (e) { logger.warn("自动保存API密钥失败:", e); }
      }

      let testResult = null;
      if (editingAgent?.id) {
        try { testResult = await aiAgentsApi.testAgent(editingAgent.id, "测试API连接"); } catch (error) { logger.warn("智能体测试失败:", error); }
      }

      // 模型发现
      const useAgentId = editingAgent?.id && !apiKey;
      try {
        const discoveryResult = useAgentId
          ? await aiAgentsApi.discoverModelsByAgentId(editingAgent!.id)
          : await aiAgentsApi.discoverModels({ api_endpoint: apiEndpoint, api_key: apiKey });
        setModelDiscoveryResult(discoveryResult);
        if (discoveryResult.success) {
          setAvailableModels(discoveryResult.models);
          if (discoveryResult.models.length === 1) form.setFieldValue("model_name", discoveryResult.models[0].id);
          setTestResult(testResult || { success: true, message: `发现 ${discoveryResult.total_count} 个可用模型`, timestamp: new Date().toISOString(), response_time: discoveryResult.response_time_ms, provider: discoveryResult.provider, model_count: discoveryResult.total_count });
        } else {
          setTestResult(testResult?.success
            ? { ...testResult, message: `连接成功，但模型发现失败: ${discoveryResult.error_message || "未知"}` }
            : { success: false, message: `测试失败: ${discoveryResult.error_message || "未知"}`, timestamp: new Date().toISOString() });
        }
      } catch (error) {
        logger.warn("模型发现失败:", error);
        setTestResult(testResult?.success
          ? { ...testResult, message: "连接成功，但无法获取模型列表" }
          : { success: false, message: "测试失败：无法获取模型列表", timestamp: new Date().toISOString() });
      }
    } catch (error) {
      logger.error("测试失败:", error);
      setTestResult({ success: false, message: `测试异常: ${error instanceof Error ? error.message : "未知错误"}`, timestamp: new Date().toISOString() });
    } finally {
      setTesting(false);
      setDiscoveringModels(false);
    }
  };

  const resetTestResult = () => setTestResult(null);
  const handleFormChange = useCallback(() => {
    checkCanTest();
    if (testResult || availableModels.length > 0 || modelDiscoveryResult) { setTestResult(null); setAvailableModels([]); setModelDiscoveryResult(null); }
  }, [availableModels, checkCanTest, modelDiscoveryResult, testResult]);

  /* ── label helper ── */
  const fieldLabel = (text: string) => <span className="font-medium text-sm">{text}</span>;

  return (
    <Modal
      title={editingAgent ? "编辑智能体" : "添加智能体"}
      open={visible} onOk={handleSubmit} onCancel={onCancel}
      okText={editingAgent ? "保存" : "添加"} cancelText="取消"
      width="min(92vw, 640px)"
      footer={[
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Tooltip key="test" title={canTest ? "测试连接并发现模型" : "请先填写名称和API地址"}>
          <Button onClick={handleTest} disabled={!canTest || testing} icon={<PlayCircleOutlined />} loading={testing}>测试连接</Button>
        </Tooltip>,
        <Button key="submit" type="primary" onClick={handleSubmit} disabled={testing}>{editingAgent ? "保存" : "添加"}</Button>,
      ]}
    >
      <Form form={form} layout="vertical" initialValues={{ agent_type: "general", is_active: true }} onFieldsChange={handleFormChange}>
        {/* 第一行：名称 + 类型 + 启用 */}
        <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
          <Form.Item label={fieldLabel("名称")} name="name" rules={[{ required: true, message: "请输入名称" }]} className="!mb-4">
            <Input placeholder="如：MiniMax" />
          </Form.Item>
          <Form.Item label={fieldLabel("类型")} name="agent_type" rules={[{ required: true }]} className="!mb-4">
            <Select onChange={() => { resetTestResult(); setTimeout(checkCanTest, 100); }}>
              {AgentTypeOptions.map(o => <Select.Option key={o.value} value={o.value}><Space>{o.icon}{o.label}</Space></Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label={fieldLabel("状态")} name="is_active" valuePropName="checked" className="!mb-4">
            <Switch checkedChildren="启用" unCheckedChildren="停用" onChange={resetTestResult} />
          </Form.Item>
        </div>

        {/* 第二行：API 地址 + 密钥 */}
        <div className="grid grid-cols-2 gap-4">
          <Form.Item label={fieldLabel("API 地址")} name="api_endpoint" rules={[{ required: true, message: "请输入API地址" },
            { validator: async (_: any, v: string) => { if (!v) return; try { new URL(v); } catch { throw new Error("请输入有效的URL"); } } }]}
            className="!mb-4">
            <Input placeholder="https://api.siliconflow.cn/v1" />
          </Form.Item>
          <Form.Item label={
            <span className="flex items-center gap-2">
              {fieldLabel("API 密钥")}
              {editingAgent?.id && editingAgent?.has_api_key && (
                <Button type="link" size="small" icon={<EyeOutlined />} className="!p-0 !h-auto !text-xs"
                  onClick={() => { setAdminPassword(""); setRevealVisible(true); }}>
                  查看
                </Button>
              )}
            </span>
          } name="api_key" rules={[{ min: 8, message: "至少8位" }]} className="!mb-4">
            <Input.Password placeholder={editingAgent?.has_api_key ? `已保存（****${editingAgent.api_key_last4 || ""})` : "请输入API密钥"} onFocus={resetTestResult} />
          </Form.Item>
        </div>

        {/* 模型选择 */}
        <Form.Item label={fieldLabel("模型")} name="model_name" className="!mb-4"
          normalize={(v) => Array.isArray(v) ? (v[0] ?? "") : v}
          getValueProps={(v) => ({ value: v ? [v] : [] })}
          extra={discoveringModels ? "正在发现可用模型..." : modelDiscoveryResult?.success ? `发现 ${availableModels.length} 个模型` : modelDiscoveryResult ? `发现失败: ${modelDiscoveryResult.error_message}` : "点击「测试连接」获取可用模型"}>
          <Select mode="tags" allowClear showSearch disabled={discoveringModels} loading={discoveringModels}
            placeholder={discoveringModels ? "正在发现..." : availableModels.length > 0 ? "请选择模型" : "测试连接后选择"}
            status={modelDiscoveryResult?.success === false ? "error" : undefined}
            suffix={discoveringModels ? <LoadingOutlined spin /> : modelDiscoveryResult?.success === false ? <CloseCircleOutlined style={{ color: "#EF4444" }} /> : undefined}
            filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase()) || (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
            options={availableModels.map(m => ({ value: m.id, label: m.id, description: m.description || "" }))}
            optionRender={(option: any) => (<div><div>{option.label || option.data?.label}</div>{(option.description || option.data?.description) && <div className="text-xs text-text-secondary">{option.description || option.data?.description}</div>}</div>)} />
        </Form.Item>

        {/* 描述 */}
        <Form.Item label={fieldLabel("描述")} name="description" className="!mb-4">
          <Input.TextArea placeholder="可选" rows={2} />
        </Form.Item>

        {/* System Prompt */}
        <Form.Item label={fieldLabel("系统提示词")} name="system_prompt" className="!mb-4">
          <Input.TextArea placeholder="设置智能体的角色和行为约束（可选）" rows={3} maxLength={8000} showCount />
        </Form.Item>

        {/* 测试结果 */}
        {testing && (
          <div className="text-center p-5">
            <Spin><div className="mt-4">正在测试连接...</div></Spin>
          </div>
        )}
        {testResult && !testing && (
          <Alert
            type={testResult.success ? "success" : "error"} showIcon
            message={testResult.message || testResult.data?.message}
            description={
              <Space direction="vertical" size={2} className="mt-1">
                {testResult.response_time && <span>响应时间: {testResult.response_time}ms</span>}
                {testResult.provider && <span>服务商: {testResult.provider}</span>}
                {testResult.model_count != null && <span>可用模型: {testResult.model_count} 个</span>}
              </Space>
            }
            className="!mb-0"
          />
        )}
      </Form>

      {/* 查看密钥弹窗 */}
      <Modal title="验证管理员密码" open={revealVisible} onOk={handleRevealApiKey} onCancel={() => setRevealVisible(false)}
        okText="确认" cancelText="取消" confirmLoading={revealLoading}>
        <Input.Password value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="请输入管理员密码" />
      </Modal>
    </Modal>
  );
};

export default AgentForm;
