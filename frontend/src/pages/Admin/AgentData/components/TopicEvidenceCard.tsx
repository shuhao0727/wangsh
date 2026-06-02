import React from "react";
import { MessageSquare } from "lucide-react";
import type { TopicItem } from "../types";

const TopicEvidenceCard: React.FC<{ item: TopicItem; index: number }> = ({ item, index }) => (
  <div className="rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 px-5 py-4 transition-all hover:border-[var(--ws-color-warning)]/40 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ws-color-warning-soft)] text-xs font-semibold text-[var(--ws-color-warning)]">{index + 1}</span>
          <h3 className="min-w-0 break-words text-base font-semibold leading-snug text-text-base">{item.topic}</h3>
        </div>
        <p className="text-xs text-text-tertiary">任务单之外的学生自发问题方向，建议补充到后续任务设计中。</p>
      </div>
      <span className="shrink-0 rounded-full bg-[var(--ws-color-warning-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--ws-color-warning)]">{item.count} 次</span>
    </div>
    {(item.questions || [])[0] && (
      <div className="mt-2 flex gap-2 rounded-lg bg-surface-2/80 px-3 py-2 text-sm leading-relaxed text-text-secondary">
        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span className="whitespace-pre-wrap break-words">{item.questions?.[0]}</span>
      </div>
    )}
  </div>
);

export default TopicEvidenceCard;
