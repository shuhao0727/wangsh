import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeaderboardController } from './leaderboard-controller';
import { mountLeaderboard } from './leaderboard-view';
import { readFileSync } from 'node:fs';
import type { Leaderboard } from '../../src/services/aiPartner';
const leaderboardCss = readFileSync(`${__dirname}/leaderboard.css`, 'utf8');
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
let dispose: () => void = () => {};
afterEach(() => { dispose(); document.body.replaceChildren(); });
describe('floating leaderboard accessibility and text safety', () => {
  it('renders untrusted names as innerText, preserves ties, highlights is_me, restores focus on Escape', async () => {
    document.body.innerHTML = '<div id="auth"></div>';
    const board: Leaderboard = { round_id: 'r', status: 'waiting', expires_at: null, rows: [
      { rank: 1, student_name: '<img src=x onerror=alert(1)>', ai_name: '<script>evil()</script>', score: 90, is_me: true },
      { rank: 1, student_name: '乙', ai_name: '乙的作品', score: 90, is_me: false },
    ] };
    const c = new LeaderboardController({ subscribeIdentity: () => () => {}, currentUser: async () => ({ id: 1, name: '<b>甲</b>' }), getLeaderboard: async () => board, submit: vi.fn() }, vi.fn());
    const view = mountLeaderboard(c, document.getElementById('auth')!); dispose = () => { view.dispose(); c.dispose(); };
    c.start(); await flush(); const launch = document.querySelector<HTMLButtonElement>('.partner-launcher')!;
    launch.focus(); launch.click(); await flush();
    expect(launch.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[aria-label="关闭榜单"]')).toBe(document.activeElement);
    expect(document.querySelectorAll('.partner-panel tbody tr')).toHaveLength(2);
    expect(document.querySelector('.partner-me td:nth-child(2)')?.innerText).toContain('<img src=x');
    expect(document.querySelectorAll('.partner-floating img, .partner-floating script, #auth b')).toHaveLength(0);
    expect([...document.querySelectorAll<HTMLTableCellElement>('tbody tr td:first-child')].map(td => td.innerText)).toEqual(['1', '1']);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('partner-leaderboard')!.hidden).toBe(true);
    expect(document.activeElement).toBe(launch);
  });
  it('clears rendered participant names immediately on an identity event', async () => {
    document.body.innerHTML = '<div id="auth"></div>'; let change!: (notice: { pending: boolean; hasToken: boolean }) => void;
    const c = new LeaderboardController({ subscribeIdentity: cb => { change = cb; return () => {}; }, currentUser: async () => ({ id: 1, name: '甲' }), getLeaderboard: async () => ({ round_id: 'r', status: 'waiting', expires_at: null, rows: [{ rank: 1, student_name: '甲', ai_name: '甲作品', score: 80, is_me: true }] }), submit: vi.fn() }, vi.fn());
    const view = mountLeaderboard(c, document.getElementById('auth')!); dispose = () => { view.dispose(); c.dispose(); };
    c.start(); await flush(); c.setOpen(true); await flush(); expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
    change({ pending: true, hasToken: true }); expect(document.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(document.querySelector<HTMLAnchorElement>('#auth a')!.hidden).toBe(true);
  });
});


describe('compact desktop leaderboard', () => {
  const mount = (overrides: Partial<LeaderboardController['state']> = {}) => {
    document.body.innerHTML = '<div id="auth"></div>';
    const controller = new LeaderboardController({
      subscribeIdentity: () => () => {}, currentUser: vi.fn(),
      getLeaderboard: vi.fn(), submit: vi.fn(),
    }, vi.fn());
    Object.assign(controller.state, {
      user: { id: 1, name: '甲' }, verifying: false,
      board: { round_id: 'r', status: 'waiting', expires_at: null, rows: [
        { rank: 1, student_name: '甲', ai_name: '作品', score: 90, is_me: true },
      ] }, ...overrides,
    });
    const view = mountLeaderboard(controller, document.getElementById('auth')!);
    controller.setVisible(false); // UI-only state checks never start network polling.
    dispose = () => { view.dispose(); controller.dispose(); };
    const launch = document.querySelector<HTMLButtonElement>('.partner-launcher')!;
    launch.focus(); launch.click();
    return { controller, launch };
  };

  it.each(['waiting', 'open'] as const)('shows only the board controls and rows in the %s state', status => {
    const { controller, launch } = mount({ message: '已提交；榜单仅保留每人最高分，同分并列。' });
    controller.state.board!.status = status;
    controller.setOpen(true);
    expect(launch.innerText).toBe('榜单');
    expect(document.querySelector('h2')?.innerText).toBe('榜单');
    expect(document.querySelector('.partner-hint, .partner-panel caption')).toBeNull();
    expect(document.querySelector<HTMLElement>('.partner-round')!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.partner-feedback')!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.partner-feedback')!.innerText).toBe('');
    expect(document.querySelector<HTMLElement>('.partner-empty')!.hidden).toBe(true);
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(document.querySelector('table')?.getAttribute('aria-labelledby')).toBe('partner-board-title');
  });

  it('preserves concise empty and logged-out states', () => {
    const { controller } = mount({ board: { round_id: 'r', status: 'waiting', expires_at: null, rows: [] } });
    const empty = document.querySelector<HTMLElement>('.partner-empty')!;
    expect(empty.hidden).toBe(false);
    expect(empty.innerText).toBe('暂无成绩');
    controller.state.user = null;
    controller.setOpen(true);
    expect(empty.innerText).toBe('请先登录');
    expect(document.querySelector<HTMLAnchorElement>('#auth a')!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.partner-table-wrap')!.hidden).toBe(true);
  });

  it('keeps errors announced without duplicate empty or success text', () => {
    const { controller } = mount({ board: null, error: '榜单请求失败，请稍后重试。', message: '已提交' });
    const feedback = document.querySelector<HTMLElement>('.partner-feedback')!;
    expect(feedback.hidden).toBe(false);
    expect(feedback.innerText).toBe('榜单请求失败，请稍后重试。');
    expect(feedback.classList.contains('partner-error')).toBe(true);
    expect(feedback.getAttribute('aria-live')).toBe('polite');
    expect(document.querySelector<HTMLElement>('.partner-empty')!.hidden).toBe(true);
    controller.state.error = '';
    controller.setOpen(true);
    expect(feedback.hidden).toBe(true);
    expect(feedback.innerText).toBe('');
    expect(document.querySelector<HTMLElement>('.partner-empty')!.hidden).toBe(false);
  });

  it('keeps the ended-round notice and closes with focus restored', () => {
    const { launch } = mount({ board: { round_id: 'r', status: 'ended', expires_at: null, rows: [] } });
    const status = document.querySelector<HTMLElement>('.partner-round')!;
    expect(status.hidden).toBe(false);
    expect(status.innerText).toBe('本轮已结束');
    const close = document.querySelector<HTMLButtonElement>('[aria-label="关闭榜单"]')!;
    expect(document.activeElement).toBe(close);
    close.click();
    expect(document.querySelector<HTMLElement>('.partner-panel')!.hidden).toBe(true);
    expect(launch.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(launch);
    launch.click();
    expect(document.activeElement).toBe(close);
    launch.click();
    expect(document.activeElement).toBe(launch);
    expect(document.querySelector<HTMLElement>('.partner-panel')!.hidden).toBe(true);
  });

  it('anchors both launcher and panel at the upper left without bottom/right overrides', () => {
    for (const selector of ['.partner-floating .partner-launcher', '.partner-panel']) {
      const block = leaderboardCss.split(selector + ' {')[1].split('}')[0];
      expect(block).toContain('position: fixed');
      expect(block).toContain('left: max(20px, env(safe-area-inset-left))');
      expect(block).toContain('top:');
      expect(block).not.toMatch(/(?:^|[;\s])(?:right|bottom):/);
    }
    expect(leaderboardCss).not.toContain('@media');
    expect(leaderboardCss).toContain('var(--ws-color-primary)');
    expect(leaderboardCss).toContain(':focus-visible');
  });
});
