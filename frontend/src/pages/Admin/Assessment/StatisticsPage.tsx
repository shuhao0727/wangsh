/**
 * 答题统计页 - /admin/assessment/:id/statistics
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Table,
  Tag,
  Pagination,
  Card,
  Modal,
  Descriptions,
  Collapse,
  Spin,
  Select,
  Input,
  Popconfirm,
  message,
  Row,
  Col,
  Tabs,
} from "antd";
import {
  ArrowLeftOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  BarChartOutlined,
  EyeOutlined,
  UserOutlined,
  RedoOutlined,
  SearchOutlined,
  DownloadOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { AdminPage } from "@components/Admin";
import EmptyState from "@components/Common/EmptyState";
import RadarChart from "@components/RadarChart";
import { BasicProfileView, AdvancedProfileView, AdvancedProfileEmpty } from "@components/ProfileView";
import {
  assessmentSessionApi,
  assessmentConfigApi,
  profileApi,
  type StatisticsResponse,
  type SessionListItem,
  type SessionListResponse,
  type StudentProfile,
} from "@services/assessment";
import type {
  SessionResultResponse,
  AnswerDetailResponse,
  BasicProfileResponse,
} from "@services/assessment";

const StatisticsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const configId = Number(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [configTitle, setConfigTitle] = useState("");
  const [stats, setStats] = useState<StatisticsResponse | null>(null);

  // 筛选
  const [classNames, setClassNames] = useState<string[]>([]);
  const [filterClass, setFilterClass] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");
  const [searchValue, setSearchValue] = useState("");

  // 雷达图
  type RadarPick = { type: "all" } | { type: "class"; value: string } | { type: "student"; value: number };
  const [radarLeft, setRadarLeft] = useState<RadarPick>({ type: "all" });
  const [radarRight, setRadarRight] = useState<RadarPick | null>(null);
  const [radarLeftData, setRadarLeftData] = useState<{ name: string; data: Record<string, number> } | null>(null);
  const [radarRightData, setRadarRightData] = useState<{ name: string; data: Record<string, number> } | null>(null);
  const [allGradedStudents, setAllGradedStudents] = useState<{ id: number; user_name: string; class_name: string | null }[]>([]);

  // 学生列表
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [listLoading, setListLoading] = useState(false);

  // 批量选择
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchRetesting, setBatchRetesting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 弹窗
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<SessionResultResponse | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState<BasicProfileResponse | null>(null);
  const [advancedProfile, setAdvancedProfile] = useState<StudentProfile | null>(null);
  const [profileTab, setProfileTab] = useState<"basic" | "advanced">("basic");
  const [generatingProfile, setGeneratingProfile] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [configAgentId, setConfigAgentId] = useState<number | null>(null);

  useEffect(() => { assessmentSessionApi.getClassNames(configId).then(setClassNames); }, [configId]);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const [statsResp, configResp] = await Promise.all([
        assessmentSessionApi.getStatistics(configId, { class_name: filterClass }),
        assessmentConfigApi.get(configId),
      ]);
      setStats(statsResp);
      setConfigTitle(configResp.title);
      setConfigAgentId(configResp.agent_id ?? null);
    } catch (e: any) { message.error(e.message || "加载统计数据失败"); }
    finally { setLoading(false); }
  }, [configId, filterClass]);

  const loadSessions = useCallback(async () => {
    try {
      setListLoading(true);
      const resp: SessionListResponse = await assessmentSessionApi.getConfigSessions(configId, {
        skip: (page - 1) * pageSize, limit: pageSize,
        class_name: filterClass, status: filterStatus, search: searchValue || undefined,
      });
      setSessions(resp.items);
      setTotal(resp.total);
    } catch (e: any) { message.error(e.message || "加载答题列表失败"); }
    finally { setListLoading(false); }
  }, [configId, page, pageSize, filterClass, filterStatus, searchValue]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { setPage(1); setSelectedRowKeys([]); }, [filterClass, filterStatus, searchValue]);

  // 雷达图数据
  useEffect(() => {
    assessmentSessionApi.getConfigSessions(configId, { limit: 100, status: "graded" })
      .then(r => setAllGradedStudents(
        r.items.filter(s => s.user_name).map(s => ({ id: s.id, user_name: s.user_name!, class_name: s.class_name }))
      )).catch(() => {});
  }, [configId]);

  const loadRadarPick = useCallback(async (pick: RadarPick): Promise<{ name: string; data: Record<string, number> } | null> => {
    if (pick.type === "all") {
      const s = await assessmentSessionApi.getStatistics(configId, {});
      return { name: "全部数据", data: (s.knowledge_rates || {}) as Record<string, number> };
    }
    if (pick.type === "class") {
      const s = await assessmentSessionApi.getStatistics(configId, { class_name: pick.value });
      return { name: pick.value, data: (s.knowledge_rates || {}) as Record<string, number> };
    }
    if (pick.type === "student") {
      const p = await assessmentSessionApi.getAdminBasicProfile(pick.value);
      const kp: Record<string, number> = {};
      if (p.knowledge_scores) {
        try {
          const raw = JSON.parse(p.knowledge_scores);
          for (const [k, v] of Object.entries(raw)) { const d = v as any; kp[k] = d.total > 0 ? Math.round(d.earned / d.total * 100) : 0; }
        } catch {}
      }
      const stu = allGradedStudents.find(x => x.id === pick.value);
      return { name: stu?.user_name || `学生#${pick.value}`, data: kp };
    }
    return null;
  }, [configId, allGradedStudents]);

  useEffect(() => { let c = false; loadRadarPick(radarLeft).then(d => { if (!c) setRadarLeftData(d); }).catch(() => {}); return () => { c = true; }; }, [radarLeft, loadRadarPick]);
  useEffect(() => { if (!radarRight) { setRadarRightData(null); return; } let c = false; loadRadarPick(radarRight).then(d => { if (!c) setRadarRightData(d); }).catch(() => {}); return () => { c = true; }; }, [radarRight, loadRadarPick]);

  // 操作 handlers
  const handleViewDetail = async (sessionId: number) => {
    try { setDetailOpen(true); setDetailLoading(true); setDetailData(await assessmentSessionApi.getSessionDetail(sessionId)); }
    catch (e: any) { message.error(e.message || "加载答题详情失败"); } finally { setDetailLoading(false); }
  };
  const handleViewProfile = async (sessionId: number, userId: number) => {
    try {
      setProfileOpen(true);
      setProfileLoading(true);
      setProfileTab("basic");
      setProfileUserId(userId);
      setAdvancedProfile(null);
      const [basic, advResp] = await Promise.all([
        assessmentSessionApi.getAdminBasicProfile(sessionId),
        profileApi.list({ target_id: String(userId), limit: 1 }).catch(() => ({ items: [] })),
      ]);
      setProfileData(basic);
      setAdvancedProfile(advResp.items.length > 0 ? advResp.items[0] : null);
    } catch (e: any) {
      message.error(e.message || "加载画像失败");
      setProfileOpen(false);
    } finally { setProfileLoading(false); }
  };
  const handleAllowRetest = async (sessionId: number) => {
    try { await assessmentSessionApi.allowRetest(sessionId); message.success("已允许重新测试"); await Promise.all([loadSessions(), loadStats()]); }
    catch (e: any) { message.error(e.message || "操作失败"); }
  };
  const handleBatchRetest = async (mode: "class" | "selection") => {
    setBatchRetesting(true);
    try {
      const params = mode === "class" ? { class_name: filterClass! } : { session_ids: selectedRowKeys.map(Number) };
      const result = await assessmentSessionApi.batchRetest(configId, params);
      message.success(result.message || `已删除 ${result.deleted_count} 条记录`);
      setSelectedRowKeys([]);
      await Promise.all([loadSessions(), loadStats()]);
    } catch (e: any) { message.error(e.message || "批量重测失败"); }
    finally { setBatchRetesting(false); }
  };
  const handleExport = async () => {
    try { setExporting(true); await assessmentSessionApi.exportXlsx(configId, { class_name: filterClass, status: filterStatus, search: searchValue || undefined }); message.success("导出成功"); }
    catch (e: any) { message.error(e.message || "导出失败"); } finally { setExporting(false); }
  };
  const handleGenerateProfile = async () => {
    if (!profileUserId || !configAgentId) { message.warning("缺少配置信息，无法生成画像"); return; }
    setGeneratingProfile(true);
    try {
      const result = await profileApi.generate({
        profile_type: "individual", target_id: String(profileUserId),
        config_id: configId, agent_id: configAgentId,
      });
      setAdvancedProfile(result);
      setProfileTab("advanced");
      message.success("三维画像生成成功");
    } catch (e: any) { message.error(e.message || "生成画像失败"); }
    finally { setGeneratingProfile(false); }
  };
  const [batchGenerating, setBatchGenerating] = useState(false);
  const handleBatchGenerateProfiles = async () => {
    if (!configAgentId) { message.warning("该测评未配置 AI 智能体，无法生成画像"); return; }
    setBatchGenerating(true);
    try {
      const gradedSessions = await assessmentSessionApi.getConfigSessions(configId, {
        limit: 100, status: "graded", class_name: filterClass,
      });
      const userIds = gradedSessions.items.map(s => s.user_id).filter((v, i, a) => a.indexOf(v) === i);
      if (userIds.length === 0) { message.info("没有已评分的学生"); return; }
      const result = await profileApi.batchGenerate({ user_ids: userIds, config_id: configId, agent_id: configAgentId });
      message.success(`已为 ${result.count} 名学生生成画像`);
    } catch (e: any) { message.error(e.message || "批量生成失败"); }
    finally { setBatchGenerating(false); }
  };

  // 画像雷达图

  const radarSeries = useMemo(() => {
    const arr: { name: string; data: Record<string, number> }[] = [];
    if (radarLeftData && Object.keys(radarLeftData.data).length > 0) arr.push(radarLeftData);
    if (radarRightData && Object.keys(radarRightData.data).length > 0) arr.push(radarRightData);
    return arr;
  }, [radarLeftData, radarRightData]);

  const statusMap: Record<string, { color: string; text: string }> = {
    in_progress: { color: "processing", text: "答题中" },
    submitted: { color: "warning", text: "已提交" },
    graded: { color: "success", text: "已评分" },
  };

  // 雷达图选择器
  const radarPickerOptions = useMemo(() => {
    const opts: { label: string; options: { label: string; value: string }[] }[] = [
      { label: "汇总", options: [{ label: "全部数据", value: "all" }] },
    ];
    if (classNames.length > 0) opts.push({ label: "按班级", options: classNames.map(c => ({ label: c, value: `class:${c}` })) });
    if (allGradedStudents.length > 0) opts.push({ label: "按学生", options: allGradedStudents.map(s => ({ label: `${s.user_name}${s.class_name ? ` (${s.class_name})` : ""}`, value: `student:${s.id}` })) });
    return opts;
  }, [classNames, allGradedStudents]);
  const parsePickerValue = (v: string): RadarPick => {
    if (v === "all") return { type: "all" };
    if (v.startsWith("class:")) return { type: "class", value: v.slice(6) };
    if (v.startsWith("student:")) return { type: "student", value: Number(v.slice(8)) };
    return { type: "all" };
  };
  const pickToValue = (p: RadarPick | null): string | undefined => {
    if (!p) return undefined;
    if (p.type === "all") return "all";
    if (p.type === "class") return `class:${p.value}`;
    if (p.type === "student") return `student:${p.value}`;
    return undefined;
  };

  const columns = [
    { title: "学生", dataIndex: "user_name", key: "user_name", width: 100, render: (v: string | null) => v || "-" },
    { title: "班级", dataIndex: "class_name", key: "class_name", width: 90, render: (v: string | null) => v || "-" },
    { title: "状态", dataIndex: "status", key: "status", width: 80, render: (s: string) => { const m = statusMap[s]; return m ? <Tag color={m.color}>{m.text}</Tag> : <Tag>{s}</Tag>; } },
    { title: "得分", key: "score", width: 100, render: (_: any, r: SessionListItem) => r.earned_score != null ? `${r.earned_score}/${r.total_score}` : "-" },
    { title: "提交时间", dataIndex: "submitted_at", key: "submitted_at", width: 150, render: (v: string | null) => v ? new Date(v).toLocaleString("zh-CN") : "-" },
    { title: "操作", key: "action", width: 200, render: (_: any, r: SessionListItem) => (
      <div style={{ whiteSpace: "nowrap" }}>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r.id)}>详情</Button>
        {(r.status === "graded" || r.status === "submitted") && (
          <Button type="link" size="small" icon={<UserOutlined />} onClick={() => handleViewProfile(r.id, r.user_id)}>画像</Button>
        )}
        {(r.status === "graded" || r.status === "submitted") && (
          <Popconfirm title="允许重新测试？" onConfirm={() => handleAllowRetest(r.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" icon={<RedoOutlined />}>重测</Button>
          </Popconfirm>
        )}
      </div>
    ) },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    getCheckboxProps: (r: SessionListItem) => ({ disabled: !["graded", "submitted"].includes(r.status) }),
  };

  // 统计指标
  const statItems = stats ? [
    { icon: <TeamOutlined />, label: "参与人数", value: stats.total_students, color: "#0EA5E9" },
    { icon: <CheckCircleOutlined />, label: "已评分", value: stats.submitted_count, color: "#10B981" },
    { icon: <BarChartOutlined />, label: "平均分", value: stats.avg_score != null ? stats.avg_score.toFixed(1) : "-", color: "#6366F1" },
    { icon: <TrophyOutlined />, label: "最高分", value: stats.max_score ?? "-", color: "#F59E0B" },
    { label: "最低分", value: stats.min_score ?? "-", color: "#EF4444" },
    { label: "通过率", value: stats.pass_rate != null ? `${(stats.pass_rate * 100).toFixed(0)}%` : "-", color: "#10B981" },
  ] as { icon?: React.ReactNode; label: string; value: string | number; color: string }[] : [];

  return (
    <AdminPage scrollable>
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/assessment")}>返回</Button>
        <span className="text-xl font-semibold">{configTitle || "答题统计"}</span>
      </div>

      {loading ? (
        <div className="text-center py-20"><Spin size="large" /></div>
      ) : stats ? (
        <>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]} className="mb-6">
            {statItems.map((s, i) => (
              <Col xs={12} sm={8} md={4} key={i}>
                <div className="bg-gray-50 rounded-lg px-4 py-2.5 flex items-center justify-between">
                  <div className="text-xs text-text-tertiary">{s.icon && <span className="mr-1">{s.icon}</span>}{s.label}</div>
                  <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                </div>
              </Col>
            ))}
          </Row>

          {/* 工具栏 */}
          <div className="flex gap-2.5 mb-4 flex-wrap items-center">
            <Select placeholder="班级" allowClear style={{ width: 130 }} value={filterClass}
              onChange={v => setFilterClass(v)} options={classNames.map(c => ({ label: c, value: c }))} notFoundContent="暂无班级" />
            <Select placeholder="状态" allowClear style={{ width: 110 }} value={filterStatus}
              onChange={v => setFilterStatus(v)} options={[
                { label: "答题中", value: "in_progress" }, { label: "已提交", value: "submitted" },
                { label: "已评分", value: "graded" },
              ]} />
            <Input.Search placeholder="搜索学生" allowClear style={{ width: 180 }}
              value={searchText} onChange={e => setSearchText(e.target.value)}
              onSearch={v => setSearchValue(v.trim())} enterButton={<SearchOutlined />} />
            <div className="flex-1" />
            {filterClass && (
              <Popconfirm title={`确定让「${filterClass}」全班重新测试？`} onConfirm={() => handleBatchRetest("class")} okText="确定" cancelText="取消">
                <Button icon={<RedoOutlined />} loading={batchRetesting}>全班重测</Button>
              </Popconfirm>
            )}
            <Popconfirm title={filterClass ? `为「${filterClass}」已评分学生生成三维画像？` : "为所有已评分学生生成三维画像？"} onConfirm={handleBatchGenerateProfiles} okText="确定" cancelText="取消">
              <Button icon={<ExperimentOutlined />} loading={batchGenerating}>批量生成画像</Button>
            </Popconfirm>
            <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>导出</Button>
          </div>

          {/* 主体：表格 + 雷达图 */}
          <Row gutter={16}>
            <Col xs={24} lg={16}>
              <Card size="small" bodyStyle={{ padding: 0 }}
                title={
                  <div className="flex items-center gap-2">
                    <span>学生答题列表{total > 0 ? ` (${total})` : ""}</span>
                    {selectedRowKeys.length > 0 && (
                      <>
                        <Tag color="blue">{selectedRowKeys.length} 已选</Tag>
                        <Popconfirm title={`确定让选中的 ${selectedRowKeys.length} 名学生重新测试？`} onConfirm={() => handleBatchRetest("selection")} okText="确定" cancelText="取消">
                          <Button type="link" size="small" loading={batchRetesting}>批量重测</Button>
                        </Popconfirm>
                        <Button type="link" size="small" onClick={() => setSelectedRowKeys([])}>取消</Button>
                      </>
                    )}
                  </div>
                }
              >
                <Table rowKey="id" columns={columns} dataSource={sessions} pagination={false}
                  rowSelection={rowSelection} loading={listLoading} size="small" scroll={{ x: 700, y: 600 }} />
                {total > pageSize && (
                  <div className="text-right px-4 py-2.5">
                    <Pagination size="small" current={page} pageSize={pageSize} total={total}
                      onChange={(p, s) => { setPage(p); setSelectedRowKeys([]); if (s) setPageSize(s); }}
                      showTotal={t => `共 ${t} 条`} showSizeChanger />
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card size="small" title="知识点掌握率">
                <div className="flex gap-2 mb-2">
                  <Select size="small" className="flex-1" showSearch optionFilterProp="label"
                    value={pickToValue(radarLeft)} onChange={v => setRadarLeft(parsePickerValue(v))}
                    options={radarPickerOptions} placeholder="选择数据" />
                  <Select size="small" className="flex-1" showSearch optionFilterProp="label" allowClear
                    value={pickToValue(radarRight)} onChange={v => setRadarRight(v ? parsePickerValue(v) : null)}
                    options={radarPickerOptions} placeholder="对比" />
                </div>
                {radarSeries.length > 0 && radarSeries.some(s => Object.keys(s.data).length > 0) ? (
                  <RadarChart series={radarSeries} size={280} />
                ) : (
                  <EmptyState description="暂无知识点数据" />
                )}
              </Card>
            </Col>
          </Row>
        </>
      ) : null}

      {/* 答题详情弹窗 */}
      <Modal title="答题详情" open={detailOpen} onCancel={() => { setDetailOpen(false); setDetailData(null); }} footer={null} width={720}>
        {detailLoading ? <Spin /> : detailData ? (
          <>
            <Descriptions size="small" column={2} className="mb-4">
              <Descriptions.Item label="状态"><Tag color={statusMap[detailData.status]?.color}>{statusMap[detailData.status]?.text || detailData.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="得分">{detailData.earned_score ?? "-"} / {detailData.total_score}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{detailData.started_at ? new Date(detailData.started_at).toLocaleString("zh-CN") : "-"}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{detailData.submitted_at ? new Date(detailData.submitted_at).toLocaleString("zh-CN") : "-"}</Descriptions.Item>
            </Descriptions>
            <Collapse size="small" items={detailData.answers.map((a: AnswerDetailResponse, i: number) => ({
              key: a.id,
              label: <span>第{i + 1}题 <Tag>{a.question_type}</Tag>{a.is_correct === true && <Tag color="success">正确</Tag>}{a.is_correct === false && <Tag color="error">错误</Tag>}{a.earned_score != null && <span className="ml-2">{a.earned_score}/{a.max_score}分</span>}</span>,
              children: (
                <div className="text-sm">
                  <p><strong>题目：</strong>{a.content}</p>
                  {a.options && <p><strong>选项：</strong>{a.options}</p>}
                  <p><strong>学生答案：</strong>{a.student_answer || "（未作答）"}</p>
                  <p><strong>正确答案：</strong>{a.correct_answer}</p>
                  {a.explanation && <p><strong>解析：</strong>{a.explanation}</p>}
                  {a.ai_feedback && <p><strong>AI反馈：</strong>{a.ai_feedback}</p>}
                </div>
              ),
            }))} />
          </>
        ) : null}
      </Modal>

      {/* 画像弹窗 */}
      <Modal
        title={null}
        open={profileOpen}
        onCancel={() => { setProfileOpen(false); setProfileData(null); setAdvancedProfile(null); }}
        footer={null}
        width={720}
        styles={{ body: { padding: 0 } }}
      >
        {profileLoading ? (
          <div className="text-center py-16"><Spin size="large" /></div>
        ) : (
          <Tabs
            activeKey={profileTab}
            onChange={k => setProfileTab(k as "basic" | "advanced")}
            className="px-6"
            items={[
              { key: "basic", label: "初级画像", children: profileData ? (
                <div className="pb-6">
                  <BasicProfileView data={profileData} />
                </div>
              ) : <EmptyState description="暂无初级画像数据" /> },

              { key: "advanced", label: "三维画像", children: advancedProfile ? (
                <div className="pb-6">
                  <AdvancedProfileView profile={advancedProfile} />
                </div>
              ) : (
                <AdvancedProfileEmpty onGenerate={handleGenerateProfile} loading={generatingProfile} />
              ) },
            ]}
          />
        )}
      </Modal>
    </AdminPage>
  );
};

export default StatisticsPage;
