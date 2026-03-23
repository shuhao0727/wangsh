/**
 * 测评配置列表页 - /admin/assessment
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Table,
  Switch,
  Pagination,
  Input,
  Select,
  Tag,
  Popconfirm,
  Modal,
  Form,
  message,
  Space,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import {
  assessmentConfigApi,
  type AssessmentConfig,
} from "@services/assessment";
import { aiAgentsApi } from "@services/agents";
import type { AIAgent } from "@services/znt/types";
import { logger } from "@services/logger";

const GRADE_OPTIONS = ["高一","高二","高三","初一","初二","初三","七年级","八年级","九年级"];

const AdminAssessment: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AssessmentConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await assessmentConfigApi.list({
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        search: search.trim() || undefined,
      });
      setItems(resp.items);
      setTotal(resp.total);
    } catch (error: any) {
      message.error(error.message || "加载测评配置失败");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadAgents = useCallback(async () => {
    try {
      const resp = await aiAgentsApi.getAgents({ limit: 100 });
      if (resp.success) setAgents(resp.data.items);
    } catch (e) { logger.error("加载智能体失败:", e); }
  }, []);

  const openCreateModal = () => {
    createForm.resetFields();
    loadAgents();
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    try {
      const v = await createForm.validateFields();
      setCreating(true);
      const kpStr = (v.knowledge_points || "").trim();
      const kps = kpStr ? kpStr.split(/[,，、\s]+/).filter(Boolean) : [];
      const config = await assessmentConfigApi.create({
        title: v.title,
        grade: v.grade,
        agent_id: v.agent_id,
        knowledge_points: JSON.stringify(kps),
        question_config: JSON.stringify({}),
      });
      message.success("创建成功");
      setCreateOpen(false);
      navigate(`/admin/assessment/${config.id}/questions`);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.message || "创建失败");
    } finally { setCreating(false); }
  };

  const handleToggle = async (id: number) => {
    try {
      await assessmentConfigApi.toggle(id);
      await loadData();
    } catch (error: any) {
      message.error(error.message || "切换状态失败");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await assessmentConfigApi.delete(id);
      message.success("删除成功");
      await loadData();
    } catch (error: any) {
      message.error(error.message || "删除失败");
    }
  };

  const columns = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      width: 260,
      ellipsis: true,
    },
    {
      title: "年级",
      dataIndex: "grade",
      key: "grade",
      width: 80,
    },
    {
      title: "题目数",
      dataIndex: "question_count",
      key: "question_count",
      width: 80,
      render: (v: number) => <Tag>{v}</Tag>,
    },
    {
      title: "答题人数",
      dataIndex: "session_count",
      key: "session_count",
      width: 90,
      render: (v: number) => <Tag color={v > 0 ? "blue" : undefined}>{v}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      width: 80,
      render: (enabled: boolean, record: AssessmentConfig) => (
        <Switch
          checked={enabled}
          size="small"
          onChange={() => handleToggle(record.id)}
        />
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (v: string) => new Date(v).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: any, record: AssessmentConfig) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<DatabaseOutlined />}
            onClick={() => navigate(`/admin/assessment/${record.id}/questions`)}
          >
            管理
          </Button>
          <Button
            type="link"
            size="small"
            icon={<BarChartOutlined />}
            onClick={() => navigate(`/admin/assessment/${record.id}/statistics`)}
          >
            统计
          </Button>
          <Popconfirm
            title="确定删除此测评配置？"
            description="将同时删除关联的题目、答题记录和画像"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminPage scrollable={false}>
      {/* 搜索栏 */}
      <div className="flex items-center gap-2 mb-3">
        <Input.Search
          placeholder="搜索测评标题"
          allowClear
          style={{ width: 280 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={() => { setCurrentPage(1); loadData(); }}
        />
        <div className="flex-1" />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建测评</Button>
      </div>

      {/* 表格 */}
      <div className="flex-1 min-h-0">
        <AdminTablePanel
          loading={loading}
          isEmpty={items.length === 0}
          emptyDescription={search ? "未找到匹配的测评" : "暂无测评配置"}
          emptyAction={
            <Button type="primary" onClick={openCreateModal}>
              创建第一个测评
            </Button>
          }
          pagination={
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={total}
              onChange={(page, size) => { setCurrentPage(page); if (size) setPageSize(size); }}
              showSizeChanger
              showTotal={(t) => `共 ${t} 条`}
            />
          }
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            pagination={false}
            scroll={{ x: 1100 }}
            size="middle"
          />
        </AdminTablePanel>
      </div>

      {/* 新建测评弹窗 */}
      <Modal title="新建测评" open={createOpen} onCancel={() => setCreateOpen(false)}
        onOk={handleCreate} confirmLoading={creating} okText="创建" cancelText="取消" width={520} destroyOnHidden>
        <Form form={createForm} layout="vertical" className="mt-3">
          <Form.Item name="title" label="测评标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="如：Python循环结构课堂检测" maxLength={200} />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="grade" label="年级">
              <Select placeholder="选择年级" allowClear>
                {GRADE_OPTIONS.map(g => <Select.Option key={g} value={g}>{g}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="agent_id" label="智能体" rules={[{ required: true, message: "请选择" }]}>
              <Select placeholder="选择智能体" allowClear showSearch optionFilterProp="label">
                {agents.map(a => <Select.Option key={a.id} value={a.id} label={a.name}>{a.name}</Select.Option>)}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="knowledge_points" label="知识点" tooltip="用逗号或顿号分隔" style={{ marginBottom: 0 }}>
            <Input placeholder="如：for循环、while循环、递归" />
          </Form.Item>
        </Form>
      </Modal>
    </AdminPage>
  );
};

export default AdminAssessment;
