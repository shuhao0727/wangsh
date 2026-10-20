import { DIMENSIONS, LABELS, LIKING, type KnnLabel } from "@/services/knn";

export type Draft = { number: string; features: (number | null)[]; label: KnnLabel | ""; consent: boolean };
export const emptyDraft = (): Draft => ({ number: "", features: Array(12).fill(null), label: "", consent: false });

export function SurveyFields({ draft, change }: { draft: Draft; change: (draft: Draft) => void }) {
  const choose = (index: number, value: number) => {
    const features = [...draft.features]; features[index] = value;
    change({ ...draft, features });
  };
  return <>
    <div className="mb-3">
      <h2 className="text-base font-semibold">近一周运动习惯</h2>
      <p className="mt-1 text-sm text-text-secondary">填写过去 7 天的参与天数，以及你对这类活动的喜欢程度。</p>
    </div>
    <div className="divide-y divide-border-secondary border-y border-border-secondary">
      {DIMENSIONS.map(([name, examples], i) => <div key={name} className="grid gap-4 py-5 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
        <div className="md:pt-1"><h3 className="text-sm font-semibold">{name}</h3><p className="mt-1 text-xs leading-5 text-text-secondary">{examples}</p></div>
        <div className="min-w-0 space-y-3">
          {[0, 1].map(offset => <fieldset key={offset} aria-label={`${name}${offset === 0 ? "参与天数" : "喜欢程度"}`} className="min-w-0">
            <legend className="mb-1.5 text-xs text-text-secondary">{offset === 0 ? "参与天数（天）" : "喜欢程度"}</legend>
            <div className={`grid gap-1 sm:gap-1.5 ${offset === 0 ? "grid-cols-8" : "grid-cols-5"}`}>
              {(offset === 0 ? Array.from({ length: 8 }, (_, n) => String(n)) : LIKING).map((label, n) => <label key={n} className="relative min-w-0 cursor-pointer">
                <input type="radio" name={`knn-feature-${i * 2 + offset}`} value={n} aria-label={offset === 0 ? `${n} 天` : label}
                  checked={draft.features[i * 2 + offset] === n} onChange={() => choose(i * 2 + offset, n)} className="peer sr-only" />
                <span className={`flex items-center justify-center rounded-sm border border-border-secondary bg-surface px-1 text-center leading-4 text-text-secondary transition-colors hover:border-primary/50 hover:bg-primary-soft peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:font-medium peer-checked:text-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary ${offset === 0 ? "h-10 text-sm tabular-nums" : "min-h-11 py-1.5 text-xs sm:min-h-10 sm:text-sm"}`}>
                  {offset === 1 && label.endsWith("喜欢") ? <span><span className="block sm:inline">{label.slice(0, -2)}</span><span className="block sm:inline">喜欢</span></span> : label}
                </span>
              </label>)}
            </div>
          </fieldset>)}
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
    <label className="mt-5 flex items-start gap-2 text-sm leading-6 text-text-secondary">
      <input type="checkbox" checked={draft.consent} onChange={e => change({ ...draft, consent: e.target.checked })} className="mt-1.5 accent-primary" />
      我愿意作为匿名“学生 A”在课堂上展示（可不选）
    </label>
  </>;
}

export function AnswerSummary({ features, label }: { features: (number | null)[]; label: string }) {
  return <dl className="divide-y divide-border-secondary text-sm">
    {DIMENSIONS.map(([name], i) => <div key={name} className="flex flex-wrap justify-between gap-2 py-2.5">
      <dt className="text-text-secondary">{name}</dt><dd>{features[i * 2]} 天 · {LIKING[features[i * 2 + 1] ?? 0]}</dd>
    </div>)}
    <div className="flex justify-between gap-2 py-3"><dt className="text-text-secondary">运动意向</dt><dd className="font-medium text-primary">{label}</dd></div>
  </dl>;
}
