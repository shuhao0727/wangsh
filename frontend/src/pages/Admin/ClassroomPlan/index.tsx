// 课堂计划 - 弹窗组件集合
import React, { useState, useEffect, useCallback } from "react";
import {
  Modal, Button, Table, Tag, Badge, Space, Form, Input,
  Select, Popconfirm, message, Steps, Spin,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, EditOutlined, PlayCircleOutlined,
  StopOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined,
  ControlOutlined,
} from "@ant-design/icons";
import { planApi, Plan } from "@services/classroomPlan";
import { classroomApi, Activity } from "@services/classroom";

const parseErr = (e: any) => String(e?.response?.data?.detail || e?.message || "操作失败");

// ─── Step 1: 选活动 + Step 2: 排序 ───
interface PlanFormProps {
  open: boolean;
  editing: Plan | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PlanFormModal: React.FC<PlanFormProps> = ({ open, editing, onClose, onSuccess }) => {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loadingActs, setLoadingActs] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoadingActs(true);
    try {
      const resp = await classroomApi.list({ skip: 0, limit: 200 });
      setAllActivities(resp.items);
    } catch { setAllActivities([]); }
    finally { setLoadingActs(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(0); setSearch(""); setTypeFilter(undefined); setStatusFilter(undefined);
    fetchActivities();
    if (editing) {
      setTitle(editing.title);
      setSelectedIds([...editing.items].sort((a, b) => a.order_index - b.order_index).map(it => it.activity_id));
    } else {
      setTitle(""); setSelectedIds([]);
    }
  }, [open]); // eslint-disable-line

  const filtered = allActivities.filter(a => {
    if (typeFilter && a.activity_type !== typeFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // 合并 editing.items 里的活动信息，确保已选活动即使不在 allActivities 列表里也能显示
  const editingActMap = Object.fromEntries(
    (editing?.items || []).map(it => [it.activity_id, it.activity]).filter(([, a]) => a)
  );
  const actMap: Record<number, any> = {
    ...editingActMap,
    ...Object.fromEntries(allActivities.map(a => [a.id, a])),
  };

  const handleSubmit = async () => {
    if (!title.trim()) { message.warning("请输入计划标题"); return; }
    if (selectedIds.length === 0) { message.warning("请至少选择一个活动"); return; }
    setSubmitting(true);
    try {
      if (editing) {
        await planApi.update(editing.id, title.trim(), selectedIds);
        message.success("已更新");
      } else {
        await planApi.create(title.trim(), selectedIds);
        message.success("创建成功");
      }
      onSuccess(); onClose();
    } catch (e: any) { message.error(parseErr(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      title={editing ? "编辑计划" : "创建课堂计划"}
      onCancel={onClose}
      footer={step === 0 ? [
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="next" type="primary" disabled={selectedIds.length === 0 || !title.trim()}
          onClick={() => setStep(1)}>下一步：调整顺序</Button>,
      ] : [
        <Button key="back" onClick={() => setStep(0)}>上一步</Button>,
        <Button key="ok" type="primary" loading={submitting} onClick={handleSubmit}>
          {editing ? "保存" : "创建计划"}
        </Button>,
      ]}
      width={700}
      destroyOnClose
    >
      <Steps current={step} size="small" className="mb-5"
        items={[{ title: "选择活动" }, { title: "调整顺序" }]} />

      {step === 0 && (
        <>
          <Form layout="inline" className="mb-3">
            <Form.Item label="计划标题" required className="flex-1">
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="例如：第3章课堂练习" maxLength={200} />
            </Form.Item>
          </Form>
          <Space className="mb-2" wrap>
            <Input.Search placeholder="搜索标题" allowClear value={search}
              onChange={e => setSearch(e.target.value)} style={{ width: 180 }} />
            <Select allowClear placeholder="类型" value={typeFilter}
              onChange={v => setTypeFilter(v)} style={{ width: 100 }}>
              <Select.Option value="vote">投票</Select.Option>
              <Select.Option value="fill_blank">填空</Select.Option>
            </Select>
            <Select allowClear placeholder="状态" value={statusFilter}
              onChange={v => setStatusFilter(v)} style={{ width: 100 }}>
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="active">进行中</Select.Option>
              <Select.Option value="ended">已结束</Select.Option>
            </Select>
            <span className="text-xs text-gray-400">已选 {selectedIds.length} 个</span>
          </Space>
          <Spin spinning={loadingActs}>
            <div className="max-h-[320px] overflow-auto border border-gray-100 rounded-md">
              {filtered.map(a => {
                const checked = selectedIds.includes(a.id);
                const isActive = a.status === "active";
                return (
                  <div key={a.id}
                    onClick={() => {
                      if (isActive) return;
                      setSelectedIds(checked
                        ? selectedIds.filter(id => id !== a.id)
                        : [...selectedIds, a.id]);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 ${isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${checked ? 'bg-purple-soft' : 'bg-white'}`}
                  >
                    <input type="checkbox" checked={checked} readOnly disabled={isActive} />
                    <Tag color={a.activity_type === "vote" ? "blue" : "green"} className="flex-shrink-0">
                      {a.activity_type === "vote" ? "投票" : "填空"}
                    </Tag>
                    <span className="flex-1 text-sm">{a.title}</span>
                    <Badge
                      status={a.status === "active" ? "processing" : a.status === "ended" ? "success" : "default"}
                      text={a.status === "active" ? "进行中" : a.status === "ended" ? "已结束" : "草稿"}
                    />
                  </div>
                );
              })}
              {filtered.length === 0 && !loadingActs && (
                <div className="text-center p-6 text-gray-400">暂无活动</div>
              )}
            </div>
          </Spin>
        </>
      )}

      {step === 1 && (
        <div className="border border-gray-100 rounded-md overflow-hidden">
          {selectedIds.map((id, idx) => {
            const act = actMap[id];
            return (
              <div key={id} className={`flex items-center px-3 py-2 ${idx < selectedIds.length - 1 ? 'border-b border-gray-100' : ''} ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <span className="text-gray-400 text-xs" style={{ minWidth: 28 }}>{idx + 1}.</span>
                <Tag color={act?.activity_type === "vote" ? "blue" : "green"} className="mr-2 flex-shrink-0">
                  {act?.activity_type === "vote" ? "投票" : "填空"}
                </Tag>
                <span className="flex-1 text-sm">{act?.title || `活动 ${id}`}</span>
                <Space size={4}>
                  <Button size="small" icon={<ArrowUpOutlined />} disabled={idx === 0}
                    onClick={() => { const n = [...selectedIds]; [n[idx-1],n[idx]]=[n[idx],n[idx-1]]; setSelectedIds(n); }} />
                  <Button size="small" icon={<ArrowDownOutlined />} disabled={idx === selectedIds.length - 1}
                    onClick={() => { const n = [...selectedIds]; [n[idx],n[idx+1]]=[n[idx+1],n[idx]]; setSelectedIds(n); }} />
                  <Button size="small" danger
                    onClick={() => setSelectedIds(selectedIds.filter((_, i) => i !== idx))}>移除</Button>
                </Space>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

// ─── 控制台 Modal（每题单独控制） ───
interface ConsoleProps {
  plan: Plan | null;
  open: boolean;
  onClose: () => void;
  onRefresh: (id: number) => Promise<void>;
}

const PlanConsoleModal: React.FC<ConsoleProps> = ({ plan, open, onClose, onRefresh }) => {
  const [loading, setLoading] = useState<string | null>(null);

  const doAction = async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    try { await fn(); if (plan) await onRefresh(plan.id); }
    catch (e: any) { message.error(parseErr(e)); }
    finally { setLoading(null); }
  };

  if (!plan) return null;
  const items = [...plan.items].sort((a, b) => a.order_index - b.order_index);
  const handleRefresh = async () => {
    setLoading("refresh-plan");
    try {
      await onRefresh(plan.id);
      message.success("已刷新");
    } catch (e: any) {
      message.error(parseErr(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal
      open={open}
      title={`控制台：${plan.title}`}
      onCancel={onClose}
      footer={[
        plan.status === "active" && (
          <Popconfirm key="end" title="强制结束整个计划？"
            onConfirm={() => doAction("end-plan", () => planApi.end(plan.id))}>
            <Button danger loading={loading === "end-plan"}>结束计划</Button>
          </Popconfirm>
        ),
        plan.status === "ended" && (
          <Popconfirm key="reset" title="重置计划？（所有题目恢复为待开始，计划状态变为草稿）"
            onConfirm={() => doAction("reset-plan", () => planApi.reset(plan.id))}>
            <Button loading={loading === "reset-plan"} icon={<ReloadOutlined />}>重置计划</Button>
          </Popconfirm>
        ),
        <Button key="close" onClick={onClose}>关闭</Button>,
      ].filter(Boolean)}
      width={560}
    >
      <div className="mb-3 flex gap-2 items-center">
        <Badge
          status={plan.status === "active" ? "processing" : plan.status === "ended" ? "success" : "default"}
          text={plan.status === "active" ? "进行中" : plan.status === "ended" ? "已结束" : "草稿"}
        />
        {plan.status === "draft" && (
          <Popconfirm title="启动计划？（启动后可逐题开始）"
            onConfirm={() => doAction("start-plan", () => planApi.start(plan.id))}>
            <Button type="primary" size="small" icon={<PlayCircleOutlined />}
              loading={loading === "start-plan"}>启动计划</Button>
          </Popconfirm>
        )}
        <Button size="small" icon={<ReloadOutlined />} loading={loading === "refresh-plan"} onClick={() => { void handleRefresh(); }}>刷新</Button>
      </div>

      <div className="border border-gray-100 rounded-md overflow-hidden">
        {items.map((item, idx) => {
          const isActive = item.status === "active";
          const isPending = item.status === "pending";
          const startKey = `start-${item.id}`;
          const endKey = `end-${item.id}`;
          return (
            <div key={item.id} className={`flex items-center gap-2 px-3 py-2.5 ${idx < items.length - 1 ? 'border-b border-gray-100' : ''} ${isActive ? 'bg-purple-soft' : idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
              <span className="text-gray-400 text-xs" style={{ minWidth: 24 }}>{idx + 1}.</span>
              <Tag color={item.activity?.activity_type === "vote" ? "blue" : "green"} className="flex-shrink-0">
                {item.activity?.activity_type === "vote" ? "投票" : "填空"}
              </Tag>
              <span className={`flex-1 text-sm ${isActive ? 'font-semibold' : 'font-normal'}`}>
                {item.activity?.title || `活动 ${item.activity_id}`}
              </span>
              <Badge
                status={isActive ? "processing" : item.status === "ended" ? "success" : "default"}
                text={isActive ? "进行中" : item.status === "ended" ? "已结束" : "待开始"}
                className="flex-shrink-0 mr-2"
              />
              <Space size={4}>
                {isPending && plan.status === "active" && (
                  <Popconfirm title="开始该题？（当前进行中的题目将自动结束）"
                    onConfirm={() => doAction(startKey, () => planApi.startItem(plan.id, item.id))}>
                    <Button size="small" type="primary" icon={<PlayCircleOutlined />}
                      loading={loading === startKey}>开始</Button>
                  </Popconfirm>
                )}
                {isActive && (
                  <Popconfirm title="结束该题？"
                    onConfirm={() => doAction(endKey, () => planApi.endItem(plan.id, item.id))}>
                    <Button size="small" danger icon={<StopOutlined />}
                      loading={loading === endKey}>结束</Button>
                  </Popconfirm>
                )}
              </Space>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

// ─── 计划列表 Modal（主入口） ───
interface PlanListModalProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_MAP: Record<string, [string, string]> = {
  draft: ["default", "草稿"],
  active: ["processing", "进行中"],
  ended: ["success", "已结束"],
};

export const PlanListModal: React.FC<PlanListModalProps> = ({ open, onClose }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consolePlan, setConsolePlan] = useState<Plan | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try { const resp = await planApi.list(0, 50); setPlans(resp.items); }
    catch (e: any) { message.error(parseErr(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) fetchList(); }, [open, fetchList]);

  const refreshPlan = async (id: number) => {
    const p = await planApi.get(id);
    setPlans(prev => prev.map(pl => pl.id === id ? p : pl));
    if (consolePlan?.id === id) setConsolePlan(p);
  };

  const openConsole = async (plan: Plan) => {
    try { const p = await planApi.get(plan.id); setConsolePlan(p); }
    catch { setConsolePlan(plan); }
    setConsoleOpen(true);
  };

  const handleDelete = async (id: number) => {
    try { await planApi.remove(id); message.success("已删除"); fetchList(); }
    catch (e: any) { message.error(parseErr(e)); }
  };

  return (
    <>
      <Modal
        open={open}
        title="课堂计划管理"
        onCancel={onClose}
        footer={<Button onClick={onClose}>关闭</Button>}
        width={760}
      >
        <div className="flex justify-between mb-3">
          <Button icon={<ReloadOutlined />} onClick={fetchList} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { setEditing(null); setFormOpen(true); }}>创建计划</Button>
        </div>
        <Table
          dataSource={plans}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
          columns={[
            { title: "ID", dataIndex: "id", width: 60 },
            { title: "计划标题", dataIndex: "title", ellipsis: true },
            { title: "题数", width: 60, render: (_: any, r: Plan) => r.items.length },
            { title: "状态", width: 100, render: (_: any, r: Plan) => {
              const [s, t] = STATUS_MAP[r.status] || ["default", r.status];
              return <Badge status={s as any} text={t} />;
            }},
            { title: "操作", width: 220, render: (_: any, r: Plan) => (
              <Space size={4}>
                {r.status !== "active" && (
                  <Button size="small" icon={<EditOutlined />}
                    onClick={() => { setEditing(r); setFormOpen(true); }}>编辑</Button>
                )}
                <Button size="small" icon={<ControlOutlined />}
                  onClick={() => openConsole(r)}>控制台</Button>
                {r.status !== "active" && (
                  <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            )},
          ]}
        />
      </Modal>

      <PlanFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSuccess={fetchList}
      />

      <PlanConsoleModal
        plan={consolePlan}
        open={consoleOpen}
        onClose={() => setConsoleOpen(false)}
        onRefresh={refreshPlan}
      />
    </>
  );
};

export default PlanListModal;
