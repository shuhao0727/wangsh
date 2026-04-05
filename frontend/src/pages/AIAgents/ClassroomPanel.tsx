/**
 * 课堂互动浮动窗口 - 学生端
 * 视图：idle → vote/fill_blank → submitted → result
 */
import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { X, Pin, PinOff, Zap, RotateCcw, Loader2 } from "lucide-react";
import { classroomApi, Activity, ActivityStats } from "@services/classroom";
import { planApi, Plan } from "@services/classroomPlan";
import { config as appConfig } from "@services";
import { getStoredAccessToken } from "@services/api";
import { floatingBtnRegistry } from "@utils/floatingBtnRegistry";
import { cn } from "@/lib/utils";

const STORAGE_KEYS = {
  POS: "ci_floating_pos",
  SIZE: "ci_floating_size",
  PINNED: "ci_floating_pinned",
  BTN_TOP: "ci_btn_top",
};

type ViewType = "idle" | "vote" | "fill_blank" | "submitted" | "result" | "review";

interface Props {
  isAuthenticated: boolean;
  isStudent: boolean;
  isAdmin: boolean;
  userId?: number;
}

const DEFAULT_W = 420;
const DEFAULT_H = 480;

const parseBlankAnswers = (raw?: string | null): string[] => {
  const text = String(raw || "").trim();
  if (!text) return [];
  if (!text.startsWith("[") && !text.startsWith("{")) return [text];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? "").trim());
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => String((parsed as any)[k] ?? "").trim());
    }
  } catch {}
  return [text];
};

const getCodeTemplate = (activity: Activity | null): string => {
  if (!activity || activity.activity_type !== "fill_blank") return "";
  if (!Array.isArray(activity.options)) return "";
  const codeOpt = (activity.options as any[]).find((o: any) => o.key === "__code__");
  return codeOpt?.text || "";
};

const getBlankCount = (activity: Activity | null): number => {
  if (!activity || activity.activity_type !== "fill_blank") return 1;
  const code = getCodeTemplate(activity);
  if (code) return Math.max(1, (code.match(/___/g) || []).length);
  const marks = String(activity.title || "").match(/\(\d+\)/g) || [];
  if (marks.length > 0) return marks.length;
  const byAnswer = parseBlankAnswers(activity.correct_answer).length;
  return Math.max(1, byAnswer);
};

const formatDisplayAnswer = (raw?: string | null): string => {
  const blanks = parseBlankAnswers(raw);
  if (blanks.length <= 1) return String(raw || "");
  return blanks.map((v, i) => `(${i + 1}) ${v}`).join("；");
};

const clampPercent = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const InlineTooltip = ({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactElement;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{title}</TooltipContent>
  </Tooltip>
);

const LineProgress = ({
  percent,
  color,
}: {
  percent: number;
  color: string;
}) => {
  const safePercent = clampPercent(percent);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-[var(--ws-color-border-secondary)]">
      <div
        className="h-full transition-all"
        style={{ width: `${safePercent}%`, backgroundColor: color }}
      />
    </div>
  );
};

const CircleProgress = ({
  percent,
  size = 80,
  strokeColor = "var(--ws-color-purple)",
}: {
  percent: number;
  size?: number;
  strokeColor?: string;
}) => {
  const safePercent = clampPercent(percent);
  const strokeWidth = Math.max(6, Math.round(size * 0.1));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safePercent / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ws-color-border-secondary)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="absolute text-xs font-semibold text-text-secondary">
        {Math.round(safePercent)}%
      </span>
    </div>
  );
};

const ClassroomPanel: React.FC<Props> = ({ isAuthenticated }) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.PINNED) === "true"; } catch { return false; }
  });
  const [pos, setPos] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEYS.POS); return s ? JSON.parse(s) : { x: 60, y: 300 }; } catch { return { x: 60, y: 300 }; }
  });
  const [size] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEYS.SIZE); return s ? JSON.parse(s) : { w: DEFAULT_W, h: DEFAULT_H }; } catch { return { w: DEFAULT_W, h: DEFAULT_H }; }
  });
  const [btnTop, setBtnTop] = useState(() => {
    try { const v = localStorage.getItem(STORAGE_KEYS.BTN_TOP); return v ? Number(v) : 65; } catch { return 65; }
  });
  const btnDragRef = useRef<{ startY: number; origTop: number } | null>(null);
  const btnDragged = useRef(false);

  const [view, setView] = useState<ViewType>("idle");
  useEffect(() => { viewRef.current = view; }, [view]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [fillAnswers, setFillAnswers] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [itemAnswers, setItemAnswers] = useState<Record<number, { my_answer: string | null; correct_answer: string | null; is_correct: boolean | null }>>({});
  const [selectedDoneActivityId, setSelectedDoneActivityId] = useState<number | null>(null);
  const [reviewStats, setReviewStats] = useState<ActivityStats | null>(null);
  const [reviewStatsLoading, setReviewStatsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const streamRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshingRef = useRef(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const viewRef = useRef<ViewType>("idle");
  const floatingRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<Activity | null>(null);
  const openRef = useRef(false);

  useEffect(() => { activityRef.current = activity; }, [activity]);
  useEffect(() => { openRef.current = open; }, [open]);

  // 拖拽
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea, .ci-option-item")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);
  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({ x: dragRef.current.origX + (e.clientX - dragRef.current.startX), y: dragRef.current.origY + (e.clientY - dragRef.current.startY) });
  }, []);
  const handleDragEnd = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      setPos((cur: { x: number; y: number }) => { try { localStorage.setItem(STORAGE_KEYS.POS, JSON.stringify(cur)); } catch {} return cur; });
    }
  }, []);

  const handleResizeUp = useCallback(() => {
    if (floatingRef.current) {
      const rect = floatingRef.current.getBoundingClientRect();
      try { localStorage.setItem(STORAGE_KEYS.SIZE, JSON.stringify({ w: rect.width, h: rect.height })); } catch {}
    }
  }, []);

  // 互斥
  useEffect(() => {
    const handler = (e: Event) => { if ((e as CustomEvent).detail !== "classroom" && open) setOpen(false); };
    window.addEventListener("panel-open", handler);
    return () => window.removeEventListener("panel-open", handler);
  }, [open]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    window.dispatchEvent(new CustomEvent("panel-open", { detail: "classroom" }));
  }, []);

  // 轮询活动
  const checkActive = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? true;
    if (!isAuthenticated) {
      if (!silent) showMessage.warning("请先登录后再刷新");
      return false;
    }
    const activity = activityRef.current;
    const open = openRef.current;
    try {
      const [list, plan] = await Promise.all([
        classroomApi.getActive(),
        planApi.getActivePlan().catch(() => null),
      ]);
      setActivePlan(plan);
      if (list.length > 0) {
        const a = list[0];
        if (!activity || activity.id !== a.id || activity.status !== a.status || viewRef.current === "idle") {
          if (viewRef.current === "review" && activity && a.id !== activity.id) {
            showMessage.info("老师开始了新题目");
          }
          setActivity(a);
          if (a.my_answer) {
            setMyAnswer(a.my_answer);
            setView("submitted");
          } else {
            setView(a.activity_type === "vote" ? "vote" : "fill_blank");
            setSelectedAnswer("");
            setMultiSelected([]);
            setFillAnswers(Array(getBlankCount(a)).fill(""));
          }
          if (a.remaining_seconds != null && a.remaining_seconds > 0) {
            setRemaining(a.remaining_seconds);
          }
          if (!open) handleOpen();
        }
      } else if (activity && activity.status === "active") {
        // 活动结束了
        try {
          const result = await classroomApi.getResult(activity.id);
          setMyAnswer(result.my_answer);
          setIsCorrect(result.is_correct);
          setStats(result.stats);
          setActivity({ ...activity, status: "ended", correct_answer: result.correct_answer });
          // 记录本题答案
          setItemAnswers(prev => ({ ...prev, [activity.id]: { my_answer: result.my_answer, correct_answer: result.correct_answer, is_correct: result.is_correct } }));
          // 如果有计划进行中，回到 idle 等待下一题；否则显示结果
          if (plan && plan.status === "active") {
            setView("idle");
            setActivity(null);
          } else {
            setView("result");
          }
        } catch {
          setView("idle");
          setActivity(null);
        }
      } else if (viewRef.current !== "idle" && viewRef.current !== "result" && viewRef.current !== "submitted" && !plan) {
        setView("idle");
        setActivity(null);
      }
      return true;
    } catch {
      if (!silent) showMessage.error("刷新失败，请稍后重试");
      return false;
    }
  }, [isAuthenticated, handleOpen]);

  useEffect(() => {
    if (isAuthenticated) return;
    setOpen(false);
    setView("idle");
    setActivity(null);
    setActivePlan(null);
    setSelectedAnswer("");
    setMultiSelected([]);
    setFillAnswers([""]);
    setMyAnswer(null);
    setIsCorrect(null);
    setStats(null);
    setRemaining(null);
  }, [isAuthenticated]);

  const handleManualRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const ok = await checkActive({ silent: false });
      if (ok) showMessage.success("已刷新");
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [checkActive]);

  useEffect(() => {
    void checkActive({ silent: true });
    pollRef.current = setInterval(() => {
      void checkActive({ silent: true });
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [checkActive]);

  // SSE 增强：优先用实时推送触发刷新，轮询作为兜底
  useEffect(() => {
    if (!isAuthenticated) return;
    let stopped = false;
    let stream: EventSource | null = null;

    const clearRetry = () => {
      if (streamRetryRef.current) {
        clearTimeout(streamRetryRef.current);
        streamRetryRef.current = null;
      }
    };

    const closeStream = () => {
      if (stream) {
        stream.close();
        stream = null;
      }
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      clearRetry();
      streamRetryRef.current = setTimeout(connect, 3000);
    };

    const connect = () => {
      if (stopped) return;
      clearRetry();
      const token = getStoredAccessToken();
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      const streamUrl = `${appConfig.apiUrl}/classroom/stream${query}`;
      try {
        stream = new EventSource(streamUrl, { withCredentials: true });
        stream.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data || "{}");
            if (payload?.type === "connected") return;
          } catch {}
          void checkActive({ silent: true });
        };
        stream.onerror = () => {
          closeStream();
          scheduleReconnect();
        };
      } catch {
        closeStream();
        scheduleReconnect();
      }
    };

    connect();
    return () => {
      stopped = true;
      clearRetry();
      closeStream();
    };
  }, [isAuthenticated, checkActive]);

  // 倒计时
  useEffect(() => {
    if (remaining == null || remaining <= 0) return;
    timerRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev == null || prev <= 1) {
          clearInterval(timerRef.current);
          setTimeout(checkActive, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [remaining, checkActive]);

  // 提交答案
  const handleSubmit = async () => {
    if (!activity) return;
    let answer = "";
    if (activity.activity_type === "vote") {
      answer = activity.allow_multiple ? multiSelected.sort().join(",") : selectedAnswer;
    } else {
      const trimmed = fillAnswers.map((v) => v.trim());
      const blankCount = getBlankCount(activity);
      answer = blankCount > 1 ? JSON.stringify(trimmed) : (trimmed[0] || "");
    }
    if (!answer) { showMessage.warning("请先作答"); return; }
    setSubmitting(true);
    try {
      const resp = await classroomApi.respond(activity.id, answer);
      setMyAnswer(resp.answer);
      setIsCorrect(resp.is_correct);
      setItemAnswers(prev => ({ ...prev, [activity.id]: { my_answer: resp.answer, correct_answer: null, is_correct: resp.is_correct } }));
      setView("submitted");
      showMessage.success("已提交");
    } catch (e: any) { showMessage.error(e.message || "提交失败"); }
    setSubmitting(false);
  };

  // 清理
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    if (streamRetryRef.current) clearTimeout(streamRetryRef.current);
  }, []);

  // 打开历史题目回顾
  const openReview = useCallback(async (activityId: number) => {
    setSelectedDoneActivityId(activityId);
    setReviewStats(null);
    setView("review");
    setReviewStatsLoading(true);
    try {
      const s = await classroomApi.getStatistics(activityId);
      setReviewStats(s);
    } catch { showMessage.error("加载班级数据失败"); }
    setReviewStatsLoading(false);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // 浮动按钮拖拽（仅垂直）
  const handleBtnDragStart = useCallback((e: React.PointerEvent) => {
    btnDragRef.current = { startY: e.clientY, origTop: btnTop };
    btnDragged.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [btnTop]);
  const handleBtnDragMove = useCallback((e: React.PointerEvent) => {
    if (!btnDragRef.current) return;
    if (Math.abs(e.clientY - btnDragRef.current.startY) > 3) btnDragged.current = true;
    const newTop = Math.max(0, Math.min(90, btnDragRef.current.origTop + (e.clientY - btnDragRef.current.startY) / window.innerHeight * 100));
    setBtnTop(newTop);
  }, []);
  const handleBtnDragEnd = useCallback(() => {
    if (!btnDragRef.current) return;
    btnDragRef.current = null;
    setBtnTop(cur => { try { localStorage.setItem(STORAGE_KEYS.BTN_TOP, String(cur)); } catch {} return cur; });
    floatingBtnRegistry.settle("classroom");
  }, []);

  // 注册到全局按钮注册表
  useEffect(() => {
    floatingBtnRegistry.register("classroom", btnTop, (v) => {
      setBtnTop(v);
      try { localStorage.setItem(STORAGE_KEYS.BTN_TOP, String(v)); } catch {}
    });
    return () => floatingBtnRegistry.unregister("classroom");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    floatingBtnRegistry.updateTop("classroom", btnTop);
  }, [btnTop]);

  if (!isAuthenticated) return null;

  const floatingBtn = !open && (
    <div
      style={{ position: "fixed", left: 0, top: `${btnTop}%`, zIndex: "var(--ws-z-floating-btn)", cursor: "grab", touchAction: "none" }}
      onPointerDown={handleBtnDragStart}
      onPointerMove={handleBtnDragMove}
      onPointerUp={handleBtnDragEnd}
    >
      <Button
        onClick={() => { if (!btnDragged.current) handleOpen(); }}
        className="ws-floating-entry-btn ws-floating-entry-btn--classroom"
      >
        <Zap className="h-4 w-4" />课堂互动
      </Button>
    </div>
  );

  if (!open) return ReactDOM.createPortal(floatingBtn, document.body);

  const panel = (
    <div ref={floatingRef} onMouseUp={handleResizeUp} style={{
      position: "fixed", left: pos.x, top: pos.y, width: size.w, height: size.h,
      zIndex: "var(--ws-z-floating-panel)", resize: "both",
    }} className="ws-floating-panel flex flex-col">
      {/* 标题栏 */}
      <div
        onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd}
        className="ws-floating-panel-header ws-floating-panel-header--classroom flex-shrink-0 cursor-move select-none"
      >
        <span className="font-semibold text-sm flex items-center gap-1.5">
          <Zap className="h-4 w-4" /> 课堂互动
        </span>
        <div className="flex gap-1" onPointerDown={e => e.stopPropagation()}>
          <InlineTooltip title={pinned ? "取消固定" : "固定窗口"}>
            <Button variant="ghost" size="sm" className="!text-[var(--ws-color-surface)]"
              onClick={() => { const v = !pinned; setPinned(v); try { localStorage.setItem(STORAGE_KEYS.PINNED, String(v)); } catch {} }}
            >
              {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
            </Button>
          </InlineTooltip>
          <Button variant="ghost" size="sm" className="!text-[var(--ws-color-surface)]"
            disabled={refreshing}
            onClick={() => { void handleManualRefresh(); }}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="!text-[var(--ws-color-surface)]"
            onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 题目进度条 - 始终显示在顶部（有计划时）*/}
        {activePlan && (() => {
          const sortedItems = [...activePlan.items].sort((a, b) => a.order_index - b.order_index);
          return (
            <div className="px-[var(--ws-space-3)] pt-[var(--ws-space-2)] pb-[var(--ws-space-1)] border-b border-[var(--ws-color-border)] bg-surface-2">
              <div className="text-xs text-[var(--ws-color-purple)] font-semibold mb-1.5 tracking-wide">{activePlan.title}</div>
              {/* 横排题号进度 */}
              <div className="flex gap-1.5 flex-wrap">
                {sortedItems.map((item, idx) => {
                  const isItemActive = item.status === "active";
                  const isItemDone = item.status === "ended";
                  const isPending = item.status === "pending";
                  const ans = item.activity?.id != null ? itemAnswers[item.activity.id] : undefined;
                  const isReviewing = view === "review" && item.activity?.id === selectedDoneActivityId;
                  const dotColor = isItemActive ? "var(--ws-color-purple)"
                    : isItemDone ? (ans?.is_correct === true ? "var(--ws-color-success)" : ans?.is_correct === false ? "var(--ws-color-error)" : "var(--ws-color-warning)")
                    : "var(--ws-color-surface-2)";
                  return (
                    <InlineTooltip key={item.id} title={isPending ? "未开始" : isItemActive ? "进行中" : item.activity?.title}>
                      <div
                        onClick={() => {
                          if (isPending) return;
                          if (isItemActive) { void checkActive({ silent: true }); return; }
                          if (isItemDone && item.activity?.id != null) {
                            if (isReviewing) {
                              setView("idle");
                              setSelectedDoneActivityId(null);
                            } else {
                              openReview(item.activity.id);
                            }
                          }
                        }}
                        style={{
                          background: dotColor,
                          color: isPending ? "var(--ws-color-text-tertiary)" : "var(--ws-color-surface)",
                          boxShadow: isReviewing ? "0 0 0 3px var(--ws-color-purple)40" : isItemActive ? "0 0 0 3px var(--ws-color-purple)30" : "none",
                          outline: isReviewing ? "2px solid var(--ws-color-purple)" : isItemActive ? "2px solid var(--ws-color-purple)" : "none",
                          outlineOffset: 1,
                          opacity: isPending ? 0.4 : 1,
                        }}
                        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all flex-shrink-0 ${isPending ? "cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {idx + 1}
                      </div>
                    </InlineTooltip>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 主内容区 */}
        <div className="flex-1 overflow-auto p-[var(--ws-panel-padding)]">
          {/* 倒计时 */}
          {remaining != null && remaining > 0 && (view === "vote" || view === "fill_blank" || view === "submitted") && (
            <div className="text-center mb-3">
              <Badge variant="warning" className="px-[var(--ws-space-2)] py-[calc(var(--ws-space-1)/2)] text-[var(--ws-text-md)] font-semibold">
                {formatTime(remaining)}
              </Badge>
            </div>
          )}

          {/* IDLE */}
          {view === "idle" && (
            <div className="flex flex-col items-center justify-center h-full pt-10">
              {activePlan ? (
                <div className="text-center text-text-tertiary">
                  <div className="text-4xl mb-3">⏳</div>
                  <div className="text-sm font-medium text-text-tertiary mb-1">等待下一题</div>
                  <div className="text-xs text-text-tertiary">老师开始后将自动弹出题目</div>
                </div>
              ) : (
                <div className="text-center text-text-tertiary">
                  <Zap className="text-5xl text-border-secondary mb-3 block h-12 w-12" />
                  <div className="text-sm">暂无进行中的活动</div>
                </div>
              )}
            </div>
          )}

          {/* VOTE */}
          {view === "vote" && activity && (
            <div>
              <div className="text-[var(--ws-text-md)] font-semibold mb-4 leading-relaxed">{activity.title}</div>
              {activity.allow_multiple ? (
                <div className="flex flex-col gap-[var(--ws-space-2)]">
                  {(activity.options || []).map(opt => (
                    <label key={opt.key} className="ci-option-item flex cursor-pointer items-center gap-[var(--ws-space-2)] text-sm">
                      <input
                        type="checkbox"
                        checked={multiSelected.includes(opt.key)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setMultiSelected((prev) => {
                            if (checked) return prev.includes(opt.key) ? prev : [...prev, opt.key];
                            return prev.filter((key) => key !== opt.key);
                          });
                        }}
                        className="h-4 w-4 accent-[var(--ws-color-primary)]"
                      />
                      <span>
                        <Badge variant="sky" className="mr-[var(--ws-space-1)] px-[var(--ws-space-1)] py-0 text-xs">
                          {opt.key}
                        </Badge>
                        {opt.text}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-[var(--ws-space-2)]">
                  {(activity.options || []).map(opt => (
                    <label key={opt.key} className="ci-option-item flex cursor-pointer items-center gap-[var(--ws-space-2)] text-sm">
                      <input
                        type="radio"
                        name={`classroom-vote-${activity.id}`}
                        checked={selectedAnswer === opt.key}
                        onChange={() => setSelectedAnswer(opt.key)}
                        className="h-4 w-4 accent-[var(--ws-color-primary)]"
                      />
                      <span>
                        <Badge variant="sky" className="mr-[var(--ws-space-1)] px-[var(--ws-space-1)] py-0 text-xs">
                          {opt.key}
                        </Badge>
                        {opt.text}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <Button className="w-full mt-5 !bg-[var(--ws-color-purple)] !border-[var(--ws-color-purple)]" onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}提交答案
              </Button>
            </div>
          )}

          {/* FILL BLANK */}
          {view === "fill_blank" && activity && (() => {
            const codeTemplate = getCodeTemplate(activity);
            const blankCount = getBlankCount(activity);
            const renderCodeWithBlanks = (code: string) => {
              const parts = code.split("___");
              return parts.map((part, i) => (
                <React.Fragment key={i}>
                  <span>{part}</span>
                  {i < parts.length - 1 && (
                  <span className="mx-[calc(var(--ws-space-1)/2)] rounded-sm bg-[var(--ws-color-code-purple)] px-[var(--ws-space-1)] text-xs font-[inherit] text-white">▢ {i + 1}</span>
                  )}
                </React.Fragment>
              ));
            };
            return (
              <div>
                <div className="text-[var(--ws-text-md)] font-semibold mb-3 leading-relaxed">{activity.title}</div>
                {codeTemplate && (
                  <pre className="bg-code-bg text-code-text rounded-lg overflow-auto mb-4 whitespace-pre-wrap break-all px-[var(--ws-space-2)] py-[var(--ws-space-2)] text-sm leading-[1.6] font-mono">
                    {renderCodeWithBlanks(codeTemplate)}
                  </pre>
                )}
                {Array.from({ length: blankCount }).map((_, idx) => (
                  <div key={idx} className="mb-2">
                    <div className="text-xs text-text-tertiary mb-1">空位 {idx + 1}</div>
                    <Input value={fillAnswers[idx] || ""} onChange={e => { const a = [...fillAnswers]; a[idx] = e.target.value; setFillAnswers(a); }} placeholder={`填写第 ${idx + 1} 处答案`} maxLength={120} className="font-mono" />
                  </div>
                ))}
                <Button className="w-full !mt-4 !bg-[var(--ws-color-purple)] !border-[var(--ws-color-purple)]" onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}提交答案
                </Button>
              </div>
            );
          })()}

          {/* SUBMITTED */}
          {view === "submitted" && activity && (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">✅</div>
              <div className="text-[var(--ws-text-md)] font-semibold mb-2 text-text-secondary">已提交</div>
              <div className="text-text-tertiary text-sm mb-1">你的答案：{formatDisplayAnswer(myAnswer)}</div>
              <div className="text-text-tertiary text-xs">等待老师结束活动后查看结果…</div>
            </div>
          )}

          {/* RESULT */}
          {view === "result" && activity && (
            <div>
              <div className="text-[var(--ws-text-md)] font-semibold mb-3 leading-relaxed">{activity.title}</div>
              <div
                className={cn(
                  "px-4 py-3 rounded-lg mb-4 border",
                  isCorrect === true
                    ? "bg-[var(--ws-color-success-soft)] border-[var(--ws-color-success)]"
                    : isCorrect === false
                      ? "bg-[var(--ws-color-error-soft)] border-[var(--ws-color-error-light)]"
                      : "bg-surface-2 border-border-secondary"
                )}
              >
                <div className="text-xs text-text-tertiary mb-1">我的答案</div>
                <div
                  className={cn(
                    "text-base font-bold",
                    isCorrect === true
                      ? "text-[var(--ws-color-success)]"
                      : isCorrect === false
                        ? "text-[var(--ws-color-error)]"
                        : "text-text"
                  )}
                >
                  {formatDisplayAnswer(myAnswer) || "未作答"}{isCorrect === true && " ✓ 正确"}{isCorrect === false && " ✗ 错误"}
                </div>
                {activity.correct_answer && (
                  <div className="text-sm text-text-tertiary mt-1">参考答案：{formatDisplayAnswer(activity.correct_answer)}</div>
                )}
              </div>
              {stats && activity.activity_type === "vote" && Array.isArray(activity.options) && (
                <div>
                  <div className="text-sm font-semibold mb-2.5 text-text-secondary">班级投票结果 <span className="font-normal text-text-tertiary text-xs">· {stats.total_responses} 人参与</span></div>
                  {(activity.options as any[]).map((opt: any) => {
                    const count = stats.option_counts?.[opt.key] || 0;
                    const pct = stats.total_responses > 0 ? Math.round(count / stats.total_responses * 100) : 0;
                    const isMyAnswer = myAnswer?.split(",").includes(opt.key);
                    const isCorrectOpt = activity.correct_answer?.split(",").includes(opt.key);
                    return (
                      <div key={opt.key} className="mb-2.5">
                        <div className="flex justify-between text-sm mb-1 items-center">
                            <span className={cn(isCorrectOpt ? "font-semibold text-[var(--ws-color-success)]" : "text-text")}>
                              {opt.key}. {opt.text}
                              {isMyAnswer && (
                              <Badge variant="purple" className="ml-[var(--ws-space-1)] px-[var(--ws-space-1)] py-0 text-xs">
                                我选的
                              </Badge>
                            )}
                          </span>
                          <span className="text-text-tertiary text-xs">{count} ({pct}%)</span>
                        </div>
                        <LineProgress percent={pct} color={isCorrectOpt ? "var(--ws-color-success)" : isMyAnswer ? "var(--ws-color-purple)" : "var(--ws-color-primary)"} />
                      </div>
                    );
                  })}
                </div>
              )}
              {stats && activity.activity_type === "fill_blank" && stats.correct_rate != null && (
                <div className="text-center py-4">
                  <CircleProgress percent={stats.correct_rate} size={80} strokeColor="var(--ws-color-purple)" />
                  <div className="mt-2 text-text-tertiary text-xs">班级正确率 · {stats.total_responses} 人参与</div>
                </div>
              )}
            </div>
          )}

          {/* REVIEW */}
          {view === "review" && (() => {
            if (!activePlan) return null;
            const sortedItems = [...activePlan.items].sort((a, b) => a.order_index - b.order_index);
            const doneItems = sortedItems.filter(it => it.status === "ended" && it.activity?.id != null);
            const curIdx = doneItems.findIndex(it => it.activity!.id === selectedDoneActivityId);
            const item = curIdx >= 0 ? doneItems[curIdx] : null;
            const ans = item?.activity ? itemAnswers[item.activity.id] : undefined;
            const reviewActivity = item?.activity ?? null;
            if (!item || !reviewActivity) return null;
            const globalIdx = sortedItems.indexOf(item);
            return (
                <div className="flex flex-col min-h-full">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="purple" className="px-2 py-0.5 text-xs">
                      第 {globalIdx + 1} 题回顾
                    </Badge>
                  <Button variant="ghost" size="sm" className="!text-text-tertiary !text-xs" onClick={() => { setView("idle"); setSelectedDoneActivityId(null); }}>关闭 x</Button>
                </div>
                <div className="text-[var(--ws-text-md)] font-semibold mb-3.5 leading-relaxed">{reviewActivity.title}</div>
                <div
                  className={cn(
                    "px-3.5 py-2.5 rounded-lg mb-3.5 border",
                    ans?.is_correct === true
                      ? "bg-[var(--ws-color-success-soft)] border-[var(--ws-color-success)]"
                      : ans?.is_correct === false
                        ? "bg-[var(--ws-color-error-soft)] border-[var(--ws-color-error-light)]"
                        : "bg-surface-2 border-border-secondary"
                  )}
                >
                  <div className="text-xs text-text-tertiary mb-0.5">我的答案</div>
                  <div
                    className={cn(
                      "text-sm font-bold",
                      ans?.is_correct === true
                        ? "text-[var(--ws-color-success)]"
                        : ans?.is_correct === false
                          ? "text-[var(--ws-color-error)]"
                          : "text-text"
                    )}
                  >
                    {formatDisplayAnswer(ans?.my_answer) || "未作答"}{ans?.is_correct === true && " ✓ 正确"}{ans?.is_correct === false && " ✗ 错误"}
                  </div>
                  {ans?.correct_answer && (
                    <div className="text-xs text-text-tertiary mt-0.5">参考答案：{formatDisplayAnswer(ans.correct_answer)}</div>
                  )}
                  {ans?.is_correct == null && <div className="text-xs mt-0.5 text-[var(--ws-color-warning)]">等待公布结果…</div>}
                </div>
                {reviewActivity.activity_type === "vote" && Array.isArray(reviewActivity.options) && (
                  <div className="mb-3.5">
                    <div className="text-sm font-semibold mb-2 text-text-secondary">班级投票结果
                      {reviewStats && <span className="font-normal text-text-tertiary text-xs"> · {reviewStats.total_responses} 人参与</span>}
                    </div>
                    {(reviewActivity.options as any[]).map((opt: any) => {
                      const isMyAns = ans?.my_answer?.split(",").includes(opt.key);
                      const isCorrectOpt = reviewActivity.correct_answer?.split(",").includes(opt.key);
                      const count = reviewStats?.option_counts?.[opt.key] || 0;
                      const pct = reviewStats && reviewStats.total_responses > 0 ? Math.round(count / reviewStats.total_responses * 100) : 0;
                      return (
                        <div key={opt.key} className="mb-2.5">
                          <div className="flex justify-between text-sm mb-0.5 items-center">
                            <span className={cn(isCorrectOpt ? "font-semibold text-[var(--ws-color-success)]" : "text-text")}>
                              {opt.key}. {opt.text}
                              {isMyAns && (
                                <Badge variant="purple" className="ml-[var(--ws-space-1)] px-[var(--ws-space-1)] py-0 text-xs">
                                  我选的
                                </Badge>
                              )}
                            </span>
                            {reviewStats && <span className="text-text-tertiary text-xs">{count} ({pct}%)</span>}
                          </div>
                          {reviewStats ? (
                            <LineProgress percent={pct} color={isCorrectOpt ? "var(--ws-color-success)" : isMyAns ? "var(--ws-color-purple)" : "var(--ws-color-primary)"} />
                          ) : reviewStatsLoading ? (
                            <div className="h-1.5 bg-surface-2 rounded" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
                {reviewActivity.activity_type === "fill_blank" && reviewStats && reviewStats.correct_rate != null && (
                  <div className="text-center py-3 mb-3.5">
                    <CircleProgress percent={reviewStats.correct_rate} size={80} strokeColor="var(--ws-color-purple)" />
                    <div className="mt-2 text-text-tertiary text-xs">班级正确率 · {reviewStats.total_responses} 人参与</div>
                  </div>
                )}
                {reviewStatsLoading && <div className="text-center text-text-tertiary text-xs mb-3">加载班级数据中…</div>}
                <div className="flex gap-2 pt-4 mt-2 border-t border-[var(--ws-color-border)]">
                  <Button variant="outline" className="flex-1" disabled={curIdx <= 0} onClick={() => doneItems[curIdx - 1] && openReview(doneItems[curIdx - 1].activity!.id)}>&#8249; 上一题</Button>
                  <Button className="flex-1 !bg-[var(--ws-color-purple)] !border-[var(--ws-color-purple)]" disabled={curIdx >= doneItems.length - 1} onClick={() => doneItems[curIdx + 1] && openReview(doneItems[curIdx + 1].activity!.id)}>下一题 &#8250;</Button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <TooltipProvider delayDuration={120}>{panel}</TooltipProvider>,
    document.body,
  );
};

export default ClassroomPanel;
