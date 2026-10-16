/**
 * 智能体数据表格列配置
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Calendar,
  Clock,
  Eye,
  MessageCircle,
  User,
} from "lucide-react";
import dayjs from "dayjs";

import type { AgentUsageData } from "@services/znt/types";
import { HoverTip } from "@components/Common/HoverTip";

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
    text: "通用",
    icon: <Bot className="h-4 w-4" />,
    variant: "info" as const,
  },
  dify: {
    text: "Dify",
    icon: <Bot className="h-4 w-4" />,
    variant: "purple" as const,
  },
  default: {
    text: "未知",
    icon: <Bot className="h-4 w-4" />,
    variant: "cyan" as const,
  },
};

// 用户状态标签配置
const userStatusConfig = {
  active: {
    text: "活跃",
    variant: "success" as const,
  },
  inactive: {
    text: "未激活",
    variant: "danger" as const,
  },
};

// 表格列配置函数
export const getAgentDataColumns = (
  handleViewDetail: (record: AgentUsageData) => void,
) => [
  {
    title: "学生信息",
    key: "student_info",
    width: 170,
    fixed: "left" as const,
    render: (_: unknown, record: AgentUsageData) => {
      const user = record.user;
      if (!user) return "-";

      return (
        <div className="space-y-0.5">
          <div className="flex min-w-0 items-center gap-1">
            <User className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
            <span
              className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold"
              title={user.name}
            >
              {user.name}
            </span>
            <Badge
              variant={user.is_active ? userStatusConfig.active.variant : userStatusConfig.inactive.variant}
              className="shrink-0 whitespace-nowrap py-0 text-[10px] leading-[16px]"
            >
              {user.is_active ? userStatusConfig.active.text : userStatusConfig.inactive.text}
            </Badge>
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
    render: (_: unknown, record: AgentUsageData) => {
      const agent = record.moxing;
      if (!agent) return "-";

      const config =
        agentTypeConfig[agent.agent_type as keyof typeof agentTypeConfig] ||
        agentTypeConfig.default;

      return (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0">{config.icon}</span>
          <span
            className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold"
            title={agent.agent_name}
          >
            {agent.agent_name}
          </span>
          <Badge variant={config.variant} className="shrink-0 whitespace-nowrap text-[10px]">
            {config.text}
          </Badge>
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
    width: 220,
    render: (question: string) => (
      <HoverTip title={question} contentClassName="max-w-[460px] break-words">
        <div className="truncate max-w-full">
          <MessageCircle className="mr-1 inline h-4 w-4 align-text-bottom text-[var(--ws-color-success)]" />
          {question}
        </div>
      </HoverTip>
    ),
  },
  {
    title: "回答摘要",
    dataIndex: "answer",
    key: "answer_summary",
    width: 240,
    render: (answer: string) => (
      <HoverTip title={answer} contentClassName="max-w-[460px] break-words">
        <div className="truncate max-w-full text-text-secondary">
          {answer}
        </div>
      </HoverTip>
    ),
  },
  {
    title: "响应时间",
    dataIndex: "response_time_ms",
    key: "response_time",
    width: 100,
    render: (responseTime?: number) => (
      <div className="flex items-center whitespace-nowrap">
        <Clock className="mr-1 h-4 w-4 text-[var(--ws-color-warning)]" />
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
    width: 120,
    render: (date: string) => (
      <div className="flex items-center whitespace-nowrap">
        <Calendar className="mr-1 h-4 w-4 text-primary" />
        {dayjs(date).format("MM-DD HH:mm")}
      </div>
    ),
    sorter: (a: AgentUsageData, b: AgentUsageData) =>
      dayjs(a.used_at).unix() - dayjs(b.used_at).unix(),
    defaultSortOrder: "descend" as const,
  },
  {
    title: "操作",
    key: "action",
    width: 60,
    fixed: "right" as const,
    render: (_: unknown, record: AgentUsageData) => (
      <HoverTip title="查看详情">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewDetail(record)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </HoverTip>
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
    render: (_: unknown, record: AgentUsageData) => {
      const user = record.user;
      if (!user) return "-";
      return (
        <div>
          <span className="text-sm font-semibold">{user.name}</span>
          <div className="text-xs text-text-secondary">{user.student_id}</div>
        </div>
      );
    },
  },
  {
    title: "智能体",
    key: "agent",
    width: 120,
    render: (_: unknown, record: AgentUsageData) => {
      const agent = record.moxing;
      if (!agent) return "-";
      return (
        <HoverTip title={agent.agent_name}>
          <div className="max-w-[100px] overflow-hidden text-ellipsis">
            {agent.agent_name}
          </div>
        </HoverTip>
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
    render: (_: unknown, record: AgentUsageData) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleViewDetail(record)}
      >
        <Eye className="h-4 w-4" />
      </Button>
    ),
  },
];

const columns = {
  getAgentDataColumns,
  getCompactAgentDataColumns,
};

export default columns;
