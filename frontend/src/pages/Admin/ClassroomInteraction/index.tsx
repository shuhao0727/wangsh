// 课堂互动 - 管理端

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Table, Button, Tag, Badge, Space, Modal, Form, Input, InputNumber,
  Select, Switch, Popconfirm, message, Drawer, Progress, Segmented,
  Pagination, Alert, Tooltip, Divider, Steps,
} from "antd";
import {
  PlusOutlined, PlayCircleOutlined, StopOutlined, DeleteOutlined,
  BarChartOutlined, EditOutlined, ReloadOutlined, RobotOutlined,
  LeftOutlined, RightOutlined, CheckOutlined, CodeOutlined, CopyOutlined,
} from "@ant-design/icons";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import {
  classroomApi, Activity, ActivityCreateRequest,
  ActivityStats, OptionItem, ActiveAgentOption,
} from "@services/classroom";

// ─── 工具函数 ───

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

// 从代码模板中提取 ___ 占位符数量
const countBlanksInCode = (code: string): number => {
  return (code.match(/___/g) || []).length;
};

// 从 options 中提取代码模板
const extractCodeTemplate = (options: OptionItem[] | null): string => {
  if (!Array.isArray(options)) return "";
  const codeOpt = options.find((o) => o.key === "__code__");
  return codeOpt?.text || "";
};

// 将代码模板打包进 options
const packCodeTemplate = (code: string): OptionItem[] => [
  { key: "__code__", text: code },
];

const formatCorrectAnswer = (raw?: string | null): string => {
  const blanks = parseBlankAnswers(raw);
  if (blanks.length <= 1) return String(raw || "");
  return blanks.map((v, i) => `(${i + 1}) ${v}`).join("；");
};

const parseErrorMessage = (error: any): string =>
  String(error?.response?.data?.detail || error?.message || "操作失败");

const ANALYSIS_STATUS_MAP: Record<string, { color: string; text: string }> = {
  pending:        { color: "default",  text: "待分析" },
  running:        { color: "blue",     text: "分析中" },
  success:        { color: "success",  text: "分析完成" },
  failed:         { color: "red",      text: "分析失败" },
  skipped:        { color: "warning",  text: "已跳过" },
  not_applicable: { color: "default",  text: "不适用" },
};

// 简单 Markdown 渲染
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  return (
    <div className="leading-relaxed text-sm text-gray-700">
      {text.split(/\n{2}/).map((para, i) => {
        if (para.startsWith("```")) {
          const code = para.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
          return <pre key={i} className="bg-gray-100 rounded-md px-3 py-2 text-xs my-2 overflow-auto">{code}</pre>;
        }
        return (
          <p key={i} className="my-1.5 whitespace-pre-wrap">
            {para.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        );
      })}
    </div>
  );
};

// ─── 分步创建/编辑 Modal ───

const STEP_TITLES = ["基本信息", "题目内容", "活动设置", "AI分析"];

interface ActivityFormModalProps {
  open: boolean;
  editingId: number | null;
  editingRecord: Activity | null;
  activeAgents: ActiveAgentOption[];
  loadingAgents: boolean;
  onRefreshAgents: () => void;
  onClose: () => void;
  onSuccess: () => void;
}

const ActivityFormModal: React.FC<ActivityFormModalProps> = ({
  open, editingId, editingRecord, activeAgents, loadingAgents, onRefreshAgents, onClose, onSuccess,
}) => {
  const [step, setStep] = useState(0);
  const [activityType, setActivityType] = useState<"vote" | "fill_blank">("vote");
  const [codeTemplate, setCodeTemplate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // 同步空位数量到 blank_answers
  const syncBlankAnswers = (code: string) => {
    const count = countBlanksInCode(code);
    const cur: string[] = form.getFieldValue("blank_answers") || [];
    if (count === cur.length) return;
    const next = Array.from({ length: Math.max(count, 1) }, (_, i) => cur[i] ?? "");
    form.setFieldValue("blank_answers", next);
  };

  // 初始化：打开时回填或重置
  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (editingRecord) {
      const type = editingRecord.activity_type as "vote" | "fill_blank";
      setActivityType(type);
      const code = type === "fill_blank" ? extractCodeTemplate(editingRecord.options as OptionItem[] | null) : "";
      setCodeTemplate(code);
      form.resetFields();
      form.setFieldsValue({
        title: editingRecord.title,
        time_limit: editingRecord.time_limit,
        allow_multiple: editingRecord.allow_multiple,
        correct_answer: editingRecord.correct_answer,
        options: type === "vote" && Array.isArray(editingRecord.options) && editingRecord.options.length > 0
          ? editingRecord.options
          : [{ key: "A", text: "" }, { key: "B", text: "" }],
        blank_answers: type === "fill_blank" ? parseBlankAnswers(editingRecord.correct_answer) : [""],
        analysis_agent_id: editingRecord.analysis_agent_id ?? undefined,
        analysis_prompt: editingRecord.analysis_prompt ?? "",
      });
    } else {
      setActivityType("vote");
      setCodeTemplate("");
      form.resetFields();
      form.setFieldsValue({
        time_limit: 60, allow_multiple: false,
        options: [{ key: "A", text: "" }, { key: "B", text: "" }],
        blank_answers: [""],
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    form.resetFields();
    setStep(0);
    setActivityType("vote");
    onClose();
  };

  const nextStep = async () => {
    try {
      // 只校验当前步骤的字段
      const fieldsToValidate: string[][] = [
        ["title"],
        activityType === "vote" ? ["options"] : ["blank_answers"],
        ["time_limit"],
        [],
      ];
      await form.validateFields(fieldsToValidate[step]);
      setStep((s) => s + 1);
    } catch {}
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const values = form.getFieldsValue(true);
      const data: ActivityCreateRequest = {
        activity_type: activityType,
        title: values.title,
        time_limit: values.time_limit ?? 60,
        correct_answer: activityType === "fill_blank"
          ? toFillBlankPayload(values)
          : (values.correct_answer || undefined),
        allow_multiple: values.allow_multiple || false,
        analysis_agent_id: values.analysis_agent_id || undefined,
        analysis_prompt: values.analysis_prompt?.trim() || undefined,
      };
      if (activityType === "vote") {
        data.options = (values.options || []).filter((o: OptionItem) => o?.text?.trim());
      } else if (codeTemplate.trim()) {
        data.options = packCodeTemplate(codeTemplate.trim());
      }
      if (editingId) {
        await classroomApi.update(editingId, data);
        message.success("已更新");
      } else {
        await classroomApi.create(data);
        message.success("创建成功");
      }
      handleClose();
      onSuccess();
    } catch (e: any) {
      message.error(parseErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex justify-between">
      <Button onClick={step === 0 ? handleClose : () => setStep((s) => s - 1)} icon={step > 0 ? <LeftOutlined /> : undefined}>
        {step === 0 ? "取消" : "上一步"}
      </Button>
      <Space>
        {step < 3 ? (
          <Button type="primary" onClick={nextStep} icon={<RightOutlined />} iconPosition="end">
            下一步
          </Button>
        ) : (
          <Button type="primary" loading={submitting} onClick={handleFinish} icon={<CheckOutlined />}>
            {editingId ? "保存" : "创建"}
          </Button>
        )}
      </Space>
    </div>
  );

  return (
    <Modal
      title={editingId ? "编辑活动" : "创建活动"}
      open={open}
      onCancel={handleClose}
      footer={footer}
      width={580}
      destroyOnClose
    >
      <Steps
        current={step}
        size="small"
        className="mb-6 mt-2"
        items={STEP_TITLES.map((t, i) => ({ title: t, status: i < step ? "finish" : i === step ? "process" : "wait" }))}
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={{ time_limit: 60, allow_multiple: false, options: [{ key: "A", text: "" }, { key: "B", text: "" }], blank_answers: [""] }}
      >
        {/* 步骤 1：基本信息 */}
        <div className={step === 0 ? "block" : "hidden"}>
          <Form.Item label="活动类型" required>
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
              options={[{ label: "投票 / 选择", value: "vote" }, { label: "填空", value: "fill_blank" }]}
              className="mb-1"
            />
          </Form.Item>
          <Form.Item name="title" label="活动标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="活动标题，填空题中可用（1）（2）标记空位" maxLength={200} />
          </Form.Item>
        </div>

        {/* 步骤 2：题目内容 */}
        <div className={step === 1 ? "block" : "hidden"}>
          {activityType === "vote" && (
            <>
              <Form.List name="options">
                {(fields, { add, remove }) => (
                  <>
                    <div className="text-xs text-gray-400 mb-2.5">至少2个选项，最多6个</div>
                    {fields.map((field, idx) => (
                      <Space key={field.key} align="baseline" className="flex mb-2">
                        <Form.Item {...field} name={[field.name, "key"]} noStyle initialValue={String.fromCharCode(65 + idx)}>
                          <Input style={{ width: 40 }} disabled />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, "text"]} noStyle rules={[{ required: true, message: "请填写选项" }]}>
                          <Input placeholder={`选项 ${String.fromCharCode(65 + idx)}`} style={{ width: 360 }} />
                        </Form.Item>
                        {fields.length > 2 && <Button size="small" danger onClick={() => remove(field.name)}>删除</Button>}
                      </Space>
                    ))}
                    {fields.length < 6 && (
                      <Button type="dashed" block icon={<PlusOutlined />}
                        onClick={() => add({ key: String.fromCharCode(65 + fields.length), text: "" })}>
                        添加选项
                      </Button>
                    )}
                  </>
                )}
              </Form.List>
              <Form.Item name="correct_answer" label="正确答案（可选）" className="mt-4">
                <Input placeholder="如 A 或 A,B（留空表示无标准答案）" />
              </Form.Item>
            </>
          )}
          {activityType === "fill_blank" && (
            <>
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
                  <CodeOutlined />
                  代码片段模板（可选）— 用 <Tag color="purple" className="!mx-0.5 font-mono">___</Tag> 标记需要填写的位置
                </div>
                <Input.TextArea
                  value={codeTemplate}
                  onChange={(e) => {
                    setCodeTemplate(e.target.value);
                    syncBlankAnswers(e.target.value);
                  }}
                  placeholder={`// 示例：\ndef add(a, b):\n    return ___ + ___`}
                  rows={8}
                  style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace", fontSize: 13 }}
                  className="!bg-code-bg !text-[#d4d4d4] !rounded-md"
                  spellCheck={false}
                />
                {codeTemplate && (
                  <div className="text-xs text-gray-500 mt-1">
                    检测到 <strong className="text-purple">{countBlanksInCode(codeTemplate)}</strong> 个空位
                  </div>
                )}
              </div>
              <Form.List name="blank_answers">
                {(fields, { add, remove }) => (
                  <>
                    <div className="text-xs text-gray-400 mb-2.5">
                      {codeTemplate ? "每个 ___ 对应一个标准答案" : "在标题中使用（1）（2）... 标记空位位置，这里填写每个空位的标准答案"}
                    </div>
                    {fields.map((field, idx) => (
                      <Space key={field.key} align="baseline" className="flex mb-2">
                        <Tag color="purple" className="min-w-[56px] text-center">空位 {idx + 1}</Tag>
                        <Form.Item {...field} name={field.name} noStyle rules={[{ required: true, message: "请输入答案" }]}>
                          <Input placeholder={`空位 ${idx + 1} 标准答案`} style={{ width: 360 }} />
                        </Form.Item>
                        {fields.length > 1 && <Button size="small" danger onClick={() => remove(field.name)}>删除</Button>}
                      </Space>
                    ))}
                    {fields.length < 10 && (
                      <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add("")}>
                        添加空位
                      </Button>
                    )}
                  </>
                )}
              </Form.List>
            </>
          )}
        </div>

        {/* 步骤 3：活动设置 */}
        <div className={step === 2 ? "block" : "hidden"}>
          <Form.Item name="time_limit" label="时间限制" rules={[{ required: true }]}>
            <InputNumber min={0} max={3600} style={{ width: 180 }} addonAfter="秒" />
          </Form.Item>
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-1.5">快速设置</div>
            <Space>
              {[30, 60, 120, 300, 0].map((v) => (
                <Button key={v} size="small" type="dashed"
                  onClick={() => form.setFieldValue("time_limit", v)}>
                  {v === 0 ? "无限" : `${v}s`}
                </Button>
              ))}
            </Space>
          </div>
          {activityType === "vote" && (
            <Form.Item name="allow_multiple" label="允许多选" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </div>

        {/* 步骤 4：AI 分析 */}
        <div className={step === 3 ? "block" : "hidden"}>
          <div className="text-xs text-gray-500 mb-4">活动结束后自动触发 AI 分析（可选，跳过则不分析）</div>
          <Form.Item name="analysis_agent_id" label="分析智能体">
            <Select
              placeholder={activeAgents.length > 0 ? "选择智能体" : "暂无可用智能体"}
              allowClear
              loading={loadingAgents}
              disabled={loadingAgents || activeAgents.length === 0}
              options={activeAgents.map((a) => ({ label: a.name, value: a.id }))}
              className="w-full"
            />
          </Form.Item>
          <Form.Item name="analysis_prompt" label="补充提示词（可选）">
            <Input.TextArea placeholder="可选：补充说明分析重点" maxLength={500} rows={3}
              disabled={activeAgents.length === 0} />
          </Form.Item>
          <Button size="small" icon={<ReloadOutlined />} onClick={onRefreshAgents} loading={loadingAgents}>
            刷新智能体列表
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

// ─── 主组件 ───

const AdminClassroomInteractionPage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<Activity | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerActivity, setDrawerActivity] = useState<Activity | null>(null);
  const [drawerStats, setDrawerStats] = useState<ActivityStats | null>(null);
  const [activeAgents, setActiveAgents] = useState<ActiveAgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await classroomApi.list({ skip: (page - 1) * pageSize, limit: pageSize, status: statusFilter });
      let items = resp.items;
      if (search.trim()) { const q = search.toLowerCase(); items = items.filter((a) => a.title.toLowerCase().includes(q)); }
      if (typeFilter) { items = items.filter((a) => a.activity_type === typeFilter); }
      setActivities(items);
      setTotal(resp.total);
    } catch (e: any) { message.error(parseErrorMessage(e)); }
    setLoading(false);
  }, [page, pageSize, statusFilter, typeFilter, search]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const fetchActiveAgents = useCallback(async () => {
    setLoadingAgents(true);
    try { setActiveAgents(await classroomApi.getActiveAgents()); }
    catch { setActiveAgents([]); }
    finally { setLoadingAgents(false); }
  }, []);

  useEffect(() => { fetchActiveAgents(); }, [fetchActiveAgents]);
  useEffect(() => () => { if (statsTimerRef.current) clearInterval(statsTimerRef.current); }, []);

  const openCreate = () => { setEditingId(null); setEditingRecord(null); setModalOpen(true); };
  const openEdit = (record: Activity) => { setEditingId(record.id); setEditingRecord(record); setModalOpen(true); };

  const handleStart = async (id: number) => {
    try { await classroomApi.start(id); message.success("活动已开始"); fetchList(); }
    catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const handleEnd = async (id: number) => {
    const act = activities.find((a) => a.id === id) || drawerActivity;
    try {
      await classroomApi.end(id, { analysis_agent_id: act?.analysis_agent_id ?? undefined, analysis_prompt: act?.analysis_prompt ?? undefined });
      message.success("活动已结束"); fetchList();
      if (drawerActivity?.id === id) refreshDrawer(id);
    } catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const handleDelete = async (id: number) => {
    try { await classroomApi.remove(id); message.success("已删除"); fetchList(); }
    catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      const result = await classroomApi.bulkRemove(selectedRowKeys);
      const skippedCount = result.skipped.length;
      if (skippedCount > 0) {
        message.warning(`已删除 ${result.deleted.length} 条，${skippedCount} 条进行中无法删除`);
      } else {
        message.success(`已删除 ${result.deleted.length} 条`);
      }
      setSelectedRowKeys([]);
      fetchList();
    } catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const handleDuplicate = async (id: number) => {
    try { await classroomApi.duplicate(id); message.success("已复制为新草稿"); fetchList(); }
    catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const handleRestart = async (id: number) => {
    try { await classroomApi.restart(id); message.success("已重新开始"); fetchList(); }
    catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const refreshDrawer = async (id: number) => {
    try { const d = await classroomApi.getDetail(id); setDrawerActivity(d); setDrawerStats(d.stats || null); }
    catch (e: any) { message.error(parseErrorMessage(e)); }
  };

  const openDrawer = (record: Activity) => {
    setDrawerOpen(true); refreshDrawer(record.id);
    if (record.status === "active") { statsTimerRef.current = setInterval(() => refreshDrawer(record.id), 3000); }
  };

  const closeDrawer = () => {
    setDrawerOpen(false); setDrawerActivity(null); setDrawerStats(null);
    if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current = undefined; }
  };

  const analysisContext = drawerActivity?.analysis_context || {};
  const riskSlots = Array.isArray(analysisContext.risk_slots) ? analysisContext.risk_slots : [];
  const commonMistakes = Array.isArray(analysisContext.common_mistakes) ? analysisContext.common_mistakes : [];
  const analysisStatus = ANALYSIS_STATUS_MAP[String(drawerActivity?.analysis_status || "")] || ANALYSIS_STATUS_MAP.pending;

  return (
    <AdminPage scrollable={false}>
      <div className="h-full flex flex-col p-6 gap-3">
        {/* 筛选栏 */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <Space wrap>
            <Input.Search
              placeholder="搜索标题"
              allowClear
              style={{ width: 220 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={() => { setPage(1); fetchList(); }}
            />
            <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} allowClear placeholder="状态" style={{ width: 110 }}>
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="active">进行中</Select.Option>
              <Select.Option value="ended">已结束</Select.Option>
            </Select>
            <Select value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} allowClear placeholder="类型" style={{ width: 100 }}>
              <Select.Option value="vote">投票</Select.Option>
              <Select.Option value="fill_blank">填空</Select.Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchList}>刷新</Button>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`确认删除选中的 ${selectedRowKeys.length} 条活动？（只有草稿状态可被删除）`}
                onConfirm={handleBulkDelete}
              >
                <Button danger icon={<DeleteOutlined />}>批量删除 ({selectedRowKeys.length})</Button>
              </Popconfirm>
            )}
          </Space>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>创建活动</Button>
          </Space>
        </div>

        {/* 列表 */}
        <div className="flex-1 min-h-0">
          <AdminTablePanel
            loading={loading}
            isEmpty={!loading && activities.length === 0}
            emptyDescription="暂无课堂互动活动"
            pagination={
              <Pagination
                current={page} pageSize={pageSize} total={total}
                onChange={(p, ps) => { if (ps !== pageSize) { setPageSize(ps); setPage(1); } else setPage(p); }}
                showSizeChanger showTotal={(t) => `共 ${t} 条`}
              />
            }
          >
            <Table dataSource={activities} rowKey="id" loading={loading} pagination={false} size="middle"
              rowSelection={{
                type: "checkbox",
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as number[]),
              }}
              columns={[
              { title: "ID", dataIndex: "id", width: 60 },
              { title: "标题", dataIndex: "title", ellipsis: true, width: 180 },
              { title: "类型", dataIndex: "activity_type", width: 80,
                render: (t: string) => <Tag color={t === "vote" ? "blue" : "green"}>{t === "vote" ? "投票" : "填空"}</Tag> },
              { title: "状态", dataIndex: "status", width: 90,
                render: (s: string) => {
                  const m: Record<string, any> = { draft: ["default","草稿"], active: ["processing","进行中"], ended: ["success","已结束"] };
                  const [status, text] = m[s] || ["default", s];
                  return <Badge status={status} text={text} />;
                } },
              { title: "分析", dataIndex: "analysis_status", width: 90,
                render: (s: string) => {
                  if (!s) return <span className="text-gray-300">—</span>;
                  const info = ANALYSIS_STATUS_MAP[s] || { color: "default", text: s };
                  return <Tag color={info.color} className="text-xs">{info.text}</Tag>;
                } },
              { title: "时限", dataIndex: "time_limit", width: 70, render: (v: number) => v > 0 ? `${v}s` : "无限" },
              { title: "参与", dataIndex: "response_count", width: 65,
                render: (v: number) => <span style={{ color: v ? "#1677ff" : "#bbb", fontWeight: v ? 600 : undefined }}>{v ?? 0}</span> },
              { title: "操作", width: 240,
                render: (_: any, record: Activity) => {
                  const isDraft = record.status === "draft";
                  const isActive = record.status === "active";
                  const isEnded = record.status === "ended";
                  return (
                    <Space size={4}>
                      {!isActive && (
                        <Tooltip title="编辑">
                          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                        </Tooltip>
                      )}
                      {isDraft && (
                        <Popconfirm title="确认开始？" onConfirm={() => handleStart(record.id)}>
                          <Tooltip title="开始">
                            <Button size="small" type="primary" icon={<PlayCircleOutlined />} />
                          </Tooltip>
                        </Popconfirm>
                      )}
                      {isActive && (
                        <Popconfirm title="确认结束活动？" onConfirm={() => handleEnd(record.id)}>
                          <Tooltip title="结束">
                            <Button size="small" danger icon={<StopOutlined />} />
                          </Tooltip>
                        </Popconfirm>
                      )}
                      {isEnded && (
                        <Popconfirm title="重新开始将清除所有答题记录，确认？" onConfirm={() => handleRestart(record.id)}>
                          <Tooltip title="重新开始">
                            <Button size="small" type="primary" icon={<PlayCircleOutlined />} />
                          </Tooltip>
                        </Popconfirm>
                      )}
                      {isEnded && (
                        <Tooltip title="复制为新草稿">
                          <Button size="small" icon={<CopyOutlined />} onClick={() => handleDuplicate(record.id)} />
                        </Tooltip>
                      )}
                      {!isActive && (
                        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
                          <Tooltip title="删除">
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Tooltip>
                        </Popconfirm>
                      )}
                      <Tooltip title="详情">
                        <Button size="small" icon={<BarChartOutlined />} onClick={() => openDrawer(record)} />
                      </Tooltip>
                    </Space>
                  );
                } },
            ]} />
          </AdminTablePanel>
        </div>
      </div>

      <ActivityFormModal
        open={modalOpen}
        editingId={editingId}
        editingRecord={editingRecord}
        activeAgents={activeAgents}
        loadingAgents={loadingAgents}
        onRefreshAgents={fetchActiveAgents}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchList}
      />

      <Drawer title={drawerActivity?.title || "活动详情"} open={drawerOpen} onClose={closeDrawer} width={500}>
        {drawerActivity && (
          <div>
            <Space wrap className="mb-4">
              <Tag color={drawerActivity.activity_type === "vote" ? "blue" : "green"}>
                {drawerActivity.activity_type === "vote" ? "投票" : "填空"}
              </Tag>
              <Badge
                status={drawerActivity.status === "active" ? "processing" : drawerActivity.status === "ended" ? "success" : "default"}
                text={drawerActivity.status === "active" ? "进行中" : drawerActivity.status === "ended" ? "已结束" : "草稿"}
              />
              {drawerActivity.status === "active" && drawerActivity.remaining_seconds != null && (
                <Tag color="orange">剩余 {drawerActivity.remaining_seconds}s</Tag>
              )}
            </Space>
            {drawerActivity.correct_answer && (
              <div className="mb-3 px-2.5 py-1.5 bg-green-50 rounded-md text-sm">
                <span className="text-green-500 font-medium">参考答案：</span>{formatCorrectAnswer(drawerActivity.correct_answer)}
              </div>
            )}
            {drawerStats && (
              <div>
                <Divider className="!my-3" />
                <div className="text-sm font-semibold mb-2.5">答题统计（{drawerStats.total_responses} 人参与）</div>
                {drawerActivity.activity_type === "vote" && Array.isArray(drawerActivity.options) && drawerActivity.options.map((opt) => {
                  const count = drawerStats.option_counts?.[opt.key] || 0;
                  const pct = drawerStats.total_responses > 0 ? Math.round(count / drawerStats.total_responses * 100) : 0;
                  const isCorrect = drawerActivity.correct_answer?.includes(opt.key);
                  return (
                    <div key={opt.key} className="mb-2.5">
                      <div className="flex justify-between text-sm mb-0.5">
                        <span style={{ color: isCorrect ? "#52c41a" : "#333", fontWeight: isCorrect ? 600 : undefined }}>{opt.key}. {opt.text}</span>
                        <span className="text-gray-400">{count} 票 ({pct}%)</span>
                      </div>
                      <Progress percent={pct} showInfo={false} strokeColor={isCorrect ? "#52c41a" : "#4096ff"} size="small" />
                    </div>
                  );
                })}
                {drawerActivity.activity_type === "fill_blank" && (
                  <div>
                    {drawerStats.correct_rate != null ? (
                      <div className="text-center p-5">
                        <Progress type="circle" percent={drawerStats.correct_rate} size={100} format={(p) => `${p}%`} />
                        <div className="mt-2 text-gray-400">整体正确率</div>
                      </div>
                    ) : <div className="text-gray-400 text-xs">暂无作答数据</div>}
                    {Array.isArray(drawerStats.blank_slot_stats) && drawerStats.blank_slot_stats.map((slot) => (
                      <div key={slot.slot_index} className="p-2 border border-gray-100 rounded-lg mb-2">
                        <div className="text-sm mb-1">
                          <Tag color="purple">空位 {slot.slot_index}</Tag>标准答案：{slot.correct_answer}
                        </div>
                        <Progress percent={slot.correct_rate ?? 0} size="small" format={(p) => `${p}% 正确`}
                          strokeColor={slot.correct_rate != null && slot.correct_rate >= 60 ? "#52c41a" : "#ff4d4f"} />
                        {slot.top_wrong_answers?.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            高频错答：{slot.top_wrong_answers.slice(0, 3).map((x) => `${x.answer}(${x.count})`).join("、")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Divider className="!mt-4 !mb-3" />
                <div className="flex items-center gap-2 mb-2">
                  <RobotOutlined className="text-purple" />
                  <span className="text-sm font-semibold">AI 分析</span>
                  <Tag color={analysisStatus.color} className="text-xs">{analysisStatus.text}</Tag>
                  {drawerActivity.analysis_updated_at && (
                    <span className="text-gray-300 text-xs">{new Date(drawerActivity.analysis_updated_at).toLocaleString()}</span>
                  )}
                </div>
                {drawerActivity.analysis_status === "success" && drawerActivity.analysis_result && (
                  <div className="border border-gray-100 rounded-lg px-3.5 py-2.5 bg-surface-2">
                    <SimpleMarkdown text={drawerActivity.analysis_result} />
                    {riskSlots.length > 0 && <div className="mt-2 text-xs" style={{ color: "#d46b08" }}>薄弱空位：{riskSlots.map((s: any) => `空位${s.slot_index}(${s.correct_rate ?? 0}%)`).join("、")}</div>}
                    {commonMistakes.length > 0 && <div className="text-xs text-gray-600 mt-1">高频错答：{commonMistakes.slice(0, 5).map((x: any) => `${x.answer}(${x.count})`).join("、")}</div>}
                  </div>
                )}
                {drawerActivity.analysis_status === "failed" && (
                  <Alert type="error" showIcon message="自动分析失败" description={`失败原因：${drawerActivity.analysis_error || "未知错误"}`} />
                )}
                {drawerActivity.analysis_status === "skipped" && (
                  <Alert type="warning" showIcon message="自动分析已跳过" description="作答数据不足，已跳过分析" />
                )}
                {(!drawerActivity.analysis_status || drawerActivity.analysis_status === "pending") && (
                  <div className="text-gray-300 text-xs">活动结束后将自动触发分析（需在活动中配置分析智能体）</div>
                )}
              </div>
            )}
            {drawerActivity.status === "active" && (
              <Popconfirm title="确认结束活动？" onConfirm={() => handleEnd(drawerActivity.id)}>
                <Button danger block className="mt-5" icon={<StopOutlined />}>结束活动</Button>
              </Popconfirm>
            )}
          </div>
        )}
      </Drawer>

    </AdminPage>
  );
};

export default AdminClassroomInteractionPage;
