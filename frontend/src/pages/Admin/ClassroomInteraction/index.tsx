// 课堂互动 - 管理端

import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminSSE } from "@hooks/useAdminSSE";
import {
  type RowSelectionState,
  type Updater,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Plus,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";
import { AdminPage, AdminTablePanel, AdminFilterBar } from "@components/Admin";
import { ConfirmDialog } from "@components/Common/ConfirmDialog";
import { ActivityDetailDrawer } from "@components/ActivityDetailDrawer";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Activity } from "@services/classroom";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";
import { parseErrorMessage } from "./utils";
import ActivityFormDialog from "./components/ActivityFormDialog";
import { getActivityColumns } from "./components/ActivityColumns";
import type { ActivityColumnHandlers } from "./components/ActivityColumns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useClassroomList,
  useActiveAgents,
  useActivityDetail,
  useStartActivity,
  useEndActivity,
  useDeleteActivity,
  useBulkDeleteActivities,
  useDuplicateActivity,
  useRestartActivity,
  CLASSROOM_QUERY_KEY,
} from "@hooks/queries/useClassroomQuery";

const FILTER_ALL = "__all__";

const AdminClassroomInteractionPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<Activity | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailActivityId, setDetailActivityId] = useState<number | null>(null);

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [confirmState, setConfirmState] = useState<{ message: string; onOk: () => void } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // ── TanStack Query: list ─────────────────────────────────
  const listParams = useMemo(
    () => ({
      skip: (page - 1) * pageSize,
      limit: pageSize,
      status: statusFilter || undefined,
    }),
    [page, pageSize, statusFilter],
  );

  const { data: listData, isLoading } = useClassroomList(listParams);

  // Client-side filtering
  const activities = useMemo(() => {
    let items = listData?.items ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((a) => a.title.toLowerCase().includes(q));
    }
    if (typeFilter) {
      items = items.filter((a) => a.activity_type === typeFilter);
    }
    return items;
  }, [listData, search, typeFilter]);
  const total = listData?.total ?? 0;

  // ── TanStack Query: active agents ────────────────────────
  const { data: activeAgents = [], isLoading: loadingAgents } = useActiveAgents();

  // ── TanStack Query: detail ───────────────────────────────
  const {
    data: detailActivity,
    refetch: refetchDetail,
  } = useActivityDetail(detailActivityId);
  const detailStats = detailActivity?.stats ?? null;

  // SSE
  useAdminSSE("classroom_interaction_changed", () => {
    queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
  });

  // ── Mutations ────────────────────────────────────────────
  const startMutation = useStartActivity();
  const endMutation = useEndActivity();
  const deleteMutation = useDeleteActivity();
  const bulkDeleteMutation = useBulkDeleteActivities();
  const duplicateMutation = useDuplicateActivity();
  const restartMutation = useRestartActivity();

  // ── Detail polling ───────────────────────────────────────
  useEffect(() => {
    if (!detailOpen || !detailActivityId || detailActivity?.status !== "active") return;
    const timer = setInterval(() => {
      refetchDetail();
    }, 3000);
    return () => clearInterval(timer);
  }, [detailOpen, detailActivityId, detailActivity?.status, refetchDetail]);

  // ── Handlers ─────────────────────────────────────────────
  const handleRefreshList = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
    showMessage.success("已刷新");
  }, [queryClient]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setEditingRecord(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((record: Activity) => {
    setEditingId(record.id);
    setEditingRecord(record);
    setModalOpen(true);
  }, []);

  const handleStart = useCallback(async (id: number) => {
    try {
      await startMutation.mutateAsync(id);
      showMessage.success("活动已开始");
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  }, [startMutation]);

  const handleEnd = useCallback(async (id: number) => {
    const act = activities.find((a) => a.id === id) || detailActivity;
    try {
      await endMutation.mutateAsync({
        id,
        data: {
          analysis_agent_id: act?.analysis_agent_id ?? undefined,
          analysis_prompt: act?.analysis_prompt ?? undefined,
        },
      });
      showMessage.success("活动已结束");
      if (detailActivityId === id) {
        refetchDetail();
      }
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  }, [activities, detailActivity, detailActivityId, endMutation, refetchDetail]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      showMessage.success("已删除");
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  }, [deleteMutation]);

  const executeBulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      setBulkDeleteOpen(false);
      const result = await bulkDeleteMutation.mutateAsync(selectedRowKeys);
      if (result.skipped.length > 0) {
        showMessage.warning(`已删除 ${result.deleted.length} 条，${result.skipped.length} 条进行中无法删除`);
      } else {
        showMessage.success(`已删除 ${result.deleted.length} 条`);
      }
      setSelectedRowKeys([]);
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  };

  const handleDuplicate = useCallback(async (id: number) => {
    try {
      await duplicateMutation.mutateAsync(id);
      showMessage.success("已复制为新草稿");
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  }, [duplicateMutation]);

  const handleRestart = useCallback(async (id: number) => {
    try {
      await restartMutation.mutateAsync(id);
      showMessage.success("已重新开始");
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  }, [restartMutation]);

  const openDetail = useCallback((record: Activity) => {
    setDetailOpen(true);
    setDetailActivityId(record.id);
  }, []);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailActivityId(null);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rowSelection = useMemo<RowSelectionState>(() => {
    const selected = new Set(selectedRowKeys.map((id) => String(id)));
    return activities.reduce<RowSelectionState>((acc, activity) => {
      const key = String(activity.id);
      if (selected.has(key)) acc[key] = true;
      return acc;
    }, {});
  }, [activities, selectedRowKeys]);

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      const nextSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;
      const pageIds = new Set(activities.map((activity) => activity.id));
      const nextPageSelected = Object.keys(nextSelection)
        .filter((key) => nextSelection[key])
        .map((key) => Number(key));
      setSelectedRowKeys((prev) => [
        ...prev.filter((id) => !pageIds.has(id)),
        ...nextPageSelected,
      ]);
    },
    [activities, rowSelection],
  );

  const columnHandlers: ActivityColumnHandlers = useMemo(() => ({
    handleEdit: openEdit,
    handleDelete: (record: Activity) => setConfirmState({ message: "确认删除？", onOk: () => { void handleDelete(record.id); } }),
    handleStart,
    handleEnd,
    handleRestart,
    handleDuplicate,
    openDetail,
    onConfirm: (message, onOk) => setConfirmState({ message, onOk }),
  }), [
    handleDelete,
    handleDuplicate,
    handleEnd,
    handleRestart,
    handleStart,
    openDetail,
    openEdit,
  ]);

  const columns = useMemo(
    () => getActivityColumns(columnHandlers),
    [columnHandlers],
  );

  const table = useReactTable({
    data: activities,
    columns,
    state: { rowSelection },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
  });

  const detailExtra =
    detailActivity?.status === "active" ? (
      <div className="mt-5">
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          onClick={() => {
            if (!detailActivity) return;
            setConfirmState({ message: "确认结束活动？", onOk: () => { void handleEnd(detailActivity.id); } });
          }}
        >
          <Square className="h-4 w-4" />
          结束活动
        </Button>
      </div>
    ) : null;

  return (
    <AdminPage scrollable={false}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <AdminFilterBar className="mb-0">
          <Input
            placeholder="搜索标题"
            className="w-[220px]"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <Select
            value={statusFilter || FILTER_ALL}
            onValueChange={(v) => {
              setStatusFilter(v === FILTER_ALL ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="active">进行中</SelectItem>
              <SelectItem value="ended">已结束</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={typeFilter || FILTER_ALL}
            onValueChange={(v) => {
              setTypeFilter(v === FILTER_ALL ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>全部类型</SelectItem>
              <SelectItem value="vote">投票</SelectItem>
              <SelectItem value="fill_blank">填空</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRefreshList()}
            disabled={isLoading}
          >
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </Button>

          {selectedRowKeys.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              批量删除 ({selectedRowKeys.length})
            </Button>
          ) : null}
        </AdminFilterBar>

        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          创建活动
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 flex flex-col">
          <AdminTablePanel
            loading={isLoading}
            isEmpty={!isLoading && activities.length === 0}
            emptyDescription="暂无课堂互动活动"
          >
            <DataTable table={table} tableClassName="min-w-[980px]" />
          </AdminTablePanel>
        </div>
        {total > 0 ? (
          <div className="mt-2 flex justify-end border-t border-border-secondary pt-3">
            <DataTablePagination
              currentPage={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
              onPageChange={(nextPage, nextPageSize) => {
                if (nextPageSize && nextPageSize !== pageSize) {
                  setPageSize(nextPageSize);
                }
                setPage(nextPage);
              }}
            />
          </div>
        ) : null}
      </div>

      <ActivityFormDialog
        open={modalOpen}
        editingId={editingId}
        editingRecord={editingRecord}
        activeAgents={activeAgents}
        loadingAgents={loadingAgents}
        onRefreshAgents={() => {
          queryClient.invalidateQueries({ queryKey: ["active-agents"] });
        }}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
        }}
      />

      <ActivityDetailDrawer
        open={detailOpen}
        activity={detailActivity ?? null}
        stats={detailStats}
        onClose={closeDetail}
        extra={detailExtra}
      />

      <ConfirmDialog
        open={confirmState !== null}
        onOpenChange={(open) => { if (!open) setConfirmState(null); }}
        title="确认操作"
        description={confirmState?.message ?? ""}
        confirmText="确认"
        variant="destructive"
        onConfirm={() => { confirmState?.onOk(); setConfirmState(null); }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="确认删除"
        description={`确认删除选中的 ${selectedRowKeys.length} 条活动？（只有草稿状态可被删除）`}
        confirmText="删除"
        variant="destructive"
        onConfirm={executeBulkDelete}
      />
    </AdminPage>
  );
};

export default AdminClassroomInteractionPage;
