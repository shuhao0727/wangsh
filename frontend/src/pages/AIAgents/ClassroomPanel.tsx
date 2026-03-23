/**
 * 课堂互动浮动窗口 - 学生端
 * 视图：idle → vote/fill_blank → submitted → result
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Button, Radio, Checkbox, Input, Tag, Progress, message, Tooltip } from "antd";
import { CloseOutlined, PushpinOutlined, PushpinFilled, ThunderboltOutlined, ReloadOutlined } from "@ant-design/icons";
import { classroomApi, Activity, ActivityStats } from "@services/classroom";
import { planApi, Plan } from "@services/classroomPlan";
import { floatingBtnRegistry } from "@utils/floatingBtnRegistry";

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
  const byAnswer = parseBlankAnswers(activity.correct_answer).length;
  const marks = String(activity.title || "").match(/\(\d+\)/g) || [];
  return Math.max(1, byAnswer, marks.length);
};

const formatDisplayAnswer = (raw?: string | null): string => {
  const blanks = parseBlankAnswers(raw);
  if (blanks.length <= 1) return String(raw || "");
  return blanks.map((v, i) => `(${i + 1}) ${v}`).join("；");
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

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const viewRef = useRef<ViewType>("idle");
  const floatingRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<Activity | null>(null);
  const openRef = useRef(false);

  useEffect(() => { activityRef.current = activity; }, [activity]);
  useEffect(() => { openRef.current = open; }, [open]);

  // 拖拽
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea, .ant-radio-wrapper, .ant-checkbox-wrapper")) return;
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
  const checkActive = useCallback(async () => {
    if (!isAuthenticated) return;
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
            message.info("老师开始了新题目");
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
    } catch {}
  }, [isAuthenticated, handleOpen]);

  useEffect(() => {
    checkActive();
    pollRef.current = setInterval(checkActive, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [checkActive]);

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
    if (!answer) { message.warning("请先作答"); return; }
    setSubmitting(true);
    try {
      const resp = await classroomApi.respond(activity.id, answer);
      setMyAnswer(resp.answer);
      setIsCorrect(resp.is_correct);
      setItemAnswers(prev => ({ ...prev, [activity.id]: { my_answer: resp.answer, correct_answer: null, is_correct: resp.is_correct } }));
      setView("submitted");
      message.success("已提交");
    } catch (e: any) { message.error(e.message || "提交失败"); }
    setSubmitting(false);
  };

  // 清理
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
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
    } catch { message.error("加载班级数据失败"); }
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
      style={{ position: "fixed", left: 0, top: `${btnTop}%`, zIndex: 1000, cursor: "grab", touchAction: "none" }}
      onPointerDown={handleBtnDragStart}
      onPointerMove={handleBtnDragMove}
      onPointerUp={handleBtnDragEnd}
    >
      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        onClick={() => { if (!btnDragged.current) handleOpen(); }}
        style={{
          borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
          background: "#8B5CF6", borderColor: "#8B5CF6",
          boxShadow: "2px 2px 8px rgba(139,92,246,0.4)",
        }}
      >
        课堂互动
      </Button>
    </div>
  );

  if (!open) return ReactDOM.createPortal(floatingBtn, document.body);

  const panel = (
    <div ref={floatingRef} onMouseUp={handleResizeUp} style={{
      position: "fixed", left: pos.x, top: pos.y, width: size.w, height: size.h,
      background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      zIndex: 1001, resize: "both",
    }} className="flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div
        onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd}
        className="flex justify-between items-center flex-shrink-0 px-3 py-2 bg-purple text-white cursor-move select-none"
      >
        <span className="font-semibold text-sm flex items-center gap-1.5">
          <ThunderboltOutlined /> 课堂互动
        </span>
        <div className="flex gap-1" onPointerDown={e => e.stopPropagation()}>
          <Tooltip title={pinned ? "取消固定" : "固定窗口"}>
            <Button type="text" size="small" className="!text-white"
              icon={pinned ? <PushpinFilled /> : <PushpinOutlined />}
              onClick={() => { const v = !pinned; setPinned(v); try { localStorage.setItem(STORAGE_KEYS.PINNED, String(v)); } catch {} }}
            />
          </Tooltip>
          <Button type="text" size="small" icon={<ReloadOutlined />} className="!text-white"
            onClick={checkActive} />
          <Button type="text" size="small" icon={<CloseOutlined />} className="!text-white"
            onClick={() => setOpen(false)} />
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 题目进度条 - 始终显示在顶部（有计划时）*/}
        {activePlan && (() => {
          const sortedItems = [...activePlan.items].sort((a, b) => a.order_index - b.order_index);
          return (
            <div className="px-4 pt-2.5 pb-2 border-b border-gray-100 bg-gray-50">
              <div className="text-xs text-purple font-semibold mb-1.5 tracking-wide">{activePlan.title}</div>
              {/* 横排题号进度 */}
              <div className="flex gap-1.5 flex-wrap">
                {sortedItems.map((item, idx) => {
                  const isItemActive = item.status === "active";
                  const isItemDone = item.status === "ended";
                  const isPending = item.status === "pending";
                  const ans = item.activity?.id != null ? itemAnswers[item.activity.id] : undefined;
                  const isReviewing = view === "review" && item.activity?.id === selectedDoneActivityId;
                  const dotColor = isItemActive ? "#8B5CF6"
                    : isItemDone ? (ans?.is_correct === true ? "#52c41a" : ans?.is_correct === false ? "#ff4d4f" : "#faad14")
                    : "#e0e0e0";
                  return (
                    <Tooltip key={item.id} title={isPending ? "未开始" : isItemActive ? "进行中" : item.activity?.title}>
                      <div
                        onClick={() => {
                          if (isPending) return;
                          if (isItemActive) { checkActive(); return; }
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
                          width: 28, height: 28,
                          background: dotColor,
                          color: isPending ? "#bbb" : "#fff",
                          boxShadow: isReviewing ? "0 0 0 3px #8B5CF640" : isItemActive ? "0 0 0 3px #8B5CF630" : "none",
                          outline: isReviewing ? "2px solid #8B5CF6" : isItemActive ? "2px solid #8B5CF6" : "none",
                          outlineOffset: 1,
                          opacity: isPending ? 0.4 : 1,
                        }}
                        className={`rounded-full flex items-center justify-center text-xs font-semibold transition-all flex-shrink-0 ${isPending ? "cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {idx + 1}
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 主内容区 */}
        <div className="flex-1 overflow-auto p-4">
          {/* 倒计时 */}
          {remaining != null && remaining > 0 && (view === "vote" || view === "fill_blank" || view === "submitted") && (
            <div className="text-center mb-3">
              <Tag color="orange" style={{ fontSize: 16, padding: "4px 12px" }}>{formatTime(remaining)}</Tag>
            </div>
          )}

          {/* IDLE */}
          {view === "idle" && (
            <div className="flex flex-col items-center justify-center h-full pt-10">
              {activePlan ? (
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-3">⏳</div>
                  <div className="text-sm font-medium text-gray-500 mb-1">等待下一题</div>
                  <div className="text-xs text-gray-300">老师开始后将自动弹出题目</div>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <ThunderboltOutlined className="text-5xl text-gray-200 mb-3 block" />
                  <div className="text-sm">暂无进行中的活动</div>
                </div>
              )}
            </div>
          )}

          {/* VOTE */}
          {view === "vote" && activity && (
            <div>
              <div className="text-base font-semibold mb-4 leading-relaxed">{activity.title}</div>
              {activity.allow_multiple ? (
                <Checkbox.Group value={multiSelected} onChange={(v) => setMultiSelected(v as string[])} className="flex flex-col gap-2.5">
                  {(activity.options || []).map(opt => (
                    <Checkbox key={opt.key} value={opt.key} className="text-sm">
                      <Tag color="blue" className="mr-1.5">{opt.key}</Tag>{opt.text}
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              ) : (
                <Radio.Group value={selectedAnswer} onChange={e => setSelectedAnswer(e.target.value)} className="flex flex-col gap-2.5">
                  {(activity.options || []).map(opt => (
                    <Radio key={opt.key} value={opt.key} className="text-sm">
                      <Tag color="blue" className="mr-1.5">{opt.key}</Tag>{opt.text}
                    </Radio>
                  ))}
                </Radio.Group>
              )}
              <Button type="primary" block className="mt-5 !bg-purple !border-purple" onClick={handleSubmit} loading={submitting}>
                提交答案
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
                  <span style={{ background: "#722ed1", color: "#fff", borderRadius: 3, padding: "0 6px", fontSize: 12, fontFamily: "inherit", margin: "0 2px" }}>▢ {i + 1}</span>
                  )}
                </React.Fragment>
              ));
            };
            return (
              <div>
                <div className="text-base font-semibold mb-3 leading-relaxed">{activity.title}</div>
                {codeTemplate && (
                  <pre className="bg-code-bg text-code-text rounded-lg overflow-auto mb-4 whitespace-pre-wrap break-all" style={{ padding: "12px 14px", fontSize: 13, lineHeight: 1.6, fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace" }}>
                    {renderCodeWithBlanks(codeTemplate)}
                  </pre>
                )}
                {Array.from({ length: blankCount }).map((_, idx) => (
                  <div key={idx} className="mb-2">
                    <div className="text-xs text-gray-400 mb-1">空位 {idx + 1}</div>
                    <Input value={fillAnswers[idx] || ""} onChange={e => { const a = [...fillAnswers]; a[idx] = e.target.value; setFillAnswers(a); }} placeholder={`填写第 ${idx + 1} 处答案`} maxLength={120} style={{ fontFamily: "'JetBrains Mono',Consolas,monospace" }} />
                  </div>
                ))}
                <Button type="primary" block className="!mt-4 !bg-purple !border-purple" onClick={handleSubmit} loading={submitting}>
                  提交答案
                </Button>
              </div>
            );
          })()}

          {/* SUBMITTED */}
          {view === "submitted" && activity && (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">✅</div>
              <div className="text-base font-semibold mb-2 text-gray-700">已提交</div>
              <div className="text-gray-400 text-sm mb-1">你的答案：{formatDisplayAnswer(myAnswer)}</div>
              <div className="text-gray-300 text-xs">等待老师结束活动后查看结果…</div>
            </div>
          )}

          {/* RESULT */}
          {view === "result" && activity && (
            <div>
              <div className="text-base font-semibold mb-3 leading-relaxed">{activity.title}</div>
              <div className="px-4 py-3 rounded-lg mb-4" style={{ background: isCorrect === true ? "#f6ffed" : isCorrect === false ? "#fff2f0" : "#fafafa", border: `1px solid ${isCorrect === true ? "#b7eb8f" : isCorrect === false ? "#ffccc7" : "#f0f0f0"}` }}>
                <div className="text-xs text-gray-400 mb-1">我的答案</div>
                <div className="text-base font-bold" style={{ color: isCorrect === true ? "#52c41a" : isCorrect === false ? "#ff4d4f" : "#333" }}>
                  {formatDisplayAnswer(myAnswer) || "未作答"}{isCorrect === true && " ✓ 正确"}{isCorrect === false && " ✗ 错误"}
                </div>
                {activity.correct_answer && (
                  <div className="text-sm text-gray-500 mt-1">参考答案：{formatDisplayAnswer(activity.correct_answer)}</div>
                )}
              </div>
              {stats && activity.activity_type === "vote" && Array.isArray(activity.options) && (
                <div>
                  <div className="text-sm font-semibold mb-2.5 text-gray-700">班级投票结果 <span className="font-normal text-gray-400 text-xs">· {stats.total_responses} 人参与</span></div>
                  {(activity.options as any[]).map((opt: any) => {
                    const count = stats.option_counts?.[opt.key] || 0;
                    const pct = stats.total_responses > 0 ? Math.round(count / stats.total_responses * 100) : 0;
                    const isMyAnswer = myAnswer?.split(",").includes(opt.key);
                    const isCorrectOpt = activity.correct_answer?.split(",").includes(opt.key);
                    return (
                      <div key={opt.key} className="mb-2.5">
                        <div className="flex justify-between text-sm mb-1 items-center">
                          <span style={{ color: isCorrectOpt ? "#52c41a" : "#333", fontWeight: isCorrectOpt ? 600 : undefined }}>
                            {opt.key}. {opt.text}
                            {isMyAnswer && <Tag color="purple" className="ml-1.5 text-xs">我选的</Tag>}
                          </span>
                          <span className="text-gray-400 text-xs">{count} ({pct}%)</span>
                        </div>
                        <Progress percent={pct} showInfo={false} strokeColor={isCorrectOpt ? "#52c41a" : isMyAnswer ? "#8B5CF6" : "#4096ff"} size="small" />
                      </div>
                    );
                  })}
                </div>
              )}
              {stats && activity.activity_type === "fill_blank" && stats.correct_rate != null && (
                <div className="text-center py-4">
                  <Progress type="circle" percent={stats.correct_rate} size={80} strokeColor="#8B5CF6" />
                  <div className="mt-2 text-gray-400 text-xs">班级正确率 · {stats.total_responses} 人参与</div>
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
                  <Tag color="purple" className="text-xs">第 {globalIdx + 1} 题回顾</Tag>
                  <Button type="text" size="small" className="!text-gray-400 !text-xs" onClick={() => { setView("idle"); setSelectedDoneActivityId(null); }}>关闭 ×</Button>
                </div>
                <div className="text-base font-semibold mb-3.5 leading-relaxed">{reviewActivity.title}</div>
                <div className="px-3.5 py-2.5 rounded-lg mb-3.5" style={{ background: ans?.is_correct === true ? "#f6ffed" : ans?.is_correct === false ? "#fff2f0" : "#fafafa", border: `1px solid ${ans?.is_correct === true ? "#b7eb8f" : ans?.is_correct === false ? "#ffccc7" : "#f0f0f0"}` }}>
                  <div className="text-xs text-gray-400 mb-0.5">我的答案</div>
                  <div className="text-sm font-bold" style={{ color: ans?.is_correct === true ? "#52c41a" : ans?.is_correct === false ? "#ff4d4f" : "#333" }}>
                    {formatDisplayAnswer(ans?.my_answer) || "未作答"}{ans?.is_correct === true && " ✓ 正确"}{ans?.is_correct === false && " ✗ 错误"}
                  </div>
                  {ans?.correct_answer && (
                    <div className="text-xs text-gray-500 mt-0.5">参考答案：{formatDisplayAnswer(ans.correct_answer)}</div>
                  )}
                  {ans?.is_correct == null && <div className="text-xs mt-0.5" style={{ color: "#faad14" }}>等待公布结果…</div>}
                </div>
                {reviewActivity.activity_type === "vote" && Array.isArray(reviewActivity.options) && (
                  <div className="mb-3.5">
                    <div className="text-sm font-semibold mb-2 text-gray-700">班级投票结果
                      {reviewStats && <span className="font-normal text-gray-400 text-xs"> · {reviewStats.total_responses} 人参与</span>}
                    </div>
                    {(reviewActivity.options as any[]).map((opt: any) => {
                      const isMyAns = ans?.my_answer?.split(",").includes(opt.key);
                      const isCorrectOpt = reviewActivity.correct_answer?.split(",").includes(opt.key);
                      const count = reviewStats?.option_counts?.[opt.key] || 0;
                      const pct = reviewStats && reviewStats.total_responses > 0 ? Math.round(count / reviewStats.total_responses * 100) : 0;
                      return (
                        <div key={opt.key} className="mb-2.5">
                          <div className="flex justify-between text-sm mb-0.5 items-center">
                            <span style={{ color: isCorrectOpt ? "#52c41a" : "#333", fontWeight: isCorrectOpt ? 600 : undefined }}>
                              {opt.key}. {opt.text}
                              {isMyAns && <Tag color="purple" className="ml-1.5 text-xs">我选的</Tag>}
                            </span>
                            {reviewStats && <span className="text-gray-400 text-xs">{count} ({pct}%)</span>}
                          </div>
                          {reviewStats ? (
                            <Progress percent={pct} showInfo={false} strokeColor={isCorrectOpt ? "#52c41a" : isMyAns ? "#8B5CF6" : "#4096ff"} size="small" />
                          ) : reviewStatsLoading ? (
                            <div className="h-1.5 bg-gray-100 rounded" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
                {reviewActivity.activity_type === "fill_blank" && reviewStats && reviewStats.correct_rate != null && (
                  <div className="text-center py-3 mb-3.5">
                    <Progress type="circle" percent={reviewStats.correct_rate} size={80} strokeColor="#8B5CF6" />
                    <div className="mt-2 text-gray-400 text-xs">班级正确率 · {reviewStats.total_responses} 人参与</div>
                  </div>
                )}
                {reviewStatsLoading && <div className="text-center text-gray-300 text-xs mb-3">加载班级数据中…</div>}
                <div className="flex gap-2 pt-4 mt-2 border-t border-gray-100">
                  <Button block disabled={curIdx <= 0} onClick={() => doneItems[curIdx - 1] && openReview(doneItems[curIdx - 1].activity!.id)}>‹ 上一题</Button>
                  <Button block disabled={curIdx >= doneItems.length - 1} onClick={() => doneItems[curIdx + 1] && openReview(doneItems[curIdx + 1].activity!.id)} type="primary" className="!bg-purple !border-purple">下一题 ›</Button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(<>{panel}</>, document.body);
};

export default ClassroomPanel;
