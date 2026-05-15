/**
 * 使用记录面板 — 搜索栏 + AdminTablePanel（表格+分页固定底部）
 * 使用 TanStack Query hooks 替代手动 useState/useEffect 数据获取
 */

import { showMessage } from "@/lib/toast";
import React, { useState, useMemo } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import dayjs from "dayjs";

import SearchBar from "./SearchBar";
import DetailModal from "./DetailModal";
import { getAgentDataColumns } from "./columns";
import { AdminTablePanel } from "@components/Admin";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";

import type { AgentUsageData, SearchFilterParams } from "@services/znt/types";
import { agentDataApi } from "@services/agents";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";
import { useAgentDataList } from "@hooks/queries/useAgentDataQuery";

const UsageRecordPanel: React.FC<{ onFilterChange?: (params: SearchFilterParams) => void }> = ({ onFilterChange }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [searchParams, setSearchParams] = useState<SearchFilterParams>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<AgentUsageData | null>(null);

  // TanStack Query — 数据查询
  const {
    data: agentListData,
    isLoading,
  } = useAgentDataList({
    searchParams,
    page: currentPage,
    pageSize,
  });

  const data = useMemo(() => agentListData?.items ?? [], [agentListData?.items]);
  const total = agentListData?.total ?? 0;

  const columns = useMemo(
    () =>
      getAgentDataColumns((record) => {
        setCurrentRecord(record);
        setDetailVisible(true);
      }),
    [],
  );

  const handleSearch = (params: SearchFilterParams) => {
    setSearchParams({ ...params, page: 1, page_size: pageSize });
    setCurrentPage(1);
    onFilterChange?.(params);
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
    if (!sessionIds.length) {
      showMessage.warning("请先勾选要导出的会话");
      return;
    }
    try {
      setExportLoading(true);
      const res = await agentDataApi.exportSelectedConversations(sessionIds);
      if (!res.success) {
        showMessage.error(res.message || "导出失败");
        return;
      }
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `conversations_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showMessage.success("已导出");
    } catch {
      showMessage.error("导出失败");
    } finally {
      setExportLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allChecked = data.length > 0 && data.every((item) => selectedRowKeys.includes(item.id));
  const tableColumns = useMemo<ColumnDef<AgentUsageData>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(checked) => {
                setSelectedRowKeys(checked === true ? data.map((item) => item.id) : []);
              }}
              aria-label="选择当前页全部记录"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={selectedRowKeys.includes(row.original.id)}
              onCheckedChange={(checked) => {
                setSelectedRowKeys((prev) =>
                  checked === true
                    ? Array.from(new Set([...prev, row.original.id]))
                    : prev.filter((key) => key !== row.original.id),
                );
              }}
              aria-label={`选择记录 ${row.original.id}`}
            />
          </div>
        ),
        size: 44,
        meta: { headerClassName: "w-[44px]", cellClassName: "w-[44px] align-middle" },
      },
      ...columns.map((column: any, index: number) => ({
        id: String(column.key || column.dataIndex || index),
        header: column.title,
        size: typeof column.width === "number" ? column.width : undefined,
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "align-top",
        },
        cell: (context: any) => {
          const value = column.dataIndex ? (context.row.original as any)[column.dataIndex] : undefined;
          const cell =
            typeof column.render === "function"
              ? column.render(value, context.row.original, context.row.index)
              : value;
          return cell ?? "-";
        },
      })),
    ],
    [allChecked, columns, data, selectedRowKeys],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <SearchBar
        searchParams={searchParams}
        onSearch={handleSearch}
        onReset={handleReset}
        onExport={handleExportSelected}
        exportDisabled={selectedRowKeys.length === 0}
        exportLoading={exportLoading}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-secondary bg-surface-1">
        <AdminTablePanel
          loading={isLoading}
          isEmpty={!isLoading && data.length === 0}
          emptyDescription="暂无使用记录"
        >
          <DataTable table={table} className="h-full !overflow-visible !rounded-none !border-0" tableClassName="min-w-[1180px] table-fixed" />
        </AdminTablePanel>
        {total > 0 ? (
          <div className="flex-none flex justify-end border-t border-border-secondary px-4 py-3">
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
              onPageChange={handlePageChange}
            />
          </div>
        ) : null}
      </div>

      <DetailModal visible={detailVisible} record={currentRecord} onClose={() => setDetailVisible(false)} />
    </div>
  );
};

export default UsageRecordPanel;
