import React from "react";
import { ChevronRight, MessageSquare } from "lucide-react";

type MainQuestionChainItem = {
  stage: string;
  question: string;
  reason?: string;
  evidence?: string[];
};

interface Props {
  items: MainQuestionChainItem[];
}

const MainQuestionChainFlow: React.FC<Props> = ({ items }) => (
  <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-text-base">AI 主问题链</h2>
        <p className="mt-1 text-sm text-text-tertiary">AI 在分析阶段总结出的全班问题递进主线，下面用真实代表问题做证据。</p>
      </div>
      <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{items.length} 个阶段</span>
    </div>
    {items.length > 0 ? (
      <div className="flex flex-col gap-3 overflow-x-auto pb-2 lg:flex-row lg:items-stretch lg:gap-4">
        {items.map((item, index) => (
          <div key={`${item.stage}-${index}`} className="group relative flex w-full flex-col rounded-xl border border-border-secondary bg-surface-2 px-4 py-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md lg:min-w-[280px] lg:max-w-[340px] lg:flex-1">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex shrink-0 flex-col items-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white shadow-sm ring-4 ring-primary-soft">{index + 1}</span>
                {index < items.length - 1 && <span className="mt-2 h-8 w-px bg-border-secondary lg:hidden" />}
                {index < items.length - 1 && <ChevronRight className="mt-2 hidden h-4 w-4 text-text-tertiary lg:block" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{item.stage}</span>
                <h3 className="mt-2 text-sm font-semibold leading-relaxed text-text-base">{item.question}</h3>
              </div>
            </div>
            {item.reason && <p className="mt-2 text-xs leading-relaxed text-text-tertiary">{item.reason}</p>}
            {(item.evidence || []).length > 0 && (
              <div className="mt-3 space-y-1.5">
                {(item.evidence || []).slice(0, 2).map((evidence, eIndex) => (
                  <div key={`${evidence}-${eIndex}`} className="flex gap-2 rounded-lg border border-border-secondary bg-surface px-2.5 py-1.5 text-xs leading-relaxed text-text-secondary">
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="break-words">{evidence}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    ) : (
      <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed border-border-secondary text-sm text-text-tertiary">暂无 AI 主问题链</div>
    )}
  </section>
);

export default MainQuestionChainFlow;
