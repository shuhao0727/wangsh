/**
 * 分析面板 — 热点问题 + 学生提问链条
 * 统一使用 AdminTablePanel 布局，分页固定底部
 */

import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Loader2, Search } from "lucide-react";
import dayjs from "dayjs";
import aiAgentsApi from "@services/znt/api/ai-agents-api";
import { agentDataApi } from "@services/znt/api";
import type { AIAgent } from "@services/znt/types";
import { AdminTablePanel } from "@components/Admin";
import StudentBeamChart from "./StudentBeamChart";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

const downloadBlobFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

type HotBucket = {
  bucket_start: string;
  question_count: number;
  unique_students: number;
  top_questions: Array<{ question: string; count: number }>;
};

type StudentSession = {
  session_id: string;
  last_at: string;
  turns: number;
  student_id?: string;
  user_name?: string;
  class_name?: string;
  messages: Array<{ id: number; message_type: string; content: string; created_at: string }>;
};

type AgentOption = { label: string; value: string };

type HotFilters = {
  agent_id: string;
  start_at: string;
  end_at: string;
  bucket_seconds: number;
  top_n: number;
  class_name: string;
  student_id: string;
};

type ChainFilters = {
  agent_id: string;
  start_at: string;
  end_at: string;
  class_name: string;
  student_id: string;
  student_name: string;
  limit_sessions: number;
};

const toLocalDateInput = (value: dayjs.Dayjs) => value.format("YYYY-MM-DD");

const defaultRange = () => {
  const now = dayjs();
  return {
    start_at: toLocalDateInput(now.subtract(7, "day")),
    end_at: toLocalDateInput(now),
  };
};

const parseRangeToISO = (startAt: string, endAt: string) => {
  const start = dayjs(startAt);
  const end = dayjs(endAt);
  if (!startAt || !endAt || !start.isValid() || !end.isValid()) {
    throw new Error("请选择有效的时间范围");
  }
  if (end.isBefore(start)) {
    throw new Error("结束时间不能早于开始时间");
  }
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

/* ========== 智能体选项缓存 ========== */
let cachedAgents: AIAgent[] | null = null;
let cachedAgentsPromise: Promise<AIAgent[]> | null = null;
let cachedAgentsAt = 0;
const CACHE_TTL_MS = 60_000;

const useActiveAgentOptions = () => {
  const [agents, setAgents] = useState<AIAgent[]>(cachedAgents || []);
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    const isStale = cachedAgents && (Date.now() - cachedAgentsAt > CACHE_TTL_MS);
    if (cachedAgents && !isStale) return;
    if (cachedAgentsPromise && !isStale) {
      setLoadingAgents(true);
      void cachedAgentsPromise
        .then((list) => setAgents(list))
        .finally(() => setLoadingAgents(false));
      return;
    }

    const load = async () => {
      setLoadingAgents(true);
      cachedAgentsPromise = aiAgentsApi
        .getActiveAgents()
        .then((res) => {
          const list = res.data || [];
          cachedAgents = list;
          cachedAgentsAt = Date.now();
          return list;
        })
        .catch((e) => {
          cachedAgentsPromise = null;
          throw e;
        });
      try {
        setAgents(await cachedAgentsPromise);
      } catch {
        showMessage.error("加载智能体列表失败");
      } finally {
        setLoadingAgents(false);
      }
    };
    void load();
  }, []);

  const agentOptions = useMemo<AgentOption[]>(
    () =>
      agents.map((a) => ({
        label: a.agent_name || a.name || `智能体${a.id}`,
        value: String(a.id),
      })),
    [agents],
  );
  return { agentOptions, loadingAgents };
};

/* ========== 分析记录表 ========== */
const HotAnalysisRecords: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  useEffect(() => {
    void agentDataApi.listTaskAnalyses().then((r: any) => {
      if (r.success) setRecords(r.data || []);
    });
  }, []);
  if (records.length === 0) return null;
  return (
    <div className="flex-none pt-4">
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-surface-2">
            <tr className="text-left text-text-tertiary">
              <th className="px-3 py-1.5 font-medium">标题</th>
              <th className="px-3 py-1.5 font-medium w-[100px]">时间</th>
              <th className="px-3 py-1.5 font-medium w-[60px]">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-secondary">
            {records.map((r: any) => (
              <tr key={r.id} className="hover:bg-[var(--ws-color-hover-bg)] transition-colors">
                <td className="px-3 py-1.5 font-medium truncate max-w-[300px]">
                  {r.title}
                  <span className="ml-2 text-text-tertiary font-normal">{(r as any).uncovered_count || 0} 个发现</span>
                </td>
                <td className="px-3 py-1.5 text-text-tertiary">{dayjs(r.created_at).format("MM-DD HH:mm")}</td>
                <td className="px-3 py-1.5">
                  <a href={`/task-analysis/${r.id}`} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline">查看</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ========== 热点问题面板 ========== */
export const HotQuestionsPanel: React.FC = () => {
  const { agentOptions, loadingAgents } = useActiveAgentOptions();
  const [loadingHot, setLoadingHot] = useState(false);
  const [exportingHot, setExportingHot] = useState(false);
  const [hotData, setHotData] = useState<HotBucket[]>([]);
  const [hotPage, setHotPage] = useState(1);
  const [hotPageSize, setHotPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState<HotFilters>(() => ({
    agent_id: "",
    ...defaultRange(),
    bucket_seconds: 60,
    top_n: 10,
    class_name: "",
    student_id: "",
  }));
  const [filterOptions, setFilterOptions] = useState<{ classNames: string[] }>({ classNames: [] });

  useEffect(() => {
    void agentDataApi.getFilterOptions().then((res) => {
      if (res.success) setFilterOptions({ classNames: res.data.class_names || [] });
    });
  }, []);

  useEffect(() => {
    if (filters.agent_id || agentOptions.length === 0) return;
    setFilters((prev) => ({ ...prev, agent_id: agentOptions[0].value }));
  }, [agentOptions, filters.agent_id]);

  const hotPagedData = useMemo(() => {
    const start = (hotPage - 1) * hotPageSize;
    return hotData.slice(start, start + hotPageSize);
  }, [hotData, hotPage, hotPageSize]);

  const validateFilters = () => {
    if (!filters.agent_id) throw new Error("请选择智能体");
    if (!Number.isFinite(filters.bucket_seconds) || Number(filters.bucket_seconds) < 1) {
      throw new Error("时间桶需大于等于 1");
    }
    if (!Number.isFinite(filters.top_n) || Number(filters.top_n) < 1) {
      throw new Error("TopN 需大于等于 1");
    }
    return parseRangeToISO(filters.start_at, filters.end_at);
  };

  const loadHot = async () => {
    try {
      const { startISO, endISO } = validateFilters();
      setLoadingHot(true);
      const res = await agentDataApi.analyzeHotQuestions({
        agent_id: Number(filters.agent_id),
        start_at: startISO,
        end_at: endISO,
        bucket_seconds: Number(filters.bucket_seconds),
        top_n: Number(filters.top_n),
        class_name: filters.class_name.trim() || undefined,
        student_id: filters.student_id.trim() || undefined,
      });
      if (!res.success) {
        showMessage.error(res.message || "获取热点问题失败");
        setHotData([]);
        return;
      }
      setHotData(res.data);
      setHotPage(1);
    } catch (error: unknown) {
      showMessage.error(error instanceof Error ? error.message : "查询失败");
    } finally {
      setLoadingHot(false);
    }
  };

  const exportHot = async () => {
    try {
      const { startISO, endISO } = validateFilters();
      setExportingHot(true);
      const res = await agentDataApi.exportHotQuestions({
        agent_id: Number(filters.agent_id),
        start_at: startISO,
        end_at: endISO,
        bucket_seconds: Number(filters.bucket_seconds),
        top_n: Number(filters.top_n),
        class_name: filters.class_name.trim() || undefined,
        student_id: filters.student_id.trim() || undefined,
      });
      if (!res.success) {
        showMessage.error(res.message || "导出失败");
        return;
      }
      downloadBlobFile(
        res.data,
        `hot_questions_${filters.agent_id}_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`,
      );
      showMessage.success("已开始下载");
    } catch (error: unknown) {
      showMessage.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExportingHot(false);
    }
  };

  const hotColumns: ColumnDef<HotBucket>[] = [
    {
      id: "bucket_start",
      header: "时间段",
      accessorKey: "bucket_start",
      size: 200,
      meta: { className: "w-[200px]" },
      cell: ({ row }) => {
        const d = dayjs(row.original.bucket_start);
        return (
          <div>
            <div className="text-sm font-medium">{d.format("MM-DD HH:mm")}</div>
            <div className="text-xs text-text-tertiary">{d.format("ss")}秒起</div>
          </div>
        );
      },
    },
    {
      id: "question_count",
      header: "提问数",
      accessorKey: "question_count",
      size: 90,
      meta: { className: "w-[90px]" },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {row.original.question_count}
        </span>
      ),
    },
    {
      id: "unique_students",
      header: "活跃学生",
      accessorKey: "unique_students",
      size: 100,
      meta: { className: "w-[100px]" },
    },
    {
      id: "top_questions",
      header: "Top 热点问题",
      accessorKey: "top_questions",
      cell: ({ row }) => {
        const items = (row.original.top_questions || []).slice(0, 5);
        if (!items.length) return <span className="text-text-tertiary text-sm">-</span>;
        return (
          <div className="space-y-1">
            {items.map((item, idx) => (
              <div key={`${item.question}-${idx}`} className="flex items-start gap-1.5 text-sm">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white ${idx < 3 ? "bg-primary" : "bg-text-tertiary"}`}>
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.question}</span>
                <span className="shrink-0 text-xs text-text-tertiary">{item.count}次</span>
              </div>
            ))}
          </div>
        );
      },
    },
  ];

  const hotTable = useReactTable({
    data: hotPagedData,
    columns: hotColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[170px]">
            <div className="mb-1 text-xs text-text-tertiary">智能体</div>
            <Select
              value={filters.agent_id || "__empty__"}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, agent_id: value === "__empty__" ? "" : value }))}
              disabled={loadingAgents}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder={loadingAgents ? "加载中..." : "选择智能体"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">请选择智能体</SelectItem>
                {agentOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[160px]">
            <div className="mb-1 text-xs text-text-tertiary">开始时间</div>
            <Input type="date" value={filters.start_at} onChange={(e) => setFilters((prev) => ({ ...prev, start_at: e.target.value }))} className="h-9" />
          </div>
          <div className="w-[160px]">
            <div className="mb-1 text-xs text-text-tertiary">结束时间</div>
            <Input type="date" value={filters.end_at} onChange={(e) => setFilters((prev) => ({ ...prev, end_at: e.target.value }))} className="h-9" />
          </div>
          <div className="flex gap-1.5 items-end pb-px">
            <Button size="sm" className="h-8" onClick={loadHot} disabled={loadingHot}>
              {loadingHot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              查询
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={exportHot} disabled={exportingHot || loadingHot}>
              {exportingHot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              导出
            </Button>
            <Button variant="default" size="sm" className="h-8" onClick={() => window.open("/task-analysis/new", "_blank")}>
              + 开始分析
            </Button>
          </div>
        </div>
      </div>

      <HotAnalysisRecords />

      <div className="flex min-h-0 flex-1 flex-col pt-3">
        <div className="flex-1 min-h-0 rounded-lg border border-border-secondary bg-surface-1 overflow-hidden">
          <AdminTablePanel
            loading={loadingHot}
            isEmpty={hotData.length === 0}
            emptyDescription="暂无热点问题数据，请先查询"
          >
            <DataTable table={hotTable} className="h-full !overflow-visible !rounded-none !border-0" />
          </AdminTablePanel>
        </div>
        <div className="flex-none flex justify-end pt-2">
          <DataTablePagination
            currentPage={hotPage}
            totalPages={Math.max(1, Math.ceil(hotData.length / hotPageSize))}
            total={hotData.length}
            pageSize={hotPageSize}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            onPageChange={(nextPage, nextPageSize) => {
              if (nextPageSize && nextPageSize !== hotPageSize) {
                setHotPageSize(nextPageSize);
                setHotPage(1);
                return;
              }
              setHotPage(nextPage);
            }}
          />
        </div>
      </div>

    </div>
  );
};

/* ========== 学生提问链条面板 ========== */
export const StudentQuestionChainsPanel: React.FC = () => {
  const { agentOptions, loadingAgents } = useActiveAgentOptions();
  const [loadingChains, setLoadingChains] = useState(false);
  const [exportingChains, setExportingChains] = useState(false);
  const [chains, setChains] = useState<StudentSession[]>([]);
  const [chainsPage, setChainsPage] = useState(1);
  const [chainsPageSize, setChainsPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<ChainFilters>(() => ({
    agent_id: "",
    ...defaultRange(),
    class_name: "",
    student_id: "",
    student_name: "",
    limit_sessions: 5,
  }));
  const [filterOptions, setFilterOptions] = useState<{ classNames: string[] }>({ classNames: [] });
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    void agentDataApi.getFilterOptions().then((res) => {
      if (res.success) setFilterOptions({ classNames: res.data.class_names || [] });
    });
  }, []);

  // Auto-query on mount
  useEffect(() => { const id = filters.agent_id; if (id) loadChains(); }, [filters.agent_id]);

  useEffect(() => {
    if (filters.agent_id || agentOptions.length === 0) return;
    setFilters((prev) => ({ ...prev, agent_id: agentOptions[0].value }));
  }, [agentOptions, filters.agent_id]);

  const chainsPagedData = useMemo(() => {
    const start = (chainsPage - 1) * chainsPageSize;
    return chains.slice(start, start + chainsPageSize);
  }, [chains, chainsPage, chainsPageSize]);

  const validateFilters = () => {
    if (!filters.agent_id) throw new Error("请选择智能体");
    if (!Number.isFinite(filters.limit_sessions) || Number(filters.limit_sessions) < 1) {
      throw new Error("会话数需大于等于 1");
    }
    return parseRangeToISO(filters.start_at, filters.end_at);
  };

  const loadChains = async () => {
    try {
      const { startISO, endISO } = validateFilters();
      setLoadingChains(true);
      const res = await agentDataApi.analyzeStudentChains({
        agent_id: Number(filters.agent_id),
        class_name: filters.class_name.trim() || undefined,
        student_id: filters.student_id.trim() || undefined,
        student_name: filters.student_name.trim() || undefined,
        start_at: startISO,
        end_at: endISO,
        limit_sessions: Number(filters.limit_sessions),
      });
      if (!res.success) {
        showMessage.error(res.message || "获取失败");
        setChains([]);
        setChainsPage(1);
        return;
      }
      setChains(res.data);
      setChainsPage(1);
      setExpandedSessions({});
    } catch (error: unknown) {
      showMessage.error(error instanceof Error ? error.message : "查询失败");
    } finally {
      setLoadingChains(false);
    }
  };

  const exportChains = async () => {
    try {
      const { startISO, endISO } = validateFilters();
      setExportingChains(true);
      const res = await agentDataApi.exportStudentChains({
        agent_id: Number(filters.agent_id),
        class_name: filters.class_name.trim() || undefined,
        student_id: filters.student_id.trim() || undefined,
        student_name: filters.student_name.trim() || undefined,
        start_at: startISO,
        end_at: endISO,
        limit_sessions: Number(filters.limit_sessions),
      });
      if (!res.success) {
        showMessage.error(res.message || "导出失败");
        return;
      }
      downloadBlobFile(
        res.data,
        `student_chains_${filters.agent_id}_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`,
      );
      showMessage.success("已开始下载");
    } catch (error: unknown) {
      showMessage.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExportingChains(false);
    }
  };

  const chainColumns: ColumnDef<StudentSession>[] = [
    {
      id: "expand",
      header: "",
      size: 44,
      meta: { className: "w-[44px]" },
      cell: ({ row }) => {
        const expanded = Boolean(expandedSessions[row.original.session_id]);
        return (
          <button
            type="button"
            className="inline-flex h-7 w-7 appearance-none items-center justify-center rounded-md border border-border bg-transparent text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-base"
            onClick={() =>
              setExpandedSessions((prev) => ({
                ...prev,
                [row.original.session_id]: !prev[row.original.session_id],
              }))
            }
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        );
      },
    },
    {
      id: "student_info",
      header: "学生",
      size: 180,
      meta: { className: "w-[180px]" },
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="font-medium">{row.original.user_name || "-"}</div>
          <div className="text-xs text-text-tertiary">
            {[row.original.class_name, row.original.student_id].filter(Boolean).join(" · ") || "-"}
          </div>
        </div>
      ),
    },
    {
      id: "path",
      header: "提问路径",
      size: 260,
      cell: ({ row }) => {
        const questions = row.original.messages
          .filter((m) => m.message_type === "question")
          .slice(0, 3);
        if (questions.length === 0) return <span className="text-xs text-text-tertiary">-</span>;
        return (
          <div className="text-xs text-text-secondary leading-relaxed">
            {questions.map((q, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1 text-text-tertiary/40">→</span>}
                <span className="text-text-base/80">{q.content.slice(0, 12)}{q.content.length > 12 ? "…" : ""}</span>
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: "session_id",
      header: "会话ID",
      accessorKey: "session_id",
      size: 200,
      meta: { className: "w-[200px]" },
      cell: ({ row }) => (
        <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-text-secondary">
          {row.original.session_id?.slice(-12) || "-"}
        </code>
      ),
    },
    {
      id: "last_at",
      header: "最后活跃",
      accessorKey: "last_at",
      size: 160,
      meta: { className: "w-[160px]" },
      cell: ({ row }) => (
        <span className="text-sm">{dayjs(row.original.last_at).format("MM-DD HH:mm:ss")}</span>
      ),
    },
    {
      id: "turns",
      header: "轮数",
      accessorKey: "turns",
      size: 70,
      meta: { className: "w-[70px]" },
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-[var(--ws-color-secondary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--ws-color-secondary)]">
          {row.original.turns}
        </span>
      ),
    },
    {
      id: "content",
      header: "对话内容",
      cell: ({ row }) => {
        const record = row.original;
        const expanded = Boolean(expandedSessions[record.session_id]);
        const preview = record.messages
          .filter((msg) => msg.message_type === "question")
          .slice(0, 1)[0]?.content;
        const msgCount = record.messages.length;
        return (
          <div className="space-y-1.5">
            <div className="text-sm">
              {preview ? (
                <span className="line-clamp-1">{preview}</span>
              ) : (
                <span className="text-text-tertiary">（空）</span>
              )}
              {!expanded && msgCount > 1 ? (
                <span className="ml-1 text-xs text-text-tertiary">等{msgCount}条</span>
              ) : null}
            </div>
            {expanded ? (
              <div className="space-y-1.5 rounded-lg border border-border-secondary bg-surface-2 p-2.5">
                {record.messages.map((msg) => {
                  const isQ = msg.message_type === "question";
                  return (
                    <div key={msg.id} className="flex gap-2 text-sm">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold text-white ${isQ ? "bg-[var(--ws-color-primary)]" : "bg-[var(--ws-color-success)]"}`}>
                        {isQ ? "Q" : "A"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="mr-1.5 text-xs text-text-tertiary">
                          {dayjs(msg.created_at).format("HH:mm:ss")}
                        </span>
                        <span className="break-words">{msg.content}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      },
    },
  ];

  const chainsTable = useReactTable({
    data: chainsPagedData,
    columns: chainColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search bar — matching hot tab */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-[340px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input placeholder="搜索学生或问题..." value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button variant="default" size="sm" className="h-9" onClick={() => window.open("/task-analysis/new", "_blank")}>+ 开始分析</Button>
      </div>

      {/* Beam chart */}
      {chains.length > 0 && (
        <div className="flex-none rounded-lg border border-border bg-surface p-3 mb-3">
          <StudentBeamChart sessions={chains} />
        </div>
      )}

      {/* Chains table */}
      <div className="flex-1 min-h-0 rounded-lg border border-border-secondary bg-surface-1 overflow-hidden">
        <AdminTablePanel loading={loadingChains} isEmpty={chains.length === 0} emptyDescription="暂无学生提问链条数据，请先查询">
          <DataTable table={chainsTable} className="h-full !overflow-visible !rounded-none !border-0" tableClassName="min-w-[1100px]" />
        </AdminTablePanel>
      </div>
        <div className="flex-none flex justify-end pt-2">
          <DataTablePagination
            currentPage={chainsPage}
            totalPages={Math.max(1, Math.ceil(chains.length / chainsPageSize))}
            total={chains.length}
            pageSize={chainsPageSize}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            onPageChange={(nextPage, nextPageSize) => {
              if (nextPageSize && nextPageSize !== chainsPageSize) {
                setChainsPageSize(nextPageSize);
                setChainsPage(1);
                return;
              }
              setChainsPage(nextPage);
            }}
          />
        </div>
      </div>
  );
};
