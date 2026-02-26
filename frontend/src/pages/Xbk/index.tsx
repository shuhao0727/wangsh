import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Typography,
  Space,
  Button,
  Result,
  Spin,
  Tag,
  Form,
  Select,
  Input,
  InputNumber,
  Row,
  Col,
  Tabs,
  Table,
  Modal,
  Popconfirm,
  Statistic,
  Upload,
  Checkbox,
  Alert,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  UploadOutlined,
  DownloadOutlined,
  BarChartOutlined,
  ReloadOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { xbkDataApi, xbkPublicConfigApi } from "@services";
import useAuth from "@hooks/useAuth";
import type {
  XbkCourseRow,
  XbkCourseResultRow,
  XbkSelectionRow,
  XbkStudentRow,
  XbkScope,
  XbkExportType,
  XbkMeta,
  XbkImportPreview,
  XbkImportResult,
  XbkSummary,
  XbkCourseStatItem,
  XbkClassStatItem,
} from "@services";
import type { ColumnsType } from "antd/es/table";
import "./Xbk.css";

const { Text } = Typography;
const { Option } = Select;

type DataTabKey = "course_results" | "students" | "courses" | "selections" | "no_selection";

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
  rows: any[],
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
  const [noSelectionAll, setNoSelectionAll] = useState<XbkStudentRow[]>([]);
  const [noSelectionPage, setNoSelectionPage] = useState(1);
  const [noSelectionPageSize, setNoSelectionPageSize] = useState(50);
  const [courseResultsTotal, setCourseResultsTotal] = useState(0);
  const [courseResultsPage, setCourseResultsPage] = useState(1);
  const [courseResultsPageSize, setCourseResultsPageSize] = useState(50);
  const [importVisible, setImportVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteType, setDeleteType] = useState<"all" | "students" | "courses" | "selections">("all");
  const [importScope, setImportScope] = useState<XbkScope>("students");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<XbkImportPreview | null>(null);
  const [importResult, setImportResult] = useState<XbkImportResult | null>(null);
  const [exportType, setExportType] = useState<XbkExportType>("course-selection");
  const [exportYearStart, setExportYearStart] = useState<number | undefined>(undefined);
  const [exportYearEnd, setExportYearEnd] = useState<number | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingCurrent, setExportingCurrent] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<XbkSummary | null>(null);
  const [analysisCourseStats, setAnalysisCourseStats] = useState<XbkCourseStatItem[]>([]);
  const [analysisClassStats, setAnalysisClassStats] = useState<XbkClassStatItem[]>([]);
  const [analysisNoSelection, setAnalysisNoSelection] = useState<XbkStudentRow[]>([]);
  const [analysisTab, setAnalysisTab] = useState<"overview" | "courses" | "classes" | "no_selection">("overview");
  const [analysisCourseQuery, setAnalysisCourseQuery] = useState("");
  const [analysisStudentQuery, setAnalysisStudentQuery] = useState("");
  const canEdit = auth.isAdmin();
  const [editVisible, setEditVisible] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editKind, setEditKind] = useState<"students" | "courses" | "selections">("students");
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [editForm] = Form.useForm();
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

  const getErrorMsg = (e: any, defaultMsg: string) => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((err: any) => err.msg).join("; ");
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
      if (activeTab === "no_selection") {
        const res = await xbkDataApi.getStudentsWithoutSelection({
          year: baseParams.year,
          term: baseParams.term,
          grade: baseParams.grade,
          class_name: baseParams.class_name,
        });
        setNoSelectionAll(res.items || []);
        return;
      }
      const res = await xbkDataApi.listSelections({
        ...baseParams,
        page: selectionsPage,
        size: selectionsPageSize,
      });
      setSelections(res.items);
      setSelectionsTotal(res.total);
    } catch (e: any) {
      message.error(getErrorMsg(e, "加载数据失败"));
      setStudents([]);
      setCourses([]);
      setSelections([]);
      setCourseResults([]);
      setNoSelectionAll([]);
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
    setNoSelectionPage(1);
    setCourseResultsPage(1);
  }, [enabled, filters.year, filters.term, filters.grade, filters.class_name, filters.search_text]);

  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => {
      loadData();
    }, 150);
    return () => window.clearTimeout(t);
  }, [enabled, loadData]);

  useEffect(() => {
    if (!analysisVisible) return;
    (async () => {
      setAnalysisTab("overview");
      setAnalysisCourseQuery("");
      setAnalysisStudentQuery("");
      setAnalysisLoading(true);
      try {
        const params = {
          year: filters.year,
          term: filters.term,
          grade: filters.grade,
          class_name: filters.class_name,
        };
        const [summary, courseStatsRes, classStatsRes, noSelRes] =
          await Promise.all([
            xbkDataApi.getSummary(params),
            xbkDataApi.getCourseStats(params),
            xbkDataApi.getClassStats(params),
            xbkDataApi.getStudentsWithoutSelection(params),
          ]);
        setAnalysisSummary(summary);
        setAnalysisCourseStats(courseStatsRes.items || []);
        setAnalysisClassStats(classStatsRes.items || []);
        setAnalysisNoSelection(noSelRes.items || []);
      } catch (e: any) {
        message.error(getErrorMsg(e, "加载分析数据失败"));
        setAnalysisSummary(null);
        setAnalysisCourseStats([]);
        setAnalysisClassStats([]);
        setAnalysisNoSelection([]);
      } finally {
        setAnalysisLoading(false);
      }
    })();
  }, [analysisVisible, filters.year, filters.term, filters.grade, filters.class_name]);

  const filteredAnalysisCourseStats = useMemo(() => {
    const q = analysisCourseQuery.trim().toLowerCase();
    if (!q) return analysisCourseStats;
    return analysisCourseStats.filter((it) => {
      const code = String(it.course_code || "").toLowerCase();
      const name = String(it.course_name || "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [analysisCourseQuery, analysisCourseStats]);

  const filteredAnalysisNoSelection = useMemo(() => {
    const q = analysisStudentQuery.trim().toLowerCase();
    if (!q) return analysisNoSelection;
    return analysisNoSelection.filter((s) => {
      const cls = String(s.class_name || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const no = String(s.student_no || "").toLowerCase();
      return cls.includes(q) || name.includes(q) || no.includes(q);
    });
  }, [analysisNoSelection, analysisStudentQuery]);

  const filteredNoSelectionAll = useMemo(() => {
    const q = String(filters.search_text || "").trim().toLowerCase();
    if (!q) return noSelectionAll;
    return noSelectionAll.filter((s) => {
      const cls = String(s.class_name || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const no = String(s.student_no || "").toLowerCase();
      return cls.includes(q) || name.includes(q) || no.includes(q);
    });
  }, [filters.search_text, noSelectionAll]);

  const pagedNoSelection = useMemo(() => {
    const start = (noSelectionPage - 1) * noSelectionPageSize;
    return filteredNoSelectionAll.slice(start, start + noSelectionPageSize);
  }, [filteredNoSelectionAll, noSelectionPage, noSelectionPageSize]);

  const analysisCourseColumns: ColumnsType<any> = useMemo(
    () => [
      {
        title: "课程",
        dataIndex: "course",
        render: (_: any, r: any) => (
          <Text>
            {r.course_code} · {r.course_name || "-"}
          </Text>
        ),
      },
      {
        title: "人数",
        dataIndex: "count",
        width: 120,
        align: "right",
        render: (v: any, r: any) =>
          typeof r.allowed_total === "number" && r.allowed_total > 0 ? (
            <Tag color={r.count > r.allowed_total ? "red" : "orange"}>
              {r.count}/{r.allowed_total}
            </Tag>
          ) : (
            <Tag color="orange">{v}</Tag>
          ),
      },
    ],
    [],
  );

  const analysisClassColumns: ColumnsType<any> = useMemo(
    () => [
      { title: "班级", dataIndex: "class_name" },
      {
        title: "人数",
        dataIndex: "count",
        width: 120,
        align: "right",
        render: (v: any) => <Tag color="orange">{v}</Tag>,
      },
    ],
    [],
  );

  const analysisNoSelectionColumns: ColumnsType<any> = useMemo(
    () => [
      { title: "班级", dataIndex: "class_name", width: 140, ellipsis: true },
      { title: "学号", dataIndex: "student_no", width: 140, ellipsis: true },
      { title: "姓名", dataIndex: "name", width: 120, ellipsis: true },
    ],
    [],
  );

  const noSelectionColumns = useMemo<ColumnsType<XbkStudentRow>>(() => {
    const rows = pagedNoSelection as any[];
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
  }, [pagedNoSelection]);

  const handleExportCurrentTable = useCallback(() => {
    (async () => {
      setExportingCurrent(true);
      try {
        const scope =
          activeTab === "course_results"
            ? "course_results"
            : activeTab === "no_selection"
              ? "no_selection"
              : activeTab;
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
      } catch (e: any) {
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

  const runImportPreview = useCallback(async (file: File, scope: XbkScope) => {
    setImportPreviewLoading(true);
    try {
      const res = await xbkDataApi.previewImport({
        scope,
        year: filters.year,
        term: filters.term,
        grade: filters.grade,
        file,
      });
      setImportPreview(res);
      setImportResult(null);
    } catch (e: any) {
      setImportPreview(null);
      setImportResult(null);
      message.error(getErrorMsg(e, "预检失败（需要管理员登录）"));
    } finally {
      setImportPreviewLoading(false);
    }
  }, [filters.term, filters.year, filters.grade]);

  useEffect(() => {
    if (!importVisible) return;
    if (!importFile) {
      setImportPreview(null);
      setImportResult(null);
      return;
    }
    runImportPreview(importFile, importScope);
  }, [importFile, importScope, importVisible, runImportPreview]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadMeta(), loadSummary(), loadData()]);
    message.success("已刷新");
  }, [loadData, loadMeta, loadSummary]);

  const openCreateModal = useCallback(
    (kind: "students" | "courses" | "selections") => {
      setEditKind(kind);
      setEditMode("create");
      setEditTargetId(null);
      setEditVisible(true);
      editForm.resetFields();
      const base = { year: filters.year, term: filters.term, grade: filters.grade };
      if (kind === "students") {
        editForm.setFieldsValue({ ...base, class_name: filters.class_name });
      } else {
        editForm.setFieldsValue(base);
      }
    },
    [editForm, filters.class_name, filters.grade, filters.term, filters.year],
  );

  const openEditModal = useCallback(
    (kind: "students" | "courses" | "selections", record: any) => {
      setEditKind(kind);
      setEditMode("edit");
      setEditTargetId(record?.id ?? null);
      setEditVisible(true);
      editForm.setFieldsValue(record);
    },
    [editForm],
  );

  const handleEditOk = useCallback(async () => {
    setEditSaving(true);
    try {
      const values = await editForm.validateFields();
      if (editKind === "students") {
        if (editMode === "create") {
          await xbkDataApi.createStudent(values);
        } else if (editTargetId != null) {
          await xbkDataApi.updateStudent(editTargetId, values);
        }
      } else if (editKind === "courses") {
        const payload = { ...values, quota: Number(values.quota || 0) };
        if (editMode === "create") {
          await xbkDataApi.createCourse(payload);
        } else if (editTargetId != null) {
          await xbkDataApi.updateCourse(editTargetId, payload);
        }
      } else {
        if (editMode === "create") {
          await xbkDataApi.createSelection(values);
        } else if (editTargetId != null) {
          await xbkDataApi.updateSelection(editTargetId, values);
        }
      }
      setEditVisible(false);
      await Promise.all([loadMeta(), loadSummary(), loadData()]);
      message.success("保存成功");
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(getErrorMsg(e, "保存失败（需要管理员登录）"));
    } finally {
      setEditSaving(false);
    }
  }, [editForm, editKind, editMode, editTargetId, loadData, loadMeta, loadSummary]);

  const handleDeleteRow = useCallback(
    async (kind: "students" | "courses" | "selections", id: number) => {
      try {
        if (kind === "students") await xbkDataApi.deleteStudent(id);
        else if (kind === "courses") await xbkDataApi.deleteCourse(id);
        else await xbkDataApi.deleteSelection(id);
        await Promise.all([loadMeta(), loadSummary(), loadData()]);
        message.success("删除成功");
      } catch (e: any) {
        message.error(getErrorMsg(e, "删除失败（需要管理员登录）"));
      }
    },
    [loadData, loadMeta, loadSummary],
  );

  const courseResultColumns = useMemo<ColumnsType<XbkCourseResultRow>>(() => {
    const rows = courseResults as any[];
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
        render: (v) => v || "-",
        ellipsis: true,
      },
      {
        title: "班级",
        dataIndex: "class_name",
        width: calcColumnWidth(rows, "class_name", "班级", 110, 160),
        render: (v) => v || "-",
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
        render: (v) => v || "-",
        ellipsis: true,
      },
    ];
  }, [courseResults]);

  const studentColumns = useMemo<ColumnsType<XbkStudentRow>>(() => {
    const rows = students as any[];
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
        render: (_: any, record: XbkStudentRow) => (
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
    const rows = courses as any[];
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
        ellipsis: true,
      },
      {
        title: "负责人",
        dataIndex: "teacher",
        width: calcColumnWidth(rows, "teacher", "负责人", 100, 180),
        render: (v) => v || "-",
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
        render: (v) => v || "-",
        ellipsis: true,
      },
    ];
    if (canEdit) {
      cols.push({
        title: "操作",
        key: "actions",
        width: 140,
        fixed: "right",
        render: (_: any, record: XbkCourseRow) => (
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
    const rows = selections as any[];
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
        render: (_: any, record: XbkSelectionRow) => (
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

  const years =
    meta.years.length > 0 ? meta.years : [2026, 2025, 2024];

  const classes =
    meta.classes.length > 0
      ? meta.classes
      : Array.from(new Set(students.map((s) => s.class_name))).sort((a, b) =>
          a.localeCompare(b),
        );

  const kpiStudents = summary?.students ?? studentsTotal;
  const kpiCourses = summary?.courses ?? coursesTotal;
  const kpiSelections = summary?.selections ?? selectionsTotal;
  const kpiNoSelection = summary?.no_selection_students ?? 0;

  const handleDeleteConfirm = async () => {
    try {
      const scope = deleteType === "all" ? "all" : deleteType;
      const res = await xbkDataApi.deleteData({
        scope,
        year: filters.year,
        term: filters.term,
        grade: filters.grade,
        class_name: filters.class_name,
      });
      message.success(`删除完成，共 ${res.deleted} 条`);
      setDeleteVisible(false);
      await Promise.all([loadMeta(), loadSummary(), loadData()]);
    } catch (e: any) {
      message.error(getErrorMsg(e, "删除失败（需要管理员登录）"));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await xbkDataApi.downloadTemplate({ scope: importScope, grade: filters.grade });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xbk_${importScope}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      message.error(getErrorMsg(e, "下载模板失败（需要管理员登录）"));
    }
  };

  const handleImportConfirm = async () => {
    if (!importFile) {
      message.warning("请选择要导入的 Excel 文件");
      return;
    }
    setImporting(true);
    try {
      const res = await xbkDataApi.importData({
        scope: importScope,
        year: filters.year,
        term: filters.term,
        grade: filters.grade,
        skip_invalid: skipInvalid,
        file: importFile,
      });
      setImportResult(res);
      message.success(
        `导入完成：处理 ${res.processed} 行（新增 ${res.inserted}，更新 ${res.updated}，无效 ${res.invalid}）`,
      );
      await Promise.all([loadMeta(), loadSummary(), loadData()]);
    } catch (e: any) {
      message.error(getErrorMsg(e, "导入失败（需要管理员登录）"));
    } finally {
      setImporting(false);
    }
  };

  const handleExportConfirm = async () => {
    if (!exportYearStart || !exportYearEnd) {
      message.warning("请填写学年（起止年份）");
      return;
    }
    if (!Number.isInteger(exportYearStart) || !Number.isInteger(exportYearEnd)) {
      message.warning("学年必须为整数年份");
      return;
    }
    if (exportYearStart < 2000 || exportYearStart > 2100 || exportYearEnd < 2000 || exportYearEnd > 2100) {
      message.warning("学年年份范围不正确（建议填写4位年份，如 2025-2026）");
      return;
    }
    if (exportYearEnd <= exportYearStart) {
      message.warning("学年结束年份必须大于开始年份");
      return;
    }
    if (exportType === "distribution" && !filters.grade) {
      message.warning("请先选择年级（用于各班分发表表头）");
      return;
    }
    setExporting(true);
    try {
      const blob = await xbkDataApi.exportTables({
        export_type: exportType,
        year: filters.year || 2026,
        term: filters.term || "上学期",
        grade: filters.grade,
        class_name: filters.class_name,
        yearStart: exportYearStart,
        yearEnd: exportYearEnd,
      });
      const filename = `xbk_${exportType}_${filters.year || "all"}_${filters.term || "all"}_${filters.grade || "all"}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setExportVisible(false);
      message.success("导出成功");
    } catch (e: any) {
      message.error(getErrorMsg(e, "导出失败（需要管理员登录）"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="xbk-page">
      <div className="xbk-filter-card" style={{ padding: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Form layout="inline" style={{ width: "100%" }}>
              <Form.Item label="年份">
                <Select
                  value={filters.year}
                  style={{ width: 120 }}
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
                  style={{ width: 120 }}
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
                  style={{ width: 100 }}
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
                  style={{ width: 170 }}
                  onChange={(v) => setFilters((p) => ({ ...p, class_name: v }))}
                  allowClear
                  placeholder="选择班级"
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
                  style={{ width: 280 }}
                  placeholder="学号/姓名/课程代码/课程名称…"
                  allowClear
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, search_text: e.target.value }))
                  }
                />
              </Form.Item>
            </Form>
          </Col>
          <Col className="xbk-filter-actions">
            <Space>
              <Button onClick={resetFilters}>重置</Button>
            </Space>
          </Col>
        </Row>
      </div>

      <div className="xbk-toolbar" style={{ marginTop: 16, padding: 14 }}>
        <div className="xbk-toolbar-left">
          <Space wrap>
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setImportVisible(true)}>
              导入数据
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => setExportVisible(true)}>
              导出数据
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExportCurrentTable} loading={exportingCurrent}>
              导出当前表格
            </Button>
            {canEdit && (activeTab === "students" || activeTab === "courses" || activeTab === "selections") ? (
              <Button icon={<PlusOutlined />} onClick={() => openCreateModal(activeTab)}>
                新增
              </Button>
            ) : null}
            <Button icon={<BarChartOutlined />} onClick={() => setAnalysisVisible(true)}>
              数据分析
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteVisible(true)}>
              删除数据
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={dataLoading}>
              刷新
            </Button>
          </Space>
        </div>
        <div className="xbk-kpis-inline">
          <div className="xbk-kpi-row xbk-kpi-inline-row xbk-kpi-accent">
            <span className="xbk-kpi-label">学生数</span>
            <span className="xbk-kpi-value">{kpiStudents}</span>
          </div>
          <div className="xbk-kpi-row xbk-kpi-inline-row">
            <span className="xbk-kpi-label">课程数</span>
            <span className="xbk-kpi-value">{kpiCourses}</span>
          </div>
          <div className="xbk-kpi-row xbk-kpi-inline-row">
            <span className="xbk-kpi-label">选课条目</span>
            <span className="xbk-kpi-value">{kpiSelections}</span>
          </div>
          <div className="xbk-kpi-row xbk-kpi-inline-row">
            <span className="xbk-kpi-label">未选课学生</span>
            <span className="xbk-kpi-value">{kpiNoSelection}</span>
          </div>
        </div>
      </div>

      <div ref={tableWrapRef} className="xbk-table-card" style={{ marginTop: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => {
            const key = k as DataTabKey;
            setActiveTab(key);
            if (key === "course_results") setCourseResultsPage(1);
            if (key === "students") setStudentsPage(1);
            if (key === "courses") setCoursesPage(1);
            if (key === "selections") setSelectionsPage(1);
            if (key === "no_selection") setNoSelectionPage(1);
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
              key: "no_selection",
              label: "未选课学生",
              children: (
                <Table
                  rowKey="id"
                  columns={noSelectionColumns}
                  dataSource={pagedNoSelection}
                  loading={dataLoading}
                  tableLayout="fixed"
                  pagination={{
                    current: noSelectionPage,
                    pageSize: noSelectionPageSize,
                    total: filteredNoSelectionAll.length,
                    showSizeChanger: true,
                  }}
                  onChange={(pagination) => {
                    setNoSelectionPage(pagination.current || 1);
                    setNoSelectionPageSize(pagination.pageSize || 50);
                  }}
                  size="middle"
                  scroll={{ x: "max-content", y: tableScrollY }}
                />
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={
          editKind === "students"
            ? editMode === "create"
              ? "新增学生"
              : "编辑学生"
            : editKind === "courses"
              ? editMode === "create"
                ? "新增课程"
                : "编辑课程"
              : editMode === "create"
                ? "新增选课记录"
                : "编辑选课记录"
        }
        open={editVisible}
        forceRender
        confirmLoading={editSaving}
        onCancel={() => setEditVisible(false)}
        onOk={handleEditOk}
        okText="保存"
        okButtonProps={{ disabled: !canEdit }}
      >
        <Form form={editForm} layout="vertical">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="year" label="年份" rules={[{ required: true, message: "请输入年份" }]}>
                <InputNumber style={{ width: "100%" }} min={2000} max={2100} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="term" label="学期" rules={[{ required: true, message: "请选择学期" }]}>
                <Select
                  options={(meta.terms?.length ? meta.terms : ["上学期", "下学期"]).map((t) => ({
                    value: t,
                    label: t,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="grade" label="年级">
                <Select
                  allowClear
                  options={[
                    { value: "高一", label: "高一" },
                    { value: "高二", label: "高二" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          {editKind === "students" ? (
            <>
              <Form.Item name="class_name" label="班级" rules={[{ required: true, message: "请输入班级" }]}>
                <Input placeholder="如：高二(1)班" />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="student_no" label="学号" rules={[{ required: true, message: "请输入学号" }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="gender" label="性别">
                <Select
                  allowClear
                  options={[
                    { value: "男", label: "男" },
                    { value: "女", label: "女" },
                  ]}
                />
              </Form.Item>
            </>
          ) : editKind === "courses" ? (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="course_code" label="课程代码" rules={[{ required: true, message: "请输入课程代码" }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="quota" label="限报人数" rules={[{ required: true, message: "请输入限报人数" }]}>
                    <InputNumber style={{ width: "100%" }} min={0} max={999} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="course_name" label="课程名称" rules={[{ required: true, message: "请输入课程名称" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="teacher" label="课程负责人">
                <Input />
              </Form.Item>
              <Form.Item name="location" label="上课地点">
                <Input />
              </Form.Item>
            </>
          ) : (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="student_no" label="学号" rules={[{ required: true, message: "请输入学号" }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="name" label="姓名">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="course_code" label="课程代码" rules={[{ required: true, message: "请输入课程代码" }]}>
                <Input />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title="导入数据"
        open={importVisible}
        confirmLoading={importing}
        onCancel={() => {
          setImportVisible(false);
          setImportFile(null);
          setImportPreview(null);
          setImportResult(null);
        }}
        onOk={handleImportConfirm}
        okText="导入"
        okButtonProps={{
          disabled:
            !importFile ||
            importPreviewLoading ||
            (importPreview ? importPreview.valid_rows === 0 : false),
        }}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <div>
            <Text style={{ marginRight: 10 }}>导入类型</Text>
            <Select value={importScope} style={{ width: 140 }} onChange={(v) => setImportScope(v)}>
              <Option value="students">学生名单</Option>
              <Option value="courses">选课目录</Option>
              <Option value="selections">选课结果</Option>
            </Select>
            <Text style={{ marginLeft: 16, marginRight: 10 }}>所属年级</Text>
            <Select
              value={filters.grade}
              style={{ width: 100 }}
              placeholder="选择年级"
              allowClear
              onChange={(v) => setFilters((p) => ({ ...p, grade: v }))}
            >
              <Option value="高一">高一</Option>
              <Option value="高二">高二</Option>
            </Select>
            <Button style={{ marginLeft: 16 }} onClick={handleDownloadTemplate}>
              下载模板
            </Button>
          </div>
          <Upload
            maxCount={1}
            beforeUpload={(file) => {
              setImportFile(file);
              return false;
            }}
            onRemove={() => {
              setImportFile(null);
              setImportPreview(null);
              setImportResult(null);
            }}
          >
            <Button icon={<UploadOutlined />}>选择Excel文件</Button>
          </Upload>
          <Checkbox checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)}>
            跳过错误行并继续导入
          </Checkbox>

          {importPreviewLoading ? (
            <Alert message="正在预检文件…" type="info" showIcon />
          ) : importPreview ? (
            <Alert
              type={importPreview.invalid_rows > 0 ? "warning" : "success"}
              showIcon
              message={`共 ${importPreview.total_rows} 行：可导入 ${importPreview.valid_rows} 行，错误 ${importPreview.invalid_rows} 行`}
              description={
                importPreview.invalid_rows > 0 ? (
                  <div>
                    {importPreview.errors.slice(0, 5).map((e) => (
                      <div key={e.row}>
                        第 {e.row} 行：{e.errors.join("；")}
                      </div>
                    ))}
                    {importPreview.errors.length > 5 && (
                      <div>…更多错误请修正后重新预检</div>
                    )}
                  </div>
                ) : (
                  <div>预检通过</div>
                )
              }
            />
          ) : null}

          {importPreview?.preview?.length ? (
            <Card size="small" styles={{ body: { padding: 0 } }}>
              <Table
                rowKey={(_, idx) => String(idx)}
                size="small"
                pagination={false}
                columns={(importPreview.columns || []).slice(0, 12).map((c) => ({
                  title: c,
                  dataIndex: c,
                  ellipsis: true,
                }))}
                dataSource={importPreview.preview}
                scroll={{ x: 900 }}
              />
            </Card>
          ) : null}

          {importResult ? (
            <Alert
              type="success"
              showIcon
              message={`导入完成：处理 ${importResult.processed} 行（新增 ${importResult.inserted}，更新 ${importResult.updated}，无效 ${importResult.invalid}）`}
            />
          ) : null}
          <Text type="secondary">
            会优先使用你当前筛选的 年份/学期/年级 作为默认值（Excel里也可包含“年份/学期/年级”列）。
          </Text>
          <Text type="secondary">
            字段要求：学生名单（年份、学期、年级、班级、学号、姓名、性别）｜选课目录（年份、学期、年级、课程代码、课程名称、课程负责人、限报人数、上课地点）｜选课结果（年份、学期、年级、学号、姓名、课程代码）
          </Text>
        </Space>
      </Modal>

      <Modal
        title="导出数据"
        open={exportVisible}
        confirmLoading={exporting}
        onCancel={() => {
          setExportVisible(false);
          setExportYearStart(undefined);
          setExportYearEnd(undefined);
        }}
        onOk={handleExportConfirm}
        okText="导出"
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <div>
            <Text style={{ marginRight: 10 }}>导出类型</Text>
            <Select value={exportType} style={{ width: 220 }} onChange={(v) => setExportType(v)}>
              <Option value="course-selection">学生选课表</Option>
              <Option value="teacher-distribution">教师分发表</Option>
              <Option value="distribution">各班分发表</Option>
            </Select>
          </div>
          <div>
            <Text style={{ marginRight: 10 }}>学年</Text>
            <InputNumber
              placeholder="起"
              style={{ width: 110 }}
              value={exportYearStart}
              min={2000}
              max={2100}
              precision={0}
              onChange={(v) => setExportYearStart(typeof v === "number" ? v : undefined)}
            />
            <Text style={{ margin: "0 8px" }}>-</Text>
            <InputNumber
              placeholder="止"
              style={{ width: 110 }}
              value={exportYearEnd}
              min={2000}
              max={2100}
              precision={0}
              onChange={(v) => setExportYearEnd(typeof v === "number" ? v : undefined)}
            />
          </div>
          <Text type="secondary">
            将按当前筛选导出：{filters.year || "全部年份"} · {filters.term || "全部学期"} ·{" "}
            {filters.grade || "全部年级"}
            {filters.class_name ? ` · ${filters.class_name}` : ""}
          </Text>
          <Text type="secondary">学期将按当前筛选的学期写入导出文件标题。</Text>
          <Text type="secondary">示例：学年填 2025-2026。</Text>
        </Space>
      </Modal>

      <Modal
        title="删除数据（彻底删除）"
        open={deleteVisible}
        onCancel={() => setDeleteVisible(false)}
        onOk={handleDeleteConfirm}
        okButtonProps={{ danger: true }}
        okText="确认删除"
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="该操作为物理删除，不可恢复"
            description="删除“学生名单/选课目录”时会同时删除其关联的选课结果，避免出现孤立数据。"
          />
          <Text type="secondary">
            将按当前筛选条件删除数据：{filters.year || "全部年份"} ·{" "}
            {filters.term || "全部学期"} · {filters.grade || "全部年级"}
          </Text>
          <div>
            <Text style={{ marginRight: 10 }}>删除范围</Text>
            <Select value={deleteType} style={{ width: 220 }} onChange={(v) => setDeleteType(v)}>
              <Option value="all">全部</Option>
              <Option value="students">学生名单</Option>
              <Option value="courses">选课目录</Option>
              <Option value="selections">选课结果</Option>
            </Select>
          </div>
        </Space>
      </Modal>

      <Modal
        title="数据分析"
        open={analysisVisible}
        onCancel={() => setAnalysisVisible(false)}
        footer={[
          <Button key="close" onClick={() => setAnalysisVisible(false)}>
            关闭
          </Button>,
        ]}
        width={980}
      >
        {analysisLoading ? (
          <div style={{ padding: "56px 0", textAlign: "center" }}>
            <Spin />
          </div>
        ) : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Text type="secondary">
              当前筛选：{filters.year || "全部年份"} · {filters.term || "全部学期"} · {filters.grade || "全部年级"}
              {filters.class_name ? ` · ${filters.class_name}` : ""}
            </Text>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}>
                <Card size="small">
                  <Statistic title="学生数" value={analysisSummary?.students ?? 0} />
                </Card>
              </Col>
              <Col xs={24} md={6}>
                <Card size="small">
                  <Statistic title="课程数" value={analysisSummary?.courses ?? 0} />
                </Card>
              </Col>
              <Col xs={24} md={6}>
                <Card size="small">
                  <Statistic title="选课条目" value={analysisSummary?.selections ?? 0} />
                </Card>
              </Col>
              <Col xs={24} md={6}>
                <Card size="small">
                  <Statistic title="未选课学生" value={analysisNoSelection.length} />
                </Card>
              </Col>
            </Row>

            <Tabs
              activeKey={analysisTab}
              onChange={(k) => setAnalysisTab(k as any)}
              items={[
                {
                  key: "overview",
                  label: "概览",
                  children: (
                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={12}>
                        <Text strong>课程统计（按课程代码）</Text>
                        <div style={{ marginTop: 8 }}>
                          <Table
                            rowKey="course_code"
                            size="small"
                            columns={analysisCourseColumns}
                            dataSource={analysisCourseStats}
                            pagination={false}
                            scroll={{ y: 420 }}
                          />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <Text strong>班级统计</Text>
                        <div style={{ marginTop: 8 }}>
                          <Table
                            rowKey="class_name"
                            size="small"
                            columns={analysisClassColumns}
                            dataSource={analysisClassStats}
                            pagination={false}
                            scroll={{ y: 420 }}
                          />
                        </div>
                      </Col>
                    </Row>
                  ),
                },
                {
                  key: "courses",
                  label: "课程统计",
                  children: (
                    <Space direction="vertical" size={10} style={{ width: "100%" }}>
                      <Input
                        placeholder="搜索课程代码/名称"
                        allowClear
                        value={analysisCourseQuery}
                        onChange={(e) => setAnalysisCourseQuery(e.target.value)}
                      />
                      <Table
                        rowKey="course_code"
                        size="small"
                        columns={analysisCourseColumns}
                        dataSource={filteredAnalysisCourseStats}
                        pagination={false}
                        scroll={{ y: 520 }}
                      />
                    </Space>
                  ),
                },
                {
                  key: "classes",
                  label: "班级统计",
                  children: (
                    <Table
                      rowKey="class_name"
                      size="small"
                      columns={analysisClassColumns}
                      dataSource={analysisClassStats}
                      pagination={false}
                      scroll={{ y: 560 }}
                    />
                  ),
                },
                {
                  key: "no_selection",
                  label: `未选课学生 (${analysisNoSelection.length})`,
                  children: (
                    <Space direction="vertical" size={10} style={{ width: "100%" }}>
                      <Input
                        placeholder="搜索班级/姓名/学号"
                        allowClear
                        value={analysisStudentQuery}
                        onChange={(e) => setAnalysisStudentQuery(e.target.value)}
                      />
                      <Table
                        rowKey="id"
                        size="small"
                        columns={analysisNoSelectionColumns}
                        dataSource={filteredAnalysisNoSelection}
                        pagination={false}
                        scroll={{ y: 520 }}
                      />
                    </Space>
                  ),
                },
              ]}
            />
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default XbkPage;
