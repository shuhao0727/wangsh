import { showMessage } from "@/lib/toast";
import React, { useState, useEffect, useMemo } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { xbkDataApi } from "@services";
import type {
  XbkSummary,
  XbkCourseStatItem,
  XbkClassStatItem,
  XbkStudentRow,
} from "@services";
import { cn } from "@/lib/utils";
import { formatXbkClassName } from "../className";

interface XbkAnalysisModalProps {
  open: boolean;
  onCancel: () => void;
  filters: {
    year?: number;
    term?: "上学期" | "下学期";
    grade?: "高一" | "高二";
    class_name?: string;
  };
}

const StatCard: React.FC<{ title: string; value: number; valueClassName?: string }> = ({
  title,
  value,
  valueClassName,
}) => (
  <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2">
    <div className="text-sm text-text-tertiary">{title}：</div>
    <div className={`text-3xl font-semibold leading-none ${valueClassName || ""}`}>{value}</div>
  </div>
);

type ModalTableProps<TData extends object> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  className?: string;
  getRowId?: (row: TData, index: number) => string;
};

const ModalDataTable = <TData extends object>({
  data,
  columns,
  className,
  getRowId,
}: ModalTableProps<TData>) => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(getRowId ? { getRowId } : {}),
  });

  return (
    <DataTable
      table={table}
      className={cn("h-full", className)}
      tableClassName="min-w-full"
    />
  );
};

const CourseTable: React.FC<{ data: XbkCourseStatItem[]; className?: string }> = ({
  data,
  className,
}) => {
  const columns = useMemo<ColumnDef<XbkCourseStatItem>[]>(
    () => [
      {
        accessorFn: (row) => `${row.course_code} · ${row.course_name || "-"}`,
        id: "course",
        header: "课程",
      },
      {
        accessorKey: "count",
        header: "人数",
        meta: { className: "text-right" },
        cell: ({ row }) => {
          const record = row.original;
          if (typeof record.allowed_total === "number" && record.allowed_total > 0) {
            return (
              <Badge variant={record.count > record.allowed_total ? "danger" : "warning"}>
                {record.count}/{record.allowed_total}
              </Badge>
            );
          }
          return (
            <Badge variant="warning">
              {record.count}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  return (
    <ModalDataTable
      data={data}
      columns={columns}
      className={className}
      getRowId={(row, index) => `${row.course_code || "course"}-${index}`}
    />
  );
};

const ClassTable: React.FC<{ data: XbkClassStatItem[]; className?: string; grade?: string }> = ({
  data,
  className,
  grade,
}) => {
  const columns = useMemo<ColumnDef<XbkClassStatItem>[]>(
    () => [
      {
        accessorFn: (row) => formatXbkClassName(grade, row.class_name),
        id: "class_name",
        header: "班级",
      },
      {
        accessorKey: "count",
        header: "人数",
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <Badge variant="warning">
            {row.original.count}
          </Badge>
        ),
      },
    ],
    [grade],
  );

  return (
    <ModalDataTable
      data={data}
      columns={columns}
      className={className}
      getRowId={(row, index) => `${row.class_name || "class"}-${index}`}
    />
  );
};

const NoSelectionTable: React.FC<{ data: XbkStudentRow[]; className?: string }> = ({
  data,
  className,
}) => {
  const columns = useMemo<ColumnDef<XbkStudentRow>[]>(
    () => [
      {
        accessorFn: (row) => formatXbkClassName(row.grade, row.class_name),
        id: "class_name",
        header: "班级",
        size: 160,
        meta: { className: "w-[160px] max-w-[160px] truncate" },
      },
      {
        accessorFn: (row) => row.student_no || "-",
        id: "student_no",
        header: "学号",
        size: 160,
        meta: { className: "w-[160px] max-w-[160px] truncate" },
      },
      {
        accessorFn: (row) => row.name || "-",
        id: "name",
        header: "姓名",
        size: 140,
        meta: { className: "w-[140px] max-w-[140px] truncate" },
      },
    ],
    [],
  );

  return (
    <ModalDataTable
      data={data}
      columns={columns}
      className={className}
      getRowId={(row, index) => `${row.id ?? "student"}-${row.student_no}-${index}`}
    />
  );
};

export const XbkAnalysisModal: React.FC<XbkAnalysisModalProps> = ({ open, onCancel, filters }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<XbkSummary | null>(null);
  const [courseStats, setCourseStats] = useState<XbkCourseStatItem[]>([]);
  const [classStats, setClassStats] = useState<XbkClassStatItem[]>([]);
  const [noSelection, setNoSelection] = useState<XbkStudentRow[]>([]);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [courseQuery, setCourseQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      setLoading(true);
      setActiveTab("overview");
      setCourseQuery("");
      setStudentQuery("");
      try {
        const params = {
          year: filters.year,
          term: filters.term,
          grade: filters.grade,
          class_name: filters.class_name,
        };
        const [sum, courses, classes, noSel] = await Promise.all([
          xbkDataApi.getSummary(params),
          xbkDataApi.getCourseStats(params),
          xbkDataApi.getClassStats(params),
          xbkDataApi.getStudentsWithoutSelection(params),
        ]);
        setSummary(sum);
        setCourseStats(courses.items || []);
        setClassStats(classes.items || []);
        setNoSelection(noSel.items || []);
      } catch (_e: any) {
        showMessage.error("加载分析数据失败");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [open, filters]);

  const filteredCourseStats = useMemo(() => {
    const q = courseQuery.trim().toLowerCase();
    if (!q) return courseStats;
    return courseStats.filter((it) => {
      const code = String(it.course_code || "").toLowerCase();
      const name = String(it.course_name || "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [courseQuery, courseStats]);

  const filteredNoSelection = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return noSelection;
    return noSelection.filter((s) => {
      const cls = formatXbkClassName(s.grade, s.class_name).toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const no = String(s.student_no || "").toLowerCase();
      return cls.includes(q) || name.includes(q) || no.includes(q);
    });
  }, [studentQuery, noSelection]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="h-[86vh] max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-[1100px]">
        <DialogHeader>
          <DialogTitle>数据分析</DialogTitle>
          <DialogDescription className="sr-only">
            查看当前筛选条件下的学生、课程与选课统计明细。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <div className="ws-modal-filter-info flex flex-wrap items-center gap-x-2 gap-y-1">
              当前筛选：{filters.year || "全部年份"} · {filters.term || "全部学期"} · {filters.grade || "全部年级"}
              {filters.class_name ? ` · ${formatXbkClassName(filters.grade, filters.class_name)}` : ""}
              <span>·</span>
              <span className="font-medium text-text">学生数：{summary?.students ?? 0}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div>
                <StatCard title="学生数" value={summary?.students ?? 0} />
              </div>
              <div>
                <StatCard title="课程数" value={summary?.courses ?? 0} />
              </div>
              <div>
                <StatCard title="选课条目" value={summary?.selections ?? 0} />
              </div>
              <div>
                <StatCard
                  title="未选课"
                  value={summary?.unselected_count ?? 0}
                  valueClassName="text-[var(--ws-color-warning)]"
                />
              </div>
              <div>
                <StatCard
                  title="休学/其他"
                  value={summary?.suspended_count ?? 0}
                  valueClassName="text-text-tertiary"
                />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">概览</TabsTrigger>
                <TabsTrigger value="courses">课程统计详情</TabsTrigger>
                <TabsTrigger value="classes">班级统计详情</TabsTrigger>
                <TabsTrigger value="no_selection">未选课学生 ({noSelection.length})</TabsTrigger>
              </TabsList>

              <TabsContent
                value="overview"
                className="mt-3 min-h-0 flex-1 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-col"
              >
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex min-h-0 flex-1 flex-col space-y-2">
                    <div className="ws-section-title font-semibold">课程统计（按课程代码）</div>
                    <CourseTable data={courseStats} className="min-h-0 flex-1" />
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col space-y-2">
                    <div className="ws-section-title font-semibold">班级统计</div>
                    <ClassTable data={classStats} className="min-h-0 flex-1" grade={filters.grade} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="courses"
                className="mt-3 min-h-0 flex-1 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-col"
              >
                <div className="flex min-h-0 flex-1 flex-col space-y-3">
                  <Input
                    placeholder="搜索课程代码/名称"
                    value={courseQuery}
                    onChange={(e) => setCourseQuery(e.target.value)}
                    className="max-w-[300px]"
                  />
                  <CourseTable data={filteredCourseStats} className="min-h-0 flex-1" />
                </div>
              </TabsContent>

              <TabsContent
                value="classes"
                className="mt-3 min-h-0 flex-1 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-col"
              >
                <ClassTable data={classStats} className="min-h-0 flex-1" grade={filters.grade} />
              </TabsContent>

              <TabsContent
                value="no_selection"
                className="mt-3 min-h-0 flex-1 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-col"
              >
                <div className="flex min-h-0 flex-1 flex-col space-y-3">
                  <Input
                    placeholder="搜索班级/姓名/学号"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    className="max-w-[300px]"
                  />
                  <NoSelectionTable data={filteredNoSelection} className="min-h-0 flex-1" />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
