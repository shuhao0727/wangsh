import React from "react";
import { Clock, MessageSquare, ChevronRight } from "lucide-react";
import type { ChainSummary } from "../types";
import { formatTimeRange } from "../normalize";

const ChainCard: React.FC<{ chain: ChainSummary; index: number }> = ({ chain, index }) => {
  const visibleQuestions = chain.questions.slice(0, 3);
  const hiddenCount = Math.max(chain.questions.length - visibleQuestions.length, 0);
  return (
    <div className="rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 px-5 py-4 transition-all hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{index + 1}</span>
            <h3 className="font-semibold text-text-base">{chain.studentName}</h3>
            {chain.className && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-tertiary">{chain.className}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTimeRange(chain.startAt, chain.endAt)}</span>
            <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{chain.questionCount} 个问题</span>
          </div>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">流程摘要</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {visibleQuestions.map((question, qIndex) => (
          <React.Fragment key={`${question.created_at}-${qIndex}`}>
            <span className="max-w-[220px] truncate rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-text-secondary" title={question.content}>{question.content}</span>
            {qIndex < visibleQuestions.length - 1 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />}
          </React.Fragment>
        ))}
        {hiddenCount > 0 && <span className="rounded-full border border-dashed border-border-secondary px-2 py-1 text-xs text-text-tertiary">+{hiddenCount}</span>}
      </div>
    </div>
  );
};

export default ChainCard;
