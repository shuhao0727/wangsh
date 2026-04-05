// 课堂计划 - 独立页面
import { showMessage } from "@/lib/toast";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Bot,
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
import type { Plan, PlanItem } from "@services/classroomPlan";
import type { Activity, ActivityStats, ActiveAgentOption } from "@services/classroom";
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
import { Textarea } from "@/components/ui/textarea";
import { PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";
import { cn } from "@/lib/utils";

const parseErr = (e: any) => String(e?.response?.data?.detail || e?.message || "操作失败");

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

const FORCE_MOCK_PLANS = true;

const MOCK_PLANS: Plan[] = Array.from({ length: 36 }, (_, index) => {
  const i = index + 1;
  const planId = -i;
  const status = (["draft", "active", "ended"] as const)[index % 3];
  const createdAt = new Date(Date.now() - index * 3_600_000 * 10).toISOString();
  const itemCount = 2 + (index % 3);
  const items = Array.from({ length: itemCount }, (_, itemIndex) => {
    const itemStatus: "pending" | "active" | "ended" =
      status === "ended"
        ? "ended"
        : status === "active" && itemIndex === 0
          ? "active"
          : "pending";
    const activityType = itemIndex % 2 === 0 ? "vote" : "fill_blank";
    return {
      id: -(i * 100 + itemIndex + 1),
      activity_id: i * 100 + itemIndex + 1,
      order_index: itemIndex,
      status: itemStatus,
      activity: {
        id: i * 100 + itemIndex + 1,
        title: `模拟活动 ${i}-${itemIndex + 1}`,
        activity_type: activityType,
        time_limit: 60 + itemIndex * 30,
        status: itemStatus === "active" ? "active" : "draft",
        options: activityType === "vote"
          ? [
              { key: "A", text: "选项 A" },
              { key: "B", text: "选项 B" },
            ]
          : [{ key: "__code__", text: "print(___)" }],
        correct_answer: activityType === "vote" ? "A" : "42",
        allow_multiple: false,
      },
    };
  });
  return {
    id: planId,
    title: `模拟课堂计划 #${String(i).padStart(2, "0")}`,
    status,
    current_item_id: status === "active" ? items[0]?.id ?? null : null,
    created_by: 1,
    created_at: createdAt,
    items,
  };
});

const MOCK_AGENTS: ActiveAgentOption[] = [
  { id: 101, name: "教学分析助手" },
  { id: 102, name: "课堂诊断助手" },
  { id: 103, name: "学习策略助手" },
];

const cloneDeep = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const itemStatusToActivityStatus = (status: "pending" | "active" | "ended"): Activity["status"] => {
  if (status === "active") return "active";
  if (status === "ended") return "ended";
  return "draft";
};

const makeActivityFromPlanItem = (item: PlanItem): Activity => {
  const activityType = item.activity?.activity_type === "fill_blank" ? "fill_blank" : "vote";
  const fallbackOptions =
    activityType === "vote"
      ? [
          { key: "A", text: "选项 A" },
          { key: "B", text: "选项 B" },
        ]
      : [{ key: "__code__", text: "print(___)" }];

  const now = new Date().toISOString();
  return {
    id: item.activity?.id ?? item.activity_id,
    activity_type: activityType,
    title: item.activity?.title || `活动 ${item.activity_id}`,
    options: item.activity?.options || fallbackOptions,
    correct_answer: item.activity?.correct_answer || (activityType === "vote" ? "A" : "42"),
    allow_multiple: Boolean(item.activity?.allow_multiple),
    time_limit: Number(item.activity?.time_limit || 60),
    status: itemStatusToActivityStatus(item.status),
    started_at: null,
    ended_at: null,
    created_by: 1,
    created_at: now,
    response_count: 16 + (Math.abs(item.activity_id) % 12),
    analysis_status: item.status === "ended" ? "success" : "pending",
    analysis_result:
      item.status === "ended"
        ? `**模拟分析结论**\n\n该题整体完成度稳定，建议关注低分段学生的核心概念理解。`
        : null,
    analysis_context:
      item.status === "ended"
        ? {
            risk_slots: [{ slot_index: 1, correct_rate: 52 }],
            common_mistakes: [{ answer: "示例错答", count: 4 }],
          }
        : null,
  };
};

const makeMockStats = (activity: Activity): ActivityStats => {
  const total = 18 + (Math.abs(activity.id) % 23);
  if (activity.activity_type === "vote") {
    const options = Array.isArray(activity.options) && activity.options.length > 0
      ? activity.options
      : [
          { key: "A", text: "选项 A" },
          { key: "B", text: "选项 B" },
        ];
    const optionCounts: Record<string, number> = {};
    let remaining = total;
    options.forEach((option, index) => {
      if (index === options.length - 1) {
        optionCounts[option.key] = remaining;
        return;
      }
      const count = Math.max(1, Math.floor((remaining * (options.length - index)) / (options.length * 1.8)));
      optionCounts[option.key] = count;
      remaining -= count;
    });
    const correctKey = String(activity.correct_answer || "A").split(",")[0]?.trim() || "A";
    const correctCount = optionCounts[correctKey] || 0;
    return {
      activity_id: activity.id,
      total_responses: total,
      option_counts: optionCounts,
      correct_count: correctCount,
      correct_rate: total > 0 ? Math.round((correctCount / total) * 100) : 0,
    };
  }

  const correctRate = 45 + (Math.abs(activity.id) % 45);
  const correctCount = Math.round((total * correctRate) / 100);
  return {
    activity_id: activity.id,
    total_responses: total,
    option_counts: null,
    correct_count: correctCount,
    correct_rate: correctRate,
    blank_slot_stats: [
      {
        slot_index: 1,
        correct_answer: String(activity.correct_answer || "示例答案"),
        total_count: total,
        correct_count: correctCount,
        correct_rate: correctRate,
        top_wrong_answers: [
          { answer: "示例错答1", count: Math.max(1, Math.floor(total * 0.16)) },
          { answer: "示例错答2", count: Math.max(1, Math.floor(total * 0.12)) },
        ],
      },
    ],
    top_wrong_answers: [
      { answer: "示例错答1", count: Math.max(1, Math.floor(total * 0.16)) },
      { answer: "示例错答2", count: Math.max(1, Math.floor(total * 0.12)) },
    ],
  };
};

const PLAN_ACTIVITY_POOL: Activity[] = Array.from(
  new Map(
    MOCK_PLANS.flatMap((plan) =>
      plan.items.map((item) => [item.activity_id, makeActivityFromPlanItem(item)] as const),
    ),
  ).values(),
);

type PlanFormSubmitPayload = {
  title: string;
  selectedIds: number[];
  analysisAgentId?: number;
  analysisPrompt?: string;
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

// ─── 可拖拽行 ────────────────────────────────────────────────────────
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

// ─── 编辑面板 ─────────────────────────────────────────────────────────
interface PlanFormPanelProps {
  editing: Plan | null;
  activities: Activity[];
  agents: ActiveAgentOption[];
  onCancel: () => void;
  onSubmit: (payload: PlanFormSubmitPayload) => Promise<void> | void;
}

const PlanFormPanel: React.FC<PlanFormPanelProps> = ({
  editing,
  activities,
  agents,
  onCancel,
  onSubmit,
}) => {
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [analysisAgentId, setAnalysisAgentId] = useState<number | undefined>();
  const [analysisPrompt, setAnalysisPrompt] = useState("");
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
    } else {
      setTitle("");
      setSelectedIds([]);
      setAnalysisAgentId(undefined);
      setAnalysisPrompt("");
    }
  }, [editing]);

  const editingActMap = Object.fromEntries(
    (editing?.items || []).map((it) => [it.activity_id, it.activity]).filter(([, a]) => a),
  );
  const actMap: Record<number, Activity> = {
    ...editingActMap,
    ...Object.fromEntries(activities.map((a) => [a.id, a])),
  };

  const filtered = activities.filter((a) => {
    if (typeFilter && a.activity_type !== typeFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
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
        analysisAgentId,
        analysisPrompt: analysisPrompt.trim() || undefined,
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
            {filtered.length === 0 ? (
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
                      onRemove={() => setSelectedIds((prev) => prev.filter((i) => i !== id))}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Bot className="h-4 w-4 text-purple" />
          AI 分析配置
          <span className="text-xs font-normal text-text-tertiary">（可选，计划结束后自动分析）</span>
        </div>
        <div className="grid gap-2 lg:grid-cols-[220px_minmax(0,1fr)]">
          <Select
            value={analysisAgentId ? String(analysisAgentId) : FilterOption.all}
            onValueChange={(value) =>
              setAnalysisAgentId(value === FilterOption.all ? undefined : Number(value))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="选择分析智能体" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FilterOption.all}>不启用</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={String(agent.id)}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            className="min-h-[64px]"
            placeholder="分析提示词（可选）"
          />
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

// ─── 控制台面板 ───────────────────────────────────────────────────────
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
    const activity = makeActivityFromPlanItem(item);
    setDrawerActivity(activity);
    setDrawerStats(item.status === "ended" ? makeMockStats(activity) : null);
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

// ─── 主页面 ──────────────────────────────────────────────────────────
type RightView =
  | { type: "none" }
  | { type: "form"; editingId: number | null }
  | { type: "console"; planId: number };

const ClassroomPlanPage: React.FC = () => {
  const [allPlans, setAllPlans] = useState<Plan[]>(() =>
    FORCE_MOCK_PLANS ? cloneDeep(MOCK_PLANS) : [],
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rightView, setRightView] = useState<RightView>({ type: "none" });

  const nextPlanIdRef = useRef(
    Math.max(1, ...MOCK_PLANS.map((plan) => Math.abs(plan.id))) + 1,
  );
  const nextPlanItemIdRef = useRef(
    Math.max(1, ...MOCK_PLANS.flatMap((plan) => plan.items.map((item) => Math.abs(item.id)))) + 1,
  );

  const activityPool = useMemo(() => cloneDeep(PLAN_ACTIVITY_POOL), []);
  const activityMap = useMemo(
    () => new Map(activityPool.map((activity) => [activity.id, activity])),
    [activityPool],
  );

  const total = allPlans.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const plans = useMemo(() => {
    const start = (page - 1) * pageSize;
    return allPlans.slice(start, start + pageSize);
  }, [allPlans, page, pageSize]);

  const editingPlan = useMemo(() => {
    if (rightView.type !== "form" || rightView.editingId == null) return null;
    return allPlans.find((plan) => plan.id === rightView.editingId) || null;
  }, [allPlans, rightView]);

  const consolePlan = useMemo(() => {
    if (rightView.type !== "console") return null;
    return allPlans.find((plan) => plan.id === rightView.planId) || null;
  }, [allPlans, rightView]);

  useEffect(() => {
    if (rightView.type === "console" && !consolePlan) {
      setRightView({ type: "none" });
    }
  }, [consolePlan, rightView]);

  const getActivity = useCallback((activityId: number): Activity => {
    const existing = activityMap.get(activityId);
    if (existing) return cloneDeep(existing);
    const now = new Date().toISOString();
    return {
      id: activityId,
      activity_type: "vote",
      title: `模拟活动 ${activityId}`,
      options: [
        { key: "A", text: "选项 A" },
        { key: "B", text: "选项 B" },
      ],
      correct_answer: "A",
      allow_multiple: false,
      time_limit: 60,
      status: "draft",
      started_at: null,
      ended_at: null,
      created_by: 1,
      created_at: now,
      response_count: 12,
      analysis_status: "pending",
    };
  }, [activityMap]);

  const toPlanItemActivity = useCallback((activity: Activity): NonNullable<PlanItem["activity"]> => ({
    id: activity.id,
    title: activity.title,
    activity_type: activity.activity_type,
    time_limit: activity.time_limit,
    status: activity.status,
    options: activity.options,
    correct_answer: activity.correct_answer,
    allow_multiple: activity.allow_multiple,
  }), []);

  const buildPlanItems = useCallback((selectedIds: number[], existingItems?: PlanItem[]): PlanItem[] => {
    const existingByActivityId = new Map((existingItems || []).map((item) => [item.activity_id, item]));
    return selectedIds.map((activityId, index) => {
      const existing = existingByActivityId.get(activityId);
      const activity = getActivity(activityId);
      return {
        id: existing?.id ?? nextPlanItemIdRef.current++,
        activity_id: activityId,
        order_index: index,
        status: existing?.status ?? "pending",
        activity: {
          ...toPlanItemActivity(activity),
          time_limit: existing?.activity?.time_limit ?? activity.time_limit,
          status: existing?.activity?.status ?? activity.status,
        },
      };
    });
  }, [getActivity, toPlanItemActivity]);

  const updatePlanInStore = useCallback((planId: number, updater: (plan: Plan) => Plan) => {
    setAllPlans((prev) =>
      prev.map((plan) => (plan.id === planId ? updater(cloneDeep(plan)) : plan)),
    );
  }, []);

  const handleRefreshList = useCallback(async () => {
    showMessage.success("已刷新");
  }, []);

  const handleRefreshPlan = useCallback(async (_id: number) => {}, []);

  const handleFormSubmit = useCallback(async (payload: PlanFormSubmitPayload) => {
    if (rightView.type !== "form") return;
    const title = payload.title.trim();
    if (!title) return;

    if (rightView.editingId == null) {
      const planId = nextPlanIdRef.current++;
      const nextPlan: Plan = {
        id: planId,
        title,
        status: "draft",
        current_item_id: null,
        created_by: 1,
        created_at: new Date().toISOString(),
        items: buildPlanItems(payload.selectedIds),
      };
      setAllPlans((prev) => [nextPlan, ...prev]);
      setRightView({ type: "console", planId });
      showMessage.success("创建成功");
      return;
    }

    const editingId = rightView.editingId;
    setAllPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== editingId) return plan;
        const nextItems = buildPlanItems(payload.selectedIds, plan.items);
        const activeItem = nextItems.find((item) => item.status === "active");
        return {
          ...plan,
          title,
          items: nextItems,
          current_item_id: activeItem?.id ?? null,
        };
      }),
    );
    setRightView({ type: "console", planId: editingId });
    showMessage.success("已更新");
  }, [buildPlanItems, rightView]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm("确认删除该计划？")) return;
    setAllPlans((prev) => prev.filter((plan) => plan.id !== id));
    setRightView((prev) => {
      if (prev.type === "console" && prev.planId === id) return { type: "none" };
      if (prev.type === "form" && prev.editingId === id) return { type: "form", editingId: null };
      return prev;
    });
    showMessage.success("已删除");
  }, []);

  const openConsole = useCallback((plan: Plan) => {
    setRightView({ type: "console", planId: plan.id });
  }, []);

  const setPlanItemStatus = useCallback((item: PlanItem, status: PlanItem["status"]): PlanItem => ({
    ...item,
    status,
    activity: item.activity
      ? {
          ...item.activity,
          status: itemStatusToActivityStatus(status),
        }
      : item.activity,
  }), []);

  const handleStartPlan = useCallback(async (planId: number) => {
    updatePlanInStore(planId, (plan) => {
      let activated = false;
      const nextItems = plan.items.map((item) => {
        if (item.status === "ended") return setPlanItemStatus(item, "ended");
        if (!activated) {
          activated = true;
          return setPlanItemStatus(item, "active");
        }
        return setPlanItemStatus(item, "pending");
      });
      const activeItem = nextItems.find((item) => item.status === "active");
      return {
        ...plan,
        status: "active",
        current_item_id: activeItem?.id ?? null,
        items: nextItems,
      };
    });
    showMessage.success("计划已启动");
  }, [setPlanItemStatus, updatePlanInStore]);

  const handleEndPlan = useCallback(async (planId: number) => {
    updatePlanInStore(planId, (plan) => ({
      ...plan,
      status: "ended",
      current_item_id: null,
      items: plan.items.map((item) => setPlanItemStatus(item, "ended")),
    }));
    showMessage.success("计划已结束");
  }, [setPlanItemStatus, updatePlanInStore]);

  const handleResetPlan = useCallback(async (planId: number) => {
    updatePlanInStore(planId, (plan) => ({
      ...plan,
      status: "draft",
      current_item_id: null,
      items: plan.items.map((item) => setPlanItemStatus(item, "pending")),
    }));
    showMessage.success("计划已重置");
  }, [setPlanItemStatus, updatePlanInStore]);

  const handleStartItem = useCallback(async (planId: number, itemId: number) => {
    updatePlanInStore(planId, (plan) => {
      const nextItems = plan.items.map((item) => {
        if (item.id === itemId) return setPlanItemStatus(item, "active");
        if (item.status === "active") return setPlanItemStatus(item, "ended");
        if (item.status === "ended") return setPlanItemStatus(item, "ended");
        return setPlanItemStatus(item, "pending");
      });
      return {
        ...plan,
        status: "active",
        current_item_id: itemId,
        items: nextItems,
      };
    });
    showMessage.success("题目已开始");
  }, [setPlanItemStatus, updatePlanInStore]);

  const handleEndItem = useCallback(async (planId: number, itemId: number) => {
    updatePlanInStore(planId, (plan) => {
      const nextItems = plan.items.map((item) =>
        item.id === itemId ? setPlanItemStatus(item, "ended") : item,
      );
      const allEnded = nextItems.length > 0 && nextItems.every((item) => item.status === "ended");
      return {
        ...plan,
        status: allEnded ? "ended" : plan.status,
        current_item_id: plan.current_item_id === itemId ? null : plan.current_item_id,
        items: nextItems,
      };
    });
    showMessage.success("题目已结束");
  }, [setPlanItemStatus, updatePlanInStore]);

  const handleRestartItem = useCallback(async (planId: number, itemId: number) => {
    updatePlanInStore(planId, (plan) => {
      const nextItems = plan.items.map((item) => {
        if (item.id === itemId) return setPlanItemStatus(item, "active");
        if (item.status === "active") return setPlanItemStatus(item, "ended");
        if (item.status === "ended") return setPlanItemStatus(item, "ended");
        return setPlanItemStatus(item, "pending");
      });
      return {
        ...plan,
        status: "active",
        current_item_id: itemId,
        items: nextItems,
      };
    });
    showMessage.success("题目已重新开始");
  }, [setPlanItemStatus, updatePlanInStore]);

  const handleUpdateItemTime = useCallback(async (planId: number, itemId: number, timeLimit: number) => {
    updatePlanInStore(planId, (plan) => ({
      ...plan,
      items: plan.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              activity: item.activity
                ? {
                    ...item.activity,
                    time_limit: Math.max(0, Math.floor(timeLimit)),
                  }
                : item.activity,
            }
          : item,
      ),
    }));
  }, [updatePlanInStore]);

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
        size: 220,
        meta: { className: "max-w-[220px]" },
        cell: ({ row }) => (
          <div className="flex max-w-[220px] items-center gap-1.5">
            <span className="block max-w-[180px] truncate text-sm">{row.original.title}</span>
            <Badge variant="outline" className="border-border bg-transparent text-[11px] text-text-tertiary">
              模拟
            </Badge>
          </div>
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
                onClick={() => setRightView({ type: "form", editingId: row.original.id })}
                title="编辑"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => {
                void openConsole(row.original);
              }}
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
    [handleDelete, openConsole],
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
                <Button size="sm" variant="outline" onClick={() => { void handleRefreshList(); }}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  刷新
                </Button>
                <Button size="sm" onClick={() => setRightView({ type: "form", editingId: null })}>
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
                  void openConsole(row.original);
                }}
                getRowClassName={(row) =>
                  cn("cursor-pointer", isConsoleSelected(row.original.id) && "bg-primary-soft hover:bg-primary-soft")
                }
                emptyState={<div className="px-4 py-8 text-center text-sm text-text-tertiary">暂无计划</div>}
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
                  "flex-1 min-h-0 px-3 py-3",
                  rightView.type === "form" ? "overflow-hidden" : "overflow-auto",
                )}
              >
                {rightView.type === "form" && (
                  <PlanFormPanel
                    key={editingPlan ? `edit-${editingPlan.id}` : "new"}
                    editing={editingPlan}
                    activities={activityPool}
                    agents={MOCK_AGENTS}
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
