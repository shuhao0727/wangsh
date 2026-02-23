/**
 * AI智能体表格列配置 - 适配后端API
 */
import React from "react";
import { Space, Tag, Tooltip, Button, Switch } from "antd";
import {
  KeyOutlined,
  LinkOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  CloudOutlined,
  ApiOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { AIAgent } from "@services/znt/types";

// 类型标签配置 - 适配后端agent_type
const typeConfig: Record<
  string,
  { color: string; text: string; icon: React.ReactNode }
> = {
  openai: {
    color: "blue",
    text: "OpenAI",
    icon: <ThunderboltOutlined />,
  },
  dify: {
    color: "purple",
    text: "Dify",
    icon: <CloudOutlined />,
  },
  custom: {
    color: "green",
    text: "自定义",
    icon: <ApiOutlined />,
  },
  azure: {
    color: "cyan",
    text: "Azure",
    icon: <CloudOutlined />,
  },
  anthropic: {
    color: "orange",
    text: "Anthropic",
    icon: <ThunderboltOutlined />,
  },
  system: {
    color: "magenta",
    text: "系统",
    icon: <ApiOutlined />,
  },
};

// 获取类型配置，如果未知类型使用默认配置
const getTypeConfig = (agentType: string) => {
  return (
    typeConfig[agentType] || {
      color: "default",
      text: agentType,
      icon: <ApiOutlined />,
    }
  );
};

const formatApiKey = (agent: AIAgent): string => {
  if (!agent.has_api_key) return "未配置";
  if (agent.api_key_last4) return `****${agent.api_key_last4}`;
  return "已配置";
};

// 表格列配置函数
export const getAgentColumns = (
  handleEdit: (record: AIAgent) => void,
  handleDelete: (id: number) => void,
  handleToggleActive: (id: number, isActive: boolean) => void,
  handleViewDetails: (record: AIAgent) => void,
  handleTestAgent: (id: number, name: string) => void,
) => [
  {
    title: "名称",
    dataIndex: "agent_name",
    key: "agent_name",
    width: 200,
    render: (agentName: string, record: AIAgent) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: '#f0f5ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1890ff',
          fontSize: 18
        }}>
          {record.agent_type === 'dify' ? <CloudOutlined /> : <ThunderboltOutlined />}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#2c3e50', marginBottom: 2 }}>
            {agentName || record.name}
          </div>
          {record.model_name && (
            <div style={{ fontSize: 12, color: "#7f8c8d" }}>
              {record.model_name}
            </div>
          )}
        </div>
      </div>
    ),
    sorter: (a: AIAgent, b: AIAgent) => {
      const nameA = a.agent_name || a.name || "";
      const nameB = b.agent_name || b.name || "";
      return nameA.localeCompare(nameB);
    },
  },
  {
    title: "类型",
    dataIndex: "agent_type",
    key: "agent_type",
    width: 120,
    render: (agentType: string) => {
      const config = getTypeConfig(agentType);
      return (
        <Tag color={config.color} icon={config.icon}>
          {config.text}
        </Tag>
      );
    },
  },
  {
  },
  {
    title: "描述",
    dataIndex: "description",
    key: "description",
    width: 260,
    render: (text: string | undefined) => {
      const v = (text || "").trim();
      if (!v) return <span style={{ color: '#bfbfbf' }}>无</span>;
      const short = v.length > 60 ? v.slice(0, 60) + "…" : v;
      return <span title={v}>{short}</span>;
    },
  },
  {
    title: "API密钥",
    dataIndex: "api_key",
    key: "api_key",
    width: 180,
    render: (_: string | undefined, record: AIAgent) => (
      <Tooltip title={record.has_api_key ? "已保存API密钥" : "未配置API密钥"}>
        <Tag
          icon={<KeyOutlined />}
          color={record.has_api_key ? "orange" : "default"}
        >
          {formatApiKey(record)}
        </Tag>
      </Tooltip>
    ),
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 100,
    render: (status: boolean, record: AIAgent) => (
      <Switch
        checked={status}
        checkedChildren="启用"
        unCheckedChildren="停用"
        onChange={(checked) => handleToggleActive(record.id, checked)}
      />
    ),
  },
  {
    title: "创建时间",
    dataIndex: "created_at",
    key: "created_at",
    width: 150,
    render: (date: string) => dayjs(date).format("YYYY-MM-DD"),
    sorter: (a: AIAgent, b: AIAgent) =>
      dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
  },
  {
    title: "操作",
    key: "action",
    width: 180,
    fixed: "right" as const,
    render: (_: any, record: AIAgent) => (
      <Space size={4}> {/* Tighter spacing */}
        <Tooltip title="查看详情">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          />
        </Tooltip>
        <Tooltip title="编辑">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
        </Tooltip>
        <Tooltip title="测试连接">
          <Button
            type="text"
            size="small"
            icon={<ThunderboltOutlined style={{ color: '#fa8c16' }} />}
            onClick={() => handleTestAgent(record.id, record.name)}
          />
        </Tooltip>
        <Tooltip title="删除">
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(record.id)}
          />
        </Tooltip>
      </Space>
    ),
  },
];
