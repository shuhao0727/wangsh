/**
 * 统计卡片 — 紧凑横排，每个卡片：图标 + 标签 + 数值
 */

import React from "react";
import { Typography } from "antd";
import {
  BarChartOutlined,
  UserOutlined,
  RobotOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { StatisticsData } from "@services/znt/types";

const { Text } = Typography;

interface StatisticsCardsProps {
  data: StatisticsData;
}

const items = [
  { key: "total_usage", label: "总使用量", field: "total_usage", icon: <BarChartOutlined />, color: "#0EA5E9", bg: "rgba(14, 165, 233, 0.06)" },
  { key: "active_students", label: "活跃学生", field: "active_students", icon: <UserOutlined />, color: "#10B981", bg: "rgba(16, 185, 129, 0.06)" },
  { key: "active_agents", label: "活跃智能体", field: "active_agents", icon: <RobotOutlined />, color: "#6366F1", bg: "rgba(99, 102, 241, 0.06)" },
  { key: "avg_response_time", label: "平均响应", field: "avg_response_time", icon: <ClockCircleOutlined />, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.06)" },
] as const;

const formatValue = (field: string, value: number) => {
  if (field === "avg_response_time") {
    if (!value) return "-";
    return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`;
  }
  return value ?? 0;
};

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ data }) => (
  <div className="flex gap-3 mb-4 flex-wrap">
    {items.map((item) => (
      <div
        key={item.key}
        className="flex-1 min-w-[160px] flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 rounded-xl"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ background: item.bg, color: item.color }}
        >
          {item.icon}
        </div>
        <div className="min-w-0 flex-1">
          <Text type="secondary" className="!text-xs !block !leading-4">
            {item.label}
          </Text>
          <Text className="!text-lg !font-semibold !leading-6" style={{ color: item.color }}>
            {formatValue(item.field, (data as any)[item.field])}
          </Text>
        </div>
      </div>
    ))}
  </div>
);

export default StatisticsCards;
