/**
 * 自主检测浮动窗口 - 学生端
 * 3 个视图：列表 → 答题 → 结果（含画像 Tab）
 */
import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  FilePenLine,
  Loader2,
  Pin,
  PinOff,
  RotateCcw,
  X,
} from "lucide-react";
import { BasicProfileView, AdvancedProfileView, AdvancedProfileEmpty } from "@components/ProfileView";
import {
  assessmentSessionApi,
  profileApi,
  type AvailableAssessment,
  type QuestionForStudent,
  type AnswerResult,
  type SessionResultResponse,
  type BasicProfileResponse,
  type StudentProfile,
} from "@services/assessment";
import { floatingBtnRegistry } from "@utils/floatingBtnRegistry";
import EmptyState from "@components/Common/EmptyState";

const STORAGE_KEYS = {
  FLOATING_POS: "assessment_floating_pos",
  FLOATING_SIZE: "assessment_floating_size",
  FLOATING_PINNED: "assessment_floating_pinned",
  BTN_TOP: "assessment_btn_top",
};

type ViewType = "list" | "quiz" | "result";

interface Props {
  isAuthenticated: boolean;
  isStudent: boolean;
  isAdmin: boolean;
  userId?: number;
}

const DEFAULT_W = 560;
const DEFAULT_H = 620;
const PROFILE_POLL_INTERVAL_MS = 3000;
const MAX_PROFILE_POLL_ATTEMPTS = 40; // 约 2 分钟

/** 同一 config_id 只保留最新一条画像 */
function dedup(profiles: StudentProfile[]): StudentProfile[] {
  const map = new Map<string, StudentProfile>();
  for (const p of profiles) {
    const key = `${p.config_id ?? ""}`;
    const existing = map.get(key);
    if (!existing || p.id > existing.id) map.set(key, p);
  }
  return Array.from(map.values()).sort((a, b) => b.id - a.id);
}

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
      <div className="h-full transition-all" style={{ width: `${safePercent}%`, backgroundColor: color }} />
    </div>
  );
};

const CircleProgress = ({
  percent,
  size = 56,
  strokeColor = "var(--ws-color-purple)",
  text,
}: {
  percent: number;
  size?: number;
  strokeColor?: string;
  text?: React.ReactNode;
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
      <span className="absolute text-sm font-semibold" style={{ color: strokeColor }}>
        {text ?? `${Math.round(safePercent)}%`}
      </span>
    </div>
  );
};

const AssessmentPanel: React.FC<Props> = ({ isAuthenticated, userId }) => {
  // ─── 窗口状态 ───
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.FLOATING_PINNED) === "true"; } catch { return false; }
  });
  const [pos, setPos] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.FLOATING_POS);
      return s ? JSON.parse(s) : { x: 60, y: 200 };
    } catch { return { x: 60, y: 200 }; }
  });
  const [size, _setSize] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.FLOATING_SIZE);
      return s ? JSON.parse(s) : { w: DEFAULT_W, h: DEFAULT_H };
    } catch { return { w: DEFAULT_W, h: DEFAULT_H }; }
  });

  // ─── 业务状态 ───
  const [view, setView] = useState<ViewType>("list");
  const [loading, setLoading] = useState(false);
  const [availableList, setAvailableList] = useState<AvailableAssessment[]>([]);
  // 答题
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [configTitle, setConfigTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionForStudent[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answerResults, setAnswerResults] = useState<Map<number, AnswerResult>>(new Map());
  const [submittingAnswerId, setSubmittingAnswerId] = useState<number | null>(null);
  const submittingRef = useRef(false);
  // 答题进度提示
  const [answerProgress, setAnswerProgress] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answerInput, setAnswerInput] = useState("");
  const [timeLimitMin, setTimeLimitMin] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  // 结果
  const [sessionResult, setSessionResult] = useState<SessionResultResponse | null>(null);
  // 画像
  const [basicProfile, setBasicProfile] = useState<BasicProfileResponse | null>(null);
  const [advancedProfiles, setAdvancedProfiles] = useState<StudentProfile[]>([]);
  const [resultTab, setResultTab] = useState("detail");
  // 画像生成进度
  const [profileProgress, setProfileProgress] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const profilePollAttemptRef = useRef(0);
  // 开始检测进度
  const [startingConfigId, setStartingConfigId] = useState<number | null>(null);
  // 浮动按钮位置
  const [btnTop, setBtnTop] = useState(() => {
    try { const v = localStorage.getItem(STORAGE_KEYS.BTN_TOP); return v ? Number(v) : 55; } catch { return 55; }
  });
  const btnDragRef = useRef<{ startY: number; origTop: number } | null>(null);
  const btnDragged = useRef(false);

  // ─── 拖拽 ───
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea, .assessment-radio-option")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      try { localStorage.setItem(STORAGE_KEYS.FLOATING_POS, JSON.stringify(pos)); } catch {}
    }
  }, [pos]);

  // ─── 浮动按钮拖拽（仅垂直）───
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
    try { localStorage.setItem(STORAGE_KEYS.BTN_TOP, String(btnTop)); } catch {}
    floatingBtnRegistry.settle("assessment");
  }, [btnTop]);

  // 注册到全局按钮注册表
  useEffect(() => {
    floatingBtnRegistry.register("assessment", btnTop, (v) => {
      setBtnTop(v);
      try { localStorage.setItem(STORAGE_KEYS.BTN_TOP, String(v)); } catch {}
    });
    return () => floatingBtnRegistry.unregister("assessment");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    floatingBtnRegistry.updateTop("assessment", btnTop);
  }, [btnTop]);

  // ─── 互斥：监听其他面板打开 ───
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== "assessment" && open && view !== "quiz") setOpen(false);
    };
    window.addEventListener("panel-open", handler);
    return () => window.removeEventListener("panel-open", handler);
  }, [open]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    window.dispatchEvent(new CustomEvent("panel-open", { detail: "assessment" }));
  }, []);

  // ─── 倒计时 ───
  useEffect(() => {
    if (view !== "quiz" || !timeLimitMin || !startedAt) { setCountdown(""); return; }
    const deadline = new Date(startedAt).getTime() + timeLimitMin * 60000;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      if (left <= 0) { setCountdown("00:00"); return; }
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      setCountdown(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [view, timeLimitMin, startedAt]);

  // ─── 加载可用列表 ───
  const loadAvailable = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const list = await assessmentSessionApi.available();
      setAvailableList(list);
    } catch (e: any) {
      showMessage.error(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && view === "list") loadAvailable();
  }, [open, view, loadAvailable]);

  // ─── 开始/继续检测 ───
  const handleStart = useCallback(async (configId: number) => {
    try {
      setStartingConfigId(configId);
      const resp = await assessmentSessionApi.start(configId);
      setSessionId(resp.session_id);
      setConfigTitle(resp.config_title);
      setTimeLimitMin(resp.time_limit_minutes);
      setStartedAt(resp.started_at);
      const qs = await assessmentSessionApi.getQuestions(resp.session_id);
      setQuestions(qs);
      setCurrentIdx(0);
      setAnswerResults(new Map());
      setAnswerInput("");
      setView("quiz");
    } catch (e: any) {
      showMessage.error(e.message || "开始检测失败");
    } finally {
      setStartingConfigId(null);
    }
  }, []);

  const handleContinue = useCallback(async (sid: number, title: string) => {
    try {
      setLoading(true);
      setSessionId(sid);
      setConfigTitle(title);
      const qs = await assessmentSessionApi.getQuestions(sid);
      setQuestions(qs);
      setCurrentIdx(0);
      setAnswerResults(new Map());
      setAnswerInput("");
      setView("quiz");
    } catch (e: any) {
      showMessage.error(e.message || "加载题目失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── 提交单题 ───
  const handleSubmitAnswer = useCallback(async (answerId: number, answer: string) => {
    if (!sessionId || !answer.trim()) return;
    if (submittingRef.current) return;
    try {
      submittingRef.current = true;
      setSubmittingAnswerId(answerId);
      // 乐观更新：立即显示选中状态
      setQuestions((prev) =>
        prev.map((q) => q.answer_id === answerId ? { ...q, student_answer: answer } : q)
      );
      setAnswerProgress("AI 判题中...");
      const result = await assessmentSessionApi.submitAnswer(sessionId, {
        answer_id: answerId,
        student_answer: answer.trim(),
      });
      setAnswerResults((prev) => new Map(prev).set(answerId, result));
      setQuestions((prev) =>
        prev.map((q) => q.answer_id === answerId ? { ...q, student_answer: answer, is_answered: true } : q)
      );
      // 自适应：答错后后端返回新题，追加到题目列表
      if (result.next_question) {
        const nq = result.next_question;
        setQuestions((prev) => [
          ...prev,
          {
            answer_id: nq.answer_id,
            question_type: nq.question_type,
            content: nq.content,
            options: nq.options,
            score: nq.score,
            student_answer: null,
            is_answered: false,
            is_adaptive: nq.is_adaptive,
            knowledge_point: nq.knowledge_point,
            attempt_seq: nq.attempt_seq,
          },
        ]);
      }
      setAnswerProgress(null);
    } catch (e: any) {
      setAnswerProgress(null);
      // 回滚乐观更新
      setQuestions((prev) =>
        prev.map((q) => q.answer_id === answerId ? { ...q, student_answer: null } : q)
      );
      showMessage.error(e.message || "提交答案失败");
    } finally {
      submittingRef.current = false;
      setSubmittingAnswerId(null);
    }
  }, [sessionId]);

  // ─── 启动画像轮询 ───
  const startProfilePolling = useCallback((sid: number) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    profilePollAttemptRef.current = 0;
    setProfileProgress(10);
    pollingRef.current = setInterval(async () => {
      profilePollAttemptRef.current += 1;
      if (profilePollAttemptRef.current > MAX_PROFILE_POLL_ATTEMPTS) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setProfileProgress(95);
        showMessage.warning("画像生成耗时较长，请稍后手动刷新结果查看");
        return;
      }
      try {
        const status = await assessmentSessionApi.getProfileStatus(sid);
        if (status.basic_ready && !status.advanced_ready) {
          setProfileProgress(60);
          // 加载初级画像
          const bp = await assessmentSessionApi.getBasicProfile(sid).catch(() => null);
          if (bp) setBasicProfile(bp);
        }
        if (status.advanced_ready) {
          setProfileProgress(100);
          // 加载三维画像
          const advResp = await profileApi.getMyProfiles({ limit: 10 }).catch(() => ({ items: [] as StudentProfile[] }));
          setAdvancedProfiles(dedup(advResp.items));
          // 也确保初级画像已加载
          const bp = await assessmentSessionApi.getBasicProfile(sid).catch(() => null);
          if (bp) setBasicProfile(bp);
          // 停止轮询
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch {
        // 轮询失败静默忽略
      }
    }, PROFILE_POLL_INTERVAL_MS);
  }, []);

  // ─── 提交整卷 ───
  const handleSubmitAll = useCallback(async () => {
    if (!sessionId) return;
    try {
      setSubmitting(true);
      showMessage.loading({ content: "正在提交并评分，请稍候...", key: "submit", duration: 0 });
      const _submitResult = await assessmentSessionApi.submit(sessionId);
      showMessage.success({ content: "提交成功", key: "submit" });
      // 立即加载答题详情
      const result = await assessmentSessionApi.getResult(sessionId);
      setSessionResult(result);
      setBasicProfile(null);
      setAdvancedProfiles([]);
      setResultTab("detail");
      setView("result");
      // 启动后台画像轮询
      startProfilePolling(sessionId);
    } catch (e: any) {
      showMessage.error({ content: e.message || "提交失败", key: "submit" });
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, startProfilePolling]);

  // ─── 查看结果 ───
  const handleViewResult = useCallback(async (sid: number) => {
    try {
      setLoading(true);
      setProfileProgress(0);
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      profilePollAttemptRef.current = 0;
      const [result, basic, advResp] = await Promise.all([
        assessmentSessionApi.getResult(sid),
        assessmentSessionApi.getBasicProfile(sid).catch(() => null),
        profileApi.getMyProfiles({ limit: 10 }).catch(() => ({ items: [] as StudentProfile[] })),
      ]);
      setSessionId(sid);
      setSessionResult(result);
      setBasicProfile(basic);
      setAdvancedProfiles(dedup(advResp.items));
      setResultTab("detail");
      setView("result");
    } catch (e: any) {
      showMessage.error(e.message || "加载结果失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── 手动刷新（按当前视图） ───
  const handleManualRefresh = useCallback(() => {
    if (view === "list") {
      void loadAvailable();
      return;
    }
    if (view === "result" && sessionId) {
      void handleViewResult(sessionId);
      return;
    }
    if (view === "quiz") {
      showMessage.info("答题进行中，暂无可刷新的内容");
      return;
    }
    showMessage.info("当前暂无可刷新的内容");
  }, [view, sessionId, loadAvailable, handleViewResult]);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      profilePollAttemptRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) return;
    setOpen(false);
    setView("list");
    setLoading(false);
    setSessionId(null);
    setQuestions([]);
    setCurrentIdx(0);
    setAnswerResults(new Map());
    setSubmittingAnswerId(null);
    setAnswerProgress(null);
    setSubmitting(false);
    setAnswerInput("");
    setSessionResult(null);
    setBasicProfile(null);
    setAdvancedProfiles([]);
    setProfileProgress(0);
    setStartingConfigId(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    profilePollAttemptRef.current = 0;
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  // 浮动按钮
  const floatingBtn = !open && (
    <div
      style={{ position: "fixed", left: 0, top: `${btnTop}%`, zIndex: "var(--ws-z-floating-btn)", cursor: "grab", touchAction: "none" }}
      onPointerDown={handleBtnDragStart}
      onPointerMove={handleBtnDragMove}
      onPointerUp={handleBtnDragEnd}
    >
      <Button
        onClick={() => { if (!btnDragged.current) handleOpen(); }}
        className="ws-floating-entry-btn ws-floating-entry-btn--assessment"
      >
        <FilePenLine className="h-4 w-4" />
        自我评价
      </Button>
    </div>
  );

  // ─── 渲染列表视图 ───
  const renderList = () => (
    <div className="overflow-auto flex-1 p-3">
      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-text-tertiary" />
        </div>
      ) : availableList.length === 0 ? (
        <div className="text-center text-text-tertiary py-10">暂无可用检测</div>
      ) : (
        availableList.map((item) => (
          <div
            key={item.id}
            className="border border-[var(--ws-color-border)] rounded-lg p-[var(--ws-space-2)] mb-2 bg-surface-2"
          >
            <div className="font-semibold mb-1">{item.title}</div>
            <div className="text-xs text-text-tertiary mb-2">
              总分 {item.total_score}
              {item.time_limit_minutes > 0 && <span> · {item.time_limit_minutes}分钟</span>}
            </div>
            {!item.session_status && (
              startingConfigId === item.id ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                  <span className="text-xs text-[var(--ws-color-purple)]">AI 正在出题，请稍候...</span>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="!bg-[var(--ws-color-purple)] hover:!bg-[var(--ws-color-purple)]"
                  onClick={() => handleStart(item.id)}
                  disabled={startingConfigId !== null}
                >
                  开始检测
                </Button>
              )
            )}
            {item.session_status === "in_progress" && (
              <Button size="sm" onClick={() => handleContinue(item.session_id!, item.title)}>继续答题</Button>
            )}
            {item.session_status === "graded" && (
              <div className="flex items-center gap-2">
                <Badge variant="success">
                  {item.earned_score}/{item.total_score} 分
                </Badge>
                <Button variant="link" size="sm" onClick={() => handleViewResult(item.session_id!)}>查看结果</Button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  // ─── 渲染答题视图 ───
  const renderQuiz = () => {
    const q = questions[currentIdx];
    if (!q) return <div className="p-5">加载中...</div>;
    const result = answerResults.get(q.answer_id);
    const _answered = !!result || q.is_answered;
    let options: string[] = [];
    if (q.options) {
      try {
        const parsed = JSON.parse(q.options);
        if (Array.isArray(parsed)) {
          options = parsed;
        } else if (parsed && typeof parsed === "object") {
          options = Object.entries(parsed).map(([k, v]) => `${k}. ${v}`);
        }
      } catch {}
    }

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 顶部进度 */}
        <div className="px-[var(--ws-space-2)] py-[var(--ws-space-1)] border-b border-[var(--ws-color-border)] flex justify-between items-center">
          <span className="font-semibold">第 {currentIdx + 1}/{questions.length} 题</span>
          {countdown && (
            <Badge variant="danger">
              {countdown}
            </Badge>
          )}
        </div>
        {/* 题号导航 */}
        <div className="px-[var(--ws-space-2)] py-[var(--ws-space-1)] flex gap-[var(--ws-space-1)] flex-wrap border-b border-[var(--ws-color-border)]">
          {questions.map((qq, i) => {
            const done = answerResults.has(qq.answer_id) || qq.is_answered;
            return (
              <div
                key={qq.answer_id}
                onClick={() => { setCurrentIdx(i); setAnswerInput(""); }}
                className="flex h-6 w-6 items-center justify-center rounded text-xs"
                style={{
                  background:
                    i === currentIdx
                      ? "var(--ws-color-purple)"
                      : done
                        ? "var(--ws-color-success)"
                        : "var(--ws-color-surface-2)",
                  color:
                    i === currentIdx || done
                      ? "var(--ws-color-surface)"
                      : "var(--ws-color-text-secondary)",
                  border: qq.is_adaptive ? "2px solid var(--ws-color-purple)" : "none",
                }}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
        {/* 题目内容 */}
        <div className="flex-1 overflow-y-auto p-3">
          <Badge
            variant={q.question_type === "choice" ? "sky" : q.question_type === "fill" ? "success" : "warning"}
            className="mb-2 border-none"
          >
            {q.question_type === "choice" ? "选择题" : q.question_type === "fill" ? "填空题" : "简答题"} ({q.score}分)
          </Badge>
          {q.is_adaptive && (
            <Badge variant="purple" className="mb-2">
              自适应练习{q.attempt_seq && q.attempt_seq > 1 ? ` · 第${q.attempt_seq}次` : ""}
            </Badge>
          )}
          <div className="text-sm mb-3 whitespace-pre-wrap">{q.content}</div>

          {/* 选择题 */}
          {q.question_type === "choice" && (
            <div className="flex flex-col gap-2">
              {options.map((opt, i) => {
                const letter = opt.charAt(0);
                let style: React.CSSProperties = {};
                if (result) {
                  if (letter === result.correct_answer?.charAt(0)) style = { color: "var(--ws-color-success)", fontWeight: 600 };
                  if (letter === q.student_answer?.charAt(0) && !result.is_correct) style = { color: "var(--ws-color-error)", textDecoration: "line-through" };
                }
                return (
                  <label key={i} className="assessment-radio-option flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`assessment-choice-${q.answer_id}`}
                      value={letter}
                      checked={(q.student_answer || undefined) === letter}
                      disabled={!!result || submittingAnswerId === q.answer_id}
                      onChange={() => {
                        if (!result && !submittingRef.current) {
                          void handleSubmitAnswer(q.answer_id, letter);
                        }
                      }}
                      className="h-4 w-4 accent-[var(--ws-color-primary)]"
                    />
                    <span style={style}>{opt}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* 填空题 */}
          {q.question_type === "fill" && (
            <div>
              <Input
                value={result ? (q.student_answer || "") : answerInput}
                onChange={(e) => !result && setAnswerInput(e.target.value)}
                disabled={!!result || submittingAnswerId === q.answer_id}
                placeholder="输入答案"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !result && answerInput.trim()) {
                    void handleSubmitAnswer(q.answer_id, answerInput);
                  }
                }}
              />
              {!result && submittingAnswerId !== q.answer_id && (
                <Button
                  size="sm"
                  className="mt-2 !bg-[var(--ws-color-purple)] hover:!bg-[var(--ws-color-purple)]"
                  onClick={() => answerInput.trim() && void handleSubmitAnswer(q.answer_id, answerInput)}
                >
                  提交
                </Button>
              )}
            </div>
          )}

          {/* 简答题 */}
          {q.question_type === "short_answer" && (
            <div>
              <Textarea
                rows={4}
                value={result ? (q.student_answer || "") : answerInput}
                onChange={(e) => !result && setAnswerInput(e.target.value)}
                disabled={!!result || submittingAnswerId === q.answer_id}
                placeholder="输入答案"
                onBlur={() => {
                  if (!result && answerInput.trim()) void handleSubmitAnswer(q.answer_id, answerInput);
                }}
              />
              {!result && answerInput.trim() && (
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => void handleSubmitAnswer(q.answer_id, answerInput)}
                >
                  保存
                </Button>
              )}
            </div>
          )}

          {/* 判题进度 */}
          {submittingAnswerId === q.answer_id && answerProgress && (
            <div className="mt-3 p-[var(--ws-space-1)] bg-[var(--ws-color-info-soft)] rounded-md flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
              <span className="text-sm text-[var(--ws-color-purple)]">{answerProgress}</span>
            </div>
          )}

          {/* 反馈 */}
          {result && (
            <div className={`mt-3 rounded-md p-2 ${result.is_correct ? "bg-[var(--ws-color-success-soft)]" : "bg-[var(--ws-color-error-soft)]"}`}>
              {result.is_correct !== null && (
                <div className="mb-1">
                  {result.is_correct
                    ? <span className="inline-flex items-center gap-1 text-[var(--ws-color-success)]"><CircleCheck className="h-4 w-4" /> 正确 +{result.earned_score}分</span>
                    : <span className="inline-flex items-center gap-1 text-[var(--ws-color-error)]"><CircleX className="h-4 w-4" /> 错误 +{result.earned_score || 0}分</span>}
                </div>
              )}
              {result.explanation && <div className="text-xs text-text-tertiary">解析：{result.explanation}</div>}
              {result.ai_feedback && <div className="text-xs text-text-tertiary">AI 反馈：{result.ai_feedback}</div>}
              {result.next_question && (
                <div className="mt-[var(--ws-space-1)] text-xs text-[var(--ws-color-purple)]">
                  知识点「{result.next_question.knowledge_point}」已追加练习题，请继续作答
                </div>
              )}
              {result.mastery_status === "mastered" && (
                <div className="mt-1.5 text-xs text-[var(--ws-color-success)]">
                  该知识点已掌握
                </div>
              )}
            </div>
          )}
        </div>
        {/* 底部导航 */}
        <div className="px-[var(--ws-space-2)] py-[var(--ws-space-1)] border-t border-[var(--ws-color-border)] flex justify-between">
          <Button
            size="sm"
            disabled={currentIdx === 0}
            onClick={() => { setCurrentIdx(currentIdx - 1); setAnswerInput(""); }}
          >
            <ChevronLeft className="h-4 w-4" />
            上一题
          </Button>
          {currentIdx < questions.length - 1 ? (
            <Button
              size="sm"
              onClick={() => { setCurrentIdx(currentIdx + 1); setAnswerInput(""); }}
            >
              下一题
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="!bg-[var(--ws-color-purple)] hover:!bg-[var(--ws-color-purple)]"
              disabled={submitting}
              onClick={() => {
                if (!window.confirm("确定提交检测？提交后无法修改答案。")) return;
                void handleSubmitAll();
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              提交检测
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ─── 渲染结果视图 ───
  const renderResult = () => {
    if (!sessionResult) {
      return (
        <div className="p-5 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-text-tertiary" />
        </div>
      );
    }
    const r = sessionResult;
    const pct = r.total_score > 0 ? Math.round(((r.earned_score || 0) / r.total_score) * 100) : 0;

    return (
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* 顶部得分条 */}
        <div className="flex items-center gap-3.5 bg-gradient-to-br from-surface-2 to-surface px-[var(--ws-space-3)] py-[var(--ws-space-2)]">
          <CircleProgress
            percent={pct}
            size={56}
            strokeColor={pct >= 60 ? "var(--ws-color-success)" : "var(--ws-color-error)"}
            text={`${pct}%`}
          />
          <div>
            <div className="text-2xl font-bold">
              {r.earned_score ?? 0}
              <span className="text-sm text-text-tertiary font-normal"> / {r.total_score}</span>
            </div>
            <div className="text-xs text-text-tertiary mt-[calc(var(--ws-space-1)/2)]">
              {r.submitted_at ? new Date(r.submitted_at).toLocaleString("zh-CN") : ""}
            </div>
          </div>
        </div>

        {/* 画像生成进度条 */}
        {profileProgress > 0 && profileProgress < 100 && (
          <div className="px-5 pt-2">
            <LineProgress percent={profileProgress} color="var(--ws-color-purple)" />
            <div className="mt-1 text-xs text-text-tertiary">
              {profileProgress < 60 ? "生成初级画像..." : "生成三维画像..."}
            </div>
          </div>
        )}

        {/* Tab 区域 */}
        <Tabs value={resultTab} onValueChange={setResultTab} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-3 w-fit">
            <TabsTrigger value="detail">答题详情</TabsTrigger>
            <TabsTrigger value="basic">初级画像</TabsTrigger>
            <TabsTrigger value="advanced">三维画像</TabsTrigger>
          </TabsList>

          <TabsContent value="detail" className="mt-2 flex-1 overflow-y-auto px-4 py-3">
            {r.answers.map((a, i) => (
              <details key={a.id} className="mb-2 overflow-hidden rounded-md border border-[var(--ws-color-border)] bg-surface">
                <summary className="flex cursor-pointer items-center gap-1.5 px-[var(--ws-space-2)] py-[var(--ws-space-1)] text-sm">
                  <span>第{i + 1}题</span>
                  {a.is_correct === true && <CircleCheck className="h-4 w-4 text-[var(--ws-color-success)]" />}
                  {a.is_correct === false && <CircleX className="h-4 w-4 text-[var(--ws-color-error)]" />}
                  <span className="text-xs text-text-tertiary">+{a.earned_score || 0}/{a.max_score}</span>
                </summary>
                <div className="border-t border-[var(--ws-color-border-secondary)] px-[var(--ws-space-2)] py-[var(--ws-space-1)] text-sm">
                  <div className="mb-1">{a.content}</div>
                  <div>
                    我的答案：
                    <span className={a.is_correct ? "text-[var(--ws-color-success)]" : "text-[var(--ws-color-error)]"}>
                      {a.student_answer || "未作答"}
                    </span>
                  </div>
                  <div>正确答案：{a.correct_answer}</div>
                  {a.explanation && <div className="mt-1 text-text-tertiary">解析：{a.explanation}</div>}
                  {a.ai_feedback && <div className="mt-[calc(var(--ws-space-1)/2)] text-text-tertiary">AI 反馈：{a.ai_feedback}</div>}
                </div>
              </details>
            ))}
          </TabsContent>

          <TabsContent value="basic" className="mt-2 flex-1 overflow-y-auto p-4">
            {basicProfile ? <BasicProfileView data={basicProfile} /> : <EmptyState description="暂无画像数据" />}
          </TabsContent>

          <TabsContent value="advanced" className="mt-2 flex-1 overflow-y-auto p-4">
            {advancedProfiles.length > 0 ? (
              <div className="mb-4">
                <AdvancedProfileView profile={advancedProfiles[0]} />
              </div>
            ) : (
              <AdvancedProfileEmpty />
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // ─── 渲染窗口 ───
  const renderWindow = () => (
    <div
      className="ws-floating-panel flex flex-col"
      style={{
        position: "fixed", left: pos.x, top: pos.y,
        width: size.w, height: size.h,
        zIndex: "var(--ws-z-floating-panel)",
        resize: "both", minWidth: "20rem", minHeight: "25rem",
      }}
    >
      {/* 头部 */}
      <div
        className="ws-floating-panel-header ws-floating-panel-header--assessment select-none"
        style={{ cursor: pinned ? 'default' : 'move' }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <span className="font-semibold text-sm">
          {view === "list" ? "自我评价" : view === "quiz" ? configTitle : "自我评价"}
        </span>
        <div className="flex gap-1" onPointerDown={e => e.stopPropagation()}>
          {view !== "list" && view !== "quiz" && (
            <Button variant="ghost" size="sm" className="ws-floating-panel-header-action" onClick={() => setView("list")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ws-floating-panel-header-action"
            onClick={() => { const v = !pinned; setPinned(v); try { localStorage.setItem(STORAGE_KEYS.FLOATING_PINNED, String(v)); } catch {} }}
          >
            {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ws-floating-panel-header-action"
            disabled={loading}
            onClick={handleManualRefresh}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          </Button>
          <InlineTooltip title={view === "quiz" ? "自我检查中不可关闭，请先提交" : "关闭"}>
            <Button
              variant="ghost"
              size="sm"
              className="ws-floating-panel-header-action"
              disabled={view === "quiz"}
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </InlineTooltip>
        </div>
      </div>
      {/* 内容 */}
      {view === "list" && renderList()}
      {view === "quiz" && renderQuiz()}
      {view === "result" && renderResult()}
    </div>
  );

  const isQuizzing = open && view === "quiz";

  return ReactDOM.createPortal(
    <TooltipProvider delayDuration={120}>
      <>
        {/* 答题时遮罩：模糊背景 + 禁止交互 */}
        {isQuizzing && (
          <div className="fixed inset-0 z-[var(--ws-z-floating-btn)] backdrop-blur-sm" style={{ background: "var(--ws-color-overlay)" }} />
        )}
        {floatingBtn}
        {open && renderWindow()}
      </>
    </TooltipProvider>,
    document.body,
  );
};

export default AssessmentPanel;
