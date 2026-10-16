import React from "react";
import { Bot, Cloud, Cpu, Zap } from "lucide-react";
import { StatCard } from "@components/Common/StatCard";
import type { AgentStatisticsData } from "@services/znt/types";

interface StatisticsCardsProps {
  data: AgentStatisticsData;
}

const colorMap: Record<string, "primary" | "success" | "warning" | "purple"> = {
  total: "primary",
  general: "success",
  dify: "purple",
  active: "warning",
};

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ data }) => {
  const { total, generalCount, difyCount, activeCount } = data;

  const items = [
    { key: "total", label: "智能体总数", value: total ?? data.total_agents ?? 0, icon: <Bot className="h-3.5 w-3.5" /> },
    { key: "general", label: "通用智能体", value: generalCount ?? 0, icon: <Zap className="h-3.5 w-3.5" /> },
    { key: "dify", label: "Dify智能体", value: difyCount ?? 0, icon: <Cloud className="h-3.5 w-3.5" /> },
    { key: "active", label: "启用中", value: activeCount ?? data.active_agents ?? 0, icon: <Cpu className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {items.map((item) => (
        <StatCard
          key={item.key}
          label={item.label}
          value={item.value}
          icon={item.icon}
          variant="horizontal"
          color={colorMap[item.key]}
          className="min-h-0 px-2 py-1.5 [&>div:first-child]:gap-1.5 [&>div:first-child>div:first-child]:h-6 [&>div:first-child>div:first-child]:w-6 [&>div:last-child]:text-lg [&>div:last-child]:leading-5"
        />
      ))}
    </div>
  );
};

export default StatisticsCards;
