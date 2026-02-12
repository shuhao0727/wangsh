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

// 处理API密钥显示
const formatApiKey = (apiKey: string | undefined): string => {
  if (!apiKey) return "未配置";
  return apiKey.length > 8
    ? `${apiKey.substring(0, 4)}****${apiKey.substring(apiKey.length - 4)}`
    : "****";
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
    width: 180,
    render: (agentName: string, record: AIAgent) => (
      <div>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>
          {agentName || record.name}
        </div>
        {record.model_name && (
          <div style={{ fontSize: 12, color: "var(--ws-color-text-secondary)" }}>{record.model_name}</div>
        )}
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
    title: "API地址",
    dataIndex: "api_endpoint",
    key: "api_endpoint",
    width: 220,
    render: (url: string | undefined) => (
      <Tooltip title={url || "未配置"}>
        <div
          style={{
            maxWidth: "200px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: url ? "inherit" : "var(--ws-color-text-secondary)",
          }}
        >
          <LinkOutlined
            style={{
              marginRight: 4,
              color: url ? "var(--ws-color-primary)" : "var(--ws-color-text-secondary)",
            }}
          />
          {url ? url.replace(/^https?:\/\//, "") : "未配置"}
        </div>
      </Tooltip>
    ),
  },
  {
    title: "API密钥",
    dataIndex: "api_key",
    key: "api_key",
    width: 180,
    render: (apiKey: string | undefined) => (
      <Tooltip title={apiKey ? "点击查看（部分隐藏）" : "未配置API密钥"}>
        <Tag
          icon={<KeyOutlined />}
          color={apiKey ? "orange" : "default"}
          style={{ cursor: "pointer" }}
        >
          {formatApiKey(apiKey)}
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
      <Space size="small">
        <Tooltip title="查看详情">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          />
        </Tooltip>
        <Tooltip title="编辑">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
        </Tooltip>
        <Tooltip title="测试">
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            type="primary"
            onClick={() => handleTestAgent(record.id, record.name)}
          />
        </Tooltip>
        <Tooltip title="删除">
          <Button
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
