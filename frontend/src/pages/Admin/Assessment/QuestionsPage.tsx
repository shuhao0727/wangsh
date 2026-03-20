/**
 * 测评管理页 - /admin/assessment/:id/questions
 * 三个板块：基本设置 → 固定题 → 自适应知识点题
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Button, Table, Tag, Pagination, Select, Popconfirm, Modal, Form, Input,
  InputNumber, message, Space, Spin, Divider, Card, Tooltip, Radio, DatePicker, Progress,
} from "antd";
import {
  ArrowLeftOutlined, PlusOutlined, RobotOutlined, EditOutlined,
  DeleteOutlined, EyeOutlined, SaveOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { AdminPage } from "@components/Admin";
import {
  assessmentQuestionApi, assessmentConfigApi,
  type AssessmentQuestion,
} from "@services/assessment";
import { aiAgentsApi } from "@services/agents";
import type { AIAgent } from "@services/znt/types";
import { logger } from "@services/logger";
import dayjs from "dayjs";

const { TextArea } = Input;
const TYPE_MAP: Record<string, { label: string; color: string }> = {
  choice: { label: "选择题", color: "blue" },
  fill: { label: "填空题", color: "green" },
  short_answer: { label: "简答题", color: "orange" },
};
const DIFF_MAP: Record<string, { label: string; color: string }> = {
  easy: { label: "简单", color: "green" },
  medium: { label: "中等", color: "orange" },
  hard: { label: "困难", color: "red" },
};
const GRADE_OPTIONS = ["高一","高二","高三","初一","初二","初三","七年级","八年级","九年级"];

interface AdaptiveKP {
  key: string; knowledge_point: string; question_type: "choice" | "fill";
  score: number; prompt_hint: string; mastery_streak: number; max_attempts: number;
}
// COMPONENT_START
const QuestionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const configId = Number(id);

  // 基本设置
  const [configForm] = Form.useForm();
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);

  // 固定题
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AssessmentQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterDiff, setFilterDiff] = useState<string | undefined>();
  const [qForm] = Form.useForm();
  const [qModalOpen, setQModalOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<AssessmentQuestion | null>(null);
  const [qSaving, setQSaving] = useState(false);
  const [previewQ, setPreviewQ] = useState<AssessmentQuestion | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genForm] = Form.useForm();
  const qType = Form.useWatch("question_type", qForm);

  // 自适应
  const [adaptiveKPs, setAdaptiveKPs] = useState<AdaptiveKP[]>([]);
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);

  /* ── 数据加载 ── */
  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await assessmentQuestionApi.list(configId, {
        skip: (page - 1) * pageSize, limit: pageSize, question_type: filterType, difficulty: filterDiff,
      });
      const fixed: AssessmentQuestion[] = [], adaptive: AdaptiveKP[] = [];
      for (const q of resp.items) {
        if (q.mode === "adaptive") {
          let ac = { mastery_streak: 2, max_attempts: 5, prompt_hint: "" };
          if (q.adaptive_config) { try { ac = { ...ac, ...JSON.parse(q.adaptive_config) }; } catch {} }
          adaptive.push({ key: String(q.id), knowledge_point: q.knowledge_point || "",
            question_type: q.question_type as "choice"|"fill", score: q.score,
            prompt_hint: ac.prompt_hint, mastery_streak: ac.mastery_streak, max_attempts: ac.max_attempts });
        } else { fixed.push(q); }
      }
      setItems(fixed); setAdaptiveKPs(adaptive); setTotal(resp.total);
    } catch (e: any) { message.error(e.message || "加载失败"); } finally { setLoading(false); }
  }, [configId, page, pageSize, filterType, filterDiff]);

  const loadConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const c = await assessmentConfigApi.get(configId);
      configForm.setFieldsValue({
        title: c.title, grade: c.grade,
        total_score: c.total_score,
        available_range: c.available_start && c.available_end ? [dayjs(c.available_start), dayjs(c.available_end)] : undefined,
        agent_id: c.agent_id,
        agent_ids: c.config_agents?.map((a: any) => a.id) || [],
        teaching_objectives: c.teaching_objectives, ai_prompt: c.ai_prompt,
        knowledge_points: c.knowledge_points ? (() => { try { return JSON.parse(c.knowledge_points).join("、"); } catch { return ""; } })() : "",
      });
    } catch (e: any) { message.error(e.message || "加载配置失败"); } finally { setConfigLoading(false); }
  }, [configId, configForm]);

  const loadAgents = useCallback(async () => {
    try { const r = await aiAgentsApi.getAgents({ limit: 100 }); if (r.success) setAgents(r.data.items); }
    catch (e) { logger.error("加载智能体失败:", e); }
  }, []);

  useEffect(() => { loadQuestions(); loadConfig(); loadAgents(); }, [loadQuestions, loadConfig, loadAgents]);

  /* ── 保存配置 ── */
  const handleSaveConfig = async () => {
    try {
      const v = await configForm.validateFields(); setConfigSaving(true);
      const kpStr = (v.knowledge_points || "").trim();
      const kps = kpStr ? kpStr.split(/[,，、\s]+/).filter(Boolean) : [];
      await assessmentConfigApi.update(configId, {
        title: v.title, grade: v.grade,
        total_score: v.total_score,
        available_start: v.available_range?.[0]?.toISOString() || undefined,
        available_end: v.available_range?.[1]?.toISOString() || undefined,
        agent_id: v.agent_id, agent_ids: v.agent_ids,
        teaching_objectives: v.teaching_objectives, ai_prompt: v.ai_prompt,
        knowledge_points: JSON.stringify(kps), question_config: JSON.stringify({}),
      });
      message.success("已保存");
    } catch (e: any) { if (e?.errorFields) return; message.error(e.message || "保存失败"); }
    finally { setConfigSaving(false); }
  };

  /* ── 固定题 CRUD ── */
  const openAddQ = () => { setEditingQ(null); qForm.resetFields(); qForm.setFieldsValue({ question_type: "choice", score: 10, difficulty: "medium" }); setQModalOpen(true); };
  const openEditQ = (q: AssessmentQuestion) => {
    setEditingQ(q); let opts: Record<string, string> = {};
    if (q.options) { try { opts = JSON.parse(q.options); } catch {} }
    qForm.setFieldsValue({ question_type: q.question_type, content: q.content,
      options_A: opts.A || "", options_B: opts.B || "", options_C: opts.C || "", options_D: opts.D || "",
      correct_answer: q.correct_answer, score: q.score, difficulty: q.difficulty,
      knowledge_point: q.knowledge_point || "", explanation: q.explanation || "" });
    setQModalOpen(true);
  };
  const handleSaveQ = async () => {
    try {
      const v = await qForm.validateFields(); setQSaving(true);
      const options = v.question_type === "choice" ? JSON.stringify({ A: v.options_A, B: v.options_B, C: v.options_C, D: v.options_D }) : undefined;
      if (editingQ) {
        await assessmentQuestionApi.update(editingQ.id, { question_type: v.question_type, content: v.content, options,
          correct_answer: v.correct_answer, score: v.score, difficulty: v.difficulty,
          knowledge_point: v.knowledge_point, explanation: v.explanation, mode: "fixed" });
        message.success("已更新");
      } else {
        await assessmentQuestionApi.create({ config_id: configId, question_type: v.question_type, content: v.content, options,
          correct_answer: v.correct_answer, score: v.score, difficulty: v.difficulty,
          knowledge_point: v.knowledge_point, explanation: v.explanation, source: "manual", mode: "fixed" });
        message.success("已添加");
      }
      setQModalOpen(false); await loadQuestions();
    } catch (e: any) { if (e?.errorFields) return; message.error(e.message || "保存失败"); } finally { setQSaving(false); }
  };
  const handleDeleteQ = async (qid: number) => {
    try { await assessmentQuestionApi.delete(qid); message.success("已删除"); await loadQuestions(); }
    catch (e: any) { message.error(e.message || "删除失败"); }
  };
  const handleGenerate = async () => {
    try {
      const v = await genForm.validateFields();
      setGenerating(true); setGenModalOpen(false); setGenProgress(0);
      // 模拟进度
      const timer = setInterval(() => {
        setGenProgress(prev => prev >= 90 ? 90 : prev + Math.random() * 15);
      }, 800);
      const kps: string[] = v.knowledge_points?.length > 0 ? v.knowledge_points : undefined;
      const r = await assessmentQuestionApi.generate(configId, {
        count: v.count,
        question_type: v.question_type || undefined,
        difficulty: v.difficulty || undefined,
        knowledge_points: kps,
      });
      clearInterval(timer); setGenProgress(100);
      message.success(r.message || `生成了 ${r.count} 道题`);
      setTimeout(() => { setGenerating(false); setGenProgress(0); }, 600);
      await loadQuestions();
    } catch (e: any) { if (e?.errorFields) return; setGenerating(false); setGenProgress(0); message.error(e.message || "AI 生成失败"); }
  };

  /* ── 自适应题 CRUD ── */
  const handleAddAdaptive = () => { setAdaptiveKPs([...adaptiveKPs, { key: `new_${Date.now()}`, knowledge_point: "", question_type: "choice", score: 10, prompt_hint: "", mastery_streak: 2, max_attempts: 5 }]); };
  const updateAdaptive = (key: string, field: string, value: any) => { setAdaptiveKPs(adaptiveKPs.map(k => k.key === key ? { ...k, [field]: value } : k)); };
  const removeAdaptive = async (kp: AdaptiveKP) => {
    if (!kp.key.startsWith("new_")) { try { await assessmentQuestionApi.delete(Number(kp.key)); } catch {} }
    setAdaptiveKPs(adaptiveKPs.filter(k => k.key !== kp.key));
  };
  const saveAllAdaptive = async () => {
    try { setAdaptiveLoading(true);
      for (const kp of adaptiveKPs) {
        if (!kp.knowledge_point.trim()) { message.warning("知识点名称不能为空"); return; }
        const ac = JSON.stringify({ mastery_streak: kp.mastery_streak, max_attempts: kp.max_attempts, prompt_hint: kp.prompt_hint });
        if (kp.key.startsWith("new_")) {
          await assessmentQuestionApi.create({ config_id: configId, question_type: kp.question_type,
            content: `[自适应] ${kp.knowledge_point}`, correct_answer: "AI_GENERATED",
            score: kp.score, knowledge_point: kp.knowledge_point, source: "manual", mode: "adaptive", adaptive_config: ac });
        } else {
          await assessmentQuestionApi.update(Number(kp.key), { question_type: kp.question_type, score: kp.score,
            knowledge_point: kp.knowledge_point, mode: "adaptive", adaptive_config: ac });
        }
      }
      message.success("已保存"); await loadQuestions();
    } catch (e: any) { message.error(e.message || "保存失败"); } finally { setAdaptiveLoading(false); }
  };

  const columns = [
    { title: "#", width: 50, render: (_: any, __: any, i: number) => (page - 1) * pageSize + i + 1 },
    { title: "题型", dataIndex: "question_type", width: 80, render: (v: string) => { const t = TYPE_MAP[v]; return t ? <Tag color={t.color}>{t.label}</Tag> : v; } },
    { title: "内容", dataIndex: "content", ellipsis: true },
    { title: "分值", dataIndex: "score", width: 60 },
    { title: "难度", dataIndex: "difficulty", width: 80, render: (v: string) => { const d = DIFF_MAP[v]; return d ? <Tag color={d.color}>{d.label}</Tag> : v; } },
    { title: "知识点", dataIndex: "knowledge_point", width: 120, render: (v: string | null) => v || "-" },
    { title: "操作", width: 130, render: (_: any, r: AssessmentQuestion) => (
      <Space size="small">
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreviewQ(r)} />
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditQ(r)} />
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteQ(r.id)}><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>) },
  ];

  if (configLoading) return <AdminPage><div style={{ display: "flex", justifyContent: "center", padding: 100 }}><Spin size="large" /></div></AdminPage>;
  // RENDER_START
  const sectionTitle = (text: string) => (
    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ws-color-text)", marginBottom: 16 }}>{text}</div>
  );
  const fieldLabel = (text: string) => <span style={{ fontWeight: 500, fontSize: 13 }}>{text}</span>;

  return (
    <AdminPage scrollable>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/assessment")}
          style={{ fontSize: 14, color: "var(--ws-color-text-secondary)" }}>返回列表</Button>
      </div>

      {/* ═══ 1. 基本设置 ═══ */}
      <Card variant="borderless" size="small"
        style={{ marginBottom: 20, borderRadius: "var(--ws-radius-md)", background: "var(--ws-color-surface)", padding: "16px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          {sectionTitle("基本设置")}
          <Button type="primary" icon={<SaveOutlined />} loading={configSaving} onClick={handleSaveConfig} size="small">保存设置</Button>
        </div>
        <Form form={configForm} layout="vertical">
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
            <Form.Item name="title" label={fieldLabel("测评标题")} rules={[{ required: true, message: "请输入标题" }]} style={{ marginBottom: 12 }}>
              <Input placeholder="如：Python循环结构课堂检测" maxLength={200} />
            </Form.Item>
            <Form.Item name="grade" label={fieldLabel("年级")} style={{ marginBottom: 12 }}>
              <Select placeholder="选择年级" allowClear>{GRADE_OPTIONS.map(g => <Select.Option key={g} value={g}>{g}</Select.Option>)}</Select>
            </Form.Item>
            <Form.Item name="agent_id" label={fieldLabel("智能体")} rules={[{ required: true, message: "请选择" }]}
              tooltip="用于 AI 出题和评分" style={{ marginBottom: 12 }}>
              <Select placeholder="选择智能体" allowClear showSearch optionFilterProp="label">
                {agents.map(a => <Select.Option key={a.id} value={a.id} label={a.name}>{a.name}</Select.Option>)}
              </Select>
            </Form.Item>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item name="available_range" label={fieldLabel("开放时段")} style={{ marginBottom: 12 }}
              tooltip="学生在此时间段内可以看到并参加测评，留空表示始终开放">
              <DatePicker.RangePicker showTime={{ format: "HH:mm" }} format="YYYY-MM-DD HH:mm"
                placeholder={["开始时间", "结束时间"]} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="knowledge_points" label={fieldLabel("知识点")} tooltip="用逗号或顿号分隔" style={{ marginBottom: 12 }}>
              <Input placeholder="如：for循环、while循环、递归" />
            </Form.Item>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item name="teaching_objectives" label={fieldLabel("教学目标")} style={{ marginBottom: 0 }}>
              <TextArea rows={2} placeholder="可选，AI 出题时会参考" />
            </Form.Item>
            <Form.Item name="ai_prompt" label={fieldLabel("出题提示")} tooltip="追加给 AI 的自定义要求" style={{ marginBottom: 0 }}>
              <TextArea rows={2} placeholder="可选，如：侧重实际应用场景" />
            </Form.Item>
          </div>
        </Form>
      </Card>

      {/* ═══ 2. 固定题 ═══ */}
      <Card variant="borderless" size="small"
        style={{ marginBottom: 20, borderRadius: "var(--ws-radius-md)", background: "var(--ws-color-surface)", padding: "16px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {sectionTitle("固定题")}
            <Tag color="blue" style={{ marginBottom: 20 }}>{items.length}</Tag>
          </div>
          <Space>
            <Select placeholder="题型" allowClear style={{ width: 110 }} value={filterType} onChange={v => { setFilterType(v); setPage(1); }}>
              {Object.entries(TYPE_MAP).map(([k, v]) => <Select.Option key={k} value={k}>{v.label}</Select.Option>)}
            </Select>
            <Select placeholder="难度" allowClear style={{ width: 110 }} value={filterDiff} onChange={v => { setFilterDiff(v); setPage(1); }}>
              {Object.entries(DIFF_MAP).map(([k, v]) => <Select.Option key={k} value={k}>{v.label}</Select.Option>)}
            </Select>
            <Button icon={<PlusOutlined />} onClick={openAddQ}>添加</Button>
            <Button type="primary" icon={<RobotOutlined />} loading={generating}
              onClick={() => { genForm.resetFields(); genForm.setFieldsValue({ count: 5, question_type: "", difficulty: "", knowledge_points: [] }); setGenModalOpen(true); }}>AI 生成</Button>
          </Space>
        </div>
        {generating && (
          <div style={{ marginBottom: 16, padding: "12px 16px", background: "var(--ws-color-surface-2)", borderRadius: "var(--ws-radius-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "var(--ws-color-text-secondary)" }}>
              <span><RobotOutlined style={{ marginRight: 6 }} />AI 正在生成题目...</span>
              <span>{Math.round(genProgress)}%</span>
            </div>
            <Progress percent={Math.round(genProgress)} showInfo={false} strokeColor={{ from: "#4F46E5", to: "#7C3AED" }} size="small" />
          </div>
        )}
        <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false}
          scroll={{ x: 800 }} size="middle" locale={{ emptyText: "暂无固定题，可手动添加或 AI 生成" }} />
        {total > pageSize && <div style={{ marginTop: 16, textAlign: "right" }}>
          <Pagination current={page} pageSize={pageSize} total={total} onChange={(p, s) => { setPage(p); if (s) setPageSize(s); }} showSizeChanger showTotal={t => `共 ${t} 条`} />
        </div>}
      </Card>

      {/* ═══ 3. 自适应知识点题 ═══ */}
      <Card variant="borderless" size="small"
        style={{ borderRadius: "var(--ws-radius-md)", background: "var(--ws-color-surface)", padding: "16px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {sectionTitle("自适应知识点题")}
              <Tag color="green" style={{ marginBottom: 20 }}>{adaptiveKPs.length}</Tag>
            </div>
            <div style={{ color: "var(--ws-color-text-tertiary)", fontSize: 12, marginTop: -14 }}>答题时 AI 实时出题，答错追加，连续答对即掌握</div>
          </div>
          <Space>
            <Button icon={<PlusOutlined />} onClick={handleAddAdaptive}>添加</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={adaptiveLoading} onClick={saveAllAdaptive}>保存</Button>
          </Space>
        </div>
        {adaptiveKPs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddAdaptive}>添加知识点</Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* 表头 */}
            <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 2fr 100px 80px 80px 80px 40px", gap: 10, padding: "0 14px",
              fontSize: 12, color: "var(--ws-color-text-tertiary)", fontWeight: 500 }}>
              <span>#</span><span>知识点</span><span>考察内容</span><span>题型</span><span>分值</span>
              <Tooltip title="连续答对几题判定掌握"><span>掌握</span></Tooltip>
              <Tooltip title="最多尝试几次"><span>上限</span></Tooltip>
              <span />
            </div>
            {adaptiveKPs.map((kp, idx) => (
              <div key={kp.key} style={{ display: "grid", gridTemplateColumns: "32px 1fr 2fr 100px 80px 80px 80px 40px", gap: 10,
                alignItems: "center", background: "var(--ws-color-surface-2)", borderRadius: "var(--ws-radius-md)", padding: "10px 14px" }}>
                <span style={{ fontWeight: 500, fontSize: 13, color: "var(--ws-color-text-secondary)" }}>{idx + 1}</span>
                <Input value={kp.knowledge_point} onChange={e => updateAdaptive(kp.key, "knowledge_point", e.target.value)} placeholder="如：for循环" />
                <Input value={kp.prompt_hint} onChange={e => updateAdaptive(kp.key, "prompt_hint", e.target.value)} placeholder="给 AI 的出题提示" />
                <Select value={kp.question_type} onChange={v => updateAdaptive(kp.key, "question_type", v)}>
                  <Select.Option value="choice">选择题</Select.Option><Select.Option value="fill">填空题</Select.Option>
                </Select>
                <InputNumber value={kp.score} onChange={v => updateAdaptive(kp.key, "score", v || 10)} min={1} max={100} style={{ width: "100%" }} />
                <InputNumber value={kp.mastery_streak} onChange={v => updateAdaptive(kp.key, "mastery_streak", v || 2)} min={1} max={10} style={{ width: "100%" }} />
                <InputNumber value={kp.max_attempts} onChange={v => updateAdaptive(kp.key, "max_attempts", v || 5)} min={1} max={20} style={{ width: "100%" }} />
                <Popconfirm title="确认删除？" onConfirm={() => removeAdaptive(kp)}>
                  <Button type="text" danger icon={<DeleteOutlined />} style={{ padding: 4 }} />
                </Popconfirm>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 固定题编辑弹窗 */}
      <Modal title={editingQ ? "编辑题目" : "添加题目"} open={qModalOpen} onCancel={() => setQModalOpen(false)} onOk={handleSaveQ} confirmLoading={qSaving} width={640} destroyOnHidden>
        <Form form={qForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="question_type" label={fieldLabel("题型")} rules={[{ required: true }]}>
            <Radio.Group><Radio.Button value="choice">选择题</Radio.Button><Radio.Button value="fill">填空题</Radio.Button><Radio.Button value="short_answer">简答题</Radio.Button></Radio.Group>
          </Form.Item>
          <Form.Item name="content" label={fieldLabel("题目内容")} rules={[{ required: true, message: "请输入题目" }]}><TextArea rows={3} /></Form.Item>
          {qType === "choice" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Form.Item name="options_A" label={fieldLabel("选项 A")} rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="options_B" label={fieldLabel("选项 B")} rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="options_C" label={fieldLabel("选项 C")} rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="options_D" label={fieldLabel("选项 D")} rules={[{ required: true }]}><Input /></Form.Item>
            </div>
          )}
          <Form.Item name="correct_answer" label={fieldLabel("正确答案")} rules={[{ required: true }]}><Input placeholder={qType === "choice" ? "如：A" : "输入正确答案"} /></Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Form.Item name="score" label={fieldLabel("分值")}><InputNumber min={1} max={100} style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="difficulty" label={fieldLabel("难度")}><Select>
              <Select.Option value="easy">简单</Select.Option><Select.Option value="medium">中等</Select.Option><Select.Option value="hard">困难</Select.Option>
            </Select></Form.Item>
            <Form.Item name="knowledge_point" label={fieldLabel("知识点")}><Input placeholder="可选" /></Form.Item>
          </div>
          <Form.Item name="explanation" label={fieldLabel("解析")} style={{ marginBottom: 0 }}><TextArea rows={2} placeholder="可选" /></Form.Item>
        </Form>
      </Modal>

      {/* 题目预览弹窗 */}
      <Modal title="题目预览" open={!!previewQ} onCancel={() => setPreviewQ(null)} footer={null} width={560}>
        {previewQ && (<div style={{ padding: "4px 0" }}>
          <Space style={{ marginBottom: 16 }}>
            <Tag color={TYPE_MAP[previewQ.question_type]?.color}>{TYPE_MAP[previewQ.question_type]?.label}</Tag>
            <Tag color={DIFF_MAP[previewQ.difficulty]?.color}>{DIFF_MAP[previewQ.difficulty]?.label}</Tag>
            <Tag>{previewQ.score} 分</Tag>
            {previewQ.knowledge_point && <Tag>{previewQ.knowledge_point}</Tag>}
          </Space>
          <div style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 20, whiteSpace: "pre-wrap" }}>{previewQ.content}</div>
          {previewQ.options && (() => { try {
            const opts = JSON.parse(previewQ.options);
            if (Array.isArray(opts)) return <div style={{ marginBottom: 20 }}>{opts.map((o: string, i: number) => <div key={i} style={{ padding: "6px 0", fontSize: 14 }}>{o}</div>)}</div>;
            if (opts && typeof opts === "object") return <div style={{ marginBottom: 20 }}>{Object.entries(opts).map(([k, v]) => <div key={k} style={{ padding: "6px 0", fontSize: 14 }}>{k}. {v as string}</div>)}</div>;
          } catch {} return null; })()}
          <Divider style={{ margin: "16px 0" }} />
          <div style={{ color: "#10B981", fontWeight: 500, fontSize: 14 }}>正确答案：{previewQ.correct_answer}</div>
          {previewQ.explanation && <div style={{ marginTop: 10, color: "var(--ws-color-text-secondary)", fontSize: 14, lineHeight: 1.6 }}>解析：{previewQ.explanation}</div>}
        </div>)}
      </Modal>
      {/* AI 生成配置弹窗 */}
      <Modal title="AI 生成题目" open={genModalOpen} onCancel={() => setGenModalOpen(false)}
        onOk={handleGenerate} confirmLoading={generating} okText="开始生成" width={440} forceRender>
        <Form form={genForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="count" label={fieldLabel("生成数量")} rules={[{ required: true, message: "请输入数量" }]}>
            <InputNumber min={1} max={50} style={{ width: "100%" }} placeholder="如：5" />
          </Form.Item>
          <Form.Item name="question_type" label={fieldLabel("题型")}>
            <Select allowClear placeholder="不限（混合出题）">
              <Select.Option value="choice">选择题</Select.Option>
              <Select.Option value="fill">填空题</Select.Option>
              <Select.Option value="short_answer">简答题</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="difficulty" label={fieldLabel("难度")}>
            <Select allowClear placeholder="不限（自动分布）">
              <Select.Option value="easy">简单</Select.Option>
              <Select.Option value="medium">中等</Select.Option>
              <Select.Option value="hard">困难</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="knowledge_points" label={fieldLabel("知识点范围")}
            tooltip="可从已配置的知识点中选择，也可手动输入新的，留空表示不限定">
            <Select mode="tags" allowClear placeholder="不限定（可选择或手动输入）"
              tokenSeparators={[",", "，", "、"]}
              options={(() => {
                const kpStr: string = configForm.getFieldValue("knowledge_points") || "";
                return kpStr.split(/[,，、\s]+/).filter(Boolean).map(k => ({ label: k, value: k }));
              })()}
            />
          </Form.Item>
        </Form>
      </Modal>

    </AdminPage>
  );
};

export default QuestionsPage;
