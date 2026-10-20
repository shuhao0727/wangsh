import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnswerSummary } from "@/pages/Games/Knn/SurveyFields";
import { knnApi, knnError, timeText, type Answer, type BatchDetail } from "@/services/knn";

export function HistoryDialog({ batchId, studentNo, onClose }: { batchId: string; studentNo: string; onClose: () => void }) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    knnApi.history(batchId, studentNo).then(data => { if (!cancelled) setAnswers(data.answers); })
      .catch(reason => { if (!cancelled) setError(knnError(reason)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [batchId, studentNo, attempt]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
      <DialogHeader><DialogTitle>学号 {studentNo} · 答案记录</DialogTitle></DialogHeader>
      {loading ? <p role="status" className="py-8 text-center text-sm text-text-secondary">正在读取答案…</p> : error ?
        <div role="alert" className="space-y-3"><p className="text-sm text-error">{error}</p><Button variant="outline" size="sm" onClick={() => setAttempt(n => n + 1)}>重试</Button></div> :
        answers.map((answer, index) => <details key={answer.revision} open={index === 0} className="border-t border-border-secondary pt-3">
          <summary className="cursor-pointer text-sm font-medium">第 {answer.revision} 次提交{index === 0 ? " · 当前生效" : ""}<span className="ml-3 text-xs font-normal text-text-secondary">{timeText(answer.submitted_at)}</span></summary>
          <div className="pt-2"><AnswerSummary features={answer.features} label={answer.label} /><p className="pb-2 text-xs text-text-secondary">{answer.display_consent ? "同意作为匿名学生 A 展示" : "未同意作为学生 A 展示"}</p></div>
        </details>)}
      {!loading && !error && !answers.length && <p className="text-sm text-text-secondary">该学号尚未提交。</p>}
    </DialogContent>
  </Dialog>;
}

export function FreezeDialog({ batch, onClose, onFreeze }: { batch: BatchDetail; onClose: () => void; onFreeze: (studentNo: string) => Promise<void> }) {
  const candidates = batch.rows.filter(row => row.answer?.display_consent);
  const [number, setNumber] = useState(candidates[0]?.student_no ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const freeze = async () => {
    setBusy(true); setError("");
    try { await onFreeze(number); onClose(); }
    catch (reason) { setError(knnError(reason)); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>冻结课堂数据</DialogTitle></DialogHeader>
      <p className="text-sm leading-6 text-text-secondary">将当前 {batch.submitted} 份答案保存为匿名课堂 JSON。冻结后仍可收集和重填，课堂数据保持此刻的内容。</p>
      <label className="space-y-1.5 text-sm"><span>选择学生 A</span><Select value={number} onValueChange={setNumber} disabled={busy || !candidates.length}>
        <SelectTrigger aria-label="选择匿名展示的学生 A"><SelectValue placeholder="暂无同意展示的学生" /></SelectTrigger>
        <SelectContent>{candidates.map(row => <SelectItem key={row.student_no} value={row.student_no}>学号 {row.student_no}</SelectItem>)}</SelectContent>
      </Select></label>
      <p className="text-xs leading-5 text-text-secondary">只列出已同意匿名展示的学生。导出的 S01、S02 等编号不包含真实学号；每个批次只能冻结一次。</p>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose} disabled={busy}>取消</Button><Button onClick={freeze} disabled={busy || !number || batch.submitted < 4}>{busy ? "冻结中…" : "冻结并下载"}</Button></DialogFooter>
      {batch.submitted < 4 && <p className="text-xs text-text-secondary">至少收集 4 份答案后可冻结。</p>}
    </DialogContent>
  </Dialog>;
}
