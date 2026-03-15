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
  for (const r of sample) {
    maxLen = Math.max(maxLen, cnLen(r?.[key]));
  }
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
  const y = base - navH - pagH - 8;
  return clamp(y, 220, 1200);
};

const XbkPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    year: 2026,
    term: "上学期",
    grade: undefined,
  });
  const [activeTab, setActiveTab] = useState<DataTabKey>("course_results");
  const [meta, setMeta] = useState<XbkMeta>({ years: [], terms: [], classes: [] });
  const [summary, setSummary] = useState<XbkSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [students, setStudents] = useState<XbkStudentRow[]>([]);
  const [courses, setCourses] = useState<XbkCourseRow[]>([]);
  const [selections, setSelections] = useState<XbkSelectionRow[]>([]);
  const [courseResults, setCourseResults] = useState<XbkCourseResultRow[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsPageSize, setStudentsPageSize] = useState(50);
  const [coursesTotal, setCoursesTotal] = useState(0);
  const [coursesPage, setCoursesPage] = useState(1);
  const [coursesPageSize, setCoursesPageSize] = useState(50);
  const [selectionsTotal, setSelectionsTotal] = useState(0);
  const [selectionsPage, setSelectionsPage] = useState(1);
  const [selectionsPageSize, setSelectionsPageSize] = useState(50);
  const [unselectedAll, setUnselectedAll] = useState<XbkStudentRow[]>([]);
  const [unselectedPage, setUnselectedPage] = useState(1);
  const [unselectedPageSize, setUnselectedPageSize] = useState(50);
  const [suspendedAll, setSuspendedAll] = useState<XbkStudentRow[]>([]);
  const [suspendedPage, setSuspendedPage] = useState(1);
  const [suspendedPageSize, setSuspendedPageSize] = useState(50);
  const [courseResultsTotal, setCourseResultsTotal] = useState(0);
  const [courseResultsPage, setCourseResultsPage] = useState(1);
  const [courseResultsPageSize, setCourseResultsPageSize] = useState(50);

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

  useLayoutEffect(() => {
    const root = tableWrapRef.current;
    if (!root) return;
    if (loading || !enabled) return;
    const ro = new ResizeObserver(() => setTableScrollY(getScrollY(root)));
    ro.observe(root);
    setTableScrollY(getScrollY(root));
    return () => ro.disconnect();
  }, [activeTab, enabled, loading]);

  const resetFilters = () => {
    setFilters({ year: 2026, term: "上学期", grade: undefined, class_name: undefined, search_text: "" });
  };

  const getErrorMsg = (e: unknown, defaultMsg: string) => {
    const detail = (e as { response?: { data?: { detail?: Array<{ msg: string }> } } })?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((err) => err.msg).join("; ");
    }
    if (typeof detail === "object") {
      return JSON.stringify(detail);
    }
    return detail || defaultMsg;
  };

  const loadMeta = useCallback(async () => {
    try {
      const res = await xbkDataApi.getMeta({ year: filters.year, term: filters.term });
      setMeta(res);
    } catch {
      setMeta({ years: [], terms: [], classes: [] });
    }
  }, [filters.term, filters.year]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await xbkDataApi.getSummary({
        year: filters.year,
        term: filters.term,
        class_name: filters.class_name,
      });
      setSummary(res);
    } catch {
      setSummary(null);
    }
  }, [filters.class_name, filters.term, filters.year]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const baseParams = {
        year: filters.year,
        term: filters.term,
        grade: filters.grade,
        class_name: filters.class_name,
        search_text: filters.search_text,
      };
      if (activeTab === "course_results") {
        const res = await xbkDataApi.listCourseResults({
          ...baseParams,
          page: courseResultsPage,
          size: courseResultsPageSize,
        });
        setCourseResults(res.items);
        setCourseResultsTotal(res.total);
        return;
      }
      if (activeTab === "students") {
        const res = await xbkDataApi.listStudents({
          ...baseParams,
          page: studentsPage,
          size: studentsPageSize,
        });
        setStudents(res.items);
        setStudentsTotal(res.total);
        return;
      }
      if (activeTab === "courses") {
        const res = await xbkDataApi.listCourses({
          year: baseParams.year,
          term: baseParams.term,
          grade: baseParams.grade,
          search_text: baseParams.search_text,
          page: coursesPage,
          size: coursesPageSize,
        });
        setCourses(res.items);
        setCoursesTotal(res.total);
        return;
      }
      if (activeTab === "unselected") {
        const res = await xbkDataApi.getStudentsWithEmptySelection({
          year: baseParams.year,
          term: baseParams.term,
          grade: baseParams.grade,
          class_name: baseParams.class_name,
        });
        setUnselectedAll(res.items || []);
        return;
      }
      if (activeTab === "suspended") {
        const res = await xbkDataApi.getStudentsWithoutSelection({
          year: baseParams.year,
          term: baseParams.term,
          grade: baseParams.grade,
          class_name: baseParams.class_name,
        });
        setSuspendedAll(res.items || []);
        return;
      }
      const res = await xbkDataApi.listSelections({
        ...baseParams,
        page: selectionsPage,
        size: selectionsPageSize,
      });
      setSelections(res.items);
      setSelectionsTotal(res.total);
    } catch (e: unknown) {
      message.error(getErrorMsg(e, "加载数据失败"));
      setStudents([]);
      setCourses([]);
      setSelections([]);
      setCourseResults([]);
      setUnselectedAll([]);
      setSuspendedAll([]);
    } finally {
      setDataLoading(false);
    }
  }, [
    activeTab,
    courseResultsPage,
    courseResultsPageSize,
    coursesPage,
    coursesPageSize,
    filters.class_name,
    filters.search_text,
    filters.term,
    filters.year,
    filters.grade,
    selectionsPage,
    selectionsPageSize,
    studentsPage,
    studentsPageSize,
  ]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const config = await xbkPublicConfigApi.get();
        if (!mounted) return;
        setEnabled(Boolean(config.enabled));
      } catch {
        if (!mounted) return;
        setEnabled(false);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    loadMeta();
  }, [enabled, loadMeta]);

  useEffect(() => {
    if (!enabled) return;
    loadSummary();
  }, [enabled, loadSummary]);

  useEffect(() => {
    if (!enabled) return;
    setStudentsPage(1);
    setCoursesPage(1);
    setSelectionsPage(1);
    setUnselectedPage(1);
    setSuspendedPage(1);
    setCourseResultsPage(1);
  }, [enabled, filters.year, filters.term, filters.grade, filters.class_name, filters.search_text]);

  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => {
      loadData();
    }, 150);
    return () => window.clearTimeout(t);
  }, [enabled, loadData]);

  const filteredUnselectedAll = useMemo(() => {
    const q = String(filters.search_text || "").trim().toLowerCase();
    if (!q) return unselectedAll;
    return unselectedAll.filter((s) => {
      const cls = String(s.class_name || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const no = String(s.student_no || "").toLowerCase();
      return cls.includes(q) || name.includes(q) || no.includes(q);
    });
  }, [filters.search_text, unselectedAll]);

  const pagedUnselected = useMemo(() => {
    const start = (unselectedPage - 1) * unselectedPageSize;
    return filteredUnselectedAll.slice(start, start + unselectedPageSize);
  }, [filteredUnselectedAll, unselectedPage, unselectedPageSize]);

  const filteredSuspendedAll = useMemo(() => {
    const q = String(filters.search_text || "").trim().toLowerCase();
    if (!q) return suspendedAll;
    return suspendedAll.filter((s) => {
      const cls = String(s.class_name || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const no = String(s.student_no || "").toLowerCase();
      return cls.includes(q) || name.includes(q) || no.includes(q);
    });
  }, [filters.search_text, suspendedAll]);

  const pagedSuspended = useMemo(() => {
    const start = (suspendedPage - 1) * suspendedPageSize;
    return filteredSuspendedAll.slice(start, start + suspendedPageSize);
  }, [filteredSuspendedAll, suspendedPage, suspendedPageSize]);

  const unselectedColumns = useMemo<ColumnsType<XbkStudentRow>>(() => {
    const rows = pagedUnselected as Array<Record<string, unknown>>;
    return [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v) => v || "-" },
      {
        title: "班级",
        dataIndex: "class_name",
        width: calcColumnWidth(rows, "class_name", "班级", 110, 180),
        ellipsis: true,
      },
      {
        title: "学号",
        dataIndex: "student_no",
        width: calcColumnWidth(rows, "student_no", "学号", 120, 170),
        ellipsis: true,
      },
      { title: "姓名", dataIndex: "name", width: calcColumnWidth(rows, "name", "姓名", 90, 130), ellipsis: true },
      { title: "性别", dataIndex: "gender", width: 70, render: (v) => v || "-" },
    ];
  }, [pagedUnselected]);

  const suspendedColumns = useMemo<ColumnsType<XbkStudentRow>>(() => {
    const rows = pagedSuspended as Array<Record<string, unknown>>;
    return [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v) => v || "-" },
      {
        title: "班级",
        dataIndex: "class_name",
        width: calcColumnWidth(rows, "class_name", "班级", 110, 180),
        ellipsis: true,
      },
      {
        title: "学号",
        dataIndex: "student_no",
        width: calcColumnWidth(rows, "student_no", "学号", 120, 170),
        ellipsis: true,
      },
      { title: "姓名", dataIndex: "name", width: calcColumnWidth(rows, "name", "姓名", 90, 130), ellipsis: true },
      { title: "性别", dataIndex: "gender", width: 70, render: (v) => v || "-" },
    ];
  }, [pagedSuspended]);

  const handleExportCurrentTable = useCallback(() => {
    (async () => {
      setExportingCurrent(true);
      try {
        const scope = activeTab as DataTabKey;
        const blob = await xbkDataApi.exportCurrentTable({
          scope,
          year: filters.year,
          term: filters.term,
          grade: filters.grade,
          class_name: filters.class_name,
          search_text: filters.search_text,
          format: "xlsx",
        });
        const filename = `xbk_${scope}_${filters.year || "all"}_${filters.term || "all"}_${filters.grade || "all"}.xlsx`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        message.success("导出成功");
      } catch (e: unknown) {
        message.error(getErrorMsg(e, "导出失败（需要管理员登录）"));
      } finally {
        setExportingCurrent(false);
      }
    })();
  }, [
    activeTab,
    filters.grade,
    filters.class_name,
    filters.search_text,
    filters.term,
    filters.year,
  ]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadMeta(), loadSummary(), loadData()]);
    message.success("已刷新");
  }, [loadData, loadMeta, loadSummary]);

  const openCreateModal = useCallback(
    (kind: "students" | "courses" | "selections") => {
      setEditKind(kind);
      setEditMode("create");
      setEditRecord(null);
      setEditVisible(true);
    },
    [],
  );

  const openEditModal = useCallback(
    (kind: "students" | "courses" | "selections", record: XbkStudentRow | XbkCourseRow | XbkSelectionRow) => {
      setEditKind(kind);
      setEditMode("edit");
      setEditRecord(record);
      setEditVisible(true);
    },
    [],
  );

  const handleDeleteRow = useCallback(
    async (kind: "students" | "courses" | "selections", id: number) => {
      try {
        if (kind === "students") await xbkDataApi.deleteStudent(id);
        else if (kind === "courses") await xbkDataApi.deleteCourse(id);
        else await xbkDataApi.deleteSelection(id);
        await Promise.all([loadMeta(), loadSummary(), loadData()]);
        message.success("删除成功");
      } catch (e: unknown) {
        message.error(getErrorMsg(e, "删除失败（需要管理员登录）"));
      }
    },
    [loadData, loadMeta, loadSummary],
  );

  const courseResultColumns = useMemo<ColumnsType<XbkCourseResultRow>>(() => {
    const rows = courseResults as Array<Record<string, unknown>>;
    return [
      {
        title: "年份",
        dataIndex: "year",
        width: calcColumnWidth(rows, "year", "年份", 70, 90),
      },
      {
        title: "学期",
        dataIndex: "term",
        width: calcColumnWidth(rows, "term", "学期", 80, 110),
      },
      {
        title: "年级",
        dataIndex: "grade",
        width: 80,
        render: (v) => v || "-",
      },
      {
        title: "课程代码",
        dataIndex: "course_code",
        width: calcColumnWidth(rows, "course_code", "课程代码", 90, 140),
        ellipsis: true,
      },
      {
        title: "课程名称",
        dataIndex: "course_name",
        width: calcColumnWidth(rows, "course_name", "课程名称", 160, 320),
        render: (v) => <span className="xbk-cell-ellipsis">{v || "-"}</span>,
        ellipsis: true,
      },
      {
        title: "班级",
        dataIndex: "class_name",
        width: calcColumnWidth(rows, "class_name", "班级", 110, 160),
        render: (v) => <span className="xbk-cell-ellipsis">{v || "-"}</span>,
        ellipsis: true,
      },
      {
        title: "学号",
        dataIndex: "student_no",
        width: calcColumnWidth(rows, "student_no", "学号", 120, 170),
        ellipsis: true,
      },
      {
        title: "姓名",
        dataIndex: "student_name",
        width: calcColumnWidth(rows, "student_name", "姓名", 90, 130),
        render: (v) => v || "-",
        ellipsis: true,
      },
      {
        title: "负责人",
        dataIndex: "teacher",
        width: calcColumnWidth(rows, "teacher", "负责人", 110, 170),
        render: (v) => v || "-",
        ellipsis: true,
      },
      {
        title: "地点",
        dataIndex: "location",
        width: calcColumnWidth(rows, "location", "地点", 140, 280),
        render: (v) => <span className="xbk-cell-ellipsis">{v || "-"}</span>,
        ellipsis: true,
      },
    ];
  }, [courseResults]);

  const studentColumns = useMemo<ColumnsType<XbkStudentRow>>(() => {
    const rows = students as Array<Record<string, unknown>>;
    const cols: ColumnsType<XbkStudentRow> = [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v) => v || "-" },
      {
        title: "班级",
        dataIndex: "class_name",
        width: calcColumnWidth(rows, "class_name", "班级", 110, 180),
        ellipsis: true,
      },
      {
        title: "学号",
        dataIndex: "student_no",
        width: calcColumnWidth(rows, "student_no", "学号", 120, 170),
        ellipsis: true,
      },
      { title: "姓名", dataIndex: "name", width: calcColumnWidth(rows, "name", "姓名", 90, 130), ellipsis: true },
      { title: "性别", dataIndex: "gender", width: 70, render: (v) => v || "-" },
    ];
    if (canEdit) {
      cols.push({
        title: "操作",
        key: "actions",
        width: 140,
        fixed: "right",
        render: (_: unknown, record: XbkStudentRow) => (
          <Space size={8}>
            <Button size="small" onClick={() => openEditModal("students", record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该学生？" onConfirm={() => handleDeleteRow("students", record.id)}>
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      });
    }
    return cols;
  }, [students, canEdit, handleDeleteRow, openEditModal]);

  const courseColumns = useMemo<ColumnsType<XbkCourseRow>>(() => {
    const rows = courses as Array<Record<string, unknown>>;
    const cols: ColumnsType<XbkCourseRow> = [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v) => v || "-" },
      {
        title: "代码",
        dataIndex: "course_code",
        width: calcColumnWidth(rows, "course_code", "代码", 80, 120),
        ellipsis: true,
      },
      {
        title: "课程名称",
        dataIndex: "course_name",
        width: calcColumnWidth(rows, "course_name", "课程名称", 180, 360),
        render: (v) => <span className="xbk-cell-ellipsis">{v || "-"}</span>,
        ellipsis: true,
      },
      {
        title: "负责人",
        dataIndex: "teacher",
        width: calcColumnWidth(rows, "teacher", "负责人", 100, 180),
        render: (v) => <span className="xbk-cell-ellipsis">{v || "-"}</span>,
        ellipsis: true,
      },
      {
        title: "限报人数",
        dataIndex: "quota",
        width: 90,
        render: (v: number) => <Tag color="orange">{Number.isFinite(v) ? v : "-"}</Tag>,
      },
      {
        title: "地点",
        dataIndex: "location",
        width: calcColumnWidth(rows, "location", "地点", 140, 320),
        render: (v) => <span className="xbk-cell-ellipsis">{v || "-"}</span>,
        ellipsis: true,
      },
    ];
    if (canEdit) {
      cols.push({
        title: "操作",
        key: "actions",
        width: 140,
        fixed: "right",
        render: (_: unknown, record: XbkCourseRow) => (
          <Space size={8}>
            <Button size="small" onClick={() => openEditModal("courses", record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该课程？" onConfirm={() => handleDeleteRow("courses", record.id)}>
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      });
    }
    return cols;
  }, [courses, canEdit, handleDeleteRow, openEditModal]);

  const selectionColumns = useMemo<ColumnsType<XbkSelectionRow>>(() => {
    const rows = selections as Array<Record<string, unknown>>;
    const cols: ColumnsType<XbkSelectionRow> = [
      { title: "年份", dataIndex: "year", width: calcColumnWidth(rows, "year", "年份", 70, 90) },
      { title: "学期", dataIndex: "term", width: calcColumnWidth(rows, "term", "学期", 80, 110) },
      { title: "年级", dataIndex: "grade", width: 80, render: (v) => v || "-" },
      { title: "学号", dataIndex: "student_no", width: calcColumnWidth(rows, "student_no", "学号", 120, 170), ellipsis: true },
      { title: "姓名", dataIndex: "name", width: calcColumnWidth(rows, "name", "姓名", 90, 130), render: (v) => v || "-", ellipsis: true },
      { title: "课程代码", dataIndex: "course_code", width: calcColumnWidth(rows, "course_code", "课程代码", 90, 140), ellipsis: true },
    ];
    if (canEdit) {
      cols.push({
        title: "操作",
        key: "actions",
        width: 140,
        fixed: "right",
        render: (_: unknown, record: XbkSelectionRow) => (
          <Space size={8}>
            <Button size="small" onClick={() => openEditModal("selections", record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该选课记录？" onConfirm={() => handleDeleteRow("selections", record.id)}>
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      });
    }
    return cols;
  }, [selections, canEdit, handleDeleteRow, openEditModal]);

  if (loading) {
    return (
      <div className="xbk-page">
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="xbk-page">
        <Result
          status="403"
          title="未开放"
          subTitle="XBK 处理系统当前未对前台开放，请联系管理员开启。"
          extra={
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              返回
            </Button>
          }
        />
      </div>
    );
  }

  const years = meta.years.length > 0 ? meta.years : [2026, 2025, 2024];

  const classes =
    meta.classes.length > 0
      ? meta.classes
      : Array.from(new Set(students.map((s) => s.class_name))).sort((a, b) =>
          a.localeCompare(b),
        );

  const kpiStudents = summary?.students ?? studentsTotal;
  const kpiCourses = summary?.courses ?? coursesTotal;
  const kpiSelections = summary?.selections ?? selectionsTotal;
  const kpiUnselected = summary?.unselected_count ?? 0;
  const kpiSuspended = summary?.suspended_count ?? 0;

  return (
    <div className="xbk-page">
      <div className="xbk-sidebar">
        <Card className="xbk-sidebar-card" title="筛选条件" bordered={false} size="small">
          <Form layout="vertical" className="xbk-filter-form">
            <Form.Item label="年份">
              <Select
                value={filters.year}
                onChange={(v) => setFilters((p) => ({ ...p, year: v }))}
                allowClear
                placeholder="选择年份"
              >
                {years.map((y) => (
                  <Option key={y} value={y}>
                    {y}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="学期">
              <Select
                value={filters.term}
                onChange={(v) => setFilters((p) => ({ ...p, term: v }))}
                allowClear
                placeholder="选择学期"
              >
                <Option value="上学期">上学期</Option>
                <Option value="下学期">下学期</Option>
              </Select>
            </Form.Item>
            <Form.Item label="年级">
              <Select
                value={filters.grade}
                onChange={(v) => setFilters((p) => ({ ...p, grade: v }))}
                allowClear
                placeholder="选择年级"
              >
                <Option value="高一">高一</Option>
                <Option value="高二">高二</Option>
              </Select>
            </Form.Item>
            <Form.Item label="班级">
              <Select
                value={filters.class_name}
                onChange={(v) => setFilters((p) => ({ ...p, class_name: v }))}
                allowClear
                placeholder="选择班级"
                showSearch
              >
                {classes.map((c) => (
                  <Option key={c} value={c}>
                    {c}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="搜索">
              <Input
                value={filters.search_text}
                placeholder="关键字搜索..."
                allowClear
                prefix={<SearchOutlined style={{ color: "var(--ws-color-text-tertiary)" }} />}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, search_text: e.target.value }))
                }
              />
            </Form.Item>
            <Button block onClick={resetFilters}>
              重置筛选
            </Button>
          </Form>
        </Card>
      </div>

      <div className="xbk-main">
        <div className="xbk-header-bar">
          <div className="xbk-actions">
            <Space wrap size={8}>
              <Button type="primary" icon={<UploadOutlined />} onClick={() => setImportVisible(true)}>
                导入
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => setExportVisible(true)}>
                导出
              </Button>
              <Tooltip title="导出当前表格页面的内容">
                <Button icon={<DownloadOutlined />} onClick={handleExportCurrentTable} loading={exportingCurrent}>
                  当前页
                </Button>
              </Tooltip>
              {canEdit && (activeTab === "students" || activeTab === "courses" || activeTab === "selections") ? (
                <Button icon={<PlusOutlined />} onClick={() => openCreateModal(activeTab)}>
                  新增
                </Button>
              ) : null}
              <Button icon={<BarChartOutlined />} onClick={() => setAnalysisVisible(true)}>
                分析
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteVisible(true)}>
                删除
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={dataLoading}>
                刷新
              </Button>
            </Space>
          </div>
          <div className="xbk-kpis">
            <div className="xbk-kpi-item">
              <span className="label">学生</span>
              <span className="value">{kpiStudents}</span>
            </div>
            <div className="xbk-kpi-item">
              <span className="label">课程</span>
              <span className="value">{kpiCourses}</span>
            </div>
            <div className="xbk-kpi-item">
              <span className="label">选课</span>
              <span className="value">{kpiSelections}</span>
            </div>
            <div className={`xbk-kpi-item ${kpiUnselected > 0 ? "warn" : ""}`}>
              <span className="label">未选</span>
              <span className="value">{kpiUnselected}</span>
            </div>
            <div className="xbk-kpi-item">
              <span className="label">休学</span>
              <span className="value">{kpiSuspended}</span>
            </div>
          </div>
        </div>

        <div ref={tableWrapRef} className="xbk-table-card">
        <Tabs
          activeKey={activeTab}
          type="card"
          className="xbk-tabs"
          onChange={(k) => {
            const key = k as DataTabKey;
            setActiveTab(key);
            if (key === "course_results") setCourseResultsPage(1);
            if (key === "students") setStudentsPage(1);
            if (key === "courses") setCoursesPage(1);
            if (key === "selections") setSelectionsPage(1);
            if (key === "unselected") setUnselectedPage(1);
            if (key === "suspended") setSuspendedPage(1);
          }}
          items={[
            {
              key: "course_results",
              label: "课程结果",
              children: (
                <Table
                  rowKey="id"
                  columns={courseResultColumns}
                  dataSource={courseResults}
                  loading={dataLoading}
                  tableLayout="fixed"
                  pagination={{
                    current: courseResultsPage,
                    pageSize: courseResultsPageSize,
                    total: courseResultsTotal,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                  onChange={(pagination) => {
                    setCourseResultsPage(pagination.current || 1);
                    setCourseResultsPageSize(pagination.pageSize || 50);
                  }}
                  size="middle"
                  scroll={{ x: "max-content", y: tableScrollY }}
                />
              ),
            },
            {
              key: "students",
              label: "学生名单",
              children: (
                <Table
                  rowKey="id"
                  columns={studentColumns}
                  dataSource={students}
                  loading={dataLoading}
                  tableLayout="fixed"
                  pagination={{
                    current: studentsPage,
                    pageSize: studentsPageSize,
                    total: studentsTotal,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                  onChange={(pagination) => {
                    setStudentsPage(pagination.current || 1);
                    setStudentsPageSize(pagination.pageSize || 50);
                  }}
                  size="middle"
                  scroll={{ x: "max-content", y: tableScrollY }}
                />
              ),
            },
            {
              key: "courses",
              label: "选课目录",
              children: (
                <Table
                  rowKey="id"
                  columns={courseColumns}
                  dataSource={courses}
                  loading={dataLoading}
                  tableLayout="fixed"
                  pagination={{
                    current: coursesPage,
                    pageSize: coursesPageSize,
                    total: coursesTotal,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                  onChange={(pagination) => {
                    setCoursesPage(pagination.current || 1);
                    setCoursesPageSize(pagination.pageSize || 50);
                  }}
                  size="middle"
                  scroll={{ x: "max-content", y: tableScrollY }}
                />
              ),
            },
            {
              key: "selections",
              label: "选课结果",
              children: (
                <Table
                  rowKey="id"
                  columns={selectionColumns}
                  dataSource={selections}
                  loading={dataLoading}
                  tableLayout="fixed"
                  pagination={{
                    current: selectionsPage,
                    pageSize: selectionsPageSize,
                    total: selectionsTotal,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                  onChange={(pagination) => {
                    setSelectionsPage(pagination.current || 1);
                    setSelectionsPageSize(pagination.pageSize || 50);
                  }}
                  size="middle"
                  scroll={{ x: "max-content", y: tableScrollY }}
                />
              ),
            },
            {
              key: "unselected",
              label: "未选课",
              children: (
                <Table
                  rowKey="id"
                  columns={unselectedColumns}
                  dataSource={pagedUnselected}
                  loading={dataLoading}
                  tableLayout="fixed"
                  pagination={{
                    current: unselectedPage,
                    pageSize: unselectedPageSize,
                    total: filteredUnselectedAll.length,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                  onChange={(pagination) => {
                    setUnselectedPage(pagination.current || 1);
                    setUnselectedPageSize(pagination.pageSize || 50);
                  }}
                  size="middle"
                  scroll={{ x: "max-content", y: tableScrollY }}
                />
              ),
            },
            {
              key: "suspended",
              label: "休学或其他",
              children: (
                <Table
                  rowKey="id"
                  columns={suspendedColumns}
                  dataSource={pagedSuspended}
                  loading={dataLoading}
                  tableLayout="fixed"
                  pagination={{
                    current: suspendedPage,
                    pageSize: suspendedPageSize,
                    total: filteredSuspendedAll.length,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                  onChange={(pagination) => {
                    setSuspendedPage(pagination.current || 1);
                    setSuspendedPageSize(pagination.pageSize || 50);
                  }}
                  size="middle"
                  scroll={{ x: "max-content", y: tableScrollY }}
                />
              ),
            },
          ]}
        />
      </div>

      <XbkImportModal
        open={importVisible}
        onCancel={() => setImportVisible(false)}
        onSuccess={async () => {
          setImportVisible(false);
          await Promise.all([loadMeta(), loadSummary(), loadData()]);
        }}
        filters={{ year: filters.year, term: filters.term, grade: filters.grade }}
      />

      <XbkExportModal
        open={exportVisible}
        onCancel={() => setExportVisible(false)}
        filters={{
          year: filters.year,
          term: filters.term,
          grade: filters.grade,
          class_name: filters.class_name,
        }}
      />

      <XbkDeleteModal
        open={deleteVisible}
        onCancel={() => setDeleteVisible(false)}
        onSuccess={async () => {
          setDeleteVisible(false);
          await Promise.all([loadMeta(), loadSummary(), loadData()]);
        }}
        filters={{
          year: filters.year,
          term: filters.term,
          grade: filters.grade,
          class_name: filters.class_name,
        }}
      />

      <XbkAnalysisModal
        open={analysisVisible}
        onCancel={() => setAnalysisVisible(false)}
        filters={{
          year: filters.year,
          term: filters.term,
          grade: filters.grade,
          class_name: filters.class_name,
        }}
      />

      <XbkEditModal
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onSuccess={async () => {
          setEditVisible(false);
          await Promise.all([loadMeta(), loadSummary(), loadData()]);
        }}
        kind={editKind}
        mode={editMode}
        targetId={editRecord?.id ?? null}
        initialValues={editRecord}
        filters={{ year: filters.year, term: filters.term, grade: filters.grade }}
        meta={meta}
      />
    </div>
  </div>
  );
};

export default XbkPage;
