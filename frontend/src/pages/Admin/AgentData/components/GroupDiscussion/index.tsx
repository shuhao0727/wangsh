import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tabs, Typography, message, Tag, Radio, InputNumber, Switch } from "antd";
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
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResult, setCompareResult] = useState<string>("");
  const [compareLastAnalysisId, setCompareLastAnalysisId] = useState<number | null>(null);
  const [compareUseCache, setCompareUseCache] = useState(true);

  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [muteTargetMember, setMuteTargetMember] = useState<GroupDiscussionMember | null>(null);
  const [muteDurationType, setMuteDurationType] = useState<"10m" | "1h" | "24h" | "custom">("10m");
  const [muteCustomMinutes, setMuteCustomMinutes] = useState<number>(10);
  const [muteLoading, setMuteLoading] = useState(false);

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
      setCompareLoading(true);
      const values = await compareForm.validateFields();
      const res = await groupDiscussionApi.adminCompareAnalyze({
        sessionIds: selectedSessionIds,
        agentId: values.agent_id,
        bucketSeconds: values.bucket_seconds,
        analysisType: values.analysis_type,
        prompt: values.prompt || undefined,
        useCache: compareUseCache,
      });
      if (!res.success) {
        message.error(res.message || "对比分析失败");
        return;
      }
      setCompareResult(res.data.result_text || "");
      const nextId = Number(res.data.analysis_id || 0);
      if (compareUseCache && compareLastAnalysisId && nextId === compareLastAnalysisId) {
        message.success("对比分析完成（命中缓存）");
      } else {
        message.success("对比分析完成");
      }
      if (Number.isFinite(nextId) && nextId > 0) setCompareLastAnalysisId(nextId);
    } finally {
      setCompareLoading(false);
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
    setMuteTargetMember(member);
    setMuteDurationType("10m");
    setMuteCustomMinutes(10);
    setMuteModalVisible(true);
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
    if (!currentSession || !muteTargetMember) return;
    setMuteLoading(true);
    try {
      let minutes = 10;
      if (muteDurationType === "10m") minutes = 10;
      else if (muteDurationType === "1h") minutes = 60;
      else if (muteDurationType === "24h") minutes = 1440;
      else if (muteDurationType === "custom") minutes = muteCustomMinutes;

      const res = await groupDiscussionApi.adminMuteUser({
        sessionId: currentSession.id,
        userId: muteTargetMember.user_id,
        minutes,
      });
      if (res.success) {
        message.success("禁言成功");
        setMuteModalVisible(false);
        loadMembers();
      } else {
        message.error(res.message || "禁言失败");
      }
    } catch (e) {
      message.error("禁言失败");
    } finally {
      setMuteLoading(false);
    }
  };

  const sessionTitle = currentSession
    ? `小组讨论：${currentSession.session_date} · ${currentSession.class_name} · ${currentSession.group_no}组${
        currentSession.group_name ? ` · ${currentSession.group_name}` : ""
      }`
    : "小组讨论";

  return (
    <div>
      <AdminCard
        size="small"
        style={{ marginBottom: 16 }}
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
          <Button
            disabled={selectedSessionIds.length < 2}
            onClick={() => {
              setCompareResult("");
              setCompareLastAnalysisId(null);
              compareForm.resetFields();
              compareForm.setFieldsValue({
                bucket_seconds: 180,
                analysis_type: "learning_compare",
              });
              setCompareVisible(true);
            }}
          >
            横向对比分析（{selectedSessionIds.length}）
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #d9d9d9', padding: '4px 12px', borderRadius: 6, background: '#fff' }}>
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

      <AdminTablePanel
        loading={loading}
        isEmpty={!loading && sessions.length === 0}
        emptyDescription="暂无数据"
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
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p: number, s: number) => {
              setPage(p);
              setPageSize(s);
            },
          }}
          scroll={{ x: 980 }}
        />
      </AdminTablePanel>

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
                        <div key={m.id} style={{ display: "flex", justifyContent: "flex-start" }}>
                          <div style={{ maxWidth: "92%" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                              <Text strong style={{ fontSize: 12 }}>
                                {m.user_display_name}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {dayjs(m.created_at).format("HH:mm:ss")}
                              </Text>
                            </div>
                            <div
                              style={{
                                padding: "8px 10px",
                                borderRadius: 12,
                                background: "var(--ws-color-surface)",
                                border: "1px solid var(--ws-color-border)",
                                boxShadow: "none",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              <Text style={{ color: "var(--ws-color-text)" }}>{m.content}</Text>
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
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
                          width: 180,
                          render: (_, r) => {
                            const isMuted = r.muted_until && dayjs(r.muted_until).isAfter(dayjs());
                            return (
                              <Space size={4}>
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
                      <Space wrap style={{ marginBottom: 8 }}>
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
                            style={{
                              padding: 10,
                              borderRadius: 10,
                              border: "1px solid var(--ws-color-border)",
                              background: "var(--ws-color-surface)",
                              cursor: "pointer",
                            }}
                            onClick={() => setAnalysisResult(a.result_text)}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <Text strong>
                                {a.analysis_type} · {(agents || []).find((x) => x.id === a.agent_id)?.agent_name ||
                                  (agents || []).find((x) => x.id === a.agent_id)?.name ||
                                  `智能体${a.agent_id}`}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {dayjs(a.created_at).format("YYYY-MM-DD HH:mm")}
                              </Text>
                            </div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
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
        title={`横向对比分析（${selectedSessionIds.length}个会话）`}
        open={compareVisible}
        onCancel={() => setCompareVisible(false)}
        onOk={handleCompareAnalyze}
        confirmLoading={compareLoading}
        okText="开始对比分析"
        width={980}
      >
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          <Card
            size="small"
            styles={{
              body: {
                background: "#ffffff",
              },
            }}
          >
            <Form form={compareForm} layout="vertical">
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
                <Form.Item name="bucket_seconds" label="时间桶" style={{ width: 160 }}>
                  <Select
                    options={[
                      { value: 180, label: "3分钟" },
                      { value: 300, label: "5分钟" },
                      { value: 600, label: "10分钟" },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="analysis_type" label="对比类型" style={{ width: 220 }}>
                  <Select
                    options={[
                      { value: "learning_compare", label: "同时间段主题对比" },
                    ]}
                  />
                </Form.Item>
              </Space>
              <Space wrap style={{ marginBottom: 8 }}>
                <Button
                  size="small"
                  type={compareUseCache ? "primary" : "default"}
                  onClick={() => setCompareUseCache((v) => !v)}
                >
                  {compareUseCache ? "使用缓存：开" : "使用缓存：关"}
                </Button>
              </Space>
              <Space wrap style={{ marginBottom: 8 }}>
                <Button
                  size="small"
                  onClick={() =>
                    compareForm.setFieldsValue({
                      prompt:
                        "请按时间桶汇总各组讨论的学习主题，并横向对比：共性、差异、代表性问题链条、结论演进。最后给出总体建议。",
                    })
                  }
                >
                  对比模板
                </Button>
              </Space>
              <Form.Item name="prompt" label="自定义Prompt（可选）">
                <Input.TextArea rows={5} placeholder="留空则使用默认模板" />
              </Form.Item>
            </Form>
          </Card>

          <Card title="对比分析结果" size="small" styles={{ body: { overflowX: "auto" } }}>
            {compareResult ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{compareResult}</ReactMarkdown>
            ) : (
              <Text type="secondary">暂无结果</Text>
            )}
          </Card>
        </Space>
      </Modal>

      <Modal
        title={`禁言成员：${muteTargetMember?.full_name || muteTargetMember?.username}`}
        open={muteModalVisible}
        onCancel={() => setMuteModalVisible(false)}
        onOk={handleConfirmMute}
        confirmLoading={muteLoading}
        width={400}
      >
        <div style={{ padding: "20px 0" }}>
          <Text style={{ display: "block", marginBottom: 12 }}>请选择禁言时长：</Text>
          <Radio.Group
            onChange={(e) => {
              setMuteDurationType(e.target.value);
              if (e.target.value === "10m") setMuteCustomMinutes(10);
              if (e.target.value === "1h") setMuteCustomMinutes(60);
              if (e.target.value === "24h") setMuteCustomMinutes(1440);
            }}
            value={muteDurationType}
          >
            <Space orientation="vertical">
              <Radio value="10m">10分钟</Radio>
              <Radio value="1h">1小时</Radio>
              <Radio value="24h">24小时</Radio>
              <Radio value="custom">
                自定义时长
                {muteDurationType === "custom" ? (
                  <InputNumber
                    style={{ width: 100, marginLeft: 10 }}
                    min={1}
                    value={muteCustomMinutes}
                    onChange={(v) => setMuteCustomMinutes(v || 1)}
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
        <div style={{ padding: "20px 0" }}>
          <Text style={{ display: "block", marginBottom: 8 }}>搜索用户：</Text>
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
