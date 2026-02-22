import React, { useEffect, useState } from "react";
import { Button, Form, Input, message, Modal, Popconfirm, Select, Space, Table, Tag } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import type { PythonLabExperiment, PythonLabLevel, PythonLabScenario } from "./types";
import { loadPythonLabExperiments, savePythonLabExperiments } from "./storage";

type ExperimentItem = PythonLabExperiment & { updatedAt: string };

function levelColor(level: PythonLabLevel) {
  if (level === "入门") return "green";
  if (level === "基础") return "blue";
  return "purple";
}

const PythonLabManager: React.FC = () => {
  const [items, setItems] = useState<ExperimentItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExperimentItem | null>(null);
  const [form] = Form.useForm();
  const scenarioOptions = [
    { label: "循环", value: "循环" },
    { label: "条件分支", value: "条件分支" },
    { label: "函数调用", value: "函数调用" },
    { label: "异常处理", value: "异常处理" },
    { label: "递归", value: "递归" },
    { label: "并发", value: "并发" },
    { label: "I/O", value: "I/O" },
    { label: "数据结构", value: "数据结构" },
    { label: "算法", value: "算法" },
    { label: "面向对象", value: "面向对象" },
  ] as const;

  useEffect(() => {
    const base = loadPythonLabExperiments();
    setItems(base.map((x) => ({ ...x, updatedAt: new Date().toISOString() })));
  }, []);

  const refresh = () => {
    const base = loadPythonLabExperiments();
    setItems((prev) => {
      const updatedAtById = new Map(prev.map((x) => [x.id, x.updatedAt]));
      return base.map((x) => ({ ...x, updatedAt: updatedAtById.get(x.id) || new Date().toISOString() }));
    });
  };

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      level: "入门",
      scenario: "循环",
      tagsText: "",
      starterCode: "print('Hello, Python')\n",
    });
    setOpen(true);
  };

  const handleEdit = (record: ExperimentItem) => {
    setEditing(record);
    form.setFieldsValue({
      title: record.title,
      level: record.level,
      scenario: record.scenario,
      tagsText: record.tags.join(","),
      starterCode: record.starterCode,
    });
    setOpen(true);
  };

  const handleDelete = (record: ExperimentItem) => {
    const next = items.filter((x) => x.id !== record.id);
    setItems(next);
    savePythonLabExperiments(next.map(({ updatedAt, ...rest }) => rest));
    message.success("删除成功");
  };

  const handleSubmit = (values: any) => {
    const title = String(values.title || "").trim();
    const level = (values.level || "入门") as PythonLabLevel;
    const scenario = (values.scenario || "循环") as PythonLabScenario;
    const tags = String(values.tagsText || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const starterCode = String(values.starterCode || "");
    if (!title) {
      message.error("请输入标题");
      return;
    }

    const now = new Date().toISOString();
    if (editing) {
      const next = items.map((x) =>
        x.id === editing.id ? { ...x, title, level, scenario, tags, starterCode, updatedAt: now } : x
      );
      setItems(next);
      savePythonLabExperiments(next.map(({ updatedAt, ...rest }) => rest));
      message.success("更新成功");
    } else {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const next = [{ id, title, level, scenario, tags, starterCode, updatedAt: now }, ...items];
      setItems(next);
      savePythonLabExperiments(next.map(({ updatedAt, ...rest }) => rest));
      message.success("创建成功");
    }

    setOpen(false);
    setEditing(null);
    form.resetFields();
    refresh();
  };

  const columns = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "场景",
      dataIndex: "scenario",
      key: "scenario",
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "难度",
      dataIndex: "level",
      key: "level",
      width: 120,
      render: (v: PythonLabLevel) => <Tag color={levelColor(v)}>{v}</Tag>,
    },
    {
      title: "标签",
      dataIndex: "tags",
      key: "tags",
      render: (tags: string[]) => (
        <Space size={4} wrap>
          {(tags || []).slice(0, 6).map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: any, record: ExperimentItem) => (
        <Space>
          <Button type="primary" ghost icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个实验吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: "#fff" }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: "bold" }}>Python 实验室模板管理</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建实验
        </Button>
      </div>

      <Table dataSource={items} columns={columns as any} rowKey={(r) => r.id} />

      <Modal
        title={editing ? "编辑实验" : "新建实验"}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={720}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="例如：循环与统计" />
          </Form.Item>
          <Form.Item name="level" label="难度" rules={[{ required: true, message: "请选择难度" }]}>
            <Select
              options={[
                { label: "入门", value: "入门" },
                { label: "基础", value: "基础" },
                { label: "进阶", value: "进阶" },
              ]}
            />
          </Form.Item>
          <Form.Item name="scenario" label="场景" rules={[{ required: true, message: "请选择场景" }]}>
            <Select options={scenarioOptions as any} />
          </Form.Item>
          <Form.Item name="tagsText" label="标签（英文逗号分隔）">
            <Input placeholder="例如：for,sum,列表" />
          </Form.Item>
          <Form.Item name="starterCode" label="初始代码" rules={[{ required: true, message: "请输入初始代码" }]}>
            <Input.TextArea
              rows={12}
              spellCheck={false}
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PythonLabManager;
