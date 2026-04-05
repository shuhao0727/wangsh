import { useCallback, useState } from "react";
import type { XbkTab, XbkPagination } from "../types";

export const DEFAULT_PAGINATION: Record<XbkTab, XbkPagination> = {
  course_results: { page: 1, size: 50, total: 0 },
  students: { page: 1, size: 50, total: 0 },
  courses: { page: 1, size: 50, total: 0 },
  selections: { page: 1, size: 50, total: 0 },
  unselected: { page: 1, size: 50, total: 0 },
  suspended: { page: 1, size: 50, total: 0 },
};

export const useXbkPagination = () => {
  const [pg, setPg] = useState<Record<XbkTab, XbkPagination>>({ ...DEFAULT_PAGINATION });

  const updatePg = useCallback((tab: XbkTab, updates: Partial<XbkPagination>) => {
    setPg((prev) => {
      const nextTab = { ...prev[tab], ...updates };
      const prevTab = prev[tab];
      if (
        nextTab.page === prevTab.page &&
        nextTab.size === prevTab.size &&
        nextTab.total === prevTab.total
      ) {
        return prev;
      }
      return { ...prev, [tab]: nextTab };
    });
  }, []);

  const resetPg = useCallback((tab: XbkTab) => {
    setPg((prev) => ({ ...prev, [tab]: { ...DEFAULT_PAGINATION[tab] } }));
  }, []);

  return { pg, setPg, updatePg, resetPg };
};
