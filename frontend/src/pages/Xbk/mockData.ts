export type XbkTerm = "上学期" | "下学期";

export interface XbkStudentRow {
  id: number;
  year: number;
  term: XbkTerm;
  class_name: string;
  student_no: string;
  name: string;
  gender?: string;
}

export interface XbkCourseRow {
  id: number;
  year: number;
  term: XbkTerm;
  course_code: string;
  course_name: string;
  teacher?: string;
  quota: number;
  location?: string;
}

export interface XbkSelectionRow {
  id: number;
  year: number;
  term: XbkTerm;
  student_no: string;
  name?: string;
  course_code: string;
}

export const mockStudents: XbkStudentRow[] = [
  {
    id: 1,
    year: 2026,
    term: "上学期",
    class_name: "高一(1)班",
    student_no: "20260001",
    name: "张三",
    gender: "男",
  },
  {
    id: 2,
    year: 2026,
    term: "上学期",
    class_name: "高一(1)班",
    student_no: "20260002",
    name: "李四",
    gender: "女",
  },
  {
    id: 3,
    year: 2026,
    term: "上学期",
    class_name: "高一(2)班",
    student_no: "20260021",
    name: "王五",
    gender: "男",
  },
  {
    id: 4,
    year: 2026,
    term: "上学期",
    class_name: "高一(2)班",
    student_no: "20260022",
    name: "赵六",
    gender: "女",
  },
];

export const mockCourses: XbkCourseRow[] = [
  {
    id: 1,
    year: 2026,
    term: "上学期",
    course_code: "12",
    course_name: "Python 基础与应用",
    teacher: "王老师",
    quota: 3,
    location: "A401",
  },
  {
    id: 2,
    year: 2026,
    term: "上学期",
    course_code: "18",
    course_name: "机器人创客",
    teacher: "李老师",
    quota: 2,
    location: "创客空间",
  },
  {
    id: 3,
    year: 2026,
    term: "上学期",
    course_code: "23",
    course_name: "信息学竞赛入门",
    teacher: "张老师",
    quota: 2,
    location: "机房2",
  },
];

export const mockSelections: XbkSelectionRow[] = [
  { id: 1, year: 2026, term: "上学期", student_no: "20260001", name: "张三", course_code: "12" },
  { id: 2, year: 2026, term: "上学期", student_no: "20260002", name: "李四", course_code: "23" },
  { id: 3, year: 2026, term: "上学期", student_no: "20260021", name: "王五", course_code: "18" },
  { id: 4, year: 2026, term: "上学期", student_no: "20260022", name: "赵六", course_code: "12" },
];
