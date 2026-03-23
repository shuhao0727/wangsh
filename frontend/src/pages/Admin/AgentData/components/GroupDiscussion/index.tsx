import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, DatePicker, Form, Input, Modal, Pagination, Popconfirm, Select, Space, Spin, Table, Tabs, Typography, message, Tag, Radio, InputNumber, Switch } from "antd";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import dayjs from "dayjs";
import { aiAgentsApi, groupDiscussionApi } from "@services/agents";
import { userApi } from "@services/users";
import type { User } from "@services/users";
import type { AIAgent } from "@services/znt/types";
import type { GroupDiscussionMember } from "@services/znt/api/group-discussion-api";
import type { ColumnsType } from "antd/es/table";
import { AdminCard, AdminTablePanel } from "@components/Admin";

const { RangePicker } = DatePicker;
const { Text } = Typography;

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

const GroupDiscussionAdminTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [frontendVisible, setFrontendVisible] = useState(true);
  const [frontendVisibleLoading, setFrontendVisibleLoading] = useState(false);

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf("day"),
    dayjs().endOf("day"),
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
  const [analysisForm] = Form.useForm();
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
  const [compareForm] = Form.useForm();
  const [compareState, setCompareState] = useState<{
    loading: boolean;
    result: string;
    lastAnalysisId: number | null;
    useCache: boolean;
  }>({ loading: false, result: "", lastAnalysisId: null, useCache: true });

  const [addMemberVisible, setAddMemberVisible] = useState(false);
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
      const start = dateRange[0]?.format("YYYY-MM-DD");
      const end = dateRange[1]?.format("YYYY-MM-DD");
      const res = await groupDiscussionApi.adminListSessions({
        startDate: start || undefined,
        endDate: end || undefined,
        className: className.trim() || undefined,
        groupNo: groupNo.trim() || undefined,
        groupName: groupName.trim() || undefined,
        userName: userName.trim() || undefined,
        page,
        size: pageSize,
      });
      if (!res.success) {
        message.error(res.message || "加载失败");
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
          message.error(res.message || "删除失败");
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
        message.success("删除成功");
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
        message.error(res.message || "删除失败");
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
      message.success(`已删除 ${res.data} 个会话`);
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
        message.error(res.message || "加载消息失败");
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
        message.error(res.message || "加载成员失败");
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
        message.error(res.message || "加载分析历史失败");
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

  useEffect(() => {
    if (!sessionModalOpen) return;
    loadMessages();
    loadMembers();
    loadAnalyses();
  }, [sessionModalOpen, loadMessages, loadMembers, loadAnalyses]);

  const sessionColumns: ColumnsType<SessionRow> = useMemo(
    () => [
      { title: "日期", dataIndex: "session_date", width: 120 },
      { title: "班级", dataIndex: "class_name", width: 140, ellipsis: true },
      { title: "组号", dataIndex: "group_no", width: 90 },
      { title: "组名", dataIndex: "group_name", width: 160, ellipsis: true, render: (v) => v || "-" },
      { title: "消息数", dataIndex: "message_count", width: 90 },
      {
        title: "最后消息",
        dataIndex: "last_message_at",
        width: 180,
        render: (v) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm:ss") : "-"),
      },
      {
        title: "创建时间",
        dataIndex: "created_at",
        width: 180,
        render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm:ss"),
      },
      {
        title: "操作",
        key: "actions",
        width: 260,
        render: (_: any, r) => (
          <Space size={8}>
            <Button
              size="small"
              onClick={() => {
                setCurrentSession(r);
                setMessages([]);
                setAnalysisResult("");
                analysisForm.resetFields();
                analysisForm.setFieldsValue({ analysis_type: "learning_topics" });
                setSessionModalTab("messages");
                setSessionModalOpen(true);
              }}
            >
              查看消息
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setCurrentSession(r);
                setAnalysisResult("");
                analysisForm.resetFields();
                analysisForm.setFieldsValue({ analysis_type: "learning_topics" });
                setSessionModalTab("analysis");
                setSessionModalOpen(true);
              }}
            >
              分析
            </Button>
            <Popconfirm
              title="确认删除该会话吗？"
              description="将同时删除该会话下的消息、成员与分析记录，且不可恢复。"
              onConfirm={() => handleDeleteSession(r)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: deletingSessionId === r.id }}
            >
              <Button danger size="small" loading={deletingSessionId === r.id}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [analysisForm, deletingSessionId, handleDeleteSession],
  );

  const handleAnalyze = async () => {
    if (!currentSession) return;
    try {
      setAnalysisLoading(true);
      const values = await analysisForm.validateFields();
      const res = await groupDiscussionApi.adminAnalyze({
        sessionId: currentSession.id,
        agentId: values.agent_id,
        analysisType: values.analysis_type,
        prompt: values.prompt || undefined,
      });
      if (!res.success) {
        message.error(res.message || "分析失败");
        return;
      }
      setAnalysisResult(res.data.result_text || "");
      message.success("分析完成");
      loadAnalyses();
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleCompareAnalyze = async () => {
    if (selectedSessionIds.length < 2) {
      message.warning("请至少选择2个会话");
      return;
    }
    try {
      setCompareState((s) => ({ ...s, loading: true }));
      const values = await compareForm.validateFields();
      const res = await groupDiscussionApi.adminCompareAnalyze({
        sessionIds: selectedSessionIds,
        agentId: values.agent_id,
        bucketSeconds: values.bucket_seconds,
        analysisType: values.analysis_type,
        prompt: values.prompt || undefined,
        useCache: compareState.useCache,
      });
      if (!res.success) {
        message.error(res.message || "对比分析失败");
        return;
      }
      const nextId = Number(res.data.analysis_id || 0);
      if (compareState.useCache && compareState.lastAnalysisId && nextId === compareState.lastAnalysisId) {
        message.success("对比分析完成（命中缓存）");
      } else {
        message.success("对比分析完成");
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

  const handleAddMember = async () => {
    if (!currentSession || !selectedUserId) return;
    setAddMemberLoading(true);
    try {
      const res = await groupDiscussionApi.adminAddMember({
        sessionId: currentSession.id,
        userId: selectedUserId,
      });
      if (res.success) {
        message.success("添加成功");
        setAddMemberVisible(false);
        loadMembers();
      } else {
        message.error(res.message || "添加失败");
      }
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleKickMember = async (userId: number) => {
    if (!currentSession) return;
    Modal.confirm({
      title: "确认移除成员？",
      content: "移除后该成员将无法继续参与讨论。",
      onOk: async () => {
        try {
          const res = await groupDiscussionApi.adminRemoveMember({
            sessionId: currentSession.id,
            userId,
          });
          if (res.success) {
            message.success("移除成功");
            loadMembers();
          } else {
            message.error(res.message || "移除失败");
          }
        } catch (e) {
          message.error("移除失败");
        }
      },
    });
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
        message.success("解除禁言成功");
        loadMembers();
      } else {
        message.error(res.message || "解除禁言失败");
      }
    } catch (e) {
      message.error("解除禁言失败");
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
        message.success("禁言成功");
        setMuteState((s) => ({ ...s, visible: false }));
        loadMembers();
      } else {
        message.error(res.message || "禁言失败");
      }
    } catch (e) {
      message.error("禁言失败");
    } finally {
      setMuteState((s) => ({ ...s, loading: false }));
    }
  };

  const sessionTitle = currentSession
    ? `小组讨论：${currentSession.session_date} · ${currentSession.class_name} · ${currentSession.group_no}组${
        currentSession.group_name ? ` · ${currentSession.group_name}` : ""
      }`
    : "小组讨论";

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <AdminCard
        size="small"
        className="mb-4"
        styles={{ body: { padding: 16 } }}
      >
        <Space wrap>
          <Space>
            <Text>时间</Text>
            <RangePicker
              value={dateRange}
              onChange={(v) => setDateRange([v?.[0] || null, v?.[1] || null])}
            />
          </Space>
          <Space>
            <Text>班级</Text>
            <Input
              style={{ width: 180 }}
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="如：高一(1)班"
            />
          </Space>
          <Space>
            <Text>组号</Text>
            <Input
              style={{ width: 140 }}
              value={groupNo}
              onChange={(e) => setGroupNo(e.target.value)}
              placeholder="如：1"
            />
          </Space>
          <Space>
            <Text>组名</Text>
            <Input
              style={{ width: 180 }}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="如：学习小组"
            />
          </Space>
          <Space>
            <Text>姓名</Text>
            <Input
              style={{ width: 160 }}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="如：张三"
            />
          </Space>
          <Button
            type="primary"
            loading={loading}
            onClick={() => {
              setPage(1);
              loadSessions();
            }}
          >
            查询
          </Button>
          <Select
            style={{ width: 180 }}
            placeholder="选择分析智能体"
            value={selectedAgentId}
            onChange={setSelectedAgentId}
            allowClear
            options={agents.map((a) => ({ value: a.id, label: a.name }))}
          />
          <Button
            disabled={selectedSessionIds.length < 2}
            onClick={() => {
              setCompareState((s) => ({ ...s, result: "", lastAnalysisId: null }));
              compareForm.resetFields();
              compareForm.setFieldsValue({
                bucket_seconds: 180,
                analysis_type: "learning_compare",
                agent_id: selectedAgentId || undefined,
              });
              setCompareVisible(true);
            }}
          >
            横向对比分析（{selectedSessionIds.length}）
          </Button>
          <Button
            type="default"
            disabled={selectedSessionIds.length === 0}
            onClick={() => {
              setCompareState((s) => ({ ...s, result: "", lastAnalysisId: null }));
              compareForm.resetFields();
              compareForm.setFieldsValue({
                bucket_seconds: 180,
                analysis_type: "cross_system",
                agent_id: selectedAgentId || undefined,
              });
              setCompareVisible(true);
            }}
          >
            跨系统分析（{selectedSessionIds.length}）
          </Button>
          <Popconfirm
            title={`确认删除所选 ${selectedSessionIds.length} 个会话吗？`}
            description="将同时删除这些会话下的消息、成员与分析记录，且不可恢复。"
            onConfirm={handleBatchDeleteSessions}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true, loading: batchDeleting }}
            disabled={selectedSessionIds.length === 0}
          >
            <Button danger loading={batchDeleting} disabled={selectedSessionIds.length === 0}>
              批量删除（{selectedSessionIds.length}）
            </Button>
          </Popconfirm>
          <Button
            disabled={selectedSessionIds.length === 0}
            onClick={() => setSelectedSessionIds([])}
          >
            清空选择
          </Button>
          <div className="flex items-center gap-2 border border-black/10 px-3 py-1 rounded-md bg-white">
            <Text>学生端弹窗：</Text>
            <Switch
              checked={frontendVisible}
              loading={frontendVisibleLoading}
              checkedChildren="可见"
              unCheckedChildren="不可见"
              onChange={async (checked) => {
                setFrontendVisibleLoading(true);
                try {
                  const res = await groupDiscussionApi.setPublicConfig({ enabled: checked });
                  if (!res.success) {
                    message.error(res.message || "设置失败");
                    // Revert visual state if needed, but since it's controlled by state which updates on success/load, we might need to handle failure carefully.
                    // Ideally we fetch the config again or revert state.
                    return;
                  }
                  setFrontendVisible(Boolean(res.data.enabled));
                  message.success(`学生端小组讨论已${res.data.enabled ? "开启" : "关闭"}`);
                } finally {
                  setFrontendVisibleLoading(false);
                }
              }}
            />
          </div>
        </Space>
      </AdminCard>

        <div className="flex-1 min-h-0">
      <AdminTablePanel
        loading={loading}
        isEmpty={!loading && sessions.length === 0}
        emptyDescription="暂无数据"
        pagination={
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showTotal={(total) => `共 ${total} 条`}
            onChange={(p: number, s: number) => {
              setPage(p);
              setPageSize(s);
            }}
          />
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={sessionColumns}
          dataSource={sessions}
          rowSelection={{
            selectedRowKeys: selectedSessionIds,
            onChange: (keys) => setSelectedSessionIds(keys.map((k) => Number(k)).filter((n) => Number.isFinite(n))),
          }}
          pagination={false}
          scroll={{ x: 980 }}
        />
      </AdminTablePanel>
      </div>

      <Modal
        title={sessionTitle}
        open={sessionModalOpen}
        onCancel={() => setSessionModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setSessionModalOpen(false)}>
            关闭
          </Button>,
          <Button
            key="analyze"
            type="primary"
            loading={analysisLoading}
            onClick={handleAnalyze}
            disabled={sessionModalTab !== "analysis"}
          >
            开始分析
          </Button>,
        ]}
        width={980}
        styles={{ body: { paddingTop: 8 } }}
      >
        <Tabs
          activeKey={sessionModalTab}
          onChange={setSessionModalTab}
          items={[
            {
              key: "messages",
              label: "消息",
              children: (
                <div
                  style={{
                    height: 520,
                    overflow: "auto",
                    borderRadius: 10,
                    padding: 12,
                    background: "var(--ws-color-surface)",
                    border: "1px solid var(--ws-color-border)",
                  }}
                >
                  {messagesLoading ? (
                    <Text type="secondary">加载中...</Text>
                  ) : messages.length === 0 ? (
                    <Text type="secondary">暂无消息</Text>
                  ) : (
                    <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                      {messages.map((m) => (
                        <div key={m.id} className="flex justify-start">
                          <div className="max-w-[92%]">
                            <div className="flex justify-between gap-2.5 mb-1">
                              <Text strong className="text-xs">
                                {m.user_display_name}
                              </Text>
                              <Text type="secondary" className="text-xs">
                                {dayjs(m.created_at).format("HH:mm:ss")}
                              </Text>
                            </div>
                            <div
                              className="px-2.5 py-2 rounded-xl whitespace-pre-wrap break-words"
                              style={{
                                background: "var(--ws-color-surface)",
                                border: "1px solid var(--ws-color-border)",
                              }}
                            >
                              <Text className="text-text-base">{m.content}</Text>
                            </div>
                          </div>
                        </div>
                      ))}
                    </Space>
                  )}
                </div>
              ),
            },
            {
              key: "members",
              label: "成员",
              children: (
                <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                  <div className="flex justify-end">
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => {
                        setSearchedUsers([]);
                        setSelectedUserId(null);
                        setAddMemberVisible(true);
                      }}
                    >
                      添加成员
                    </Button>
                  </div>
                  <Table
                    loading={membersLoading}
                    dataSource={members}
                    rowKey="user_id"
                    pagination={false}
                    scroll={{ y: 400 }}
                    columns={[
                        { title: "ID", dataIndex: "user_id", width: 80 },
                        { title: "姓名", dataIndex: "full_name", width: 100 },
                        { title: "学号", dataIndex: "student_id", width: 120 },
                        { title: "用户名", dataIndex: "username", width: 120 },
                        {
                          title: "加入时间",
                          dataIndex: "joined_at",
                          width: 160,
                          render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm:ss"),
                        },
                        {
                          title: "状态",
                          key: "status",
                          render: (_, r) => {
                            if (r.muted_until && dayjs(r.muted_until).isAfter(dayjs())) {
                              return <Tag color="error">禁言至 {dayjs(r.muted_until).format("HH:mm")}</Tag>;
                            }
                            return <Tag color="success">正常</Tag>;
                          },
                        },
                        {
                          title: "操作",
                          key: "actions",
                          width: 260,
                          render: (_, r) => {
                            const isMuted = r.muted_until && dayjs(r.muted_until).isAfter(dayjs());
                            return (
                              <Space size={4}>
                                <Button size="small" onClick={async () => {
                                  if (!selectedAgentId) { message.warning("请先在上方选择分析智能体"); return; }
                                  if (!currentSession) return;
                                  message.loading({ content: "正在生成学习画像...", key: "profile", duration: 0 });
                                  const res = await groupDiscussionApi.adminStudentProfile({ sessionId: currentSession.id, userId: r.user_id, agentId: selectedAgentId });
                                  message.destroy("profile");
                                  if (res.success) {
                                    Modal.info({ title: `${r.full_name || r.username || "学生"} 学习画像`, width: 760, content: <pre style={{ whiteSpace: "pre-wrap", maxHeight: 500, overflow: "auto", fontSize: 13 }}>{res.data.result_text}</pre> });
                                  } else { message.error(res.message || "学习画像生成失败"); }
                                }}>
                                  画像
                                </Button>
                                {isMuted ? (
                                  <Button size="small" onClick={() => handleUnmuteClick(r)}>
                                    解除禁言
                                  </Button>
                                ) : (
                                  <Button size="small" danger onClick={() => handleMuteClick(r)}>
                                    禁言
                                  </Button>
                                )}
                                <Button size="small" danger onClick={() => handleKickMember(r.user_id)}>
                                  移除
                                </Button>
                              </Space>
                            );
                          },
                        },
                      ]}
                  />
                </Space>
              ),
            },
            {
              key: "analysis",
              label: "分析",
              children: (
                <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                  <Card
                    size="small"
                  >
                    <Form form={analysisForm} layout="vertical">
                      <Space wrap style={{ width: "100%" }}>
                        <Form.Item
                          name="agent_id"
                          label="使用智能体"
                          rules={[{ required: true, message: "请选择智能体" }]}
                          style={{ minWidth: 320 }}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            options={(agents || []).map((a) => ({
                              value: a.id,
                              label: `${a.agent_name || a.name}（${a.agent_type}）`,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item name="analysis_type" label="分析类型" style={{ width: 220 }}>
                          <Select
                            options={[
                              { value: "learning_topics", label: "学习主题" },
                              { value: "question_chain", label: "问题链条" },
                              { value: "timeline", label: "时间线（3分钟桶）" },
                            ]}
                          />
                        </Form.Item>
                      </Space>
                      <Space wrap className="mb-2">
                        <Button
                          size="small"
                          onClick={() =>
                            analysisForm.setFieldsValue({
                              prompt: "请提炼本次讨论的学习主题（按重要性排序），每个主题给出要点与代表性问题。",
                            })
                          }
                        >
                          学习主题模板
                        </Button>
                        <Button
                          size="small"
                          onClick={() =>
                            analysisForm.setFieldsValue({
                              prompt: "请梳理本次讨论的问题链条：最初问题→追问→分歧→验证→结论，按步骤列出。",
                            })
                          }
                        >
                          问题链条模板
                        </Button>
                        <Button
                          size="small"
                          onClick={() =>
                            analysisForm.setFieldsValue({
                              prompt: "请按时间线总结本次讨论：按3分钟为桶概括每段主要内容、关键问题与结论变化。",
                            })
                          }
                        >
                          时间线模板
                        </Button>
                        <Button
                          size="small"
                          onClick={() =>
                            analysisForm.setFieldsValue({
                              prompt: "请给出下一步行动清单：按优先级列出3-8条学习建议/任务拆解。",
                            })
                          }
                        >
                          行动模板
                        </Button>
                      </Space>
                      <Form.Item name="prompt" label="自定义Prompt（可选）">
                        <Input.TextArea rows={5} placeholder="留空则使用默认模板" />
                      </Form.Item>
                    </Form>
                  </Card>

                  <Card
                    title="分析结果"
                    size="small"
                    extra={
                      <Button
                        size="small"
                        onClick={async () => {
                          if (!analysisResult) return;
                          try {
                            await navigator.clipboard.writeText(analysisResult);
                            message.success("已复制");
                          } catch {
                            message.error("复制失败");
                          }
                        }}
                        disabled={!analysisResult}
                      >
                        复制
                      </Button>
                    }
                    styles={{ body: { overflowX: "auto" } }}
                  >
                    {analysisResult ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult}</ReactMarkdown>
                    ) : (
                      <Text type="secondary">暂无分析结果</Text>
                    )}
                  </Card>

                  <Card title="历史分析" size="small" loading={analysesLoading}>
                    {analyses.length === 0 ? (
                      <Text type="secondary">暂无历史记录</Text>
                    ) : (
                      <Space orientation="vertical" size={8} style={{ width: "100%" }}>
                        {analyses.map((a) => (
                          <div
                            key={a.id}
                            className="p-2.5 rounded-lg cursor-pointer"
                            style={{
                              border: "1px solid var(--ws-color-border)",
                              background: "var(--ws-color-surface)",
                            }}
                            onClick={() => setAnalysisResult(a.result_text)}
                          >
                            <div className="flex justify-between gap-2.5">
                              <Text strong>
                                {a.analysis_type} · {(agents || []).find((x) => x.id === a.agent_id)?.agent_name ||
                                  (agents || []).find((x) => x.id === a.agent_id)?.name ||
                                  `智能体${a.agent_id}`}
                              </Text>
                              <Text type="secondary" className="text-xs">
                                {dayjs(a.created_at).format("YYYY-MM-DD HH:mm")}
                              </Text>
                            </div>
                            <Text type="secondary" className="text-xs">
                              点击查看结果
                            </Text>
                          </div>
                        ))}
                      </Space>
                    )}
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title={`深度分析（${selectedSessionIds.length}个会话）`}
        open={compareVisible}
        onCancel={() => setCompareVisible(false)}
        onOk={async () => {
          const values = await compareForm.validateFields();
          const analysisType = values.analysis_type;
          if (analysisType === "cross_system") {
            setCompareState((s) => ({ ...s, loading: true, result: "" }));
            try {
              const res = await groupDiscussionApi.adminCrossSystemAnalyze({
                sessionIds: selectedSessionIds,
                agentId: values.agent_id,
                ...(values.prompt ? {} : {}),
              });
              if (!res.success) { message.error(res.message || "跨系统分析失败"); return; }
              setCompareState((s) => ({ ...s, result: res.data.result_text }));
              message.success("跨系统分析完成");
            } catch { message.error("跨系统分析失败"); }
            finally { setCompareState((s) => ({ ...s, loading: false })); }
          } else {
            await handleCompareAnalyze();
          }
        }}
        confirmLoading={compareState.loading}
        okText="开始分析"
        width={980}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Card size="small" styles={{ body: { background: "#ffffff" } }}>
            <Form form={compareForm} layout="vertical">
              <Space wrap style={{ width: "100%" }}>
                <Form.Item name="agent_id" label="使用智能体" rules={[{ required: true, message: "请选择智能体" }]} style={{ minWidth: 320 }}>
                  <Select showSearch optionFilterProp="label" options={(agents || []).map((a) => ({ value: a.id, label: `${a.agent_name || a.name}（${a.agent_type}）` }))} />
                </Form.Item>
                <Form.Item name="bucket_seconds" label="时间桶" style={{ width: 160 }}>
                  <Select options={[{ value: 180, label: "3分钟" }, { value: 300, label: "5分钟" }, { value: 600, label: "10分钟" }]} />
                </Form.Item>
                <Form.Item name="analysis_type" label="分析类型" style={{ width: 240 }}>
                  <Select options={[
                    { value: "learning_compare", label: "横向对比分析" },
                    { value: "cross_system", label: "跨系统关联分析" },
                  ]} />
                </Form.Item>
              </Space>
              <Space wrap className="mb-2">
                <Button size="small" type={compareState.useCache ? "primary" : "default"} onClick={() => setCompareState((s) => ({ ...s, useCache: !s.useCache }))}>
                  {compareState.useCache ? "使用缓存：开" : "使用缓存：关"}
                </Button>
              </Space>
              <div className="mb-2">
                <Text type="secondary" className="text-xs mb-1.5 block">预设 Prompt 模板（点击填入）：</Text>
                <Space wrap size={6}>
                  <Button size="small" onClick={() => compareForm.setFieldsValue({ prompt: "请按时间桶汇总各组讨论的学习主题，横向对比共性与差异，梳理代表性问题链条，给出教学建议。" })}>横向对比</Button>
                  <Button size="small" onClick={() => compareForm.setFieldsValue({ prompt: "请对比小组讨论热点话题与AI智能体提问热门问题，分析话题关联性、学生学习路径、共性知识盲点和AI依赖度，给出教学调整建议。" })}>跨系统关联</Button>
                  <Button size="small" onClick={() => compareForm.setFieldsValue({ prompt: "请重点分析各组讨论中暴露的知识薄弱点和认知误区，按严重程度排序，给出针对性的教学补救方案。" })}>知识盲点诊断</Button>
                  <Button size="small" onClick={() => compareForm.setFieldsValue({ prompt: "请评估各组的讨论质量（深度、参与度、问题解决率），排名并说明理由，推荐2-3个值得全班分享的优秀讨论片段。" })}>讨论质量评估</Button>
                  <Button size="small" onClick={() => compareForm.setFieldsValue({ prompt: "" })}>清空</Button>
                </Space>
              </div>
              <Form.Item name="prompt" label="自定义 Prompt（可选，留空使用默认模板）">
                <Input.TextArea rows={4} placeholder="输入你的分析指令..." />
              </Form.Item>
            </Form>
          </Card>

          {compareState.loading && (
            <Card size="small">
              <div className="text-center py-4">
                <Spin />
                <div className="mt-2">
                  <Text type="secondary">正在调用智能体分析，请耐心等待（可能需要 30-120 秒）...</Text>
                </div>
              </div>
            </Card>
          )}

          <Card title="分析结果" size="small" styles={{ body: { overflowX: "auto" } }}>
            {compareState.result ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{compareState.result}</ReactMarkdown>
            ) : (
              <Text type="secondary">{compareState.loading ? "分析中..." : "暂无结果，请点击「开始分析」"}</Text>
            )}
          </Card>
        </Space>
      </Modal>

      <Modal
        title={`禁言成员：${muteState.target?.full_name || muteState.target?.username}`}
        open={muteState.visible}
        onCancel={() => setMuteState((s) => ({ ...s, visible: false }))}
        onOk={handleConfirmMute}
        confirmLoading={muteState.loading}
        width={400}
      >
        <div className="py-5">
          <Text className="block mb-3">请选择禁言时长：</Text>
          <Radio.Group
            onChange={(e) => {
              const v = e.target.value;
              const mins = v === "10m" ? 10 : v === "1h" ? 60 : v === "24h" ? 1440 : muteState.customMinutes;
              setMuteState((s) => ({ ...s, durationType: v, customMinutes: mins }));
            }}
            value={muteState.durationType}
          >
            <Space orientation="vertical">
              <Radio value="10m">10分钟</Radio>
              <Radio value="1h">1小时</Radio>
              <Radio value="24h">24小时</Radio>
              <Radio value="custom">
                自定义时长
                {muteState.durationType === "custom" ? (
                    <InputNumber
                    className="w-24 ml-2.5"
                    min={1}
                    value={muteState.customMinutes}
                    onChange={(v) => setMuteState((s) => ({ ...s, customMinutes: v || 1 }))}
                    addonAfter="分钟"
                  />
                ) : null}
              </Radio>
            </Space>
          </Radio.Group>
        </div>
      </Modal>

      <Modal
        title="添加成员"
        open={addMemberVisible}
        onCancel={() => setAddMemberVisible(false)}
        onOk={handleAddMember}
        confirmLoading={addMemberLoading}
        width={500}
      >
        <div className="py-5">
          <Text className="block mb-2">搜索用户：</Text>
          <Select
            showSearch
            style={{ width: "100%" }}
            placeholder="输入姓名或学号搜索"
            defaultActiveFirstOption={false}
            filterOption={false}
            onSearch={handleSearchUsers}
            onChange={setSelectedUserId}
            notFoundContent={userSearchLoading ? <Text type="secondary">搜索中...</Text> : null}
            loading={userSearchLoading}
            value={selectedUserId}
            options={(searchedUsers || []).map((d) => ({
              value: d.id,
              label: `${d.full_name} (${d.student_id || d.username})`,
            }))}
          />
        </div>
      </Modal>
    </div>
  );
};

export default GroupDiscussionAdminTab;
