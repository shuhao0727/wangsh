/**
 * 任务分析列表面板 — 使用 AdminTablePanel + DataTable 统一表格风格
 */
import React, { useEffect, useState, useMemo } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { AdminTablePanel } from "@components/Admin";
import { Plus, Trash2, Search, Download, GitCompare } from "lucide-react";
import dayjs from "dayjs";
import { agentDataApi } from "@services/znt/api";
import { showMessage } from "@/lib/toast";

type AnalysisRecord = {
  id: number;
  title: string;
  created_at: string;
  uncovered_count: number;
  theme_count?: number;
  question_count?: number;
  teacher_anchor_count?: number;
  burst_count?: number;
  chain_count?: number;
  ai_chain_node_count?: number;
};

const TaskAnalysisListPanel: React.FC<{ analysisType?: "hot" | "chains"; detailView?: string }> = ({
  analysisType,
  detailView,
}) => {
  const isChain = analysisType ? analysisType === "chains" : detailView === "beam";
  const resolvedView = detailView || (isChain ? "beam" : "timeline");
  const newAnalysisUrl = `/task-analysis/new?type=${isChain ? "chains" : "hot"}`;
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = isChain
        ? await agentDataApi.listChainAnalyses()
        : await agentDataApi.listHotAnalyses();
      if (res.success) setRecords(res.data as AnalysisRecord[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadRecords(); }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm("确定删除这条分析记录？")) return;
    const res = isChain
      ? await agentDataApi.deleteChainAnalysis(id)
      : await agentDataApi.deleteHotAnalysis(id);
    if (res.success) { showMessage.success("已删除"); void loadRecords(); }
    else showMessage.error("删除失败");
  };

  const handleDownload = async (id: number) => {
    const res = isChain
      ? await agentDataApi.getChainAnalysis(id)
      : await agentDataApi.getHotAnalysis(id);
    if (!res.success) { showMessage.error("获取失败"); return; }
    const d: any = res.data;
    const r = d.result || {};
    const lines: string[] = [];
    lines.push(`# ${d.title || "分析报告"}`);
    lines.push(`> 生成时间：${d.created_at || ""}`);
    lines.push("");
    const wc = r.word_cloud || [];
    if (wc.length > 0) { lines.push("## 热点词 Top 10"); wc.slice(0, 10).forEach((w: any) => lines.push(`- **${w.word || w.name}** (${w.count || w.value}次)`)); lines.push(""); }
    const cov = r.covered || [];
    if (cov.length > 0) { lines.push("## 任务单已覆盖"); cov.forEach((c: any) => lines.push(`- ${c.topic} (${c.count}次)`)); lines.push(""); }
    const uncov = r.uncovered || [];
    if (uncov.length > 0) { lines.push("## 学生生成性问题"); uncov.forEach((u: any) => { lines.push(`### ${u.topic} (${u.count}次)`); (u.questions || []).forEach((q: string) => lines.push(`- ${q}`)); lines.push(""); }); }
    const suggestions = r.teaching_suggestions || [];
    if (suggestions.length > 0) { lines.push("## 教学建议"); suggestions.forEach((s: any) => lines.push(`- **${s.theme}**：${s.suggestion || ""}`)); lines.push(""); }
    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `任务分析_${d.title || ""}_${dayjs(d.created_at).format("YYYYMMDD")}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = search.trim()
    ? records.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    : records;

  const columns = useMemo<ColumnDef<AnalysisRecord>[]>(() => [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))}
          onCheckedChange={(checked) => {
            setSelectedIds(checked === true ? new Set(filtered.map((r) => r.id)) : new Set());
          }}
          aria-label="选择全部"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={(checked) => {
            const next = new Set(selectedIds);
            checked === true ? next.add(row.original.id) : next.delete(row.original.id);
            setSelectedIds(next);
          }}
        />
      ),
      size: 42,
    },
    {
      id: "title",
      header: "标题",
      accessorKey: "title",
      cell: ({ getValue }) => <span className="font-medium truncate max-w-[420px] block">{getValue<string>()}</span>,
      size: 300,
    },
    {
      id: "created_at",
      header: "时间",
      accessorKey: "created_at",
      cell: ({ getValue }) => <span className="text-text-tertiary text-xs whitespace-nowrap">{dayjs(getValue<string>()).format("MM-DD HH:mm")}</span>,
      size: 110,
    },
    {
      id: "discovery",
      header: "发现",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="inline-flex items-center rounded-full px-2 py-0.5 font-medium"
            style={{ background: "var(--ws-color-warning-soft)", color: "var(--ws-color-warning)" }}>
            {isChain
              ? `${row.original.chain_count || row.original.uncovered_count || 0} 条链`
              : `${row.original.theme_count || row.original.uncovered_count || 0} 个主题`}
          </span>
          <span className="text-text-tertiary">
            {isChain
              ? `锚点 ${row.original.teacher_anchor_count || 0} · 主线 ${row.original.ai_chain_node_count || 0}`
              : `${row.original.question_count || 0} 个问题 · ${row.original.burst_count || 0} 个爆发点`}
          </span>
        </div>
      ),
      size: 170,
    },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <a href={`/task-analysis/${row.original.id}?view=${resolvedView}&type=${isChain ? "chains" : "hot"}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {resolvedView === "beam" ? "光束图" : "时序"}
          </a>
          <button onClick={() => handleDownload(row.original.id)} title="下载"
            className="text-text-tertiary hover:text-primary transition-colors">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => handleDelete(row.original.id)}
            className="text-text-tertiary hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
      size: 140,
    },
  ], [isChain, resolvedView, filtered, selectedIds]);

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-[340px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input placeholder="搜索分析记录..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        {selectedIds.size >= 2 && (
          <Button size="sm" variant="outline" className="text-primary border-primary"
            onClick={() => window.open(`/task-analysis/compare?ids=${[...selectedIds].join(",")}`, "_blank")}>
            <GitCompare className="h-4 w-4 mr-1" />对比分析 ({selectedIds.size})
          </Button>
        )}
        <div className="flex-1" />
        <Button size="sm" onClick={() => window.open(newAnalysisUrl, "_blank")}>
          <Plus className="h-4 w-4 mr-1" />{isChain ? "新建问题链分析" : "新建热点分析"}
        </Button>
      </div>

      <AdminTablePanel
        loading={loading}
        isEmpty={!loading && records.length === 0}
        emptyDescription={isChain ? "暂无学生问题链分析记录" : "暂无热点问题分析记录"}
        noResults={!loading && records.length > 0 && filtered.length === 0}
        noResultsDescription="未找到匹配的分析记录"
      >
        <DataTable table={table} className="h-full !overflow-visible !rounded-none !border-0" tableClassName="min-w-[800px] table-fixed" />
      </AdminTablePanel>
    </div>
  );
};

export default TaskAnalysisListPanel;
