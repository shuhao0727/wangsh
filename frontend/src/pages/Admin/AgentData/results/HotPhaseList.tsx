import { labelText, timeLabel, type HotPhase, type HotTimelineModel } from "./hotTimeline";

const RESPONSE_ORDER = ["clarify", "apply", "debug", "verify"];

/** 按教师提问分阶段：每个 Tn 之后，学生怎么回应，又生成了哪些教师没问过的问题。 */
export default function HotPhaseList({ phases, model }: { phases: HotPhase[]; model: HotTimelineModel }) {
  if (!phases.length) return null;
  return (
    <section aria-label="按教师提问分阶段" className="space-y-4 border-t border-border-secondary pt-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-text-base">按教师提问分阶段</h2>
        <p className="text-xs text-text-tertiary">每个阶段从教师提问开始，到下一个提问为止。生成性问题与本课有关、但不在回应任何教师提问，是观察学生思路的重点。</p>
      </div>
      <ol className="space-y-4">
        {phases.map((phase) => (
          <li key={`${phase.ref ?? "lead"}-${phase.start}`} className="rounded-md border border-border-secondary bg-surface p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-text-base">{phase.ref ?? "课前提问"}</span>
              <time className="text-xs tabular-nums text-text-tertiary">{timeLabel(phase.start)} – {timeLabel(phase.end)}</time>
            </div>
            {phase.question && <p className="mt-1 break-words text-sm text-text-secondary">{phase.question}</p>}
            {/* 课前提问没有教师提问与回应计数；整块不渲染，避免留下空行间距 */}
            {(phase.ref || phase.earlierResponses > 0 || phase.unrelated > 0) && <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-secondary">
              {phase.ref && <div className="flex gap-1.5"><dt>回应 {phase.ref}</dt><dd className="font-semibold tabular-nums text-primary">{phase.responseTotal} 条</dd></div>}
              {RESPONSE_ORDER.filter((key) => phase.responses[key]).map((key) => (
                <div key={key} className="flex gap-1.5"><dt>{model.subtypeLabels[key] || key}</dt><dd className="tabular-nums">{phase.responses[key]}</dd></div>
              ))}
              {phase.earlierResponses > 0 && <div className="flex gap-1.5"><dt>仍在回应更早的提问</dt><dd className="tabular-nums">{phase.earlierResponses}</dd></div>}
              {phase.unrelated > 0 && <div className="flex gap-1.5"><dt>无关</dt><dd className="tabular-nums">{phase.unrelated}</dd></div>}
            </dl>}
            <div className="mt-3">
              <h3 className="text-xs font-medium text-text-base">生成性问题 <span className="tabular-nums text-[var(--ws-color-accent)]">{phase.generative.length}</span></h3>
              {phase.generative.length ? (
                <ol className="mt-2 divide-y divide-border-secondary">
                  {phase.generative.map((event, index) => (
                    <li key={`${event.message_id ?? event.time}-${index}`} className="py-2 first:pt-0">
                      <div className="flex flex-wrap gap-x-3 text-xs text-text-tertiary">
                        <time className="tabular-nums">{timeLabel(event.time)}</time>
                        <span>{event.user_name || (event.student_id ? `学生 ${event.student_id}` : "学生信息未记录")}</span>
                        <span className="text-[var(--ws-color-accent)]">{labelText(event.label, model.subtypeLabels)}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text-base">{event.content || event.question}</p>
                      {event.label?.reason && <p className="mt-0.5 text-xs text-text-tertiary">判断依据：{event.label.reason}</p>}
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-1 text-xs text-text-tertiary">本阶段没有生成性问题。</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
