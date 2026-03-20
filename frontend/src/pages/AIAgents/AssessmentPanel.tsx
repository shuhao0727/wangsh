/**
 * 自主检测浮动窗口 - 学生端
 * 3 个视图：列表 → 答题 → 结果（含画像 Tab）
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  Button,
  Radio,
  Input,
  Tag,
  Spin,
  Progress,
  Collapse,
  Tabs,
  Popconfirm,
  Tooltip,
  message,
} from "antd";
import {
  CloseOutlined,
  PushpinOutlined,
  PushpinFilled,
  FormOutlined,
  ReloadOutlined,
  LeftOutlined,
  RightOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from "@ant-design/icons";
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

const { TextArea } = Input;

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
  const [size, setSize] = useState(() => {
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
    if ((e.target as HTMLElement).closest("button, input, textarea, .ant-radio-wrapper")) return;
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
      message.error(e.message || "加载失败");
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
      message.error(e.message || "开始检测失败");
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
      message.error(e.message || "加载题目失败");
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
      message.error(e.message || "提交答案失败");
    } finally {
      submittingRef.current = false;
      setSubmittingAnswerId(null);
    }
  }, [sessionId]);

  // ─── 启动画像轮询 ───
  const startProfilePolling = useCallback((sid: number) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setProfileProgress(10);
    pollingRef.current = setInterval(async () => {
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
    }, 3000);
  }, []);

  // ─── 提交整卷 ───
  const handleSubmitAll = useCallback(async () => {
    if (!sessionId) return;
    try {
      setSubmitting(true);
      message.loading({ content: "正在提交并评分，请稍候...", key: "submit", duration: 0 });
      const submitResult = await assessmentSessionApi.submit(sessionId);
      message.success({ content: "提交成功", key: "submit" });
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
      message.error({ content: e.message || "提交失败", key: "submit" });
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
      message.error(e.message || "加载结果失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  if (!isAuthenticated) return null;

  // 浮动按钮
  const floatingBtn = !open && (
    <div
      style={{ position: "fixed", left: 0, top: `${btnTop}%`, zIndex: 1000, cursor: "grab", touchAction: "none" }}
      onPointerDown={handleBtnDragStart}
      onPointerMove={handleBtnDragMove}
      onPointerUp={handleBtnDragEnd}
    >
      <Button
        type="primary"
        icon={<FormOutlined />}
        onClick={() => { if (!btnDragged.current) handleOpen(); }}
        style={{
          borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
          boxShadow: "2px 0 8px rgba(0,0,0,0.15)",
          background: "#6366F1", borderColor: "#6366F1",
        }}
      >
        自我评价
      </Button>
    </div>
  );

  // ─── 渲染列表视图 ───
  const renderList = () => (
    <div style={{ padding: 12, overflowY: "auto", flex: 1 }}>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
      ) : availableList.length === 0 ? (
        <div style={{ textAlign: "center", color: "#999", padding: 40 }}>暂无可用检测</div>
      ) : (
        availableList.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid #f0f0f0", borderRadius: 8, padding: 12, marginBottom: 8,
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
              总分 {item.total_score}
              {item.time_limit_minutes > 0 && <span> · {item.time_limit_minutes}分钟</span>}
            </div>
            {!item.session_status && (
              startingConfigId === item.id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Spin size="small" />
                  <span style={{ fontSize: 12, color: "#6366F1" }}>AI 正在出题，请稍候...</span>
                </div>
              ) : (
                <Button type="primary" size="small" onClick={() => handleStart(item.id)} disabled={startingConfigId !== null}>开始检测</Button>
              )
            )}
            {item.session_status === "in_progress" && (
              <Button size="small" onClick={() => handleContinue(item.session_id!, item.title)}>继续答题</Button>
            )}
            {item.session_status === "graded" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Tag color="green">{item.earned_score}/{item.total_score} 分</Tag>
                <Button type="link" size="small" onClick={() => handleViewResult(item.session_id!)}>查看结果</Button>
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
    if (!q) return <div style={{ padding: 20 }}>加载中...</div>;
    const result = answerResults.get(q.answer_id);
    const answered = !!result || q.is_answered;
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
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        {/* 顶部进度 */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>第 {currentIdx + 1}/{questions.length} 题</span>
          {countdown && <Tag color="red">{countdown}</Tag>}
        </div>
        {/* 题号导航 */}
        <div style={{ padding: "6px 12px", display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "1px solid #f0f0f0" }}>
          {questions.map((qq, i) => {
            const done = answerResults.has(qq.answer_id) || qq.is_answered;
            return (
              <div
                key={qq.answer_id}
                onClick={() => { setCurrentIdx(i); setAnswerInput(""); }}
                style={{
                  width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, cursor: "pointer",
                  background: i === currentIdx ? "#6366F1" : done ? "#10B981" : "#e5e7eb",
                  color: i === currentIdx || done ? "#fff" : "#666",
                  border: qq.is_adaptive ? "2px solid #A855F7" : "none",
                }}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
        {/* 题目内容 */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          <Tag color={q.question_type === "choice" ? "blue" : q.question_type === "fill" ? "green" : "orange"} style={{ marginBottom: 8 }}>
            {q.question_type === "choice" ? "选择题" : q.question_type === "fill" ? "填空题" : "简答题"} ({q.score}分)
          </Tag>
          {q.is_adaptive && (
            <Tag color="purple" style={{ marginBottom: 8 }}>
              自适应练习{q.attempt_seq && q.attempt_seq > 1 ? ` · 第${q.attempt_seq}次` : ""}
            </Tag>
          )}
          <div style={{ fontSize: 14, marginBottom: 12, whiteSpace: "pre-wrap" }}>{q.content}</div>

          {/* 选择题 */}
          {q.question_type === "choice" && (
            <Radio.Group
              value={q.student_answer || undefined}
              onChange={(e) => {
                if (!result && !submittingRef.current) handleSubmitAnswer(q.answer_id, e.target.value);
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {options.map((opt, i) => {
                const letter = opt.charAt(0);
                let style: React.CSSProperties = {};
                if (result) {
                  if (letter === result.correct_answer?.charAt(0)) style = { color: "#10B981", fontWeight: 600 };
                  if (letter === q.student_answer?.charAt(0) && !result.is_correct) style = { color: "#EF4444", textDecoration: "line-through" };
                }
                return <Radio key={i} value={letter} disabled={!!result || submittingAnswerId === q.answer_id} style={style}>{opt}</Radio>;
              })}
            </Radio.Group>
          )}

          {/* 填空题 */}
          {q.question_type === "fill" && (
            <div>
              <Input
                value={result ? (q.student_answer || "") : answerInput}
                onChange={(e) => !result && setAnswerInput(e.target.value)}
                disabled={!!result || submittingAnswerId === q.answer_id}
                placeholder="输入答案"
                onPressEnter={() => !result && answerInput.trim() && handleSubmitAnswer(q.answer_id, answerInput)}
              />
              {!result && submittingAnswerId !== q.answer_id && (
                <Button size="small" type="primary" style={{ marginTop: 8 }}
                  onClick={() => answerInput.trim() && handleSubmitAnswer(q.answer_id, answerInput)}
                >提交</Button>
              )}
            </div>
          )}

          {/* 简答题 */}
          {q.question_type === "short_answer" && (
            <div>
              <TextArea
                rows={4}
                value={result ? (q.student_answer || "") : answerInput}
                onChange={(e) => !result && setAnswerInput(e.target.value)}
                disabled={!!result || submittingAnswerId === q.answer_id}
                placeholder="输入答案"
                onBlur={() => {
                  if (!result && answerInput.trim()) handleSubmitAnswer(q.answer_id, answerInput);
                }}
              />
              {!result && answerInput.trim() && (
                <Button size="small" style={{ marginTop: 8 }}
                  onClick={() => handleSubmitAnswer(q.answer_id, answerInput)}
                >保存</Button>
              )}
            </div>
          )}

          {/* 判题进度 */}
          {submittingAnswerId === q.answer_id && answerProgress && (
            <div style={{ marginTop: 12, padding: 8, background: "#f0f5ff", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <Spin size="small" />
              <span style={{ fontSize: 13, color: "#6366F1" }}>{answerProgress}</span>
            </div>
          )}

          {/* 反馈 */}
          {result && (
            <div style={{ marginTop: 12, padding: 8, background: result.is_correct ? "#f0fdf4" : "#fef2f2", borderRadius: 6 }}>
              {result.is_correct !== null && (
                <div style={{ marginBottom: 4 }}>
                  {result.is_correct
                    ? <span style={{ color: "#10B981" }}><CheckCircleFilled /> 正确 +{result.earned_score}分</span>
                    : <span style={{ color: "#EF4444" }}><CloseCircleFilled /> 错误 +{result.earned_score || 0}分</span>}
                </div>
              )}
              {result.explanation && <div style={{ fontSize: 12, color: "#666" }}>解析：{result.explanation}</div>}
              {result.ai_feedback && <div style={{ fontSize: 12, color: "#666" }}>AI 反馈：{result.ai_feedback}</div>}
              {result.next_question && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#A855F7" }}>
                  知识点「{result.next_question.knowledge_point}」已追加练习题，请继续作答
                </div>
              )}
              {result.mastery_status === "mastered" && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#10B981" }}>
                  该知识点已掌握
                </div>
              )}
            </div>
          )}
        </div>
        {/* 底部导航 */}
        <div style={{ padding: "8px 12px", borderTop: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between" }}>
          <Button size="small" icon={<LeftOutlined />} disabled={currentIdx === 0}
            onClick={() => { setCurrentIdx(currentIdx - 1); setAnswerInput(""); }}>上一题</Button>
          {currentIdx < questions.length - 1 ? (
            <Button size="small" icon={<RightOutlined />}
              onClick={() => { setCurrentIdx(currentIdx + 1); setAnswerInput(""); }}>下一题</Button>
          ) : (
            <Popconfirm title="确定提交检测？" description="提交后无法修改答案" onConfirm={handleSubmitAll} okText="确定" cancelText="取消">
              <Button size="small" type="primary" loading={submitting}>提交检测</Button>
            </Popconfirm>
          )}
        </div>
      </div>
    );
  };

  // ─── 渲染结果视图 ───
  const renderResult = () => {
    if (!sessionResult) return <div style={{ padding: 20, textAlign: "center" }}><Spin /></div>;
    const r = sessionResult;
    const pct = r.total_score > 0 ? Math.round(((r.earned_score || 0) / r.total_score) * 100) : 0;

    return (
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* 顶部得分条 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "linear-gradient(135deg, #f5f7fa 0%, #e4e8ee 100%)" }}>
          <Progress type="circle" percent={pct} size={56}
            strokeColor={pct >= 60 ? "#10B981" : "#EF4444"}
            format={() => <span style={{ fontSize: 15, fontWeight: 700, color: pct >= 60 ? "#10B981" : "#EF4444" }}>{pct}%</span>}
          />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {r.earned_score ?? 0}
              <span style={{ fontSize: 13, color: "#999", fontWeight: 400 }}> / {r.total_score}</span>
            </div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
              {r.submitted_at ? new Date(r.submitted_at).toLocaleString("zh-CN") : ""}
            </div>
          </div>
        </div>

        {/* 画像生成进度条 */}
        {profileProgress > 0 && profileProgress < 100 && (
          <div style={{ padding: "8px 20px 0" }}>
            <Progress
              percent={profileProgress}
              size="small"
              status="active"
              format={(pct) => pct! < 60 ? "生成初级画像..." : "生成三维画像..."}
            />
          </div>
        )}

        {/* Tab 区域 */}
        <Tabs activeKey={resultTab} onChange={setResultTab}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
          tabBarStyle={{ padding: "0 16px", marginBottom: 0 }}
          items={[
            {
              key: "detail",
              label: "答题详情",
              children: (
                <div style={{ padding: "12px 16px", overflowY: "auto" }}>
                  <Collapse size="small" items={r.answers.map((a, i) => ({
                    key: a.id,
                    label: (
                      <span>
                        第{i + 1}题
                        {a.is_correct === true && <CheckCircleFilled style={{ color: "#10B981", marginLeft: 4 }} />}
                        {a.is_correct === false && <CloseCircleFilled style={{ color: "#EF4444", marginLeft: 4 }} />}
                        <span style={{ marginLeft: 4, fontSize: 12, color: "#999" }}>+{a.earned_score || 0}/{a.max_score}</span>
                      </span>
                    ),
                    children: (
                      <div style={{ fontSize: 13 }}>
                        <div style={{ marginBottom: 4 }}>{a.content}</div>
                        <div>我的答案：<span style={{ color: a.is_correct ? "#10B981" : "#EF4444" }}>{a.student_answer || "未作答"}</span></div>
                        <div>正确答案：{a.correct_answer}</div>
                        {a.explanation && <div style={{ color: "#666", marginTop: 4 }}>解析：{a.explanation}</div>}
                        {a.ai_feedback && <div style={{ color: "#666", marginTop: 2 }}>AI 反馈：{a.ai_feedback}</div>}
                      </div>
                    ),
                  }))} />
                </div>
              ),
            },
            {
              key: "basic",
              label: "初级画像",
              children: (
                <div style={{ padding: "16px", overflowY: "auto" }}>
                  {basicProfile ? (
                    <BasicProfileView data={basicProfile} />
                  ) : (
                    <div style={{ color: "#999", textAlign: "center", padding: 40 }}>暂无画像数据</div>
                  )}
                </div>
              ),
            },
            {
              key: "advanced",
              label: "三维画像",
              children: (
                <div style={{ padding: "16px", overflowY: "auto" }}>
                  {advancedProfiles.length > 0 ? (
                    advancedProfiles.map((p) => (
                      <div key={p.id} style={{ marginBottom: 16 }}>
                        <AdvancedProfileView profile={p} />
                      </div>
                    ))
                  ) : (
                    <AdvancedProfileEmpty />
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    );
  };

  // ─── 渲染窗口 ───
  const renderWindow = () => (
    <div
      style={{
        position: "fixed", left: pos.x, top: pos.y,
        width: size.w, height: size.h,
        background: "#fff", borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column",
        zIndex: 1001, overflow: "hidden",
        resize: "both", minWidth: 320, minHeight: 400,
      }}
    >
      {/* 头部 */}
      <div
        style={{
          padding: "8px 12px", background: "#6366F1", color: "#fff",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "move", userSelect: "none",
        }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {view === "list" ? "自主检测" : view === "quiz" ? configTitle : "检测结果"}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {view !== "list" && view !== "quiz" && (
            <Button type="text" size="small" icon={<LeftOutlined />} style={{ color: "#fff" }}
              onClick={() => setView("list")} />
          )}
          <Button type="text" size="small" style={{ color: "#fff" }}
            icon={pinned ? <PushpinFilled /> : <PushpinOutlined />}
            onClick={() => { const v = !pinned; setPinned(v); try { localStorage.setItem(STORAGE_KEYS.FLOATING_PINNED, String(v)); } catch {} }} />
          <Button type="text" size="small" icon={<ReloadOutlined />} style={{ color: "#fff" }}
            onClick={() => { if (view === "list") loadAvailable(); }} />
          <Tooltip title={view === "quiz" ? "自我检查中不可关闭，请先提交" : ""}>
            <Button type="text" size="small" icon={<CloseOutlined />} style={{ color: "#fff" }}
              disabled={view === "quiz"}
              onClick={() => setOpen(false)} />
          </Tooltip>
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
    <>
      {/* 答题时遮罩：模糊背景 + 禁止交互 */}
      {isQuizzing && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          background: "rgba(0,0,0,0.15)",
        }} />
      )}
      {floatingBtn}
      {open && renderWindow()}
    </>,
    document.body,
  );
};

export default AssessmentPanel;
