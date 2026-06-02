/**
 * 结构化教学建议面板 — 按优先级分组，支持展开详情、复制、标记
 */
import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check, Lightbulb, AlertTriangle, Info } from "lucide-react";

interface Suggestion {
  theme?: string;
  priority?: string;
  reason?: string;
  suggestion?: string;
}

interface EnrichedSuggestion {
  theme: string;
  suggestion: string;
  reason: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "content_gap" | "pacing" | "engagement" | "differentiation" | "general";
  actionType: string;
  icon: React.ReactNode;
  colorClass: string;
  borderClass: string;
}

const PRIORITY_MAP: Record<string, { order: number; icon: React.ReactNode; colorClass: string; borderClass: string }> = {
  critical: { order: 0, icon: <AlertTriangle className="h-4 w-4" />, colorClass: "text-[var(--ws-color-danger)] bg-[var(--ws-color-danger)]/8", borderClass: "border-l-[3px] border-[var(--ws-color-danger)]" },
  high: { order: 1, icon: <AlertTriangle className="h-4 w-4" />, colorClass: "text-[var(--ws-color-warning)] bg-[var(--ws-color-warning)]/8", borderClass: "border-l-[3px] border-[var(--ws-color-warning)]" },
  medium: { order: 2, icon: <Lightbulb className="h-4 w-4" />, colorClass: "text-primary bg-primary-soft/40", borderClass: "border-l-[3px] border-primary" },
  low: { order: 3, icon: <Info className="h-4 w-4" />, colorClass: "text-text-tertiary bg-surface-2", borderClass: "border-l-[3px] border-border-secondary" },
};

function inferPriority(suggestion: string, reason: string): "critical" | "high" | "medium" | "low" {
  const text = `${suggestion} ${reason}`.toLowerCase();
  if (/严重|关键|必须|紧急|立刻|马上|核心|根本/.test(text)) return "critical";
  if (/重要|优先|重点|集中|强烈|明显/.test(text)) return "high";
  if (/建议|考虑|可以|尝试|适当|次要/.test(text)) return "low";
  return "medium";
}

function inferCategory(suggestion: string, reason: string) {
  const text = `${suggestion} ${reason}`.toLowerCase();
  if (/节奏|时间|进度|安排|快|慢|拖延/.test(text)) return "pacing";
  if (/参与|互动|沉默|不活跃|注意力/.test(text)) return "engagement";
  if (/差异|分层|个别|困难|薄弱|基础/.test(text)) return "differentiation";
  if (/知识|概念|内容|理解|掌握|补|缺失|漏洞|盲点/.test(text)) return "content_gap";
  return "general";
}

function inferActionType(suggestion: string) {
  const text = suggestion.toLowerCase();
  if (/补充|添加|加入|加.*任务单|增加/.test(text)) return "add_to_task_sheet";
  if (/调整|节奏|时间|安排/.test(text)) return "adjust_pacing";
  if (/支架|脚手架|辅助|提示|引导/.test(text)) return "provide_scaffold";
  if (/练习|题目|习题|作业|训练/.test(text)) return "create_exercise";
  if (/复习|再次|回顾|重新/.test(text)) return "revisit_concept";
  return "add_to_task_sheet";
}

const ACTION_LABELS: Record<string, string> = {
  add_to_task_sheet: "补充到任务单",
  adjust_pacing: "调整教学节奏",
  provide_scaffold: "提供学习支架",
  create_exercise: "设计专项练习",
  revisit_concept: "回顾重讲概念",
};

const CATEGORY_LABELS: Record<string, string> = {
  content_gap: "内容缺口",
  pacing: "节奏调整",
  engagement: "参与互动",
  differentiation: "分层教学",
  general: "综合建议",
};

const SuggestionCard: React.FC<{
  item: EnrichedSuggestion;
  index: number;
  onCopy: (text: string) => void;
  copied: boolean;
}> = ({ item, index: _index, onCopy, copied }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border bg-surface px-4 py-3 shadow-sm transition-all ${item.borderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${item.colorClass}`}>
              {item.icon}
              {item.priority === "critical" ? "紧急" : item.priority === "high" ? "重要" : item.priority === "low" ? "参考" : "建议"}
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-tertiary">{CATEGORY_LABELS[item.category] || item.category}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-tertiary">{ACTION_LABELS[item.actionType] || item.actionType}</span>
          </div>
          <h3 className="text-sm font-semibold text-text-base">{item.theme}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onCopy(`${item.theme}：${item.suggestion}`)}
            className="rounded-md p-1 text-text-tertiary hover:bg-surface-2 hover:text-primary"
            title="复制到任务单"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[var(--ws-color-success)]" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md p-1 text-text-tertiary hover:bg-surface-2"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-text-secondary">{item.suggestion}</p>
      {expanded && item.reason && (
        <div className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-xs leading-relaxed text-text-tertiary">
          <span className="font-medium text-text-secondary">分析依据：</span>{item.reason}
        </div>
      )}
    </div>
  );
};

interface Props {
  suggestions: Suggestion[];
}

const TeachingSuggestionsPanel: React.FC<Props> = ({ suggestions }) => {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const enriched = useMemo(() => {
    return suggestions
      .map((s, i) => {
        const theme = s.theme || `建议 ${i + 1}`;
        const suggestion = s.suggestion || s.reason || "";
        const reason = s.reason || "";
        const priority = s.priority || inferPriority(suggestion, reason);
        const category = inferCategory(suggestion, reason);
        const actionType = inferActionType(suggestion);
        const meta = PRIORITY_MAP[priority] || PRIORITY_MAP.medium;
        return { theme, suggestion, reason, priority: priority as EnrichedSuggestion["priority"], category: category as EnrichedSuggestion["category"], actionType, icon: meta.icon, colorClass: meta.colorClass, borderClass: meta.borderClass };
      })
      .sort((a, b) => PRIORITY_MAP[a.priority].order - PRIORITY_MAP[b.priority].order);
  }, [suggestions]);

  const filtered = useMemo(() => {
    if (filter === "all") return enriched;
    return enriched.filter((s) => s.priority === filter);
  }, [enriched, filter]);

  const handleCopy = (text: string, _index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(_index);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  };

  if (suggestions.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-text-base">教学建议</h2>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", "critical", "high", "medium", "low"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              filter === key
                ? "bg-primary text-white"
                : "bg-surface-2 text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {key === "all" ? "全部" : key === "critical" ? "紧急" : key === "high" ? "重要" : key === "medium" ? "建议" : "参考"}
            {key !== "all" && (
              <span className="ml-1 opacity-70">
                {enriched.filter((s) => s.priority === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((item, index) => (
          <SuggestionCard
            key={`${item.theme}-${index}`}
            item={item}
            index={index}
            onCopy={(text) => handleCopy(text, index)}
            copied={copiedId === index}
          />
        ))}
      </div>
    </section>
  );
};

export default TeachingSuggestionsPanel;
