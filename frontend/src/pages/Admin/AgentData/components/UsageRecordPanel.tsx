import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Pagination,
  message,
} from "antd";
import dayjs from "dayjs";

// 导入组件
import SearchBar from "./SearchBar";
import DetailModal from "./DetailModal";
import { getAgentDataColumns } from "./columns";

// 导入类型和API
import type {
  AgentUsageData,
  SearchFilterParams,
} from "@services/znt/types";
import { agentDataApi } from "@services/agents";

const UsageRecordPanel: React.FC = () => {
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

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        ...searchParams,
        page: currentPage,
        page_size: pageSize,
      };

      const listResponse = await agentDataApi.getAgentData(params);

      if (listResponse.success) {
        setData(listResponse.data.items || []);
        setTotal(listResponse.data.total || 0);
        setSelectedRowKeys([]);
      } else {
        message.error(listResponse.message || "加载数据失败");
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
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <SearchBar
        searchParams={searchParams}
        onSearch={handleSearch}
        onReset={handleReset}
        onExport={handleExportSelected}
        exportDisabled={selectedRowKeys.length === 0}
      />
      
      <div style={{ flex: "1", minHeight: 0, overflow: "auto", padding: "0 12px" }}>
        <Table
          rowKey="id"
          columns={getAgentDataColumns(handleViewDetail)}
          dataSource={data}
          loading={loading}
          rowSelection={rowSelection}
          pagination={false}
          scroll={{ x: 1500 }}
          size="middle"
        />
      </div>

      <div
        style={{
          flex: "none",
          padding: "12px",
          display: "flex",
          justifyContent: "flex-end",
          borderTop: "1px solid #f0f0f0",
          background: "#fff",
        }}
      >
        <Pagination
          current={currentPage}
          pageSize={pageSize}
          total={total}
          onChange={handlePageChange}
          showSizeChanger
          showQuickJumper
          showTotal={(total, range) =>
            `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }
        />
      </div>

      {/* 详情弹窗 */}
      <DetailModal
        visible={detailVisible}
        record={currentRecord}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  );
};

export default UsageRecordPanel;
