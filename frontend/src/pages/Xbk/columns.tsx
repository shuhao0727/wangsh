/** XBK 各页签的表格列定义。
 *
 * 从 index.tsx 抽出：列只依赖当前数据与两个回调，不持有状态。
 * 独立成模块后可按页签单测，也避免主组件继续膨胀。
 */
import React from "react";
import { Button } from "@/components/ui/button";
import type { XbkCourseResultRow, XbkCourseRow, XbkSelectionRow, XbkStudentRow } from "@services";
import { formatXbkClassName } from "./className";

export type ColumnDef<T> = {
  title: React.ReactNode;
  dataIndex?: keyof T | string;
  key?: string;
  width?: number;
  ellipsis?: boolean;
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
};

export type ActionKind = "students" | "courses" | "selections";

const toText = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

const textWidth = (text: string) =>
  [...text].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 255 ? 2 : 1), 0);

/** 按该列最长内容估算列宽（中文按两倍宽度）。 */
export const calcAutoColWidth = <T,>(rows: T[], field: string, title: string, min: number, max: number): number => {
  const widest = rows.reduce(
    (acc, row) => Math.max(acc, textWidth(String((row as Record<string, unknown>)[field] ?? ""))),
    textWidth(title),
  );
  return Math.min(max, Math.max(min, widest * 8 + 32));
};

/** 班级列宽：班级名单独拉宽区间。 */
export const calcClassColWidth = <T,>(rows: T[], min: number, max: number): number =>
  calcAutoColWidth(rows, "class_name", "班级", min, max);

export type ColumnData = {
  courseResults: XbkCourseResultRow[];
  students: XbkStudentRow[];
  courses: XbkCourseRow[];
  selections: XbkSelectionRow[];
  suspendedAll: XbkStudentRow[];
  unselectedAll: XbkStudentRow[];
};

export type ColumnCallbacks = {
  /** 是否可编辑；false 时不渲染操作列。 */
  canEdit: boolean;
  /** 请求二次确认删除，由主组件注入，保持列定义无状态。 */
  onDeleteRequest: (onConfirm: () => void) => void;
  handleDeleteRow: (kind: ActionKind, id: number) => Promise<void> | void;
  openEditModal: (kind: ActionKind, record: unknown) => void;
};

/** 构造全部表格列定义；每次数据变化时重新调用即可。 */
export function buildXbkColumns(
  data: ColumnData,
  callbacks: ColumnCallbacks,
): {
  courseResultColumns: ColumnDef<XbkCourseResultRow>[];
  studentColumns: ColumnDef<XbkStudentRow>[];
  courseColumns: ColumnDef<XbkCourseRow>[];
  selectionColumns: ColumnDef<XbkSelectionRow>[];
  unselectedColumns: ColumnDef<XbkStudentRow>[];
  suspendedColumns: ColumnDef<XbkStudentRow>[];
} {
  const { courseResults, students, courses, selections, suspendedAll, unselectedAll } = data;
  const { canEdit, onDeleteRequest, handleDeleteRow, openEditModal } = callbacks;

  const makeActionCol = (
    kind: "students" | "courses" | "selections",
  ): ColumnDef<XbkStudentRow | XbkCourseRow | XbkSelectionRow> => ({
      title: "操作",
      key: "actions",
      render: (_: unknown, record: any) => {
        const isVirtualSelection =
          kind === "selections" && Number(record?.id || 0) <= 0;
        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3"
              onClick={() => openEditModal(kind, record)}
            >
              {isVirtualSelection ? "补录" : "编辑"}
            </Button>
            {!isVirtualSelection ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  onDeleteRequest(() => {
                    void handleDeleteRow(kind, record.id);
                  });
                }}
              >
                删除
              </Button>
            ) : null}
          </div>
        );
      },
  });

  const courseResultColumns = (() => {
    const yearWidth = calcAutoColWidth(courseResults, "year", "学年", 110, 150);
    const termWidth = calcAutoColWidth(courseResults, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(
      courseResults,
      "grade",
      "年级",
      88,
      150,
    );
    const classWidth = calcClassColWidth(courseResults, 120, 280);
    const studentNoWidth = calcAutoColWidth(
      courseResults,
      "student_no",
      "学号",
      110,
      240,
    );
    const studentNameWidth = calcAutoColWidth(
      courseResults,
      "student_name",
      "姓名",
      100,
      220,
    );
    const courseCodeWidth = calcAutoColWidth(
      courseResults,
      "course_code",
      "课程代码",
      110,
      260,
    );
    const courseNameWidth = calcAutoColWidth(
      courseResults,
      "course_name",
      "课程名称",
      140,
      420,
    );
    const teacherWidth = calcAutoColWidth(
      courseResults,
      "teacher",
      "负责人",
      100,
      280,
    );
    const locationWidth = calcAutoColWidth(
      courseResults,
      "location",
      "地点",
      120,
      360,
    );

    return [
      { title: "学年", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      {
        title: "年级",
        dataIndex: "grade",
        width: gradeWidth,
        render: (v: unknown) => toText(v),
      },
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
        render: (v: unknown) => (
          <span className="xbk-cell-ellipsis">{(v as string) || "-"}</span>
        ),
      },
      {
        title: "班级",
        dataIndex: "class_name",
        width: classWidth,
        ellipsis: true,
        render: (_value: unknown, record: { grade?: string | null; class_name?: string | null }) =>
          formatXbkClassName(record.grade ?? "", record.class_name ?? ""),
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
        render: (v: unknown) => toText(v),
      },
      {
        title: "负责人",
        dataIndex: "teacher",
        width: teacherWidth,
        ellipsis: true,
        render: (v: unknown) => toText(v),
      },
      {
        title: "地点",
        dataIndex: "location",
        width: locationWidth,
        ellipsis: true,
        render: (v: unknown) => (
          <span className="xbk-cell-ellipsis">{(v as string) || "-"}</span>
        ),
      },
    ];
  })();

  const studentColumns = (() => {
    const yearWidth = calcAutoColWidth(students, "year", "学年", 110, 150);
    const termWidth = calcAutoColWidth(students, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(students, "grade", "年级", 88, 150);
    const classWidth = calcClassColWidth(students, 120, 280);
    const studentNoWidth = calcAutoColWidth(
      students,
      "student_no",
      "学号",
      110,
      240,
    );
    const studentNameWidth = calcAutoColWidth(
      students,
      "name",
      "姓名",
      100,
      220,
    );
    const genderWidth = calcAutoColWidth(students, "gender", "性别", 80, 140);

    const cols: ColumnDef<XbkStudentRow>[] = [
      { title: "学年", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      {
        title: "年级",
        dataIndex: "grade",
        width: gradeWidth,
        render: (v: unknown) => toText(v),
      },
      {
        title: "班级",
        dataIndex: "class_name",
        width: classWidth,
        ellipsis: true,
        render: (_value: unknown, record: { grade?: string | null; class_name?: string | null }) =>
          formatXbkClassName(record.grade ?? "", record.class_name ?? ""),
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
      {
        title: "性别",
        dataIndex: "gender",
        width: genderWidth,
        render: (v: unknown) => toText(v),
      },
    ];
    if (canEdit)
      cols.push(makeActionCol("students") as ColumnDef<XbkStudentRow>);
    return cols;
  })();

  const courseColumns = (() => {
    const yearWidth = calcAutoColWidth(courses, "year", "学年", 110, 150);
    const termWidth = calcAutoColWidth(courses, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(courses, "grade", "年级", 88, 150);
    const courseCodeWidth = calcAutoColWidth(
      courses,
      "course_code",
      "代码",
      110,
      260,
    );
    const courseNameWidth = calcAutoColWidth(
      courses,
      "course_name",
      "课程名称",
      160,
      360,
    );
    const teacherWidth = calcAutoColWidth(
      courses,
      "teacher",
      "负责人",
      100,
      280,
    );
    const quotaWidth = calcAutoColWidth(courses, "quota", "限报", 80, 140);
    const locationWidth = calcAutoColWidth(
      courses,
      "location",
      "地点",
      120,
      360,
    );

    const cols: ColumnDef<XbkCourseRow>[] = [
      { title: "学年", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      {
        title: "年级",
        dataIndex: "grade",
        width: gradeWidth,
        render: (v: unknown) => toText(v),
      },
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
        render: (v: unknown) => (
          <span className="xbk-cell-ellipsis">{(v as string) || "-"}</span>
        ),
      },
      {
        title: "负责人",
        dataIndex: "teacher",
        width: teacherWidth,
        ellipsis: true,
        render: (v: unknown) => (
          <span className="xbk-cell-ellipsis">{(v as string) || "-"}</span>
        ),
      },
      {
        title: "限报",
        dataIndex: "quota",
        width: quotaWidth,
        render: (v) => {
          const quota = typeof v === "number" && Number.isFinite(v) ? v : null;
          return (
            <span
              className={
                quota !== null
                  ? "inline-flex items-center rounded-full bg-[var(--ws-color-primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--ws-color-primary)]"
                  : "inline-flex items-center rounded-full bg-[var(--ws-color-surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--ws-color-text-tertiary)]"
              }
            >
              {quota !== null ? quota : "不限"}
            </span>
          );
        },
      },
      {
        title: "地点",
        dataIndex: "location",
        width: locationWidth,
        ellipsis: true,
        render: (v: unknown) => (
          <span className="xbk-cell-ellipsis">{(v as string) || "-"}</span>
        ),
      },
    ];
    if (canEdit) cols.push(makeActionCol("courses") as ColumnDef<XbkCourseRow>);
    return cols;
  })();

  const selectionColumns = (() => {
    const yearWidth = calcAutoColWidth(selections, "year", "学年", 110, 150);
    const termWidth = calcAutoColWidth(selections, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(selections, "grade", "年级", 88, 150);
    const studentNoWidth = calcAutoColWidth(
      selections,
      "student_no",
      "学号",
      110,
      240,
    );
    const studentNameWidth = calcAutoColWidth(
      selections,
      "name",
      "姓名",
      100,
      220,
    );
    const courseCodeWidth = calcAutoColWidth(
      selections,
      "course_code",
      "课程代码",
      110,
      260,
    );

    const cols: ColumnDef<XbkSelectionRow>[] = [
      { title: "学年", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      {
        title: "年级",
        dataIndex: "grade",
        width: gradeWidth,
        // 筛选按学生当前年级，展示也以它为准；grade 是选课写入时的快照，
        // 学生转年级后会与筛选结果不一致，仅在缺少当前年级时回退使用。
        render: (_v, record) => toText(record.student_grade ?? record.grade),
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
        render: (v: unknown) => toText(v),
      },
      {
        title: "课程代码",
        dataIndex: "course_code",
        width: courseCodeWidth,
        ellipsis: true,
      },
    ];
    if (canEdit)
      cols.push(makeActionCol("selections") as ColumnDef<XbkSelectionRow>);
    return cols;
  })();

  const unselectedColumns = (() => {
    const yearWidth = calcAutoColWidth(unselectedAll, "year", "学年", 110, 150);
    const termWidth = calcAutoColWidth(unselectedAll, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(
      unselectedAll,
      "grade",
      "年级",
      88,
      150,
    );
    const classWidth = calcClassColWidth(unselectedAll, 120, 280);
    const studentNoWidth = calcAutoColWidth(
      unselectedAll,
      "student_no",
      "学号",
      110,
      240,
    );
    const studentNameWidth = calcAutoColWidth(
      unselectedAll,
      "name",
      "姓名",
      100,
      220,
    );
    const genderWidth = calcAutoColWidth(
      unselectedAll,
      "gender",
      "性别",
      80,
      140,
    );

    return [
      { title: "学年", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      {
        title: "年级",
        dataIndex: "grade",
        width: gradeWidth,
        render: (v: unknown) => toText(v),
      },
      {
        title: "班级",
        dataIndex: "class_name",
        width: classWidth,
        ellipsis: true,
        render: (_value: unknown, record: { grade?: string | null; class_name?: string | null }) =>
          formatXbkClassName(record.grade ?? "", record.class_name ?? ""),
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
      {
        title: "性别",
        dataIndex: "gender",
        width: genderWidth,
        render: (v: unknown) => toText(v),
      },
    ];
  })();

  const suspendedColumns = (() => {
    const yearWidth = calcAutoColWidth(suspendedAll, "year", "学年", 110, 150);
    const termWidth = calcAutoColWidth(suspendedAll, "term", "学期", 88, 180);
    const gradeWidth = calcAutoColWidth(suspendedAll, "grade", "年级", 88, 150);
    const classWidth = calcClassColWidth(suspendedAll, 120, 280);
    const studentNoWidth = calcAutoColWidth(
      suspendedAll,
      "student_no",
      "学号",
      110,
      240,
    );
    const studentNameWidth = calcAutoColWidth(
      suspendedAll,
      "name",
      "姓名",
      100,
      220,
    );
    const genderWidth = calcAutoColWidth(
      suspendedAll,
      "gender",
      "性别",
      80,
      140,
    );

    return [
      { title: "学年", dataIndex: "year", width: yearWidth },
      { title: "学期", dataIndex: "term", width: termWidth },
      {
        title: "年级",
        dataIndex: "grade",
        width: gradeWidth,
        render: (v: unknown) => toText(v),
      },
      {
        title: "班级",
        dataIndex: "class_name",
        width: classWidth,
        ellipsis: true,
        render: (_value: unknown, record: { grade?: string | null; class_name?: string | null }) =>
          formatXbkClassName(record.grade ?? "", record.class_name ?? ""),
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
      {
        title: "性别",
        dataIndex: "gender",
        width: genderWidth,
        render: (v: unknown) => toText(v),
      },
    ];
  })();


  return { courseResultColumns, studentColumns, courseColumns, selectionColumns, unselectedColumns, suspendedColumns };
}
