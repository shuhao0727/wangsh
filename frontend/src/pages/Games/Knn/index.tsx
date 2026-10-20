import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePublicKnnBatch, usePublicKnnBatches } from "@/hooks/queries/useKnnQuery";
import { knnApi, knnError, LABELS, PHASE_LABELS, timeText, type Receipt, type StudentStatus, type Submission } from "@/services/knn";
import { AnswerSummary, emptyDraft, SurveyFields, type Draft } from "./SurveyFields";

function readDraft(id: string): Draft {
  try {
    const saved = JSON.parse(sessionStorage.getItem(`knn-draft:${id}`) ?? "null");
    if (saved && typeof saved.number === "string" && Array.isArray(saved.features) && saved.features.length === 12 &&
      saved.features.every((v: unknown, i: number) => v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= (i % 2 ? 4 : 7))) &&
      (saved.label === "" || LABELS.includes(saved.label)) && typeof saved.consent === "boolean") return saved;
  } catch { /* Storage may be unavailable on a shared device. */ }
  return emptyDraft();
}

function Collection({ id }: { id: string }) {
  const query = usePublicKnnBatch(id);
  const [draft, setDraft] = useState(() => readDraft(id));
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [request, setRequest] = useState<Submission | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try { sessionStorage.setItem(`knn-draft:${id}`, JSON.stringify(draft)); } catch { /* Optional draft only. */ }
  }, [id, draft]);
  const reset = () => { setDraft(emptyDraft()); setStep(0); setStatus(null); setReceipt(null); setRequest(null); setError(""); };
  const check = async () => {
    setBusy(true); setError("");
    try {
      const result = await knnApi.check(id, draft.number);
      setStatus(result);
      if (!result.can_submit) {
        setError(result.phase !== "open" ? `当前${PHASE_LABELS[result.phase]}，请向老师确认时间。` : "该学号已提交；如需修改，请联系老师允许重填。");
      } else { setDraft({ ...draft, number: result.student_no }); setStep(1); }
    } catch (e) { setError(knnError(e)); } finally { setBusy(false); }
  };
  const review = () => {
    if (draft.features.some(v => v === null) || !draft.label || !status) { setError("请完成六项运动习惯和运动意向。"); return; }
    setRequest({ student_no: status.student_no, expected_revision: status.current_revision,
      request_id: crypto.randomUUID(), features: draft.features.map(v => v ?? 0), label: draft.label, display_consent: draft.consent });
    setError(""); setStep(2);
  };
  const submit = async () => {
    if (!request) return;
    setBusy(true); setError("");
    try {
      const result = await knnApi.submit(id, request);
      setReceipt(result); setDraft(emptyDraft()); setStep(3);
      try { sessionStorage.removeItem(`knn-draft:${id}`); } catch { /* Optional draft only. */ }
    } catch (e) { setError(knnError(e)); } finally { setBusy(false); }
  };
  const batch = query.data;
  if (query.isPending) return <p role="status">正在加载采集批次…</p>;
  if (!batch) return <div role="alert" className="space-y-3 text-sm"><p>{knnError(query.error)}</p><Button variant="outline" onClick={() => void query.refetch()}>重试</Button></div>;
  return <>
    <header className="mb-5 border-b border-border-secondary pb-4">
      <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-semibold">{batch.title}</h1><span className="shrink-0 text-sm text-primary">{PHASE_LABELS[batch.phase]}</span></div>
      <p className="mt-2 text-xs leading-5 text-text-secondary">{timeText(batch.starts_at)} — {timeText(batch.ends_at)}</p>
    </header>
    {step < 3 && <ol aria-label="填写进度" className="mb-6 flex gap-5 text-sm text-text-tertiary">
      {["核对学号", "填写习惯", "确认提交"].map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined} className={step === i ? "font-medium text-primary" : ""}>{i + 1}. {label}</li>)}
    </ol>}
    {error && <p role="alert" className="mb-4 rounded-sm border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</p>}
    {step === 0 && <form onSubmit={e => { e.preventDefault(); void check(); }} className="max-w-sm space-y-4">
      <label className="block space-y-2 text-sm font-medium"><span>学号</span><Input aria-label="学号" autoComplete="off" inputMode="text" maxLength={24} required disabled={busy} placeholder="填写老师分配的学号" value={draft.number} onChange={e => setDraft({ ...emptyDraft(), number: e.target.value })} /></label>
      {draft.features.some(v => v !== null) && <p className="text-xs text-text-secondary">本设备保留了该学号的草稿，核对后可继续填写。</p>}
      <div className="flex gap-2"><Button type="submit" disabled={busy || batch.phase !== "open"}>{busy ? "核对中…" : "开始填写"}</Button><Button variant="ghost" disabled={busy} onClick={reset}>清除草稿</Button></div>
      {batch.phase !== "open" && <p className="text-sm text-text-secondary">当前{PHASE_LABELS[batch.phase]}，请按老师安排的时间填写。</p>}
    </form>}
    {step === 1 && <>
      <p className="mb-4 text-sm text-text-secondary">学号 <strong className="text-text-base">{status?.student_no}</strong>{status?.refill_allowed ? " · 本次为重填" : ""}</p>
      <SurveyFields draft={draft} change={setDraft} />
      <div className="mt-6 flex justify-between border-t border-border-secondary pt-4"><Button variant="ghost" onClick={() => { setStep(0); setError(""); }}>返回</Button><Button onClick={review}>核对内容<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
    </>}
    {step === 2 && <>
      <h2 className="mb-2 text-base font-semibold">确认学号：{status?.student_no}</h2>
      <AnswerSummary features={draft.features} label={draft.label} />
      <p className="mt-3 text-xs text-text-secondary">{draft.consent ? "已同意作为匿名学生 A 展示。" : "未选择作为匿名学生 A 展示。"} 提交后如需修改，请联系老师允许重填。</p>
      <div className="mt-6 flex justify-between border-t border-border-secondary pt-4"><Button variant="ghost" disabled={busy} onClick={() => { setStep(1); setRequest(null); setError(""); }}>返回修改</Button><Button disabled={busy} onClick={() => void submit()}>{busy ? "提交中…" : "确认提交"}</Button></div>
      {error && <Button className="mt-3" variant="link" disabled={busy} onClick={() => { setStep(0); setError(""); }}>重新核对学号</Button>}
    </>}
    {step === 3 && receipt && <div className="py-8 text-center">
      <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-primary" /><h2 className="text-xl font-semibold">提交成功</h2>
      <p className="mt-3 text-sm text-text-secondary">学号 {receipt.student_no} · 第 {receipt.revision} 次提交</p>
      <p className="mt-1 text-xs text-text-tertiary">{timeText(receipt.submitted_at)}</p>
      <Button variant="outline" className="mt-6" onClick={reset}>换一位同学</Button>
    </div>}
  </>;
}

function BatchPicker() {
  const query = usePublicKnnBatches();
  return <>
    <h1 className="mb-5 text-xl font-semibold">KNN 运动习惯采集</h1>
    {query.isPending ? <p role="status">正在加载…</p> : query.isError ? <div role="alert"><p>{knnError(query.error)}</p><Button variant="link" onClick={() => void query.refetch()}>重试</Button></div> :
      !query.data?.length ? <p className="py-10 text-center text-sm text-text-secondary">暂无开放批次，请等待老师开始收集。</p> :
      <div className="divide-y divide-border-secondary border-y border-border-secondary">{query.data.map(batch => <Link key={batch.id} to={`/games/knn/${batch.id}`} className="flex items-center justify-between gap-4 py-4 hover:text-primary">
        <span><span className="block text-sm font-medium">{batch.title}</span><span className="mt-1 block text-xs text-text-secondary">截止 {timeText(batch.ends_at)}</span></span><span className="shrink-0 text-xs text-primary">{PHASE_LABELS[batch.phase]} →</span>
      </Link>)}</div>}
  </>;
}

export default function KnnPage() {
  const { batchId } = useParams();
  return <div className="h-dvh overflow-y-auto bg-bg text-text-base">
    <header className="flex h-12 items-center border-b border-border-secondary bg-surface px-4"><Button variant="ghost" size="sm" asChild><Link to="/games"><ArrowLeft className="mr-1 h-4 w-4" />互动课程</Link></Button></header>
    <main className="mx-auto my-5 w-[calc(100%-2rem)] max-w-4xl rounded-sm border border-border-secondary bg-surface p-5 sm:my-8 sm:p-8">{batchId ? <Collection key={batchId} id={batchId} /> : <BatchPicker />}</main>
  </div>;
}
