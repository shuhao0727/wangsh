import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Space,
  Button,
  Result,
  Spin,
  Tag,
  Form,
  Select,
  Input,
  Tabs,
  Table,
  Popconfirm,
  message,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  UploadOutlined,
  DownloadOutlined,
  BarChartOutlined,
  ReloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { xbkDataApi, xbkPublicConfigApi } from "@services";
import useAuth from "@hooks/useAuth";
import type {
  XbkCourseRow,
  XbkCourseResultRow,
  XbkSelectionRow,
  XbkStudentRow,
  XbkMeta,
  XbkSummary,
} from "@services";
import type { ColumnsType } from "antd/es/table";
import { XbkImportModal } from "./components/XbkImportModal";
import { XbkExportModal } from "./components/XbkExportModal";
import { XbkDeleteModal } from "./components/XbkDeleteModal";
import { XbkAnalysisModal } from "./components/XbkAnalysisModal";
import { XbkEditModal } from "./components/XbkEditModal";
import "./Xbk.css";

const { Option } = Select;

type DataTabKey = "course_results" | "students" | "courses" | "selections" | "unselected" | "suspended";

type Filters = {
  year?: number;
  term?: "上学期" | "下学期";
  grade?: "高一" | "高二";
  class_name?: string;
  search_text?: string;
};

type PaginationState = { page: number; size: number; total: number };

const cnLen = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const s = String(value);
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const calcColumnWidth = (
  rows: Array<Record<string, unknown>>,
  key: string,
  title: string,
  min: number,
  max: number,
  sampleSize = 200,
) => {
  const sample = rows.slice(0, Math.max(0, sampleSize));
  let maxLen = cnLen(title);
  for (const r of sample) maxLen = Math.max(maxLen, cnLen(r?.[key]));
  return clamp(maxLen * 8 + 24, min, max);
};

const getScrollY = (root: HTMLDivElement | null) => {
  if (!root) return 360;
  const holder = root.querySelector(".ant-tabs-content-holder") as HTMLElement | null;
  const nav = root.querySelector(".ant-tabs-nav") as HTMLElement | null;
  const pagination = root.querySelector(".ant-table-pagination") as HTMLElement | null;
  const base = holder?.clientHeight || root.clientHeight;
  const navH = nav?.offsetHeight || 0;
  const pagH = pagination?.offsetHeight || 64;
  return clamp(base - navH - pagH - 8, 220, 1200);
};

const getErrorMsg = (e: unknown, defaultMsg: string) => {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((err: any) => err.msg || JSON.stringify(err)).join("; ");
  return (e as { message?: string })?.message || defaultMsg;
};

const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_PAGINATION: Record<DataTabKey, PaginationState> = {
  course_results: { page: 1, size: 50, total: 0 },
  students: { page: 1, size: 50, total: 0 },
  courses: { page: 1, size: 50, total: 0 },
  selections: { page: 1, size: 50, total: 0 },
  unselected: { page: 1, size: 50, total: 0 },
  suspended: { page: 1, size: 50, total: 0 },
};

const XbkPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [filters, setFilters] = useState<Filters>({ year: CURRENT_YEAR, term: "上学期" });
  const [activeTab, setActiveTab] = useState<DataTabKey>("course_results");
  const [meta, setMeta] = useState<XbkMeta>({ years: [], terms: [], classes: [] });
  const [summary, setSummary] = useState<XbkSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [students, setStudents] = useState<XbkStudentRow[]>([]);
  const [courses, setCourses] = useState<XbkCourseRow[]>([]);
  const [selections, setSelections] = useState<XbkSelectionRow[]>([]);
  const [courseResults, setCourseResults] = useState<XbkCourseResultRow[]>([]);
  const [unselectedAll, setUnselectedAll] = useState<XbkStudentRow[]>([]);
  const [suspendedAll, setSuspendedAll] = useState<XbkStudentRow[]>([]);

  const [pg, setPg] = useState<Record<DataTabKey, PaginationState>>({ ...DEFAULT_PAGINATION });
  const pgRef = useRef(pg);
  pgRef.current = pg;
  const updatePg = (tab: DataTabKey, partial: Partial<PaginationState>) =>
    setPg((prev) => ({ ...prev, [tab]: { ...prev[tab], ...partial } }));

  const [importVisible, setImportVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [exportingCurrent, setExportingCurrent] = useState(false);

  const canEdit = auth.isAdmin();
  const [editKind, setEditKind] = useState<"students" | "courses" | "selections">("students");
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [editRecord, setEditRecord] = useState<XbkStudentRow | XbkCourseRow | XbkSelectionRow | null>(null);

  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [tableScrollY, setTableScrollY] = useState<number>(360);
/* PLACEHOLDER_XBK_TSX_2 */

  useLayoutEffect(() => {
    const root = tableWrapRef.current;
    if (!root || loading || !enabled) return;
    const ro = new ResizeObserver(() => setTableScrollY(getScrollY(root)));
    ro.observe(root);
    setTableScrollY(getScrollY(root));
    return () => ro.disconnect();
  }, [activeTab, enabled, loading]);

  const resetFilters = () => setFilters({ year: CURRENT_YEAR, term: "上学期" });

  const loadMeta = useCallback(async () => {
    try {
      setMeta(await xbkDataApi.getMeta({ year: filters.year, term: filters.term }));
    } catch { setMeta({ years: [], terms: [], classes: [] }); }
  }, [filters.term, filters.year]);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await xbkDataApi.getSummary({ year: filters.year, term: filters.term, class_name: filters.class_name }));
    } catch { setSummary(null); }
  }, [filters.class_name, filters.term, filters.year]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    const p = pgRef.current[activeTab];
    const base = { year: filters.year, term: filters.term, grade: filters.grade, class_name: filters.class_name, search_text: filters.search_text };
    try {
      if (activeTab === "course_results") {
        const res = await xbkDataApi.listCourseResults({ ...base, page: p.page, size: p.size });
        setCourseResults(res.items); updatePg("course_results", { total: res.total });
      } else if (activeTab === "students") {
        const res = await xbkDataApi.listStudents({ ...base, page: p.page, size: p.size });
        setStudents(res.items); updatePg("students", { total: res.total });
      } else if (activeTab === "courses") {
        const res = await xbkDataApi.listCourses({ year: base.year, term: base.term, grade: base.grade, search_text: base.search_text, page: p.page, size: p.size });
        setCourses(res.items); updatePg("courses", { total: res.total });
      } else if (activeTab === "unselected") {
        const res = await xbkDataApi.getStudentsWithEmptySelection({ year: base.year, term: base.term, grade: base.grade, class_name: base.class_name });
        setUnselectedAll(res.items || []); updatePg("unselected", { total: (res.items || []).length });
      } else if (activeTab === "suspended") {
        const res = await xbkDataApi.getStudentsWithoutSelection({ year: base.year, term: base.term, grade: base.grade, class_name: base.class_name });
        setSuspendedAll(res.items || []); updatePg("suspended", { total: (res.items || []).length });
      } else {
        const res = await xbkDataApi.listSelections({ ...base, page: p.page, size: p.size });
        setSelections(res.items); updatePg("selections", { total: res.total });
      }
    } catch (e) {
      message.error(getErrorMsg(e, "加载数据失败"));
    } finally { setDataLoading(false); }
  }, [activeTab, pg[activeTab].page, pg[activeTab].size, filters.year, filters.term, filters.grade, filters.class_name, filters.search_text]);

  useEffect(() => {
    let m = true;
    (async () => {
      try { const c = await xbkPublicConfigApi.get(); if (m) setEnabled(Boolean(c.enabled)); }
      catch { if (m) setEnabled(false); }
      finally { if (m) setLoading(false); }
    })();
    return () => { m = false; };
  }, []);

  useEffect(() => { if (enabled) loadMeta(); }, [enabled, loadMeta]);
  useEffect(() => { if (enabled) loadSummary(); }, [enabled, loadSummary]);

  useEffect(() => {
    if (!enabled) return;
    setPg({ ...DEFAULT_PAGINATION });
  }, [enabled, filters.year, filters.term, filters.grade, filters.class_name, filters.search_text]);

  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(loadData, 150);
    return () => window.clearTimeout(t);
  }, [enabled, loadData]);
/* PLACEHOLDER_XBK_TSX_3 */

  const handleExportCurrentTable = useCallback(async () => {
    setExportingCurrent(true);
    try {
      const blob = await xbkDataApi.exportCurrentTable({ scope: activeTab, year: filters.year, term: filters.term, grade: filters.grade, class_name: filters.class_name, search_text: filters.search_text, format: "xlsx" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `xbk_${activeTab}_${filters.year || "all"}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch (e) { message.error(getErrorMsg(e, "导出失败")); }
    finally { setExportingCurrent(false); }
  }, [activeTab, filters]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadMeta(), loadSummary(), loadData()]);
    message.success("已刷新");
  }, [loadData, loadMeta, loadSummary]);

  const openCreateModal = useCallback((kind: "students" | "courses" | "selections") => {
    setEditKind(kind); setEditMode("create"); setEditRecord(null); setEditVisible(true);
  }, []);

  const openEditModal = useCallback((kind: "students" | "courses" | "selections", record: any) => {
    setEditKind(kind); setEditMode("edit"); setEditRecord(record); setEditVisible(true);
  }, []);

  const handleDeleteRow = useCallback(async (kind: "students" | "courses" | "selections", id: number) => {
    try {
      if (kind === "students") await xbkDataApi.deleteStudent(id);
      else if (kind === "courses") await xbkDataApi.deleteCourse(id);
      else await xbkDataApi.deleteSelection(id);
      await Promise.all([loadMeta(), loadSummary(), loadData()]);
      message.success("删除成功");
    } catch (e) { message.error(getErrorMsg(e, "删除失败")); }
  }, [loadData, loadMeta, loadSummary]);

  const makeActionCol = useCallback((kind: "students" | "courses" | "selections") => ({
    title: "操作", key: "actions", width: 140, fixed: "right" as const,
    render: (_: unknown, record: any) => (
      <Space size={8}>
        <Button size="small" onClick={() => openEditModal(kind, record)}>编辑</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteRow(kind, record.id)}>
          <Button size="small" danger>删除</Button>
        </Popconfirm>
      </Space>
    ),
  }), [handleDeleteRow, openEditModal]);
/* PLACEHOLDER_XBK_TSX_4 */

  const courseResultColumns = useMemo<ColumnsType<XbkCourseResultRow>>(() => {
    const rows = courseResults as unknown as Array<Record<string, unknown>>;
    return [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v: any) => v || "-" },
      { title: "课程代码", dataIndex: "course_code", width: calcColumnWidth(rows, "course_code", "课程代码", 90, 140), ellipsis: true },
      { title: "课程名称", dataIndex: "course_name", width: calcColumnWidth(rows, "course_name", "课程名称", 160, 320), ellipsis: true, render: (v: any) => <span className="xbk-cell-ellipsis">{v || "-"}</span> },
      { title: "班级", dataIndex: "class_name", width: calcColumnWidth(rows, "class_name", "班级", 110, 160), ellipsis: true },
      { title: "学号", dataIndex: "student_no", width: calcColumnWidth(rows, "student_no", "学号", 120, 170), ellipsis: true },
      { title: "姓名", dataIndex: "student_name", width: calcColumnWidth(rows, "student_name", "姓名", 90, 130), ellipsis: true, render: (v: any) => v || "-" },
      { title: "负责人", dataIndex: "teacher", width: calcColumnWidth(rows, "teacher", "负责人", 110, 170), ellipsis: true, render: (v: any) => v || "-" },
      { title: "地点", dataIndex: "location", width: calcColumnWidth(rows, "location", "地点", 140, 280), ellipsis: true, render: (v: any) => <span className="xbk-cell-ellipsis">{v || "-"}</span> },
    ];
  }, [courseResults]);

  const studentColumns = useMemo<ColumnsType<XbkStudentRow>>(() => {
    const rows = students as unknown as Array<Record<string, unknown>>;
    const cols: ColumnsType<XbkStudentRow> = [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v: any) => v || "-" },
      { title: "班级", dataIndex: "class_name", width: calcColumnWidth(rows, "class_name", "班级", 110, 180), ellipsis: true },
      { title: "学号", dataIndex: "student_no", width: calcColumnWidth(rows, "student_no", "学号", 120, 170), ellipsis: true },
      { title: "姓名", dataIndex: "name", width: calcColumnWidth(rows, "name", "姓名", 90, 130), ellipsis: true },
      { title: "性别", dataIndex: "gender", width: 70, render: (v: any) => v || "-" },
    ];
    if (canEdit) cols.push(makeActionCol("students"));
    return cols;
  }, [students, canEdit, makeActionCol]);

  const courseColumns = useMemo<ColumnsType<XbkCourseRow>>(() => {
    const rows = courses as unknown as Array<Record<string, unknown>>;
    const cols: ColumnsType<XbkCourseRow> = [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v: any) => v || "-" },
      { title: "代码", dataIndex: "course_code", width: calcColumnWidth(rows, "course_code", "代码", 80, 120), ellipsis: true },
      { title: "课程名称", dataIndex: "course_name", width: calcColumnWidth(rows, "course_name", "课程名称", 180, 360), ellipsis: true, render: (v: any) => <span className="xbk-cell-ellipsis">{v || "-"}</span> },
      { title: "负责人", dataIndex: "teacher", width: calcColumnWidth(rows, "teacher", "负责人", 100, 180), ellipsis: true, render: (v: any) => <span className="xbk-cell-ellipsis">{v || "-"}</span> },
      { title: "限报", dataIndex: "quota", width: 80, render: (v: number) => <Tag color="orange">{Number.isFinite(v) ? v : "-"}</Tag> },
      { title: "地点", dataIndex: "location", width: calcColumnWidth(rows, "location", "地点", 140, 320), ellipsis: true, render: (v: any) => <span className="xbk-cell-ellipsis">{v || "-"}</span> },
    ];
    if (canEdit) cols.push(makeActionCol("courses"));
    return cols;
  }, [courses, canEdit, makeActionCol]);

  const selectionColumns = useMemo<ColumnsType<XbkSelectionRow>>(() => {
    const rows = selections as unknown as Array<Record<string, unknown>>;
    const cols: ColumnsType<XbkSelectionRow> = [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v: any) => v || "-" },
      { title: "学号", dataIndex: "student_no", width: calcColumnWidth(rows, "student_no", "学号", 120, 170), ellipsis: true },
      { title: "姓名", dataIndex: "name", width: calcColumnWidth(rows, "name", "姓名", 90, 130), ellipsis: true, render: (v: any) => v || "-" },
      { title: "课程代码", dataIndex: "course_code", width: calcColumnWidth(rows, "course_code", "课程代码", 90, 140), ellipsis: true },
    ];
    if (canEdit) cols.push(makeActionCol("selections"));
    return cols;
  }, [selections, canEdit, makeActionCol]);

  const unselectedColumns = useMemo<ColumnsType<XbkStudentRow>>(() => {
    const rows = unselectedAll as unknown as Array<Record<string, unknown>>;
    return [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v: any) => v || "-" },
      { title: "班级", dataIndex: "class_name", width: calcColumnWidth(rows, "class_name", "班级", 110, 180), ellipsis: true },
      { title: "学号", dataIndex: "student_no", width: calcColumnWidth(rows, "student_no", "学号", 120, 170), ellipsis: true },
      { title: "姓名", dataIndex: "name", width: calcColumnWidth(rows, "name", "姓名", 90, 130), ellipsis: true },
      { title: "性别", dataIndex: "gender", width: 70, render: (v: any) => v || "-" },
    ];
  }, [unselectedAll]);

  const suspendedColumns = useMemo<ColumnsType<XbkStudentRow>>(() => {
    const rows = suspendedAll as unknown as Array<Record<string, unknown>>;
    return [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v: any) => v || "-" },
      { title: "班级", dataIndex: "class_name", width: calcColumnWidth(rows, "class_name", "班级", 110, 180), ellipsis: true },
      { title: "学号", dataIndex: "student_no", width: calcColumnWidth(rows, "student_no", "学号", 120, 170), ellipsis: true },
      { title: "姓名", dataIndex: "name", width: calcColumnWidth(rows, "name", "姓名", 90, 130), ellipsis: true },
      { title: "性别", dataIndex: "gender", width: 70, render: (v: any) => v || "-" },
    ];
  }, [suspendedAll]);
/* PLACEHOLDER_XBK_TSX_5 */

  if (loading) return <div className="xbk-page"><div style={{ textAlign: "center", padding: "80px 0" }}><Spin size="large" /></div></div>;
  if (!enabled) return <div className="xbk-page"><Result status="403" title="未开放" subTitle="XBK 处理系统当前未对前台开放，请联系管理员开启。" extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>} /></div>;

  const years = meta.years.length > 0 ? meta.years : [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
  const classes = meta.classes.length > 0 ? meta.classes : Array.from(new Set(students.map((s) => s.class_name))).sort();
  const kpiStudents = summary?.students ?? 0;
  const kpiCourses = summary?.courses ?? 0;
  const kpiSelections = summary?.selections ?? 0;
  const kpiUnselected = summary?.unselected_count ?? 0;
  const kpiSuspended = summary?.suspended_count ?? 0;

  const renderTable = (tab: DataTabKey) => {
    const p = pg[tab];
    const map: Record<DataTabKey, { columns: any; data: any; rowKey: string }> = {
      course_results: { columns: courseResultColumns, data: courseResults, rowKey: "id" },
      students: { columns: studentColumns, data: students, rowKey: "id" },
      courses: { columns: courseColumns, data: courses, rowKey: "id" },
      selections: { columns: selectionColumns, data: selections, rowKey: "id" },
      unselected: { columns: unselectedColumns, data: unselectedAll, rowKey: "id" },
      suspended: { columns: suspendedColumns, data: suspendedAll, rowKey: "id" },
    };
    const { columns, data, rowKey } = map[tab];
    return (
      <Table rowKey={rowKey} columns={columns} dataSource={data} loading={dataLoading} tableLayout="fixed"
        pagination={{ current: p.page, pageSize: p.size, total: p.total, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }}
        onChange={(pag) => updatePg(tab, { page: pag.current || 1, size: pag.pageSize || 50 })}
        size="middle" scroll={{ x: "max-content", y: tableScrollY }}
      />
    );
  };

  return (
    <div className="xbk-page">
      <div className="xbk-sidebar">
        <Card className="xbk-sidebar-card" title="筛选条件" bordered={false} size="small">
          <Form layout="vertical" className="xbk-filter-form">
            <Form.Item label="年份">
              <Select value={filters.year} onChange={(v) => setFilters((p) => ({ ...p, year: v }))} allowClear placeholder="选择年份">
                {years.map((y) => <Option key={y} value={y}>{y}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="学期">
              <Select value={filters.term} onChange={(v) => setFilters((p) => ({ ...p, term: v }))} allowClear placeholder="选择学期">
                <Option value="上学期">上学期</Option>
                <Option value="下学期">下学期</Option>
              </Select>
            </Form.Item>
            <Form.Item label="年级">
              <Select value={filters.grade} onChange={(v) => setFilters((p) => ({ ...p, grade: v }))} allowClear placeholder="选择年级">
                <Option value="高一">高一</Option>
                <Option value="高二">高二</Option>
              </Select>
            </Form.Item>
            <Form.Item label="班级">
              <Select value={filters.class_name} onChange={(v) => setFilters((p) => ({ ...p, class_name: v }))} allowClear placeholder="选择班级" showSearch>
                {classes.map((c) => <Option key={c} value={c}>{c}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="搜索">
              <Input value={filters.search_text} placeholder="关键字搜索..." allowClear prefix={<SearchOutlined style={{ color: "var(--ws-color-text-tertiary)" }} />} onChange={(e) => setFilters((p) => ({ ...p, search_text: e.target.value }))} />
            </Form.Item>
            <Button block onClick={resetFilters}>重置筛选</Button>
          </Form>
        </Card>
      </div>

      <div className="xbk-main">
        <div className="xbk-header-bar">
          <div className="xbk-header-row">
            <div className="xbk-kpis">
              <div className="xbk-kpi-item"><span className="label">学生</span><span className="value">{kpiStudents}</span></div>
              <div className="xbk-kpi-item"><span className="label">课程</span><span className="value">{kpiCourses}</span></div>
              <div className="xbk-kpi-item"><span className="label">选课</span><span className="value">{kpiSelections}</span></div>
              <div className={`xbk-kpi-item ${kpiUnselected > 0 ? "warn" : ""}`}><span className="label">未选</span><span className="value">{kpiUnselected}</span></div>
              <div className="xbk-kpi-item"><span className="label">休学</span><span className="value">{kpiSuspended}</span></div>
            </div>
            <Space size={8} wrap>
              <Button icon={<UploadOutlined />} onClick={() => setImportVisible(true)}>导入</Button>
              <Button icon={<DownloadOutlined />} onClick={() => setExportVisible(true)}>导出</Button>
              <Tooltip title="导出当前表格页面的内容">
                <Button icon={<DownloadOutlined />} onClick={handleExportCurrentTable} loading={exportingCurrent}>当前页</Button>
              </Tooltip>
              {canEdit && (activeTab === "students" || activeTab === "courses" || activeTab === "selections") && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal(activeTab)}>新增</Button>
              )}
              <Button icon={<BarChartOutlined />} onClick={() => setAnalysisVisible(true)}>分析</Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteVisible(true)}>删除</Button>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={dataLoading}>刷新</Button>
            </Space>
          </div>
        </div>

        <div ref={tableWrapRef} className="xbk-table-card">
          <Tabs activeKey={activeTab} type="card" className="xbk-tabs"
            onChange={(k) => { setActiveTab(k as DataTabKey); updatePg(k as DataTabKey, { page: 1 }); }}
            items={[
              { key: "course_results", label: "选课总表", children: renderTable("course_results") },
              { key: "students", label: "学生名册", children: renderTable("students") },
              { key: "courses", label: "课程目录", children: renderTable("courses") },
              { key: "selections", label: "选课记录", children: renderTable("selections") },
              { key: "unselected", label: "未选课", children: renderTable("unselected") },
              { key: "suspended", label: "休学/其他", children: renderTable("suspended") },
            ]}
          />
        </div>

        <XbkImportModal open={importVisible} onCancel={() => setImportVisible(false)} onSuccess={async () => { setImportVisible(false); await Promise.all([loadMeta(), loadSummary(), loadData()]); }} filters={{ year: filters.year, term: filters.term, grade: filters.grade }} />
        <XbkExportModal open={exportVisible} onCancel={() => setExportVisible(false)} filters={{ year: filters.year, term: filters.term, grade: filters.grade, class_name: filters.class_name }} />
        <XbkDeleteModal open={deleteVisible} onCancel={() => setDeleteVisible(false)} onSuccess={async () => { setDeleteVisible(false); await Promise.all([loadMeta(), loadSummary(), loadData()]); }} filters={{ year: filters.year, term: filters.term, grade: filters.grade, class_name: filters.class_name }} />
        <XbkAnalysisModal open={analysisVisible} onCancel={() => setAnalysisVisible(false)} filters={{ year: filters.year, term: filters.term, grade: filters.grade, class_name: filters.class_name }} />
        <XbkEditModal open={editVisible} onCancel={() => setEditVisible(false)} onSuccess={async () => { setEditVisible(false); await Promise.all([loadMeta(), loadSummary(), loadData()]); }} kind={editKind} mode={editMode} targetId={editRecord?.id ?? null} initialValues={editRecord} filters={{ year: filters.year, term: filters.term, grade: filters.grade }} meta={meta} />
      </div>
    </div>
  );
};

export default XbkPage;
