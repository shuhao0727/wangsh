import React from "react";
import dayjs from "dayjs";
import type { BeamRangeSelection } from "../types";
import { formatTimeRange } from "../normalize";

type ChainThoughtPath = {
  studentName: string;
  percentage: number;
  questions: NonNullable<BeamRangeSelection["questions"]>;
};

const ChainThoughtPathCard: React.FC<{
  chain: ChainThoughtPath;
  index: number;
  isEvidenceOnly: boolean;
}> = ({ chain, index, isEvidenceOnly }) => (
  <details className="group rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 px-5 py-4" open={index === 0}>
    <summary className="flex cursor-pointer select-none items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">#{index + 1}</span>
          <span className="font-semibold text-text-base">{chain.studentName}</span>
          {isEvidenceOnly && <span className="rounded-full border border-primary/20 bg-primary-soft/40 px-2 py-0.5 text-[11px] text-primary">旧记录证据链</span>}
        </div>
        <div className="mt-1 text-xs text-text-tertiary">
          {formatTimeRange(chain.questions[0]?.time, chain.questions[chain.questions.length - 1]?.time)} · {chain.questions.length} 个问题 · 占比 {chain.percentage}%
        </div>
      </div>
      <span className="shrink-0 text-xs text-text-tertiary group-open:hidden">展开思维链</span>
      <span className="hidden shrink-0 text-xs text-text-tertiary group-open:inline">收起</span>
    </summary>
    <div className="mt-3 space-y-3 border-t border-border-secondary pt-3">
      {chain.questions.map((question, questionIndex) => (
        <div key={`${question.chainId}-${question.time}-${questionIndex}`} className="grid gap-2 rounded-lg bg-surface-2 px-3 py-2.5 sm:grid-cols-[82px_1fr]">
          <div className="flex items-center gap-2 text-xs text-text-tertiary sm:block">
            <div className="font-semibold text-primary">{dayjs(question.time).format("HH:mm")}</div>
            <div className="mt-0.5">{question.relationLabel || "问题"}</div>
          </div>
          <div className="min-w-0">
            <div className="text-sm leading-relaxed text-text-base">{question.content}</div>
            {question.teacherQuestion && (
              <div className="mt-1 rounded-md border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning)]/8 px-2 py-1 text-xs leading-relaxed text-text-tertiary">
                关联教师主线：{question.teacherQuestion}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </details>
);

export default ChainThoughtPathCard;
