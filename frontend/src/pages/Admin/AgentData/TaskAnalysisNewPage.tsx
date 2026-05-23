/**
 * 新建任务分析 — 左右分栏布局
 * 左侧：任务单输入 | 右侧：配置 + 分析按钮
 */
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import dayjs from "dayjs";
import { agentDataApi } from "@services/znt/api";
import aiAgentsApi from "@services/znt/api/ai-agents-api";
import { showMessage } from "@/lib/toast";
import type { AIAgent } from "@services/znt/types";

const now = dayjs();
let _cache: AIAgent[] | null = null;
let _cacheAt = 0;

const TaskAnalysisNewPage: React.FC = () => {
  const [agents, setAgents] = useState<AIAgent[]>(_cache || []);
  useEffect(() => {
    if (_cache && Date.now() - _cacheAt < 60_000) { setAgents(_cache); return; }
    let c = false;
    void aiAgentsApi.getAgents().then((r: any) => {
      if (!c) { const items = r?.data?.items ?? []; _cache = items; _cacheAt = Date.now(); setAgents(items); }
    });
    return () => { c = true; };
  }, []);
  const agentOptions = useMemo(() => agents.map((a: any) => ({ label: a.agent_name || `智能体${a.id}`, value: String(a.id) })), [agents]);

  const [taskSheet, setTaskSheet] = useState("");
  const [agentId, setAgentId] = useState("");        // 数据来源：学生对话的智能体
  const [analysisAgentId, setAnalysisAgentId] = useState(""); // 分析工具：执行AI分析的智能体
  const [startDate, setStartDate] = useState(now.subtract(7, "day").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(now.format("YYYY-MM-DD"));
  const [className, setClassName] = useState("");
  const [bucketSeconds, setBucketSeconds] = useState(180);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [teacherMarks, setTeacherMarks] = useState<Array<{ time: string; question: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [partialResults, setPartialResults] = useState<string[]>([]);

  // 从使用记录自动填充时间范围
  const [recentActivity, setRecentActivity] = useState<{ lastAt?: string; firstAt?: string } | null>(null);
  useEffect(() => {
    if (!agentId) return;
    void agentDataApi.getHotQuestions?.({ agent_id: Number(agentId), bucket_seconds: 3600, top_n: 1 })
      .then((res: any) => {
        if (res?.data?.length > 0) {
          const buckets = res.data;
          const first = buckets[0]?.bucket_start;
          const last = buckets[buckets.length - 1]?.bucket_start;
          setRecentActivity({ firstAt: first, lastAt: last });
        }
      })
      .catch(() => {});
  }, [agentId]);

  const addTeacherMark = () => {
    setTeacherMarks((prev) => [...prev, { time: "", question: "" }]);
  };
  const removeTeacherMark = (index: number) => {
    setTeacherMarks((prev) => prev.filter((_, i) => i !== index));
  };
  const updateTeacherMark = (index: number, field: "time" | "question", value: string) => {
    setTeacherMarks((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  useEffect(() => { if (agentId || agentOptions.length === 0) return; setAgentId(agentOptions[0].value); }, [agentOptions, agentId]);

  const handleSave = async () => {
    if (!taskSheet.trim()) { showMessage.warning("请输入任务单内容"); return; }
    if (!agentId) { showMessage.warning("请选择智能体"); return; }
    setSaving(true);
    setProgress(0);
    setProgressSteps(["开始任务分析..."]);
    setPartialResults([]);

    try {
      const res = await agentDataApi.saveTaskAnalysisStream({
        title: taskSheet.trim().split("\n")[0].slice(0, 60),
        task_sheet: taskSheet,
        agent_id: Number(agentId),
        analysis_agent_id: analysisAgentId ? Number(analysisAgentId) : undefined,
        start_at: dayjs(startDate).startOf("day").toISOString(),
        end_at: dayjs(endDate).endOf("day").toISOString(),
        class_name: className.trim() || undefined,
        bucket_seconds: bucketSeconds,
        custom_prompt: customPrompt.trim() || undefined,
        teacher_marks: teacherMarks
          .filter((m) => m.time)
          .map((m) => ({
            time: dayjs(`${startDate} ${m.time}`).toISOString(),
            question: m.question,
          })),
      }, {
        onEvent: (event, payload) => {
          if (typeof payload.progress === "number") {
            setProgress(Math.max(0, Math.min(100, payload.progress)));
          }
          if (payload.message) {
            setProgressSteps((prev) => [...prev, payload.message as string]);
          }
          if (event === "partial_result" && payload.result) {
            const value = payload.result as any;
            if (value.question_count !== undefined) {
              setPartialResults((prev) => [...prev, `已提取 ${value.question_count} 条学生提问`]);
            } else if (Array.isArray(value.word_cloud)) {
              setPartialResults((prev) => [...prev, `词云已生成：${value.word_cloud.slice(0, 8).map((x: any) => x.word).filter(Boolean).join("、") || "暂无关键词"}`]);
            } else if (Array.isArray(value.covered) || Array.isArray(value.uncovered)) {
              setPartialResults((prev) => [...prev, `AI 对比完成：覆盖 ${value.covered?.length || 0} 类，未覆盖 ${value.uncovered?.length || 0} 类`]);
            }
          }
        },
      });
      if (!res.success) { showMessage.error(res.message || "分析失败"); setSaving(false); return; }
      const id = (res.data as any)?.id;
      setProgress(100);
      setProgressSteps((p) => [...p, "✓ 分析完成，正在跳转..."]);
      setTimeout(() => { window.location.href = `/task-analysis/${id}`; }, 600);
    } catch (e: any) {
      showMessage.error(e?.message || "分析失败");
      setSaving(false);
      setProgress(0);
      setProgressSteps([]);
      setPartialResults([]);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--ws-color-bg)]">
      {/* Header */}
      <header className="shrink-0 border-b border-border-secondary bg-surface px-6 py-3 flex items-center">
        <Button variant="ghost" size="sm" onClick={() => window.close()}>
          <ArrowLeft className="h-4 w-4 mr-1" />关闭
        </Button>
        <span className="ml-4 text-sm font-semibold">新建任务分析</span>
      </header>

      {/* Main: left-right split */}
      {saving ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-xl space-y-5 rounded-2xl border border-border-secondary bg-surface p-6 shadow-sm">
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <div className="text-sm font-medium">正在分析任务单</div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-text-tertiary">{progress}%</div>
            </div>

            <div className="space-y-2 max-h-44 overflow-auto rounded-lg bg-surface-2 p-3" aria-live="polite">
              {progressSteps.map((step, i) => (
                <div key={`${step}-${i}`} className="text-sm text-text-secondary animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {step}
                </div>
              ))}
            </div>

            {partialResults.length > 0 && (
              <div className="space-y-2" aria-live="polite">
                <div className="text-xs font-medium text-text-tertiary">已生成的阶段结果</div>
                {partialResults.map((item, i) => (
                  <div key={`${item}-${i}`} className="rounded-lg border border-border-secondary bg-surface px-3 py-2 text-sm text-text-secondary">
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="flex-1 flex min-h-0">
        {/* Left: Task sheet input */}
        <div className="flex-[3] border-r border-border-secondary flex flex-col p-6">
          <div className="mb-3 text-sm font-medium text-text-secondary">任务单内容</div>
          <textarea
            className="flex-1 w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--ws-color-focus-ring)]"
            placeholder={"粘贴任务单中的问题内容...\n\n例如：\n1. 编写一个 for 循环打印 1 到 10\n2. 用 if 判断奇偶数\n3. 定义一个函数计算阶乘\n4. 用 elif 判断成绩等级"}
            value={taskSheet}
            onChange={(e) => setTaskSheet(e.target.value)}
          />
          {taskSheet.trim() && (
            <div className="mt-2 text-xs text-text-tertiary text-right">{taskSheet.trim().length} 字</div>
          )}
        </div>

        {/* Middle: Teacher question marks */}
        <div className="flex-[2] border-r border-border-secondary flex flex-col p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-text-secondary">教师提问时间线</div>
            <Button variant="ghost" size="sm" onClick={addTeacherMark} className="text-xs h-7">+ 添加</Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {teacherMarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="text-3xl mb-2">📌</div>
                <div className="text-xs text-text-tertiary leading-relaxed">
                  标记你在课堂中的提问时间点<br/>
                  系统会分析学生在你提问后的反应
                </div>
                <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={addTeacherMark}>
                  + 添加第一个提问时间点
                </Button>
              </div>
            ) : (
              teacherMarks.map((mark, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-border-secondary bg-surface p-2.5">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <Input
                      type="time"
                      value={mark.time}
                      onChange={(e) => updateTeacherMark(i, "time", e.target.value)}
                      className="h-8 text-xs w-28"
                      placeholder="HH:mm"
                    />
                    <Input
                      value={mark.question}
                      onChange={(e) => updateTeacherMark(i, "question", e.target.value)}
                      className="h-8 text-xs"
                      placeholder="提问内容（可选）"
                    />
                  </div>
                  <button onClick={() => removeTeacherMark(i)} className="shrink-0 text-text-tertiary hover:text-red-500 text-xs mt-1">✕</button>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 text-[11px] text-text-tertiary leading-relaxed border-t border-border-secondary pt-2">
            💡 提示：标记你的提问时间，系统会分析学生在你提问后 3-5 分钟内的深入追问（生成性问题）
          </div>
        </div>

        {/* Right: Config panel */}
        <div className="flex-[2] flex flex-col p-6 bg-surface-2">
          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="text-sm font-medium text-text-secondary mb-4">分析配置</div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-text-secondary">🤖 分析对象（智能体）</div>
              <p className="mb-1.5 text-[11px] text-text-tertiary">学生和哪个智能体的对话记录</p>
              <Select value={agentId || "__empty__"} onValueChange={(v) => setAgentId(v === "__empty__" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder={agents.length ? "选择智能体" : "加载中..."} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">请选择</SelectItem>
                  {agentOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {!agentId && <div className="mt-1 text-[11px] text-amber-600">⚠ 请选择要分析哪个智能体的学生对话</div>}
              {agentId && recentActivity?.firstAt && (
                <div className="mt-1.5 text-[11px] text-text-tertiary">
                  📊 活动范围: {dayjs(recentActivity.firstAt).format("MM-DD")} ~ {dayjs(recentActivity.lastAt).format("MM-DD")}
                  <button
                    className="ml-2 text-primary hover:underline"
                    onClick={() => {
                      if (recentActivity.firstAt) setStartDate(dayjs(recentActivity.firstAt).format("YYYY-MM-DD"));
                      if (recentActivity.lastAt) setEndDate(dayjs(recentActivity.lastAt).format("YYYY-MM-DD"));
                    }}
                  >自动填充日期</button>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-text-secondary">🧠 分析用智能体</div>
              <p className="mb-1.5 text-[11px] text-text-tertiary">用哪个 AI 来执行分析（建议选能力强的模型）</p>
              <Select value={analysisAgentId || "__empty__"} onValueChange={(v) => setAnalysisAgentId(v === "__empty__" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="选择分析用智能体" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">请选择</SelectItem>
                  {agentOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {!analysisAgentId && agentId && <div className="mt-1 text-[11px] text-text-tertiary">不选则使用分析对象的同一智能体</div>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1.5 text-xs text-text-tertiary">开始日期</div>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
              </div>
              <div>
                <div className="mb-1.5 text-xs text-text-tertiary">结束日期</div>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs text-text-tertiary">班级（可选）</div>
              <Input placeholder="全部班级" value={className} onChange={(e) => setClassName(e.target.value)} className="h-9" />
            </div>

            <div>
              <div className="mb-1.5 text-xs text-text-tertiary">时间桶粒度（秒）</div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={60}
                  max={600}
                  step={30}
                  value={bucketSeconds}
                  onChange={(e) => setBucketSeconds(Math.max(60, Math.min(600, Number(e.target.value) || 180)))}
                  className="h-9 w-24"
                />
                <div className="flex gap-1">
                  {[60, 180, 300].map((v) => (
                    <button
                      key={v}
                      onClick={() => setBucketSeconds(v)}
                      className={`px-2 py-1 rounded text-[11px] border transition-colors ${bucketSeconds === v ? "bg-primary text-white border-primary" : "bg-surface border-border-secondary text-text-tertiary hover:border-primary/40"}`}
                    >{v / 60}分钟</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border-secondary pt-3">
              <button
                onClick={() => setShowPromptEditor(!showPromptEditor)}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-primary transition-colors"
              >
                <span>{showPromptEditor ? "▼" : "▶"}</span>
                <span>自定义 AI 分析提示词</span>
                {customPrompt && <span className="ml-1 text-primary">•</span>}
              </button>
              {showPromptEditor && (
                <div className="mt-2">
                  <textarea
                    className="w-full h-32 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--ws-color-focus-ring)]"
                    placeholder={"留空使用默认提示词。可自定义分析重点，例如：\n\n请重点关注学生在调试代码时遇到的困难，分析他们的错误类型分布。\n\n或：请对比学生提问与任务单的认知层级差异，重点标注创造性问题。"}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                  />
                  <div className="mt-1 text-[11px] text-text-tertiary">
                    {customPrompt ? `${customPrompt.length} 字` : "留空 = 使用系统默认分析策略"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
          <Button
            size="lg"
            className="w-full h-11"
            onClick={handleSave}
            disabled={saving || !taskSheet.trim() || !agentId}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            {saving ? "正在分析..." : "开始分析"}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
};

export default TaskAnalysisNewPage;
