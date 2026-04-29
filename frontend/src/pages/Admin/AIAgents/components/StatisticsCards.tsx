import React from "react";
import { Bot, Cloud, Cpu, Zap } from "lucide-react";
import { StatCard } from "@components/Common/StatCard";
import { AgentStatisticsData } from "@services/znt/types";

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
    { key: "total", label: "智能体总数", value: total ?? data.total_agents ?? 0, icon: <Bot className="h-4 w-4" /> },
    { key: "general", label: "通用智能体", value: generalCount ?? 0, icon: <Zap className="h-4 w-4" /> },
    { key: "dify", label: "Dify智能体", value: difyCount ?? 0, icon: <Cloud className="h-4 w-4" /> },
    { key: "active", label: "启用中", value: activeCount ?? data.active_agents ?? 0, icon: <Cpu className="h-4 w-4" /> },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {items.map((item) => (
        <StatCard
          key={item.key}
          label={item.label}
          value={item.value}
          icon={item.icon}
          variant="horizontal"
          color={colorMap[item.key]}
        />
      ))}
    </div>
  );
};

export default StatisticsCards;
