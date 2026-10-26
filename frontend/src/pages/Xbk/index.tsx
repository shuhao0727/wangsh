import { showMessage } from "@/lib/toast";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  BookOpen,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { XbkTab } from "./types";
import { XBK_GRADES } from "./grades";
import { useXbkFilters } from "./hooks/useXbkFilters";
import { useXbkPagination, DEFAULT_PAGINATION } from "./hooks/useXbkPagination";
import { xbkDataApi, xbkPublicConfigApi } from "@services";
import useAuth from "@hooks/useAuth";
import { ConfirmDialog } from "@components/Common/ConfirmDialog";
import type {
  XbkCourseRow,
  XbkCourseResultRow,
  XbkScope,
  XbkExportType,
  XbkSelectionRow,
  XbkStudentRow,
  XbkMeta,
  XbkSummary,
} from "@services";
import { buildXbkColumns, type ColumnDef } from "./columns";
import XbkFilterBar from "./components/XbkFilterBar";
import { XbkImportModal } from "./components/XbkImportModal";
import { XbkCourseSelectionWorkbookModal } from "./components/XbkCourseSelectionWorkbookModal";
import { XbkExportModal } from "./components/XbkExportModal";
import { XbkDeleteModal } from "./components/XbkDeleteModal";
import { XbkAnalysisModal } from "./components/XbkAnalysisModal";
import { XbkEditModal } from "./components/XbkEditModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calcColumnWidth } from "../../utils/table";
import "./Xbk.css";
import { PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";
import { formatXbkClassName, sortXbkClassNames } from "./className";
import {
  FULL_ACADEMIC_YEAR_RE,
  formatAcademicYear,
  getCurrentAcademicYear,
  normalizeAcademicYear,
} from "./academicYear";

const FILTER_ALL = "__all__";
const CURRENT_ACADEMIC_YEAR = getCurrentAcademicYear();
const CURRENT_ACADEMIC_START = Number(CURRENT_ACADEMIC_YEAR.slice(0, 4));

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
        accessorFn: (record: T) =>
          readValue(record, col.dataIndex as string | undefined),
        meta: col.ellipsis
          ? { cellClassName: "max-w-0 overflow-hidden" }
          : undefined,
        cell: ({ row }) => {
          const value = readValue(
            row.original,
            col.dataIndex as string | undefined,
          );
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
      className="xbk-data-table"
      tableClassName="xbk-table-native min-w-max"
      tableScrollContainer={false}
      stickyHeader
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
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response
    ?.data?.detail;
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
  value === null || value === undefined || value === "" ? "-" : String(value);

const getCourseResultRowKey = (record: XbkCourseResultRow) =>
  [
    record.year,
    record.term,
    record.grade ?? "",
    record.class_name ?? "",
    record.student_no,
    record.course_code,
    record.course_name ?? "",
  ].join("::");

const XbkPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const { filters, setFilters } = useXbkFilters();
  const { pg, setPg, updatePg } = useXbkPagination();
  // 学年输入使用本地草稿态：只有合法值才提交到 filters，避免半截输入触发请求
  const [yearDraft, setYearDraft] = useState(filters.year ?? "");
  const [activeTab, setActiveTab] = useState<DataTabKey>("course_results");
  const [meta, setMeta] = useState<XbkMeta>({
    years: [],
    terms: [],
    classes: [],
  });
  const [summary, setSummary] = useState<XbkSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [metaError, setMetaError] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [dataErrors, setDataErrors] = useState<
    Partial<Record<DataTabKey, string>>
  >({});
  const [refreshing, setRefreshing] = useState(false);
  const metaRequestSeqRef = useRef(0);
  const summaryRequestSeqRef = useRef(0);
  const dataRequestSeqRef = useRef(0);
  const activeDataError = dataErrors[activeTab];

  const [students, setStudents] = useState<XbkStudentRow[]>([]);
  const [courses, setCourses] = useState<XbkCourseRow[]>([]);
  const [selections, setSelections] = useState<XbkSelectionRow[]>([]);
  const [courseResults, setCourseResults] = useState<XbkCourseResultRow[]>([]);
  const [unselectedAll, setUnselectedAll] = useState<XbkStudentRow[]>([]);
  const [suspendedAll, setSuspendedAll] = useState<XbkStudentRow[]>([]);

  const [importVisible, setImportVisible] = useState(false);
  // 三个单项导入共用同一弹窗，由 scope 决定标题、字段说明和模板
  const [importScope, setImportScope] = useState<XbkScope>("students");
  const [workbookImportVisible, setWorkbookImportVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  // 三个导出入口共用同一弹窗，由类型决定标题与说明
  const [exportType, setExportType] = useState<XbkExportType>("course-selection");
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [exportingCurrent, setExportingCurrent] = useState(false);

  const canEdit = auth.isAdmin();
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onOk: () => void;
  } | null>(null);

  const [editKind, setEditKind] = useState<
    "students" | "courses" | "selections"
  >("students");
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [editRecord, setEditRecord] = useState<
    XbkStudentRow | XbkCourseRow | XbkSelectionRow | null
  >(null);

  const resetFilters = () => {
    // 重置时同步草稿态，避免输入框停留在旧的非法值
    setYearDraft(CURRENT_ACADEMIC_YEAR);
    setFilters({ year: CURRENT_ACADEMIC_YEAR, term: "上学期" });
  };

  // 学年筛选的统一提交入口：只有合法值或显式清空才写入 filters，非法输入不触发请求
  const commitYear = useCallback(
    (raw: string) => {
      if (!raw.trim()) {
        // 清空输入框视为“全部学年”
        setFilters((prev) =>
          prev.year
            ? { ...prev, year: undefined, class_name: undefined }
            : prev,
        );
        return;
      }
      const normalized = normalizeAcademicYear(raw);
      if (!normalized) return; // 非法值只保留在草稿里，等用户继续修改
      setFilters((prev) =>
        prev.year === normalized
          ? prev
          : { ...prev, year: normalized, class_name: undefined },
      );
    },
    [setFilters],
  );

  const loadMeta = useCallback(async () => {
    const requestSeq = ++metaRequestSeqRef.current;
    try {
      const selectedYear = filters.year?.trim() || undefined;
      const [globalMeta, yearMeta, scopedMeta] = await Promise.all([
        xbkDataApi.getMeta(),
        selectedYear
          ? xbkDataApi.getMeta({ year: selectedYear })
          : xbkDataApi.getMeta(),
        xbkDataApi.getMeta({
          year: selectedYear,
          term: filters.term,
          grade: filters.grade,
        }),
      ]);
      if (requestSeq !== metaRequestSeqRef.current) return false;
      setMeta({
        years: globalMeta.years,
        terms: yearMeta.terms,
        classes: scopedMeta.classes,
      });
      setMetaError(false);
      return true;
    } catch {
      if (requestSeq !== metaRequestSeqRef.current) return false;
      setMetaError(true);
      return false;
    }
  }, [filters.grade, filters.term, filters.year]);

  const loadSummary = useCallback(async () => {
    const requestSeq = ++summaryRequestSeqRef.current;
    setSummaryLoading(true);
    try {
      const nextSummary = await xbkDataApi.getSummary({
        year: filters.year,
        term: filters.term,
        grade: filters.grade,
        class_name: filters.class_name,
      });
      if (requestSeq !== summaryRequestSeqRef.current) return false;
      setSummary(nextSummary);
      setSummaryError(false);
      return true;
    } catch {
      if (requestSeq !== summaryRequestSeqRef.current) return false;
      setSummary(null);
      setSummaryError(true);
      return false;
    } finally {
      if (requestSeq === summaryRequestSeqRef.current) setSummaryLoading(false);
    }
  }, [filters.class_name, filters.grade, filters.term, filters.year]);

  const loadData = useCallback(
    async (tab: DataTabKey, page: number, size: number) => {
      const requestSeq = dataRequestSeqRef.current + 1;
      dataRequestSeqRef.current = requestSeq;
      const isLatestRequest = () => dataRequestSeqRef.current === requestSeq;
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
          if (!isLatestRequest()) return;
          setCourseResults(res.items);
          updatePg("course_results", { total: res.total });
        } else if (tab === "students") {
          const res = await xbkDataApi.listStudents({
            ...base,
            page,
            size,
          });
          if (!isLatestRequest()) return;
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
          if (!isLatestRequest()) return;
          setCourses(res.items);
          updatePg("courses", { total: res.total });
        } else if (tab === "unselected") {
          const res = await xbkDataApi.getStudentsWithEmptySelection({
            year: base.year,
            term: base.term,
            grade: base.grade,
            class_name: base.class_name,
          });
          if (!isLatestRequest()) return;
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
          if (!isLatestRequest()) return;
          const items = res.items || [];
          setSuspendedAll(items);
          updatePg("suspended", { total: items.length });
        } else {
          const res = await xbkDataApi.listSelections({
            ...base,
            page,
            size,
          });
          if (!isLatestRequest()) return;
          setSelections(res.items);
          updatePg("selections", { total: res.total });
        }
        setDataErrors((prev) => ({ ...prev, [tab]: undefined }));
        return true;
      } catch (e) {
        if (!isLatestRequest()) return false;
        setDataErrors((prev) => ({
          ...prev,
          [tab]: `${tabLabels[tab]}加载失败`,
        }));
        showMessage.error(getErrorMsg(e, "加载数据失败"));
        return false;
      } finally {
        if (isLatestRequest()) {
          setDataLoading(false);
        }
      }
    },
    [
      filters.year,
      filters.term,
      filters.grade,
      filters.class_name,
      filters.search_text,
      updatePg,
    ],
  );

  const activePage = pg[activeTab].page;
  const activePageSize = pg[activeTab].size;

  // 删除或筛选后总数变小时，把超出范围的页码夹到最后一页，避免停在空表（显示“3/1”）
  useEffect(() => {
    (Object.keys(pg) as DataTabKey[]).forEach((tab) => {
      const { page, size, total } = pg[tab];
      const lastPage = Math.max(1, Math.ceil(total / size));
      if (page > lastPage) updatePg(tab, { page: lastPage });
    });
  }, [pg, updatePg]);

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
      showMessage.success("已导出当前筛选的全部结果");
    } catch (e) {
      showMessage.error(getErrorMsg(e, "导出失败"));
    } finally {
      setExportingCurrent(false);
    }
  }, [activeTab, filters]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const results = await Promise.all([
        loadMeta(),
        loadSummary(),
        reloadCurrentData(),
      ]);
      if (results.every(Boolean)) showMessage.success("已刷新");
    } finally {
      setRefreshing(false);
    }
  }, [loadMeta, loadSummary, reloadCurrentData]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        void handleRefresh();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        e.preventDefault();
        // 导入/导出都需要管理员权限，非管理员不打开入口
        if (canEdit) setImportVisible(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        if (canEdit) openExportModal("course-selection");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canEdit, enabled, handleRefresh]);

  const openCreateModal = useCallback(
    (kind: "students" | "courses" | "selections") => {
      if (!canEdit) return;
      setEditKind(kind);
      setEditMode("create");
      setEditRecord(null);
      setEditVisible(true);
    },
    [canEdit],
  );

  const openImportModal = useCallback(
    (scope: XbkScope) => {
      if (!canEdit) return;
      setImportScope(scope);
      setImportVisible(true);
    },
    [canEdit],
  );

  const openExportModal = useCallback(
    (type: XbkExportType) => {
      if (!canEdit) return;
      setExportType(type);
      setExportVisible(true);
    },
    [canEdit],
  );

  const openEditModal = useCallback(
    (kind: "students" | "courses" | "selections", record: any) => {
      if (!canEdit) return;
      const isVirtualSelection =
        kind === "selections" && Number(record?.id || 0) <= 0;
      setEditKind(kind);
      setEditMode(isVirtualSelection ? "create" : "edit");
      if (isVirtualSelection) {
        const next = {
          ...record,
          course_code:
            record?.course_code === "休学或其他" ||
            record?.course_code === "未选"
              ? ""
              : record?.course_code,
        };
        setEditRecord(next);
      } else {
        setEditRecord(record);
      }
      setEditVisible(true);
    },
    [canEdit],
  );

  const handleDeleteRow = useCallback(
    async (kind: "students" | "courses" | "selections", id: number) => {
      if (!canEdit) return;
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
    [canEdit, loadMeta, loadSummary, reloadCurrentData],
  );

  // 列定义已抽到 ./columns，这里只在数据或权限变化时重建
  const columns = useMemo(
    () =>
      buildXbkColumns(
        { courseResults, students, courses, selections, suspendedAll, unselectedAll },
        {
          canEdit,
          onDeleteRequest: (onConfirm) =>
            setConfirmState({ message: "确认删除？", onOk: onConfirm }),
          handleDeleteRow,
          openEditModal,
        },
      ),
    [courseResults, students, courses, selections, suspendedAll, unselectedAll, canEdit, handleDeleteRow, openEditModal],
  );
  const { courseResultColumns, studentColumns, courseColumns, selectionColumns, unselectedColumns, suspendedColumns } = columns;

  const years = useMemo(() => {
    // 始终提供当前学年及前两年，便于在空库或新学年尚未录入时直接选择
    const recent = [0, 1, 2].map((offset) =>
      formatAcademicYear(CURRENT_ACADEMIC_START - offset),
    );
    const source = [...meta.years, ...recent];
    const values = Array.from(
      new Set(source.map((year) => String(year).trim()).filter(Boolean)),
    ).sort((a, b) => b.localeCompare(a));
    const selectedYear = filters.year?.trim();
    if (selectedYear && !values.includes(selectedYear))
      values.unshift(selectedYear);
    return values;
  }, [filters.year, meta.years]);
  const termOptions = useMemo(() => {
    const source = meta.terms.length > 0 ? meta.terms : ["上学期", "下学期"];
    const values = Array.from(
      new Set(source.map((term) => String(term).trim()).filter(Boolean)),
    );
    const selectedTerm = filters.term?.trim();
    if (selectedTerm && !values.includes(selectedTerm))
      values.unshift(selectedTerm);
    return values;
  }, [filters.term, meta.terms]);
  const allClasses = useMemo(() => {
    const source =
      meta.classes.length > 0
        ? meta.classes
        : [...students, ...unselectedAll, ...suspendedAll]
            .map((item) => item.class_name)
            .filter(Boolean);
    return sortXbkClassNames(
      Array.from(
        new Set(source.map((name) => String(name).trim()).filter(Boolean)),
      ),
    );
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
    if (metaError || !filters.class_name) return;
    if (allClasses.includes(filters.class_name)) return;
    setFilters((prev) =>
      prev.class_name ? { ...prev, class_name: undefined } : prev,
    );
  }, [allClasses, filters.class_name, metaError, setFilters]);

  const kpiStudents = summary?.students ?? 0;
  const kpiCourses = summary?.courses ?? 0;
  const kpiSelections = summary?.selections ?? 0;
  const kpiUnselected = summary?.unselected_count ?? 0;
  const kpiSuspended = summary?.suspended_count ?? 0;

  const renderTable = (tab: DataTabKey) => {
    if (dataErrors[tab]) {
      return (
        <div className="px-4 py-10 text-center text-sm text-text-secondary">
          {dataLoading ? "正在重新加载..." : "列表加载失败，暂不显示数据。"}
        </div>
      );
    }
    const map: Record<DataTabKey, TableConfig<any>> = {
      course_results: {
        columns: courseResultColumns,
        data: courseResults,
        rowKey: getCourseResultRowKey,
      },
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
      unselected: {
        columns: unselectedColumns,
        data: unselectedAll,
        rowKey: "id",
      },
      suspended: {
        columns: suspendedColumns,
        data: suspendedAll,
        rowKey: "id",
      },
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
    <>
      <div className="xbk-page">
        <XbkFilterBar
          yearDraft={yearDraft}
          onYearDraftChange={setYearDraft}
          onYearCommit={commitYear}
          years={years}
          filters={filters}
          setFilters={setFilters}
          termOptions={termOptions}
          classOptions={classOptions}
          allValue={FILTER_ALL}
          normalizeYear={normalizeAcademicYear}
          isFullYear={(value) => FULL_ACADEMIC_YEAR_RE.test(value)}
          activeTab={activeTab}
          onReset={resetFilters}
        />

        <div className="xbk-main">
          {(metaError || summaryError || activeDataError) && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error bg-error-soft p-4 text-sm text-text-base"
            >
              <div>
                <p className="font-medium">
                  {[
                    metaError && "筛选选项加载失败",
                    summaryError && "统计数据加载失败",
                    activeDataError,
                  ]
                    .filter(Boolean)
                    .join("；")}
                </p>
                <p className="mt-1 text-text-secondary">
                  加载失败不代表没有数据，请重试。
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRefresh()}
                disabled={refreshing || dataLoading}
              >
                {refreshing ? "正在重试..." : "重试加载"}
              </Button>
            </div>
          )}
          <div className="xbk-table-card">
            <div className="xbk-header-bar">
              <div className="xbk-kpis">
                <div className="xbk-kpi-item">
                  <span className="label">学生</span>
                  <span className="value">
                    {summaryLoading || !summary ? "—" : kpiStudents}
                  </span>
                </div>
                <div className="xbk-kpi-item">
                  <span className="label">课程</span>
                  <span className="value">
                    {summaryLoading || !summary ? "—" : kpiCourses}
                  </span>
                </div>
                <div className="xbk-kpi-item">
                  <span className="label">选课</span>
                  <span className="value">
                    {summaryLoading || !summary ? "—" : kpiSelections}
                  </span>
                </div>
                <div
                  className={`xbk-kpi-item ${kpiUnselected > 0 ? "warn" : ""}`}
                >
                  <span className="label">未选</span>
                  <span className="value">
                    {summaryLoading || !summary ? "—" : kpiUnselected}
                  </span>
                </div>
                <div className="xbk-kpi-item">
                  <span className="label">休学</span>
                  <span className="value">
                    {summaryLoading || !summary ? "—" : kpiSuspended}
                  </span>
                </div>
              </div>
              {canEdit ? (
                <div className="xbk-toolbar-group xbk-toolbar-imports">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWorkbookImportVisible(true)}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    导入选课表
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openImportModal("students")}
                  >
                    <Users className="h-4 w-4" />
                    导入学生
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openImportModal("courses")}
                  >
                    <BookOpen className="h-4 w-4" />
                    导入课程
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openImportModal("selections")}
                  >
                    <ClipboardList className="h-4 w-4" />
                    导入选课
                  </Button>
                  {activeTab === "students" ||
                  activeTab === "courses" ||
                  activeTab === "selections" ? (
                    <Button
                      size="sm"
                      onClick={() => openCreateModal(activeTab)}
                      disabled={dataLoading}
                    >
                      <Plus className="h-4 w-4" />
                      新增
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <Tabs
              value={activeTab}
              onValueChange={(tab) => {
                const next = tab as DataTabKey;
                setActiveTab(next);
                updatePg(next, { page: 1 });
                // 切到不支持搜索的页签时清空关键字，避免它继续影响其它页签的请求
                if (next === "unselected" || next === "suspended") {
                  setFilters((prev) =>
                    prev.search_text ? { ...prev, search_text: undefined } : prev,
                  );
                }
              }}
              className="xbk-tabs-root"
            >
              <div className="xbk-workspace-row">
                <TabsList className="xbk-tabs-list">
                  {(Object.keys(tabLabels) as DataTabKey[]).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="xbk-tab-trigger"
                    >
                      {tabLabels[tab]}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div
                  className="xbk-toolbar"
                  role="toolbar"
                  aria-label="选课数据操作"
                >
                  <div className="xbk-toolbar-group">
                    {/* 导出走后端 require_admin 接口，非管理员不显示 */}
                    {canEdit ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openExportModal("course-selection")}
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                          导出选课表
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openExportModal("distribution")}
                        >
                          <Users className="h-4 w-4" />
                          导出各班发表
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openExportModal("teacher-distribution")}
                        >
                          <BookOpen className="h-4 w-4" />
                          导出教师发表
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="导出当前表格中符合筛选条件的全部结果（不限当前分页）"
                          onClick={() => void handleExportCurrentTable()}
                          disabled={exportingCurrent}
                        >
                          {exportingCurrent ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          导出当前结果
                        </Button>
                      </>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAnalysisVisible(true)}
                    >
                      <BarChart3 className="h-4 w-4" />
                      分析
                    </Button>
                  </div>
                  <div className="xbk-toolbar-group xbk-toolbar-maintenance">
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteVisible(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRefresh()}
                      disabled={dataLoading || refreshing}
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

              {(Object.keys(tabLabels) as DataTabKey[]).map((tab) => (
                <TabsContent key={tab} value={tab} className="xbk-tab-panel">
                  {renderTable(tab)}
                </TabsContent>
              ))}
            </Tabs>

            {!activeDataError && (
              <div className="xbk-table-pagination">
                <DataTablePagination
                  currentPage={pg[activeTab].page}
                  totalPages={Math.max(
                    1,
                    Math.ceil(pg[activeTab].total / pg[activeTab].size),
                  )}
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
            )}
          </div>

          {canEdit ? (
            <XbkCourseSelectionWorkbookModal
              open={workbookImportVisible}
              onCancel={() => setWorkbookImportVisible(false)}
              onSuccess={async () => {
                setWorkbookImportVisible(false);
                await Promise.all([
                  loadMeta(),
                  loadSummary(),
                  reloadCurrentData(),
                ]);
              }}
              filters={{
                year: filters.year,
                term: filters.term,
                grade: filters.grade,
              }}
            />
          ) : null}
          {canEdit ? (
            <XbkImportModal
              open={importVisible}
              scope={importScope}
              onCancel={() => setImportVisible(false)}
              onSuccess={async ({ year, term }) => {
                setImportVisible(false);
                // 回写弹窗实际使用的学年/学期，避免导入后左侧筛选仍停留在旧值
                const nextYear = year ?? filters.year;
                const nextTerm = term ?? filters.term;
                setYearDraft(nextYear ?? "");
                const changed =
                  nextYear !== filters.year || nextTerm !== filters.term;
                if (changed) {
                  // 筛选变化会通过 effect 自动重载，无需重复请求
                  setFilters((prev) => ({
                    ...prev,
                    year: nextYear,
                    term: nextTerm,
                  }));
                } else {
                  await Promise.all([
                    loadMeta(),
                    loadSummary(),
                    reloadCurrentData(),
                  ]);
                }
              }}
              filters={{
                year: filters.year,
                term: filters.term,
                grade: filters.grade,
              }}
              termOptions={termOptions}
            />
          ) : null}
          {canEdit ? (
            <XbkExportModal
              open={exportVisible}
              exportType={exportType}
              onCancel={() => setExportVisible(false)}
              filters={{
                year: filters.year,
                term: filters.term as "上学期" | "下学期" | undefined,
                grade: filters.grade,
                class_name: filters.class_name,
              }}
            />
          ) : null}
          {canEdit ? (
            <XbkDeleteModal
              open={deleteVisible}
              onCancel={() => setDeleteVisible(false)}
              onSuccess={async () => {
                setDeleteVisible(false);
                await Promise.all([
                  loadMeta(),
                  loadSummary(),
                  reloadCurrentData(),
                ]);
              }}
              filters={{
                year: filters.year,
                term: filters.term as "上学期" | "下学期" | undefined,
                grade: filters.grade,
                class_name: filters.class_name,
              }}
            />
          ) : null}
          <XbkAnalysisModal
            open={analysisVisible}
            onCancel={() => setAnalysisVisible(false)}
            filters={{
              year: filters.year,
              term: filters.term as "上学期" | "下学期" | undefined,
              grade: filters.grade,
              class_name: filters.class_name,
            }}
          />
          {canEdit ? (
            <XbkEditModal
              open={editVisible}
              onCancel={() => setEditVisible(false)}
              onSuccess={async () => {
                setEditVisible(false);
                await Promise.all([
                  loadMeta(),
                  loadSummary(),
                  reloadCurrentData(),
                ]);
              }}
              kind={editKind}
              mode={editMode}
              targetId={editRecord?.id ?? null}
              initialValues={editRecord}
              filters={{
                year: filters.year,
                term: filters.term as "上学期" | "下学期" | undefined,
                grade: filters.grade,
              }}
              meta={meta}
            />
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmState !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null);
        }}
        title="确认操作"
        description={confirmState?.message ?? ""}
        confirmText="确认"
        variant="destructive"
        onConfirm={() => {
          confirmState?.onOk();
          setConfirmState(null);
        }}
      />
    </>
  );
};

export default XbkPage;
