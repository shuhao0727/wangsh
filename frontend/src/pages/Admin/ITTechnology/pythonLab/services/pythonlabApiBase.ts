import type { AxiosRequestConfig, AxiosResponse } from "axios";

import { api } from "@/services";

export const PYTHONLAB_V2_ROOT = "/api/v2/pythonlab";

export function pythonlabApiPath(path: string): string {
  if (!path) return PYTHONLAB_V2_ROOT;
  return path.startsWith("/") ? `${PYTHONLAB_V2_ROOT}${path}` : `${PYTHONLAB_V2_ROOT}/${path}`;
}

function withPythonlabBase(config?: AxiosRequestConfig): AxiosRequestConfig {
  return {
    ...config,
    baseURL: "",
  };
}

export const pythonlabV2Client = {
  get<T = unknown>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return api.client.get<T>(pythonlabApiPath(path), withPythonlabBase(config));
  },
  post<T = unknown>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return api.client.post<T>(pythonlabApiPath(path), data, withPythonlabBase(config));
  },
};
