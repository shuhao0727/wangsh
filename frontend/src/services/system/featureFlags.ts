import { api } from '../api';

export interface FeatureFlag {
  id?: number;
  key: string;
  value: any;
  updated_at?: string;
}

const API_PREFIX = '/system';

export const featureFlagsApi = {
  // 获取所有功能开关 (Admin)
  list: async () => {
    const response = await api.client.get<FeatureFlag[]>(`${API_PREFIX}/feature-flags`);
    return response.data;
  },

  // 获取单个功能开关 (Admin)
  get: async (key: string) => {
    const response = await api.client.get<FeatureFlag>(`${API_PREFIX}/feature-flags/${key}`);
    return response.data;
  },

  // 创建或更新功能开关 (Admin)
  save: async (data: FeatureFlag) => {
    const response = await api.client.post<FeatureFlag>(`${API_PREFIX}/feature-flags`, data);
    return response.data;
  },

  // 获取公开的功能开关 (Public)
  getPublic: async (key: string) => {
    // 注意：这里调用的是 /system/public/feature-flags/{key}
    // 如果后端需要鉴权排除，请确保该接口在 api.ts 中没有被拦截器阻挡（通常 GET 请求带 token 也没事，只要后端允许）
    const response = await api.client.get<FeatureFlag>(`${API_PREFIX}/public/feature-flags/${key}`);
    return response.data;
  }
};
