/**
 * 答题统计页 - /admin/assessment/:id/statistics
 */
import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  FlaskConical,
  Loader2,
  Redo,
  Search,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminPage } from "@components/Admin";
import EmptyState from "@components/Common/EmptyState";
import RadarChart from "@components/RadarChart";
import {
  BasicProfileView,
  AdvancedProfileView,
  AdvancedProfileEmpty,
} from "@components/ProfileView";
import {
  assessmentSessionApi,
  assessmentConfigApi,
  profileApi,
  type StatisticsResponse,
  type SessionListItem,
  type SessionListResponse,
  type StudentProfile,
} from "@services/assessment";
import type {
  SessionResultResponse,
  AnswerDetailResponse,
  BasicProfileResponse,
} from "@services/assessment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

const FILTER_ALL = "__all__";

type RadarPick =
  | { type: "all" }
  | { type: "class"; value: string }
  | { type: "student"; value: number };

type RadarOption = {
  label: string;
  value: string;
  group: string;
};

const statusMap: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  in_progress: { label: "答题中", variant: "sky" },
  submitted: { label: "已提交", variant: "warning" },
  graded: { label: "已评分", variant: "success" },
};

const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const item = statusMap[status] || {
    label: status,
    variant: "neutral" as const,
  };
  return <Badge variant={item.variant}>{item.label}</Badge>;
};

const StatisticsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const configId = Number(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [configTitle, setConfigTitle] = useState("");
  const [stats, setStats] = useState<StatisticsResponse | null>(null);

  const [classNames, setClassNames] = useState<string[]>([]);
  const [filterClass, setFilterClass] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");
  const [searchValue, setSearchValue] = useState("");

  const [radarLeft, setRadarLeft] = useState<RadarPick>({ type: "all" });
  const [radarRight, setRadarRight] = useState<RadarPick | null>(null);
  const [radarLeftData, setRadarLeftData] = useState<{ name: string; data: Record<string, number> } | null>(null);
  const [radarRightData, setRadarRightData] = useState<{ name: string; data: Record<string, number> } | null>(null);
  const [allGradedStudents, setAllGradedStudents] = useState<{ id: number; user_name: string; class_name: string | null }[]>([]);

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [batchRetesting, setBatchRetesting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<SessionResultResponse | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState<BasicProfileResponse | null>(null);
  const [advancedProfile, setAdvancedProfile] = useState<StudentProfile | null>(null);
  const [profileTab, setProfileTab] = useState<"basic" | "advanced">("basic");
  const [generatingProfile, setGeneratingProfile] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [configAgentId, setConfigAgentId] = useState<number | null>(null);

  useEffect(() => {
    assessmentSessionApi.getClassNames(configId).then(setClassNames).catch(() => setClassNames([]));
  }, [configId]);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const [statsResp, configResp] = await Promise.all([
        assessmentSessionApi.getStatistics(configId, { class_name: filterClass }),
        assessmentConfigApi.get(configId),
      ]);
      setStats(statsResp);
      setConfigTitle(configResp.title);
      setConfigAgentId(configResp.agent_id ?? null);
    } catch (e: any) {
      showMessage.error(e.message || "加载统计数据失败");
    } finally {
      setLoading(false);
    }
  }, [configId, filterClass]);

  const loadSessions = useCallback(async () => {
    try {
      setListLoading(true);
      const resp: SessionListResponse = await assessmentSessionApi.getConfigSessions(configId, {
        skip: (page - 1) * pageSize,
        limit: pageSize,
        class_name: filterClass,
        status: filterStatus,
        search: searchValue || undefined,
      });
      setSessions(resp.items);
      setTotal(resp.total);
    } catch (e: any) {
      showMessage.error(e.message || "加载答题列表失败");
    } finally {
      setListLoading(false);
    }
  }, [configId, page, pageSize, filterClass, filterStatus, searchValue]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    setPage(1);
    setSelectedRowKeys([]);
  }, [filterClass, filterStatus, searchValue]);

  useEffect(() => {
    assessmentSessionApi
      .getConfigSessions(configId, { limit: 100, status: "graded" })
      .then((resp) =>
        setAllGradedStudents(
          resp.items
            .filter((session) => session.user_name)
            .map((session) => ({
              id: session.id,
              user_name: session.user_name!,
              class_name: session.class_name,
            })),
        ),
      )
      .catch(() => {
        setAllGradedStudents([]);
      });
  }, [configId]);

  const loadRadarPick = useCallback(
    async (pick: RadarPick): Promise<{ name: string; data: Record<string, number> } | null> => {
      if (pick.type === "all") {
        const response = await assessmentSessionApi.getStatistics(configId, {});
        return {
          name: "全部数据",
          data: (response.knowledge_rates || {}) as Record<string, number>,
        };
      }
      if (pick.type === "class") {
        const response = await assessmentSessionApi.getStatistics(configId, {
          class_name: pick.value,
        });
        return {
          name: pick.value,
          data: (response.knowledge_rates || {}) as Record<string, number>,
        };
      }
      if (pick.type === "student") {
        const profile = await assessmentSessionApi.getAdminBasicProfile(pick.value);
        const knowledgePoints: Record<string, number> = {};
        if (profile.knowledge_scores) {
          try {
            const raw = JSON.parse(profile.knowledge_scores);
            for (const [key, value] of Object.entries(raw)) {
              const score = value as any;
              knowledgePoints[key] = score.total > 0 ? Math.round((score.earned / score.total) * 100) : 0;
            }
          } catch {}
        }
        const student = allGradedStudents.find((item) => item.id === pick.value);
        return {
          name: student?.user_name || `学生#${pick.value}`,
          data: knowledgePoints,
        };
      }
      return null;
    },
    [configId, allGradedStudents],
  );

  useEffect(() => {
    let cancelled = false;
    void loadRadarPick(radarLeft)
      .then((data) => {
        if (!cancelled) setRadarLeftData(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [radarLeft, loadRadarPick]);

  useEffect(() => {
    if (!radarRight) {
      setRadarRightData(null);
      return;
    }
    let cancelled = false;
    void loadRadarPick(radarRight)
      .then((data) => {
        if (!cancelled) setRadarRightData(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [radarRight, loadRadarPick]);

  const handleViewDetail = async (sessionId: number) => {
    try {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailData(await assessmentSessionApi.getSessionDetail(sessionId));
    } catch (e: any) {
      showMessage.error(e.message || "加载答题详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewProfile = async (sessionId: number, userId: number) => {
    try {
      setProfileOpen(true);
      setProfileLoading(true);
      setProfileTab("basic");
      setProfileUserId(userId);
      setAdvancedProfile(null);
      const [basic, advancedResp] = await Promise.all([
        assessmentSessionApi.getAdminBasicProfile(sessionId),
        profileApi.list({ target_id: String(userId), limit: 1 }).catch(() => ({ items: [] })),
      ]);
      setProfileData(basic);
      setAdvancedProfile(advancedResp.items.length > 0 ? advancedResp.items[0] : null);
    } catch (e: any) {
      showMessage.error(e.message || "加载画像失败");
      setProfileOpen(false);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAllowRetest = async (sessionId: number) => {
    if (!window.confirm("允许该学生重新测试？")) return;
    try {
      await assessmentSessionApi.allowRetest(sessionId);
      showMessage.success("已允许重新测试");
      await Promise.all([loadSessions(), loadStats()]);
    } catch (e: any) {
      showMessage.error(e.message || "操作失败");
    }
  };

  const handleBatchRetest = async (mode: "class" | "selection") => {
    setBatchRetesting(true);
    try {
      const params = mode === "class" ? { class_name: filterClass! } : { session_ids: selectedRowKeys.map(Number) };
      const result = await assessmentSessionApi.batchRetest(configId, params);
      showMessage.success(result.message || `已删除 ${result.deleted_count} 条记录`);
      setSelectedRowKeys([]);
      await Promise.all([loadSessions(), loadStats()]);
    } catch (e: any) {
      showMessage.error(e.message || "批量重测失败");
    } finally {
      setBatchRetesting(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await assessmentSessionApi.exportXlsx(configId, {
        class_name: filterClass,
        status: filterStatus,
        search: searchValue || undefined,
      });
      showMessage.success("导出成功");
    } catch (e: any) {
      showMessage.error(e.message || "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateProfile = async () => {
    if (!profileUserId || !configAgentId) {
      showMessage.warning("缺少配置信息，无法生成画像");
      return;
    }

    setGeneratingProfile(true);
    try {
      const result = await profileApi.generate({
        profile_type: "individual",
        target_id: String(profileUserId),
        config_id: configId,
        agent_id: configAgentId,
      });
      setAdvancedProfile(result);
      setProfileTab("advanced");
      showMessage.success("三维画像生成成功");
    } catch (e: any) {
      showMessage.error(e.message || "生成画像失败");
    } finally {
      setGeneratingProfile(false);
    }
  };

  const handleBatchGenerateProfiles = async () => {
    if (!configAgentId) {
      showMessage.warning("该测评未配置 AI 智能体，无法生成画像");
      return;
    }

    setBatchGenerating(true);
    try {
      const gradedSessions = await assessmentSessionApi.getConfigSessions(configId, {
        limit: 100,
        status: "graded",
        class_name: filterClass,
      });
      const userIds = gradedSessions.items
        .map((session) => session.user_id)
        .filter((value, index, arr) => arr.indexOf(value) === index);

      if (userIds.length === 0) {
        showMessage.info("没有已评分的学生");
        return;
      }

      const result = await profileApi.batchGenerate({
        user_ids: userIds,
        config_id: configId,
        agent_id: configAgentId,
      });
      showMessage.success(`已为 ${result.count} 名学生生成画像`);
    } catch (e: any) {
      showMessage.error(e.message || "批量生成失败");
    } finally {
      setBatchGenerating(false);
    }
  };

  const radarSeries = useMemo(() => {
    const arr: { name: string; data: Record<string, number> }[] = [];
    if (radarLeftData && Object.keys(radarLeftData.data).length > 0) arr.push(radarLeftData);
    if (radarRightData && Object.keys(radarRightData.data).length > 0) arr.push(radarRightData);
    return arr;
  }, [radarLeftData, radarRightData]);

  const radarOptions = useMemo<RadarOption[]>(() => {
    const options: RadarOption[] = [{ group: "汇总", label: "全部数据", value: "all" }];
    classNames.forEach((className) => {
      options.push({ group: "按班级", label: className, value: `class:${className}` });
    });
    allGradedStudents.forEach((student) => {
      options.push({
        group: "按学生",
        label: `${student.user_name}${student.class_name ? ` (${student.class_name})` : ""}`,
        value: `student:${student.id}`,
      });
    });
    return options;
  }, [classNames, allGradedStudents]);

  const parsePickerValue = (value: string): RadarPick => {
    if (value === "all") return { type: "all" };
    if (value.startsWith("class:")) return { type: "class", value: value.slice(6) };
    if (value.startsWith("student:")) return { type: "student", value: Number(value.slice(8)) };
    return { type: "all" };
  };

  const pickToValue = (pick: RadarPick | null): string | undefined => {
    if (!pick) return undefined;
    if (pick.type === "all") return "all";
    if (pick.type === "class") return `class:${pick.value}`;
    if (pick.type === "student") return `student:${pick.value}`;
    return undefined;
  };

  const statItems = stats
    ? [
        { icon: <Users className="h-3.5 w-3.5" />, label: "参与人数", value: stats.total_students, color: "var(--ws-color-primary)" },
        { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "已评分", value: stats.submitted_count, color: "var(--ws-color-success)" },
        { icon: <BarChart3 className="h-3.5 w-3.5" />, label: "平均分", value: stats.avg_score != null ? stats.avg_score.toFixed(1) : "-", color: "var(--ws-color-secondary)" },
        { icon: <Trophy className="h-3.5 w-3.5" />, label: "最高分", value: stats.max_score ?? "-", color: "var(--ws-color-warning)" },
        { label: "最低分", value: stats.min_score ?? "-", color: "var(--ws-color-error)" },
        { label: "通过率", value: stats.pass_rate != null ? `${(stats.pass_rate * 100).toFixed(0)}%` : "-", color: "var(--ws-color-success)" },
      ]
    : [];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const selectableSessionIds = useMemo(
    () => sessions.filter((s) => ["graded", "submitted"].includes(s.status)).map((s) => s.id),
    [sessions],
  );

  const allSelectableChecked =
    selectableSessionIds.length > 0 && selectableSessionIds.every((sessionId) => selectedRowKeys.includes(sessionId));

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      setSelectedRowKeys([]);
      return;
    }
    setSelectedRowKeys(selectableSessionIds);
  };

  const toggleSelectOne = (sessionId: number, checked: boolean) => {
    setSelectedRowKeys((prev) => {
      if (checked) {
        if (prev.includes(sessionId)) return prev;
        return [...prev, sessionId];
      }
      return prev.filter((id) => id !== sessionId);
    });
  };

  const sessionColumns: ColumnDef<SessionListItem>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={allSelectableChecked}
          onChange={toggleSelectAll}
          disabled={selectableSessionIds.length === 0}
          className="h-3.5 w-3.5 rounded border border-border-secondary accent-primary"
          aria-label="全选可重测学生"
        />
      ),
      size: 36,
      meta: { className: "w-[36px]" },
      cell: ({ row }) => {
        const selectable = ["graded", "submitted"].includes(row.original.status);
        const checked = selectedRowKeys.includes(row.original.id);
        return (
          <input
            type="checkbox"
            checked={checked}
            disabled={!selectable}
            onChange={(event) => toggleSelectOne(row.original.id, event.target.checked)}
            className="h-3.5 w-3.5 rounded border border-border-secondary accent-primary"
            aria-label={`选择学生 ${row.original.user_name || row.original.id}`}
          />
        );
      },
    },
    {
      id: "user_name",
      header: "学生",
      accessorKey: "user_name",
      size: 120,
      meta: { className: "w-[120px]" },
      cell: ({ row }) => row.original.user_name || "-",
    },
    {
      id: "class_name",
      header: "班级",
      accessorKey: "class_name",
      size: 120,
      meta: { className: "w-[120px]" },
      cell: ({ row }) => row.original.class_name || "-",
    },
    {
      id: "status",
      header: "状态",
      accessorKey: "status",
      size: 100,
      meta: { className: "w-[100px]" },
      cell: ({ row }) => <StatusTag status={row.original.status} />,
    },
    {
      id: "score",
      header: "得分",
      size: 120,
      meta: { className: "w-[120px]" },
      cell: ({ row }) =>
        row.original.earned_score != null
          ? `${row.original.earned_score}/${row.original.total_score}`
          : "-",
    },
    {
      id: "submitted_at",
      header: "提交时间",
      accessorKey: "submitted_at",
      size: 190,
      meta: { className: "w-[190px]" },
      cell: ({ row }) =>
        row.original.submitted_at
          ? new Date(row.original.submitted_at).toLocaleString("zh-CN")
          : "-",
    },
    {
      id: "actions",
      header: "操作",
      size: 220,
      meta: { className: "w-[220px]" },
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="link"
            className="h-6 px-1.5"
            onClick={() => {
              void handleViewDetail(row.original.id);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            详情
          </Button>
          {(row.original.status === "graded" || row.original.status === "submitted") && (
            <Button
              size="sm"
              variant="link"
              className="h-6 px-1.5"
              onClick={() => {
                void handleViewProfile(row.original.id, row.original.user_id);
              }}
            >
              <User className="h-3.5 w-3.5" />
              画像
            </Button>
          )}
          {(row.original.status === "graded" || row.original.status === "submitted") && (
            <Button
              size="sm"
              variant="link"
              className="h-6 px-1.5"
              onClick={() => {
                void handleAllowRetest(row.original.id);
              }}
            >
              <Redo className="h-3.5 w-3.5" />
              重测
            </Button>
          )}
        </div>
      ),
    },
  ];

  const sessionTable = useReactTable({
    data: listLoading ? [] : sessions,
    columns: sessionColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const onSearchSubmit = () => {
    setSearchValue(searchText.trim());
  };

  return (
    <AdminPage scrollable>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <Button variant="outline" onClick={() => navigate("/admin/assessment")}>
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <span className="text-xl font-semibold">{configTitle || "答题统计"}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
        </div>
      ) : stats ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {statItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg bg-surface-2 px-3.5 py-2.5">
                <div className="text-xs text-text-tertiary">
                  {item.icon ? <span className="mr-1 inline-block align-middle">{item.icon}</span> : null}
                  <span className="align-middle">{item.label}</span>
                </div>
                <div className="text-lg font-bold" style={{ color: item.color }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <Select value={filterClass || FILTER_ALL} onValueChange={(value) => setFilterClass(value === FILTER_ALL ? undefined : value)}>
              <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="班级" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>全部班级</SelectItem>
                {classNames.map((className) => <SelectItem key={className} value={className}>{className}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterStatus || FILTER_ALL} onValueChange={(value) => setFilterStatus(value === FILTER_ALL ? undefined : value)}>
              <SelectTrigger className="h-8 w-[120px]"><SelectValue placeholder="状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>全部状态</SelectItem>
                <SelectItem value="in_progress">答题中</SelectItem>
                <SelectItem value="submitted">已提交</SelectItem>
                <SelectItem value="graded">已评分</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <Input
                value={searchText}
                placeholder="搜索学生"
                className="h-8 w-[190px]"
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSearchSubmit();
                  }
                }}
              />
              <Button size="sm" variant="outline" onClick={onSearchSubmit}><Search className="h-3.5 w-3.5" /></Button>
            </div>

            <div className="flex-1" />

            {filterClass && (
              <Button
                variant="outline"
                disabled={batchRetesting}
                onClick={() => {
                  if (!window.confirm(`确定让「${filterClass}」全班重新测试？`)) return;
                  void handleBatchRetest("class");
                }}
              >
                <Redo className="h-3.5 w-3.5" />
                全班重测
              </Button>
            )}

            <Button
              variant="outline"
              disabled={batchGenerating}
              onClick={() => {
                const msg = filterClass ? `为「${filterClass}」已评分学生生成三维画像？` : "为所有已评分学生生成三维画像？";
                if (!window.confirm(msg)) return;
                void handleBatchGenerateProfiles();
              }}
            >
              {batchGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              批量生成画像
            </Button>

            <Button variant="outline" disabled={exporting} onClick={() => { void handleExport(); }}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              导出
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card className="overflow-hidden border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <span className="text-sm font-semibold">学生答题列表{total > 0 ? ` (${total})` : ""}</span>
                {selectedRowKeys.length > 0 && (
                  <>
                    <Badge variant="info">{selectedRowKeys.length} 已选</Badge>
                    <Button
                      size="sm"
                      variant="link"
                      className="h-6 px-1.5"
                      disabled={batchRetesting}
                      onClick={() => {
                        if (!window.confirm(`确定让选中的 ${selectedRowKeys.length} 名学生重新测试？`)) return;
                        void handleBatchRetest("selection");
                      }}
                    >批量重测</Button>
                    <Button size="sm" variant="link" className="h-6 px-1.5" onClick={() => setSelectedRowKeys([])}>取消</Button>
                  </>
                )}
              </div>

              <DataTable
                table={sessionTable}
                className="border-0"
                tableClassName="min-w-[860px]"
                emptyState={
                  listLoading ? (
                    <div className="py-10 text-center text-sm text-text-tertiary">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在加载...
                      </span>
                    </div>
                  ) : (
                    <div className="py-10">
                      <EmptyState description="暂无答题记录" />
                    </div>
                  )
                }
              />

              <div className="mt-2 flex justify-end border-t border-border-secondary pt-3">
                <DataTablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  total={total}
                  pageSize={pageSize}
                  pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
                  onPageChange={(nextPage, nextPageSize) => {
                    if (nextPageSize && nextPageSize !== pageSize) {
                      setPageSize(nextPageSize);
                    }
                    setPage(nextPage);
                    setSelectedRowKeys([]);
                  }}
                />
              </div>
            </Card>

            <Card className="overflow-hidden border border-border bg-surface">
              <div className="border-b border-border px-3 py-2 text-sm font-semibold">知识点掌握率</div>
              <div className="space-y-2 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={pickToValue(radarLeft) || FILTER_ALL} onValueChange={(value) => setRadarLeft(parsePickerValue(value))}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="选择数据" /></SelectTrigger>
                    <SelectContent>
                      {radarOptions.map((option) => (<SelectItem key={`left-${option.value}`} value={option.value}>{`${option.group} · ${option.label}`}</SelectItem>))}
                    </SelectContent>
                  </Select>

                  <Select value={pickToValue(radarRight) || FILTER_ALL} onValueChange={(value) => setRadarRight(value === FILTER_ALL ? null : parsePickerValue(value))}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="对比" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FILTER_ALL}>不对比</SelectItem>
                      {radarOptions.map((option) => (<SelectItem key={`right-${option.value}`} value={option.value}>{`${option.group} · ${option.label}`}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                {radarSeries.length > 0 && radarSeries.some((series) => Object.keys(series.data).length > 0)
                  ? <RadarChart series={radarSeries} size={280} />
                  : <EmptyState description="暂无知识点数据" />}
              </div>
            </Card>
          </div>
        </>
      ) : null}

      <Dialog
        open={detailOpen}
        onOpenChange={(next) => {
          if (!next) {
            setDetailOpen(false);
            setDetailData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[780px]">
          <DialogHeader>
            <DialogTitle>答题详情</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-text-tertiary" /></div>
          ) : detailData ? (
            <div className="space-y-3">
              <div className="grid gap-2 rounded-lg bg-surface-2 p-3 text-sm md:grid-cols-2">
                <div><span className="text-text-tertiary">状态：</span><StatusTag status={detailData.status} /></div>
                <div><span className="text-text-tertiary">得分：</span><span>{detailData.earned_score ?? "-"} / {detailData.total_score}</span></div>
                <div><span className="text-text-tertiary">开始时间：</span><span>{detailData.started_at ? new Date(detailData.started_at).toLocaleString("zh-CN") : "-"}</span></div>
                <div><span className="text-text-tertiary">提交时间：</span><span>{detailData.submitted_at ? new Date(detailData.submitted_at).toLocaleString("zh-CN") : "-"}</span></div>
              </div>

              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {detailData.answers.map((answer: AnswerDetailResponse, index: number) => (
                  <details key={answer.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                    <summary className="cursor-pointer select-none text-sm font-medium">
                      <span>{`第${index + 1}题`}</span>
                      <span className="ml-2 inline-flex items-center gap-1">
                        <Badge variant="secondary">{answer.question_type}</Badge>
                        {answer.is_correct === true ? <Badge variant="success">正确</Badge> : null}
                        {answer.is_correct === false ? <Badge variant="danger">错误</Badge> : null}
                        {answer.earned_score != null ? <span className="text-xs text-text-tertiary">{answer.earned_score}/{answer.max_score}分</span> : null}
                      </span>
                    </summary>

                    <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-text-secondary">
                      <p><strong>题目：</strong>{answer.content}</p>
                      {answer.options ? <p><strong>选项：</strong>{answer.options}</p> : null}
                      <p><strong>学生答案：</strong>{answer.student_answer || "（未作答）"}</p>
                      <p><strong>正确答案：</strong>{answer.correct_answer}</p>
                      {answer.explanation ? <p><strong>解析：</strong>{answer.explanation}</p> : null}
                      {answer.ai_feedback ? <p><strong>AI反馈：</strong>{answer.ai_feedback}</p> : null}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={profileOpen}
        onOpenChange={(next) => {
          if (!next) {
            setProfileOpen(false);
            setProfileData(null);
            setAdvancedProfile(null);
          }
        }}
      >
        <DialogContent className="p-0 sm:max-w-[780px]">
          {profileLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-text-tertiary" /></div>
          ) : (
            <div className="p-4">
              <Tabs value={profileTab} onValueChange={(value) => setProfileTab(value as "basic" | "advanced")}>
                <TabsList className="mb-2">
                  <TabsTrigger value="basic">初级画像</TabsTrigger>
                  <TabsTrigger value="advanced">三维画像</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="mt-0">
                  {profileData ? <div className="pb-2"><BasicProfileView data={profileData} /></div> : <EmptyState description="暂无初级画像数据" />}
                </TabsContent>

                <TabsContent value="advanced" className="mt-0">
                  {advancedProfile
                    ? <div className="pb-2"><AdvancedProfileView profile={advancedProfile} /></div>
                    : <AdvancedProfileEmpty onGenerate={handleGenerateProfile} loading={generatingProfile} />}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
};

export default StatisticsPage;
