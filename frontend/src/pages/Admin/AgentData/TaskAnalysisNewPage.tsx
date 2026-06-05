/**
 * 新建任务分析 — 左右分栏布局
 * 左侧：任务单输入 | 右侧：配置 + 分析按钮
 */
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Search } from "lucide-react";
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

  const [taskSheet, setTaskSheet] = useState("");
  const [agentId, setAgentId] = useState("");        // 数据来源：学生对话的智能体
  const [analysisAgentId, setAnalysisAgentId] = useState(""); // 分析工具：执行AI分析的智能体
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

  // recent analyses for quick re-run
  const [recentAnalyses, setRecentAnalyses] = useState<Array<{ id: number; title: string; created_at: string; agent_id?: number }>>([]);
  useEffect(() => {
    void (isChain ? agentDataApi.listChainAnalyses() : agentDataApi.listHotAnalyses())
      .then((res: any) => {
        if (res.success) setRecentAnalyses((res.data || []).slice(0, 3));
      });
  }, [isChain]);

  // analysis goal refinements
  const [goalFlags, setGoalFlags] = useState<Record<string, boolean>>({
    uncover_new: true,
    track_deviation: true,
    suggest_task_sheet: true,
    compare_previous: false,
  });

  useEffect(() => {
    let cancelled = false;
    void agentDataApi.listAnalysisPromptTemplates(backendAnalysisType).then((res) => {
      if (cancelled || !res.success) return;
      const items = (res.data as PromptTemplate[]) || [];
      setPromptTemplates(items);
      const defaultTemplate = items.find((item) => item.is_default) || items[0];
      if (defaultTemplate) {
        setPromptTemplateId(String(defaultTemplate.id));
        setCustomPrompt(defaultTemplate.content);
      }
    });
    return () => { cancelled = true; };
  }, [backendAnalysisType]);

  // 从使用记录自动填充时间范围
  const [recentActivity, setRecentActivity] = useState<{ lastAt?: string; firstAt?: string } | null>(null);
  useEffect(() => {
    if (!agentId) return;
    void agentDataApi.analyzeHotQuestions({ agent_id: Number(agentId), bucket_seconds: 900, top_n: 1 })
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
  useEffect(() => { if (analysisAgentId || agentOptions.length === 0) return; setAnalysisAgentId(agentOptions[0].value); }, [agentOptions, analysisAgentId]);

  const handleSave = async () => {
    if (!isChain && !taskSheet.trim()) { showMessage.warning("请输入任务单内容"); return; }
    if (!agentId) { showMessage.warning("请选择数据来源智能体"); return; }
    if (!analysisAgentId) { showMessage.warning(`请选择${analysisAgentLabel}`); return; }
    setSaving(true);
    setProgress(0);
    setProgressSteps(["开始任务分析..."]);
    setPartialResults([]);

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
        teacher_marks: teacherMarks
          .filter((m) => m.time)
          .map((m) => ({
            time: dayjs(`${startDate} ${m.time}`).toISOString(),
            question: m.question,
          })),
      };
      const res = await (isChain
        ? agentDataApi.saveStudentChainAnalysisStream(basePayload, {
        onEvent: (event, payload) => {
          if (typeof payload.progress === "number") {
            setProgress(Math.max(0, Math.min(100, payload.progress)));
          }
          if (payload.message) {
            setProgressSteps((prev) => [...prev, payload.message as string]);
          }
          if (event === "partial_result" && payload.result) {
            const value = payload.result as any;
            if (value.chain_count !== undefined) {
              setPartialResults((prev) => [...prev, `已生成 ${value.chain_count} 条学生问题链，${value.teacher_anchor_count || 0} 个教师锚点`]);
            } else if (value.executive_summary) {
              setPartialResults((prev) => [...prev, `认知路径智能体摘要：${value.executive_summary}`]);
            } else if (value.analysis_agent_status === "skipped") {
              setPartialResults((prev) => [...prev, "认知路径智能体未完成调用，将保存基础结构化结果"]);
            }
          }
        },
      })
        : agentDataApi.saveHotQuestionAnalysisStream({
          ...basePayload,
          task_sheet: taskSheet.trim(),
          bucket_seconds: bucketSeconds,
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
            if (value.theme_count !== undefined) {
              setPartialResults((prev) => [...prev, `已生成 ${value.theme_count} 个热点主题，${value.teacher_anchor_count || 0} 个教师锚点`]);
            } else if (value.executive_summary) {
              setPartialResults((prev) => [...prev, `热点诊断智能体摘要：${value.executive_summary}`]);
            } else if (value.analysis_agent_status === "skipped") {
              setPartialResults((prev) => [...prev, "热点诊断智能体未完成调用，将保存基础结构化结果"]);
            }
          }
        },
      }));
      if (!res.success) { showMessage.error(res.message || "分析失败"); setSaving(false); return; }
      const id = (res.data as any)?.id;
      const view = (res.data as any)?.view || (isChain ? "beam" : "timeline");
      setProgress(100);
      setProgressSteps((p) => [...p, "✓ 分析完成，正在跳转..."]);
      setTimeout(() => { window.location.href = `/task-analysis/${id}?view=${view}&type=${analysisType}`; }, 600);
    } catch (e: any) {
      showMessage.error(e?.message || "分析失败");
      setSaving(false);
      setProgress(0);
      setProgressSteps([]);
      setPartialResults([]);
    }
  };

  const handleSaveTemplate = async () => {
    if (!customPrompt.trim()) { showMessage.warning("请先填写提示词内容"); return; }
    const name = window.prompt("模板名称", isChain ? "学生问题链自定义模板" : "热点问题自定义模板");
    if (!name?.trim()) return;
    const res = await agentDataApi.createAnalysisPromptTemplate({
      analysis_type: backendAnalysisType,
      name: name.trim(),
      content: customPrompt.trim(),
      is_active: true,
      is_default: false,
      sort_order: 100,
    });
    if (!res.success) { showMessage.error(res.message || "保存模板失败"); return; }
    showMessage.success("模板已保存");
    const next = await agentDataApi.listAnalysisPromptTemplates(backendAnalysisType);
    if (next.success) setPromptTemplates((next.data as PromptTemplate[]) || []);
  };

  const handleDeleteTemplate = async () => {
    if (!promptTemplateId) return;
    const template = promptTemplates.find((item) => String(item.id) === promptTemplateId);
    if (!template) return;
    if (!window.confirm(`确定删除提示词模板「${template.name}」？`)) return;
    const res = await agentDataApi.deleteAnalysisPromptTemplate(Number(promptTemplateId));
    if (!res.success) { showMessage.error(res.message || "删除模板失败"); return; }
    showMessage.success("模板已删除");
    const next = await agentDataApi.listAnalysisPromptTemplates(backendAnalysisType);
    if (next.success) {
      const items = (next.data as PromptTemplate[]) || [];
      setPromptTemplates(items);
      const fallback = items.find((item) => item.is_default) || items[0];
      setPromptTemplateId(fallback ? String(fallback.id) : "");
      setCustomPrompt(fallback?.content || "");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--ws-color-bg)]">
      {/* Header */}
      <header className="shrink-0 border-b border-border-secondary bg-surface/90 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => window.close()}>
          <ArrowLeft className="h-4 w-4 mr-1" />关闭
        </Button>
        <div className="h-5 w-px bg-border-secondary" />
        <div>
          <span className="text-sm font-semibold tracking-tight">{isChain ? "新建学生问题链分析" : "新建热点问题分析"}</span>
          <span className="ml-2 text-xs text-text-tertiary">
            {isChain ? "追踪每个学生的提问思考路径" : "识别课堂中最受关注的知识点"}
          </span>
        </div>
      </header>

      {/* Main: left-right split */}
      {saving ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-xl space-y-5 rounded-2xl border border-border-secondary bg-surface p-6 shadow-sm">
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <div className="text-sm font-medium">{isChain ? "正在分析学生问题链" : "正在分析课程热点问题"}</div>
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
      <div className="flex-1 overflow-y-auto bg-[var(--ws-color-bg)]">
        <div className="mx-auto max-w-7xl px-10 py-12">
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm ring-4 ring-primary/10">1</span>
            <div className="flex-1 h-px bg-border" />
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface border-2 border-border-secondary text-sm font-medium text-text-tertiary">2</span>
            <div className="flex-1 h-px bg-border" />
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface border-2 border-border-secondary text-sm font-medium text-text-tertiary">3</span>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Card 1: Task Sheet — spans 3 cols */}
            <div className="lg:col-span-3 rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 p-8 flex flex-col min-h-[400px]">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-text-base">{isChain ? "课程任务单" : "任务单内容"}</h2>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {isChain ? "帮助系统理解教学背景（可选）" : "粘贴本节课的问题列表，用于对比学生的自发提问"}
                  {!isChain && <span className="text-red-400 ml-1">*</span>}
                </p>
              </div>
              <textarea
                className="flex-1 w-full resize-none rounded-xl border border-border/60 bg-gray-50/50 px-4 py-3.5 text-sm leading-relaxed placeholder:text-text-tertiary/50 focus:outline-none focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all min-h-[200px]"
                placeholder={isChain
                  ? "粘贴本节课的任务单、教学目标或教师主问题..."
                  : "粘贴任务单中的问题内容...\n\n例如：\n1. 编写一个 for 循环打印 1 到 10\n2. 用 if 判断奇偶数\n3. 定义一个函数计算阶乘"}
                value={taskSheet}
                onChange={(e) => setTaskSheet(e.target.value)}
              />
              <div className="mt-2 text-[11px] text-text-tertiary text-right">{taskSheet.length} 字</div>
            </div>

            {/* Card 2: Quick-start & Goals — 2 cols */}
            <div className="lg:col-span-2 rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 p-8 flex flex-col">
              <h2 className="text-base font-semibold text-text-base mb-4">分析目标与基准</h2>

              {recentAnalyses.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-text-tertiary mb-2">基于最近结果重新分析</div>
                  {recentAnalyses.map((a) => (
                    <button key={a.id} onClick={() => window.open(`/task-analysis/${a.id}?view=${isChain ? "beam" : "timeline"}&type=${analysisType}`, "_blank")}
                      className="w-full text-left rounded-lg px-3 py-2 text-xs text-text-secondary hover:bg-primary-soft/30 transition-colors mb-1">
                      <span className="font-medium">{a.title}</span>
                      <span className="ml-2 text-text-tertiary/70">{dayjs(a.created_at).format("MM-DD")}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mb-4">
                <div className="text-xs font-medium text-text-tertiary mb-2">分析目标</div>
                {([{key:"uncover_new",label:"发现未覆盖的新问题方向"},{key:"track_deviation",label:"追踪偏离教师主线的趋势"},{key:"suggest_task_sheet",label:"生成可加入任务单的教学建议"},{key:"compare_previous",label:"与历史分析对比（需≥2次记录）"}] as const).map(({key,label})=>(
                  <label key={key} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input type="checkbox" checked={goalFlags[key]??false} onChange={e=>setGoalFlags(p=>({...p,[key]:e.target.checked}))} className="rounded border-gray-300 h-3.5 w-3.5 text-primary" />
                    <span className="text-xs text-text-secondary">{label}</span>
                  </label>
                ))}
              </div>

              {/* Teacher marks (moved here) */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-text-tertiary">教师提问标记</span>
                  <Button variant="ghost" size="sm" onClick={addTeacherMark} className="text-xs h-6 px-2">+ 添加</Button>
                </div>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {teacherMarks.length === 0 ? (
                    <p className="text-xs text-text-tertiary/60 italic">暂未标记。系统将自动识别 teacher/admin 的提问。</p>
                  ) : teacherMarks.map((mark, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border/40 bg-gray-50/50 px-2.5 py-1.5">
                      <span className="text-[10px] font-semibold text-text-tertiary w-4">{i + 1}</span>
                      <Input type="time" value={mark.time} onChange={e=>updateTeacherMark(i,"time",e.target.value)} className="h-7 text-xs w-24" placeholder="HH:mm" />
                      <Input value={mark.question} onChange={e=>updateTeacherMark(i,"question",e.target.value)} className="h-7 text-xs flex-1" placeholder="提问内容" />
                      <button onClick={()=>removeTeacherMark(i)} className="text-text-tertiary/40 hover:text-red-500 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 3: Config — full width bottom */}
            <div className="lg:col-span-5 rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 p-8">
              <h2 className="text-base font-semibold text-text-base mb-5">分析配置</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-text-secondary">数据来源智能体（学生对话）</label>
                  <Select value={agentId||"__empty__"} onValueChange={(v)=>setAgentId(v==="__empty__"?"":v)}>
                    <SelectTrigger className="mt-1.5 h-9"><SelectValue placeholder="选择智能体" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">请选择</SelectItem>
                      {agentOptions.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {agentId&&recentActivity?.firstAt&&(
                    <div className="mt-1 text-[11px] text-text-tertiary">活动: {dayjs(recentActivity.firstAt).format("MM-DD")}~{dayjs(recentActivity.lastAt).format("MM-DD")}
                      <button className="ml-1 text-primary hover:underline" onClick={()=>{if(recentActivity.firstAt)setStartDate(dayjs(recentActivity.firstAt).format("YYYY-MM-DD"));if(recentActivity.lastAt)setEndDate(dayjs(recentActivity.lastAt).format("YYYY-MM-DD"))}}>填充</button>
                    </div>
                  )}
                  <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">只负责读取该智能体下的课堂对话和学生提问记录。</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">{analysisAgentLabel}</label>
                  <Select value={analysisAgentId||"__empty__"} onValueChange={v=>setAnalysisAgentId(v==="__empty__"?"":v)}>
                    <SelectTrigger className="mt-1.5 h-9"><SelectValue placeholder="选择带 API Key 的智能体" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">请选择</SelectItem>
                      {agentOptions.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">{analysisAgentHelp}。</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">开始日期</label>
                  <Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="mt-1.5 h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">结束日期</label>
                  <Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="mt-1.5 h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">班级</label>
                  <Input placeholder="全部班级" value={className} onChange={e=>setClassName(e.target.value)} className="mt-1.5 h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">时间桶粒度</label>
                  <div className="mt-1.5 flex gap-1">
                    {[60,180,300].map(v=><button key={v} onClick={()=>setBucketSeconds(v)} className={`px-2.5 py-1 rounded text-xs border transition-colors ${bucketSeconds===v?"bg-primary text-white border-primary":"bg-white border-border text-text-tertiary hover:border-primary/30"}`}>{v/60}分钟</button>)}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">提示词模板</label>
                  <Select value={promptTemplateId||"__custom__"} onValueChange={v=>{if(v==="__custom__"){setPromptTemplateId("");return;}setPromptTemplateId(v);const t=promptTemplates.find(i=>String(i.id)===v);if(t)setCustomPrompt(t.content)}}>
                    <SelectTrigger className="mt-1.5 h-9"><SelectValue placeholder="选择模板" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom__">自定义</SelectItem>
                      {promptTemplates.map(t=><SelectItem key={t.id} value={String(t.id)}>{t.name}{t.is_default?"（默认）":""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {showPromptEditor && (
                <div className="mt-4">
                  <textarea className="w-full h-24 resize-none rounded-lg border border-border bg-gray-50/50 px-3 py-2 text-xs focus:outline-none focus:border-primary/40" placeholder="自定义 AI 分析提示词..." value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)} />
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSaveTemplate}>保存为模板</Button>
                    {promptTemplateId && <Button variant="ghost" size="sm" onClick={handleDeleteTemplate}>删除模板</Button>}
                  </div>
                </div>
              )}
              <button onClick={()=>setShowPromptEditor(!showPromptEditor)} className="mt-2 text-xs text-text-tertiary hover:text-primary">
                {showPromptEditor ? "收起 ▲" : "展开 ▼"} 自定义提示词 {customPrompt && "•"}
              </button>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 flex justify-center">
            <Button size="lg" className="h-12 px-10 text-base shadow-lg shadow-primary/20" onClick={handleSave} disabled={saving||(!isChain&&!taskSheet.trim())||!agentId||!analysisAgentId}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              {saving ? "正在分析..." : isChain ? "开始问题链分析" : "开始热点分析"}
            </Button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default TaskAnalysisNewPage;
