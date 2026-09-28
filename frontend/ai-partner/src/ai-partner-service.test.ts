import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), currentUser: vi.fn(), subscribe: vi.fn() }));
vi.mock('../../src/services/api', () => ({ api: { client: { get: mocks.get, post: mocks.post } }, authApi: { getCurrentUser: mocks.currentUser }, subscribeAuthIdentityChange: mocks.subscribe }));
import { aiPartnerService } from '../../src/services/aiPartner';
const signal = new AbortController().signal;
beforeEach(() => { vi.clearAllMocks(); });
describe('platform service boundary', () => {
  it.each([1, 42, '42'])('normalizes positive authenticated id %s to a number', async id => {
    mocks.currentUser.mockResolvedValue({ data: { id, full_name: '姓名', username: 'student-number' } });
    expect(await aiPartnerService.currentUser(signal)).toEqual({ id: Number(id), name: '姓名' });
    expect(mocks.currentUser).toHaveBeenCalledWith(expect.objectContaining({ signal, silent: true }));
  });
  it.each([0, -1, 1.5, null, undefined, '', '1.5', '-1', true, Number.MAX_SAFE_INTEGER + 1])('rejects non-positive/inexact id %s', async id => {
    mocks.currentUser.mockResolvedValue({ data: { id } }); await expect(aiPartnerService.currentUser(signal)).rejects.toThrow('ID');
  });
  it('unwraps platform responses without displaying the username/student number', async () => {
    mocks.currentUser.mockResolvedValue({ data: { data: { id: 8, username: '20260108' } } });
    expect(await aiPartnerService.currentUser(signal)).toEqual({ id: 8, name: '课堂参与者' });
  });
  it('rejects guest before exposing named leaderboard access', async () => {
    mocks.currentUser.mockResolvedValue({ data: { id: 8, role_code: 'guest' } });
    await expect(aiPartnerService.currentUser(signal)).rejects.toMatchObject({ response: { status: 403 } });
  });
  it('delegates identity subscription, GET and exact POST to platform client without another /api/v1', async () => {
    const board = { round_id: 'r', status: 'waiting', expires_at: null, rows: [] };
    mocks.get.mockResolvedValue({ data: board }); mocks.post.mockResolvedValue({ data: board });
    expect(aiPartnerService.subscribeIdentity).toBe(mocks.subscribe);
    expect(await aiPartnerService.getLeaderboard(signal)).toBe(board);
    const payload = { round_id: 'r', expected_user_id: 8, ai_name: '伙伴', evaluation_id: 'receipt' };
    expect(await aiPartnerService.submit(payload, signal)).toBe(board);
    expect(mocks.get).toHaveBeenCalledWith('/ai-partner/leaderboard', expect.objectContaining({ signal }));
    expect(mocks.post).toHaveBeenCalledWith('/ai-partner/leaderboard', payload, expect.objectContaining({ signal }));
  });
  it('requests server evaluation with shared auth and bounded model timeout', async () => {
    const payload = {round_id: 'r', expected_user_id: 8, ai_name: '伙伴', selected_ids: ['p01-01'], primary_feature: 'question', features: [], budget: 3000, reason: '取舍', test_plan: '核验', risk: '错误答案', paper_recorded: false, tested_core: false};
    const result = {evaluation_id: 'receipt', round_id: 'r', total: 50, level: '待完善', dimensions: [], suggestions: []};
    mocks.post.mockResolvedValue({data: result});
    expect(await aiPartnerService.evaluate(payload, signal)).toBe(result);
    expect(mocks.post).toHaveBeenCalledWith('/ai-partner/evaluate', payload, expect.objectContaining({signal, silent: true, timeout: 65000}));
    expect(payload).not.toHaveProperty('score'); expect(payload).not.toHaveProperty('api_key');
  });

});
