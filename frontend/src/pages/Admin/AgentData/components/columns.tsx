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
    width: 200,
    fixed: "left" as const,
    render: (_: any, record: AgentUsageData) => {
      const user = record.user;
      if (!user) return "-";

      return (
        <div>
          <div
            className="flex items-center mb-1 flex-wrap gap-1"
          >
            <div className="flex items-center min-w-0" style={{ flex: '0 1 auto' }}>
              <UserOutlined className="mr-1 flex-shrink-0 text-primary" />
              <Text strong className="overflow-hidden text-ellipsis whitespace-nowrap" title={user.name}>{user.name}</Text>
            </div>
            <Tag
              color={
                user.is_active
                  ? userStatusConfig.active.color
                  : userStatusConfig.inactive.color
              }
              style={{ fontSize: "10px", padding: "0 4px", lineHeight: "16px", height: "18px", margin: 0 }}
            >
              {user.is_active
                ? userStatusConfig.active.text
                : userStatusConfig.inactive.text}
            </Tag>
          </div>
          <div className="text-xs mb-0.5 text-text-secondary">
            学号: {user.student_id}
          </div>
          <div className="text-xs overflow-hidden text-ellipsis whitespace-nowrap text-text-secondary" title={`${user.grade} • ${user.class_name}`}>
            {user.grade} • {user.class_name}
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
    width: 200,
    render: (_: any, record: AgentUsageData) => {
      const agent = record.moxing;
      if (!agent) return "-";

      const config =
        agentTypeConfig[agent.agent_type as keyof typeof agentTypeConfig] ||
        agentTypeConfig.default;

      return (
        <div>
          <div
            className="flex items-center mb-1"
          >
            {config.icon}
            <Text strong className="ml-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{ maxWidth: '140px' }} title={agent.agent_name}>
              {agent.agent_name}
            </Text>
          </div>
          <Tag
            color={config.color}
            style={{ fontSize: "12px", padding: "0 6px" }}
          >
            {config.text}
          </Tag>
          <div className="text-xs mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-text-secondary" title={`模型: ${agent.model_name}`}>
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
        <div className="leading-relaxed overflow-hidden" style={{ textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          <MessageOutlined className="mr-1" style={{ color: "#10B981" }} />
          {question}
        </div>
      </Tooltip>
    ),
  },
  {
    title: "回答摘要",
    dataIndex: "answer",
    key: "answer_summary",
    width: undefined, // Let it be flexible
    render: (answer: string) => {
      return (
        <Tooltip title={answer}>
          <div className="leading-relaxed overflow-hidden text-text-secondary line-clamp-2">{answer}</div>
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
      <div className="flex items-center">
        <ClockCircleOutlined className="mr-1" style={{ color: "#F59E0B" }} />
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
      <div className="flex items-center">
        <CalendarOutlined className="mr-1" style={{ color: "#0EA5E9" }} />
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
          className="text-xs font-mono rounded px-1.5 py-0.5 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap bg-surface-2"
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
          <div className="text-xs text-text-secondary">{user.student_id}</div>
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
            className="max-w-[100px] overflow-hidden text-ellipsis"
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
