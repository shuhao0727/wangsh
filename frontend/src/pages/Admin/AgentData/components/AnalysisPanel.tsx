import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, DatePicker, Form, Input, Pagination, Row, Select, Space, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import aiAgentsApi from "@services/znt/api/ai-agents-api";
import { agentDataApi } from "@services/znt/api";
import type { AIAgent } from "@services/znt/types";

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
  messages: Array<{
    id: number;
    message_type: string;
    content: string;
    created_at: string;
  }>;
};

let cachedAgents: AIAgent[] | null = null;
let cachedAgentsPromise: Promise<AIAgent[]> | null = null;

const useActiveAgentOptions = () => {
  const [agents, setAgents] = useState<AIAgent[]>(cachedAgents || []);
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    if (cachedAgents) return;
    if (cachedAgentsPromise) {
      setLoadingAgents(true);
      cachedAgentsPromise
        .then((list) => setAgents(list))
        .catch(() => message.error("加载智能体列表失败"))
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
          return list;
        })
        .catch((e) => {
          cachedAgentsPromise = null;
          throw e;
        });
      try {
        const list = await cachedAgentsPromise;
        setAgents(list);
      } catch {
        message.error("加载智能体列表失败");
      } finally {
        setLoadingAgents(false);
      }
    };

    load();
  }, []);

  const agentOptions = useMemo(
    () =>
      agents.map((a) => ({
        label: a.agent_name || a.name || `智能体${a.id}`,
        value: a.id,
      })),
    [agents],
  );

  return { agentOptions, loadingAgents };
};

export const HotQuestionsPanel: React.FC = () => {
  const { agentOptions, loadingAgents } = useActiveAgentOptions();
  const [loadingHot, setLoadingHot] = useState(false);
  const [exportingHot, setExportingHot] = useState(false);
  const [hotData, setHotData] = useState<HotBucket[]>([]);
  const [hotPage, setHotPage] = useState(1);
  const [hotPageSize, setHotPageSize] = useState(10);

  const [hotForm] = Form.useForm();

  useEffect(() => {
    const now = dayjs();
    const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [now.subtract(1, "hour"), now];
    if (!hotForm.getFieldValue("range")) {
      hotForm.setFieldsValue({
        agent_id: agentOptions[0]?.value,
        bucket_seconds: 60,
        top_n: 10,
        range: defaultRange,
      });
    }
  }, [agentOptions, hotForm]);

  const loadHot = async () => {
    const values = await hotForm.validateFields();
    const [start, end] = values.range as [dayjs.Dayjs, dayjs.Dayjs];
    setLoadingHot(true);
    try {
      const res = await agentDataApi.analyzeHotQuestions({
        agent_id: values.agent_id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        bucket_seconds: values.bucket_seconds,
        top_n: values.top_n,
      });
      if (!res.success) {
        message.error(res.message || "获取热点问题失败");
        setHotData([]);
        return;
      }
      setHotData(res.data);
      setHotPage(1);
    } finally {
      setLoadingHot(false);
    }
  };

  const exportHot = async () => {
    const values = await hotForm.validateFields();
    const [start, end] = values.range as [dayjs.Dayjs, dayjs.Dayjs];
    setExportingHot(true);
    try {
      const res = await agentDataApi.exportHotQuestions({
        agent_id: values.agent_id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        bucket_seconds: values.bucket_seconds,
        top_n: values.top_n,
      });
      if (!res.success) {
        message.error(res.message || "导出失败");
        return;
      }
      const ts = dayjs().format("YYYYMMDD_HHmmss");
      downloadBlobFile(res.data, `hot_questions_${values.agent_id}_${ts}.xlsx`);
      message.success("已开始下载");
    } finally {
      setExportingHot(false);
    }
  };

  const hotColumns = [
    {
      title: "时间段",
      dataIndex: "bucket_start",
      key: "bucket_start",
      width: 200,
      render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: "提问数",
      dataIndex: "question_count",
      key: "question_count",
      width: 100,
    },
    {
      title: "活跃学生",
      dataIndex: "unique_students",
      key: "unique_students",
      width: 120,
    },
    {
      title: "Top问题",
      dataIndex: "top_questions",
      key: "top_questions",
      render: (items: HotBucket["top_questions"]) => (
        <div>
          {(items || []).slice(0, 3).map((x, idx) => (
            <div key={idx}>
              <Text>
                {idx + 1}. {x.question}
              </Text>
              <Text type="secondary">（{x.count}）</Text>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const hotPagedData = useMemo(() => {
    const start = (hotPage - 1) * hotPageSize;
    return hotData.slice(start, start + hotPageSize);
  }, [hotData, hotPage, hotPageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(hotData.length / hotPageSize));
    if (hotPage > maxPage) setHotPage(maxPage);
  }, [hotData.length, hotPage, hotPageSize]);

  return (
    <div>
      <Form form={hotForm} layout="vertical" onFinish={loadHot}>
        <Row gutter={16} align="bottom">
          <Col span={6}>
            <Form.Item name="agent_id" label="智能体" rules={[{ required: true, message: "请选择智能体" }]}>
              <Select
                options={agentOptions}
                loading={loadingAgents}
                placeholder="选择智能体"
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="range" label="时间范围" rules={[{ required: true, message: "请选择时间范围" }]}>
              <RangePicker showTime style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="bucket_seconds" label="时间桶" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: "1分钟", value: 60 },
                  { label: "3分钟", value: 180 },
                  { label: "5分钟", value: 300 },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item name="top_n" label="TopN" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: "5", value: 5 },
                  { label: "10", value: 10 },
                  { label: "20", value: 20 },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row justify="end">
          <Space>
            <Button type="primary" onClick={() => hotForm.submit()} loading={loadingHot}>
              查询
            </Button>
            <Button onClick={exportHot} loading={exportingHot} disabled={loadingHot}>
              导出
            </Button>
          </Space>
        </Row>
      </Form>

      <Table
        rowKey="bucket_start"
        columns={hotColumns as any}
        dataSource={hotPagedData}
        loading={loadingHot}
        pagination={false}
        size="middle"
      />

      {hotData.length > 0 ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <Pagination
            current={hotPage}
            pageSize={hotPageSize}
            total={hotData.length}
            showSizeChanger
            showQuickJumper
            onChange={(page, size) => {
              if (size !== hotPageSize) {
                setHotPageSize(size);
                setHotPage(1);
                return;
              }
              setHotPage(page);
            }}
            showTotal={(total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`}
          />
        </div>
      ) : null}
    </div>
  );
};

export const StudentQuestionChainsPanel: React.FC = () => {
  const { agentOptions, loadingAgents } = useActiveAgentOptions();
  const [loadingChains, setLoadingChains] = useState(false);
  const [exportingChains, setExportingChains] = useState(false);
  const [chains, setChains] = useState<StudentSession[]>([]);
  const [chainsPage, setChainsPage] = useState(1);
  const [chainsPageSize, setChainsPageSize] = useState(10);

  const [chainForm] = Form.useForm();

  useEffect(() => {
    const now = dayjs();
    const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [now.subtract(1, "hour"), now];
    if (!chainForm.getFieldValue("range")) {
      chainForm.setFieldsValue({
        agent_id: agentOptions[0]?.value,
        limit_sessions: 5,
        range: defaultRange,
      });
    }
  }, [agentOptions, chainForm]);

  const loadChains = async () => {
    const values = await chainForm.validateFields();
    const [start, end] = values.range as [dayjs.Dayjs, dayjs.Dayjs];
    setLoadingChains(true);
    try {
      const res = await agentDataApi.analyzeStudentChains({
        agent_id: values.agent_id,
        student_id: values.student_id || undefined,
        user_id: values.user_id ? Number(values.user_id) : undefined,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        limit_sessions: values.limit_sessions,
      });
      if (!res.success) {
        message.error(res.message || "获取学生提问链条失败");
        setChains([]);
        setChainsPage(1);
        return;
      }
      setChains(res.data);
      setChainsPage(1);
    } finally {
      setLoadingChains(false);
    }
  };

  const exportChains = async () => {
    const values = await chainForm.validateFields();
    const [start, end] = values.range as [dayjs.Dayjs, dayjs.Dayjs];
    setExportingChains(true);
    try {
      const res = await agentDataApi.exportStudentChains({
        agent_id: values.agent_id,
        student_id: values.student_id || undefined,
        user_id: values.user_id ? Number(values.user_id) : undefined,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        limit_sessions: values.limit_sessions,
      });
      if (!res.success) {
        message.error(res.message || "导出失败");
        return;
      }
      const ts = dayjs().format("YYYYMMDD_HHmmss");
      downloadBlobFile(res.data, `student_chains_${values.agent_id}_${ts}.xlsx`);
      message.success("已开始下载");
    } finally {
      setExportingChains(false);
    }
  };

  const chainsPagedData = useMemo(() => {
    const start = (chainsPage - 1) * chainsPageSize;
    return chains.slice(start, start + chainsPageSize);
  }, [chains, chainsPage, chainsPageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(chains.length / chainsPageSize));
    if (chainsPage > maxPage) setChainsPage(maxPage);
  }, [chains.length, chainsPage, chainsPageSize]);

  return (
    <div>
      <Form form={chainForm} layout="vertical" onFinish={loadChains}>
        <Row gutter={16} align="bottom">
          <Col span={6}>
            <Form.Item name="agent_id" label="智能体" rules={[{ required: true, message: "请选择智能体" }]}>
              <Select
                options={agentOptions}
                loading={loadingAgents}
                placeholder="选择智能体"
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="range" label="时间范围" rules={[{ required: true, message: "请选择时间范围" }]}>
              <RangePicker showTime style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="student_id" label="学号">
              <Input placeholder="例如 20250001" allowClear />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item name="user_id" label="用户ID">
              <Input placeholder="可选" allowClear />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item name="limit_sessions" label="会话数" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: "3", value: 3 },
                  { label: "5", value: 5 },
                  { label: "10", value: 10 },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row justify="end">
          <Space>
            <Button type="primary" onClick={() => chainForm.submit()} loading={loadingChains}>
              查询
            </Button>
            <Button onClick={exportChains} loading={exportingChains} disabled={loadingChains}>
              导出
            </Button>
          </Space>
        </Row>
      </Form>

      <Table
        rowKey="session_id"
        loading={loadingChains}
        dataSource={chainsPagedData}
        pagination={false}
        columns={[
          {
            title: "会话ID",
            dataIndex: "session_id",
            key: "session_id",
            width: 260,
          },
          {
            title: "最后时间",
            dataIndex: "last_at",
            key: "last_at",
            width: 200,
            render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss"),
          },
          {
            title: "轮数",
            dataIndex: "turns",
            key: "turns",
            width: 80,
          },
          {
            title: "内容",
            key: "content",
            render: (_: unknown, record: StudentSession) => {
              const preview = record.messages.filter((m) => m.message_type === "question").slice(0, 1)[0]?.content;
              return <Text>{preview || "（空）"}</Text>;
            },
          },
        ]}
        expandable={{
          expandedRowRender: (record: StudentSession) => (
            <div>
              {record.messages.map((m) => (
                <div key={m.id} style={{ padding: "4px 0" }}>
                  <Text strong>{m.message_type === "question" ? "Q" : "A"}</Text>
                  <Text type="secondary"> {dayjs(m.created_at).format("HH:mm:ss")} </Text>
                  <Text>{m.content}</Text>
                </div>
              ))}
            </div>
          ),
        }}
        size="middle"
      />

      {chains.length > 0 ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <Pagination
            current={chainsPage}
            pageSize={chainsPageSize}
            total={chains.length}
            showSizeChanger
            showQuickJumper
            onChange={(page, size) => {
              if (size !== chainsPageSize) {
                setChainsPageSize(size);
                setChainsPage(1);
                return;
              }
              setChainsPage(page);
            }}
            showTotal={(total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`}
          />
        </div>
      ) : null}
    </div>
  );
};
