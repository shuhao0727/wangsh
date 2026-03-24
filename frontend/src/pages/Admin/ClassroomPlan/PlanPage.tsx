// 课堂计划 - 独立页面
import React, { useState, useEffect, useCallback } from "react";
import {
  Table, Button, Tag, Badge, Space, Form, Input, InputNumber,
  Select, Popconfirm, message, Spin, Row, Col,
  Card, Tooltip, Drawer,
} from "antd";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  PlusOutlined, DeleteOutlined, EditOutlined, PlayCircleOutlined,
  StopOutlined, ReloadOutlined, ControlOutlined, SaveOutlined,
  HolderOutlined, RobotOutlined,
} from "@ant-design/icons";
import { planApi, Plan } from "@services/classroomPlan";
import { classroomApi, Activity, ActivityStats, ActiveAgentOption } from "@services/classroom";
import { AdminPage } from "@components/Admin";
import { ActivityDetailContent } from "@components/ActivityDetailDrawer";

const parseErr = (e: any) => String(e?.response?.data?.detail || e?.message || "操作失败");

const STATUS_MAP: Record<string, [string, string]> = {
  draft:  ["default",    "草稿"],
  active: ["processing", "进行中"],
  ended:  ["success",    "已结束"],
};

// ─── 可拖拽行 ────────────────────────────────────────────────────────
const SortableItem: React.FC<{ id: number; act: any; onRemove: () => void }> = ({ id, act, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef}
      className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 ${isDragging ? 'bg-blue-50' : 'bg-white'}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition, zIndex: isDragging ? 999 : undefined,
      }}
    >
      <span {...attributes} {...listeners}
        className="cursor-grab text-gray-300 text-base leading-none">
        <HolderOutlined />
      </span>
      <Tag color={act?.activity_type === "vote" ? "blue" : "green"} className="flex-shrink-0">
        {act?.activity_type === "vote" ? "投票" : "填空"}
      </Tag>
      <span className="flex-1 text-sm">{act?.title || `活动 ${id}`}</span>
      <Button size="small" danger onClick={onRemove}>移除</Button>
    </div>
  );
};

// ─── 编辑面板 ─────────────────────────────────────────────────────────
interface PlanFormPanelProps {
  editing: Plan | null;
  onCancel: () => void;
  onSuccess: (plan: Plan) => void;
}

const PlanFormPanel: React.FC<PlanFormPanelProps> = ({ editing, onCancel, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [agents, setAgents] = useState<ActiveAgentOption[]>([]);
  const [loadingActs, setLoadingActs] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // AI分析
  const [analysisAgentId, setAnalysisAgentId] = useState<number | undefined>();
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchData = useCallback(async () => {
    setLoadingActs(true);
    try {
      const [resp, agentList] = await Promise.all([
        classroomApi.list({ skip: 0, limit: 100 }),
        classroomApi.getActiveAgents(),
      ]);
      setAllActivities(resp.items);
      setAgents(agentList);
    } catch (e: any) { message.error(parseErr(e)); setAllActivities([]); }
    finally { setLoadingActs(false); }
  }, []);

  useEffect(() => {
    setSearch(""); setTypeFilter(undefined); setStatusFilter(undefined);
    fetchData();
    if (editing) {
      setTitle(editing.title);
      setSelectedIds([...editing.items].sort((a, b) => a.order_index - b.order_index).map(it => it.activity_id));
    } else {
      setTitle(""); setSelectedIds([]);
      setAnalysisAgentId(undefined); setAnalysisPrompt("");
    }
  }, []); // eslint-disable-line

  const editingActMap = Object.fromEntries(
    (editing?.items || []).map(it => [it.activity_id, it.activity]).filter(([, a]) => a)
  );
  const actMap: Record<number, any> = {
    ...editingActMap,
    ...Object.fromEntries(allActivities.map(a => [a.id, a])),
  };

  const filtered = allActivities.filter(a => {
    if (typeFilter && a.activity_type !== typeFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedIds(ids => {
        const oldIndex = ids.indexOf(active.id as number);
        const newIndex = ids.indexOf(over.id as number);
        return arrayMove(ids, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { message.warning("请输入计划标题"); return; }
    if (selectedIds.length === 0) { message.warning("请至少选择一个活动"); return; }
    setSubmitting(true);
    try {
      let plan: Plan;
      if (editing) {
        plan = await planApi.update(editing.id, title.trim(), selectedIds);
        message.success("已更新");
      } else {
        plan = await planApi.create(title.trim(), selectedIds);
        message.success("创建成功");
      }
      onSuccess(plan);
    } catch (e: any) { message.error(parseErr(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <Form layout="vertical">
        <Form.Item label="计划标题" required>
          <Input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="例如：第3章课堂练习" maxLength={200} />
        </Form.Item>
      </Form>

      <Row gutter={16}>
        {/* 左：活动列表 */}
        <Col span={12}>
          <div className="font-semibold mb-2">选择活动 <span className="font-normal text-xs text-gray-400">（点击勾选）</span></div>
          <Space className="mb-2" wrap>
            <Input.Search placeholder="搜索" allowClear value={search}
              onChange={e => setSearch(e.target.value)} style={{ width: 150 }} />
            <Select allowClear placeholder="类型" value={typeFilter}
              onChange={v => setTypeFilter(v)} style={{ width: 90 }}>
              <Select.Option value="vote">投票</Select.Option>
              <Select.Option value="fill_blank">填空</Select.Option>
            </Select>
            <Select allowClear placeholder="状态" value={statusFilter}
              onChange={v => setStatusFilter(v)} style={{ width: 90 }}>
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="active">进行中</Select.Option>
              <Select.Option value="ended">已结束</Select.Option>
            </Select>
          </Space>
          <Spin spinning={loadingActs}>
            <div className="border border-gray-100 rounded-md max-h-[520px] overflow-auto">
              {filtered.map(a => {
                const checked = selectedIds.includes(a.id);
                const isActive = a.status === "active";
                return (
                  <div key={a.id} onClick={() => {
                    if (isActive) return;
                    setSelectedIds(checked ? selectedIds.filter(id => id !== a.id) : [...selectedIds, a.id]);
                  }} className={`flex items-center gap-2 px-2.5 py-1.5 border-b border-gray-50 transition-colors ${isActive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-blue-50'} ${checked ? 'bg-blue-50' : ''}`}>
                    <input type="checkbox" checked={checked} readOnly disabled={isActive} />
                    <Tag color={a.activity_type === "vote" ? "blue" : "green"} className="flex-shrink-0 text-xs">
                      {a.activity_type === "vote" ? "投票" : "填空"}
                    </Tag>
                    <span className="flex-1 text-sm">{a.title}</span>
                    <Badge
                      status={a.status === "active" ? "processing" : a.status === "ended" ? "success" : "default"}
                      text={<span className="text-xs">{a.status === "active" ? "进行中" : a.status === "ended" ? "已结束" : "草稿"}</span>}
                    />
                  </div>
                );
              })}
              {filtered.length === 0 && !loadingActs && (
                <div className="text-center p-6 text-gray-400">暂无活动</div>
              )}
            </div>
          </Spin>
        </Col>

        {/* 右：已选 + 拖拽排序 */}
        <Col span={12}>
          <div className="font-semibold mb-2">已选活动 <span className="font-normal text-xs text-gray-400">（拖动 <HolderOutlined /> 调整顺序，共 {selectedIds.length} 个）</span></div>
          <div className="border border-gray-100 rounded-md min-h-[100px] max-h-[360px] overflow-auto">
            {selectedIds.length === 0 ? (
              <div className="text-center py-8 text-gray-300">从左侧勾选活动</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
                  {selectedIds.map(id => (
                    <SortableItem key={id} id={id} act={actMap[id]}
                      onRemove={() => setSelectedIds(selectedIds.filter(i => i !== id))} />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </Col>
      </Row>

      {/* AI 分析配置 */}
      <div className="border border-gray-100 rounded-md p-3">
        <div className="font-semibold mb-2 flex items-center gap-1.5">
          <RobotOutlined className="text-purple" /> AI 分析配置 <span className="font-normal text-xs text-gray-400">（可选，计划结束后自动分析各题）</span>
        </div>
        <Row gutter={12}>
          <Col span={10}>
            <Select allowClear placeholder="选择分析智能体" value={analysisAgentId}
              onChange={v => setAnalysisAgentId(v)} className="w-full">
              {agents.map(ag => <Select.Option key={ag.id} value={ag.id}>{ag.name}</Select.Option>)}
            </Select>
          </Col>
          <Col span={14}>
            <Input.TextArea value={analysisPrompt} onChange={e => setAnalysisPrompt(e.target.value)}
              placeholder="分析提示词（可选）" autoSize={{ minRows: 1, maxRows: 3 }} />
          </Col>
        </Row>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSubmit}>
          {editing ? "保存" : "创建计划"}
        </Button>
      </div>
    </div>
  );
};
// ─── 控制台面板 ───────────────────────────────────────────────────────
interface ConsolePanelProps {
  plan: Plan;
  onRefresh: (id: number) => void;
}

const PlanConsolePanel: React.FC<ConsolePanelProps> = ({ plan, onRefresh }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [editTimeId, setEditTimeId] = useState<number | null>(null);
  const [editTimeVal, setEditTimeVal] = useState<number>(60);
  const [drawerActivity, setDrawerActivity] = useState<Activity | null>(null);
  const [drawerStats, setDrawerStats] = useState<ActivityStats | null>(null);

  const openDetail = async (activityId: number, isEnded: boolean) => {
    const [act, stats] = await Promise.all([
      classroomApi.getDetail(activityId).catch(() => null),
      isEnded ? classroomApi.getStatistics(activityId).catch(() => null) : Promise.resolve(null),
    ]);
    if (act) { setDrawerActivity(act); setDrawerStats(stats); }
  };

  const doAction = async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    try { await fn(); onRefresh(plan.id); }
    catch (e: any) { message.error(parseErr(e)); }
    finally { setLoading(null); }
  };

  const handleUpdateTime = async (item: any) => {
    try {
      await classroomApi.update(item.activity_id, { time_limit: editTimeVal });
      message.success("时间已更新");
      setEditTimeId(null);
      onRefresh(plan.id);
    } catch (e: any) { message.error(parseErr(e)); }
  };

  const items = [...plan.items].sort((a, b) => a.order_index - b.order_index);
  const [st, stText] = STATUS_MAP[plan.status] || ["default", plan.status];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge status={st as any} text={<span className="font-semibold">{stText}</span>} />
        {plan.status === "draft" && (
          <Popconfirm title="启动计划？" onConfirm={() => doAction("start-plan", () => planApi.start(plan.id))}>
            <Button type="primary" size="small" icon={<PlayCircleOutlined />} loading={loading === "start-plan"}>启动计划</Button>
          </Popconfirm>
        )}
        {plan.status === "active" && (
          <Popconfirm title="强制结束整个计划？" onConfirm={() => doAction("end-plan", () => planApi.end(plan.id))}>
            <Button danger size="small" icon={<StopOutlined />} loading={loading === "end-plan"}>结束计划</Button>
          </Popconfirm>
        )}
        {plan.status === "ended" && (
          <Popconfirm title="重置计划？（所有题目恢复为待开始，计划变为草稿）"
            onConfirm={() => doAction("reset-plan", () => planApi.reset(plan.id))}>
            <Button size="small" icon={<ReloadOutlined />} loading={loading === "reset-plan"}>重置计划</Button>
          </Popconfirm>
        )}
        <Button size="small" icon={<ReloadOutlined />} onClick={() => onRefresh(plan.id)}>刷新</Button>
      </div>

      <div className="border border-gray-100 rounded-md overflow-hidden">
        {items.map((item, idx) => {
          const isActive = item.status === "active";
          const isPending = item.status === "pending";
          const isEnded = item.status === "ended";
          const startKey = `start-${item.id}`;
          const endKey = `end-${item.id}`;
          const restartKey = `restart-${item.id}`;
          const isEditingTime = editTimeId === item.id;
          return (
            <div key={item.id} className={`px-3.5 py-2.5 ${idx < items.length - 1 ? 'border-b border-gray-100' : ''} ${isActive ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 min-w-[24px] text-xs">{idx + 1}.</span>
                <Tag color={item.activity?.activity_type === "vote" ? "blue" : "green"} className="flex-shrink-0">
                  {item.activity?.activity_type === "vote" ? "投票" : "填空"}
                </Tag>
                <span className={`flex-1 text-sm ${isActive ? 'font-semibold' : 'font-normal'}`}>
                  {item.activity?.title || `活动 ${item.activity_id}`}
                </span>
                <span className="text-gray-400 text-xs mr-1">
                  {item.activity?.time_limit ? `${item.activity.time_limit}s` : "无限"}
                </span>
                <Badge
                  status={isActive ? "processing" : isEnded ? "success" : "default"}
                  text={isActive ? "进行中" : isEnded ? "已结束" : "待开始"}
                  className="flex-shrink-0"
                />
                <Button
                  type="text" size="small"
                  className="!text-purple flex-shrink-0 !px-1"
                  onClick={() => item.activity_id && openDetail(item.activity_id, isEnded)}
                >
                  详情
                </Button>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 pl-8">
                {isPending && plan.status === "active" && (
                  <Popconfirm title="开始该题？（当前进行中的题目将自动结束）"
                    onConfirm={() => doAction(startKey, () => planApi.startItem(plan.id, item.id))}>
                    <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={loading === startKey}>开始</Button>
                  </Popconfirm>
                )}
                {isActive && (
                  <Popconfirm title="结束该题？"
                    onConfirm={() => doAction(endKey, () => planApi.endItem(plan.id, item.id))}>
                    <Button size="small" danger icon={<StopOutlined />} loading={loading === endKey}>结束</Button>
                  </Popconfirm>
                )}
                {isEnded && plan.status === "active" && (
                  <Popconfirm title="重新开始该题？"
                    onConfirm={() => doAction(restartKey, () => planApi.startItem(plan.id, item.id))}>
                    <Button size="small" icon={<ReloadOutlined />} loading={loading === restartKey}>重新开始</Button>
                  </Popconfirm>
                )}
                {!isActive && (
                  isEditingTime ? (
                    <Space size={4}>
                      <InputNumber size="small" min={0} value={editTimeVal}
                        onChange={v => setEditTimeVal(v ?? 0)}
                        className="w-20" addonAfter="秒" />
                      <Button size="small" type="primary" onClick={() => handleUpdateTime(item)}>确定</Button>
                      <Button size="small" onClick={() => setEditTimeId(null)}>取消</Button>
                    </Space>
                  ) : (
                    <Button size="small" onClick={() => {
                      setEditTimeId(item.id);
                      setEditTimeVal(item.activity?.time_limit ?? 60);
                    }}>修改时限</Button>
                  )
                )}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-center py-10 text-gray-400">该计划暂无题目</div>
        )}
      </div>
      {/* 活动详情 Drawer */}
      <Drawer title={drawerActivity?.title || "活动详情"} open={!!drawerActivity} onClose={() => { setDrawerActivity(null); setDrawerStats(null); }} width={500}>
        {drawerActivity && <ActivityDetailContent activity={drawerActivity} stats={drawerStats} />}
      </Drawer>
    </div>
  );
};

// ─── 主页面 ──────────────────────────────────────────────────────────
type RightView = { type: "none" } | { type: "form"; editing: Plan | null } | { type: "console"; plan: Plan };

const ClassroomPlanPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [rightView, setRightView] = useState<RightView>({ type: "none" });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try { const resp = await planApi.list(0, 100); setPlans(resp.items); }
    catch (e: any) { message.error(parseErr(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const refreshPlan = async (id: number) => {
    try {
      const p = await planApi.get(id);
      setPlans(prev => prev.map(pl => pl.id === id ? p : pl));
      setRightView(prev =>
        prev.type === "console" && prev.plan.id === id ? { type: "console", plan: p } : prev
      );
    } catch {}
  };

  const handleDelete = async (id: number) => {
    try { await planApi.remove(id); message.success("已删除"); fetchList(); setRightView({ type: "none" }); }
    catch (e: any) { message.error(parseErr(e)); }
  };

  const handleFormSuccess = (plan: Plan) => {
    fetchList();
    setRightView({ type: "console", plan });
  };

  const rightTitle = rightView.type === "form"
    ? (rightView.editing ? `编辑计划：${rightView.editing.title}` : "创建新计划")
    : rightView.type === "console" ? `控制台：${rightView.plan.title}` : "";

  const isConsoleSelected = (id: number) => rightView.type === "console" && rightView.plan.id === id;

  return (
    <AdminPage scrollable={false}>
      <Row gutter={16} className="flex-1 min-h-0 h-full">
        <Col span={rightView.type === "none" ? 24 : 8}
          className="flex flex-col h-full">
          <Card size="small" title="计划列表"
            extra={
              <Space>
                <Button size="small" icon={<ReloadOutlined />} onClick={fetchList}>刷新</Button>
                <Button size="small" type="primary" icon={<PlusOutlined />}
                  onClick={() => setRightView({ type: "form", editing: null })}>新建</Button>
              </Space>
            }
            className="flex flex-col overflow-hidden flex-1"
            styles={{ body: { flex: 1, overflow: "auto", padding: 0 } }}
          >
            <Table dataSource={plans} rowKey="id" loading={loading} pagination={false} size="small"
              onRow={r => ({
                onClick: async () => {
                  try { const p = await planApi.get(r.id); setRightView({ type: "console", plan: p }); }
                  catch { setRightView({ type: "console", plan: r }); }
                },
                style: { cursor: "pointer", background: isConsoleSelected(r.id) ? "#e6f4ff" : undefined },
              })}
              columns={[
                { title: "ID", dataIndex: "id", width: 44 },
                { title: "标题", dataIndex: "title", ellipsis: true, width: 120 },
                { title: "题数", width: 44, render: (_: any, r: Plan) => r.items.length },
                { title: "状态", width: 72, render: (_: any, r: Plan) => {
                  const [s, t] = STATUS_MAP[r.status] || ["default", r.status];
                  return <Badge status={s as any} text={t} />;
                }},
                { title: "操作", width: 90, render: (_: any, r: Plan) => (
                  <Space size={4} onClick={e => e.stopPropagation()}>
                    {r.status !== "active" && (
                      <Tooltip title="编辑">
                        <Button size="small" icon={<EditOutlined />}
                          onClick={() => setRightView({ type: "form", editing: r })} />
                      </Tooltip>
                    )}
                    <Tooltip title="控制台">
                      <Button size="small" icon={<ControlOutlined />}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try { const p = await planApi.get(r.id); setRightView({ type: "console", plan: p }); }
                          catch { setRightView({ type: "console", plan: r }); }
                        }} />
                    </Tooltip>
                    {r.status !== "active" && (
                      <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </Space>
                )},
              ]}
            />
          </Card>
        </Col>

        {rightView.type !== "none" && (
          <Col span={16} className="flex flex-col h-full">
            <Card size="small" title={rightTitle}
              extra={<Button size="small" onClick={() => setRightView({ type: "none" })}>收起</Button>}
              className="flex flex-col overflow-hidden flex-1"
              styles={{ body: { flex: 1, overflow: "auto", padding: 20 } }}
            >
              {rightView.type === "form" && (
                <PlanFormPanel
                  key={rightView.editing ? `edit-${rightView.editing.id}` : "new"}
                  editing={rightView.editing}
                  onCancel={() => setRightView({ type: "none" })}
                  onSuccess={handleFormSuccess}
                />
              )}
              {rightView.type === "console" && (
                <PlanConsolePanel plan={rightView.plan} onRefresh={refreshPlan} />
              )}
            </Card>
          </Col>
        )}
      </Row>
    </AdminPage>
  );
};

export default ClassroomPlanPage;
