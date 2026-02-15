/**
 * AI智能体表单组件 - 简化模拟数据版
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Form,
  Input,
  Select,
  Switch,
  Button,
  Row,
  Col,
  Space,
  Modal,
  Spin,
  Alert,
  Tooltip,
} from "antd";
import {
  ThunderboltOutlined,
  CloudOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";

import { aiAgentsApi } from "@/services/znt/api";
import type { AgentFormValues, AIAgent, AIModelInfo, ModelDiscoveryResponse } from "@/services/znt/types";
import { logger } from "@services/logger";

const { Option } = Select;

// 智能体类型选项（简化为两类：通用和Dify自定义）
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

const AgentForm: React.FC<AgentFormProps> = ({
  visible,
  editingAgent,
  onSubmit,
  onCancel,
}) => {
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

  // 检查是否可以测试
  const checkCanTest = useCallback(() => {
    const url = form.getFieldValue("api_endpoint");
    const apiKey = form.getFieldValue("api_key");
    const name = form.getFieldValue("name");
    const clearApiKey = form.getFieldValue("clear_api_key");

    const canTest = editingAgent?.id
      ? Boolean(name && url && (!clearApiKey ? true : Boolean(apiKey)))
      : Boolean(name && url && apiKey);
    setCanTest(canTest);
  }, [editingAgent?.id, form]);

  // 初始化表单值
  useEffect(() => {
    if (editingAgent) {
      const formValues = {
        name: editingAgent.name || editingAgent.agent_name,
        agent_type: editingAgent.agent_type,
        model_name: editingAgent.model_name,
        description: editingAgent.description,
        api_endpoint: editingAgent.api_endpoint,
        api_key: "",
        clear_api_key: false,
        is_active: editingAgent.is_active,
      };
      form.setFieldsValue(formValues);
    } else {
      form.resetFields();
      form.setFieldsValue({
        agent_type: "general",
        model_name: "",
        description: "",
        is_active: true,
        clear_api_key: false,
      });
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
      onSubmit(cleaned);
    } catch (error) {
      logger.warn("表单验证失败:", error);
    }
  };

  const openRevealModal = () => {
    setAdminPassword("");
    setRevealVisible(true);
  };

  const handleRevealApiKey = async () => {
    if (!editingAgent?.id) return;
    try {
      setRevealLoading(true);
      const resp = await aiAgentsApi.revealApiKey(editingAgent.id, adminPassword);
      if (!resp.success || !resp.data) {
        Modal.error({
          title: "获取API密钥失败",
          content: resp.message || "获取API密钥失败",
        });
        return;
      }
      form.setFieldValue("api_key", resp.data);
      setRevealVisible(false);
    } finally {
      setRevealLoading(false);
    }
  };

  // 测试智能体连接并发现可用模型
  const handleTest = async () => {
    if (!canTest) return;

    try {
      setTesting(true);
      setDiscoveringModels(true);
      setTestResult(null);
      setAvailableModels([]);
      setModelDiscoveryResult(null);

      // 获取表单中的API配置
      const apiEndpoint = form.getFieldValue("api_endpoint");
      const apiKey = form.getFieldValue("api_key");
      
      if (!apiEndpoint) {
        throw new Error("API端点不能为空");
      }

      // 先测试智能体连接（如果有ID）
      let testResult = null;
      if (editingAgent?.id) {
        try {
          testResult = await aiAgentsApi.testAgent(
            editingAgent.id,
            "测试API连接"
          );
        } catch (error) {
          logger.warn("智能体测试失败，继续尝试模型发现:", error);
        }
      }

      if (editingAgent?.id && !apiKey) {
        setModelDiscoveryResult(null);
        setDiscoveringModels(false);
        setTestResult(
          testResult || {
            success: false,
            message: "测试失败：请稍后重试",
            timestamp: new Date().toISOString(),
          },
        );
        return;
      }

      if (!apiKey) {
        throw new Error("API密钥不能为空");
      }

      // 调用模型发现API获取可用模型
      const discoveryResult = await aiAgentsApi.discoverModels({
        api_endpoint: apiEndpoint,
        api_key: apiKey,
      });

      setModelDiscoveryResult(discoveryResult);

      if (discoveryResult.success) {
        // 更新可用模型列表
        setAvailableModels(discoveryResult.models);
        
        // 如果只有一个模型，自动选择它
        if (discoveryResult.models.length === 1) {
          form.setFieldValue("model_name", discoveryResult.models[0].id);
        }
        
        // 设置测试结果
        setTestResult({
          success: true,
          message: `连接测试成功！发现 ${discoveryResult.total_count} 个可用模型。服务商：${discoveryResult.provider}，检测方法：${discoveryResult.detection_method}`,
          timestamp: new Date().toISOString(),
          response_time: discoveryResult.response_time_ms,
          provider: discoveryResult.provider,
          model_count: discoveryResult.total_count,
        });
      } else {
        // 模型发现失败，但连接可能仍然可用
        setTestResult({
          success: false,
          message: `模型发现失败: ${discoveryResult.error_message || "未知错误"}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("测试失败:", error);
      setTestResult({
        success: false,
        message: `测试异常: ${error instanceof Error ? error.message : "未知错误"}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
      setDiscoveringModels(false);
    }
  };

  // 重置测试结果
  const resetTestResult = () => {
    setTestResult(null);
  };

  const handleTypeChange = (value: string) => {
    setTestResult(null);
    setTimeout(checkCanTest, 100);
  };

  // 表单字段变化时检查是否可以测试
  const handleFormChange = useCallback(() => {
    checkCanTest();
    if (testResult || availableModels.length > 0 || modelDiscoveryResult) {
      setTestResult(null);
      setAvailableModels([]);
      setModelDiscoveryResult(null);
    }
  }, [availableModels, checkCanTest, modelDiscoveryResult, testResult]);

  return (
    <Modal
      title={editingAgent ? "编辑智能体" : "添加智能体"}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      okText={editingAgent ? "保存" : "添加"}
      cancelText="取消"
      width={700}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Tooltip
          key="test"
          title={canTest ? "测试智能体连接" : "请先填写必要字段"}
        >
          <Button
            key="test"
            onClick={handleTest}
            disabled={!canTest || testing}
            icon={<PlayCircleOutlined />}
            loading={testing}
          >
            测试连接
          </Button>
        </Tooltip>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          disabled={testing}
        >
          {editingAgent ? "保存" : "添加"}
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          agent_type: "general",
          is_active: true,
        }}
        onFieldsChange={handleFormChange}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="智能体名称"
              name="name"
              rules={[{ required: true, message: "请输入智能体名称" }]}
            >
              <Input placeholder="例如：模拟智能体" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="智能体类型"
              name="agent_type"
              rules={[{ required: true, message: "请选择智能体类型" }]}
            >
              <Select onChange={handleTypeChange}>
                {AgentTypeOptions.map((option) => (
                  <Option key={option.value} value={option.value}>
                    <Space>
                      {option.icon}
                      {option.label}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item 
              label="模型名称" 
              name="model_name"
              normalize={(value) => Array.isArray(value) ? (value[0] ?? "") : value}
              getValueProps={(value) => ({ value: value ? [value] : [] })}
              extra={
                discoveringModels ? "正在发现可用模型..." :
                modelDiscoveryResult?.success ? `发现 ${availableModels.length} 个模型` :
                modelDiscoveryResult ? `发现失败: ${modelDiscoveryResult.error_message}` :
                "点击'测试连接'获取可用模型列表"
              }
            >
              <Select 
                mode="tags"
                placeholder={
                  discoveringModels 
                    ? "正在发现可用模型..." 
                    : availableModels.length > 0
                    ? "请选择模型"
                    : "点击'测试连接'获取模型列表"
                }
                allowClear
                showSearch
                disabled={discoveringModels}
                loading={discoveringModels}
                status={modelDiscoveryResult?.success === false ? 'error' : undefined}
                suffix={
                  discoveringModels 
                    ? <LoadingOutlined spin /> 
                    : modelDiscoveryResult?.success === false 
                    ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                    : undefined
                }
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                  (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={
                  discoveringModels 
                    ? [] 
                    : availableModels.length > 0
                    ? [
                        ...availableModels.map(model => ({
                          value: model.id,
                          label: `${model.name} (${model.id})`,
                          description: model.description || '',
                        }))
                      ]
                    : []
                }
                optionRender={(option) => (
                  <div>
                    <div>{option.label}</div>
                    {option.data?.description && (
                      <div style={{ fontSize: '12px', color: 'var(--ws-color-text-secondary)' }}>
                        {option.data.description}
                      </div>
                    )}
                  </div>
                )}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="描述" name="description">
              <Input.TextArea placeholder="请输入智能体描述（可选）" rows={2} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="API地址"
              name="api_endpoint"
              rules={[
                { required: true, message: "请输入API地址" },
                {
                  validator: async (_: any, value: string) => {
                    if (!value) return Promise.resolve();
                    try {
                      new URL(value);
                      return Promise.resolve();
                    } catch (e) {
                      return Promise.reject(new Error("请输入有效的URL地址"));
                    }
                  }
                },
              ]}
            >
              <Input placeholder="例如：https://api.example.com/v1" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="API密钥"
              name="api_key"
              rules={[
                { min: 8, message: "API密钥长度至少8位" },
              ]}
            >
              <Input.Password
                placeholder={
                  editingAgent?.id && editingAgent?.has_api_key
                    ? `已保存（末尾 ****${editingAgent.api_key_last4 || ""}）`
                    : "请输入API密钥"
                }
                onFocus={resetTestResult}
              />
            </Form.Item>
            {editingAgent?.id && (
              <Space size={8}>
                <Button
                  size="small"
                  onClick={openRevealModal}
                  disabled={!editingAgent?.has_api_key}
                >
                  显示
                </Button>
                <Form.Item name="clear_api_key" valuePropName="checked" noStyle>
                  <Switch checkedChildren="清除密钥" unCheckedChildren="保留密钥" />
                </Form.Item>
              </Space>
            )}
          </Col>
        </Row>

        {/* 测试结果显示 */}
        {testResult && (
          <Form.Item label="测试结果">
            <Alert
              title={
                <div style={{ display: "flex", alignItems: "center" }}>
                  {testResult.success ? (
                    <CheckCircleOutlined
                      style={{ color: "#52c41a", marginRight: 8 }}
                    />
                  ) : (
                    <CloseCircleOutlined
                      style={{ color: "#ff4d4f", marginRight: 8 }}
                    />
                  )}
                  <span>{testResult.message || testResult.data?.message}</span>
                </div>
              }
              type={testResult.success ? "success" : "error"}
              description={
                <div style={{ marginTop: 8 }}>
                  {testResult.response_time && (
                    <div>响应时间: {testResult.response_time}ms</div>
                  )}
                  <div
                    style={{ marginTop: 4, fontSize: "12px", color: "var(--ws-color-text-secondary)" }}
                  >
                    测试时间:{" "}
                    {new Date(
                      testResult.timestamp || Date.now(),
                    ).toLocaleString()}
                  </div>
                </div>
              }
              showIcon={false}
              style={{ marginBottom: 16 }}
            />
          </Form.Item>
        )}

        {testing && (
          <Form.Item label="测试状态">
            <div style={{ textAlign: "center", padding: "20px" }}>
              <Spin size="large">
                <div style={{ marginTop: "16px" }}>正在测试智能体连接...</div>
              </Spin>
            </div>
          </Form.Item>
        )}

        <Form.Item label="启用状态" name="is_active" valuePropName="checked">
          <Switch
            checkedChildren="启用"
            unCheckedChildren="停用"
            onChange={resetTestResult}
          />
        </Form.Item>
      </Form>
      <Modal
        title="验证管理员密码"
        open={revealVisible}
        onCancel={() => setRevealVisible(false)}
        onOk={handleRevealApiKey}
        confirmLoading={revealLoading}
        okText="确认"
        cancelText="取消"
      >
        <Input.Password
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          placeholder="请输入管理员密码"
        />
      </Modal>
    </Modal>
  );
};

export default AgentForm;
