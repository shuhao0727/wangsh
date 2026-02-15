import { api } from "../api";

export type XbkScope = "students" | "courses" | "selections";
export type XbkExportType = "course-selection" | "teacher-distribution" | "distribution";

export interface XbkListResponse<T> {
  total: number;
  items: T[];
}

export interface XbkStudentRow {
  id: number;
  year: number;
  term: string;
  grade?: string | null;
  class_name: string;
  student_no: string;
  name: string;
  gender?: string | null;
}

export interface XbkCourseRow {
  id: number;
  year: number;
  term: string;
  grade?: string | null;
  course_code: string;
  course_name: string;
  teacher?: string | null;
  quota: number;
  location?: string | null;
}

export interface XbkSelectionRow {
  id: number;
  year: number;
  term: string;
  grade?: string | null;
  student_no: string;
  name?: string | null;
  course_code: string;
}

export interface XbkCourseResultRow {
  id: number;
  year: number;
  term: string;
  grade?: string | null;
  class_name?: string | null;
  student_no: string;
  student_name?: string | null;
  course_code: string;
  course_name?: string | null;
  teacher?: string | null;
  location?: string | null;
}

export interface XbkSummary {
  students: number;
  courses: number;
  selections: number;
  no_selection_students: number;
}

export interface XbkCourseStatItem {
  course_code: string;
  course_name?: string | null;
  count: number;
  quota?: number;
  class_count?: number;
  allowed_total?: number;
}

export interface XbkClassStatItem {
  class_name: string;
  count: number;
}

export interface XbkMeta {
  years: number[];
  terms: string[];
  classes: string[];
}

export interface XbkImportPreview {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  columns: string[];
  preview: Record<string, any>[];
  errors: { row: number; errors: string[] }[];
}

export interface XbkImportResult {
  total_rows: number;
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  invalid: number;
  errors: { row: number; errors: string[] }[];
}

export const xbkDataApi = {
  getMeta: async (params: { year?: number; term?: string } = {}): Promise<XbkMeta> => {
    const res = await api.client.get("/xbk/data/meta", { params });
    return res.data as XbkMeta;
  },

  downloadTemplate: async (params: { scope: XbkScope; grade?: string }): Promise<Blob> => {
    const res = await api.client.get("/xbk/import/template", {
      params,
      responseType: "blob",
    });
    return res.data as Blob;
  },

  previewImport: async (params: {
    scope: XbkScope;
    year?: number;
    term?: string;
    grade?: string;
    file: File;
  }): Promise<XbkImportPreview> => {
    const form = new FormData();
    form.append("file", params.file);
    const res = await api.client.post("/xbk/import/preview", form, {
      params: { scope: params.scope, year: params.year, term: params.term, grade: params.grade },
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data as XbkImportPreview;
  },

  listStudents: async (params: {
    year?: number;
    term?: string;
    grade?: string;
    class_name?: string;
    search_text?: string;
    page?: number;
    size?: number;
  }): Promise<XbkListResponse<XbkStudentRow>> => {
    const res = await api.client.get("/xbk/data/students", { params });
    return res.data as XbkListResponse<XbkStudentRow>;
  },

  listCourses: async (params: {
    year?: number;
    term?: string;
    grade?: string;
    search_text?: string;
    page?: number;
    size?: number;
  }): Promise<XbkListResponse<XbkCourseRow>> => {
    const res = await api.client.get("/xbk/data/courses", { params });
    return res.data as XbkListResponse<XbkCourseRow>;
  },

  createStudent: async (payload: Omit<XbkStudentRow, "id">): Promise<XbkStudentRow> => {
    const res = await api.client.post("/xbk/data/students", payload);
    return res.data as XbkStudentRow;
  },
  updateStudent: async (id: number, payload: Omit<XbkStudentRow, "id">): Promise<XbkStudentRow> => {
    const res = await api.client.put(`/xbk/data/students/${id}`, payload);
    return res.data as XbkStudentRow;
  },
  deleteStudent: async (id: number): Promise<{ deleted: number }> => {
    const res = await api.client.delete(`/xbk/data/students/${id}`);
    return res.data as { deleted: number };
  },

  createCourse: async (payload: Omit<XbkCourseRow, "id">): Promise<XbkCourseRow> => {
    const res = await api.client.post("/xbk/data/courses", payload);
    return res.data as XbkCourseRow;
  },
  updateCourse: async (id: number, payload: Omit<XbkCourseRow, "id">): Promise<XbkCourseRow> => {
    const res = await api.client.put(`/xbk/data/courses/${id}`, payload);
    return res.data as XbkCourseRow;
  },
  deleteCourse: async (id: number): Promise<{ deleted: number }> => {
    const res = await api.client.delete(`/xbk/data/courses/${id}`);
    return res.data as { deleted: number };
  },

  createSelection: async (payload: Omit<XbkSelectionRow, "id">): Promise<XbkSelectionRow> => {
    const res = await api.client.post("/xbk/data/selections", payload);
    return res.data as XbkSelectionRow;
  },
  updateSelection: async (id: number, payload: Omit<XbkSelectionRow, "id">): Promise<XbkSelectionRow> => {
    const res = await api.client.put(`/xbk/data/selections/${id}`, payload);
    return res.data as XbkSelectionRow;
  },
  deleteSelection: async (id: number): Promise<{ deleted: number }> => {
    const res = await api.client.delete(`/xbk/data/selections/${id}`);
    return res.data as { deleted: number };
  },

  listSelections: async (params: {
    year?: number;
    term?: string;
    grade?: string;
    class_name?: string;
    search_text?: string;
    page?: number;
    size?: number;
  }): Promise<XbkListResponse<XbkSelectionRow>> => {
    const res = await api.client.get("/xbk/data/selections", { params });
    return res.data as XbkListResponse<XbkSelectionRow>;
  },

  listCourseResults: async (params: {
    year?: number;
    term?: string;
    grade?: string;
    class_name?: string;
    search_text?: string;
    page?: number;
    size?: number;
  }): Promise<XbkListResponse<XbkCourseResultRow>> => {
    const res = await api.client.get("/xbk/data/course-results", { params });
    return res.data as XbkListResponse<XbkCourseResultRow>;
  },

  deleteData: async (params: {
    scope: "all" | XbkScope;
    year?: number;
    term?: string;
    grade?: string;
    class_name?: string;
  }): Promise<{ deleted: number }> => {
    const res = await api.client.delete("/xbk/data", { params });
    return res.data as { deleted: number };
  },

  importData: async (params: {
    scope: XbkScope;
    year?: number;
    term?: string;
    grade?: string;
    skip_invalid?: boolean;
    file: File;
  }): Promise<XbkImportResult> => {
    const form = new FormData();
    form.append("file", params.file);
    const res = await api.client.post("/xbk/import", form, {
      params: {
        scope: params.scope,
        year: params.year,
        term: params.term,
        grade: params.grade,
        skip_invalid: params.skip_invalid ?? true,
      },
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data as XbkImportResult;
  },

  exportData: async (params: {
    scope: XbkScope;
    year?: number;
    term?: string;
    class_name?: string;
    format?: "xlsx" | "xls";
  }): Promise<Blob> => {
    const res = await api.client.get("/xbk/export", {
      params,
      responseType: "blob",
    });
    return res.data as Blob;
  },

  exportTables: async (params: {
    export_type: XbkExportType;
    year: number;
    term: string;
    grade?: string;
    class_name?: string;
    yearStart?: number;
    yearEnd?: number;
  }): Promise<Blob> => {
    const res = await api.client.get(`/xbk/export/${params.export_type}`, {
      params: {
        year: params.year,
        term: params.term,
        grade: params.grade,
        class_name: params.class_name,
        yearStart: params.yearStart,
        yearEnd: params.yearEnd,
      },
      responseType: "blob",
    });
    return res.data as Blob;
  },

  getSummary: async (params: {
    year?: number;
    term?: string;
    class_name?: string;
  }): Promise<XbkSummary> => {
    const res = await api.client.get("/xbk/analysis/summary", { params });
    return res.data as XbkSummary;
  },

  getCourseStats: async (params: {
    year?: number;
    term?: string;
    grade?: string;
    class_name?: string;
  }): Promise<{ items: XbkCourseStatItem[] }> => {
    const res = await api.client.get("/xbk/analysis/course-stats", { params });
    return res.data as { items: XbkCourseStatItem[] };
  },

  getClassStats: async (params: {
    year?: number;
    term?: string;
    grade?: string;
  }): Promise<{ items: XbkClassStatItem[] }> => {
    const res = await api.client.get("/xbk/analysis/class-stats", { params });
    return res.data as { items: XbkClassStatItem[] };
  },

  getStudentsWithoutSelection: async (params: {
    year?: number;
    term?: string;
    grade?: string;
    class_name?: string;
  }): Promise<{ items: XbkStudentRow[] }> => {
    const res = await api.client.get("/xbk/analysis/students-without-selection", {
      params,
    });
    return res.data as { items: XbkStudentRow[] };
  },
};
