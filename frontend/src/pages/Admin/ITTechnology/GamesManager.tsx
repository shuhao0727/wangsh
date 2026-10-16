/**
 * GamesManager — 游戏资源库后台管理页
 *
 * 路由: /admin/it-technology/games
 * 职责: 管理员对游戏资源的增删改查、上下架、下载日志查看
 * 与前台 /it-technology/games 职责分离：前台纯展示，后台管管理
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import dayjs from "dayjs";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { AdminPage, AdminTablePanel, AdminFilterBar } from "@components/Admin";
import { ConfirmDialog } from "@components/Common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@hooks/useDebounce";
import type {
  GameResource,
  GameDownloadLog,
} from "@services/it/games";
import { showMessage } from "@/lib/toast";
import { GameUploadModal } from "@pages/ITTechnology/components/GameUploadModal";
import { GameDetailModal } from "@pages/ITTechnology/components/GameDetailModal";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";
import {
  useAdminITGamesQuery,
  useITGameCategoriesQuery,
  useITGameLogsQuery,
  useITGameMutations,
} from "@hooks/queries/useITGamesQuery";

// 预设分类：与 GameUploadModal 保持一致
const PRESET_CATEGORIES = ["益智", "动作", "冒险", "模拟", "策略", "竞速", "工具", "其它"];
const FILTER_ALL = "__all__";

/** 格式化文件大小 */
const fmtSize = (bytes: number): string => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const GamesManagerPage: React.FC = () => {
  // 列表数据
  // 筛选
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState<string>(FILTER_ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // 弹窗
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<GameResource | null>(null);
  const [detailGame, setDetailGame] = useState<GameResource | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GameResource | null>(null);
  const [logsGame, setLogsGame] = useState<GameResource | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  // 下载日志
  const listParams = {
    category: category === FILTER_ALL ? undefined : category,
    search: debouncedSearch || undefined,
    page,
    size: pageSize,
  };
  const listQuery = useAdminITGamesQuery(listParams);
  const categoriesQuery = useITGameCategoriesQuery();
  const logsQuery = useITGameLogsQuery(logsOpen ? logsGame?.id ?? null : null);
  const { deleteGame } = useITGameMutations();
  const games = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const loading = listQuery.isLoading || categoriesQuery.isLoading;
  const logs: GameDownloadLog[] = logsQuery.data?.items ?? [];
  const logsTotal = logsQuery.data?.total ?? 0;
  const logsLoading = logsQuery.isLoading;

  // 打开下载日志弹窗
  const openLogs = useCallback((game: GameResource) => {
    setLogsGame(game);
    setLogsOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteGame.mutateAsync(deleteTarget.id);
      showMessage.success("已删除");
      setDeleteTarget(null);
    } catch (e: any) {
      showMessage.error(e?.response?.data?.detail || "删除失败");
    }
  }, [deleteGame, deleteTarget]);

  // 合并预设分类与 DB 分类，去重排序
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...PRESET_CATEGORIES,
          ...(categoriesQuery.data?.categories ?? []),
        ]),
      ).sort(),
    [categoriesQuery.data?.categories],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 表格列定义
  const columns = useMemo<ColumnDef<GameResource>[]>(
    () => [
      {
        id: "title",
        header: "游戏名称",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left font-medium text-text-base hover:text-primary"
            onClick={() => {
              setDetailGame(row.original);
              setDetailOpen(true);
            }}
          >
            {row.original.title}
          </button>
        ),
      },
      {
        id: "category",
        header: "分类",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-normal">
            {row.original.category}
          </Badge>
        ),
      },
      {
        id: "file_size",
        header: "大小",
        cell: ({ row }) => (
          <span className="text-text-secondary">{fmtSize(row.original.file_size)}</span>
        ),
      },
      {
        id: "download_count",
        header: "下载次数",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-text-secondary">
            <Download className="h-3 w-3" />
            {row.original.download_count}
          </span>
        ),
      },
      {
        id: "is_active",
        header: "状态",
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge className="bg-success text-on-primary hover:bg-success">
              已上架
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-[var(--ws-color-surface-2)] text-text-tertiary hover:bg-[var(--ws-color-surface-2)]">
              已下架
            </Badge>
          ),
      },
      {
        id: "created_at",
        header: "上传时间",
        cell: ({ row }) => (
          <span className="text-text-tertiary text-xs">
            {row.original.created_at
              ? dayjs(row.original.created_at).format("YYYY-MM-DD HH:mm")
              : "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              title="编辑"
              onClick={() => {
                setEditRecord(row.original);
                setUploadOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              title="下载日志"
              onClick={() => void openLogs(row.original)}
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              title="删除"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [openLogs],
  );

  const table = useReactTable({
    data: games,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  });

  return (
    <AdminPage padding="var(--ws-panel-padding)" scrollable={false}>
      <AdminTablePanel
        title="游戏资源库管理"
        loading={loading}
        error={listQuery.isError || categoriesQuery.isError}
        errorDescription="游戏资源加载失败"
        isEmpty={!loading && games.length === 0 && !search && category === FILTER_ALL}
        emptyDescription="暂无游戏资源，点击右上角「上传」添加"
        noResults={!loading && games.length === 0 && (!!search || category !== FILTER_ALL)}
        noResultsDescription="没有匹配筛选条件的游戏"
        onRetry={() => {
          void listQuery.refetch();
          void categoriesQuery.refetch();
        }}
        extra={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void listQuery.refetch()}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              刷新
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditRecord(null);
                setUploadOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              上传
            </Button>
          </div>
        }
        pagination={
          <DataTablePagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            onPageChange={(p, size) => {
              setPage(p);
              if (typeof size === "number") setPageSize(size);
            }}
          />
        }
      >
        <AdminFilterBar>
          <div className="relative flex-1 min-w-44 max-w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <Input
              className="h-8 text-xs pl-9"
              value={search}
              placeholder="搜索游戏名称或简介..."
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>全部分类</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AdminFilterBar>

        <DataTable
          table={table}
          className="min-w-max"
          tableScrollContainer={false}
          stickyHeader
        />
      </AdminTablePanel>

      {/* 上传/编辑弹窗：复用前台组件 */}
      <GameUploadModal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setEditRecord(null);
        }}
        onSuccess={() => void listQuery.refetch()}
        editRecord={editRecord}
      />

      {/* 详情弹窗：复用前台组件 */}
      <GameDetailModal
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailGame(null);
        }}
        game={detailGame}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="确认删除"
        description={`确定要删除「${deleteTarget?.title ?? ""}」吗？文件将一并移除。`}
        confirmText="删除"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* 下载日志弹窗 */}
      <Dialog open={logsOpen} onOpenChange={(v) => setLogsOpen(v)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              「{logsGame?.title}」下载日志
              <span className="ml-2 text-xs font-normal text-text-tertiary">
                共 {logsTotal} 条
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-tertiary">暂无下载记录</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-2 text-text-tertiary">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">时间</th>
                    <th className="px-3 py-2 text-left font-medium">用户ID</th>
                    <th className="px-3 py-2 text-left font-medium">IP</th>
                    <th className="px-3 py-2 text-left font-medium">UA</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-border-secondary">
                      <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                        {log.downloaded_at
                          ? dayjs(log.downloaded_at).format("YYYY-MM-DD HH:mm")
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {log.user_id ?? "游客"}
                      </td>
                      <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                        {log.ip_address}
                      </td>
                      <td className="max-w-48 truncate px-3 py-2 text-text-tertiary">
                        {log.user_agent || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
};

export default GamesManagerPage;
