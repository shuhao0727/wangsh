/**
 * 新建任务分析 — 左右分栏布局
 * 左侧：任务单输入 | 右侧：配置 + 分析按钮
 */
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Search, CheckCircle2, AlertCircle } from "lucide-react";
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
  const [agentId, setAgentId] = useState("");
  const [startDate, setStartDate] = useState(now.subtract(7, "day").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(now.format("YYYY-MM-DD"));
  const [className, setClassName] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [partialResults, setPartialResults] = useState<string[]>([]);

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
        start_at: dayjs(startDate).startOf("day").toISOString(),
        end_at: dayjs(endDate).endOf("day").toISOString(),
        class_name: className.trim() || undefined,
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

        {/* Right: Config panel */}
        <div className="flex-[2] flex flex-col p-6 bg-surface-2">
          <div className="space-y-4 flex-1">
            <div className="text-sm font-medium text-text-secondary mb-4">分析配置</div>

            <div>
              <div className="mb-1.5 text-xs text-text-tertiary">智能体</div>
              <Select value={agentId || "__empty__"} onValueChange={(v) => setAgentId(v === "__empty__" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder={agents.length ? "选择智能体" : "加载中..."} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">请选择</SelectItem>
                  {agentOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
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

            <div className="pt-2 border-t border-border-secondary">
              <p className="text-xs text-text-tertiary leading-relaxed mb-4">
                系统将从智能体对话中提取学生提问，对比任务单内容，找出学生自发产生的新问题方向。
              </p>
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
