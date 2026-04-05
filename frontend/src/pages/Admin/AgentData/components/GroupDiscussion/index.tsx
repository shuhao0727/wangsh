import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useAdminSSE } from "@hooks/useAdminSSE";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import dayjs from "dayjs";
import { aiAgentsApi, groupDiscussionApi } from "@services/agents";
import { userApi } from "@services/users";
import type { User } from "@services/users";
import type { AIAgent } from "@services/znt/types";
import type { GroupDiscussionMember } from "@services/znt/api/group-discussion-api";
import { AdminCard, AdminTablePanel } from "@components/Admin";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

type SessionRow = {
  id: number;
  session_date: string;
  class_name: string;
  group_no: string;
  group_name?: string | null;
  message_count: number;
  created_at: string;
  last_message_at?: string | null;
};

type MessageRow = {
  id: number;
  session_id: number;
  user_id: number;
  user_display_name: string;
  content: string;
  created_at: string;
};

type AnalysisFormState = {
  agentId: string;
  analysisType: string;
  prompt: string;
};

type CompareFormState = {
  agentId: string;
  bucketSeconds: number;
  analysisType: string;
  prompt: string;
};

const createAnalysisFormState = (agentId: number | null): AnalysisFormState => ({
  agentId: agentId ? String(agentId) : "",
  analysisType: "learning_topics",
  prompt: "",
});

const createCompareFormState = (
  agentId: number | null,
  analysisType: "learning_compare" | "cross_system",
): CompareFormState => ({
  agentId: agentId ? String(agentId) : "",
  bucketSeconds: 180,
  analysisType,
  prompt: "",
});

const GroupDiscussionAdminTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [frontendVisible, setFrontendVisible] = useState(true);
  const [frontendVisibleLoading, setFrontendVisibleLoading] = useState(false);

  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().format("YYYY-MM-DD"),
    dayjs().format("YYYY-MM-DD"),
  ]);
  const [className, setClassName] = useState<string>("");
  const [groupNo, setGroupNo] = useState<string>("");
  const [groupName, setGroupName] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);

  const [currentSession, setCurrentSession] = useState<SessionRow | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [members, setMembers] = useState<GroupDiscussionMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionModalTab, setSessionModalTab] = useState<string>("messages");

  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [analysisForm, setAnalysisForm] = useState<AnalysisFormState>(() => createAnalysisFormState(null));
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [analyses, setAnalyses] = useState<
    Array<{
      id: number;
      agent_id: number;
      analysis_type: string;
      result_text: string;
      created_at: string;
      prompt: string;
    }>
  >([]);

  const [compareVisible, setCompareVisible] = useState(false);
  const [compareForm, setCompareForm] = useState<CompareFormState>(() => createCompareFormState(null, "learning_compare"));
  const [compareState, setCompareState] = useState<{
    loading: boolean;
    result: string;
    lastAnalysisId: number | null;
    useCache: boolean;
  }>({ loading: false, result: "", lastAnalysisId: null, useCache: true });

  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const [userSearchKeyword, setUserSearchKeyword] = useState("");
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  const [muteState, setMuteState] = useState<{
    visible: boolean;
    target: GroupDiscussionMember | null;
    durationType: "10m" | "1h" | "24h" | "custom";
    customMinutes: number;
    loading: boolean;
  }>({ visible: false, target: null, durationType: "10m", customMinutes: 10, loading: false });

  const [profileDialog, setProfileDialog] = useState<{
    visible: boolean;
    title: string;
    content: string;
  }>({ visible: false, title: "", content: "" });
  const [profileLoadingUserId, setProfileLoadingUserId] = useState<number | null>(null);

  const resetAnalysisForm = useCallback((analysisType: string = "learning_topics") => {
    setAnalysisForm({
      agentId: selectedAgentId ? String(selectedAgentId) : "",
      analysisType,
      prompt: "",
    });
  }, [selectedAgentId]);

  const loadAgents = useCallback(async () => {
    const res = await aiAgentsApi.getAgents({ limit: 200 });
    if (!res.success) return;
    setAgents(res.data.items || []);
  }, []);

  const loadPublicConfig = useCallback(async () => {
    setFrontendVisibleLoading(true);
    try {
      const res = await groupDiscussionApi.getPublicConfig();
      if (!res.success) return;
      setFrontendVisible(Boolean(res.data.enabled));
    } finally {
      setFrontendVisibleLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await groupDiscussionApi.adminListSessions({
        startDate: dateRange[0] || undefined,
        endDate: dateRange[1] || undefined,
        className: className.trim() || undefined,
        groupNo: groupNo.trim() || undefined,
        groupName: groupName.trim() || undefined,
        userName: userName.trim() || undefined,
        page,
        size: pageSize,
      });
      if (!res.success) {
        showMessage.error(res.message || "加载失败");
        return;
      }
      setSessions(res.data.items || []);
      setTotal(res.data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [dateRange, className, groupNo, groupName, userName, page, pageSize]);

  const handleDeleteSession = useCallback(
    async (row: SessionRow) => {
      setDeletingSessionId(row.id);
      try {
        const res = await groupDiscussionApi.adminDeleteSession({ sessionId: row.id });
        if (!res.success) {
          showMessage.error(res.message || "删除失败");
          return;
        }
        if (currentSession?.id === row.id) {
          setSessionModalOpen(false);
          setCurrentSession(null);
          setMessages([]);
          setMembers([]);
          setAnalyses([]);
          setAnalysisResult("");
        }
        showMessage.success("删除成功");
        loadSessions();
      } finally {
        setDeletingSessionId(null);
      }
    },
    [currentSession?.id, loadSessions],
  );

  const handleBatchDeleteSessions = useCallback(async () => {
    if (!selectedSessionIds.length) return;
    setBatchDeleting(true);
    try {
      const res = await groupDiscussionApi.adminBatchDeleteSessions({ sessionIds: selectedSessionIds });
      if (!res.success) {
        showMessage.error(res.message || "删除失败");
        return;
      }
      if (currentSession?.id && selectedSessionIds.includes(currentSession.id)) {
        setSessionModalOpen(false);
        setCurrentSession(null);
        setMessages([]);
        setMembers([]);
        setAnalyses([]);
        setAnalysisResult("");
      }
      setSelectedSessionIds([]);
      showMessage.success(`已删除 ${res.data} 个会话`);
      loadSessions();
    } finally {
      setBatchDeleting(false);
    }
  }, [currentSession?.id, loadSessions, selectedSessionIds]);

  useEffect(() => {
    loadPublicConfig();
  }, [loadPublicConfig]);

  const loadMessages = useCallback(async () => {
    if (!currentSession) return;
    setMessagesLoading(true);
    try {
      const res = await groupDiscussionApi.adminListMessages({
        sessionId: currentSession.id,
        page: 1,
        size: 500,
      });
      if (!res.success) {
        showMessage.error(res.message || "加载消息失败");
        return;
      }
      setMessages(res.data.items || []);
    } finally {
      setMessagesLoading(false);
    }
  }, [currentSession]);

  const loadMembers = useCallback(async () => {
    if (!currentSession) return;
    setMembersLoading(true);
    try {
      const res = await groupDiscussionApi.adminListMembers({
        sessionId: currentSession.id,
      });
      if (!res.success) {
        showMessage.error(res.message || "加载成员失败");
        return;
      }
      setMembers(res.data.items || []);
    } finally {
      setMembersLoading(false);
    }
  }, [currentSession]);

  const loadAnalyses = useCallback(async () => {
    if (!currentSession) return;
    setAnalysesLoading(true);
    try {
      const res = await groupDiscussionApi.adminListAnalyses({
        sessionId: currentSession.id,
        limit: 20,
      });
      if (!res.success) {
        showMessage.error(res.message || "加载分析历史失败");
        return;
      }
      setAnalyses(res.data.items || []);
    } finally {
      setAnalysesLoading(false);
    }
  }, [currentSession]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useAdminSSE("discussion_changed", loadSessions);

  useEffect(() => {
    if (!sessionModalOpen) return;
    loadMessages();
    loadMembers();
    loadAnalyses();
  }, [sessionModalOpen, loadMessages, loadMembers, loadAnalyses]);

  const openSessionModal = useCallback((session: SessionRow, tab: "messages" | "analysis") => {
    setCurrentSession(session);
    setMessages([]);
    setAnalysisResult("");
    resetAnalysisForm("learning_topics");
    setSessionModalTab(tab);
    setSessionModalOpen(true);
  }, [resetAnalysisForm]);

  const handleAnalyze = async () => {
    if (!currentSession) return;
    if (!analysisForm.agentId) {
      showMessage.warning("请选择智能体");
      return;
    }
    try {
      setAnalysisLoading(true);
      const res = await groupDiscussionApi.adminAnalyze({
        sessionId: currentSession.id,
        agentId: Number(analysisForm.agentId),
        analysisType: analysisForm.analysisType || "learning_topics",
        prompt: analysisForm.prompt || undefined,
      });
      if (!res.success) {
        showMessage.error(res.message || "分析失败");
        return;
      }
      setAnalysisResult(res.data.result_text || "");
      showMessage.success("分析完成");
      loadAnalyses();
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleCompareAnalyze = async () => {
    if (selectedSessionIds.length < 2) {
      showMessage.warning("请至少选择2个会话");
      return;
    }
    if (!compareForm.agentId) {
      showMessage.warning("请选择智能体");
      return;
    }
    try {
      setCompareState((s) => ({ ...s, loading: true }));
      const res = await groupDiscussionApi.adminCompareAnalyze({
        sessionIds: selectedSessionIds,
        agentId: Number(compareForm.agentId),
        bucketSeconds: compareForm.bucketSeconds,
        analysisType: compareForm.analysisType,
        prompt: compareForm.prompt || undefined,
        useCache: compareState.useCache,
      });
      if (!res.success) {
        showMessage.error(res.message || "对比分析失败");
        return;
      }
      const nextId = Number(res.data.analysis_id || 0);
      if (compareState.useCache && compareState.lastAnalysisId && nextId === compareState.lastAnalysisId) {
        showMessage.success("对比分析完成（命中缓存）");
      } else {
        showMessage.success("对比分析完成");
      }
      setCompareState((s) => ({
        ...s,
        result: res.data.result_text || "",
        lastAnalysisId: Number.isFinite(nextId) && nextId > 0 ? nextId : s.lastAnalysisId,
      }));
    } finally {
      setCompareState((s) => ({ ...s, loading: false }));
    }
  };

  const handleStartCompare = async () => {
    if (compareForm.analysisType === "cross_system") {
      if (!compareForm.agentId) {
        showMessage.warning("请选择智能体");
        return;
      }
      setCompareState((s) => ({ ...s, loading: true, result: "" }));
      try {
        const res = await groupDiscussionApi.adminCrossSystemAnalyze({
          sessionIds: selectedSessionIds,
          agentId: Number(compareForm.agentId),
        });
        if (!res.success) {
          showMessage.error(res.message || "跨系统分析失败");
          return;
        }
        setCompareState((s) => ({ ...s, result: res.data.result_text || "" }));
        showMessage.success("跨系统分析完成");
      } catch {
        showMessage.error("跨系统分析失败");
      } finally {
        setCompareState((s) => ({ ...s, loading: false }));
      }
      return;
    }

    await handleCompareAnalyze();
  };

  const handleSearchUsers = useCallback(async (value: string) => {
    if (!value) {
      setSearchedUsers([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const res = await userApi.getUsers({ search: value, limit: 20 });
      setSearchedUsers(res.users || []);
    } finally {
      setUserSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!addMemberVisible) return;
    const keyword = userSearchKeyword.trim();
    if (!keyword) {
      setSearchedUsers([]);
      return;
    }

    const timer = window.setTimeout(() => {
      handleSearchUsers(keyword);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [addMemberVisible, userSearchKeyword, handleSearchUsers]);

  const handleAddMember = async () => {
    if (!currentSession || !selectedUserId) return;
    setAddMemberLoading(true);
    try {
      const res = await groupDiscussionApi.adminAddMember({
        sessionId: currentSession.id,
        userId: selectedUserId,
      });
      if (res.success) {
        showMessage.success("添加成功");
        setAddMemberVisible(false);
        loadMembers();
      } else {
        showMessage.error(res.message || "添加失败");
      }
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleKickMember = async (userId: number) => {
    if (!currentSession) return;
    if (!window.confirm("确认移除成员？移除后该成员将无法继续参与讨论。")) return;
    try {
      const res = await groupDiscussionApi.adminRemoveMember({
        sessionId: currentSession.id,
        userId,
      });
      if (res.success) {
        showMessage.success("移除成功");
        loadMembers();
      } else {
        showMessage.error(res.message || "移除失败");
      }
    } catch (_e) {
      showMessage.error("移除失败");
    }
  };

  const handleGenerateProfile = async (member: GroupDiscussionMember) => {
    if (!selectedAgentId) {
      showMessage.warning("请先在上方选择分析智能体");
      return;
    }
    if (!currentSession) return;

    setProfileLoadingUserId(member.user_id);
    showMessage.loading({ content: "正在生成学习画像...", key: "profile", duration: 0 });
    try {
      const res = await groupDiscussionApi.adminStudentProfile({
        sessionId: currentSession.id,
        userId: member.user_id,
        agentId: selectedAgentId,
      });
      if (res.success) {
        setProfileDialog({
          visible: true,
          title: `${member.full_name || member.username || "学生"} 学习画像`,
          content: res.data.result_text || "",
        });
      } else {
        showMessage.error(res.message || "学习画像生成失败");
      }
    } finally {
      showMessage.destroy("profile");
      setProfileLoadingUserId(null);
    }
  };

  const handleMuteClick = (member: GroupDiscussionMember) => {
    setMuteState({ visible: true, target: member, durationType: "10m", customMinutes: 10, loading: false });
  };

  const handleUnmuteClick = async (member: GroupDiscussionMember) => {
    if (!currentSession) return;
    try {
      const res = await groupDiscussionApi.adminUnmuteUser({
        sessionId: currentSession.id,
        userId: member.user_id,
      });
      if (res.success) {
        showMessage.success("解除禁言成功");
        loadMembers();
      } else {
        showMessage.error(res.message || "解除禁言失败");
      }
    } catch (_e) {
      showMessage.error("解除禁言失败");
    }
  };

  const handleConfirmMute = async () => {
    if (!currentSession || !muteState.target) return;
    setMuteState((s) => ({ ...s, loading: true }));
    try {
      let minutes = 10;
      if (muteState.durationType === "10m") minutes = 10;
      else if (muteState.durationType === "1h") minutes = 60;
      else if (muteState.durationType === "24h") minutes = 1440;
      else if (muteState.durationType === "custom") minutes = muteState.customMinutes;

      const res = await groupDiscussionApi.adminMuteUser({
        sessionId: currentSession.id,
        userId: muteState.target.user_id,
        minutes,
      });
      if (res.success) {
        showMessage.success("禁言成功");
        setMuteState((s) => ({ ...s, visible: false }));
        loadMembers();
      } else {
        showMessage.error(res.message || "禁言失败");
      }
    } catch (_e) {
      showMessage.error("禁言失败");
    } finally {
      setMuteState((s) => ({ ...s, loading: false }));
    }
  };

  const sessionTitle = currentSession
    ? `小组讨论：${currentSession.session_date} · ${currentSession.class_name} · ${currentSession.group_no}组${
        currentSession.group_name ? ` · ${currentSession.group_name}` : ""
      }`
    : "小组讨论";

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allChecked = sessions.length > 0 && sessions.every((session) => selectedSessionIds.includes(session.id));

  const sessionColumns: ColumnDef<SessionRow>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={allChecked}
          onCheckedChange={(checked) => {
            if (checked === true) {
              setSelectedSessionIds((prev) =>
                Array.from(new Set([...prev, ...sessions.map((session) => session.id)])),
              );
              return;
            }
            setSelectedSessionIds((prev) =>
              prev.filter((id) => !sessions.some((session) => session.id === id)),
            );
          }}
          aria-label="选择当前页全部会话"
        />
      ),
      size: 44,
      meta: { className: "w-[44px]" },
      cell: ({ row }) => (
        <Checkbox
          checked={selectedSessionIds.includes(row.original.id)}
          onCheckedChange={(checked) => {
            setSelectedSessionIds((prev) => {
              if (checked === true) return Array.from(new Set([...prev, row.original.id]));
              return prev.filter((id) => id !== row.original.id);
            });
          }}
          aria-label={`选择会话 ${row.original.id}`}
        />
      ),
    },
    {
      id: "session_date",
      header: "日期",
      accessorKey: "session_date",
      size: 120,
      meta: { className: "w-[120px]" },
    },
    {
      id: "class_name",
      header: "班级",
      accessorKey: "class_name",
      size: 140,
      meta: { className: "w-[140px]" },
      cell: ({ row }) => (
        <span className="block max-w-[140px] truncate" title={row.original.class_name}>
          {row.original.class_name}
        </span>
      ),
    },
    {
      id: "group_no",
      header: "组号",
      accessorKey: "group_no",
      size: 90,
      meta: { className: "w-[90px]" },
    },
    {
      id: "group_name",
      header: "组名",
      accessorKey: "group_name",
      size: 160,
      meta: { className: "w-[160px]" },
      cell: ({ row }) => (
        <span className="block max-w-[160px] truncate" title={row.original.group_name || "-"}>
          {row.original.group_name || "-"}
        </span>
      ),
    },
    {
      id: "message_count",
      header: "消息数",
      accessorKey: "message_count",
      size: 90,
      meta: { className: "w-[90px]" },
    },
    {
      id: "last_message_at",
      header: "最后消息",
      accessorKey: "last_message_at",
      size: 180,
      meta: { className: "w-[180px]" },
      cell: ({ row }) =>
        row.original.last_message_at
          ? dayjs(row.original.last_message_at).format("YYYY-MM-DD HH:mm:ss")
          : "-",
    },
    {
      id: "created_at",
      header: "创建时间",
      accessorKey: "created_at",
      size: 180,
      meta: { className: "w-[180px]" },
      cell: ({ row }) => dayjs(row.original.created_at).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      id: "actions",
      header: "操作",
      size: 260,
      meta: { className: "w-[260px]" },
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => openSessionModal(row.original, "messages")}>
            查看消息
          </Button>
          <Button size="sm" onClick={() => openSessionModal(row.original, "analysis")}>
            分析
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deletingSessionId === row.original.id}
            onClick={() => {
              if (!window.confirm("确认删除该会话吗？将同时删除消息、成员和分析记录，且不可恢复。")) return;
              handleDeleteSession(row.original);
            }}
          >
            {deletingSessionId === row.original.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            删除
          </Button>
        </div>
      ),
    },
  ];

  const sessionsTable = useReactTable({
    data: sessions,
    columns: sessionColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const agentNameById = useMemo(() => {
    const map = new Map<number, string>();
    agents.forEach((agent) => {
      map.set(agent.id, agent.agent_name || agent.name || `智能体${agent.id}`);
    });
    return map;
  }, [agents]);

  const memberColumns: ColumnDef<GroupDiscussionMember>[] = [
    {
      id: "user_id",
      header: "ID",
      accessorKey: "user_id",
      size: 80,
      meta: { className: "w-[80px]" },
    },
    {
      id: "full_name",
      header: "姓名",
      accessorKey: "full_name",
      size: 100,
      meta: { className: "w-[100px]" },
      cell: ({ row }) => row.original.full_name || "-",
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
      id: "username",
      header: "用户名",
      accessorKey: "username",
      size: 120,
      meta: { className: "w-[120px]" },
      cell: ({ row }) => row.original.username || "-",
    },
    {
      id: "joined_at",
      header: "加入时间",
      accessorKey: "joined_at",
      size: 180,
      meta: { className: "w-[180px]" },
      cell: ({ row }) => dayjs(row.original.joined_at).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      id: "status",
      header: "状态",
      size: 140,
      meta: { className: "w-[140px]" },
      cell: ({ row }) => {
        const isMuted = Boolean(row.original.muted_until && dayjs(row.original.muted_until).isAfter(dayjs()));
        return isMuted ? (
          <Badge variant="danger">
            禁言至 {dayjs(row.original.muted_until).format("HH:mm")}
          </Badge>
        ) : (
          <Badge variant="success">正常</Badge>
        );
      },
    },
    {
      id: "actions",
      header: "操作",
      size: 280,
      meta: { className: "w-[280px]" },
      cell: ({ row }) => {
        const member = row.original;
        const isMuted = Boolean(member.muted_until && dayjs(member.muted_until).isAfter(dayjs()));
        return (
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={profileLoadingUserId === member.user_id}
              onClick={() => handleGenerateProfile(member)}
            >
              {profileLoadingUserId === member.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              画像
            </Button>
            {isMuted ? (
              <Button size="sm" variant="outline" onClick={() => handleUnmuteClick(member)}>
                解除禁言
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => handleMuteClick(member)}>
                禁言
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => handleKickMember(member.user_id)}>
              移除
            </Button>
          </div>
        );
      },
    },
  ];

  const membersTable = useReactTable({
    data: membersLoading ? [] : members,
    columns: memberColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AdminCard size="small" className="mb-4" styles={{ body: { padding: 16 } }}>
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-text-tertiary">时间</span>
              <Input
                type="date"
                className="w-[160px]"
                value={dateRange[0]}
                onChange={(e) => setDateRange([e.target.value, dateRange[1]])}
              />
              <span className="text-text-tertiary">至</span>
              <Input
                type="date"
                className="w-[160px]"
                value={dateRange[1]}
                onChange={(e) => setDateRange([dateRange[0], e.target.value])}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-text-tertiary">班级</span>
              <Input
                className="w-[180px]"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="如：高一(1)班"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-text-tertiary">组号</span>
              <Input
                className="w-[140px]"
                value={groupNo}
                onChange={(e) => setGroupNo(e.target.value)}
                placeholder="如：1"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-text-tertiary">组名</span>
              <Input
                className="w-[180px]"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="如：学习小组"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-text-tertiary">姓名</span>
              <Input
                className="w-[160px]"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="如：张三"
              />
            </div>

            <Button
              disabled={loading}
              onClick={() => {
                setPage(1);
                loadSessions();
              }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              查询
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedAgentId ? String(selectedAgentId) : "__none__"}
              onValueChange={(value) => setSelectedAgentId(value === "__none__" ? null : Number(value))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择分析智能体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">不指定智能体</SelectItem>
                {(agents || []).map((agent) => (
                  <SelectItem key={agent.id} value={String(agent.id)}>
                    {agent.agent_name || agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              disabled={selectedSessionIds.length < 2}
              onClick={() => {
                setCompareState((s) => ({ ...s, result: "", lastAnalysisId: null }));
                setCompareForm(createCompareFormState(selectedAgentId, "learning_compare"));
                setCompareVisible(true);
              }}
            >
              横向对比分析（{selectedSessionIds.length}）
            </Button>

            <Button
              variant="outline"
              disabled={selectedSessionIds.length === 0}
              onClick={() => {
                setCompareState((s) => ({ ...s, result: "", lastAnalysisId: null }));
                setCompareForm(createCompareFormState(selectedAgentId, "cross_system"));
                setCompareVisible(true);
              }}
            >
              跨系统分析（{selectedSessionIds.length}）
            </Button>

            <Button
              variant="destructive"
              disabled={batchDeleting || selectedSessionIds.length === 0}
              onClick={() => {
                if (selectedSessionIds.length === 0) return;
                if (!window.confirm(`确认删除所选 ${selectedSessionIds.length} 个会话吗？此操作不可恢复。`)) return;
                handleBatchDeleteSessions();
              }}
            >
              {batchDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              批量删除（{selectedSessionIds.length}）
            </Button>

            <Button
              variant="outline"
              disabled={selectedSessionIds.length === 0}
              onClick={() => setSelectedSessionIds([])}
            >
              清空选择
            </Button>

            <div className="flex h-9 items-center gap-2 rounded-md border border-border-secondary bg-surface-2 px-2.5">
              <span className="text-sm text-text-secondary">学生端弹窗</span>
              <Badge
                variant={frontendVisible ? "success" : "secondary"}
                className="px-1.5 py-0 text-[11px]"
              >
                {frontendVisible ? "已开启" : "已关闭"}
              </Badge>
              <Switch
                aria-label="切换学生端弹窗可见性"
                checked={frontendVisible}
                disabled={frontendVisibleLoading}
                onCheckedChange={async (checked) => {
                  setFrontendVisibleLoading(true);
                  try {
                    const res = await groupDiscussionApi.setPublicConfig({ enabled: checked });
                    if (!res.success) {
                      showMessage.error(res.message || "设置失败");
                      return;
                    }
                    setFrontendVisible(Boolean(res.data.enabled));
                    showMessage.success(`学生端小组讨论已${res.data.enabled ? "开启" : "关闭"}`);
                  } finally {
                    setFrontendVisibleLoading(false);
                  }
                }}
              />
              {frontendVisibleLoading ? <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" /> : null}
            </div>
          </div>
        </div>
      </AdminCard>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AdminTablePanel
            loading={loading}
            isEmpty={!loading && sessions.length === 0}
            emptyDescription="暂无数据"
          >
            <DataTable table={sessionsTable} className="h-full" tableClassName="min-w-[980px]" />
          </AdminTablePanel>
        </div>
        <div className="mt-auto flex justify-end border-t border-border-secondary pt-3">
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
            }}
          />
        </div>
      </div>

      <Dialog open={sessionModalOpen} onOpenChange={setSessionModalOpen}>
        <DialogContent className="h-[92vh] w-[92vw] overflow-hidden p-0 sm:max-w-[1100px]">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-base">{sessionTitle}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden px-5 pb-4 pt-3">
            <Tabs value={sessionModalTab} onValueChange={setSessionModalTab} className="flex h-full flex-col">
              <TabsList className="w-fit">
                <TabsTrigger value="messages">消息</TabsTrigger>
                <TabsTrigger value="members">成员</TabsTrigger>
                <TabsTrigger value="analysis">分析</TabsTrigger>
              </TabsList>

              <TabsContent value="messages" className="mt-3 flex-1 overflow-hidden">
                <div className="h-full overflow-auto rounded-[10px] border border-border bg-surface p-3">
                  {messagesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-text-tertiary">
                      <Loader2 className="h-4 w-4 animate-spin" />加载中...
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-text-tertiary">暂无消息</p>
                  ) : (
                    <div className="space-y-2.5">
                      {messages.map((message) => (
                        <div key={message.id} className="flex justify-start">
                          <div className="max-w-[92%]">
                            <div className="mb-1 flex justify-between gap-2.5">
                              <span className="text-xs font-semibold">{message.user_display_name}</span>
                              <span className="text-xs text-text-tertiary">
                                {dayjs(message.created_at).format("HH:mm:ss")}
                              </span>
                            </div>
                            <div className="whitespace-pre-wrap break-words rounded-xl border border-border bg-surface px-2.5 py-2 text-sm">
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="members" className="mt-3 flex-1 overflow-hidden">
                <div className="flex h-full flex-col gap-3">
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSearchedUsers([]);
                        setSelectedUserId(null);
                        setUserSearchKeyword("");
                        setAddMemberVisible(true);
                      }}
                    >
                      添加成员
                    </Button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
                    <DataTable
                      table={membersTable}
                      tableClassName="min-w-[860px]"
                      emptyState={
                        membersLoading ? (
                          <div className="flex items-center justify-center py-6 text-sm text-text-tertiary">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            加载中...
                          </div>
                        ) : (
                          <div className="py-6 text-center text-sm text-text-tertiary">暂无成员</div>
                        )
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="analysis" className="mt-3 flex-1 overflow-auto">
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex flex-wrap gap-3">
                      <div className="min-w-[320px] flex-1 space-y-1.5">
                        <label className="text-sm text-text-tertiary">使用智能体</label>
                        <Select
                          value={analysisForm.agentId || "__none__"}
                          onValueChange={(value) =>
                            setAnalysisForm((prev) => ({ ...prev, agentId: value === "__none__" ? "" : value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="请选择智能体" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">请选择智能体</SelectItem>
                            {(agents || []).map((agent) => (
                              <SelectItem key={agent.id} value={String(agent.id)}>
                                {`${agent.agent_name || agent.name}（${agent.agent_type}）`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="w-[220px] space-y-1.5">
                        <label className="text-sm text-text-tertiary">分析类型</label>
                        <Select
                          value={analysisForm.analysisType}
                          onValueChange={(value) => setAnalysisForm((prev) => ({ ...prev, analysisType: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="learning_topics">学习主题</SelectItem>
                            <SelectItem value="question_chain">问题链条</SelectItem>
                            <SelectItem value="timeline">时间线（3分钟桶）</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mb-2 mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setAnalysisForm((prev) => ({
                            ...prev,
                            prompt: "请提炼本次讨论的学习主题（按重要性排序），每个主题给出要点与代表性问题。",
                          }))
                        }
                      >
                        学习主题模板
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setAnalysisForm((prev) => ({
                            ...prev,
                            prompt: "请梳理本次讨论的问题链条：最初问题→追问→分歧→验证→结论，按步骤列出。",
                          }))
                        }
                      >
                        问题链条模板
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setAnalysisForm((prev) => ({
                            ...prev,
                            prompt: "请按时间线总结本次讨论：按3分钟为桶概括每段主要内容、关键问题与结论变化。",
                          }))
                        }
                      >
                        时间线模板
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setAnalysisForm((prev) => ({
                            ...prev,
                            prompt: "请给出下一步行动清单：按优先级列出3-8条学习建议/任务拆解。",
                          }))
                        }
                      >
                        行动模板
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm text-text-tertiary">自定义 Prompt（可选）</label>
                      <Textarea
                        rows={5}
                        placeholder="留空则使用默认模板"
                        value={analysisForm.prompt}
                        onChange={(e) => setAnalysisForm((prev) => ({ ...prev, prompt: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">分析结果</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!analysisResult) return;
                          try {
                            await navigator.clipboard.writeText(analysisResult);
                            showMessage.success("已复制");
                          } catch {
                            showMessage.error("复制失败");
                          }
                        }}
                        disabled={!analysisResult}
                      >
                        复制
                      </Button>
                    </div>
                    {analysisResult ? (
                      <div className="prose prose-sm max-w-none overflow-x-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-text-tertiary">暂无分析结果</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-3">
                    <h4 className="mb-2 text-sm font-semibold">历史分析</h4>
                    {analysesLoading ? (
                      <div className="flex items-center gap-2 text-sm text-text-tertiary">
                        <Loader2 className="h-4 w-4 animate-spin" />加载中...
                      </div>
                    ) : analyses.length === 0 ? (
                      <p className="text-sm text-text-tertiary">暂无历史记录</p>
                    ) : (
                      <div className="space-y-2">
                        {analyses.map((analysis) => (
                          <div
                            key={analysis.id}
                            className="cursor-pointer rounded-lg border border-border bg-surface p-2.5 transition hover:bg-[var(--ws-color-hover-bg)]"
                            onClick={() => setAnalysisResult(analysis.result_text)}
                          >
                            <div className="flex justify-between gap-2.5">
                              <p className="text-sm font-semibold">
                                {analysis.analysis_type} · {agentNameById.get(analysis.agent_id) || `智能体${analysis.agent_id}`}
                              </p>
                              <p className="text-xs text-text-tertiary">
                                {dayjs(analysis.created_at).format("YYYY-MM-DD HH:mm")}
                              </p>
                            </div>
                            <p className="text-xs text-text-tertiary">点击查看结果</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" onClick={() => setSessionModalOpen(false)}>
              关闭
            </Button>
            <Button disabled={analysisLoading || sessionModalTab !== "analysis"} onClick={handleAnalyze}>
              {analysisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              开始分析
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={compareVisible} onOpenChange={setCompareVisible}>
        <DialogContent className="h-[92vh] w-[92vw] overflow-hidden p-0 sm:max-w-[1100px]">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-base">深度分析（{selectedSessionIds.length}个会话）</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-5 pb-4 pt-3">
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[320px] flex-1 space-y-1.5">
                    <label className="text-sm text-text-tertiary">使用智能体</label>
                    <Select
                      value={compareForm.agentId || "__none__"}
                      onValueChange={(value) =>
                        setCompareForm((prev) => ({ ...prev, agentId: value === "__none__" ? "" : value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择智能体" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">请选择智能体</SelectItem>
                        {(agents || []).map((agent) => (
                          <SelectItem key={agent.id} value={String(agent.id)}>
                            {`${agent.agent_name || agent.name}（${agent.agent_type}）`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-[160px] space-y-1.5">
                    <label className="text-sm text-text-tertiary">时间桶</label>
                    <Select
                      value={String(compareForm.bucketSeconds)}
                      onValueChange={(value) => setCompareForm((prev) => ({ ...prev, bucketSeconds: Number(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="180">3分钟</SelectItem>
                        <SelectItem value="300">5分钟</SelectItem>
                        <SelectItem value="600">10分钟</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-[240px] space-y-1.5">
                    <label className="text-sm text-text-tertiary">分析类型</label>
                    <Select
                      value={compareForm.analysisType}
                      onValueChange={(value) => setCompareForm((prev) => ({ ...prev, analysisType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="learning_compare">横向对比分析</SelectItem>
                        <SelectItem value="cross_system">跨系统关联分析</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mb-2 mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={compareState.useCache ? "default" : "outline"}
                    onClick={() => setCompareState((prev) => ({ ...prev, useCache: !prev.useCache }))}
                  >
                    {compareState.useCache ? "使用缓存：开" : "使用缓存：关"}
                  </Button>
                </div>

                <div className="mb-2">
                  <p className="mb-1.5 text-xs text-text-tertiary">预设 Prompt 模板（点击填入）：</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCompareForm((prev) => ({
                          ...prev,
                          prompt: "请按时间桶汇总各组讨论的学习主题，横向对比共性与差异，梳理代表性问题链条，给出教学建议。",
                        }))
                      }
                    >
                      横向对比
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCompareForm((prev) => ({
                          ...prev,
                          prompt: "请对比小组讨论热点话题与AI智能体提问热门问题，分析话题关联性、学生学习路径、共性知识盲点和AI依赖度，给出教学调整建议。",
                        }))
                      }
                    >
                      跨系统关联
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCompareForm((prev) => ({
                          ...prev,
                          prompt: "请重点分析各组讨论中暴露的知识薄弱点和认知误区，按严重程度排序，给出针对性的教学补救方案。",
                        }))
                      }
                    >
                      知识盲点诊断
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCompareForm((prev) => ({
                          ...prev,
                          prompt: "请评估各组的讨论质量（深度、参与度、问题解决率），排名并说明理由，推荐2-3个值得全班分享的优秀讨论片段。",
                        }))
                      }
                    >
                      讨论质量评估
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCompareForm((prev) => ({ ...prev, prompt: "" }))}>
                      清空
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm text-text-tertiary">自定义 Prompt（可选，留空使用默认模板）</label>
                  <Textarea
                    rows={4}
                    placeholder="输入你的分析指令..."
                    value={compareForm.prompt}
                    onChange={(e) => setCompareForm((prev) => ({ ...prev, prompt: e.target.value }))}
                  />
                </div>
              </div>

              {compareState.loading ? (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
                    <p className="text-sm text-text-tertiary">正在调用智能体分析，请耐心等待（可能需要 30-120 秒）...</p>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-border bg-surface p-3">
                <h4 className="mb-2 text-sm font-semibold">分析结果</h4>
                {compareState.result ? (
                  <div className="prose prose-sm max-w-none overflow-x-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{compareState.result}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-text-tertiary">{compareState.loading ? "分析中..." : "暂无结果，请点击「开始分析」"}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" onClick={() => setCompareVisible(false)}>
              取消
            </Button>
            <Button onClick={handleStartCompare} disabled={compareState.loading}>
              {compareState.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              开始分析
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={muteState.visible}
        onOpenChange={(open) => !open && setMuteState((prev) => ({ ...prev, visible: false }))}
      >
        <DialogContent className="w-[92vw] sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>禁言成员：{muteState.target?.full_name || muteState.target?.username}</DialogTitle>
          </DialogHeader>

          <div className="py-1">
            <p className="mb-3 text-sm">请选择禁言时长：</p>
            <div className="space-y-2">
              {[
                { label: "10分钟", value: "10m" as const },
                { label: "1小时", value: "1h" as const },
                { label: "24小时", value: "24h" as const },
                { label: "自定义时长", value: "custom" as const },
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mute-duration"
                    value={option.value}
                    checked={muteState.durationType === option.value}
                    onChange={(e) => {
                      const value = e.target.value as "10m" | "1h" | "24h" | "custom";
                      const minutes = value === "10m" ? 10 : value === "1h" ? 60 : value === "24h" ? 1440 : muteState.customMinutes;
                      setMuteState((prev) => ({ ...prev, durationType: value, customMinutes: minutes }));
                    }}
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {muteState.durationType === "custom" ? (
              <div className="mt-3 flex items-center gap-2">
                <Input
                  type="number"
                  className="w-28"
                  min={1}
                  value={muteState.customMinutes}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setMuteState((prev) => ({ ...prev, customMinutes: Number.isFinite(next) && next > 0 ? next : 1 }));
                  }}
                />
                <span className="text-sm text-text-tertiary">分钟</span>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMuteState((prev) => ({ ...prev, visible: false }))}>
              取消
            </Button>
            <Button onClick={handleConfirmMute} disabled={muteState.loading}>
              {muteState.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberVisible} onOpenChange={setAddMemberVisible}>
        <DialogContent className="w-[92vw] sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>添加成员</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <p className="text-sm text-text-tertiary">搜索用户（姓名/学号）</p>
              <Input
                placeholder="输入姓名或学号搜索"
                value={userSearchKeyword}
                onChange={(e) => setUserSearchKeyword(e.target.value)}
              />
            </div>

            <div className="max-h-[280px] overflow-auto rounded-md border border-border">
              {userSearchLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-tertiary">
                  <Loader2 className="h-4 w-4 animate-spin" />搜索中...
                </div>
              ) : searchedUsers.length === 0 ? (
                <div className="py-6 text-center text-sm text-text-tertiary">
                  {userSearchKeyword.trim() ? "未找到匹配用户" : "请输入关键词进行搜索"}
                </div>
              ) : (
                searchedUsers.map((user) => {
                  const selected = selectedUserId === user.id;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between border-b border-border-secondary px-3 py-2 text-left text-sm last:border-b-0",
                        selected ? "bg-[var(--ws-color-hover-bg)]" : "hover:bg-[var(--ws-color-hover-bg)]",
                      )}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <span>{`${user.full_name || "-"} (${user.student_id || user.username || "-"})`}</span>
                      {selected ? <span className="text-xs text-primary">已选</span> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberVisible(false)}>
              取消
            </Button>
            <Button onClick={handleAddMember} disabled={!selectedUserId || addMemberLoading}>
              {addMemberLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={profileDialog.visible}
        onOpenChange={(open) => !open && setProfileDialog({ visible: false, title: "", content: "" })}
      >
        <DialogContent className="w-[92vw] sm:max-w-[780px]">
          <DialogHeader>
            <DialogTitle>{profileDialog.title || "学习画像"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md border border-border bg-surface p-3">
            <pre className="whitespace-pre-wrap text-sm leading-6">{profileDialog.content || "暂无内容"}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialog({ visible: false, title: "", content: "" })}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupDiscussionAdminTab;
