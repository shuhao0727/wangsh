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
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import dayjs from "dayjs";
import aiAgentsApi from "@services/znt/api/ai-agents-api";
import { agentDataApi } from "@services/znt/api";
import type { AIAgent } from "@services/znt/types";
import { AdminTablePanel } from "@components/Admin";
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
};

type ChainFilters = {
  agent_id: string;
  start_at: string;
  end_at: string;
  class_name: string;
  student_id: string;
  limit_sessions: number;
};

const toLocalDateTimeInput = (value: dayjs.Dayjs) => value.format("YYYY-MM-DDTHH:mm");

const defaultRange = () => {
  const now = dayjs();
  return {
    start_at: toLocalDateTimeInput(now.subtract(1, "hour")),
    end_at: toLocalDateTimeInput(now),
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
      cachedAgentsPromise
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
    load();
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
  }));

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
      });
      if (!res.success) {
        showMessage.error(res.message || "获取热点问题失败");
        setHotData([]);
        return;
      }
      setHotData(res.data);
      setHotPage(1);
    } catch (error: any) {
      showMessage.error(error?.message || "查询失败");
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
    } catch (error: any) {
      showMessage.error(error?.message || "导出失败");
    } finally {
      setExportingHot(false);
    }
  };

  const hotColumns: ColumnDef<HotBucket>[] = [
    {
      id: "bucket_start",
      header: "时间段",
      accessorKey: "bucket_start",
      size: 220,
      meta: { className: "w-[220px]" },
      cell: ({ row }) => dayjs(row.original.bucket_start).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      id: "question_count",
      header: "提问数",
      accessorKey: "question_count",
      size: 110,
      meta: { className: "w-[110px]" },
    },
    {
      id: "unique_students",
      header: "活跃学生",
      accessorKey: "unique_students",
      size: 120,
      meta: { className: "w-[120px]" },
    },
    {
      id: "top_questions",
      header: "Top问题",
      accessorKey: "top_questions",
      cell: ({ row }) => (
        <div className="space-y-1">
          {(row.original.top_questions || []).slice(0, 3).map((item, idx) => (
            <div key={`${item.question}-${idx}`} className="text-sm">
              <span>
                {idx + 1}. {item.question}
              </span>
              <span className="text-text-tertiary">（{item.count}）</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const hotTable = useReactTable({
    data: hotPagedData,
    columns: hotColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none py-2">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="space-y-1 md:col-span-3">
            <div className="text-xs text-text-secondary">智能体</div>
            <Select
              value={filters.agent_id || "__empty__"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, agent_id: value === "__empty__" ? "" : value }))
              }
              disabled={loadingAgents}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingAgents ? "加载中..." : "选择智能体"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">请选择智能体</SelectItem>
                {agentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="text-xs text-text-secondary">开始时间</div>
            <Input
              type="datetime-local"
              value={filters.start_at}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, start_at: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="text-xs text-text-secondary">结束时间</div>
            <Input
              type="datetime-local"
              value={filters.end_at}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, end_at: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-1">
            <div className="text-xs text-text-secondary">时间桶(秒)</div>
            <Input
              type="number"
              min={1}
              value={String(filters.bucket_seconds)}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  bucket_seconds: Number(e.target.value || 1),
                }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-1">
            <div className="text-xs text-text-secondary">TopN</div>
            <Input
              type="number"
              min={1}
              value={String(filters.top_n)}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  top_n: Number(e.target.value || 1),
                }))
              }
            />
          </div>
          <div className="flex gap-2 md:col-span-3 md:items-end md:justify-end">
            <Button onClick={loadHot} disabled={loadingHot}>
              {loadingHot ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              查询
            </Button>
            <Button variant="outline" onClick={exportHot} disabled={exportingHot || loadingHot}>
              {exportingHot ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              导出
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <AdminTablePanel
            loading={loadingHot}
            isEmpty={hotData.length === 0}
            emptyDescription="暂无热点问题数据，请先查询"
          >
            <DataTable table={hotTable} className="h-full" />
          </AdminTablePanel>
        </div>
        <div className="mt-auto flex justify-end border-t border-border-secondary pt-3">
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
    limit_sessions: 5,
  }));

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
    } catch (error: any) {
      showMessage.error(error?.message || "查询失败");
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
    } catch (error: any) {
      showMessage.error(error?.message || "导出失败");
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
            className="inline-flex h-7 w-7 appearance-none items-center justify-center rounded-md border border-border bg-transparent text-text-secondary hover:bg-[var(--ws-color-hover-bg)]"
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
      id: "class_name",
      header: "班级",
      accessorKey: "class_name",
      size: 140,
      meta: { className: "w-[140px]" },
      cell: ({ row }) => row.original.class_name || "-",
    },
    {
      id: "student_id",
      header: "学号",
      accessorKey: "student_id",
      size: 120,
      meta: { className: "w-[120px]" },
      cell: ({ row }) => row.original.student_id || "-",
    },
    {
      id: "user_name",
      header: "姓名",
      accessorKey: "user_name",
      size: 100,
      meta: { className: "w-[100px]" },
      cell: ({ row }) => row.original.user_name || "-",
    },
    {
      id: "session_id",
      header: "会话ID",
      accessorKey: "session_id",
      size: 260,
      meta: { className: "w-[260px]" },
    },
    {
      id: "last_at",
      header: "最后时间",
      accessorKey: "last_at",
      size: 180,
      meta: { className: "w-[180px]" },
      cell: ({ row }) => dayjs(row.original.last_at).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      id: "turns",
      header: "轮数",
      accessorKey: "turns",
      size: 80,
      meta: { className: "w-[80px]" },
    },
    {
      id: "content",
      header: "内容",
      cell: ({ row }) => {
        const record = row.original;
        const expanded = Boolean(expandedSessions[record.session_id]);
        const preview = record.messages
          .filter((msg) => msg.message_type === "question")
          .slice(0, 1)[0]?.content;
        return (
          <div className="space-y-1">
            <div>{preview || "（空）"}</div>
            {expanded ? (
              <div className="space-y-1 rounded bg-surface-2 px-2 py-1.5">
                {record.messages.map((msg) => (
                  <div key={msg.id} className="text-sm">
                    <span className="font-medium">
                      {msg.message_type === "question" ? "Q" : "A"}
                    </span>
                    <span className="mx-1 text-text-tertiary">
                      {dayjs(msg.created_at).format("HH:mm:ss")}
                    </span>
                    <span>{msg.content}</span>
                  </div>
                ))}
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
      <div className="flex-none py-2">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.45fr)_minmax(0,1.45fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] md:items-end">
          <div className="space-y-1">
            <div className="text-xs text-text-secondary">智能体</div>
            <Select
              value={filters.agent_id || "__empty__"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, agent_id: value === "__empty__" ? "" : value }))
              }
              disabled={loadingAgents}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingAgents ? "加载中..." : "选择智能体"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">请选择智能体</SelectItem>
                {agentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-text-secondary">开始时间</div>
            <Input
              type="datetime-local"
              value={filters.start_at}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, start_at: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-text-secondary">结束时间</div>
            <Input
              type="datetime-local"
              value={filters.end_at}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, end_at: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-text-secondary">会话数</div>
            <Input
              type="number"
              min={1}
              value={String(filters.limit_sessions)}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  limit_sessions: Number(e.target.value || 1),
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-text-secondary">班级</div>
            <Input
              placeholder="高一(1)班"
              value={filters.class_name}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, class_name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-text-secondary">学号</div>
            <Input
              placeholder="20250001"
              value={filters.student_id}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, student_id: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2 md:justify-end">
            <Button onClick={loadChains} disabled={loadingChains}>
              {loadingChains ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              查询
            </Button>
            <Button variant="outline" onClick={exportChains} disabled={exportingChains || loadingChains}>
              {exportingChains ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              导出
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <AdminTablePanel
            loading={loadingChains}
            isEmpty={chains.length === 0}
            emptyDescription="暂无学生提问链条数据，请先查询"
          >
            <DataTable table={chainsTable} className="h-full" tableClassName="min-w-[1100px]" />
          </AdminTablePanel>
        </div>
        <div className="mt-auto flex justify-end border-t border-border-secondary pt-3">
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
    </div>
  );
};
