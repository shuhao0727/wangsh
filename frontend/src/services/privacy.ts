import { api } from "./api";

export type ConsentType = "AI_USAGE" | "DATA_ANALYSIS";

export interface ConsentState {
  consent_type: ConsentType;
  consented: boolean | null;
  consented_at: string | null;
  updated_at: string | null;
}

const BASE = "/users/privacy/me/consents";

export const privacyApi = {
  list: async (): Promise<ConsentState[]> => {
    const response = await api.get<ConsentState[]>(BASE);
    return response.data.data ?? [];
  },
  update: async (consentType: ConsentType, consented: boolean): Promise<ConsentState> => {
    const response = await api.put<ConsentState>(`${BASE}/${consentType}`, { consented });
    return response.data.data;
  },
  withdraw: async (consentType: ConsentType): Promise<ConsentState> => {
    const response = await api.delete<ConsentState>(`${BASE}/${consentType}`);
    return response.data.data;
  },
};