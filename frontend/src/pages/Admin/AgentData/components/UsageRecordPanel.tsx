/**
 * 使用记录面板 — 搜索栏 + AdminTablePanel（表格+分页固定底部）
 */

import React, { useState, useEffect, useCallback } from "react";
import { Table, Pagination, message } from "antd";
import dayjs from "dayjs";

import SearchBar from "./SearchBar";
import DetailModal from "./DetailModal";
import { getAgentDataColumns } from "./columns";
import { AdminTablePanel } from "@components/Admin";

import type { AgentUsageData, SearchFilterParams } from "@services/znt/types";
import { agentDataApi } from "@services/agents";
import { logger } from "@services/logger";

const UsageRecordPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentUsageData[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useState<SearchFilterParams>({ page: 1, page_size: 20 });
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<AgentUsageData | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await agentDataApi.getAgentData({ ...searchParams, page: currentPage, page_size: pageSize });
      if (res.success) {
        setData(res.data.items || []);
        setTotal(res.data.total || 0);
        setSelectedRowKeys([]);
      } else {
        message.error(res.message || "加载数据失败");
      }
    } catch (error) {
      logger.error("加载数据失败:", error);
      message.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchParams]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = (params: SearchFilterParams) => {
    setSearchParams({ ...params, page: 1, page_size: pageSize });
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchParams({ page: 1, page_size: pageSize });
    setCurrentPage(1);
  };

  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page);
    if (size) setPageSize(size);
    setSearchParams((prev) => ({ ...prev, page, page_size: size || pageSize }));
  };

  const handleExportSelected = async () => {
    const sessionIds = data
      .filter((r) => selectedRowKeys.includes(r.id))
      .map((r) => r.session_id)
      .filter((s): s is string => Boolean(s));
    if (!sessionIds.length) { message.warning("请先勾选要导出的会话"); return; }
    try {
      setLoading(true);
      const res = await agentDataApi.exportSelectedConversations(sessionIds);
      if (!res.success) { message.error(res.message || "导出失败"); return; }
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `conversations_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success("已导出");
    } catch { message.error("导出失败"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <SearchBar
        searchParams={searchParams}
        onSearch={handleSearch}
        onReset={handleReset}
        onExport={handleExportSelected}
        exportDisabled={selectedRowKeys.length === 0}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <AdminTablePanel
          loading={loading}
          isEmpty={!loading && data.length === 0}
          emptyDescription="暂无使用记录"
          pagination={
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={total}
              onChange={handlePageChange}
              showSizeChanger
              showTotal={(t) => `共 ${t} 条`}
            />
          }
        >
          <Table
            rowKey="id"
            columns={getAgentDataColumns((record) => { setCurrentRecord(record); setDetailVisible(true); })}
            dataSource={data}
            loading={loading}
            rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
            pagination={false}
            scroll={{ x: 1400 }}
            size="middle"
          />
        </AdminTablePanel>
      </div>

      <DetailModal visible={detailVisible} record={currentRecord} onClose={() => setDetailVisible(false)} />
    </div>
  );
};

export default UsageRecordPanel;
