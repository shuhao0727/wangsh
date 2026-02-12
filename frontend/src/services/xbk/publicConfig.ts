import { api } from "../api";

export interface XbkPublicConfig {
  enabled: boolean;
}

export const xbkPublicConfigApi = {
  get: async (): Promise<XbkPublicConfig> => {
    const res = await api.client.get("/xbk/public-config");
    return res.data as XbkPublicConfig;
  },
  set: async (enabled: boolean): Promise<XbkPublicConfig> => {
    const res = await api.client.put("/xbk/public-config", { enabled });
    return res.data as XbkPublicConfig;
  },
};

