import { DIMENSIONS, LABELS, type KnnLabel } from "@/services/knn";

export type Draft = { number: string; features: (number | null)[]; label: KnnLabel | ""; consent: boolean };
// 按教学设计只采集六类运动的每周参与天数，不再采集喜欢程度。
export const emptyDraft = (): Draft => ({ number: "", features: Array(6).fill(null), label: "", consent: false });

export function SurveyFields({ draft, change }: { draft: Draft; change: (draft: Draft) => void }) {
  const choose = (index: number, value: number) => {
    const features = [...draft.features]; features[index] = value;
    change({ ...draft, features });
  };
  return <>
    <div className="mb-3">
      <h2 className="text-base font-semibold">近一周运动习惯</h2>
      <p className="mt-1 text-sm text-text-secondary">按顺序填写六类运动在过去 7 天的参与天数。</p>
    </div>
    <div className="divide-y divide-border-secondary border-y border-border-secondary">
      {DIMENSIONS.map(([name, examples], i) => <div key={name} className="grid gap-4 py-5 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
        <div className="md:pt-1"><h3 className="text-sm font-semibold">{name}</h3><p className="mt-1 text-xs leading-5 text-text-secondary">{examples}</p></div>
        <div className="min-w-0">
          <fieldset aria-label={`${name}参与天数`} className="min-w-0">
            <legend className="mb-1.5 text-xs text-text-secondary">一周参与天数</legend>
            <div className="grid grid-cols-8 gap-1 sm:gap-1.5">
              {Array.from({ length: 8 }, (_, n) => String(n)).map(label => <label key={label} className="relative min-w-0 cursor-pointer">
                <input type="radio" name={`knn-feature-${i}`} value={label} aria-label={`${name} ${label} 天`}
                  checked={draft.features[i] === Number(label)} onChange={() => choose(i, Number(label))} className="peer sr-only" />
                <span className="flex h-10 items-center justify-center rounded-sm border border-border-secondary bg-surface px-1 text-center text-sm leading-4 text-text-secondary tabular-nums transition-colors hover:border-primary/50 hover:bg-primary-soft peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:font-medium peer-checked:text-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                  {label}
                </span>
              </label>)}
            </div>
          </fieldset>
        </div>
      </div>)}
    </div>
    <fieldset className="mt-6">
      <legend className="text-base font-semibold">你最想参加哪类运动？</legend>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LABELS.map(label => <label key={label} className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-3 text-sm ${draft.label === label ? "border-primary bg-primary-soft text-primary" : "border-border-secondary"}`}>
          <input type="radio" name="knn-label" value={label} checked={draft.label === label} onChange={() => change({ ...draft, label })} className="accent-primary" />{label}
        </label>)}
      </div>
    </fieldset>
  </>;
}

export function AnswerSummary({ features, label }: { features: (number | null)[]; label: string }) {
  return <dl className="divide-y divide-border-secondary text-sm">
    {DIMENSIONS.map(([name], i) => <div key={name} className="flex flex-wrap justify-between gap-2 py-2.5">
      <dt className="text-text-secondary">{name}</dt><dd className="tabular-nums">{features[i] ?? "—"} 天</dd>
    </div>)}
    <div className="flex justify-between gap-2 py-3"><dt className="text-text-secondary">报名类别</dt><dd className="font-medium text-primary">{label}</dd></div>
  </dl>;
}
