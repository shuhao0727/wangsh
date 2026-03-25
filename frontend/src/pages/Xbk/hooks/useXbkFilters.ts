import { useState } from "react";

type Filters = {
  year?: number;
  term?: "上学期" | "下学期";
  grade?: "高一" | "高二";
  class_name?: string;
  search_text?: string;
};

const CURRENT_YEAR = new Date().getFullYear();

export const useXbkFilters = () => {
  const [filters, setFilters] = useState<Filters>({
    year: CURRENT_YEAR,
    term: "上学期"
  });

  const updateFilter = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ year: CURRENT_YEAR, term: "上学期" });
  };

  return { filters, setFilters, updateFilter, resetFilters };
};
