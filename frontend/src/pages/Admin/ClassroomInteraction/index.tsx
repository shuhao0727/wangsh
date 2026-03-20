import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Table,
  Button,
  Tag,
  Badge,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Popconfirm,
  message,
  Drawer,
  Progress,
  Segmented,
  Pagination,
  Alert,
} from "antd";
import {
  PlusOutlined, PlayCircleOutlined, StopOutlined, DeleteOutlined,
  BarChartOutlined, EditOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import { classroomApi, Activity, ActivityCreateRequest, ActivityStats, OptionItem, ActiveAgentOption } from "@services/classroom";

const parseBlankAnswers = (raw?: string | null): string[] => {
  const text = String(raw || "").trim();
  if (!text) return [];
  if (!text.startsWith("[") && !text.startsWith("{")) return [text];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? "").trim());
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => String((parsed as any)[k] ?? "").trim());
    }
  } catch {}
  return [text];
};

const toFillBlankPayload = (values: any): string | undefined => {
  const blanks = (values.blank_answers || []).map((v: any) => String(v || "").trim()).filter(Boolean);
  if (blanks.length === 0) return undefined;
  if (blanks.length === 1) return blanks[0];
  return JSON.stringify(blanks);
};

const formatCorrectAnswer = (raw?: string | null): string => {
  const blanks = parseBlankAnswers(raw);
  if (blanks.length <= 1) return String(raw || "");
  return blanks.map((v, i) => `(${i + 1}) ${v}`).join("；");
};

const parseErrorMessage = (error: any): string => {
  return String(error?.response?.data?.detail || error?.message || "操作失败");
};

const AdminClassroomInteractionPage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerActivity, setDrawerActivity] = useState<Activity | null>(null);
  const [drawerStats, setDrawerStats] = useState<ActivityStats | null>(null);
  const [activeAgents, setActiveAgents] = useState<ActiveAgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>(undefined);
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [form] = Form.useForm();
  const [activityType, setActivityType] = useState<"vote" | "fill_blank">("vote");
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await classroomApi.list({ skip: (page - 1) * pageSize, limit: pageSize, status: statusFilter });
      setActivities(resp.items);
      setTotal(resp.total);
    } catch (e: any) { message.error(parseErrorMessage(e)); }
    setLoading(false);
  }, [page, pageSize, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const fetchActiveAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const rows = await classroomApi.getActiveAgents();
      setActiveAgents(rows);
      setSelectedAgentId((prev) => {
        if (rows.length === 0) return undefined;
        if (prev == null) return rows[0].id;
        if (!rows.some((row) => row.id === prev)) return rows[0].id;
        return prev;
      });
    } catch (e: any) {
      setActiveAgents([]);
      setSelectedAgentId(undefined);
      message.error(parseErrorMessage(e));
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveAgents();
  }, [fetchActiveAgents]);

  const buildAnalysisConfig = () => {
    const prompt = analysisPrompt.trim();
    return {
      analysis_agent_id: selectedAgentId,
      analysis_prompt: prompt || undefined,
    };
  };

  const handleCreate = async (values: any) => {
    try {
      const analysisConfig = buildAnalysisConfig();
      const data: ActivityCreateRequest = {
        activity_type: activityType,
        title: values.title,
        time_limit: values.time_limit || 60,
        correct_answer: activityType === "fill_blank" ? toFillBlankPayload(values) : (values.correct_answer || undefined),
        allow_multiple: values.allow_multiple || false,
        analysis_agent_id: analysisConfig.analysis_agent_id,
        analysis_prompt: analysisConfig.analysis_prompt,
      };
      if (activityType === "vote" && values.options) {
        data.options = values.options.filter((o: any) => o?.text);
      }
      if (editingId) {
        await classroomApi.update(editingId, data);
        message.success("已更新");
      } else {
        await classroomApi.create(data);
        message.success("已创建");
      }
      setModalOpen(false);
      fetchList();
    } catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const handleStart = async (id: number) => {
    try {
      await classroomApi.start(id);
      message.success("活动已开始");
      fetchList();
    } catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const handleEnd = async (id: number) => {
    try {
      await classroomApi.end(id, buildAnalysisConfig());
      message.success("活动已结束");
      fetchList();
      if (drawerActivity?.id === id) refreshDrawer(id);
    } catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const handleDelete = async (id: number) => {
    try {
      await classroomApi.remove(id);
      message.success("已删除");
      fetchList();
    } catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const refreshDrawer = async (id: number) => {
    try {
      const detail = await classroomApi.getDetail(id);
      setDrawerActivity(detail);
      setDrawerStats(detail.stats || null);
    } catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const openDrawer = (record: Activity) => {
    setDrawerOpen(true);
    refreshDrawer(record.id);
    if (record.status === "active") {
      statsTimerRef.current = setInterval(() => refreshDrawer(record.id), 3000);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerActivity(null);
    setDrawerStats(null);
    if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current = undefined; }
  };

  useEffect(() => () => { if (statsTimerRef.current) clearInterval(statsTimerRef.current); }, []);

  const analysisContext = drawerActivity?.analysis_context || {};
  const riskSlots = Array.isArray(analysisContext.risk_slots) ? analysisContext.risk_slots : [];
  const commonMistakes = Array.isArray(analysisContext.common_mistakes) ? analysisContext.common_mistakes : [];
  const analysisStatusMap: Record<string, { color: string; text: string }> = {
    pending: { color: "default", text: "待分析" },
    running: { color: "blue", text: "分析中" },
    success: { color: "success", text: "分析成功" },
    failed: { color: "red", text: "分析失败" },
    skipped: { color: "warning", text: "已跳过" },
    not_applicable: { color: "default", text: "不适用" },
  };
  const analysisStatus = analysisStatusMap[String(drawerActivity?.analysis_status || "pending")] || analysisStatusMap.pending;

  return (
    <AdminPage scrollable={false}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: 24, gap: 12 }}>
        <div style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: 12, background: "#fafafa" }}>
          <Space size={12} wrap style={{ width: "100%" }}>
            <Select
              value={selectedAgentId}
              onChange={setSelectedAgentId}
              placeholder={activeAgents.length > 0 ? "选择用于自动分析的智能体" : "暂无可用智能体"}
              style={{ width: 280 }}
              options={activeAgents.map((agent) => ({ label: agent.name, value: agent.id }))}
              loading={loadingAgents}
              disabled={loadingAgents || activeAgents.length === 0}
            />
            <Input
              placeholder={activeAgents.length > 0 ? "可选：补充分析提示词（用于活动结束自动分析）" : "请先在智能体管理中启用至少一个智能体"}
              value={analysisPrompt}
              onChange={(e) => setAnalysisPrompt(e.target.value)}
              maxLength={500}
              style={{ flex: 1, minWidth: 260 }}
              disabled={activeAgents.length === 0}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchActiveAgents} loading={loadingAgents}>刷新智能体</Button>
          </Space>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Space>
            <Select
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              allowClear
              placeholder="状态筛选"
              style={{ width: 120 }}
            >
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="active">进行中</Select.Option>
              <Select.Option value="ended">已结束</Select.Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchList}>刷新</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); setActivityType("vote"); form.resetFields(); form.setFieldsValue({ blank_answers: [""] }); setModalOpen(true); }}>
            创建活动
          </Button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AdminTablePanel
            loading={loading}
            isEmpty={!loading && activities.length === 0}
            emptyDescription="暂无课堂互动活动"
            pagination={(
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={(nextPage, nextPageSize) => {
                  if (nextPageSize && nextPageSize !== pageSize) {
                    setPageSize(nextPageSize);
                    setPage(1);
                    return;
                  }
                  setPage(nextPage);
                }}
                showSizeChanger
                showTotal={(t) => `共 ${t} 条`}
              />
            )}
          >
            <Table
              dataSource={activities}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="middle"
              columns={[
                { title: "ID", dataIndex: "id", width: 60 },
                { title: "标题", dataIndex: "title", ellipsis: true },
                {
                  title: "类型", dataIndex: "activity_type", width: 80,
                  render: (t: string) => <Tag color={t === "vote" ? "blue" : "green"}>{t === "vote" ? "投票" : "填空"}</Tag>,
                },
                {
                  title: "状态", dataIndex: "status", width: 90,
                  render: (s: string) => {
                    const map: Record<string, { status: any; text: string }> = {
                      draft: { status: "default", text: "草稿" },
                      active: { status: "processing", text: "进行中" },
                      ended: { status: "success", text: "已结束" },
                    };
                    const m = map[s] || { status: "default", text: s };
                    return <Badge status={m.status} text={m.text} />;
                  },
                },
                { title: "时限", dataIndex: "time_limit", width: 70, render: (v: number) => v > 0 ? `${v}s` : "无" },
                { title: "参与", dataIndex: "response_count", width: 60 },
                {
                  title: "操作", width: 220,
                  render: (_: any, record: Activity) => (
                    <Space size="small">
                      {record.status !== "active" && (
                        <>
                          <Button size="small" icon={<EditOutlined />} onClick={() => {
                            setEditingId(record.id);
                            setActivityType(record.activity_type as any);
                            form.setFieldsValue({
                              ...record,
                              blank_answers: record.activity_type === "fill_blank" ? parseBlankAnswers(record.correct_answer) : undefined,
                            });
                            setModalOpen(true);
                          }}>编辑</Button>
                          {record.status === "draft" && (
                            <>
                              <Popconfirm title="确认开始？" onConfirm={() => handleStart(record.id)}>
                                <Button size="small" type="primary" icon={<PlayCircleOutlined />}>开始</Button>
                              </Popconfirm>
                              <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
                                <Button size="small" danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            </>
                          )}
                        </>
                      )}
                      {record.status === "active" && (
                        <Popconfirm title="确认结束？" onConfirm={() => handleEnd(record.id)}>
                          <Button size="small" danger icon={<StopOutlined />}>结束</Button>
                        </Popconfirm>
                      )}
                      <Button size="small" icon={<BarChartOutlined />} onClick={() => openDrawer(record)}>详情</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </AdminTablePanel>
        </div>
      </div>
      <Modal
        title={editingId ? "编辑活动" : "创建活动"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ time_limit: 60, allow_multiple: false, options: [{ key: "A", text: "" }, { key: "B", text: "" }] }}>
          <div style={{ marginBottom: 16 }}>
            <Segmented
              value={activityType}
              onChange={(v) => {
                const next = v as "vote" | "fill_blank";
                setActivityType(next);
                if (next === "fill_blank") {
                  const cur = form.getFieldValue("blank_answers");
                  if (!Array.isArray(cur) || cur.length === 0) form.setFieldValue("blank_answers", [""]);
                }
              }}
              options={[{ label: "投票", value: "vote" }, { label: "填空", value: "fill_blank" }]}
            />
          </div>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="活动标题" maxLength={200} />
          </Form.Item>
          {activityType === "vote" && (
            <>
              <Form.List name="options">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, idx) => (
                      <Space key={field.key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                        <Form.Item {...field} name={[field.name, "key"]} noStyle initialValue={String.fromCharCode(65 + idx)}>
                          <Input style={{ width: 40 }} disabled />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, "text"]} noStyle rules={[{ required: true, message: "选项内容" }]}>
                          <Input placeholder={`选项 ${String.fromCharCode(65 + idx)}`} style={{ width: 300 }} />
                        </Form.Item>
                        {fields.length > 2 && <Button size="small" danger onClick={() => remove(field.name)}>删除</Button>}
                      </Space>
                    ))}
                    {fields.length < 6 && <Button type="dashed" onClick={() => add({ key: String.fromCharCode(65 + fields.length), text: "" })} block icon={<PlusOutlined />}>添加选项</Button>}
                  </>
                )}
              </Form.List>
              <Form.Item name="allow_multiple" label="允许多选" valuePropName="checked" style={{ marginTop: 12 }}>
                <Switch />
              </Form.Item>
            </>
          )}
          {activityType === "vote" && (
            <Form.Item name="correct_answer" label="正确答案">
              <Input placeholder="如 A 或 A,B" />
            </Form.Item>
          )}
          {activityType === "fill_blank" && (
            <Form.List name="blank_answers">
              {(fields, { add, remove }) => (
                <>
                  <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
                    在标题中可使用（1）（2）... 作为空位标记；这里配置每个空位的标准答案
                  </div>
                  {fields.map((field, idx) => (
                    <Space key={field.key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                      <Tag color="purple">空位 {idx + 1}</Tag>
                      <Form.Item {...field} name={field.name} noStyle rules={[{ required: true, message: "请输入标准答案" }]}>
                        <Input placeholder={`空位 ${idx + 1} 标准答案`} style={{ width: 320 }} />
                      </Form.Item>
                      {fields.length > 1 && <Button size="small" danger onClick={() => remove(field.name)}>删除</Button>}
                    </Space>
                  ))}
                  {fields.length < 10 && <Button type="dashed" onClick={() => add("")} block icon={<PlusOutlined />}>添加空位</Button>}
                </>
              )}
            </Form.List>
          )}
          <Form.Item name="time_limit" label="时间限制(秒)" rules={[{ required: true }]}>
            <InputNumber min={0} max={3600} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title={drawerActivity?.title || "活动详情"}
        open={drawerOpen}
        onClose={closeDrawer}
        width={480}
      >
        {drawerActivity && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Tag color={drawerActivity.activity_type === "vote" ? "blue" : "green"}>
                {drawerActivity.activity_type === "vote" ? "投票" : "填空"}
              </Tag>
              <Badge status={drawerActivity.status === "active" ? "processing" : drawerActivity.status === "ended" ? "success" : "default"} text={drawerActivity.status === "active" ? "进行中" : drawerActivity.status === "ended" ? "已结束" : "草稿"} />
              {drawerActivity.status === "active" && drawerActivity.remaining_seconds != null && (
                <Tag color="orange" style={{ marginLeft: 8 }}>剩余 {drawerActivity.remaining_seconds}s</Tag>
              )}
            </div>
            {drawerActivity.correct_answer && (
              <div style={{ marginBottom: 12, color: "#999", fontSize: 13 }}>正确答案：{formatCorrectAnswer(drawerActivity.correct_answer)}</div>
            )}
            {drawerStats && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>统计 · 共 {drawerStats.total_responses} 人参与</div>
                {drawerActivity.activity_type === "vote" && drawerStats.option_counts && drawerActivity.options && (
                  <div>
                    {drawerActivity.options.map((opt: OptionItem) => {
                      const count = drawerStats.option_counts?.[opt.key] || 0;
                      const pct = drawerStats.total_responses > 0 ? Math.round(count / drawerStats.total_responses * 100) : 0;
                      const isCorrect = drawerActivity.correct_answer?.includes(opt.key);
                      return (
                        <div key={opt.key} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
                            <span style={{ color: isCorrect ? "#52c41a" : "#333" }}>{opt.key}. {opt.text}</span>
                            <span style={{ color: "#999" }}>{count} 票 ({pct}%)</span>
                          </div>
                          <Progress percent={pct} showInfo={false} strokeColor={isCorrect ? "#52c41a" : "#4096ff"} size="small" />
                        </div>
                      );
                    })}
                  </div>
                )}
                {drawerActivity.activity_type === "fill_blank" && (
                  <div>
                    {drawerStats.correct_rate != null ? (
                      <div style={{ textAlign: "center", padding: 20 }}>
                        <Progress type="circle" percent={drawerStats.correct_rate} size={100} format={(p) => `${p}%`} />
                        <div style={{ marginTop: 8, color: "#999" }}>整体正确率</div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: 8, color: "#999", fontSize: 12 }}>当前暂无作答数据，可先发起活动并收集作答后再看统计。</div>
                    )}
                    {Array.isArray(drawerStats.blank_slot_stats) && drawerStats.blank_slot_stats.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>空位明细</div>
                        {drawerStats.blank_slot_stats.map((slot) => (
                          <div key={slot.slot_index} style={{ padding: "8px 10px", border: "1px solid #f0f0f0", borderRadius: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 13, marginBottom: 4 }}>
                              <Tag color="purple">空位 {slot.slot_index}</Tag>
                              标准答案：{slot.correct_answer}
                            </div>
                            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                              正确 {slot.correct_count}/{slot.total_count}（{slot.correct_rate ?? 0}%）
                            </div>
                            {slot.top_wrong_answers?.length > 0 && (
                              <div style={{ fontSize: 12, color: "#999" }}>
                                高频错答：{slot.top_wrong_answers.slice(0, 3).map((x) => `${x.answer}(${x.count})`).join("、")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(drawerStats.top_wrong_answers) && drawerStats.top_wrong_answers.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                        错误最多答案：{drawerStats.top_wrong_answers.slice(0, 5).map((x) => `${x.answer}(${x.count})`).join("、")}
                      </div>
                    )}
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      <Tag color={analysisStatus.color}>{analysisStatus.text}</Tag>
                      {drawerActivity.analysis_updated_at && <span style={{ color: "#999", fontSize: 12 }}>更新时间：{new Date(drawerActivity.analysis_updated_at).toLocaleString()}</span>}
                    </div>
                    {drawerActivity.analysis_status === "failed" && (
                      <div style={{ marginTop: 10 }}>
                        <Alert
                          type="error"
                          showIcon
                          message="自动分析失败"
                          description={`失败原因：${drawerActivity.analysis_error || "未知错误"}。可调整顶部AI配置后结束新活动重试。`}
                        />
                      </div>
                    )}
                    {drawerActivity.analysis_status === "skipped" && (
                      <div style={{ marginTop: 10 }}>
                        <Alert type="warning" showIcon message="自动分析已跳过" description="当前活动作答数据不足，系统未执行智能体分析。" />
                      </div>
                    )}
                    {drawerActivity.analysis_status === "running" && (
                      <div style={{ marginTop: 10 }}>
                        <Alert type="info" showIcon message="自动分析进行中" description="请稍后刷新详情查看分析结论。" />
                      </div>
                    )}
                    {drawerActivity.analysis_status === "success" && drawerActivity.analysis_result && (
                      <div style={{ marginTop: 10, border: "1px solid #f0f0f0", borderRadius: 8, padding: 10, background: "#fafafa" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>AI分析结论</div>
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, color: "#333" }}>{drawerActivity.analysis_result}</pre>
                        {(riskSlots.length > 0 || commonMistakes.length > 0) && (
                          <div style={{ marginTop: 10, borderTop: "1px dashed #e5e5e5", paddingTop: 10 }}>
                            {riskSlots.length > 0 && (
                              <div style={{ marginBottom: 6, fontSize: 12, color: "#555" }}>
                                关键风险空位：{riskSlots.slice(0, 3).map((slot) => `空位${slot.slot_index}(${slot.correct_rate ?? 0}%)`).join("、")}
                              </div>
                            )}
                            {commonMistakes.length > 0 && (
                              <div style={{ fontSize: 12, color: "#555" }}>
                                高频错答摘要：{commonMistakes.slice(0, 5).map((item) => `${item.answer}(${item.count})`).join("、")}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {drawerActivity.status === "active" && (
              <Popconfirm title="确认结束活动？" onConfirm={() => handleEnd(drawerActivity.id)}>
                <Button danger block style={{ marginTop: 20 }} icon={<StopOutlined />}>结束活动</Button>
              </Popconfirm>
            )}
          </div>
        )}
      </Drawer>
    </AdminPage>
  );
};

export default AdminClassroomInteractionPage;
