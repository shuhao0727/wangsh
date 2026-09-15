import { useState } from "react";
import { getCurrentAcademicYear } from "../academicYear";

type Filters = {
  year?: string;
  term?: string;
  grade?: "高一" | "高二";
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
