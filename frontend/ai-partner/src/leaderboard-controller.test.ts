import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaderboardController, draftKeyFor, partnerLoginHref } from './leaderboard-controller';
import type { PartnerGateway } from './leaderboard-controller';
import type { IdentityNotice, Leaderboard, PartnerUser } from '../../src/services/aiPartner';

const receipt = { evaluation_id: 'evaluation-1', round_id: 'round-1' };
const waiting = (): Leaderboard => ({ round_id: 'round-1', status: 'waiting', expires_at: null, rows: [] });
const opened = (): Leaderboard => ({ ...waiting(), status: 'open', expires_at: '2026-09-28T11:00:00Z', rows: [
  { rank: 1, student_name: '甲', ai_name: '伙伴甲', score: 95, is_me: true },
  { rank: 1, student_name: '乙', ai_name: '伙伴乙', score: 95, is_me: false },
] });
const deferred = <T,>() => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const error = (status: number) => ({ response: { status } });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let controllers: LeaderboardController[] = [];
function setup(initialNotice?: IdentityNotice) {
  let identity!: (notice: IdentityNotice) => void;
  const gateway = {
    subscribeIdentity: vi.fn((cb: typeof identity) => { identity = cb; if (initialNotice) cb(initialNotice); return vi.fn(); }),
    currentUser: vi.fn(async () => ({ id: 11, name: '甲' }) as PartnerUser),
    getLeaderboard: vi.fn(async () => waiting()),
    submit: vi.fn(async () => opened()),
  } satisfies PartnerGateway;
  const reset = vi.fn();
  const controller = new LeaderboardController(gateway, reset);
  controllers.push(controller);
  return { controller, gateway, reset, identity: (notice: IdentityNotice) => identity(notice) };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-28T10:00:00Z')); });
afterEach(() => { controllers.forEach(c => c.dispose()); controllers = []; vi.useRealTimers(); });

describe('platform identity and explicit submission', () => {
  it('does not read a named leaderboard until identity is verified and panel is open', async () => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush();
    expect(c.state.user?.id).toBe(11); expect(g.getLeaderboard).not.toHaveBeenCalled(); expect(g.submit).not.toHaveBeenCalled();
    c.setOpen(true); await flush(); expect(g.getLeaderboard).toHaveBeenCalledTimes(1);
  });
  it.each([{ pending: true, hasToken: true }, { pending: false, hasToken: false }])('honors an initial pending/logout notice %o', async notice => {
    const { controller: c, gateway: g } = setup(notice); c.start(); c.setOpen(true); await flush();
    expect(g.currentUser).not.toHaveBeenCalled(); expect(g.getLeaderboard).not.toHaveBeenCalled();
    expect(await c.submit('匿名', receipt, () => true)).toBe(false); expect(g.submit).not.toHaveBeenCalled();
  });
  it('keeps anonymous design/scoring available after 401 without reading the leaderboard', async () => {
    const { controller: c, gateway: g } = setup(); g.currentUser.mockRejectedValue(error(401)); c.start(); await flush(); c.setOpen(true);
    expect(c.state.verifying).toBe(false); expect(c.canSubmit()).toBe(false); expect(g.getLeaderboard).not.toHaveBeenCalled();
  });
  it('fences old /me results during switching, even if transport ignores abort', async () => {
    const { controller: c, gateway: g, identity, reset } = setup(); const old = deferred<PartnerUser>();
    g.currentUser.mockReturnValueOnce(old.promise); c.start();
    identity({ pending: true, hasToken: true }); expect(reset).toHaveBeenCalled(); expect(c.state.user).toBeNull();
    g.currentUser.mockResolvedValue({ id: 22, name: '乙' }); identity({ pending: false, hasToken: true }); await flush();
    old.resolve({ id: 11, name: '甲' }); await flush(); expect(c.state.user?.id).toBe(22);
  });
  it('clears previous rows and rejects stale GET after logout', async () => {
    const { controller: c, gateway: g, identity, reset } = setup(); c.start(); await flush();
    const old = deferred<Leaderboard>(); g.getLeaderboard.mockReturnValueOnce(old.promise); c.setOpen(true);
    identity({ pending: false, hasToken: false }); expect(c.state.user).toBeNull(); expect(c.state.board).toBeNull(); expect(reset).toHaveBeenCalled();
    old.resolve(opened()); await flush(); expect(c.state.board).toBeNull(); expect(c.canSubmit()).toBe(false);
  });
  it('uses exact frozen POST fields and immediately refreshes, without auto-submitting on open', async () => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush(); c.setOpen(true); await flush();
    expect(g.submit).not.toHaveBeenCalled(); g.getLeaderboard.mockResolvedValue(opened());
    expect(await c.submit('  我的伙伴  ', receipt, () => true)).toBe(true);
    expect(g.submit).toHaveBeenCalledWith({ round_id: 'round-1', expected_user_id: 11, ai_name: '我的伙伴', evaluation_id: 'evaluation-1' }, expect.any(AbortSignal));
    expect(g.getLeaderboard.mock.calls.length).toBeGreaterThanOrEqual(2); expect(c.state.board?.rows.map(r => r.rank)).toEqual([1, 1]);
  });
  it('loads round on a first explicit click and rejects duplicate clicks', async () => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush(); const post = deferred<Leaderboard>(); g.submit.mockReturnValue(post.promise);
    const first = c.submit('甲', receipt, () => true); await flush();
    expect(await c.submit('甲', receipt, () => true)).toBe(false); expect(g.submit).toHaveBeenCalledTimes(1);
    post.resolve(opened()); await first;
  });
  it('rejects score submission without completion/notes gate and invalid score values', async () => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush();
    expect(await c.submit('甲', receipt, () => false)).toBe(false);
    for (const invalid of [{...receipt, evaluation_id: ''}, {...receipt, round_id: ''}, {...receipt, round_id: 'old-round'}]) expect(await c.submit('甲', invalid, () => true)).toBe(false);
    expect(g.submit).not.toHaveBeenCalled();
  });
  it('rechecks completion/notes after asynchronous round fetch', async () => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush(); const read = deferred<Leaderboard>(); g.getLeaderboard.mockReturnValue(read.promise);
    let eligible = true; const submission = c.submit('甲', receipt, () => eligible); eligible = false; read.resolve(waiting());
    expect(await submission).toBe(false); expect(g.submit).not.toHaveBeenCalled();
  });
  it('discards POST response after account switch and never refreshes old identity', async () => {
    const { controller: c, gateway: g, identity } = setup(); c.start(); await flush(); c.setOpen(true); await flush();
    const post = deferred<Leaderboard>(); g.submit.mockReturnValue(post.promise); const submitting = c.submit('甲', receipt, () => true); await flush();
    identity({ pending: true, hasToken: true }); const reads = g.getLeaderboard.mock.calls.length;
    post.resolve(opened()); expect(await submitting).toBe(false); expect(g.getLeaderboard).toHaveBeenCalledTimes(reads);
    expect(c.state.board).toBeNull(); expect(c.state.message).toBe('');
  });
  it('invalidates pre-submit GET so it cannot overwrite a POST result', async () => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush(); c.setOpen(true); await flush();
    const old = deferred<Leaderboard>(); g.getLeaderboard.mockReturnValueOnce(old.promise); void c.refresh();
    g.getLeaderboard.mockResolvedValue(opened()); await c.submit('甲', receipt, () => true); old.resolve(waiting()); await flush();
    expect(c.state.board?.status).toBe('open');
  });
});

describe('polling and frozen round failures', () => {
  it('polls every five seconds only when open and visible, resumes immediately', async () => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush(); c.setOpen(true); await flush();
    await vi.advanceTimersByTimeAsync(10000); expect(g.getLeaderboard).toHaveBeenCalledTimes(3);
    c.setVisible(false); await vi.advanceTimersByTimeAsync(20000); expect(g.getLeaderboard).toHaveBeenCalledTimes(3);
    c.setVisible(true); await flush(); expect(g.getLeaderboard).toHaveBeenCalledTimes(4);
    c.setOpen(false); await vi.advanceTimersByTimeAsync(20000); expect(g.getLeaderboard).toHaveBeenCalledTimes(4);
  });
  it('aborts in-flight GET on close and ignores its later result', async () => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush(); const read = deferred<Leaderboard>(); g.getLeaderboard.mockReturnValue(read.promise);
    c.setOpen(true); const signal = (g.getLeaderboard.mock.calls as unknown as [AbortSignal][])[0][0]; c.setOpen(false);
    expect(signal.aborted).toBe(true); read.resolve(opened()); await flush(); expect(c.state.board).toBeNull();
  });
  it.each([503, 410, 409])('handles POST %s explicitly and never auto-retries POST', async status => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush(); c.setOpen(true); await flush(); g.submit.mockRejectedValue(error(status));
    expect(await c.submit('甲', receipt, () => true)).toBe(false); expect(g.submit).toHaveBeenCalledTimes(1);
    expect(c.state.error).toContain(status === 503 ? '榜单暂不可用' : status === 410 ? '本轮已结束' : '身份或轮次已变化');
  });
  it('403 clears private data and disables submit', async () => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush(); g.getLeaderboard.mockRejectedValue(error(403)); c.setOpen(true); await flush();
    expect(c.state.board).toBeNull(); expect(c.state.user).toBeNull(); expect(c.canSubmit()).toBe(false);
  });
  it('blocks expired/ended rounds and does not invent a new sixty-minute window', async () => {
    const { controller: c, gateway: g } = setup(); c.start(); await flush(); g.getLeaderboard.mockResolvedValue({ ...opened(), expires_at: '2026-09-28T09:00:00Z' }); c.setOpen(true); await flush();
    expect(c.roundEnded()).toBe(true); expect(await c.submit('甲', receipt, () => true)).toBe(false); expect(g.submit).not.toHaveBeenCalled();
  });
  it('uses account-isolated draft keys and a fixed same-origin login return path', () => {
    expect(draftKeyFor(11)).not.toBe(draftKeyFor(22)); expect(draftKeyFor(11)).toBe('ws-ai-partner-draft-v1:11');
    const login = new URL(partnerLoginHref, 'https://school.example');
    expect(login.origin).toBe('https://school.example'); expect(login.pathname).toBe('/login'); expect(login.searchParams.get('redirect')).toBe('/games/ai-partner/index.html');
  });
});
