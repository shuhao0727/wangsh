/**
 * 统计卡片 — 紧凑横排，每个卡片：图标 + 标签 + 数值
 */

import React from "react";
import {
  BarChart3,
  User,
  Bot,
  Clock,
  CalendarDays,
  TrendingUp,
  CalendarRange,
} from "lucide-react";
import type { StatisticsData } from "@services/znt/types";

interface StatisticsCardsProps {
  data: StatisticsData;
}

const items = [
  { key: "total_usage", label: "总使用量", field: "total_usage", icon: <BarChart3 className="h-3.5 w-3.5" />, color: "var(--ws-color-primary)", bg: "rgba(14, 165, 233, 0.06)" },
  { key: "active_students", label: "活跃学生", field: "active_students", icon: <User className="h-3.5 w-3.5" />, color: "var(--ws-color-success)", bg: "rgba(16, 185, 129, 0.06)" },
  { key: "active_agents", label: "活跃智能体", field: "active_agents", icon: <Bot className="h-3.5 w-3.5" />, color: "var(--ws-color-secondary)", bg: "rgba(99, 102, 241, 0.06)" },
  { key: "avg_response_time", label: "平均响应", field: "avg_response_time", icon: <Clock className="h-3.5 w-3.5" />, color: "var(--ws-color-warning)", bg: "rgba(245, 158, 11, 0.06)" },
  { key: "today_usage", label: "今日使用", field: "today_usage", icon: <CalendarDays className="h-3.5 w-3.5" />, color: "var(--ws-color-info, #0ea5e9)", bg: "rgba(14, 165, 233, 0.06)" },
  { key: "week_usage", label: "近7天", field: "week_usage", icon: <TrendingUp className="h-3.5 w-3.5" />, color: "var(--ws-color-danger, #ef4444)", bg: "rgba(239, 68, 68, 0.06)" },
  { key: "month_usage", label: "近30天", field: "month_usage", icon: <CalendarRange className="h-3.5 w-3.5" />, color: "var(--ws-color-accent, #8b5cf6)", bg: "rgba(139, 92, 246, 0.06)" },
] as const;

const formatValue = (field: string, value: number) => {
  if (field === "avg_response_time") {
    if (!value) return "-";
    return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`;
  }
  return value ?? 0;
};

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ data }) => (
  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-7">
    {items.map((item) => (
      <div
        key={item.key}
        className="flex min-h-0 items-center justify-between gap-2 rounded-lg bg-surface-2 px-2 py-1.5"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
            style={{ background: item.bg, color: item.color }}
          >
            {item.icon}
          </div>
          <div className="min-w-0 text-sm text-text-tertiary">{item.label}</div>
        </div>
        <div className="shrink-0 text-right text-lg font-semibold leading-5 tabular-nums" style={{ color: item.color }}>
          {formatValue(item.field, (data as any)[item.field])}
        </div>
      </div>
    ))}
  </div>
);

export default StatisticsCards;
