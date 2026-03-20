/**
 * 课堂互动浮动窗口 - 学生端
 * 视图：idle → vote/fill_blank → submitted → result
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Button, Radio, Checkbox, Input, Tag, Progress, message, Tooltip } from "antd";
import { CloseOutlined, PushpinOutlined, PushpinFilled, ThunderboltOutlined, ReloadOutlined } from "@ant-design/icons";
import { classroomApi, Activity, ActivityStats } from "@services/classroom";
import { floatingBtnRegistry } from "@utils/floatingBtnRegistry";

const STORAGE_KEYS = {
  POS: "ci_floating_pos",
  SIZE: "ci_floating_size",
  PINNED: "ci_floating_pinned",
  BTN_TOP: "ci_btn_top",
};

type ViewType = "idle" | "vote" | "fill_blank" | "submitted" | "result";

interface Props {
  isAuthenticated: boolean;
  isStudent: boolean;
  isAdmin: boolean;
  userId?: number;
}

const DEFAULT_W = 420;
const DEFAULT_H = 480;

const ClassroomPanel: React.FC<Props> = ({ isAuthenticated }) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.PINNED) === "true"; } catch { return false; }
  });
  const [pos, setPos] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEYS.POS); return s ? JSON.parse(s) : { x: 60, y: 300 }; } catch { return { x: 60, y: 300 }; }
  });
  const [size] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [btnTop, setBtnTop] = useState(() => {
    try { const v = localStorage.getItem(STORAGE_KEYS.BTN_TOP); return v ? Number(v) : 65; } catch { return 65; }
  });
  const btnDragRef = useRef<{ startY: number; origTop: number } | null>(null);
  const btnDragged = useRef(false);

  const [view, setView] = useState<ViewType>("idle");
  const [activity, setActivity] = useState<Activity | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [fillAnswer, setFillAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [stats, setStats] = useState<ActivityStats | null>(null);

// PLACEHOLDER_HOOKS_AND_HANDLERS

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

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
    if (dragRef.current) { dragRef.current = null; try { localStorage.setItem(STORAGE_KEYS.POS, JSON.stringify(pos)); } catch {} }
  }, [pos]);

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
    try {
      const list = await classroomApi.getActive();
      if (list.length > 0) {
        const a = list[0];
        if (!activity || activity.id !== a.id || activity.status !== a.status) {
          setActivity(a);
          if (a.my_answer) {
            setMyAnswer(a.my_answer);
            setView("submitted");
          } else {
            setView(a.activity_type === "vote" ? "vote" : "fill_blank");
            setSelectedAnswer("");
            setMultiSelected([]);
            setFillAnswer("");
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
          setView("result");
        } catch {
          setView("idle");
          setActivity(null);
        }
      }
    } catch {}
  }, [isAuthenticated, activity, open, handleOpen]);

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
          checkActive();
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
      answer = fillAnswer.trim();
    }
    if (!answer) { message.warning("请先作答"); return; }
    setSubmitting(true);
    try {
      const resp = await classroomApi.respond(activity.id, answer);
      setMyAnswer(resp.answer);
      setIsCorrect(resp.is_correct);
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

// PLACEHOLDER_RENDER

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
    try { localStorage.setItem(STORAGE_KEYS.BTN_TOP, String(btnTop)); } catch {}
    floatingBtnRegistry.settle("classroom");
  }, [btnTop]);

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
          boxShadow: "2px 0 8px rgba(0,0,0,0.15)",
          background: "#8B5CF6", borderColor: "#8B5CF6",
        }}
      >
        课堂互动
      </Button>
    </div>
  );

  if (!open) return ReactDOM.createPortal(floatingBtn, document.body);

  const panel = (
    <div style={{
      position: "fixed", left: pos.x, top: pos.y, width: size.w, height: size.h,
      background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      zIndex: 1001, display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* 标题栏 */}
      <div
        onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd}
        style={{
          padding: "8px 12px", background: "#8B5CF6", color: "#fff",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "move", userSelect: "none", flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <ThunderboltOutlined /> 课堂互动
        </span>
        <div style={{ display: "flex", gap: 4 }} onPointerDown={e => e.stopPropagation()}>
          <Tooltip title={pinned ? "取消固定" : "固定窗口"}>
            <Button type="text" size="small" style={{ color: "#fff" }}
              icon={pinned ? <PushpinFilled /> : <PushpinOutlined />}
              onClick={() => { const v = !pinned; setPinned(v); try { localStorage.setItem(STORAGE_KEYS.PINNED, String(v)); } catch {} }}
            />
          </Tooltip>
          <Button type="text" size="small" icon={<ReloadOutlined />} style={{ color: "#fff" }}
            onClick={checkActive} />
          <Button type="text" size="small" icon={<CloseOutlined />} style={{ color: "#fff" }}
            onClick={() => setOpen(false)} />
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {/* 倒计时 */}
        {remaining != null && remaining > 0 && (view === "vote" || view === "fill_blank" || view === "submitted") && (
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <Tag color="orange" style={{ fontSize: 16, padding: "4px 12px" }}>{formatTime(remaining)}</Tag>
          </div>
        )}

        {view === "idle" && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#999" }}>
            <ThunderboltOutlined style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 12 }} />
            <div>暂无进行中的活动</div>
          </div>
        )}

{/* VOTE VIEW */}
        {view === "vote" && activity && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{activity.title}</div>
            {activity.allow_multiple ? (
              <Checkbox.Group value={multiSelected} onChange={(v) => setMultiSelected(v as string[])} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(activity.options || []).map(opt => (
                  <Checkbox key={opt.key} value={opt.key} style={{ fontSize: 14 }}>
                    <Tag color="blue" style={{ marginRight: 6 }}>{opt.key}</Tag>{opt.text}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            ) : (
              <Radio.Group value={selectedAnswer} onChange={e => setSelectedAnswer(e.target.value)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(activity.options || []).map(opt => (
                  <Radio key={opt.key} value={opt.key} style={{ fontSize: 14 }}>
                    <Tag color="blue" style={{ marginRight: 6 }}>{opt.key}</Tag>{opt.text}
                  </Radio>
                ))}
              </Radio.Group>
            )}
            <Button type="primary" block style={{ marginTop: 20 }} onClick={handleSubmit} loading={submitting}>
              提交
            </Button>
          </div>
        )}

{/* FILL VIEW */}
        {view === "fill_blank" && activity && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{activity.title}</div>
            <Input.TextArea
              value={fillAnswer}
              onChange={e => setFillAnswer(e.target.value)}
              placeholder="请输入答案"
              rows={3}
              maxLength={500}
            />
            <Button type="primary" block style={{ marginTop: 16 }} onClick={handleSubmit} loading={submitting}>
              提交
            </Button>
          </div>
        )}

{/* SUBMITTED VIEW */}
        {view === "submitted" && activity && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 48, color: "#52c41a", marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>已提交</div>
            <div style={{ color: "#999", marginBottom: 4 }}>你的答案：{myAnswer}</div>
            <div style={{ color: "#999" }}>等待活动结束后查看结果...</div>
          </div>
        )}
{/* RESULT VIEW */}
        {view === "result" && activity && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{activity.title}</div>
            {/* 你的答案 */}
            <div style={{ padding: "12px 16px", background: isCorrect ? "#f6ffed" : "#fff2f0", borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "#999", marginBottom: 4 }}>你的答案</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: isCorrect ? "#52c41a" : "#ff4d4f" }}>
                {myAnswer || "未作答"} {isCorrect != null && (isCorrect ? " ✓ 正确" : " ✗ 错误")}
              </div>
              {activity.correct_answer && (
                <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>正确答案：{activity.correct_answer}</div>
              )}
            </div>
            {/* 统计 */}
            {stats && activity.activity_type === "vote" && stats.option_counts && activity.options && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>投票结果</div>
                {activity.options.map(opt => {
                  const count = stats.option_counts?.[opt.key] || 0;
                  const pct = stats.total_responses > 0 ? Math.round(count / stats.total_responses * 100) : 0;
                  const correct = activity.correct_answer?.includes(opt.key);
                  return (
                    <div key={opt.key} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: correct ? "#52c41a" : "#333" }}>{opt.key}. {opt.text}</span>
                        <span style={{ color: "#999" }}>{count} ({pct}%)</span>
                      </div>
                      <Progress percent={pct} showInfo={false} strokeColor={correct ? "#52c41a" : "#4096ff"} size="small" />
                    </div>
                  );
                })}
                <div style={{ textAlign: "center", color: "#999", fontSize: 12, marginTop: 8 }}>共 {stats.total_responses} 人参与</div>
              </div>
            )}
            {stats && activity.activity_type === "fill_blank" && stats.correct_rate != null && (
              <div style={{ textAlign: "center", padding: 16 }}>
                <Progress type="circle" percent={stats.correct_rate} size={80} />
                <div style={{ marginTop: 8, color: "#999", fontSize: 12 }}>班级正确率 · 共 {stats.total_responses} 人</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(<>{panel}</>, document.body);
};

export default ClassroomPanel;
