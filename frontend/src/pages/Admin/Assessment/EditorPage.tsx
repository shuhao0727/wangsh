/**
 * 测评编辑页 - /admin/assessment/editor/new 或 /admin/assessment/editor/:id
 * 新建时：填写基本信息后创建，跳转到 QuestionsPage 管理题目
 * 编辑时：直接跳转到 QuestionsPage
 */
import React, { useCallback, useEffect, useState } from "react";
import { Button, Form, Input, Select, message, Spin, Card } from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { AdminPage } from "@components/Admin";
import { assessmentConfigApi } from "@services/assessment";
import { aiAgentsApi } from "@services/agents";
import type { AIAgent } from "@services/znt/types";
import { logger } from "@services/logger";

const { TextArea } = Input;
const GRADE_OPTIONS = [
  "高一", "高二", "高三",
  "初一", "初二", "初三",
  "七年级", "八年级", "九年级",
];

const EditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";

  useEffect(() => {
    if (!isNew && id) {
      navigate(`/admin/assessment/${id}/questions`, { replace: true });
    }
  }, [isNew, id, navigate]);

  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);

  const loadAgents = useCallback(async () => {
    try {
      const resp = await aiAgentsApi.getAgents({ limit: 100 });
      if (resp.success) setAgents(resp.data.items);
    } catch (e) { logger.error("加载智能体失败:", e); }
  }, []);

  useEffect(() => { if (isNew) loadAgents(); }, [isNew, loadAgents]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const kpStr = (values.knowledge_points || "").trim();
      const kps = kpStr ? kpStr.split(/[,，、\s]+/).filter(Boolean) : [];
      const config = await assessmentConfigApi.create({
        title: values.title,
        grade: values.grade,
        agent_id: values.agent_id,
        knowledge_points: JSON.stringify(kps),
        teaching_objectives: values.teaching_objectives,
        question_config: JSON.stringify({}),
      });
      message.success("创建成功");
      navigate(`/admin/assessment/${config.id}/questions`, { replace: true });
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.message || "创建失败");
    } finally { setSaving(false); }
  };

  if (!isNew) {
    return (
      <AdminPage>
        <div className="flex justify-center p-24">
          <Spin size="large" />
        </div>
      </AdminPage>
    );
  }

  const fieldLabel = (text: string) => (
    <span className="font-medium text-[13px]">{text}</span>
  );

  return (
    <AdminPage scrollable>
      <div className="max-w-[680px] mx-auto py-5">
        <div className="flex items-center mb-6">
          <Button type="text" icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/admin/assessment")}
            className="text-text-secondary">返回列表</Button>
        </div>

        <Card variant="borderless" className="rounded-md bg-surface px-5 py-5">
          <div className="text-base font-semibold mb-5">新建测评</div>
          <Form form={form} layout="vertical">
            <Form.Item name="title" label={fieldLabel("测评标题")} rules={[{ required: true, message: "请输入标题" }]}>
              <Input placeholder="如：Python循环结构课堂检测" maxLength={200} />
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="grade" label={fieldLabel("年级")}>
                <Select placeholder="选择年级" allowClear>
                  {GRADE_OPTIONS.map(g => <Select.Option key={g} value={g}>{g}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="agent_id" label={fieldLabel("智能体")} rules={[{ required: true, message: "请选择" }]}
                tooltip="用于 AI 出题和评分">
                <Select placeholder="选择智能体" allowClear showSearch optionFilterProp="label">
                  {agents.map(a => <Select.Option key={a.id} value={a.id} label={a.name}>{a.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </div>
            <Form.Item name="knowledge_points" label={fieldLabel("知识点")} tooltip="用逗号或顿号分隔">
              <Input placeholder="如：for循环、while循环、递归" />
            </Form.Item>
            <Form.Item name="teaching_objectives" label={fieldLabel("教学目标")} className="!mb-0">
              <TextArea rows={2} placeholder="可选，AI 出题时会参考" />
            </Form.Item>
          </Form>
          <div className="mt-6 text-right">
            <Button onClick={() => navigate("/admin/assessment")} className="mr-3">取消</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleCreate}>创建测评</Button>
          </div>
        </Card>
      </div>
    </AdminPage>
  );
};

export default EditorPage;
