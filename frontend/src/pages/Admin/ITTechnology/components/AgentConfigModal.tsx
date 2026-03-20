import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, message, Alert } from "antd";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { pythonlabFlowApi } from "../pythonLab/services/pythonlabDebugApi";

interface AgentConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

const AgentConfigModal: React.FC<AgentConfigModalProps> = ({ visible, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (visible) {
      loadConfig();
      setTestResult(null);
    }
  }, [visible]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await featureFlagsApi.list();
      const flag = res.find((f: any) => f.key === "python_lab_agent_config");
      
      const promptRes = await pythonlabFlowApi.getPromptTemplate();
      
      if (flag && flag.value) {
        form.setFieldsValue({
            ...flag.value,
            prompt_template: promptRes.content // Override with file content
        });
      } else {
          form.resetFields();
          if (promptRes.content) {
              form.setFieldValue("prompt_template", promptRes.content);
          }
      }
    } catch (error) {
      message.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      // Save URL/Key to DB
      await featureFlagsApi.save({
        key: "python_lab_agent_config",
        value: {
            api_url: values.api_url,
            api_key: values.api_key,
            model: values.model
        }
      });
      
      // Save Prompt to File
      await pythonlabFlowApi.savePromptTemplate(values.prompt_template);

      message.success("Configuration saved");
      onClose();
    } catch (error) {
      message.error("Failed to save configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      setTestResult(null);
      const res = await pythonlabFlowApi.testAgent(values, { timeoutMs: 60000, silent: true });
      if (res.success) {
        message.success("Connection successful!");
        setTestResult({ success: true });
      } else {
        message.error("Connection failed");
        setTestResult({ success: false, error: res.error || "Unknown error" });
      }
    } catch (error: any) {
        const detail =
          error?.response?.data?.error ||
          error?.response?.data?.detail ||
          error?.message ||
          "Network error or invalid response";
        message.error("Test request failed");
        setTestResult({ success: false, error: String(detail) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      title="管理智能体配置"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="test" loading={testing} onClick={handleTest}>
          测试连接
        </Button>,
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" loading={loading} onClick={handleSave}>
          保存
        </Button>,
      ]}
      width={600}
      styles={{ body: { padding: 24 } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="api_url"
          label="Agent API URL"
          rules={[{ required: true, message: "请输入 API URL" }]}
        >
          <Input placeholder="例如: https://api.example.com/v1/chat/completions" />
        </Form.Item>
        <Form.Item
          name="api_key"
          label="API Key"
          rules={[{ required: true, message: "请输入 API Key" }]}
        >
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item
          name="model"
          label="模型名称 (Model)"
          extra="如果是 OpenAI 兼容接口，请填写模型名称（例如: gpt-3.5-turbo, stepfun-ai/Step-3.5-Flash）"
        >
          <Input placeholder="gpt-3.5-turbo" />
        </Form.Item>
        <Form.Item
          name="prompt_template"
          label="提示词模板 (Prompt Template)"
          extra="发送给智能体的系统提示词。后端会自动注入流程图 JSON 数据。"
        >
          <Input.TextArea rows={8} placeholder="You are a Python expert..." />
        </Form.Item>
      </Form>
      
      {testResult && (
          <Alert
            message={testResult.success ? "测试通过" : "测试失败"}
            description={testResult.error}
            type={testResult.success ? "success" : "error"}
            showIcon
            style={{ marginTop: 16 }}
          />
      )}
    </Modal>
  );
};

export default AgentConfigModal;
