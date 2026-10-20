import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { knnError, type BatchConfig, type BatchDetail } from "@/services/knn";

function localTime(value: Date) {
  const date = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export function BatchEditor({ batch, onClose, onSave }: {
  batch?: BatchDetail;
  onClose: () => void;
  onSave: (body: BatchConfig) => Promise<void>;
}) {
  const [title, setTitle] = useState(batch?.title ?? "KNN 运动习惯采集");
  const [startsAt, setStartsAt] = useState(localTime(batch ? new Date(batch.starts_at) : new Date()));
  const [endsAt, setEndsAt] = useState(localTime(batch ? new Date(batch.ends_at) : new Date(Date.now() + 45 * 60_000)));
  const [numbers, setNumbers] = useState(batch?.rows.map(row => row.student_no).join("\n") ?? Array.from({ length: 65 }, (_, i) => String(i + 1)).join("\n"));
  const [first, setFirst] = useState("1");
  const [last, setLast] = useState("65");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const roster = numbers.trim().split(/[\s,，、;；]+/).filter(Boolean);

  const generate = () => {
    const a = Number(first), b = Number(last);
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b < a || b - a >= 1000) {
      setError("请填写有效的起止学号，生成数量不能超过 1000。");
      return;
    }
    setNumbers(Array.from({ length: b - a + 1 }, (_, i) => String(a + i)).join("\n"));
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    const start = new Date(startsAt), end = new Date(endsAt);
    if (!title.trim() || !roster.length || roster.length > 1000 || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setError("请检查批次名称、名单和时间，结束时间应晚于开始时间。");
      return;
    }
    if (roster.some(number => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,23}$/.test(number))) {
      setError("学号应为 1～24 位字母、数字、下划线或短横线。");
      return;
    }
    const keys = roster.map(number => /^\d+$/.test(number) ? number.replace(/^0+/, "") || "0" : number.toUpperCase());
    if (new Set(keys).size !== keys.length) {
      setError("名单中有重复学号；数字前导零和字母大小写视为同一学号。");
      return;
    }
    setBusy(true);
    try {
      await onSave({ title: title.trim(), starts_at: start.toISOString(), ends_at: end.toISOString(), student_numbers: roster });
      onClose();
    } catch (reason) { setError(knnError(reason)); }
    finally { setBusy(false); }
  };

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{batch ? "编辑采集批次" : "新建采集批次"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5 text-sm"><span>批次名称</span><Input value={title} maxLength={120} required disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm"><span>开始时间</span><Input type="datetime-local" value={startsAt} required disabled={busy} onChange={e => setStartsAt(e.target.value)} /></label>
          <label className="space-y-1.5 text-sm"><span>结束时间</span><Input type="datetime-local" value={endsAt} required disabled={busy} onChange={e => setEndsAt(e.target.value)} /></label>
        </div>
        <fieldset className="space-y-3 border-t border-border-secondary pt-4" disabled={busy}>
          <legend className="pr-2 text-sm font-medium">学号名单 · {roster.length} 人</legend>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="起始学号" type="number" min={0} value={first} className="w-24" onChange={e => setFirst(e.target.value)} />
            <span className="text-sm text-text-secondary">至</span>
            <Input aria-label="结束学号" type="number" min={0} value={last} className="w-24" onChange={e => setLast(e.target.value)} />
            <Button type="button" variant="outline" size="sm" onClick={generate}>生成名单</Button>
          </div>
          <label className="block space-y-1.5 text-sm text-text-secondary">
            <span>也可直接粘贴，每行一个学号或以逗号分隔</span>
            <Textarea aria-label="学号名单" value={numbers} rows={6} onChange={e => setNumbers(e.target.value)} className="font-mono" />
          </label>
          {batch && batch.submitted > 0 && <p className="text-xs text-text-secondary">已提交的学号需保留在名单中，修改名单不会清除答案。</p>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>取消</Button><Button type="submit" disabled={busy}>{busy ? "保存中…" : batch ? "保存修改" : "创建草稿"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
