/**
 * 智能体数据表格列配置
 */
import React from "react";
import { Space, Tag, Tooltip, Button, Typography } from "antd";
import {
  EyeOutlined,
  UserOutlined,
  RobotOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import type { AgentUsageData } from "@services/znt/types";

const { Text } = Typography;

// 格式化响应时间
const formatResponseTime = (ms?: number) => {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// 格式化问题内容（截断显示）
const formatQuestion = (question: string, maxLength: number = 50) => {
  if (question.length <= maxLength) return question;
  return `${question.substring(0, maxLength)}...`;
};

// 智能体类型标签配置
const agentTypeConfig = {
  general: {
    color: "blue" as const,
    text: "通用",
    icon: <RobotOutlined />,
  },
  dify: {
    color: "purple" as const,
    text: "Dify",
    icon: <RobotOutlined />,
  },
  default: {
    color: "cyan" as const,
    text: "未知",
    icon: <RobotOutlined />,
  },
};

// 用户状态标签配置
const userStatusConfig = {
  active: {
    color: "green" as const,
    text: "活跃",
  },
  inactive: {
    color: "red" as const,
    text: "未激活",
  },
};

// 表格列配置函数
export const getAgentDataColumns = (
  handleViewDetail: (record: AgentUsageData) => void,
) => [
  {
    title: "学生信息",
    key: "student_info",
    width: 180,
    fixed: "left" as const,
    render: (_: any, record: AgentUsageData) => {
      const user = record.user;
      if (!user) return "-";

      return (
        <div>
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 4 }}
          >
            <UserOutlined style={{ marginRight: 4, color: "var(--ws-color-primary)" }} />
            <Text strong>{user.name}</Text>
          </div>
          <div style={{ fontSize: 12, color: "var(--ws-color-text-secondary)", marginBottom: 2 }}>
            学号: {user.student_id}
          </div>
          <div style={{ fontSize: 12, color: "var(--ws-color-text-secondary)" }}>
            {user.grade} • {user.class_name}
          </div>
          <div style={{ marginTop: 4 }}>
            <Tag
              color={
                user.is_active
                  ? userStatusConfig.active.color
                  : userStatusConfig.inactive.color
              }
              style={{ fontSize: "12px", padding: "0 6px" }}
            >
              {user.is_active
                ? userStatusConfig.active.text
                : userStatusConfig.inactive.text}
            </Tag>
          </div>
        </div>
      );
    },
    sorter: (a: AgentUsageData, b: AgentUsageData) => {
      const nameA = a.user?.name || "";
      const nameB = b.user?.name || "";
      return nameA.localeCompare(nameB);
    },
  },
  {
    title: "智能体信息",
    key: "agent_info",
    width: 180,
    render: (_: any, record: AgentUsageData) => {
      const agent = record.moxing;
      if (!agent) return "-";

      const config =
        agentTypeConfig[agent.agent_type as keyof typeof agentTypeConfig] ||
        agentTypeConfig.default;

      return (
        <div>
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 4 }}
          >
            {config.icon}
            <Text strong style={{ marginLeft: 4 }}>
              {agent.agent_name}
            </Text>
          </div>
          <Tag
            color={config.color}
            style={{ fontSize: "12px", padding: "0 6px" }}
          >
            {config.text}
          </Tag>
          <div style={{ fontSize: 12, color: "var(--ws-color-text-secondary)", marginTop: 4 }}>
            模型: {agent.model_name}
          </div>
        </div>
      );
    },
    sorter: (a: AgentUsageData, b: AgentUsageData) => {
      const agentA = a.moxing?.agent_name || "";
      const agentB = b.moxing?.agent_name || "";
      return agentA.localeCompare(agentB);
    },
  },
  {
    title: "问题内容",
    dataIndex: "question",
    key: "question",
    width: 250,
    render: (question: string) => (
      <Tooltip title={question}>
        <div style={{ lineHeight: 1.5 }}>
          <MessageOutlined style={{ marginRight: 4, color: "#52c41a" }} />
          {formatQuestion(question)}
        </div>
      </Tooltip>
    ),
  },
  {
    title: "回答摘要",
    dataIndex: "answer",
    key: "answer_summary",
    width: 300,
    render: (answer: string) => {
      const summary =
        answer.length > 60 ? `${answer.substring(0, 60)}...` : answer;

      return (
        <Tooltip title={answer}>
          <div style={{ lineHeight: 1.5, color: "var(--ws-color-text-secondary)" }}>{summary}</div>
        </Tooltip>
      );
    },
  },
  {
    title: "响应时间",
    dataIndex: "response_time_ms",
    key: "response_time",
    width: 120,
    render: (responseTime?: number) => (
      <div style={{ display: "flex", alignItems: "center" }}>
        <ClockCircleOutlined style={{ marginRight: 4, color: "#fa8c16" }} />
        {formatResponseTime(responseTime)}
      </div>
    ),
    sorter: (a: AgentUsageData, b: AgentUsageData) =>
      (a.response_time_ms || 0) - (b.response_time_ms || 0),
  },
  {
    title: "使用时间",
    dataIndex: "used_at",
    key: "used_at",
    width: 150,
    render: (date: string) => (
      <div style={{ display: "flex", alignItems: "center" }}>
        <CalendarOutlined style={{ marginRight: 4, color: "#1890ff" }} />
        {dayjs(date).format("MM-DD HH:mm")}
      </div>
    ),
    sorter: (a: AgentUsageData, b: AgentUsageData) =>
      dayjs(a.used_at).unix() - dayjs(b.used_at).unix(),
    defaultSortOrder: "descend" as const,
  },
  {
    title: "会话ID",
    dataIndex: "session_id",
    key: "session_id",
    width: 140,
    render: (sessionId?: string) => (
      <Tooltip title={sessionId}>
        <div
          style={{
            fontSize: "12px",
            fontFamily: "monospace",
            backgroundColor: "var(--ws-color-surface-2)",
            padding: "2px 6px",
            borderRadius: "3px",
            maxWidth: "120px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sessionId || "-"}
        </div>
      </Tooltip>
    ),
  },
  {
    title: "操作",
    key: "action",
    width: 80,
    fixed: "right" as const,
    render: (_: any, record: AgentUsageData) => (
      <Space size="small">
        <Tooltip title="查看详情">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          />
        </Tooltip>
      </Space>
    ),
  },
];

// 导出简洁版的列配置（用于快速查看）
export const getCompactAgentDataColumns = (
  handleViewDetail: (record: AgentUsageData) => void,
) => [
  {
    title: "学生",
    key: "student",
    width: 120,
    render: (_: any, record: AgentUsageData) => {
      const user = record.user;
      if (!user) return "-";
      return (
        <div>
          <Text strong>{user.name}</Text>
          <div style={{ fontSize: 12, color: "var(--ws-color-text-secondary)" }}>{user.student_id}</div>
        </div>
      );
    },
  },
  {
    title: "智能体",
    key: "agent",
    width: 120,
    render: (_: any, record: AgentUsageData) => {
      const agent = record.moxing;
      if (!agent) return "-";
      return (
        <Tooltip title={agent.agent_name}>
          <div
            style={{
              maxWidth: "100px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {agent.agent_name}
          </div>
        </Tooltip>
      );
    },
  },
  {
    title: "问题",
    dataIndex: "question",
    key: "question",
    width: 200,
    render: (question: string) => formatQuestion(question, 40),
  },
  {
    title: "时间",
    dataIndex: "used_at",
    key: "time",
    width: 120,
    render: (date: string) => dayjs(date).format("HH:mm"),
  },
  {
    title: "操作",
    key: "action",
    width: 80,
    render: (_: any, record: AgentUsageData) => (
      <Space size="small">
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        />
      </Space>
    ),
  },
];

const columns = {
  getAgentDataColumns,
  getCompactAgentDataColumns,
};

export default columns;
