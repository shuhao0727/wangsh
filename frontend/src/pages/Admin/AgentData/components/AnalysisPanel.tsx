/**
 * 分析面板 — 热点问题 + 学生提问链条
 * 统一使用 AdminTablePanel 布局，分页固定底部
 */

import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, DatePicker, Form, Input, InputNumber, Pagination, Row, Select, Space, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import aiAgentsApi from "@services/znt/api/ai-agents-api";
import { agentDataApi } from "@services/znt/api";
import type { AIAgent } from "@services/znt/types";
import { AdminTablePanel } from "@components/Admin";

const { RangePicker } = DatePicker;
const { Text } = Typography;

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
      cachedAgentsPromise.then((list) => setAgents(list)).finally(() => setLoadingAgents(false));
      return;
    }

    const load = async () => {
      setLoadingAgents(true);
      cachedAgentsPromise = aiAgentsApi.getActiveAgents()
        .then((res) => { const list = res.data || []; cachedAgents = list; cachedAgentsAt = Date.now(); return list; })
        .catch((e) => { cachedAgentsPromise = null; throw e; });
      try { setAgents(await cachedAgentsPromise); }
      catch { message.error("加载智能体列表失败"); }
      finally { setLoadingAgents(false); }
    };
    load();
  }, []);

  const agentOptions = useMemo(() => agents.map((a) => ({ label: a.agent_name || a.name || `智能体${a.id}`, value: a.id })), [agents]);
  return { agentOptions, loadingAgents };
};

/* ========== 热点问题面板 ========== */
export const HotQuestionsPanel: React.FC = () => {
  const { agentOptions, loadingAgents } = useActiveAgentOptions();
  const [loadingHot, setLoadingHot] = useState(false);
  const [exportingHot, setExportingHot] = useState(false);
  const [hotData, setHotData] = useState<HotBucket[]>([]);
  const [hotPage, setHotPage] = useState(1);
  const [hotPageSize, setHotPageSize] = useState(10);
  const [hotForm] = Form.useForm();

  useEffect(() => {
    if (!hotForm.getFieldValue("range")) {
      const now = dayjs();
      hotForm.setFieldsValue({ agent_id: agentOptions[0]?.value, bucket_seconds: 60, top_n: 10, range: [now.subtract(1, "hour"), now] });
    }
  }, [agentOptions, hotForm]);

  const loadHot = async () => {
    const values = await hotForm.validateFields();
    const [start, end] = values.range as [dayjs.Dayjs, dayjs.Dayjs];
    setLoadingHot(true);
    try {
      const res = await agentDataApi.analyzeHotQuestions({ agent_id: values.agent_id, start_at: start.toISOString(), end_at: end.toISOString(), bucket_seconds: values.bucket_seconds, top_n: values.top_n });
      if (!res.success) { message.error(res.message || "获取热点问题失败"); setHotData([]); return; }
      setHotData(res.data); setHotPage(1);
    } finally { setLoadingHot(false); }
  };

  const exportHot = async () => {
    const values = await hotForm.validateFields();
    const [start, end] = values.range as [dayjs.Dayjs, dayjs.Dayjs];
    setExportingHot(true);
    try {
      const res = await agentDataApi.exportHotQuestions({ agent_id: values.agent_id, start_at: start.toISOString(), end_at: end.toISOString(), bucket_seconds: values.bucket_seconds, top_n: values.top_n });
      if (!res.success) { message.error(res.message || "导出失败"); return; }
      downloadBlobFile(res.data, `hot_questions_${values.agent_id}_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`);
      message.success("已开始下载");
    } finally { setExportingHot(false); }
  };

  const hotColumns = [
    { title: "时间段", dataIndex: "bucket_start", key: "bucket_start", width: 200, render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss") },
    { title: "提问数", dataIndex: "question_count", key: "question_count", width: 100 },
    { title: "活跃学生", dataIndex: "unique_students", key: "unique_students", width: 120 },
    {
      title: "Top问题", dataIndex: "top_questions", key: "top_questions",
      render: (items: HotBucket["top_questions"]) => (
        <div>{(items || []).slice(0, 3).map((x, idx) => (
          <div key={idx}><Text>{idx + 1}. {x.question}</Text> <Text type="secondary">（{x.count}）</Text></div>
        ))}</div>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 查询表单 */}
      <div className="flex-none py-3">
        <Form form={hotForm} layout="vertical" onFinish={loadHot}>
          <Row gutter={12} align="bottom">
            <Col span={6}>
              <Form.Item name="agent_id" label="智能体" rules={[{ required: true, message: "请选择" }]} className="!mb-0">
                <Select options={agentOptions} loading={loadingAgents} placeholder="选择智能体" allowClear showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="range" label="时间范围" rules={[{ required: true, message: "请选择" }]} className="!mb-0">
                <RangePicker showTime style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={3}>
              <Form.Item name="bucket_seconds" label="时间桶(秒)" rules={[{ required: true }]} className="!mb-0">
                <InputNumber min={1} style={{ width: "100%" }} placeholder="60" />
              </Form.Item>
            </Col>
            <Col span={3}>
              <Form.Item name="top_n" label="TopN" rules={[{ required: true }]} className="!mb-0">
                <InputNumber min={1} style={{ width: "100%" }} placeholder="10" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label=" " className="!mb-0">
                <Space>
                  <Button type="primary" onClick={() => hotForm.submit()} loading={loadingHot}>查询</Button>
                  <Button onClick={exportHot} loading={exportingHot} disabled={loadingHot}>导出</Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>

      {/* 表格 + 分页 */}
      <div className="flex-1 min-h-0">
        <AdminTablePanel
          loading={loadingHot}
          isEmpty={hotData.length === 0}
          emptyDescription="暂无热点问题数据，请先查询"
          pagination={
            <Pagination current={hotPage} pageSize={hotPageSize} total={hotData.length} showSizeChanger showTotal={(t) => `共 ${t} 条`}
              onChange={(page, size) => { setHotPage(page); setHotPageSize(size); }} />
          }
        >
          <Table rowKey="bucket_start" columns={hotColumns as any} dataSource={hotData} loading={loadingHot} pagination={false} size="middle" />
        </AdminTablePanel>
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
  const [chainsPageSize, setChainsPageSize] = useState(10);
  const [chainForm] = Form.useForm();

  useEffect(() => {
    if (!chainForm.getFieldValue("range")) {
      const now = dayjs();
      chainForm.setFieldsValue({ agent_id: agentOptions[0]?.value, limit_sessions: 5, range: [now.subtract(1, "hour"), now] });
    }
  }, [agentOptions, chainForm]);

  const loadChains = async () => {
    const values = await chainForm.validateFields();
    const [start, end] = values.range as [dayjs.Dayjs, dayjs.Dayjs];
    setLoadingChains(true);
    try {
      const res = await agentDataApi.analyzeStudentChains({ agent_id: values.agent_id, class_name: values.class_name || undefined, student_id: values.student_id || undefined, start_at: start.toISOString(), end_at: end.toISOString(), limit_sessions: Number(values.limit_sessions) });
      if (!res.success) { message.error(res.message || "获取失败"); setChains([]); setChainsPage(1); return; }
      setChains(res.data); setChainsPage(1);
    } finally { setLoadingChains(false); }
  };

  const exportChains = async () => {
    const values = await chainForm.validateFields();
    const [start, end] = values.range as [dayjs.Dayjs, dayjs.Dayjs];
    setExportingChains(true);
    try {
      const res = await agentDataApi.exportStudentChains({ agent_id: values.agent_id, class_name: values.class_name || undefined, student_id: values.student_id || undefined, start_at: start.toISOString(), end_at: end.toISOString(), limit_sessions: Number(values.limit_sessions) });
      if (!res.success) { message.error(res.message || "导出失败"); return; }
      downloadBlobFile(res.data, `student_chains_${values.agent_id}_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`);
      message.success("已开始下载");
    } finally { setExportingChains(false); }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 查询表单 */}
      <div className="flex-none py-3">
        <Form form={chainForm} layout="vertical" onFinish={loadChains}>
          <Row gutter={12} align="bottom">
            <Col span={5}>
              <Form.Item name="agent_id" label="智能体" rules={[{ required: true, message: "请选择" }]} className="!mb-0">
                <Select options={agentOptions} loading={loadingAgents} placeholder="选择智能体" allowClear showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="range" label="时间范围" rules={[{ required: true, message: "请选择" }]} className="!mb-0">
                <RangePicker showTime style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={3}>
              <Form.Item name="class_name" label="班级" className="!mb-0">
                <Input placeholder="高一(1)班" allowClear />
              </Form.Item>
            </Col>
            <Col span={3}>
              <Form.Item name="student_id" label="学号" className="!mb-0">
                <Input placeholder="20250001" allowClear />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item name="limit_sessions" label="会话数" rules={[{ required: true }]} className="!mb-0">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label=" " className="!mb-0">
                <Space>
                  <Button type="primary" onClick={() => chainForm.submit()} loading={loadingChains}>查询</Button>
                  <Button onClick={exportChains} loading={exportingChains} disabled={loadingChains}>导出</Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>

      {/* 表格 + 分页 */}
      <div className="flex-1 min-h-0">
        <AdminTablePanel
          loading={loadingChains}
          isEmpty={chains.length === 0}
          emptyDescription="暂无学生提问链条数据，请先查询"
          pagination={
            <Pagination current={chainsPage} pageSize={chainsPageSize} total={chains.length} showSizeChanger showTotal={(t) => `共 ${t} 条`}
              onChange={(page, size) => { setChainsPage(page); setChainsPageSize(size); }} />
          }
        >
          <Table
            rowKey="session_id"
            loading={loadingChains}
            dataSource={chains}
            pagination={false}
            columns={[
              { title: "班级", dataIndex: "class_name", width: 140, render: (v: string | undefined) => v || "-" },
              { title: "学号", dataIndex: "student_id", width: 120, render: (v: string | undefined) => v || "-" },
              { title: "姓名", dataIndex: "user_name", width: 100, render: (v: string | undefined) => v || "-" },
              { title: "会话ID", dataIndex: "session_id", width: 240 },
              { title: "最后时间", dataIndex: "last_at", width: 180, render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss") },
              { title: "轮数", dataIndex: "turns", width: 70 },
              { title: "内容", key: "content", render: (_: unknown, record: StudentSession) => {
                const preview = record.messages.filter((m) => m.message_type === "question").slice(0, 1)[0]?.content;
                return <Text>{preview || "（空）"}</Text>;
              }},
            ]}
            expandable={{
              expandedRowRender: (record: StudentSession) => (
                <div>{record.messages.map((m) => (
                  <div key={m.id} className="py-1">
                    <Text strong>{m.message_type === "question" ? "Q" : "A"}</Text>
                    <Text type="secondary"> {dayjs(m.created_at).format("HH:mm:ss")} </Text>
                    <Text>{m.content}</Text>
                  </div>
                ))}</div>
              ),
            }}
            size="middle"
          />
        </AdminTablePanel>
      </div>
    </div>
  );
};
