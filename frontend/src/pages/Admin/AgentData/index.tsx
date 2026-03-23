/**
 * 智能体数据页面
 * 布局：统计卡片 → Tab 导航 → 内容面板（flex 撑满，分页固定底部）
 */

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Typography, Tabs } from "antd";

import StatisticsCards from "./components/StatisticsCards";
import UsageRecordPanel from "./components/UsageRecordPanel";
import { HotQuestionsPanel, StudentQuestionChainsPanel } from "./components/AnalysisPanel";

import type { StatisticsData } from "@services/znt/types";
import { agentDataApi } from "@services/agents";
import { AdminPage } from "@components/Admin";

const { Title } = Typography;

type TabKey = "usage" | "hot" | "chains";

const normalizeTab = (tab: string | null): TabKey => {
  if (tab === "analysis") return "hot";
  if (tab === "usage" || tab === "hot" || tab === "chains") return tab;
  return "usage";
};

const AdminAgentData: React.FC = () => {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const [activeTabKey, setActiveTabKey] = useState<TabKey>(normalizeTab(urlSearchParams.get("tab")));
  const [statistics, setStatistics] = useState<StatisticsData>({
    total_usage: 0, active_students: 0, active_agents: 0,
    avg_response_time: 0, today_usage: 0, week_usage: 0, month_usage: 0,
  });

  const loadStatistics = useCallback(async () => {
    try {
      const res = await agentDataApi.getStatistics({ page: 1, page_size: 20 });
      if (res.success) setStatistics(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStatistics(); }, [loadStatistics]);

  useEffect(() => {
    const next = normalizeTab(urlSearchParams.get("tab"));
    if (next !== activeTabKey) setActiveTabKey(next);
  }, [urlSearchParams, activeTabKey]);

  const handleTabChange = (key: string) => {
    const next = normalizeTab(key);
    setActiveTabKey(next);
    const nextParams = new URLSearchParams(urlSearchParams);
    nextParams.set("tab", next);
    setUrlSearchParams(nextParams, { replace: true });
  };

  return (
    <AdminPage padding={24} scrollable={false}>
      <div className="flex flex-col h-full min-h-0">
        {/* 统计卡片 */}
        <div className="flex-none">
          <StatisticsCards data={statistics} />
        </div>

        {/* Tab 导航 */}
        <div className="flex-none">
          <Tabs
            activeKey={activeTabKey}
            onChange={handleTabChange}
            items={[
              { key: "usage", label: "使用记录" },
              { key: "hot", label: "热点问题" },
              { key: "chains", label: "学生提问链条" },
            ]}
            className="!mb-0"
          />
        </div>

        {/* 内容面板 — 占满剩余空间 */}
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTabKey === "usage" && <UsageRecordPanel />}
          {activeTabKey === "hot" && <HotQuestionsPanel />}
          {activeTabKey === "chains" && <StudentQuestionChainsPanel />}
        </div>
      </div>
    </AdminPage>
  );
};

export default AdminAgentData;
