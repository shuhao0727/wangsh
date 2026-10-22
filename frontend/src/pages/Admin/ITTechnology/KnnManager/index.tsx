import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Download, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import useAuth from "@/hooks/useAuth";
import { useKnnBatches, useKnnDetail } from "@/hooks/queries/useKnnQuery";
import { queryKeys } from "@/hooks/queries/queryKeys";
import { showMessage } from "@/lib/toast";
import { downloadKnn, knnApi, knnError, PHASE_LABELS, timeText, type BatchConfig, type BatchDetail, type BatchSummary, type FrozenData } from "@/services/knn";
import { BatchEditor } from "./BatchEditor";
import { FreezeDialog, HistoryDialog } from "./DataDialogs";
import { RosterPanel } from "./RosterPanel";
import { ConfirmDialog } from "@/components/Common/ConfirmDialog";

export default function KnnManager({ onBack, backLabel = "IT 应用" }: { onBack: () => void; backLabel?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const batches = useKnnBatches(user?.id);
  const id = params.get("batch") ?? "";
  const detail = useKnnDetail(user?.id, id);
  const [editor, setEditor] = useState<"new" | "edit" | null>(null);
  const [freezing, setFreezing] = useState(false);
  const [history, setHistory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 待删除的批次：草稿/待开始/已结束可删，采集中不可删。
  const [removing, setRemoving] = useState<BatchSummary | null>(null);
  const batch = detail.data;

  const selectBatch = (next: string) => setParams(previous => {
    const updated = new URLSearchParams(previous);
    updated.set("view", "knn"); updated.set("batch", next);
    return updated;
  }, { replace: true });
  const openList = () => setParams(previous => {
    const updated = new URLSearchParams(previous);
    updated.set("view", "knn"); updated.delete("batch");
    return updated;
  }, { replace: true });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.knn.staff(user?.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.knn.publicList() }),
    ]);
  };
  const accept = async (data: BatchDetail) => {
    queryClient.setQueryData(queryKeys.knn.detail(user?.id, data.id), data);
    await refresh();
  };
  const save = async (body: BatchConfig) => {
    const saved = editor === "edit" && batch ? await knnApi.update(batch.id, body) : await knnApi.create(body);
    selectBatch(saved.id);
    await accept(saved);
    showMessage.success(editor === "edit" ? "批次已更新" : "采集草稿已创建");
  };
  const operate = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true); setError("");
    try { await operation(); showMessage.success(success); return true; }
    catch (reason) { setError(knnError(reason)); return false; }
    finally { setBusy(false); }
  };
  const changeState = (action: "start" | "schedule" | "close") => {
    if (!batch) return;
    void operate(async () => accept(await knnApi.state(batch.id, action)), action === "close" ? "本次收集已结束" : action === "start" ? "已开始收集" : "已按设置时间开放");
  };
  const refill = (numbers: string[], allowed: boolean) => operate(async () => {
    if (!batch) return;
    await accept(await knnApi.refill(batch.id, numbers, allowed));
  }, allowed ? `已允许 ${numbers.length} 人重填一次` : "已撤销重填权限");
  const downloadFrozen = (data: FrozenData) => downloadKnn(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }), `knn-${id}.json`);
  const freeze = async (number: string) => {
    if (!batch) return;
    const data = await knnApi.freeze(batch.id, number);
    await refresh(); downloadFrozen(data); showMessage.success("课堂数据已冻结");
  };
  const remove = async () => {
    if (!removing) return;
    const target = removing;
    const done = await operate(async () => {
      await knnApi.remove(target.id);
      if (id === target.id) openList();
      await refresh();
    }, "批次已删除");
    if (done) setRemoving(null);
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/games/knn/${id}`); showMessage.success("学生填写链接已复制"); }
    catch { showMessage.warning("复制失败，请打开学生入口后复制地址栏链接。"); }
  };

  return <div className="ws-embedded-controls min-w-0 text-text-base">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="sm" onClick={id ? openList : onBack}><ArrowLeft />{id ? "批次列表" : backLabel}</Button>
        <h1 className="text-base font-semibold">KNN 运动习惯采集</h1>
      </div>
      {!id && <Button size="sm" onClick={() => setEditor("new")} disabled={busy}><Plus />新建批次</Button>}
    </div>
    {batches.isPending ? <p role="status" className="py-14 text-center text-sm text-text-secondary">正在读取采集批次…</p> : batches.isError ?
      <div role="alert" className="space-y-3 py-10 text-center"><p className="text-sm text-error">{knnError(batches.error)}</p><Button variant="outline" onClick={() => void batches.refetch()}>重试</Button></div> :
      !batches.data.length ? <div className="rounded-md border border-border-secondary bg-surface px-4 py-16 text-center"><p className="text-sm text-text-secondary">还没有采集批次</p><Button variant="outline" className="mt-4" onClick={() => setEditor("new")}>创建第一个批次</Button></div> : !id ?
        <BatchList
          batches={batches.data}
          busy={busy}
          onOpen={selectBatch}
          onExport={item => void operate(async () => downloadKnn(await knnApi.csv(item.id), `knn-${item.id}.csv`), "CSV 已导出")}
          onRemove={setRemoving}
        /> : <>
        {detail.isPending ? <p role="status" className="py-14 text-center text-sm text-text-secondary">正在读取名单…</p> : detail.isError ?
          <div role="alert" className="space-y-3 py-10 text-center"><p className="text-sm text-error">{knnError(detail.error)}</p><Button variant="outline" onClick={() => void detail.refetch()}>重试</Button></div> : batch &&
          <div className="overflow-hidden rounded-md border border-border-secondary bg-surface">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-secondary px-4 py-4">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{batch.title}</h2><Badge variant={batch.phase === "open" ? "info" : "neutral"}>{PHASE_LABELS[batch.phase]}</Badge></div><p className="mt-2 text-xs leading-5 text-text-secondary">{timeText(batch.starts_at)} — {timeText(batch.ends_at)}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditor("edit")}>编辑设置</Button>
                <Button size="sm" variant="outline" disabled={busy || batch.phase === "open"} title={batch.phase === "open" ? "采集中不能删除，请先结束收集" : undefined} onClick={() => setRemoving(batch)}><Trash2 />删除批次</Button>
                {batch.phase !== "open" && <Button size="sm" variant="outline" disabled={busy} onClick={() => changeState("schedule")}>{batch.state === "closed" ? "按时间重新开放" : "按时开放"}</Button>}
                {batch.phase !== "open" ? <Button size="sm" disabled={busy} onClick={() => changeState("start")}>立即开始</Button> : <Button size="sm" variant="outline" disabled={busy} onClick={() => changeState("close")}>结束收集</Button>}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span>应填 <strong className="ml-1 font-semibold tabular-nums">{batch.expected}</strong></span><span>已填 <strong className="ml-1 font-semibold tabular-nums text-primary">{batch.submitted}</strong></span><span>未填 <strong className="ml-1 font-semibold tabular-nums">{batch.missing}</strong></span><span className="text-text-secondary">待重填 <span className="ml-1 tabular-nums">{batch.pending_refill}</span></span></div>
              <div className="flex flex-wrap items-center gap-1"><Button variant="ghost" size="sm" onClick={() => void copyLink()}><Copy />复制填写链接</Button><Button asChild variant="ghost" size="sm"><Link to={`/games/knn/${id}`} target="_blank" rel="noopener noreferrer"><ExternalLink />学生入口</Link></Button></div>
            </div>
            {error && <div role="alert" className="flex items-start justify-between gap-3 border-t border-border-secondary bg-error-soft px-4 py-3 text-sm text-error"><p>{error}</p><Button variant="ghost" size="sm" onClick={() => setError("")}>收起</Button></div>}
            {batch.missing > 0 && <details className="border-t border-border-secondary px-4 py-3"><summary className="cursor-pointer text-sm text-text-secondary">未提交学号 · {batch.missing} 人</summary><div className="mt-3 flex flex-wrap gap-1.5">{batch.rows.filter(row => !row.current_revision).map(row => <span key={row.student_no} className="min-w-8 rounded-sm bg-surface-2 px-2 py-1 text-center text-xs tabular-nums">{row.student_no}</span>)}</div></details>}
            <RosterPanel key={batch.id} batch={batch} busy={busy} onRefill={refill} onHistory={setHistory} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-secondary px-4 py-3">
              <span className="text-xs text-text-secondary">{batch.frozen_at ? `课堂数据已冻结 · ${timeText(batch.frozen_at)}` : "课堂数据尚未冻结"}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void operate(async () => downloadKnn(await knnApi.csv(id), `knn-${id}.csv`), "CSV 已导出")}><Download />导出 CSV</Button>
                {batch.frozen_at ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void operate(async () => downloadFrozen(await knnApi.frozen(id)), "课堂 JSON 已下载")}>下载课堂 JSON</Button> : <Button size="sm" variant="outline" disabled={busy || batch.submitted < 4} title={batch.submitted < 4 ? "至少收集 4 份答案后可冻结" : undefined} onClick={() => setFreezing(true)}>冻结课堂数据</Button>}
              </div>
            </div>
          </div>}
      </>}
    {editor && <BatchEditor key={editor === "edit" ? batch?.id : "new"} batch={editor === "edit" ? batch : undefined} onClose={() => setEditor(null)} onSave={save} />}
    {freezing && batch && <FreezeDialog batch={batch} onClose={() => setFreezing(false)} onFreeze={freeze} />}
    <ConfirmDialog
      open={Boolean(removing)}
      onOpenChange={next => { if (!next) setRemoving(null); }}
      title="删除采集批次"
      description={removing ? `将删除「${removing.title}」及其 ${removing.submitted} 份提交记录，且无法恢复。建议先导出 CSV 再删除。` : ""}
      confirmText="确认删除"
      variant="destructive"
      loading={busy}
      onConfirm={remove}
    />
    {history && batch && <HistoryDialog key={`${batch.id}-${history}`} batchId={batch.id} studentNo={history} onClose={() => setHistory("")} />}
  </div>;
}

/** 历次采集批次列表：每行可进入详情或直接导出素材。 */
function BatchList({ batches, busy, onOpen, onExport, onRemove }: {
  batches: BatchSummary[]; busy: boolean;
  onOpen: (id: string) => void; onExport: (item: BatchSummary) => void;
  onRemove: (item: BatchSummary) => void;
}) {
  return <div className="overflow-hidden rounded-md border border-border-secondary bg-surface">
    <table className="w-full text-left text-sm">
      <thead className="bg-[var(--ws-color-workspace-muted)] text-xs text-text-secondary">
        <tr>{["批次", "状态", "已填/应交", "采集时间", "操作"].map(header =>
          <th key={header} className="px-4 py-2.5 font-medium">{header}</th>)}</tr>
      </thead>
      <tbody>
        {batches.map(item => <tr key={item.id} className="border-t border-border-secondary">
          <td className="px-4 py-3">
            <button type="button" onClick={() => onOpen(item.id)} className="text-left font-medium hover:text-primary">{item.title}</button>
          </td>
          <td className="px-4 py-3"><Badge variant={item.phase === "open" ? "info" : "neutral"}>{PHASE_LABELS[item.phase]}</Badge></td>
          <td className="px-4 py-3 tabular-nums"><span className="font-medium text-primary">{item.submitted}</span> / {item.expected}</td>
          <td className="px-4 py-3 text-xs text-text-secondary">{timeText(item.starts_at)} — {timeText(item.ends_at)}</td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => onOpen(item.id)}>查看详情</Button>
              <Button variant="ghost" size="sm" disabled={busy || item.submitted === 0} title={item.submitted === 0 ? "该批次还没有提交记录" : undefined} onClick={() => onExport(item)}>
                <Download />导出 CSV
              </Button>
              <Button variant="ghost" size="sm" disabled={busy || item.phase === "open"} title={item.phase === "open" ? "采集中不能删除，请先结束收集" : undefined} onClick={() => onRemove(item)}>
                <Trash2 />删除
              </Button>
            </div>
          </td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
