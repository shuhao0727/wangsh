/**
 * XBK 模块类型定义
 */
import type { XbkGrade } from "./grades";

/** 年级字段：后端为自由文本，前端标准值为 XBK_GRADES；历史数据可能含其他值 */
export type XbkGradeValue = XbkGrade | (string & {});

export interface XbkStudent {
  id: number;
  year: string;
  term: string;
  grade?: string;
  class_name: string;
  student_no: string;
  name: string;
  gender?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface XbkCourse {
  id: number;
  year: string;
  term: string;
  grade?: string;
  course_code: string;
  course_name: string;
  teacher?: string;
  quota?: number;
  location?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface XbkSelection {
  id: number;
  year: string;
  term: string;
  grade?: string;
  student_no: string;
  course_code: string;
  name: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export type XbkTab = 'course_results' | 'students' | 'courses' | 'selections' | 'unselected' | 'suspended';

export interface XbkPagination {
  page: number;
  size: number;
  total: number;
}
