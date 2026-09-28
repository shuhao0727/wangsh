import type { AxiosRequestConfig } from 'axios';
import { api, authApi, subscribeAuthIdentityChange } from './api';

export type PartnerUser = { id: number; name: string };
export type Leaderboard = {
  round_id: string;
  status: 'waiting' | 'open' | 'ended';
  expires_at: string | null;
  rows: { rank: number; student_name: string; ai_name: string; score: number; is_me: boolean }[];
};
export type PartnerSubmission = { round_id: string; expected_user_id: number; ai_name: string; evaluation_id: string };
export type PartnerEvaluationRequest = {
  round_id: string;
  expected_user_id: number; ai_name: string; selected_ids: string[];
  primary_feature: string; features: string[]; budget: number | null;
  reason: string; test_plan: string; risk: string; paper_recorded: boolean; tested_core: boolean;
};
export type PartnerEvaluation = {
  evaluation_id: string; round_id: string; total: number; level: string;
  dimensions: { key: string; label: string; score: number; max: number; note: string }[];
  suggestions: string[];
};
export type IdentityNotice = { pending: boolean; hasToken: boolean };

// Use the platform's shared client, refresh coordination and identity events.
// Never read/parse credentials or introduce a second login/refresh implementation.
const requestConfig = (signal: AbortSignal) => ({ signal, silent: true, timeout: 8000 }) as AxiosRequestConfig & { silent: boolean };
export const aiPartnerService = {
  subscribeIdentity: subscribeAuthIdentityChange,
  async currentUser(signal: AbortSignal): Promise<PartnerUser> {
    const response = await authApi.getCurrentUser(requestConfig(signal));
    const user = response.data?.data ?? response.data;
    const rawId: unknown = user?.id;
    const id = typeof rawId === 'number' ? rawId : typeof rawId === 'string' && /^[1-9]\d*$/.test(rawId) ? Number(rawId) : NaN;
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid authenticated user ID');
    if (user.role_code === 'guest' || user.is_active === false) {
      throw Object.assign(new Error('Authenticated participant required'), { response: { status: 403 } });
    }
    const displayName = [user.full_name, user.name].find(value => typeof value === 'string' && value.trim());
    return { id, name: displayName?.trim() || '课堂参与者' };
  },
  async getLeaderboard(signal: AbortSignal): Promise<Leaderboard> {
    const response = await api.client.get<Leaderboard>('/ai-partner/leaderboard', {
      ...requestConfig(signal), headers: { 'Cache-Control': 'no-cache' },
    });
    return response.data;
  },
  async evaluate(payload: PartnerEvaluationRequest, signal: AbortSignal): Promise<PartnerEvaluation> {
    const response = await api.client.post<PartnerEvaluation>('/ai-partner/evaluate', payload, {
      ...requestConfig(signal), timeout: 65000,
    });
    return response.data;
  },
  async submit(payload: PartnerSubmission, signal: AbortSignal): Promise<Leaderboard> {
    const response = await api.client.post<Leaderboard>('/ai-partner/leaderboard', payload, requestConfig(signal));
    return response.data;
  },
};
