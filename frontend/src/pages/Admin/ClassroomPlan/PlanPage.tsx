// 课堂计划 - 独立页面
import { showMessage } from "@/lib/toast";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Edit,
  GripVertical,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Square,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { planApi, type Plan, type PlanItem } from "@services/classroomPlan";
import { classroomApi, type Activity, type ActivityStats } from "@services/classroom";
import { AdminPage } from "@components/Admin";
import { ActivityDetailContent } from "@components/ActivityDetailDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";
import { cn } from "@/lib/utils";

const ACTIVITY_FETCH_BATCH_SIZE = 100;

const parseErr = (e: any, fallback = "操作失败") =>
  String(e?.response?.data?.detail || e?.message || fallback);

const STATUS_MAP: Record<string, { label: string; dot: string; softBg?: string }> = {
  draft: { label: "草稿", dot: "bg-text-tertiary" },
  active: { label: "进行中", dot: "bg-[var(--ws-color-info)]", softBg: "bg-primary-soft" },
  ended: { label: "已结束", dot: "bg-[var(--ws-color-success)]" },
};

const ACTIVITY_TYPE_MAP: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  vote: { label: "投票", variant: "info" },
  fill_blank: { label: "填空", variant: "success" },
};

const FilterOption = {
  all: "__all__",
} as const;

const itemStatusToActivityStatus = (status: "pending" | "active" | "ended"): Activity["status"] => {
  if (status === "active") return "active";
  if (status === "ended") return "ended";
  return "draft";
};

const makeActivityFromPlanItem = (item: PlanItem): Activity => {
  const now = new Date().toISOString();
  return {
    id: item.activity?.id ?? item.activity_id,
    activity_type: item.activity?.activity_type === "fill_blank" ? "fill_blank" : "vote",
    title: item.activity?.title || `活动 ${item.activity_id}`,
    options: item.activity?.options ?? [],
    correct_answer: item.activity?.correct_answer ?? null,
    allow_multiple: Boolean(item.activity?.allow_multiple),
    time_limit: Number(item.activity?.time_limit || 60),
    status: itemStatusToActivityStatus(item.status),
    started_at: null,
    ended_at: null,
    created_by: 1,
    created_at: now,
    response_count: item.activity?.status === "ended" ? undefined : 0,
    analysis_status: null,
    analysis_result: null,
    analysis_context: null,
  };
};

type PlanFormSubmitPayload = {
  title: string;
  selectedIds: number[];
};

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

const SortableItem: React.FC<{
  id: number;
  act: Activity | null | undefined;
  onRemove: () => void;
}> = ({ id, act, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 border-b border-border px-3 py-2",
        isDragging ? "bg-primary-soft" : "bg-surface",
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 999 : undefined,
      }}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="inline-flex h-6 w-6 appearance-none items-center justify-center rounded border-0 bg-transparent text-text-tertiary hover:bg-[var(--ws-color-hover-bg)]"
        aria-label="拖动排序"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <ActivityTypeTag type={act?.activity_type} />
      <span className="flex-1 truncate text-sm">{act?.title || `活动 ${id}`}</span>
      <Button variant="outline" size="sm" onClick={onRemove} className="text-xs text-destructive hover:text-destructive">
        移除
      </Button>
    </div>
  );
};

interface PlanFormPanelProps {
  editing: Plan | null;
  activities: Activity[];
  loadingActivities: boolean;
  onCancel: () => void;
  onSubmit: (payload: PlanFormSubmitPayload) => Promise<void> | void;
}

const PlanFormPanel: React.FC<PlanFormPanelProps> = ({
  editing,
  activities,
  loadingActivities,
  onCancel,
  onSubmit,
}) => {
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setSearch("");
    setTypeFilter(undefined);
    setStatusFilter(undefined);

    if (editing) {
      setTitle(editing.title);
      setSelectedIds(
        [...editing.items]
          .sort((a, b) => a.order_index - b.order_index)
          .map((it) => it.activity_id),
      );
      return;
    }

    setTitle("");
    setSelectedIds([]);
  }, [editing]);

  const editingActMap = Object.fromEntries(
    (editing?.items || []).map((it) => [it.activity_id, it.activity]).filter(([, activity]) => activity),
  );
  const actMap: Record<number, Activity> = {
    ...editingActMap,
    ...Object.fromEntries(activities.map((activity) => [activity.id, activity])),
  };

  const filtered = activities.filter((activity) => {
    if (typeFilter && activity.activity_type !== typeFilter) return false;
    if (statusFilter && activity.status !== statusFilter) return false;
    if (search && !activity.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedIds((ids) => {
        const oldIndex = ids.indexOf(active.id as number);
        const newIndex = ids.indexOf(over.id as number);
        return arrayMove(ids, oldIndex, newIndex);
      });
    }
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
      await onSubmit({
        title: title.trim(),
        selectedIds: [...selectedIds],
      });
    } catch (e: any) {
      showMessage.error(parseErr(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <div className="mb-1 text-sm font-medium">计划标题</div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：第3章课堂练习"
          maxLength={200}
        />
      </div>

      <div className="grid min-h-[240px] flex-1 gap-3 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col">
          <div className="mb-1.5 text-sm font-semibold">
            选择活动 <span className="text-xs font-normal text-text-tertiary">（点击勾选）</span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Input
              placeholder="搜索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-[160px]"
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
          </div>

          <div className="min-h-[180px] flex-1 overflow-auto rounded-lg border border-border bg-surface">
            {loadingActivities ? (
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
                      checked ? "bg-primary-soft" : "hover:bg-[var(--ws-color-hover-bg)]",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      disabled={isActive}
                      className="h-3.5 w-3.5 rounded border border-border accent-primary"
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

        <div className="flex min-h-0 flex-col">
          <div className="mb-1.5 text-sm font-semibold">
            已选活动
            <span className="text-xs font-normal text-text-tertiary">
              {` （拖动排序，共 ${selectedIds.length} 个）`}
            </span>
          </div>
          <div className="min-h-[180px] flex-1 overflow-auto rounded-lg border border-border bg-surface">
            {selectedIds.length === 0 ? (
              <div className="py-10 text-center text-sm text-text-tertiary">从左侧勾选活动</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
                  {selectedIds.map((id) => (
                    <SortableItem
                      key={id}
                      id={id}
                      act={actMap[id]}
                      onRemove={() => setSelectedIds((prev) => prev.filter((value) => value !== id))}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto flex justify-end gap-2 border-t border-border-secondary pt-3">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {editing ? "保存" : "创建计划"}
        </Button>
      </div>
    </div>
  );
};

interface ConsolePanelProps {
  plan: Plan;
  onRefresh: (id: number) => Promise<void>;
  onStartPlan: (id: number) => Promise<void>;
  onEndPlan: (id: number) => Promise<void>;
  onResetPlan: (id: number) => Promise<void>;
  onStartItem: (planId: number, itemId: number) => Promise<void>;
  onEndItem: (planId: number, itemId: number) => Promise<void>;
  onRestartItem: (planId: number, itemId: number) => Promise<void>;
  onUpdateItemTime: (planId: number, itemId: number, timeLimit: number) => Promise<void>;
}

const PlanConsolePanel: React.FC<ConsolePanelProps> = ({
  plan,
  onRefresh,
  onStartPlan,
  onEndPlan,
  onResetPlan,
  onStartItem,
  onEndItem,
  onRestartItem,
  onUpdateItemTime,
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [editTimeId, setEditTimeId] = useState<number | null>(null);
  const [editTimeVal, setEditTimeVal] = useState<number>(60);
  const [drawerActivity, setDrawerActivity] = useState<Activity | null>(null);
  const [drawerStats, setDrawerStats] = useState<ActivityStats | null>(null);

  const items = useMemo(
    () => [...plan.items].sort((a, b) => a.order_index - b.order_index),
    [plan.items],
  );

  const openDetail = async (item: PlanItem) => {
    const fallbackActivity = makeActivityFromPlanItem(item);
    setDrawerActivity(fallbackActivity);
    setDrawerStats(null);
    try {
      const detail = await classroomApi.getDetail(item.activity_id);
      setDrawerActivity(detail);
      setDrawerStats(detail.stats ?? null);
    } catch (e: any) {
      showMessage.error(parseErr(e, "加载活动详情失败"));
    }
  };

  const doAction = async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    try {
      await fn();
      await onRefresh(plan.id);
    } catch (e: any) {
      showMessage.error(parseErr(e));
    } finally {
      setLoading(null);
    }
  };

  const handleUpdateTime = async (item: PlanItem) => {
    try {
      await onUpdateItemTime(plan.id, item.id, editTimeVal);
      showMessage.success("时间已更新");
      setEditTimeId(null);
    } catch (e: any) {
      showMessage.error(parseErr(e));
    }
  };

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
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={plan.status} />

        {plan.status === "draft" && (
          <Button
            size="sm"
            onClick={() => confirmRun("启动计划？", "start-plan", () => onStartPlan(plan.id))}
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
            onClick={() => confirmRun("强制结束整个计划？", "end-plan", () => onEndPlan(plan.id))}
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
                "重置计划？（所有题目恢复为待开始，计划变为草稿）",
                "reset-plan",
                () => onResetPlan(plan.id),
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
        {items.length === 0 && (
          <div className="py-10 text-center text-sm text-text-tertiary">该计划暂无题目</div>
        )}

        {items.map((item, idx) => {
          const isActive = item.status === "active";
          const isPending = item.status === "pending";
          const isEnded = item.status === "ended";
          const startKey = `start-${item.id}`;
          const endKey = `end-${item.id}`;
          const restartKey = `restart-${item.id}`;
          const isEditingTime = editTimeId === item.id;

          return (
            <div
              key={item.id}
              className={cn(
                "border-b border-border px-3 py-2 last:border-b-0",
                STATUS_MAP[item.status]?.softBg || (idx % 2 === 0 ? "bg-surface-2" : "bg-surface"),
              )}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-[24px] text-xs text-text-tertiary">{idx + 1}.</span>
                <ActivityTypeTag type={item.activity?.activity_type} />
                <span className={cn("flex-1 truncate text-sm", isActive && "font-semibold")}>
                  {item.activity?.title || `活动 ${item.activity_id}`}
                </span>
                <span className="text-xs text-text-tertiary">
                  {item.activity?.time_limit ? `${item.activity.time_limit}s` : "无限"}
                </span>
                <StatusBadge status={isEnded ? "ended" : isActive ? "active" : "draft"} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-purple"
                  onClick={() => {
                    if (!item.activity_id) return;
                    void openDetail(item);
                  }}
                >
                  详情
                </Button>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-7">
                {isPending && plan.status === "active" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      confirmRun(
                        "开始该题？（当前进行中的题目将自动结束）",
                        startKey,
                        () => onStartItem(plan.id, item.id),
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
                    onClick={() =>
                      confirmRun("结束该题？", endKey, () => onEndItem(plan.id, item.id))
                    }
                    disabled={loading !== null}
                  >
                    {loading === endKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                    结束
                  </Button>
                )}

                {isEnded && plan.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      confirmRun("重新开始该题？", restartKey, () => onRestartItem(plan.id, item.id))
                    }
                    disabled={loading !== null}
                  >
                    {loading === restartKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    重新开始
                  </Button>
                )}

                {!isActive && (
                  isEditingTime ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={String(editTimeVal)}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setEditTimeVal(Number.isFinite(value) ? value : 0);
                        }}
                        className="h-7 w-20"
                      />
                      <span className="text-xs text-text-tertiary">秒</span>
                      <Button size="sm" onClick={() => { void handleUpdateTime(item); }}>
                        确定
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditTimeId(null)}>
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditTimeId(item.id);
                        setEditTimeVal(item.activity?.time_limit ?? 60);
                      }}
                    >
                      修改时限
                    </Button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Sheet
        open={!!drawerActivity}
        onOpenChange={(next) => {
          if (!next) {
            setDrawerActivity(null);
            setDrawerStats(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full max-w-[680px] overflow-y-auto px-4 py-4 sm:px-6">
          <SheetHeader>
            <SheetTitle>{drawerActivity?.title || "活动详情"}</SheetTitle>
          </SheetHeader>
          <div className="mt-3">
            {drawerActivity && <ActivityDetailContent activity={drawerActivity} stats={drawerStats} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

type RightView =
  | { type: "none" }
  | { type: "form"; editingId: number | null }
  | { type: "console"; planId: number };

const ClassroomPlanPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [rightView, setRightView] = useState<RightView>({ type: "none" });
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [consolePlan, setConsolePlan] = useState<Plan | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const replacePlanInList = useCallback((nextPlan: Plan) => {
    setPlans((prev) => prev.map((plan) => (plan.id === nextPlan.id ? nextPlan : plan)));
  }, []);

  const applyPlanUpdate = useCallback((nextPlan: Plan) => {
    replacePlanInList(nextPlan);
    setEditingPlan((prev) => (prev?.id === nextPlan.id ? nextPlan : prev));
    setConsolePlan((prev) => (prev?.id === nextPlan.id ? nextPlan : prev));
  }, [replacePlanInList]);

  const loadPlans = useCallback(async (targetPage: number, targetPageSize: number, quiet = false) => {
    if (!quiet) {
      setListLoading(true);
    }
    try {
      const resp = await planApi.list((targetPage - 1) * targetPageSize, targetPageSize);
      const nextTotalPages = Math.max(1, Math.ceil(resp.total / targetPageSize));
      setTotal(resp.total);

      if (targetPage > nextTotalPages) {
        setPage(nextTotalPages);
        return;
      }

      setPlans(resp.items);
    } finally {
      if (!quiet) {
        setListLoading(false);
      }
    }
  }, []);

  const loadActivities = useCallback(async () => {
    setActivityLoading(true);
    try {
      let skip = 0;
      const nextActivities: Activity[] = [];

      while (true) {
        const resp = await classroomApi.list({ skip, limit: ACTIVITY_FETCH_BATCH_SIZE });
        nextActivities.push(...resp.items);

        if (nextActivities.length >= resp.total || resp.items.length < ACTIVITY_FETCH_BATCH_SIZE) {
          break;
        }
        skip += ACTIVITY_FETCH_BATCH_SIZE;
      }

      setActivities(nextActivities);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const loadPlanDetail = useCallback(async (planId: number) => {
    const detail = await planApi.get(planId);
    applyPlanUpdate(detail);
    return detail;
  }, [applyPlanUpdate]);

  useEffect(() => {
    void loadPlans(page, pageSize).catch((e) => {
      showMessage.error(parseErr(e, "加载计划失败"));
    });
  }, [loadPlans, page, pageSize]);

  useEffect(() => {
    void loadActivities().catch((e) => {
      showMessage.error(parseErr(e, "加载活动失败"));
    });
  }, [loadActivities]);

  useEffect(() => {
    if (rightView.type !== "form" || rightView.editingId == null) {
      return;
    }

    void loadPlanDetail(rightView.editingId).catch((e) => {
      showMessage.error(parseErr(e, "加载计划详情失败"));
    });
  }, [loadPlanDetail, rightView]);

  useEffect(() => {
    if (rightView.type !== "console") {
      return;
    }

    void loadPlanDetail(rightView.planId).catch((e) => {
      showMessage.error(parseErr(e, "加载计划详情失败"));
    });
  }, [loadPlanDetail, rightView]);

  const handleRefreshList = useCallback(async () => {
    await Promise.all([
      loadPlans(page, pageSize),
      loadActivities(),
    ]);

    if (rightView.type === "form" && rightView.editingId != null) {
      await loadPlanDetail(rightView.editingId);
    }
    if (rightView.type === "console") {
      await loadPlanDetail(rightView.planId);
    }

    showMessage.success("已刷新");
  }, [loadActivities, loadPlanDetail, loadPlans, page, pageSize, rightView]);

  const handleRefreshPlan = useCallback(async (id: number) => {
    await loadPlanDetail(id);
  }, [loadPlanDetail]);

  const handleFormSubmit = useCallback(async (payload: PlanFormSubmitPayload) => {
    if (rightView.type !== "form") return;

    if (rightView.editingId == null) {
      const created = await planApi.create(payload.title, payload.selectedIds);
      setEditingPlan(null);
      setConsolePlan(created);
      setRightView({ type: "console", planId: created.id });
      if (page !== 1) {
        setPage(1);
      } else {
        await loadPlans(1, pageSize, true);
      }
      showMessage.success("创建成功");
      return;
    }

    const updated = await planApi.update(rightView.editingId, payload.title, payload.selectedIds);
    applyPlanUpdate(updated);
    setEditingPlan(null);
    setConsolePlan(updated);
    setRightView({ type: "console", planId: updated.id });
    showMessage.success("已更新");
  }, [applyPlanUpdate, loadPlans, page, pageSize, rightView]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm("确认删除该计划？")) return;

    await planApi.remove(id);

    setEditingPlan((prev) => (prev?.id === id ? null : prev));
    setConsolePlan((prev) => (prev?.id === id ? null : prev));
    setRightView((prev) => {
      if (prev.type === "form" && prev.editingId === id) return { type: "none" };
      if (prev.type === "console" && prev.planId === id) return { type: "none" };
      return prev;
    });

    const nextTotal = Math.max(0, total - 1);
    const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
    const nextPage = Math.min(page, nextTotalPages);

    if (nextPage !== page) {
      setPage(nextPage);
    } else {
      await loadPlans(nextPage, pageSize, true);
    }

    showMessage.success("已删除");
  }, [loadPlans, page, pageSize, total]);

  const openCreate = useCallback(() => {
    setEditingPlan(null);
    setRightView({ type: "form", editingId: null });
  }, []);

  const openEdit = useCallback((plan: Plan) => {
    setEditingPlan(plan);
    setRightView({ type: "form", editingId: plan.id });
  }, []);

  const openConsole = useCallback((plan: Plan) => {
    setConsolePlan(plan);
    setRightView({ type: "console", planId: plan.id });
  }, []);

  const handleStartPlan = useCallback(async (planId: number) => {
    const nextPlan = await planApi.start(planId);
    applyPlanUpdate(nextPlan);
    showMessage.success("计划已启动");
  }, [applyPlanUpdate]);

  const handleEndPlan = useCallback(async (planId: number) => {
    const nextPlan = await planApi.end(planId);
    applyPlanUpdate(nextPlan);
    showMessage.success("计划已结束");
  }, [applyPlanUpdate]);

  const handleResetPlan = useCallback(async (planId: number) => {
    const nextPlan = await planApi.reset(planId);
    applyPlanUpdate(nextPlan);
    showMessage.success("计划已重置");
  }, [applyPlanUpdate]);

  const handleStartItem = useCallback(async (planId: number, itemId: number) => {
    const nextPlan = await planApi.startItem(planId, itemId);
    applyPlanUpdate(nextPlan);
    showMessage.success("题目已开始");
  }, [applyPlanUpdate]);

  const handleEndItem = useCallback(async (planId: number, itemId: number) => {
    const nextPlan = await planApi.endItem(planId, itemId);
    applyPlanUpdate(nextPlan);
    showMessage.success("题目已结束");
  }, [applyPlanUpdate]);

  const handleRestartItem = useCallback(async (planId: number, itemId: number) => {
    const nextPlan = await planApi.startItem(planId, itemId);
    applyPlanUpdate(nextPlan);
    showMessage.success("题目已重新开始");
  }, [applyPlanUpdate]);

  const handleUpdateItemTime = useCallback(async (planId: number, itemId: number, timeLimit: number) => {
    const plan = await planApi.get(planId);
    const targetItem = plan.items.find((item) => item.id === itemId);
    if (!targetItem) {
      throw new Error("未找到题目");
    }

    await classroomApi.update(targetItem.activity_id, {
      time_limit: Math.max(0, Math.floor(timeLimit)),
    });

    const refreshedPlan = await planApi.get(planId);
    applyPlanUpdate(refreshedPlan);
  }, [applyPlanUpdate]);

  const rightTitle =
    rightView.type === "form"
      ? editingPlan
        ? `编辑计划：${editingPlan.title}`
        : "创建新计划"
      : rightView.type === "console" && consolePlan
        ? `控制台：${consolePlan.title}`
        : "";

  const isConsoleSelected = (id: number) =>
    rightView.type === "console" && rightView.planId === id;

  const columns = useMemo<ColumnDef<Plan>[]>(
    () => [
      {
        id: "id",
        header: "ID",
        accessorKey: "id",
        size: 56,
        meta: { className: "w-[56px] text-xs text-text-tertiary" },
        cell: ({ row }) => (
          <span className="text-xs text-text-tertiary">{row.original.id}</span>
        ),
      },
      {
        id: "title",
        header: "标题",
        accessorKey: "title",
        size: 240,
        meta: { className: "max-w-[240px]" },
        cell: ({ row }) => (
          <span className="block max-w-[220px] truncate text-sm">{row.original.title}</span>
        ),
      },
      {
        id: "count",
        header: "题数",
        size: 70,
        meta: { className: "w-[70px]" },
        cell: ({ row }) => row.original.items.length,
      },
      {
        id: "status",
        header: "状态",
        size: 110,
        meta: { className: "w-[110px]" },
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "action",
        header: "操作",
        size: 120,
        meta: { className: "w-[120px]" },
        cell: ({ row }) => (
          <div
            className="flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            {row.original.status !== "active" && (
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                onClick={() => openEdit(row.original)}
                title="编辑"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => openConsole(row.original)}
              title="控制台"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
            {row.original.status !== "active" && (
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => {
                  void handleDelete(row.original.id);
                }}
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [handleDelete, openConsole, openEdit],
  );

  const table = useReactTable({
    data: plans,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminPage scrollable={false}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div
          className={cn(
            "flex min-h-0 flex-col",
            rightView.type === "none" ? "w-full flex-1" : "w-full lg:w-[36%] lg:flex-none",
          )}
        >
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="text-sm font-semibold">计划列表</div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => { void handleRefreshList(); }} disabled={listLoading}>
                  {listLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  刷新
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  新建
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <DataTable
                table={table}
                className="h-full rounded-none border-0"
                tableClassName="min-w-[680px] lg:min-w-full"
                onRowClick={(row) => {
                  openConsole(row.original);
                }}
                getRowClassName={(row) =>
                  cn("cursor-pointer", isConsoleSelected(row.original.id) && "bg-primary-soft hover:bg-primary-soft")
                }
                emptyState={
                  <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                    {listLoading ? "正在加载..." : "暂无计划"}
                  </div>
                }
              />
            </div>
          </Card>
          <div className="mt-2 flex flex-shrink-0 justify-end border-t border-border-secondary bg-surface pt-3">
            <DataTablePagination
              currentPage={Math.max(1, page)}
              totalPages={Math.max(1, totalPages)}
              total={total}
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

        {rightView.type !== "none" && (
          <div className="flex w-full min-h-0 flex-col lg:w-[64%]">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="truncate pr-4 text-sm font-semibold">{rightTitle}</div>
                <Button size="sm" variant="outline" onClick={() => setRightView({ type: "none" })}>
                  收起
                </Button>
              </div>
              <div
                className={cn(
                  "min-h-0 flex-1 px-3 py-3",
                  rightView.type === "form" ? "overflow-hidden" : "overflow-auto",
                )}
              >
                {rightView.type === "form" && (
                  <PlanFormPanel
                    key={editingPlan ? `edit-${editingPlan.id}` : "new"}
                    editing={editingPlan}
                    activities={activities}
                    loadingActivities={activityLoading}
                    onCancel={() => setRightView({ type: "none" })}
                    onSubmit={handleFormSubmit}
                  />
                )}
                {rightView.type === "console" && consolePlan && (
                  <PlanConsolePanel
                    plan={consolePlan}
                    onRefresh={handleRefreshPlan}
                    onStartPlan={handleStartPlan}
                    onEndPlan={handleEndPlan}
                    onResetPlan={handleResetPlan}
                    onStartItem={handleStartItem}
                    onEndItem={handleEndItem}
                    onRestartItem={handleRestartItem}
                    onUpdateItemTime={handleUpdateItemTime}
                  />
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminPage>
  );
};

export default ClassroomPlanPage;
