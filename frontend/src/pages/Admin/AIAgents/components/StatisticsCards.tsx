import React from "react";
import {
  RobotOutlined,
  ThunderboltOutlined,
  CloudOutlined,
  ApiOutlined,
} from "@ant-design/icons";
import { AgentStatisticsData } from "@services/znt/types";

interface StatisticsCardsProps {
  data: AgentStatisticsData;
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ data }) => {
  const { total, generalCount, difyCount, activeCount } = data;

  const items = [
    {
      key: "total",
      label: "智能体总数",
      value: total ?? data.total_agents ?? 0,
      color: "#0EA5E9",
      bg: "rgba(14,165,233,0.08)",
      icon: <RobotOutlined />,
    },
    {
      key: "general",
      label: "通用智能体",
      value: generalCount ?? 0,
      color: "#10B981",
      bg: "rgba(16,185,129,0.08)",
      icon: <ThunderboltOutlined />,
    },
    {
      key: "dify",
      label: "Dify智能体",
      value: difyCount ?? 0,
      color: "#6366F1",
      bg: "rgba(99,102,241,0.08)",
      icon: <CloudOutlined />,
    },
    {
      key: "active",
      label: "启用中",
      value: activeCount ?? data.active_agents ?? 0,
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.08)",
      icon: <ApiOutlined />,
    },
  ];

  return (
    <div className="flex gap-3 mb-4 flex-wrap">
      {items.map((item) => (
        <div key={item.key} className="flex-1 min-w-[160px] flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 rounded-xl">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
            style={{ background: item.bg, color: item.color }}
          >
            {item.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs block leading-4 text-text-secondary">{item.label}</div>
            <div className="text-lg font-semibold leading-6" style={{ color: item.color }}>{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatisticsCards;
