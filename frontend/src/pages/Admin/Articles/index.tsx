import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Ellipsis,
  Eye,
  FolderOpen,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Loader2,
} from "lucide-react";
import dayjs from "dayjs";
import { articleApi, categoryApi } from "@services";
import { logger } from "@services/logger";
import type { ArticleWithRelations, ArticleFilterParams } from "@services";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import { subscribeArticleUpdated } from "@utils/articleUpdatedEvent";
import CategoryManageModal from "./CategoryManageModal";
import { useAdminSSE } from "@hooks/useAdminSSE";
import { PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

const getArticleColumns = (
  handleEdit: (record: ArticleWithRelations) => void,
  handleDelete: (id: number) => void,
  handleTogglePublish: (id: number, published: boolean) => void,
  handleView: (slug: string) => void,
): ColumnDef<ArticleWithRelations>[] => [
  {
    id: "title",
    header: "标题",
    accessorKey: "title",
    size: 420,
    meta: { className: "w-[420px] align-middle" },
    cell: ({ row }) => (
      <div className="py-0.5">
        <div className="flex items-center gap-2 text-sm font-medium leading-5">
          <span className="line-clamp-1">{row.original.title}</span>
          <Badge
            variant={row.original.published ? "success" : "warning"}
            className="shrink-0 text-xs"
          >
            {row.original.published ? "已发布" : "草稿"}
          </Badge>
        </div>
      </div>
    ),
  },
  {
    id: "category",
    header: "分类",
    accessorKey: "category",
    size: 180,
    meta: { className: "w-[180px] align-middle" },
    cell: ({ row }) =>
      row.original.category ? (
        <Badge variant="warning">
          {row.original.category.name}
        </Badge>
      ) : (
        <Badge variant="outline">未分类</Badge>
      ),
  },
  {
    id: "updated_at",
    header: "更新时间",
    accessorKey: "updated_at",
    size: 160,
    meta: { className: "w-40 align-middle" },
    cell: ({ row }) => (
      <div className="text-xs font-medium text-text-secondary">
        {dayjs(row.original.updated_at).format("YYYY-MM-DD")}
      </div>
    ),
  },
  {
    id: "published",
    header: "发布状态",
    accessorKey: "published",
    size: 120,
    meta: { className: "w-28 align-middle text-left" },
    cell: ({ row }) => (
      <Switch
        checked={row.original.published}
        onCheckedChange={(checked) => handleTogglePublish(row.original.id, checked)}
      />
    ),
  },
  {
    id: "action",
    header: "操作",
    size: 160,
    meta: { className: "w-40 align-middle" },
    cell: ({ row }) => {
      const record = row.original;
      return (
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => handleEdit(record)}>
            <Pencil className="h-4 w-4" />
            编辑
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleView(record.slug)}>
                <Eye className="mr-2 h-4 w-4" />
                预览文章
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEdit(record)}>
                <Pencil className="mr-2 h-4 w-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDelete(record.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

const AdminArticles: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<ArticleWithRelations[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<ArticleFilterParams>({
    page: 1,
    size: 20,
    published_only: false,
    include_relations: true,
  });
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>(undefined);
  const [titleKeyword, setTitleKeyword] = useState("");
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  const loadArticles = useCallback(async (params: ArticleFilterParams = searchParams) => {
    try {
      setLoading(true);
      const response = await articleApi.listArticles(params);
      const listData = response.data;

      setArticles(listData?.articles || []);
      setTotal(listData?.total || 0);
      setRowSelection({});
    } catch (error) {
      logger.error("加载文章列表失败:", error);
      showMessage.error("加载文章列表失败");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  const refreshTimerRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);
  const seenSignalIdsRef = useRef<Map<string, number>>(new Map());

  const requestRefreshFromSignal = useCallback((signalId?: string) => {
    const now = Date.now();
    if (signalId) {
      const seen = seenSignalIdsRef.current;
      const prev = seen.get(signalId);
      if (prev && now - prev < 60_000) return;
      seen.set(signalId, now);
      const toDelete: string[] = [];
      seen.forEach((ts, id) => {
        if (now - ts > 60_000) toDelete.push(id);
      });
      for (let i = 0; i < toDelete.length; i++) seen.delete(toDelete[i]);
    }

    const minInterval = 500;
    const since = now - lastRefreshAtRef.current;
    if (since >= minInterval) {
      lastRefreshAtRef.current = now;
      loadArticles();
      return;
    }
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      lastRefreshAtRef.current = Date.now();
      loadArticles();
    }, minInterval - since);
  }, [loadArticles]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await categoryApi.listCategories({
        page: 1,
        size: 100,
      });
      const categoriesData = response.data?.categories || [];
      setCategories(categoriesData);
    } catch (error) {
      logger.error("加载分类列表失败:", error);
    }
  }, []);

  useEffect(() => {
    loadArticles();
    loadCategories();
  }, [loadArticles, loadCategories]);

  useAdminSSE("article_changed", loadArticles);

  useEffect(() => {
    const unsub = subscribeArticleUpdated((_payload, meta) => {
      requestRefreshFromSignal(meta?.id);
    });

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data: any = e.data;
      if (!data || data.type !== "article_updated") return;
      requestRefreshFromSignal(typeof data.id === "string" ? data.id : undefined);
    };

    window.addEventListener("message", onMessage);
    return () => {
      unsub();
      window.removeEventListener("message", onMessage);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    };
  }, [requestRefreshFromSignal]);

  useEffect(() => {
    const onFocus = () => requestRefreshFromSignal();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") requestRefreshFromSignal();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [requestRefreshFromSignal]);

  const displayedArticles = useMemo(() => {
    const kw = titleKeyword.trim().toLowerCase();
    if (!kw) return articles;
    return (articles || []).filter((a) => {
      const title = String(a.title || "").toLowerCase();
      const slug = String(a.slug || "").toLowerCase();
      return title.includes(kw) || slug.includes(kw);
    });
  }, [articles, titleKeyword]);

  useEffect(() => {
    const allowedIds = new Set(displayedArticles.map((item) => String(item.id)));
    setRowSelection((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([id, checked]) => checked && allowedIds.has(id)),
      );
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        prevKeys.every((key) => prev[key] === next[key])
      ) {
        return prev;
      }
      return next;
    });
  }, [displayedArticles]);

  const selectedRowKeys = useMemo(
    () =>
      Object.keys(rowSelection)
        .filter((id) => rowSelection[id])
        .map((id) => Number(id)),
    [rowSelection],
  );

  const handlePageChange = (nextPage: number, size?: number) => {
    const resolvedSize = size ?? pageSize;
    const boundedPage = Math.max(1, Math.min(Math.max(1, Math.ceil(total / resolvedSize)), nextPage));
    const newParams = {
      ...searchParams,
      page: boundedPage,
      size: resolvedSize,
    };
    setCurrentPage(boundedPage);
    if (size && size !== pageSize) setPageSize(size);
    setSearchParams(newParams);
    loadArticles(newParams);
  };

  const handleEdit = (record: ArticleWithRelations) => {
    window.open(`/admin/articles/editor/${record.id}`, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (id: number) => {
    try {
      await articleApi.deleteArticle(id);
      showMessage.success("文章删除成功");
      loadArticles();
    } catch (error) {
      logger.error("删除文章失败:", error);
      showMessage.error("删除文章失败");
    }
  };

  const handleTogglePublish = async (id: number, published: boolean) => {
    try {
      await articleApi.togglePublishStatus(id, published);
      showMessage.success(`文章已${published ? "发布" : "转为草稿"}`);
      loadArticles();
    } catch (error) {
      logger.error("切换发布状态失败:", error);
      showMessage.error("操作失败");
    }
  };

  const handleView = (slug: string) => {
    window.open(`/articles/${slug}`, "_blank");
  };

  const handleAddArticle = () => {
    window.open("/admin/articles/editor/new", "_blank", "noopener,noreferrer");
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      showMessage.warning("请选择要删除的文章");
      return;
    }

    const invalidIds = selectedRowKeys.filter(
      (id) => !articles.some((article) => article.id === id),
    );
    if (invalidIds.length > 0) {
      logger.warn("检测到无效的文章ID:", invalidIds);
      showMessage.error("选中的文章中包含无效ID，请刷新页面后重试");
      return;
    }

    if (!window.confirm(`确定要删除选中的 ${selectedRowKeys.length} 篇文章吗？此操作不可恢复。`)) {
      logger.debug("用户取消批量删除");
      return;
    }

    try {
      setLoading(true);
      const successIds: number[] = [];
      const failedIds: Array<{ id: number; error: string }> = [];

      for (const id of selectedRowKeys) {
        try {
          await articleApi.deleteArticle(id);
          successIds.push(id);
        } catch (error: any) {
          logger.error(`删除文章 ${id} 失败:`, error);
          failedIds.push({
            id,
            error: error?.message || error?.toString() || "未知错误",
          });
        }
      }

      if (failedIds.length === 0) {
        showMessage.success(`成功删除 ${successIds.length} 篇文章`);
      } else if (successIds.length > 0) {
        showMessage.warning(`部分删除成功：成功删除 ${successIds.length} 篇，失败 ${failedIds.length} 篇`);
      } else {
        showMessage.error("全部删除失败，请检查文章ID是否正确");
      }

      loadArticles();
    } catch (error) {
      logger.error("批量删除失败:", error);
      showMessage.error("批量删除操作失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPublish = async (published: boolean) => {
    if (selectedRowKeys.length === 0) {
      showMessage.warning("请选择要操作的文章");
      return;
    }

    try {
      setLoading(true);
      for (const id of selectedRowKeys) {
        await articleApi.togglePublishStatus(id, published);
      }
      showMessage.success(
        `成功${published ? "发布" : "转为草稿"} ${selectedRowKeys.length} 篇文章`,
      );
      loadArticles();
    } catch (error) {
      logger.error("批量操作失败:", error);
      showMessage.error("批量操作失败");
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<ArticleWithRelations>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="选择当前页全部文章"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
            }
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`选择文章 ${row.original.title}`}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 44,
        meta: { className: "w-11 align-middle" },
      },
      ...getArticleColumns(handleEdit, handleDelete, handleTogglePublish, handleView),
    ],
    [handleDelete, handleEdit, handleTogglePublish, handleView],
  );

  const table = useReactTable({
    data: displayedArticles,
    columns,
    state: { rowSelection },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminPage scrollable={false}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={categoryFilter != null ? String(categoryFilter) : "__all__"}
          onValueChange={(value) => {
            const next = value === "__all__" ? undefined : Number(value);
            setCategoryFilter(next);
            const newParams: ArticleFilterParams = { ...searchParams, page: 1, category_id: next };
            setCurrentPage(1);
            setSearchParams(newParams);
            void loadArticles(newParams);
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="按分类筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">按分类筛选</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={titleKeyword}
          placeholder="搜索标题..."
          className="w-[220px]"
          onChange={(e) => setTitleKeyword(e.target.value)}
        />
        <div className="flex-1" />
        {selectedRowKeys.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Ellipsis className="h-4 w-4" />
                批量操作 ({selectedRowKeys.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleBatchPublish(true)}>
                批量发布
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBatchPublish(false)}>
                批量转为草稿
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleBatchDelete}>
                批量删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button variant="outline" onClick={() => loadArticles()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          刷新
        </Button>
        <Button variant="outline" onClick={() => setCategoryModalVisible(true)}>
          <FolderOpen className="h-4 w-4" />
          分类管理
        </Button>
        <Button onClick={handleAddArticle}>
          <Plus className="h-4 w-4" />
          新建文章
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AdminTablePanel
            loading={loading}
            isEmpty={displayedArticles.length === 0}
            emptyDescription="暂无文章数据"
          >
            <DataTable
              table={table}
              className="h-full"
              tableClassName="min-w-[1100px]"
            />
          </AdminTablePanel>
        </div>
        <div className="mt-2 flex flex-shrink-0 justify-end border-t border-border-secondary bg-surface pt-3">
          <DataTablePagination
            currentPage={Math.max(1, currentPage)}
            totalPages={Math.max(1, totalPages)}
            total={total}
            pageSize={pageSize}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      <CategoryManageModal
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        onCategoryChange={loadCategories}
      />
    </AdminPage>
  );
};

export default AdminArticles;
