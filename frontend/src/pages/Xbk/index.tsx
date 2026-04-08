import { showMessage } from "@/lib/toast";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type ColumnDef as TanStackColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  BarChart3,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { XbkTab } from "./types";
import { useXbkFilters } from "./hooks/useXbkFilters";
import { useXbkPagination, DEFAULT_PAGINATION } from "./hooks/useXbkPagination";
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
import { XbkImportModal } from "./components/XbkImportModal";
import { XbkExportModal } from "./components/XbkExportModal";
import { XbkDeleteModal } from "./components/XbkDeleteModal";
import { XbkAnalysisModal } from "./components/XbkAnalysisModal";
import { XbkEditModal } from "./components/XbkEditModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { calcColumnWidth } from "../../utils/table";
import "./Xbk.css";
import { PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";
import { formatXbkClassName, sortXbkClassNames } from "./className";

const FILTER_ALL = "__all__";
const CURRENT_YEAR = new Date().getFullYear();

const calcAutoColWidth = <T,>(
  rows: T[],
  key: keyof T | string,
  title: string,
  min: number,
  max: number,
) =>
  calcColumnWidth(
    rows as Array<Record<string, unknown>>,
    String(key),
    title,
    min,
    max,
  );

const calcClassColWidth = <
  T extends { grade?: string | null; class_name?: string | null },
>(
  rows: T[],
  min: number,
  max: number,
) =>
  calcColumnWidth(
    rows.map((row) => ({
      class_display: formatXbkClassName(row.grade, row.class_name),
    })),
    "class_display",
    "班级",
    min,
    max,
  );

type DataTabKey = XbkTab;

type ColumnDef<T> = {
  title: React.ReactNode;
  dataIndex?: keyof T | string;
  key?: string;
  width?: number;
  ellipsis?: boolean;
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
};

type RowKey<T> = string | ((record: T) => string);

type TableConfig<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: RowKey<T>;
};

type LegacyConfigDataTableProps<T extends Record<string, unknown>> = {
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: RowKey<T>;
  loading?: boolean;
};

const LegacyConfigDataTable = <T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  loading = false,
}: LegacyConfigDataTableProps<T>) => {
  const tableColumns = useMemo<TanStackColumnDef<T>[]>(
    () =>
      columns.map((col, index) => ({
        id: String(col.key || col.dataIndex || index),
        header: () => col.title,
        size: typeof col.width === "number" ? col.width : undefined,
        accessorFn: (record: T) => readValue(record, col.dataIndex as string | undefined),
        meta: col.ellipsis ? { cellClassName: "max-w-0 overflow-hidden" } : undefined,
        cell: ({ row }) => {
          const value = readValue(row.original, col.dataIndex as string | undefined);
          const rendered = col.render
            ? col.render(value, row.original, row.index)
            : value === null || value === undefined || value === ""
              ? "-"
              : String(value);
          if (col.ellipsis && !col.render) {
            return <span className="xbk-cell-ellipsis">{rendered}</span>;
          }
          return rendered;
        },
      })),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (record, index) =>
      typeof rowKey === "function"
        ? rowKey(record)
        : String(record[rowKey as keyof T] ?? index),
  });

  return (
    <DataTable
      table={table}
      className="h-full xbk-data-table"
      tableClassName="xbk-table-native min-w-max"
      emptyState={
        loading ? (
          <div className="py-10 text-center text-sm text-text-tertiary">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载...
            </span>
          </div>
        ) : undefined
      }
    />
  );
};

const tabLabels: Record<DataTabKey, string> = {
  course_results: "选课总表",
  students: "学生名册",
  courses: "课程目录",
  selections: "选课记录",
  unselected: "未选课",
  suspended: "休学/其他",
};

const getErrorMsg = (e: unknown, defaultMsg: string) => {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((err: any) => err.msg || JSON.stringify(err)).join("; ");
  }
  return (e as { message?: string })?.message || defaultMsg;
};

const readValue = (record: Record<string, unknown>, dataIndex?: string) => {
  if (!dataIndex) return undefined;
  return record[dataIndex];
};

const toText = (value: unknown) =>
  value === null || value === undefined || value === ""
    ? "-"
    : String(value);

const XbkPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const { filters, setFilters } = useXbkFilters();
  const { pg, setPg, updatePg } = useXbkPagination();
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

  const [importVisible, setImportVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [exportingCurrent, setExportingCurrent] = useState(false);

  const canEdit = auth.isAdmin();
  const [editKind, setEditKind] = useState<
    "students" | "courses" | "selections"
  >("students");
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [editRecord, setEditRecord] = useState<
    XbkStudentRow | XbkCourseRow | XbkSelectionRow | null
  >(null);

  const resetFilters = () => setFilters({ year: CURRENT_YEAR, term: "上学期" });

  const loadMeta = useCallback(async () => {
    try {
      const nextMeta = await xbkDataApi.getMeta({
        year: filters.year,
        term: filters.term,
        grade: filters.grade,
      });
      setMeta(nextMeta);
    } catch {
      setMeta({ years: [], terms: [], classes: [] });
    }
  }, [filters.grade, filters.term, filters.year]);

  const loadSummary = useCallback(async () => {
    try {
      const nextSummary = await xbkDataApi.getSummary({
        year: filters.year,
        term: filters.term,
        class_name: filters.class_name,
      });
      setSummary(nextSummary);
    } catch {
      setSummary(null);
    }
  }, [filters.class_name, filters.term, filters.year]);

  const loadData = useCallback(async (tab: DataTabKey, page: number, size: number) => {
    setDataLoading(true);
    const base = {
      year: filters.year,
      term: filters.term,
      grade: filters.grade,
      class_name: filters.class_name,
      search_text: filters.search_text,
    };
    try {
      if (tab === "course_results") {
        const res = await xbkDataApi.listCourseResults({
          ...base,
          page,
          size,
        });
        setCourseResults(res.items);
        updatePg("course_results", { total: res.total });
      } else if (tab === "students") {
        const res = await xbkDataApi.listStudents({
          ...base,
          page,
          size,
        });
        setStudents(res.items);
        updatePg("students", { total: res.total });
      } else if (tab === "courses") {
        const res = await xbkDataApi.listCourses({
          year: base.year,
          term: base.term,
          grade: base.grade,
          search_text: base.search_text,
          page,
          size,
        });
        setCourses(res.items);
        updatePg("courses", { total: res.total });
      } else if (tab === "unselected") {
        const res = await xbkDataApi.getStudentsWithEmptySelection({
          year: base.year,
          term: base.term,
          grade: base.grade,
          class_name: base.class_name,
        });
        const items = res.items || [];
        setUnselectedAll(items);
        updatePg("unselected", { total: items.length });
      } else if (tab === "suspended") {
        const res = await xbkDataApi.getStudentsWithoutSelection({
          year: base.year,
          term: base.term,
          grade: base.grade,
          class_name: base.class_name,
        });
        const items = res.items || [];
        setSuspendedAll(items);
        updatePg("suspended", { total: items.length });
      } else {
        const res = await xbkDataApi.listSelections({
          ...base,
          page,
          size,
        });
        setSelections(res.items);
        updatePg("selections", { total: res.total });
      }
    } catch (e) {
      showMessage.error(getErrorMsg(e, "加载数据失败"));
    } finally {
      setDataLoading(false);
    }
  }, [
    filters.year,
    filters.term,
    filters.grade,
    filters.class_name,
    filters.search_text,
    updatePg,
  ]);

  const activePage = pg[activeTab].page;
  const activePageSize = pg[activeTab].size;

  const reloadCurrentData = useCallback(
    async () => loadData(activeTab, activePage, activePageSize),
    [activePage, activePageSize, activeTab, loadData],
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const cfg = await xbkPublicConfigApi.get();
        if (mounted) setEnabled(Boolean(cfg.enabled));
      } catch {
        if (mounted) setEnabled(false);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (enabled) void loadMeta();
  }, [enabled, loadMeta]);

  useEffect(() => {
    if (enabled) void loadSummary();
  }, [enabled, loadSummary]);

  useEffect(() => {
    if (!enabled) return;
    setPg({ ...DEFAULT_PAGINATION });
  }, [
    enabled,
    filters.year,
    filters.term,
    filters.grade,
    filters.class_name,
    filters.search_text,
    setPg,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      void reloadCurrentData();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [enabled, reloadCurrentData]);

  const handleExportCurrentTable = useCallback(async () => {
    setExportingCurrent(true);
    try {
      const blob = await xbkDataApi.exportCurrentTable({
        scope: activeTab,
        year: filters.year,
        term: filters.term,
        grade: filters.grade,
        class_name: filters.class_name,
        search_text: filters.search_text,
        format: "xlsx",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `xbk_${activeTab}_${filters.year || "all"}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      showMessage.success("导出成功");
    } catch (e) {
      showMessage.error(getErrorMsg(e, "导出失败"));
    } finally {
      setExportingCurrent(false);
    }
  }, [activeTab, filters]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadMeta(), loadSummary(), reloadCurrentData()]);
    showMessage.success("已刷新");
  }, [loadMeta, loadSummary, reloadCurrentData]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        void handleRefresh();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        e.preventDefault();
        setImportVisible(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        setExportVisible(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleRefresh]);

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
    (kind: "students" | "courses" | "selections", record: any) => {
      const isVirtualSelection = kind === "selections" && Number(record?.id || 0) <= 0;
      setEditKind(kind);
      setEditMode(isVirtualSelection ? "create" : "edit");
      if (isVirtualSelection) {
        const next = {
          ...record,
          course_code:
            record?.course_code === "休学或其他" || record?.course_code === "未选"
              ? ""
              : record?.course_code,
        };
        setEditRecord(next);
      } else {
        setEditRecord(record);
      }
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
        await Promise.all([loadMeta(), loadSummary(), reloadCurrentData()]);
        showMessage.success("删除成功");
      } catch (e) {
        showMessage.error(getErrorMsg(e, "删除失败"));
      }
    },
    [loadMeta, loadSummary, reloadCurrentData],
  );

  const makeActionCol = useCallback(
    (
      kind: "students" | "courses" | "selections",
    ): ColumnDef<XbkStudentRow | XbkCourseRow | XbkSelectionRow> => ({
      title: "操作",
      key: "actions",
      render: (_: unknown, record: any) => {
        const isVirtualSelection = kind === "selections" && Number(record?.id || 0) <= 0;
        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => openEditModal(kind, record)}
            >
              {isVirtualSelection ? "补录" : "编辑"}
            </Button>
            {!isVirtualSelection ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-destructive hover:text-destructive"
                onClick={() => {
                  if (!window.confirm("确认删除？")) return;
                  void handleDeleteRow(kind, record.id);
                }}
              >
                删除
              </Button>
            ) : null}
          </div>
        );
      },
    }),
    [handleDeleteRow, openEditModal],
  );

  const courseResultColumns = useMemo<ColumnDef<XbkCourseResultRow>[]>(() => {
    const yearWidth = calcAutoColWidth(courseResults, "year", "年份", 80, 140);
    const termWidth = calcAutoColWidth(courseResults, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(courseResults, "grade", "年级", 88, 150);
    const classWidth = calcClassColWidth(courseResults, 120, 280);
    const studentNoWidth = calcAutoColWidth(courseResults, "student_no", "学号", 110, 240);
    const studentNameWidth = calcAutoColWidth(courseResults, "student_name", "姓名", 100, 220);
    const courseCodeWidth = calcAutoColWidth(courseResults, "course_code", "课程代码", 110, 260);
    const courseNameWidth = calcAutoColWidth(courseResults, "course_name", "课程名称", 140, 420);
    const teacherWidth = calcAutoColWidth(courseResults, "teacher", "负责人", 100, 280);
    const locationWidth = calcAutoColWidth(courseResults, "location", "地点", 120, 360);

    return [
      { title: "年份", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      { title: "年级", dataIndex: "grade", width: gradeWidth, render: (v) => toText(v) },
      {
        title: "课程代码",
        dataIndex: "course_code",
        width: courseCodeWidth,
        ellipsis: true,
      },
      {
        title: "课程名称",
        dataIndex: "course_name",
        width: courseNameWidth,
        ellipsis: true,
        render: (v) => <span className="xbk-cell-ellipsis">{(v as string) || "-"}</span>,
      },
      {
        title: "班级",
        dataIndex: "class_name",
        width: classWidth,
        ellipsis: true,
        render: (_value, record) => formatXbkClassName(record.grade, record.class_name),
      },
      {
        title: "学号",
        dataIndex: "student_no",
        width: studentNoWidth,
        ellipsis: true,
      },
      {
        title: "姓名",
        dataIndex: "student_name",
        width: studentNameWidth,
        ellipsis: true,
        render: (v) => toText(v),
      },
      {
        title: "负责人",
        dataIndex: "teacher",
        width: teacherWidth,
        ellipsis: true,
        render: (v) => toText(v),
      },
      {
        title: "地点",
        dataIndex: "location",
        width: locationWidth,
        ellipsis: true,
        render: (v) => <span className="xbk-cell-ellipsis">{(v as string) || "-"}</span>,
      },
    ];
  }, [courseResults]);

  const studentColumns = useMemo<ColumnDef<XbkStudentRow>[]>(() => {
    const yearWidth = calcAutoColWidth(students, "year", "年份", 80, 140);
    const termWidth = calcAutoColWidth(students, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(students, "grade", "年级", 88, 150);
    const classWidth = calcClassColWidth(students, 120, 280);
    const studentNoWidth = calcAutoColWidth(students, "student_no", "学号", 110, 240);
    const studentNameWidth = calcAutoColWidth(students, "name", "姓名", 100, 220);
    const genderWidth = calcAutoColWidth(students, "gender", "性别", 80, 140);

    const cols: ColumnDef<XbkStudentRow>[] = [
      { title: "年份", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      { title: "年级", dataIndex: "grade", width: gradeWidth, render: (v) => toText(v) },
      {
        title: "班级",
        dataIndex: "class_name",
        width: classWidth,
        ellipsis: true,
        render: (_value, record) => formatXbkClassName(record.grade, record.class_name),
      },
      {
        title: "学号",
        dataIndex: "student_no",
        width: studentNoWidth,
        ellipsis: true,
      },
      {
        title: "姓名",
        dataIndex: "name",
        width: studentNameWidth,
        ellipsis: true,
      },
      { title: "性别", dataIndex: "gender", width: genderWidth, render: (v) => toText(v) },
    ];
    if (canEdit) cols.push(makeActionCol("students") as ColumnDef<XbkStudentRow>);
    return cols;
  }, [canEdit, makeActionCol, students]);

  const courseColumns = useMemo<ColumnDef<XbkCourseRow>[]>(() => {
    const yearWidth = calcAutoColWidth(courses, "year", "年份", 80, 140);
    const termWidth = calcAutoColWidth(courses, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(courses, "grade", "年级", 88, 150);
    const courseCodeWidth = calcAutoColWidth(courses, "course_code", "代码", 110, 260);
    const courseNameWidth = calcAutoColWidth(courses, "course_name", "课程名称", 160, 360);
    const teacherWidth = calcAutoColWidth(courses, "teacher", "负责人", 100, 280);
    const quotaWidth = calcAutoColWidth(courses, "quota", "限报", 80, 140);
    const locationWidth = calcAutoColWidth(courses, "location", "地点", 120, 360);

    const cols: ColumnDef<XbkCourseRow>[] = [
      { title: "年份", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      { title: "年级", dataIndex: "grade", width: gradeWidth, render: (v) => toText(v) },
      {
        title: "代码",
        dataIndex: "course_code",
        width: courseCodeWidth,
        ellipsis: true,
      },
      {
        title: "课程名称",
        dataIndex: "course_name",
        width: courseNameWidth,
        ellipsis: true,
        render: (v) => <span className="xbk-cell-ellipsis">{(v as string) || "-"}</span>,
      },
      {
        title: "负责人",
        dataIndex: "teacher",
        width: teacherWidth,
        ellipsis: true,
        render: (v) => <span className="xbk-cell-ellipsis">{(v as string) || "-"}</span>,
      },
      {
        title: "限报",
        dataIndex: "quota",
        width: quotaWidth,
        render: (v) => (
          <span className="inline-flex rounded-full bg-[var(--ws-color-warning-soft)] px-2 py-0.5 text-xs font-medium text-[var(--ws-color-warning)]">
            {Number.isFinite(v as number) ? (v as number) : "-"}
          </span>
        ),
      },
      {
        title: "地点",
        dataIndex: "location",
        width: locationWidth,
        ellipsis: true,
        render: (v) => <span className="xbk-cell-ellipsis">{(v as string) || "-"}</span>,
      },
    ];
    if (canEdit) cols.push(makeActionCol("courses") as ColumnDef<XbkCourseRow>);
    return cols;
  }, [canEdit, courses, makeActionCol]);

  const selectionColumns = useMemo<ColumnDef<XbkSelectionRow>[]>(() => {
    const yearWidth = calcAutoColWidth(selections, "year", "年份", 80, 140);
    const termWidth = calcAutoColWidth(selections, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(selections, "grade", "年级", 88, 150);
    const studentNoWidth = calcAutoColWidth(selections, "student_no", "学号", 110, 240);
    const studentNameWidth = calcAutoColWidth(selections, "name", "姓名", 100, 220);
    const courseCodeWidth = calcAutoColWidth(selections, "course_code", "课程代码", 110, 260);

    const cols: ColumnDef<XbkSelectionRow>[] = [
      { title: "年份", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      { title: "年级", dataIndex: "grade", width: gradeWidth, render: (v) => toText(v) },
      {
        title: "学号",
        dataIndex: "student_no",
        width: studentNoWidth,
        ellipsis: true,
      },
      {
        title: "姓名",
        dataIndex: "name",
        width: studentNameWidth,
        ellipsis: true,
        render: (v) => toText(v),
      },
      {
        title: "课程代码",
        dataIndex: "course_code",
        width: courseCodeWidth,
        ellipsis: true,
      },
    ];
    if (canEdit) cols.push(makeActionCol("selections") as ColumnDef<XbkSelectionRow>);
    return cols;
  }, [canEdit, makeActionCol, selections]);

  const unselectedColumns = useMemo<ColumnDef<XbkStudentRow>[]>(() => {
    const yearWidth = calcAutoColWidth(unselectedAll, "year", "年份", 80, 140);
    const termWidth = calcAutoColWidth(unselectedAll, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(unselectedAll, "grade", "年级", 88, 150);
    const classWidth = calcClassColWidth(unselectedAll, 120, 280);
    const studentNoWidth = calcAutoColWidth(unselectedAll, "student_no", "学号", 110, 240);
    const studentNameWidth = calcAutoColWidth(unselectedAll, "name", "姓名", 100, 220);
    const genderWidth = calcAutoColWidth(unselectedAll, "gender", "性别", 80, 140);

    return [
      { title: "年份", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      { title: "年级", dataIndex: "grade", width: gradeWidth, render: (v) => toText(v) },
      {
        title: "班级",
        dataIndex: "class_name",
        width: classWidth,
        ellipsis: true,
        render: (_value, record) => formatXbkClassName(record.grade, record.class_name),
      },
      {
        title: "学号",
        dataIndex: "student_no",
        width: studentNoWidth,
        ellipsis: true,
      },
      {
        title: "姓名",
        dataIndex: "name",
        width: studentNameWidth,
        ellipsis: true,
      },
      { title: "性别", dataIndex: "gender", width: genderWidth, render: (v) => toText(v) },
    ];
  }, [unselectedAll]);

  const suspendedColumns = useMemo<ColumnDef<XbkStudentRow>[]>(() => {
    const yearWidth = calcAutoColWidth(suspendedAll, "year", "年份", 80, 140);
    const termWidth = calcAutoColWidth(suspendedAll, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(suspendedAll, "grade", "年级", 88, 150);
    const classWidth = calcClassColWidth(suspendedAll, 120, 280);
    const studentNoWidth = calcAutoColWidth(suspendedAll, "student_no", "学号", 110, 240);
    const studentNameWidth = calcAutoColWidth(suspendedAll, "name", "姓名", 100, 220);
    const genderWidth = calcAutoColWidth(suspendedAll, "gender", "性别", 80, 140);

    return [
      { title: "年份", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      { title: "年级", dataIndex: "grade", width: gradeWidth, render: (v) => toText(v) },
      {
        title: "班级",
        dataIndex: "class_name",
        width: classWidth,
        ellipsis: true,
        render: (_value, record) => formatXbkClassName(record.grade, record.class_name),
      },
      {
        title: "学号",
        dataIndex: "student_no",
        width: studentNoWidth,
        ellipsis: true,
      },
      {
        title: "姓名",
        dataIndex: "name",
        width: studentNameWidth,
        ellipsis: true,
      },
      { title: "性别", dataIndex: "gender", width: genderWidth, render: (v) => toText(v) },
    ];
  }, [suspendedAll]);

  const years = meta.years.length > 0
    ? meta.years
    : [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
  const allClasses = useMemo(() => {
    const source = meta.classes.length > 0
      ? meta.classes
      : [...students, ...unselectedAll, ...suspendedAll]
          .map((item) => item.class_name)
          .filter(Boolean);
    return sortXbkClassNames(Array.from(
      new Set(
        source
          .map((name) => String(name).trim())
          .filter(Boolean),
      ),
    ));
  }, [meta.classes, students, unselectedAll, suspendedAll]);

  const classOptions = useMemo(
    () =>
      allClasses.map((className) => ({
        value: className,
        label: formatXbkClassName(filters.grade, className),
      })),
    [allClasses, filters.grade],
  );

  useEffect(() => {
    if (!filters.class_name) return;
    if (allClasses.includes(filters.class_name)) return;
    setFilters((prev) => (prev.class_name ? { ...prev, class_name: undefined } : prev));
  }, [allClasses, filters.class_name, setFilters]);

  const kpiStudents = summary?.students ?? 0;
  const kpiCourses = summary?.courses ?? 0;
  const kpiSelections = summary?.selections ?? 0;
  const kpiUnselected = summary?.unselected_count ?? 0;
  const kpiSuspended = summary?.suspended_count ?? 0;

  const renderTable = (tab: DataTabKey) => {
    const map: Record<DataTabKey, TableConfig<any>> = {
      course_results: { columns: courseResultColumns, data: courseResults, rowKey: "id" },
      students: { columns: studentColumns, data: students, rowKey: "id" },
      courses: { columns: courseColumns, data: courses, rowKey: "id" },
      selections: {
        columns: selectionColumns,
        data: selections,
        rowKey: (record: XbkSelectionRow) =>
          Number(record?.id || 0) > 0
            ? String(record.id)
            : `virtual-${record.year}-${record.term}-${record.student_no}-${record.course_code || ""}`,
      },
      unselected: { columns: unselectedColumns, data: unselectedAll, rowKey: "id" },
      suspended: { columns: suspendedColumns, data: suspendedAll, rowKey: "id" },
    };
    const { columns, data, rowKey } = map[tab];
    const currentPage = pg[tab].page;
    const pageSize = pg[tab].size;
    const isClientPagination = tab === "unselected" || tab === "suspended";
    const visibleData = isClientPagination
      ? data.slice((currentPage - 1) * pageSize, currentPage * pageSize)
      : data;
    const tableData = dataLoading ? [] : visibleData;

    return (
      <div className="xbk-table-frame">
        <div className="xbk-table-scroll">
          <LegacyConfigDataTable
            columns={columns as ColumnDef<Record<string, unknown>>[]}
            data={tableData as Record<string, unknown>[]}
            rowKey={rowKey as RowKey<Record<string, unknown>>}
            loading={dataLoading}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="xbk-page">
        <div className="w-full p-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-56" />
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="xbk-page">
        <div className="flex w-full items-center justify-center">
          <Card className="w-full max-w-xl bg-surface-2 p-8 text-center">
            <h2 className="text-xl font-semibold">未开放</h2>
            <p className="mt-2 text-sm text-text-secondary">
              XBK 处理系统当前未对前台开放，请联系管理员开启。
            </p>
            <div className="mt-6">
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="xbk-page">
      <div className="xbk-sidebar">
        <Card className="xbk-sidebar-card">
          <div className="xbk-filter-body">
            <h3 className="mb-[var(--ws-space-3)] text-sm font-semibold">筛选条件</h3>

            <div className="xbk-filter-field">
              <label>年份</label>
              <Select
                value={filters.year ? String(filters.year) : FILTER_ALL}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    year: value === FILTER_ALL ? undefined : Number(value),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择年份" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>全部年份</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="xbk-filter-field">
              <label>学期</label>
              <Select
                value={filters.term || FILTER_ALL}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    term: value === FILTER_ALL ? undefined : (value as "上学期" | "下学期"),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择学期" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>全部学期</SelectItem>
                  <SelectItem value="上学期">上学期</SelectItem>
                  <SelectItem value="下学期">下学期</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="xbk-filter-field">
              <label>年级</label>
              <Select
                value={filters.grade || FILTER_ALL}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    grade: value === FILTER_ALL ? undefined : (value as "高一" | "高二"),
                    class_name: undefined,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择年级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>全部年级</SelectItem>
                  <SelectItem value="高一">高一</SelectItem>
                  <SelectItem value="高二">高二</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="xbk-filter-field">
              <label>班级</label>
              <Select
                value={filters.class_name || FILTER_ALL}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    class_name: value === FILTER_ALL ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>全部班级</SelectItem>
                  {classOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="xbk-filter-field">
              <label>搜索</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  className="pl-[var(--ws-search-input-padding-start)]"
                  value={filters.search_text || ""}
                  placeholder="关键字搜索..."
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search_text: e.target.value }))
                  }
                />
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={resetFilters}>
              重置筛选
            </Button>
          </div>
        </Card>
      </div>

      <div className="xbk-main">
        <div className="xbk-header-bar">
          <div className="xbk-header-row">
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

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setImportVisible(true)}>
                <Upload className="h-4 w-4" />
                导入
              </Button>
              <Button variant="outline" onClick={() => setExportVisible(true)}>
                <Download className="h-4 w-4" />
                导出
              </Button>
              <Button
                variant="outline"
                title="导出当前表格页面的内容"
                onClick={() => void handleExportCurrentTable()}
                disabled={exportingCurrent}
              >
                {exportingCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                当前页
              </Button>
              {canEdit &&
              (activeTab === "students" ||
                activeTab === "courses" ||
                activeTab === "selections") ? (
                <Button onClick={() => openCreateModal(activeTab)}>
                  <Plus className="h-4 w-4" />
                  新增
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setAnalysisVisible(true)}>
                <BarChart3 className="h-4 w-4" />
                分析
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteVisible(true)}
              >
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleRefresh()}
                disabled={dataLoading}
              >
                {dataLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                刷新
              </Button>
            </div>
          </div>
        </div>

        <div className="xbk-table-card">
          <Tabs
            value={activeTab}
            onValueChange={(tab) => {
              const next = tab as DataTabKey;
              setActiveTab(next);
              updatePg(next, { page: 1 });
            }}
            className="xbk-tabs-root"
          >
            <TabsList className="xbk-tabs-list">
              {(Object.keys(tabLabels) as DataTabKey[]).map((tab) => (
                <TabsTrigger key={tab} value={tab} className="xbk-tab-trigger">
                  {tabLabels[tab]}
                </TabsTrigger>
              ))}
            </TabsList>

            {(Object.keys(tabLabels) as DataTabKey[]).map((tab) => (
              <TabsContent key={tab} value={tab} className="xbk-tab-panel">
                {renderTable(tab)}
              </TabsContent>
            ))}
          </Tabs>

          <div className="xbk-table-pagination">
            <DataTablePagination
              currentPage={pg[activeTab].page}
              totalPages={Math.max(1, Math.ceil(pg[activeTab].total / pg[activeTab].size))}
              total={pg[activeTab].total}
              pageSize={pg[activeTab].size}
              pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
              onPageChange={(page, size) =>
                updatePg(activeTab, {
                  page,
                  ...(typeof size === "number" ? { size } : {}),
                })
              }
            />
          </div>
        </div>

        <XbkImportModal
          open={importVisible}
          onCancel={() => setImportVisible(false)}
          onSuccess={async () => {
            setImportVisible(false);
            await Promise.all([loadMeta(), loadSummary(), reloadCurrentData()]);
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
            await Promise.all([loadMeta(), loadSummary(), reloadCurrentData()]);
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
            await Promise.all([loadMeta(), loadSummary(), reloadCurrentData()]);
          }}
          kind={editKind}
          mode={editMode}
          targetId={editRecord?.id ?? null}
          initialValues={editRecord}
          filters={{
            year: filters.year,
            term: filters.term,
            grade: filters.grade,
          }}
          meta={meta}
        />
      </div>
    </div>
  );
};

export default XbkPage;
