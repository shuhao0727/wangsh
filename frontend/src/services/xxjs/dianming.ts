import { api } from '../api';

export interface DianmingClass {
  year: string;
  class_name: string;
  count: number;
}

export interface DianmingStudent {
  id: number;
  year: string;
  class_name: string;
  student_name: string;
  student_no?: string;
  created_at: string;
}

export interface DianmingImportRequest {
  year: string;
  class_name: string;
  names_text: string;
}

const API_PREFIX = '/xxjs/dianming';

export const dianmingApi = {
  // 获取班级列表
  listClasses: async () => {
    const response = await api.client.get<DianmingClass[]>(`${API_PREFIX}/classes`);
    return response.data;
  },

  // 获取指定班级学生
  listStudents: async (year: string, class_name: string) => {
    const response = await api.client.get<DianmingStudent[]>(`${API_PREFIX}/students`, {
      params: { year, class_name },
    });
    return response.data;
  },

  // 批量导入学生
  importStudents: async (data: DianmingImportRequest) => {
    const response = await api.client.post<DianmingStudent[]>(`${API_PREFIX}/import`, data);
    return response.data;
  },
  
  // 更新班级学生名单 (覆盖)
  updateClassStudents: async (data: DianmingImportRequest) => {
    const response = await api.client.put<DianmingStudent[]>(`${API_PREFIX}/class/students`, data);
    return response.data;
  },

  // 删除班级
  deleteClass: async (year: string, class_name: string) => {
    const response = await api.client.delete<{ success: boolean }>(`${API_PREFIX}/class`, {
      params: { year, class_name },
    });
    return response.data;
  },
};
