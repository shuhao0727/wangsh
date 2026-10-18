import React from "react";
import type { AgentStatisticsData } from "@services/znt/types";
import { cn } from "@/lib/utils";

interface StatisticsCardsProps {
  data: AgentStatisticsData;
  className?: string;
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ data, className }) => {
  const { total, generalCount, difyCount, activeCount } = data;

  const items = [
    { key: "total", label: "智能体", value: total ?? data.total_agents ?? 0 },
    { key: "general", label: "通用", value: generalCount ?? 0 },
    { key: "dify", label: "Dify", value: difyCount ?? 0 },
    {
      key: "active",
      label: "启用中",
      value: activeCount ?? data.active_agents ?? 0,
    },
  ];

  return (
    <dl className={cn("flex flex-wrap items-center gap-x-6 gap-y-1.5 px-4 py-2.5", className)}>
      {items.map((item) => (
        <div key={item.key} className="inline-flex items-baseline gap-1.5">
          <dt className="text-xs text-text-secondary">{item.label}</dt>
          <dd
            className={`text-sm font-semibold tabular-nums ${item.key === "total" ? "text-primary" : "text-text-base"}`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

export default StatisticsCards;
