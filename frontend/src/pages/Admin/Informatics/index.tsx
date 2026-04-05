import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Plus, RefreshCw, Loader2, Pencil, Trash2 } from "lucide-react";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import { githubSyncApi, typstCategoriesApi, typstNotesApi } from "@services";
import type {
  GithubSyncRun,
  GithubSyncSettings,
  GithubSyncTaskStatus,
  TypstCategoryListItem,
  TypstNoteListItem,
} from "@services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

const FILTER_ALL = "__all__";

type SyncFormState = {
  repo_url: string;
  branch: string;
  token: string;
  enabled: boolean;
  interval_hours: number;
  delete_mode: "unpublish" | "soft_delete";
};

/** 安全提取错误信息（防止 FastAPI 422 返回对象数组导致 React 崩溃） */
const extractErrorMsg = (e: any, fallback = "操作失败"): string => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ");
  }
  return e?.message || fallback;
};

const clampPercent = (value?: number) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const AdminInformatics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [publishingIds, setPublishingIds] = useState<Set<number>>(new Set());
  const [items, setItems] = useState<TypstNoteListItem[]>([]);
  const [categories, setCategories] = useState<TypstCategoryListItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [titleKeyword, setTitleKeyword] = useState<string>("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);
  const [syncTriggering, setSyncTriggering] = useState(false);
  const [syncRecompileTriggering, setSyncRecompileTriggering] = useState(false);
  const [syncSettings, setSyncSettings] = useState<GithubSyncSettings | null>(null);
  const [lastRun, setLastRun] = useState<GithubSyncRun | null>(null);
  const [syncTaskId, setSyncTaskId] = useState<string>("");
  const [syncTaskStatus, setSyncTaskStatus] = useState<GithubSyncTaskStatus | null>(null);
  const [syncResultShownTaskId, setSyncResultShownTaskId] = useState<string>("");
  const [syncResultOpen, setSyncResultOpen] = useState(false);
  const [syncResultTitle, setSyncResultTitle] = useState("");
  const [syncResultDetail, setSyncResultDetail] = useState("");

  const [syncForm, setSyncForm] = useState<SyncFormState>({
    repo_url: "",
    branch: "main",
    token: "",
    enabled: false,
    interval_hours: 48,
    delete_mode: "unpublish",
  });

  const openSyncResult = useCallback((title: string, detail: string) => {
    setSyncResultTitle(title);
    setSyncResultDetail(detail);
    setSyncResultOpen(true);
  }, []);

  const loadSync = useCallback(
    async (syncFormMode = true) => {
      setSyncLoading(true);
      try {
        const [settingsRes, runs] = await Promise.all([
          githubSyncApi.getSettings(),
          githubSyncApi.listRuns(1),
        ]);
        setSyncSettings(settingsRes);
        setLastRun((runs || [])[0] || null);
        if (syncFormMode) {
          setSyncForm({
            repo_url: settingsRes.repo_url || "",
            branch: settingsRes.branch || "main",
            token: "",
            enabled: Boolean(settingsRes.enabled),
            interval_hours: settingsRes.interval_hours || 48,
            delete_mode: settingsRes.delete_mode || "unpublish",
          });
        }
      } catch (e: any) {
        showMessage.error(extractErrorMsg(e, "加载 GitHub 同步配置失败"));
      } finally {
        setSyncLoading(false);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await typstNotesApi.list({ limit: 100 });
      setItems(res || []);
      try {
        const cats = await typstCategoriesApi.list();
        setCategories(cats || []);
      } catch {
        setCategories([]);
      }
    } catch (e: any) {
      showMessage.error(extractErrorMsg(e, "加载 Typst 笔记失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (syncModalOpen) {
      void loadSync();
    }
  }, [syncModalOpen, loadSync]);

  useEffect(() => {
    if (!syncModalOpen || !syncTaskId) return;
    let stopped = false;
    const tick = async () => {
      try {
        const [taskStatus] = await Promise.all([
          githubSyncApi.getTaskStatus(syncTaskId),
          loadSync(false),
        ]);
        if (stopped) return;
        setSyncTaskStatus(taskStatus);
        if (taskStatus.ready) {
          setSyncTaskId("");
        }
      } catch {
        return;
      }
    };
    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [syncModalOpen, syncTaskId, loadSync]);

  useEffect(() => {
    if (!syncTaskId || !syncTaskStatus?.ready || syncResultShownTaskId === syncTaskId) return;
    const created = syncTaskStatus.created_paths || [];
    const updated = syncTaskStatus.updated_paths || [];
    const deleted = syncTaskStatus.deleted_paths || [];
    const failed = syncTaskStatus.compile_failed || [];
    const compiledCount = (syncTaskStatus.compiled_note_ids || []).length;
    const pathPreview = (arr: string[]) => arr.slice(0, 8).join("\n");
    const lines: string[] = [
      `新增：${created.length} 个`,
      `更新：${updated.length} 个`,
      `删除：${deleted.length} 个`,
      `已编译：${compiledCount} 个`,
      `编译失败：${failed.length} 个`,
    ];
    if (created.length > 0) lines.push(`\n新增文件：\n${pathPreview(created)}`);
    if (updated.length > 0) lines.push(`\n更新文件：\n${pathPreview(updated)}`);
    if (deleted.length > 0) lines.push(`\n删除文件：\n${pathPreview(deleted)}`);
    if (failed.length > 0) {
      lines.push(
        `\n编译失败：\n${failed
          .slice(0, 5)
          .map((x) => `${x.path || "-"}: ${x.error || "编译失败"}`)
          .join("\n")}`,
      );
    }
    openSyncResult(
      syncTaskStatus.successful ? "同步完成" : "同步结束（有失败）",
      lines.join("\n"),
    );
    setSyncResultShownTaskId(syncTaskId);
  }, [syncTaskId, syncTaskStatus, syncResultShownTaskId, openSyncResult]);

  const openEditor = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const displayedItems = useMemo(() => {
    const kw = titleKeyword.trim().toLowerCase();
    const filtered = categoryFilter
      ? (items || []).filter((x) => (x.category_path || "") === categoryFilter)
      : items || [];
    const searched = kw
      ? filtered.filter((x) =>
          String(x.title || "")
            .toLowerCase()
            .includes(kw),
        )
      : filtered;
    return [...searched].sort((a, b) => {
      const byTitle = String(a.title || "").localeCompare(String(b.title || ""), "en", {
        numeric: true,
        sensitivity: "base",
      });
      if (byTitle !== 0) return byTitle;
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    });
  }, [items, categoryFilter, titleKeyword]);

  const totalPages = Math.max(1, Math.ceil(displayedItems.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayedItems.slice(start, start + pageSize);
  }, [displayedItems, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const columns = useMemo<ColumnDef<TypstNoteListItem>[]>(
    () => [
      {
        id: "title",
        header: "标题",
        accessorKey: "title",
        cell: ({ row }) => <span className="font-semibold">{row.original.title}</span>,
      },
      {
        id: "category",
        header: "分类",
        size: 220,
        meta: { className: "w-56" },
        cell: ({ row }) =>
          row.original.category_path ? (
            <Badge variant="secondary" className="border-0">
              {String(row.original.category_path)}
            </Badge>
          ) : (
            <Badge variant="outline">未分类</Badge>
          ),
      },
      {
        id: "published",
        header: "发布",
        size: 120,
        meta: { className: "w-28" },
        cell: ({ row }) => {
          const record = row.original;
          const checked = !!record.published;
          const publishing = publishingIds.has(record.id);
          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={checked}
                disabled={publishing}
                onCheckedChange={async (val) => {
                  const prev = !!record.published;
                  setItems((list) =>
                    list.map((it) => (it.id === record.id ? { ...it, published: val } : it)),
                  );
                  setPublishingIds((s) => new Set(s).add(record.id));
                  try {
                    const payload: Partial<{
                      title: string;
                      summary: string;
                      category_path: string;
                      published: boolean;
                    }> = {
                      title: record.title,
                      ...(typeof record.summary !== "undefined"
                        ? { summary: record.summary as any }
                        : {}),
                      ...(typeof record.category_path !== "undefined"
                        ? { category_path: record.category_path as any }
                        : {}),
                      published: val,
                    };
                    const updated = await typstNotesApi.update(record.id, payload);
                    setItems((list) =>
                      list.map((it) =>
                        it.id === record.id
                          ? {
                              ...it,
                              published: !!updated.published,
                              updated_at: updated.updated_at,
                            }
                          : it,
                      ),
                    );
                    showMessage.success(val ? "已发布" : "已停用");
                  } catch (e: any) {
                    setItems((list) =>
                      list.map((it) => (it.id === record.id ? { ...it, published: prev } : it)),
                    );
                    showMessage.error(extractErrorMsg(e, "切换发布状态失败"));
                  } finally {
                    setPublishingIds((s) => {
                      const next = new Set(s);
                      next.delete(record.id);
                      return next;
                    });
                  }
                }}
              />
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />
              ) : null}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "状态",
        size: 180,
        meta: { className: "w-44" },
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.original.published ? (
              <Badge variant="success">已发布</Badge>
            ) : (
              <Badge variant="outline">未发布</Badge>
            )}
            {row.original.compiled_at ? (
              <Badge variant="info">已编译</Badge>
            ) : (
              <Badge variant="outline">未编译</Badge>
            )}
          </div>
        ),
      },
      {
        id: "updated_at",
        header: "更新时间",
        size: 220,
        meta: { className: "w-56 text-text-tertiary" },
        cell: ({ row }) => new Date(row.original.updated_at).toLocaleString("zh-CN"),
      },
      {
        id: "action",
        header: "操作",
        size: 240,
        meta: { className: "w-60" },
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openEditor(`/admin/informatics/editor/${row.original.id}`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                if (!window.confirm(`确认删除「${row.original.title}」？`)) return;
                try {
                  await typstNotesApi.remove(row.original.id);
                  showMessage.success("已删除");
                  await load();
                } catch (e: any) {
                  showMessage.error(extractErrorMsg(e, "删除失败"));
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
          </div>
        ),
      },
    ],
    [load, openEditor, publishingIds],
  );

  const table = useReactTable({
    data: pagedItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const validateSyncForm = (fields?: Array<keyof SyncFormState>) => {
    const checkAll = !fields || fields.length === 0;
    const should = (key: keyof SyncFormState) => checkAll || fields.includes(key);
    if (should("repo_url") && !syncForm.repo_url.trim()) {
      showMessage.warning("请输入仓库地址");
      return false;
    }
    if (should("branch") && !syncForm.branch.trim()) {
      showMessage.warning("请输入分支");
      return false;
    }
    if (should("interval_hours")) {
      const hours = Number(syncForm.interval_hours || 0);
      if (!Number.isFinite(hours) || hours < 1 || hours > 24 * 30) {
        showMessage.warning("同步周期需在 1-720 小时之间");
        return false;
      }
    }
    return true;
  };

  return (
    <AdminPage scrollable={false}>
      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select
            value={categoryFilter || FILTER_ALL}
            onValueChange={(v) => {
              setCategoryFilter(v === FILTER_ALL ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="按分类筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>全部分类</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.path} value={c.path}>
                  {c.path}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={titleKeyword}
            placeholder="搜索标题..."
            className="w-64"
            onChange={(e) => {
              setTitleKeyword(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setSyncModalOpen(true)}>
            <RefreshCw className="h-4 w-4" />
            GitHub同步
          </Button>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </Button>
          <Button type="button" onClick={() => openEditor("/admin/informatics/editor/new")}>
            <Plus className="h-4 w-4" />
            新建笔记
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AdminTablePanel
            loading={loading}
            isEmpty={displayedItems.length === 0}
            emptyDescription="暂无笔记数据"
          >
            <DataTable table={table} className="h-full" tableClassName="min-w-full" />
          </AdminTablePanel>
        </div>
        <div className="mt-2 flex flex-shrink-0 justify-end border-t border-border-secondary bg-surface pt-3">
          <DataTablePagination
            currentPage={Math.max(1, page)}
            totalPages={Math.max(1, totalPages)}
            total={displayedItems.length}
            pageSize={pageSize}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            onPageChange={(nextPage, nextPageSize) => {
              if (nextPageSize && nextPageSize !== pageSize) {
                setPageSize(nextPageSize);
                setPage(1);
                return;
              }
              setPage(Math.max(1, Math.min(Math.max(1, totalPages), nextPage)));
            }}
          />
        </div>
      </div>

      <Dialog open={syncModalOpen} onOpenChange={setSyncModalOpen}>
        <DialogContent className="sm:max-w-[780px]">
          <DialogHeader>
            <DialogTitle>GitHub 同步配置</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">GitHub 仓库地址</label>
              <Input
                value={syncForm.repo_url}
                placeholder="https://github.com/shuhao0727/2-My-notes"
                onChange={(e) =>
                  setSyncForm((prev) => ({ ...prev, repo_url: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">分支</label>
                <Input
                  value={syncForm.branch}
                  placeholder="main"
                  onChange={(e) =>
                    setSyncForm((prev) => ({ ...prev, branch: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">同步周期(小时)</label>
                <Input
                  type="number"
                  min={1}
                  max={24 * 30}
                  value={String(syncForm.interval_hours)}
                  onChange={(e) =>
                    setSyncForm((prev) => ({
                      ...prev,
                      interval_hours: Number(e.target.value || 0),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">启用定时</label>
                <div className="flex h-[34px] items-center justify-between rounded-md border border-border px-3">
                  <span className="text-xs text-text-secondary">
                    {syncForm.enabled ? "开启" : "关闭"}
                  </span>
                  <Switch
                    checked={syncForm.enabled}
                    onCheckedChange={(checked) =>
                      setSyncForm((prev) => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">删除策略</label>
              <Select
                value={syncForm.delete_mode}
                onValueChange={(v) =>
                  setSyncForm((prev) => ({
                    ...prev,
                    delete_mode: v as "unpublish" | "soft_delete",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="删除策略" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpublish">仅下线（推荐）</SelectItem>
                  <SelectItem value="soft_delete">软删除</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {`GitHub Token${syncSettings?.token_masked ? `（已保存：${syncSettings.token_masked}）` : ""}`}
              </label>
              <Input
                type="password"
                value={syncForm.token}
                placeholder="留空表示不修改已保存 Token"
                onChange={(e) =>
                  setSyncForm((prev) => ({ ...prev, token: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={syncLoading}
                onClick={() => void loadSync()}
              >
                {syncLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                刷新状态
              </Button>
              <Button
                type="button"
                disabled={syncSaving}
                onClick={async () => {
                  if (!validateSyncForm()) return;
                  setSyncSaving(true);
                  try {
                    const saved = await githubSyncApi.saveSettings({
                      repo_url: syncForm.repo_url.trim(),
                      branch: syncForm.branch.trim(),
                      token: syncForm.token.trim() || undefined,
                      enabled: syncForm.enabled,
                      interval_hours: Number(syncForm.interval_hours || 48),
                      delete_mode: syncForm.delete_mode,
                    });
                    setSyncSettings(saved);
                    setSyncForm((prev) => ({ ...prev, token: "" }));
                    showMessage.success("配置已保存");
                  } catch (e: any) {
                    showMessage.error(extractErrorMsg(e, "保存失败"));
                  } finally {
                    setSyncSaving(false);
                  }
                }}
              >
                {syncSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                保存配置
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!validateSyncForm(["repo_url", "branch"])) return;
                  const token = syncForm.token.trim();
                  if (!token && !syncSettings?.token_configured) {
                    showMessage.warning("请先输入 Token 或先保存过 Token");
                    return;
                  }
                  try {
                    await githubSyncApi.testConnection({
                      repo_url: syncForm.repo_url.trim(),
                      branch: syncForm.branch.trim(),
                      token: token || "__use_saved_token__",
                    });
                    showMessage.success("连接成功");
                  } catch (e: any) {
                    showMessage.error(extractErrorMsg(e, "连接失败"));
                  }
                }}
              >
                测试连接
              </Button>
              <Button
                type="button"
                disabled={syncTriggering}
                onClick={async () => {
                  setSyncTriggering(true);
                  setSyncTaskStatus({
                    task_id: "__local__",
                    state: "PROGRESS",
                    ready: false,
                    successful: false,
                    progress_percent: 10,
                    progress_done: 0,
                    progress_total: 1,
                    progress_phase: "sync",
                    progress_current: "正在同步...",
                    created_paths: [],
                    updated_paths: [],
                    deleted_paths: [],
                    compiled_note_ids: [],
                    compile_failed: [],
                  });
                  try {
                    const run = await githubSyncApi.trigger(false);
                    setLastRun(run);
                    const taskId =
                      run.task_id ||
                      (run.status?.startsWith("queued:")
                        ? run.status.split("queued:")[1]
                        : "");
                    if (taskId) {
                      setSyncTaskId(taskId);
                      setSyncTaskStatus(null);
                    } else {
                      setSyncTaskStatus({
                        task_id: "__local__",
                        state: "SUCCESS",
                        ready: true,
                        successful: run.status === "success",
                        progress_percent: 100,
                        progress_done: 1,
                        progress_total: 1,
                        progress_phase: "done",
                        progress_current: "",
                        created_paths: [],
                        updated_paths: [],
                        deleted_paths: [],
                        compiled_note_ids: [],
                        compile_failed: [],
                      });
                      openSyncResult(
                        "同步完成",
                        `新增 ${run.created_count}，更新 ${run.updated_count}，删除 ${run.deleted_count}，跳过 ${run.skipped_count}`,
                      );
                    }
                    await load();
                    await loadSync(false);
                  } catch (e: any) {
                    setSyncTaskStatus(null);
                    showMessage.error(extractErrorMsg(e, "触发同步失败"));
                  } finally {
                    setSyncTriggering(false);
                  }
                }}
              >
                {syncTriggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                立即同步
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={syncRecompileTriggering}
                onClick={async () => {
                  setSyncRecompileTriggering(true);
                  setSyncTaskStatus({
                    task_id: "__local__",
                    state: "PROGRESS",
                    ready: false,
                    successful: false,
                    progress_percent: 10,
                    progress_done: 0,
                    progress_total: 1,
                    progress_phase: "recompile",
                    progress_current: "正在重新编译...",
                    created_paths: [],
                    updated_paths: [],
                    deleted_paths: [],
                    compiled_note_ids: [],
                    compile_failed: [],
                  });
                  try {
                    const run = await githubSyncApi.trigger(false, true);
                    setLastRun(run);
                    const taskId =
                      run.task_id ||
                      (run.status?.startsWith("queued:")
                        ? run.status.split("queued:")[1]
                        : "");
                    if (taskId) {
                      setSyncTaskId(taskId);
                      setSyncTaskStatus(null);
                    } else {
                      setSyncTaskStatus({
                        task_id: "__local__",
                        state: "SUCCESS",
                        ready: true,
                        successful: run.status === "success",
                        progress_percent: 100,
                        progress_done: 1,
                        progress_total: 1,
                        progress_phase: "done",
                        progress_current: "",
                        created_paths: [],
                        updated_paths: [],
                        deleted_paths: [],
                        compiled_note_ids: [],
                        compile_failed: [],
                      });
                      openSyncResult(
                        "重新编译完成",
                        `新增 ${run.created_count}，更新 ${run.updated_count}，删除 ${run.deleted_count}，跳过 ${run.skipped_count}`,
                      );
                    }
                    await loadSync(false);
                  } catch (e: any) {
                    setSyncTaskStatus(null);
                    showMessage.error(extractErrorMsg(e, "触发全部重新编译失败"));
                  } finally {
                    setSyncRecompileTriggering(false);
                  }
                }}
              >
                {syncRecompileTriggering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                全部重新编译
              </Button>
            </div>

            <div className="rounded-xl bg-surface-2 p-3">
              <div className="font-semibold">最近同步状态</div>
              <div className="mt-2">
                <span className="text-text-tertiary">运行状态：</span>
                <Badge
                  variant={
                    lastRun?.status?.includes("success")
                      ? "success"
                      : lastRun?.status?.includes("failed")
                        ? "danger"
                        : "info"
                  }
                  className="ml-1 border-0"
                >
                  {lastRun?.status || "暂无"}
                </Badge>
              </div>
              <div className="mt-1.5 text-sm text-text-tertiary">
                统计：新增 {lastRun?.created_count ?? 0}，更新 {lastRun?.updated_count ?? 0}，删除{" "}
                {lastRun?.deleted_count ?? 0}，跳过 {lastRun?.skipped_count ?? 0}
              </div>
              {lastRun?.error_summary ? (
                <div className="mt-1.5 text-sm text-destructive">错误：{lastRun.error_summary}</div>
              ) : null}
              {lastRun?.finished_at ? (
                <div className="mt-1.5 text-sm text-text-tertiary">
                  完成时间：{new Date(lastRun.finished_at).toLocaleString("zh-CN")}
                </div>
              ) : null}
              {syncTaskStatus ? (
                <div className="mt-2.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ws-color-border-secondary)]">
                    <div
                      className={
                        syncTaskStatus.state === "FAILURE"
                          ? "h-full bg-[var(--ws-color-error)] transition-all"
                          : syncTaskStatus.ready
                            ? "h-full bg-[var(--ws-color-success)] transition-all"
                            : "h-full bg-[var(--ws-color-info)] transition-all"
                      }
                      style={{ width: `${clampPercent(syncTaskStatus.progress_percent)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-sm text-text-tertiary">
                    进度：{syncTaskStatus.progress_done}/{syncTaskStatus.progress_total || "?"}
                    {syncTaskStatus.progress_phase
                      ? ` · 阶段 ${syncTaskStatus.progress_phase}`
                      : ""}
                  </div>
                  {syncTaskStatus.progress_current ? (
                    <div className="mt-1 text-sm text-text-tertiary">
                      当前文件：{syncTaskStatus.progress_current}
                    </div>
                  ) : null}
                  {syncTaskStatus.error ? (
                    <div className="mt-1 text-sm text-destructive">
                      任务错误：{syncTaskStatus.error}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSyncModalOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={syncResultOpen} onOpenChange={setSyncResultOpen}>
        <DialogContent className="sm:max-w-[780px]">
          <DialogHeader>
            <DialogTitle>{syncResultTitle || "同步结果"}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-3 text-xs leading-relaxed">
            {syncResultDetail}
          </pre>
          <DialogFooter>
            <Button type="button" onClick={() => setSyncResultOpen(false)}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
};

export default AdminInformatics;
