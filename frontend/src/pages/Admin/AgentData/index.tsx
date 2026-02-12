/**
 * 智能体数据统计页面 - 学生使用智能体情况统计
 * 参考首页和AI智能体管理页面的UI设计
 */

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Tabs,
  Table,
  message,
  Pagination,
} from "antd";
import dayjs from "dayjs";

// 导入组件
import StatisticsCards from "./components/StatisticsCards";
import SearchBar from "./components/SearchBar";
import DetailModal from "./components/DetailModal";
import { getAgentDataColumns } from "./components/columns";
import AnalysisPanel from "./components/AnalysisPanel";

// 导入类型和API
import type {
  AgentUsageData,
  SearchFilterParams,
  StatisticsData,
} from "@services/znt/types";
import { agentDataApi } from "@services/agents";
import { AdminPage, AdminTablePanel } from "@components/Admin";

const AdminAgentData: React.FC = () => {
  const [urlSearchParams] = useSearchParams();
  const [activeTabKey, setActiveTabKey] = useState<string>(
    urlSearchParams.get("tab") === "analysis" ? "analysis" : "usage",
  );
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentUsageData[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 筛选状态
  const [searchParams, setSearchParams] = useState<SearchFilterParams>({
    page: 1,
    page_size: 20,
  });

  // 详情弹窗状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<AgentUsageData | null>(
    null,
  );

  // 统计信息状态
  const [statistics, setStatistics] = useState<StatisticsData>({
    total_usage: 0,
    active_students: 0,
    active_agents: 0,
    avg_response_time: 0,
    today_usage: 0,
    week_usage: 0,
    month_usage: 0,
  });

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        ...searchParams,
        page: currentPage,
        page_size: pageSize,
      };

      const [listResponse, statsResponse] = await Promise.all([
        agentDataApi.getAgentData(params),
        agentDataApi.getStatistics(params),
      ]);

      if (listResponse.success) {
        setData(listResponse.data.items || []);
        setTotal(listResponse.data.total || 0);
        setSelectedRowKeys([]);
      } else {
        message.error(listResponse.message || "加载数据失败");
      }

      if (statsResponse.success) {
        setStatistics(statsResponse.data);
      } else {
        message.error(statsResponse.message || "加载统计信息失败");
      }
    } catch (error) {
      console.error("加载数据失败:", error);
      message.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchParams]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const tab = urlSearchParams.get("tab");
    if (tab && tab !== activeTabKey) {
      setActiveTabKey(tab === "analysis" ? "analysis" : "usage");
    }
  }, [urlSearchParams, activeTabKey]);

  // 处理搜索
  const handleSearch = (params: SearchFilterParams) => {
    setSearchParams({
      ...params,
      page: 1,
      page_size: pageSize,
    });
    setCurrentPage(1);
  };

  // 处理重置
  const handleReset = () => {
    setSearchParams({
      page: 1,
      page_size: pageSize,
    });
    setCurrentPage(1);
  };

  // 处理分页变化
  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page);
    if (size) setPageSize(size);

    setSearchParams((prev) => ({
      ...prev,
      page,
      page_size: size || pageSize,
    }));
  };

  // 处理查看详情
  const handleViewDetail = (record: AgentUsageData) => {
    setCurrentRecord(record);
    setDetailVisible(true);
  };

  // 表格行选择
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  const handleExportSelected = async () => {
    const selectedRecords = data.filter((r) => selectedRowKeys.includes(r.id));
    const sessionIds = selectedRecords
      .map((r) => r.session_id)
      .filter((s): s is string => Boolean(s));
    if (sessionIds.length === 0) {
      message.warning("请先勾选要导出的会话（需要有会话ID）");
      return;
    }
    try {
      setLoading(true);
      const res = await agentDataApi.exportSelectedConversations(sessionIds);
      if (!res.success) {
        message.error(res.message || "导出失败");
        return;
      }
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `conversations_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success("Excel 已导出");
    } catch {
      message.error("导出失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPage>
      <Tabs
        activeKey={activeTabKey}
        onChange={(key) => setActiveTabKey(key === "analysis" ? "analysis" : "usage")}
        items={[
          {
            key: "usage",
            label: "使用记录",
            children: (
              <div>
                <StatisticsCards data={statistics} />
                <SearchBar
                  searchParams={searchParams}
                  onSearch={handleSearch}
                  onReset={handleReset}
                  onExport={handleExportSelected}
                  exportDisabled={selectedRowKeys.length === 0}
                />
                <AdminTablePanel
                  loading={loading}
                  isEmpty={data.length === 0}
                  emptyDescription="暂无使用记录数据"
                  emptyAction={
                    <Button type="primary" onClick={handleReset}>
                      重新加载
                    </Button>
                  }
                  pagination={
                    data.length > 0 ? (
                      <Pagination
                        current={currentPage}
                        pageSize={pageSize}
                        total={total}
                        onChange={handlePageChange}
                        showSizeChanger
                        showQuickJumper
                        showTotal={(total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`}
                      />
                    ) : null
                  }
                >
                  <Table
                    rowKey="id"
                    columns={getAgentDataColumns(handleViewDetail)}
                    dataSource={data}
                    rowSelection={rowSelection}
                    pagination={false}
                    scroll={{ x: 1500 }}
                    size="middle"
                  />
                </AdminTablePanel>
              </div>
            ),
          },
          {
            key: "analysis",
            label: "问题分析",
            children: <AnalysisPanel />,
          },
        ]}
      />

      {/* 详情弹窗 */}
      <DetailModal
        visible={detailVisible}
        record={currentRecord}
        onClose={() => setDetailVisible(false)}
      />
    </AdminPage>
  );
};

export default AdminAgentData;
