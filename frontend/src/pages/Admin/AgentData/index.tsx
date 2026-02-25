/**
 * 智能体数据统计页面 - 学生使用智能体情况统计
 * 重构版：手动 Tab 切换，彻底解决布局和滚动条问题
 */

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, message } from "antd";

// 导入组件
import StatisticsCards from "./components/StatisticsCards";
import UsageRecordPanel from "./components/UsageRecordPanel";
import {
  HotQuestionsPanel,
  StudentQuestionChainsPanel,
} from "./components/AnalysisPanel";

// 导入类型和API
import type { StatisticsData } from "@services/znt/types";
import { agentDataApi } from "@services/agents";
import { AdminPage } from "@components/Admin";

type TabKey = "usage" | "hot" | "chains";

const normalizeTab = (tab: string | null): TabKey => {
  if (tab === "analysis") return "hot";
  if (tab === "usage" || tab === "hot" || tab === "chains") return tab;
  return "usage";
};

const AdminAgentData: React.FC = () => {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const [activeTabKey, setActiveTabKey] = useState<TabKey>(
    normalizeTab(urlSearchParams.get("tab")),
  );
  const [statistics, setStatistics] = useState<StatisticsData>({
    total_usage: 0,
    active_students: 0,
    active_agents: 0,
    avg_response_time: 0,
    today_usage: 0,
    week_usage: 0,
    month_usage: 0,
  });

  const loadStatistics = useCallback(async () => {
    try {
      const res = await agentDataApi.getStatistics({ page: 1, page_size: 20 });
      if (res.success) {
        setStatistics(res.data);
        return;
      }
      message.error(res.message || "加载统计信息失败");
    } catch {
      message.error("加载统计信息失败");
    }
  }, []);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  useEffect(() => {
    const tab = urlSearchParams.get("tab");
    const next = normalizeTab(tab);
    if (next !== activeTabKey) setActiveTabKey(next);
  }, [urlSearchParams, activeTabKey]);

  // Tab 切换处理
  const handleTabChange = (key: string) => {
    const next = normalizeTab(key);
    setActiveTabKey(next);
    const nextParams = new URLSearchParams(urlSearchParams);
    nextParams.set("tab", next);
    setUrlSearchParams(nextParams, { replace: true });
  };

  return (
    <AdminPage padding={16} scrollable={false}>
      {/* 使用 Flex 列布局，高度占满 */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        
        {/* 顶部统计卡片 - 固定高度 */}
        <div style={{ flex: "none" }}>
          <StatisticsCards data={statistics} />
        </div>

        {/* Tab 导航栏 - 固定高度 */}
        <div style={{ flex: "none", marginBottom: 16 }}>
          <Tabs
            activeKey={activeTabKey}
            onChange={handleTabChange}
            items={[
              { key: "usage", label: "使用记录" },
              { key: "hot", label: "热点问题" },
              { key: "chains", label: "学生提问链条" },
            ]}
            // 关键：不使用 Tabs 的 children 渲染内容，仅作为导航
          />
        </div>

        {/* 内容区域 - 占据剩余空间，严格限制溢出 */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeTabKey === "usage" && <UsageRecordPanel />}
          {activeTabKey === "hot" && <HotQuestionsPanel />}
          {activeTabKey === "chains" && <StudentQuestionChainsPanel />}
        </div>
      </div>
    </AdminPage>
  );
};

export default AdminAgentData;
