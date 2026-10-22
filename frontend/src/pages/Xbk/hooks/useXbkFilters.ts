import { useState } from "react";
import { getCurrentAcademicYear } from "../academicYear";
import type { XbkGrade } from "../grades";

type Filters = {
  year?: string;
  term?: string;
  // 年级统一使用 XBK_GRADES 枚举，避免“高三”被前端过滤掉
  grade?: XbkGrade;
  class_name?: string;
  search_text?: string;
};

const CURRENT_ACADEMIC_YEAR = getCurrentAcademicYear();

export const useXbkFilters = () => {
  const [filters, setFilters] = useState<Filters>({
    year: CURRENT_ACADEMIC_YEAR,
    term: "上学期",
  });

  const updateFilter = (key: keyof Filters, value: Filters[keyof Filters]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ year: CURRENT_ACADEMIC_YEAR, term: "上学期" });
  };

  return { filters, setFilters, updateFilter, resetFilters };
};
