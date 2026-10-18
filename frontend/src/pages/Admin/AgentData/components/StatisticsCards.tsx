/** 使用概览 — 连续摘要，统计含义由排版区分。 */
import React from "react";
import type { StatisticsData } from "@services/znt/types";

interface StatisticsCardsProps {
  data: StatisticsData;
}

const groups = [
  {
    className: "ws-usage-overview-primary",
    items: [
      { label: "总使用量", field: "total_usage" },
      { label: "活跃学生", field: "active_students" },
      { label: "活跃智能体", field: "active_agents" },
    ],
  },
  {
    className: "ws-usage-overview-period",
    items: [
      { label: "平均响应", field: "avg_response_time" },
      { label: "今日使用", field: "today_usage" },
      { label: "近7天", field: "week_usage" },
      { label: "近30天", field: "month_usage" },
    ],
  },
] as const;

const formatValue = (field: string, value: number) => {
  if (field === "avg_response_time") {
    if (!value) return "—";
    return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`;
  }
  return value;
};

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ data }) => (
  <dl className="ws-usage-overview" aria-label="使用概览">
    {groups.map((group) => (
      <div key={group.className} className={`ws-usage-overview-group ${group.className}`}>
        {group.items.map((item) => (
          <div key={item.field} className="ws-usage-overview-item">
            <dt>{item.label}</dt>
            <dd>{formatValue(item.field, data[item.field] ?? 0)}</dd>
          </div>
        ))}
      </div>
    ))}
  </dl>
);

export default StatisticsCards;
