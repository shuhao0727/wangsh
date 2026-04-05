// 课堂计划 - 弹窗组件集合
import { showMessage } from "@/lib/toast";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { planApi, Plan } from "@services/classroomPlan";
import { classroomApi, Activity } from "@services/classroom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
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
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Edit,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Square,
  Trash2,
} from "lucide-react";

const parseErr = (e: any) => String(e?.response?.data?.detail || e?.message || "操作失败");

const STATUS_MAP: Record<string, { label: string; dot: string; softBg?: string }> = {
  draft: { label: "草稿", dot: "bg-text-tertiary" },
  active: { label: "进行中", dot: "bg-[var(--ws-color-info)]", softBg: "bg-[var(--ws-color-info-soft)]" },
  ended: { label: "已结束", dot: "bg-[var(--ws-color-success)]" },
};

const ACTIVITY_TYPE_MAP: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  vote: { label: "投票", variant: "info" },
  fill_blank: { label: "填空", variant: "success" },
};

const FilterOption = {
  all: "__all__",
} as const;

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const item = STATUS_MAP[status] || { label: status, dot: "bg-text-tertiary" };
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-secondary">
      <span className={cn("h-1.5 w-1.5 rounded-full", item.dot)} />
      {item.label}
    </span>
  );
};

const ActivityTypeTag: React.FC<{ type?: string | null }> = ({ type }) => {
  const item = ACTIVITY_TYPE_MAP[String(type || "")];
  return (
    <Badge variant={item?.variant || "neutral"}>
      {item?.label || "活动"}
    </Badge>
  );
};

// ─── Step 1: 选活动 + Step 2: 排序 ───
interface PlanFormProps {
  open: boolean;
  editing: Plan | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PlanFormModal: React.FC<PlanFormProps> = ({ open, editing, onClose, onSuccess }) => {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loadingActs, setLoadingActs] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoadingActs(true);
    try {
      const resp = await classroomApi.list({ skip: 0, limit: 200 });
      setAllActivities(resp.items);
    } catch {
      setAllActivities([]);
    } finally {
      setLoadingActs(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSearch("");
    setTypeFilter(undefined);
    setStatusFilter(undefined);
    void fetchActivities();

    if (editing) {
      setTitle(editing.title);
      setSelectedIds(
        [...editing.items]
          .sort((a, b) => a.order_index - b.order_index)
          .map((it) => it.activity_id),
      );
    } else {
      setTitle("");
      setSelectedIds([]);
    }
  }, [open, editing, fetchActivities]);

  const filtered = allActivities.filter((a) => {
    if (typeFilter && a.activity_type !== typeFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const editingActMap = Object.fromEntries(
    (editing?.items || []).map((it) => [it.activity_id, it.activity]).filter(([, a]) => a),
  );
  const actMap: Record<number, Activity> = {
    ...editingActMap,
    ...Object.fromEntries(allActivities.map((a) => [a.id, a])),
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showMessage.warning("请输入计划标题");
      return;
    }
    if (selectedIds.length === 0) {
      showMessage.warning("请至少选择一个活动");
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await planApi.update(editing.id, title.trim(), selectedIds);
        showMessage.success("已更新");
      } else {
        await planApi.create(title.trim(), selectedIds);
        showMessage.success("创建成功");
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      showMessage.error(parseErr(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[780px]">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑计划" : "创建课堂计划"}</DialogTitle>
        </DialogHeader>

        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className={cn("rounded-full px-2 py-0.5", step === 0 ? "bg-[var(--ws-color-primary-soft)] text-primary" : "bg-surface-2 text-text-tertiary")}>1. 选择活动</span>
          <span className="text-text-tertiary">→</span>
          <span className={cn("rounded-full px-2 py-0.5", step === 1 ? "bg-[var(--ws-color-primary-soft)] text-primary" : "bg-surface-2 text-text-tertiary")}>2. 调整顺序</span>
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-sm font-medium">计划标题</div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：第3章课堂练习"
                maxLength={200}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="搜索标题"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-[180px]"
              />
              <Select
                value={typeFilter ?? FilterOption.all}
                onValueChange={(value) => setTypeFilter(value === FilterOption.all ? undefined : value)}
              >
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FilterOption.all}>全部类型</SelectItem>
                  <SelectItem value="vote">投票</SelectItem>
                  <SelectItem value="fill_blank">填空</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter ?? FilterOption.all}
                onValueChange={(value) => setStatusFilter(value === FilterOption.all ? undefined : value)}
              >
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FilterOption.all}>全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="active">进行中</SelectItem>
                  <SelectItem value="ended">已结束</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-text-tertiary">已选 {selectedIds.length} 个</span>
            </div>

            <div className="max-h-[320px] overflow-auto rounded-lg border border-border bg-surface">
              {loadingActs ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-tertiary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载活动...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-text-tertiary">暂无活动</div>
              ) : (
                filtered.map((activity) => {
                  const checked = selectedIds.includes(activity.id);
                  const isActive = activity.status === "active";
                  return (
                    <div
                      key={activity.id}
                      onClick={() => {
                        if (isActive) return;
                        setSelectedIds((prev) =>
                          prev.includes(activity.id)
                            ? prev.filter((id) => id !== activity.id)
                            : [...prev, activity.id],
                        );
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 border-b border-border-secondary px-2.5 py-1.5 transition-colors last:border-b-0",
                        isActive && "cursor-not-allowed opacity-60",
                        checked ? "bg-[var(--ws-color-primary-soft)]" : "hover:bg-[var(--ws-color-hover-bg)]",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        disabled={isActive}
                        className="h-3.5 w-3.5 rounded border border-border-secondary accent-primary"
                      />
                      <ActivityTypeTag type={activity.activity_type} />
                      <span className="flex-1 truncate text-sm">{activity.title}</span>
                      <StatusBadge status={activity.status} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="overflow-hidden rounded-lg border border-border">
            {selectedIds.map((id, idx) => {
              const act = actMap[id];
              return (
                <div
                  key={id}
                  className={cn(
                    "flex items-center gap-2 border-b border-border-secondary px-3 py-2 last:border-b-0",
                    idx % 2 === 0 ? "bg-surface-2" : "bg-surface",
                  )}
                >
                  <span className="min-w-[24px] text-xs text-text-tertiary">{idx + 1}.</span>
                  <ActivityTypeTag type={act?.activity_type} />
                  <span className="flex-1 truncate text-sm">{act?.title || `活动 ${id}`}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => {
                        if (idx === 0) return;
                        setSelectedIds((prev) => {
                          const next = [...prev];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          return next;
                        });
                      }}
                      disabled={idx === 0}
                      title="上移"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => {
                        if (idx === selectedIds.length - 1) return;
                        setSelectedIds((prev) => {
                          const next = [...prev];
                          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                          return next;
                        });
                      }}
                      disabled={idx === selectedIds.length - 1}
                      title="下移"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => setSelectedIds((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      移除
                    </Button>
                  </div>
                </div>
              );
            })}
            {selectedIds.length === 0 && (
              <div className="py-10 text-center text-sm text-text-tertiary">暂无已选活动</div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 0 ? (
            <>
              <Button variant="outline" onClick={onClose}>取消</Button>
              <Button
                onClick={() => setStep(1)}
                disabled={selectedIds.length === 0 || !title.trim()}
              >
                下一步：调整顺序
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(0)}>上一步</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing ? "保存" : "创建计划"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── 控制台 Modal（每题单独控制） ───
interface ConsoleProps {
  plan: Plan | null;
  open: boolean;
  onClose: () => void;
  onRefresh: (id: number) => Promise<void>;
}

const PlanConsoleModal: React.FC<ConsoleProps> = ({ plan, open, onClose, onRefresh }) => {
  const [loading, setLoading] = useState<string | null>(null);

  const doAction = async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    try {
      await fn();
      if (plan) await onRefresh(plan.id);
    } catch (e: any) {
      showMessage.error(parseErr(e));
    } finally {
      setLoading(null);
    }
  };

  if (!plan) return null;

  const items = [...plan.items].sort((a, b) => a.order_index - b.order_index);

  const handleRefresh = async () => {
    setLoading("refresh-plan");
    try {
      await onRefresh(plan.id);
      showMessage.success("已刷新");
    } catch (e: any) {
      showMessage.error(parseErr(e));
    } finally {
      setLoading(null);
    }
  };

  const confirmRun = (message: string, key: string, fn: () => Promise<any>) => {
    if (!window.confirm(message)) return;
    void doAction(key, fn);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{`控制台：${plan.title}`}</DialogTitle>
        </DialogHeader>

        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={plan.status} />

          {plan.status === "draft" && (
            <Button
              size="sm"
              onClick={() => confirmRun("启动计划？（启动后可逐题开始）", "start-plan", () => planApi.start(plan.id))}
              disabled={loading !== null}
            >
              {loading === "start-plan" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              启动计划
            </Button>
          )}

          {plan.status === "active" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => confirmRun("强制结束整个计划？", "end-plan", () => planApi.end(plan.id))}
              disabled={loading !== null}
            >
              {loading === "end-plan" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
              结束计划
            </Button>
          )}

          {plan.status === "ended" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                confirmRun(
                  "重置计划？（所有题目恢复为待开始，计划状态变为草稿）",
                  "reset-plan",
                  () => planApi.reset(plan.id),
                )
              }
              disabled={loading !== null}
            >
              {loading === "reset-plan" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              重置计划
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={loading !== null}
          >
            {loading === "refresh-plan" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            刷新
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          {items.map((item, idx) => {
            const isActive = item.status === "active";
            const isPending = item.status === "pending";
            const startKey = `start-${item.id}`;
            const endKey = `end-${item.id}`;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-2 border-b border-border-secondary px-3 py-2 last:border-b-0",
                  isActive ? "bg-[var(--ws-color-primary-soft)]" : idx % 2 === 0 ? "bg-surface-2" : "bg-surface",
                )}
              >
                <span className="min-w-[24px] text-xs text-text-tertiary">{idx + 1}.</span>
                <ActivityTypeTag type={item.activity?.activity_type} />
                <span className={cn("flex-1 text-sm", isActive ? "font-semibold" : "font-normal")}>{item.activity?.title || `活动 ${item.activity_id}`}</span>
                <StatusBadge status={isActive ? "active" : item.status === "ended" ? "ended" : "draft"} />

                <div className="flex items-center gap-1">
                  {isPending && plan.status === "active" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        confirmRun("开始该题？（当前进行中的题目将自动结束）", startKey, () =>
                          planApi.startItem(plan.id, item.id),
                        )
                      }
                      disabled={loading !== null}
                    >
                      {loading === startKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      开始
                    </Button>
                  )}
                  {isActive && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => confirmRun("结束该题？", endKey, () => planApi.endItem(plan.id, item.id))}
                      disabled={loading !== null}
                    >
                      {loading === endKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                      结束
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── 计划列表 Modal（主入口） ───
interface PlanListModalProps {
  open: boolean;
  onClose: () => void;
}

export const PlanListModal: React.FC<PlanListModalProps> = ({ open, onClose }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consolePlan, setConsolePlan] = useState<Plan | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await planApi.list(0, 50);
      setPlans(resp.items);
    } catch (e: any) {
      showMessage.error(parseErr(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchList();
    }
  }, [open, fetchList]);

  const refreshPlan = async (id: number) => {
    const detail = await planApi.get(id);
    setPlans((prev) => prev.map((plan) => (plan.id === id ? detail : plan)));
    if (consolePlan?.id === id) setConsolePlan(detail);
  };

  const openConsole = async (plan: Plan) => {
    try {
      const detail = await planApi.get(plan.id);
      setConsolePlan(detail);
    } catch {
      setConsolePlan(plan);
    }
    setConsoleOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("确认删除？")) return;
    try {
      await planApi.remove(id);
      showMessage.success("已删除");
      void fetchList();
    } catch (e: any) {
      showMessage.error(parseErr(e));
    }
  };

  const columns = useMemo<ColumnDef<Plan>[]>(
    () => [
      {
        id: "id",
        header: "ID",
        accessorKey: "id",
        size: 60,
        meta: { className: "w-[60px] align-top" },
        cell: ({ row }) => (
          <span className="text-xs text-text-tertiary">{row.original.id}</span>
        ),
      },
      {
        id: "title",
        header: "计划标题",
        accessorKey: "title",
        meta: { className: "align-top" },
        cell: ({ row }) => (
          <span className="block max-w-[300px] truncate">{row.original.title}</span>
        ),
      },
      {
        id: "item_count",
        header: "题数",
        accessorFn: (row) => row.items.length,
        size: 70,
        meta: { className: "w-[70px] align-top" },
      },
      {
        id: "status",
        header: "状态",
        accessorKey: "status",
        size: 110,
        meta: { className: "w-[110px] align-top" },
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "action",
        header: "操作",
        size: 200,
        meta: { className: "w-[200px] align-top" },
        cell: ({ row }) => {
          const plan = row.original;
          return (
            <div className="flex items-center gap-1.5">
              {plan.status !== "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(plan);
                    setFormOpen(true);
                  }}
                >
                  <Edit className="h-3.5 w-3.5" />
                  编辑
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void openConsole(plan);
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                控制台
              </Button>
              {plan.status !== "active" ? (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => {
                    void handleDelete(plan.id);
                  }}
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [openConsole],
  );

  const table = useReactTable({
    data: plans,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="sm:max-w-[780px]">
          <DialogHeader>
            <DialogTitle>课堂计划管理</DialogTitle>
          </DialogHeader>

          <div className="mb-2 flex items-center justify-between">
            <Button size="sm" variant="outline" onClick={() => { void fetchList(); }} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              刷新
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              创建计划
            </Button>
          </div>

          <div className="max-h-[500px] overflow-auto rounded-lg border border-border">
            <DataTable
              table={table}
              tableClassName="min-w-[760px]"
              emptyState={
                !loading ? (
                  <div className="py-8 text-center text-sm text-text-tertiary">
                    暂无计划
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-text-tertiary">
                    正在加载...
                  </div>
                )
              }
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSuccess={() => {
          void fetchList();
        }}
      />

      <PlanConsoleModal
        plan={consolePlan}
        open={consoleOpen}
        onClose={() => setConsoleOpen(false)}
        onRefresh={refreshPlan}
      />
    </>
  );
};

export default PlanListModal;
