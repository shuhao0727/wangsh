/**
 * 智能体数据页面
 * 布局：统计卡片 → Tab 导航 → 内容面板（flex 撑满，分页固定底部）
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import StatisticsCards from "./components/StatisticsCards";
import UsageRecordPanel from "./components/UsageRecordPanel";
import TaskAnalysisListPanel from "./components/TaskAnalysisListPanel";

import type { StatisticsData, SearchFilterParams } from "@services/znt/types";
import { agentDataApi } from "@services/agents";
import { AdminPage } from "@components/Admin";
import { BarChart3, MessageSquareText, GitFork } from "lucide-react";

type TabKey = "usage" | "hot" | "chains";

const normalizeTab = (tab: string | null): TabKey => {
  if (tab === "analysis") return "hot";
  if (tab === "task") return "chains";
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
  const filterRef = useRef<SearchFilterParams>({});

  const loadStatistics = useCallback(async (filters?: SearchFilterParams) => {
    try {
      const params = filters || filterRef.current;
      const res = await agentDataApi.getStatistics(params);
      if (res.success) setStatistics(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadStatistics(); }, [loadStatistics]);

  const handleFilterChange = useCallback((params: SearchFilterParams) => {
    filterRef.current = params;
    void loadStatistics(params);
  }, [loadStatistics]);

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
    <AdminPage padding="var(--ws-panel-padding)" scrollable={false}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* 统计卡片 */}
        <StatisticsCards data={statistics} />

        {/* Tab 导航 + 内容 */}
        <Tabs
          value={activeTabKey}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="inline-flex h-10 w-fit gap-1">
            <TabsTrigger value="usage" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              使用记录
            </TabsTrigger>
            <TabsTrigger value="hot" className="gap-1.5">
              <MessageSquareText className="h-3.5 w-3.5" />
              热点问题
            </TabsTrigger>
            <TabsTrigger value="chains" className="gap-1.5">
              <GitFork className="h-3.5 w-3.5" />
              学生问题链
            </TabsTrigger>
          </TabsList>

          <div style={{ display: activeTabKey === "usage" ? "flex" : "none" }} className="flex-1 min-h-0 flex-col pt-3">
            <UsageRecordPanel onFilterChange={handleFilterChange} />
          </div>
          <div style={{ display: activeTabKey === "hot" ? "flex" : "none" }} className="flex-1 min-h-0 flex-col pt-3">
            <TaskAnalysisListPanel analysisType="hot" detailView="timeline" />
          </div>
          <div style={{ display: activeTabKey === "chains" ? "flex" : "none" }} className="flex-1 min-h-0 flex-col pt-3">
            <TaskAnalysisListPanel analysisType="chains" detailView="beam" />
          </div>
        </Tabs>
      </div>
    </AdminPage>
  );
};

export default AdminAgentData;
