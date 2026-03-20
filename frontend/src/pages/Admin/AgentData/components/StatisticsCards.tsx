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
  <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
    {items.map((item) => (
      <div
        key={item.key}
        style={{
          flex: "1 1 0",
          minWidth: 160,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "#FAFAFA",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: item.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: item.color,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {item.icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 12, display: "block", lineHeight: "16px" }}>
            {item.label}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: 600, color: item.color, lineHeight: "24px" }}>
            {formatValue(item.field, (data as any)[item.field])}
          </Text>
        </div>
      </div>
    ))}
  </div>
);

export default StatisticsCards;
