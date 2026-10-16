/**
 * 新建任务分析 — 四步向导
 * Step 1: 选择数据源 | Step 2: 上传教学设计 | Step 3: 配置 LLM 分析 | Step 4: 确认与执行
 */
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Search, Check, ChevronRight, ChevronLeft } from "lucide-react";
import dayjs from "dayjs";
import { agentDataApi } from "@services/znt/api";
import aiAgentsApi from "@services/znt/api/ai-agents-api";
import { showMessage } from "@/lib/toast";
import type { AIAgent } from "@services/znt/types";

type AnalysisType = "hot" | "chains";
type PromptTemplate = {
  id: number;
  analysis_type: "hot_questions" | "student_chains";
  name: string;
  content: string;
  is_default?: boolean;
};

const now = dayjs();
let _cache: AIAgent[] | null = null;
let _cacheAt = 0;

const STEP_LABELS = ["数据源", "教学设计", "LLM 配置", "确认分析"] as const;

const TaskAnalysisNewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const analysisType: AnalysisType = searchParams.get("type") === "chains" ? "chains" : "hot";
  const isChain = analysisType === "chains";
  const backendAnalysisType = isChain ? "student_chains" : "hot_questions";
  const analysisAgentLabel = isChain ? "光束图认知路径智能体" : "热点问题诊断智能体";
  const analysisAgentHelp = isChain
    ? "调用 API 生成学生轨迹、教师提问效果和分层干预方案"
    : "调用 API 生成主题根因、任务单盲区和可执行教学建议";
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

  // 向导步骤
  const [step, setStep] = useState(1);

  const [taskSheet, setTaskSheet] = useState("");
  const [agentId, setAgentId] = useState("");
  const [analysisAgentId, setAnalysisAgentId] = useState("");
  const [mergeThreshold, setMergeThreshold] = useState(0.30);
  const [startDate, setStartDate] = useState(now.subtract(7, "day").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(now.format("YYYY-MM-DD"));
  const [className, setClassName] = useState("");
  const [bucketSeconds, setBucketSeconds] = useState(180);
  const [customPrompt, setCustomPrompt] = useState("");
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [promptTemplateId, setPromptTemplateId] = useState("");
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [teacherMarks, setTeacherMarks] = useState<Array<{ time: string; question: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [partialResults, setPartialResults] = useState<string[]>([]);

  const [recentAnalyses, setRecentAnalyses] = useState<Array<{ id: number; title: string; created_at: string; agent_id?: number }>>([]);
  useEffect(() => {
    void (isChain ? agentDataApi.listChainAnalyses() : agentDataApi.listHotAnalyses())
      .then((res: any) => { if (res.success) setRecentAnalyses((res.data || []).slice(0, 3)); });
  }, [isChain]);

  const [goalFlags, setGoalFlags] = useState<Record<string, boolean>>({
    uncover_new: true, track_deviation: true, suggest_task_sheet: true, compare_previous: false,
  });

  useEffect(() => {
    let cancelled = false;
    void agentDataApi.listAnalysisPromptTemplates(backendAnalysisType).then((res) => {
      if (cancelled || !res.success) return;
      const items = (res.data as PromptTemplate[]) || [];
      setPromptTemplates(items);
      const def = items.find((i) => i.is_default) || items[0];
      if (def) { setPromptTemplateId(String(def.id)); setCustomPrompt(def.content); }
    });
    return () => { cancelled = true; };
  }, [backendAnalysisType]);

  const [recentActivity, setRecentActivity] = useState<{ lastAt?: string; firstAt?: string } | null>(null);
  useEffect(() => {
    if (!agentId) return;
    void agentDataApi.analyzeHotQuestions({ agent_id: Number(agentId), bucket_seconds: 900, top_n: 1 })
      .then((res: any) => {
        if (res?.data?.length > 0) {
          const b = res.data;
          setRecentActivity({ firstAt: b[0]?.bucket_start, lastAt: b[b.length - 1]?.bucket_start });
        }
      }).catch(() => {});
  }, [agentId]);

  const addTeacherMark = () => setTeacherMarks((p) => [...p, { time: "", question: "" }]);
  const removeTeacherMark = (i: number) => setTeacherMarks((p) => p.filter((_, idx) => idx !== i));
  const updateTeacherMark = (i: number, field: "time" | "question", v: string) => setTeacherMarks((p) => p.map((m, idx) => idx === i ? { ...m, [field]: v } : m));

  useEffect(() => { if (agentId || agentOptions.length === 0) return; setAgentId(agentOptions[0].value); }, [agentOptions, agentId]);
  useEffect(() => { if (analysisAgentId || agentOptions.length === 0) return; setAnalysisAgentId(agentOptions[0].value); }, [agentOptions, analysisAgentId]);

  const handleSave = async () => {
    if (!isChain && !taskSheet.trim()) { showMessage.warning("请输入任务单内容"); return; }
    if (!agentId) { showMessage.warning("请选择数据来源智能体"); return; }
    if (!analysisAgentId) { showMessage.warning(`请选择${analysisAgentLabel}`); return; }
    setSaving(true); setProgress(0); setProgressSteps(["开始任务分析..."]); setPartialResults([]);
    try {
      const basePayload = {
        title: (taskSheet.trim().split("\n")[0] || (isChain ? "学生问题链分析" : "热点问题分析")).slice(0, 60),
        task_sheet: taskSheet.trim() || undefined,
        agent_id: Number(agentId),
        analysis_agent_id: analysisAgentId ? Number(analysisAgentId) : undefined,
        start_at: dayjs(startDate).startOf("day").toISOString(),
        end_at: dayjs(endDate).endOf("day").toISOString(),
        class_name: className.trim() || undefined,
        custom_prompt: customPrompt.trim() || undefined,
        prompt_template_id: promptTemplateId ? Number(promptTemplateId) : undefined,
        teacher_marks: teacherMarks.filter((m) => m.time).map((m) => ({ time: dayjs(`${startDate} ${m.time}`).toISOString(), question: m.question })),
        merge_threshold: mergeThreshold,
      };
      const onEvent = (event: string, payload: any) => {
        if (typeof payload.progress === "number") setProgress(Math.max(0, Math.min(100, payload.progress)));
        if (payload.message) setProgressSteps((p) => [...p, payload.message as string]);
        if (event === "partial_result" && payload.result) {
          const v = payload.result as any;
          if (v.theme_count !== undefined) setPartialResults((p) => [...p, `已生成 ${v.theme_count} 个热点主题`]);
          else if (v.chain_count !== undefined) setPartialResults((p) => [...p, `已生成 ${v.chain_count} 条学生问题链`]);
          else if (v.executive_summary) setPartialResults((p) => [...p, `摘要：${v.executive_summary}`]);
          else if (v.analysis_agent_status === "skipped") setPartialResults((p) => [...p, "深度分析未完成，保存基础结果"]);
        }
      };
      const res = await (isChain
        ? agentDataApi.saveStudentChainAnalysisStream(basePayload, { onEvent })
        : agentDataApi.saveHotQuestionAnalysisStream({ ...basePayload, task_sheet: taskSheet.trim(), bucket_seconds: bucketSeconds }, { onEvent }));
      if (!res.success) { showMessage.error(res.message || "分析失败"); setSaving(false); return; }
      const id = (res.data as any)?.id;
      const view = (res.data as any)?.view || (isChain ? "beam" : "timeline");
      setProgress(100); setProgressSteps((p) => [...p, "✓ 分析完成，正在跳转..."]);
      setTimeout(() => { window.location.href = `/task-analysis/${id}?view=${view}&type=${analysisType}`; }, 600);
    } catch (e: any) {
      showMessage.error(e?.message || "分析失败"); setSaving(false); setProgress(0); setProgressSteps([]); setPartialResults([]);
    }
  };

  const handleSaveTemplate = async () => {
    if (!customPrompt.trim()) { showMessage.warning("请先填写提示词内容"); return; }
    const name = window.prompt("模板名称", isChain ? "学生问题链自定义模板" : "热点问题自定义模板");
    if (!name?.trim()) return;
    const res = await agentDataApi.createAnalysisPromptTemplate({ analysis_type: backendAnalysisType, name: name.trim(), content: customPrompt.trim(), is_active: true, is_default: false, sort_order: 100 });
    if (!res.success) { showMessage.error(res.message || "保存模板失败"); return; }
    showMessage.success("模板已保存");
    const next = await agentDataApi.listAnalysisPromptTemplates(backendAnalysisType);
    if (next.success) setPromptTemplates((next.data as PromptTemplate[]) || []);
  };

  const handleDeleteTemplate = async () => {
    if (!promptTemplateId) return;
    const t = promptTemplates.find((i) => String(i.id) === promptTemplateId);
    if (!t || !window.confirm(`确定删除提示词模板「${t.name}」？`)) return;
    const res = await agentDataApi.deleteAnalysisPromptTemplate(Number(promptTemplateId));
    if (!res.success) { showMessage.error(res.message || "删除模板失败"); return; }
    showMessage.success("模板已删除");
    const next = await agentDataApi.listAnalysisPromptTemplates(backendAnalysisType);
    if (next.success) {
      const items = (next.data as PromptTemplate[]) || [];
      setPromptTemplates(items);
      const fb = items.find((i) => i.is_default) || items[0];
      setPromptTemplateId(fb ? String(fb.id) : ""); setCustomPrompt(fb?.content || "");
    }
  };

  const validateStep = (s: number): boolean => {
    if (s === 1 && !agentId) { showMessage.warning("请选择数据来源智能体"); return false; }
    if (s === 2 && !isChain && !taskSheet.trim()) { showMessage.warning("请输入任务单内容"); return false; }
    if (s === 3 && !analysisAgentId) { showMessage.warning(`请选择${analysisAgentLabel}`); return false; }
    return true;
  };
  const goNext = () => { if (validateStep(step)) setStep((s) => Math.min(s + 1, 4)); };
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

  // 当前选中的智能体名称
  const selectedAgentName = agentOptions.find((o) => o.value === agentId)?.label || "未选择";
  const selectedAnalysisAgentName = agentOptions.find((o) => o.value === analysisAgentId)?.label || "未选择";

  return (
    <div className="h-screen flex flex-col bg-[var(--ws-color-bg)]">
      {/* Header */}
      <header className="shrink-0 border-b border-border-secondary bg-surface/90 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => window.close()}><ArrowLeft className="h-4 w-4 mr-1" />关闭</Button>
        <div className="h-5 w-px bg-border-secondary" />
        <span className="text-sm font-semibold">{isChain ? "新建学生问题链分析" : "新建热点问题分析"}</span>
      </header>

      {saving ? (
        /* 分析进度 */
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-xl space-y-5 rounded-2xl border border-border-secondary bg-surface p-6 shadow-sm">
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <div className="text-sm font-medium">{isChain ? "正在分析学生问题链" : "正在分析课程热点问题"}</div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} /></div>
              <div className="text-xs text-text-tertiary">{progress}%</div>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-auto rounded-lg bg-surface-2 p-3">
              {progressSteps.map((s, i) => <div key={i} className="text-sm text-text-secondary">{s}</div>)}
            </div>
            {partialResults.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-text-tertiary">阶段结果</div>
                {partialResults.map((r, i) => <div key={i} className="rounded-lg border border-border-secondary bg-surface px-3 py-2 text-sm text-text-secondary">{r}</div>)}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-10">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-8">
              {STEP_LABELS.map((label, i) => {
                const s = i + 1;
                const done = s < step;
                const active = s === step;
                return (
                  <React.Fragment key={label}>
                    {i > 0 && <div className={`flex-1 h-px ${done ? "bg-primary" : "bg-border"}`} />}
                    <button onClick={() => { if (done) setStep(s); }} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${active ? "bg-primary text-white shadow-sm" : done ? "bg-primary-soft text-primary cursor-pointer" : "bg-surface-2 text-text-tertiary"}`}>
                      {done ? <Check className="h-3 w-3" /> : <span>{s}</span>}
                      <span>{label}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Step 1: 数据源 */}
            {step === 1 && (
              <div className="space-y-5 rounded-2xl border border-border/40 bg-surface p-6">
                <h2 className="text-base font-semibold">选择数据源</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-text-secondary">数据来源智能体</label>
                    <Select value={agentId || "__empty__"} onValueChange={(v) => setAgentId(v === "__empty__" ? "" : v)}>
                      <SelectTrigger className="mt-1.5 h-9"><SelectValue placeholder="选择智能体" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">请选择</SelectItem>
                        {agentOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {agentId && recentActivity?.firstAt && (
                      <div className="mt-1 text-[11px] text-text-tertiary">
                        活动: {dayjs(recentActivity.firstAt).format("MM-DD")}~{dayjs(recentActivity.lastAt).format("MM-DD")}
                        <button className="ml-1 text-primary hover:underline" onClick={() => { if (recentActivity.firstAt) setStartDate(dayjs(recentActivity.firstAt).format("YYYY-MM-DD")); if (recentActivity.lastAt) setEndDate(dayjs(recentActivity.lastAt).format("YYYY-MM-DD")); }}>填充</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">班级（可选）</label>
                    <Input placeholder="全部班级" value={className} onChange={(e) => setClassName(e.target.value)} className="mt-1.5 h-9" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">开始日期</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 h-9" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">结束日期</label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 h-9" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">时间桶粒度</label>
                  <div className="mt-1.5 flex gap-1.5">
                    {[60, 180, 300].map((v) => <button key={v} onClick={() => setBucketSeconds(v)} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${bucketSeconds === v ? "bg-primary text-white border-primary" : "bg-surface border-border text-text-tertiary hover:border-primary/30"}`}>{v / 60} 分钟</button>)}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: 教学设计 */}
            {step === 2 && (
              <div className="space-y-5 rounded-2xl border border-border/40 bg-surface p-6">
                <h2 className="text-base font-semibold">上传教学设计</h2>
                <div>
                  <label className="text-xs font-medium text-text-secondary">{isChain ? "课程任务单（可选）" : "任务单内容"}{!isChain && <span className="text-red-400 ml-1">*</span>}</label>
                  <textarea
                    className="mt-1.5 w-full min-h-[200px] resize-none rounded-xl border border-border/60 bg-surface-2/30 px-4 py-3 text-sm leading-relaxed placeholder:text-text-tertiary/50 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/5"
                    placeholder={isChain ? "粘贴任务单、教学目标或教师主问题..." : "粘贴任务单中的问题内容...\n\n例如：\n1. 编写一个 for 循环打印 1 到 10\n2. 用 if 判断奇偶数"}
                    value={taskSheet} onChange={(e) => setTaskSheet(e.target.value)}
                  />
                  <div className="mt-1 text-right text-[11px] text-text-tertiary">{taskSheet.length} 字</div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-text-secondary">教师提问标记</span>
                    <Button variant="ghost" size="sm" onClick={addTeacherMark} className="text-xs h-6 px-2">+ 添加</Button>
                  </div>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {teacherMarks.length === 0 ? (
                      <p className="text-xs text-text-tertiary/60 italic">暂未标记。系统将自动识别 teacher 的提问。</p>
                    ) : teacherMarks.map((mark, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-border/40 bg-surface-2/30 px-2.5 py-1.5">
                        <span className="text-[10px] font-semibold text-text-tertiary w-4">{i + 1}</span>
                        <Input type="time" value={mark.time} onChange={(e) => updateTeacherMark(i, "time", e.target.value)} className="h-7 text-xs w-24" />
                        <Input value={mark.question} onChange={(e) => updateTeacherMark(i, "question", e.target.value)} className="h-7 text-xs flex-1" placeholder="提问内容" />
                        <button onClick={() => removeTeacherMark(i)} className="text-text-tertiary/40 hover:text-red-500 text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: LLM 配置 */}
            {step === 3 && (
              <div className="space-y-5 rounded-2xl border border-border/40 bg-surface p-6">
                <h2 className="text-base font-semibold">配置 LLM 分析</h2>
                <div>
                  <label className="text-xs font-medium text-text-secondary">{analysisAgentLabel}</label>
                  <Select value={analysisAgentId || "__empty__"} onValueChange={(v) => setAnalysisAgentId(v === "__empty__" ? "" : v)}>
                    <SelectTrigger className="mt-1.5 h-9"><SelectValue placeholder="选择带 API Key 的智能体" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">请选择</SelectItem>
                      {agentOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-text-tertiary">{analysisAgentHelp}</p>
                </div>
                <div>
                  <div className="text-xs font-medium text-text-secondary mb-2">分析目标</div>
                  {([{ key: "uncover_new", label: "发现未覆盖的新问题方向" }, { key: "track_deviation", label: "追踪偏离教师主线的趋势" }, { key: "suggest_task_sheet", label: "生成可加入任务单的教学建议" }, { key: "compare_previous", label: "与历史分析对比" }] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 py-1 cursor-pointer">
                      <input type="checkbox" checked={goalFlags[key] ?? false} onChange={(e) => setGoalFlags((p) => ({ ...p, [key]: e.target.checked }))} className="rounded border-gray-300 h-3.5 w-3.5 text-primary" />
                      <span className="text-xs text-text-secondary">{label}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">合并灵敏度</label>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">越低越容易合并相似问题（宽松），越高越严格</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-[11px] text-text-tertiary">宽松</span>
                    <input type="range" min={0.20} max={0.50} step={0.05} value={mergeThreshold} onChange={(e) => setMergeThreshold(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary" />
                    <span className="text-[11px] text-text-tertiary">严格</span>
                    <span className="min-w-[3rem] rounded-md border border-border bg-surface-2 px-2 py-0.5 text-center text-xs font-mono font-medium text-text-base">{mergeThreshold.toFixed(2)}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">提示词模板</label>
                  <Select value={promptTemplateId || "__custom__"} onValueChange={(v) => { if (v === "__custom__") { setPromptTemplateId(""); return; } setPromptTemplateId(v); const t = promptTemplates.find((i) => String(i.id) === v); if (t) setCustomPrompt(t.content); }}>
                    <SelectTrigger className="mt-1.5 h-9"><SelectValue placeholder="选择模板" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom__">自定义</SelectItem>
                      {promptTemplates.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}{t.is_default ? "（默认）" : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <button onClick={() => setShowPromptEditor(!showPromptEditor)} className="text-xs text-text-tertiary hover:text-primary">
                    {showPromptEditor ? "收起 ▲" : "展开 ▼"} 自定义提示词
                  </button>
                  {showPromptEditor && (
                    <div className="mt-2">
                      <textarea className="w-full h-28 resize-none rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-xs focus:outline-none focus:border-primary/40" placeholder="自定义 AI 分析提示词..." value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} />
                      <div className="mt-2 flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleSaveTemplate}>保存为模板</Button>
                        {promptTemplateId && <Button variant="ghost" size="sm" onClick={handleDeleteTemplate}>删除模板</Button>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: 确认 */}
            {step === 4 && (
              <div className="space-y-5 rounded-2xl border border-border/40 bg-surface p-6">
                <h2 className="text-base font-semibold">确认分析配置</h2>
                <div className="grid gap-3 text-sm">
                  {[
                    { label: "数据源智能体", value: selectedAgentName },
                    { label: "时间范围", value: `${startDate} ~ ${endDate}` },
                    { label: "班级", value: className || "全部" },
                    { label: "时间桶粒度", value: `${bucketSeconds / 60} 分钟` },
                    { label: "任务单", value: taskSheet ? `${taskSheet.length} 字` : "未填写" },
                    { label: "教师提问标记", value: `${teacherMarks.filter((m) => m.time).length} 个` },
                    { label: "分析智能体", value: selectedAnalysisAgentName },
                    { label: "提示词", value: promptTemplateId ? (promptTemplates.find((t) => String(t.id) === promptTemplateId)?.name || "自定义") : "自定义" },
                    { label: "合并灵敏度", value: mergeThreshold.toFixed(2) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-text-tertiary">{label}</span>
                      <span className="font-medium text-text-base">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between">
              {step > 1 ? (
                <Button variant="outline" onClick={goPrev}><ChevronLeft className="h-4 w-4 mr-1" />上一步</Button>
              ) : <div />}
              {step < 4 ? (
                <Button onClick={goNext}>下一步<ChevronRight className="h-4 w-4 ml-1" /></Button>
              ) : (
                <Button size="lg" className="px-8 shadow-lg shadow-primary/20" onClick={handleSave}>
                  <Search className="h-4 w-4 mr-2" />{isChain ? "开始问题链分析" : "开始热点分析"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskAnalysisNewPage;
