import React from "react";
import { Bot, Cloud, Cpu, Zap } from "lucide-react";
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
      color: "var(--ws-color-primary)",
      bg: "var(--ws-color-primary-soft)",
      icon: <Bot className="h-4 w-4" />,
    },
    {
      key: "general",
      label: "通用智能体",
      value: generalCount ?? 0,
      color: "var(--ws-color-success)",
      bg: "var(--ws-color-success-soft)",
      icon: <Zap className="h-4 w-4" />,
    },
    {
      key: "dify",
      label: "Dify智能体",
      value: difyCount ?? 0,
      color: "var(--ws-color-purple)",
      bg: "var(--ws-color-purple-soft)",
      icon: <Cloud className="h-4 w-4" />,
    },
    {
      key: "active",
      label: "启用中",
      value: activeCount ?? data.active_agents ?? 0,
      color: "var(--ws-color-warning)",
      bg: "var(--ws-color-warning-soft)",
      icon: <Cpu className="h-4 w-4" />,
    },
  ];

  return (
    <div className="flex gap-3 mb-4 flex-wrap">
      {items.map((item) => (
        <div key={item.key} className="flex-1 min-w-40 flex items-center gap-2.5 px-3.5 py-3 bg-surface-2 rounded-xl">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
            style={{ background: item.bg, color: item.color }}
          >
            {item.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm block leading-5 text-text-secondary">{item.label}</div>
            <div className="text-lg font-semibold leading-6" style={{ color: item.color }}>{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatisticsCards;
