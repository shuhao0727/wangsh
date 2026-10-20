import { useState } from "react";
import { Search } from "lucide-react";
import { AdminFilterBar } from "@/components/Admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { timeText, type BatchDetail } from "@/services/knn";

type Filter = "all" | "submitted" | "missing" | "refill";

export function RosterPanel({ batch, busy, onRefill, onHistory }: {
  batch: BatchDetail;
  busy: boolean;
  onRefill: (numbers: string[], allowed: boolean) => Promise<boolean>;
  onHistory: (number: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const rows = batch.rows.filter(row => row.student_no.toLowerCase().includes(search.trim().toLowerCase()) &&
    (filter === "all" || (filter === "submitted" && row.current_revision > 0) ||
      (filter === "missing" && row.current_revision === 0) || (filter === "refill" && row.refill_allowed)));
  const selectable = rows.filter(row => row.current_revision > 0).map(row => row.student_no);
  const selectedNumbers = selected.filter(number => batch.rows.some(row => row.student_no === number && row.current_revision > 0));
  const toggle = (number: string, checked: boolean) => setSelected(previous => checked ? [...new Set([...previous, number])] : previous.filter(n => n !== number));
  const bulk = async (allowed: boolean) => { if (await onRefill(selectedNumbers, allowed)) setSelected([]); };

  return <section aria-label="学生提交名单" className="min-w-0 border-t border-border-secondary">
    <AdminFilterBar className="!mb-0 gap-3 border-b border-border-secondary px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-44"><Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" /><Input aria-label="搜索学号" placeholder="搜索学号" value={search} onChange={e => { setSearch(e.target.value); setSelected([]); }} className="pl-9" /></div>
        <Select value={filter} onValueChange={value => { setFilter(value as Filter); setSelected([]); }}>
          <SelectTrigger aria-label="提交状态" className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">全部学号</SelectItem><SelectItem value="submitted">已提交</SelectItem><SelectItem value="missing">未提交</SelectItem><SelectItem value="refill">可重填</SelectItem></SelectContent>
        </Select>
        <span className="text-xs text-text-secondary">{rows.length} 人</span>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {selectedNumbers.length > 0 && <span className="text-xs text-text-secondary">已选 {selectedNumbers.length} 人</span>}
        <Button size="sm" variant="outline" disabled={busy || !selectedNumbers.length} onClick={() => void bulk(true)}>允许重填</Button>
        <Button size="sm" variant="ghost" disabled={busy || !selectedNumbers.length} onClick={() => void bulk(false)}>撤销重填</Button>
      </div>
    </AdminFilterBar>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: 700 }}>
        <thead className="border-b border-border-secondary bg-surface-2 text-xs text-text-secondary">
          <tr><th className="w-10 px-4 py-3"><input type="checkbox" aria-label="全选当前列表已提交学生" disabled={busy || !selectable.length} checked={!!selectable.length && selectable.every(n => selectedNumbers.includes(n))} onChange={e => setSelected(e.target.checked ? selectable : [])} className="accent-primary" /></th>
            <th className="px-3 py-3 font-medium">学号</th><th className="px-3 py-3 font-medium">状态</th><th className="px-3 py-3 font-medium">运动意向</th><th className="px-3 py-3 font-medium">提交时间</th><th className="px-4 py-3 text-right font-medium">操作</th></tr>
        </thead>
        <tbody className="divide-y divide-border-secondary">
          {rows.map(row => <tr key={row.student_no} className="hover:bg-surface-2">
            <td className="px-4 py-3"><input type="checkbox" aria-label={`选择学号 ${row.student_no}`} checked={selectedNumbers.includes(row.student_no)} disabled={busy || !row.current_revision} onChange={e => toggle(row.student_no, e.target.checked)} className="accent-primary" /></td>
            <td className="px-3 py-3 font-medium tabular-nums">{row.student_no}</td>
            <td className="px-3 py-3"><span className={row.refill_allowed ? "text-primary" : row.answer ? "text-text-base" : "text-text-tertiary"}>{row.refill_allowed ? "可重填" : row.answer ? "已提交" : "未提交"}</span>{row.current_revision > 1 && <span className="ml-2 text-xs text-text-tertiary">第 {row.current_revision} 次</span>}</td>
            <td className="px-3 py-3 text-text-secondary">{row.answer?.label ?? "—"}</td>
            <td className="px-3 py-3 text-xs text-text-secondary">{row.answer ? timeText(row.answer.submitted_at) : "—"}</td>
            <td className="px-4 py-2 text-right">{row.answer ? <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => onHistory(row.student_no)}>查看</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void onRefill([row.student_no], !row.refill_allowed)}>{row.refill_allowed ? "撤销重填" : "允许重填"}</Button></div> : <span className="text-xs text-text-tertiary">等待填写</span>}</td>
          </tr>)}
          {!rows.length && <tr><td colSpan={6} className="py-12 text-center text-sm text-text-secondary">没有匹配的学号</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
