import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IdentityNotice } from '../../src/services/aiPartner';
const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), getLeaderboard: vi.fn(), submit: vi.fn(), evaluate: vi.fn(), subscribeIdentity: vi.fn() }));
vi.mock('../../src/services/aiPartner', () => ({ aiPartnerService: mocks }));
import { mountSelection } from './selection';
import { draftKeyFor } from './leaderboard-controller';
import { selectPart } from './selection-rules';
import type { Catalog } from './selection-rules';
import catalogData from './catalog.json';
const evaluation = { evaluation_id: 'evaluation-1', round_id: 'r', total: 82, level: '方案较完整',
  dimensions: ['价格与性价比', '完成度', '选择合理性', '验证与风险'].map((label, i) => ({key: String(i), label, score: 20, max: 25, note: '基于目录和任务说明'})), suggestions: ['补充实测依据'] };
let identity!: (notice: IdentityNotice) => void;
const flush = async () => { for (let i = 0; i < 14; i++) await Promise.resolve(); };
const input = (id: string, value: string) => { const el = document.getElementById(id) as HTMLInputElement; el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
const click = (id: string) => (document.getElementById(id) as HTMLButtonElement).click();
const disabled = (id: string) => (document.getElementById(id) as HTMLButtonElement).disabled;
const draft = (name: string, paperRecorded = false) => {
  const selected = ['p01-01', 'p02-01', 'p03-01', 'p04-01', 'p05-03', 'p06-01'].reduce((selection, id) => selectPart(catalogData as Catalog, selection, id).selected, {});
  return { selected, name, primaryFeature: 'organize', features: [], budget: null, reason: '', testPlan: '', risk: '', paperRecorded };
};
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  document.body.innerHTML = '<p id="journey-summary"></p><aside class="left-panel"><div id="module-list"></div></aside><aside class="right-panel"></aside><section class="stage-panel"><div class="stage-head"></div><div class="canvas-wrap"></div></section>';
  mocks.evaluate.mockResolvedValue(evaluation);
  mocks.currentUser.mockResolvedValue({ id: 11, name: '甲' });
  mocks.getLeaderboard.mockResolvedValue({ round_id: 'r', status: 'waiting', expires_at: null, rows: [] });
  mocks.submit.mockResolvedValue({ round_id: 'r', status: 'open', expires_at: '2099-01-01T00:00:00Z', rows: [] });
  mocks.subscribeIdentity.mockImplementation(cb => { identity = cb; return () => {}; });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { window.dispatchEvent(new Event('pagehide')); document.body.replaceChildren(); localStorage.clear(); });
describe('real selection UI integration (original catalog and server AI scoring)', () => {
  it('keeps essential controls and disclosures after copy simplification', async () => {
    mountSelection(vi.fn()); await flush();
    expect(document.querySelectorAll('.panel-subtitle, .guidance-kicker')).toHaveLength(0);
    const rules = document.querySelector<HTMLDetailsElement>('details.catalog-note')!;
    expect(rules.open).toBe(false);
    expect(rules.textContent).toContain('模型最多 3 项');
    expect(document.querySelector('.data-source')!.textContent).toContain('不验证真实性能与兼容性');
    expect(document.querySelector('.data-source')!.textContent).toContain('评分发送方案');
    for (const id of ['part-search', 'primary-options', 'feature-options', 'selection-budget',
      'run-test', 'run-checks', 'run-score', 'submit-score', 'show-leaderboard',
      'save-selection', 'restore-selection', 'export-report', 'export-selection']) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
    expect(disabled('submit-score')).toBe(true);
    expect(mocks.evaluate).not.toHaveBeenCalled();
  });

  it('renders server dimensions and the notesRecorded gate before an explicit platform POST', async () => {
    localStorage.setItem(draftKeyFor(11), JSON.stringify(draft('资料伙伴')));
    mountSelection(vi.fn()); await flush(); click('restore-selection'); click('run-test'); click('run-score'); await flush();
    expect(document.querySelectorAll('.score-dimensions li')).toHaveLength(4);
    expect(disabled('submit-score')).toBe(true); expect(mocks.submit).not.toHaveBeenCalled();
    input('selection-reason', '我优先考虑资料检索能力，并放弃额外的运动能力。');
    input('test-plan', '用三份资料测试检索结果，核对结果，失败时检查输入和索引。');
    click('run-score'); await flush(); expect(disabled('submit-score')).toBe(false);
    click('submit-score'); await flush();
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.submit.mock.calls[0][0]).toEqual({ round_id: 'r', expected_user_id: 11, ai_name: '资料伙伴', evaluation_id: 'evaluation-1' });
    expect(localStorage.getItem('ai-classmate-assessments-v1')).toBeNull();
  });
  it('accepts original paper-recorded alternative but requires a new core test after restore', async () => {
    localStorage.setItem(draftKeyFor(11), JSON.stringify(draft('纸面记录', true)));
    mountSelection(vi.fn()); await flush(); click('restore-selection'); click('run-score'); await flush(); expect(disabled('submit-score')).toBe(true);
    click('run-test'); click('run-score'); await flush(); expect(disabled('submit-score')).toBe(false);
    click('restore-selection'); expect(disabled('submit-score')).toBe(true);
  });
  it('does not adopt anonymous legacy drafts and clears notes, configuration, score on switch/logout', async () => {
    localStorage.setItem('ai-classmate-selection-v3', JSON.stringify(draft('匿名旧稿', true)));
    localStorage.setItem(draftKeyFor(11), JSON.stringify(draft('甲作品', true)));
    localStorage.setItem(draftKeyFor(22), JSON.stringify(draft('乙作品')));
    mountSelection(vi.fn()); await flush(); expect((document.getElementById('selection-name') as HTMLInputElement).value).toBe('');
    click('restore-selection'); click('run-test'); click('run-score'); await flush(); input('selection-reason', '甲的私人课堂记录');
    identity({ pending: true, hasToken: true });
    expect((document.getElementById('selection-name') as HTMLInputElement).value).toBe('');
    expect((document.getElementById('selection-reason') as HTMLTextAreaElement).value).toBe('');
    expect(document.querySelectorAll('.score-dimensions li')).toHaveLength(0);
    expect(disabled('submit-score')).toBe(true); expect(disabled('restore-selection')).toBe(true);
    mocks.currentUser.mockResolvedValue({ id: 22, name: '乙' }); identity({ pending: false, hasToken: true }); await flush();
    expect((document.getElementById('selection-name') as HTMLInputElement).value).toBe('');
    click('restore-selection'); expect((document.getElementById('selection-name') as HTMLInputElement).value).toBe('乙作品');
    identity({ pending: false, hasToken: false }); expect(disabled('submit-score')).toBe(true); expect((document.getElementById('selection-name') as HTMLInputElement).value).toBe('');
    expect(localStorage.getItem('ai-classmate-selection-v3')).toContain('匿名旧稿');
  });
  it('allows anonymous design but no AI request, named-board fetch, submission or save', async () => {
    mocks.currentUser.mockRejectedValue({ response: { status: 401 } }); mountSelection(vi.fn()); await flush();
    input('selection-name', '匿名设计'); click('run-score'); await flush(); expect(document.querySelectorAll('.score-dimensions li')).toHaveLength(0); expect(mocks.evaluate).not.toHaveBeenCalled();
    click('show-leaderboard'); await flush(); expect(mocks.getLeaderboard).not.toHaveBeenCalled();
    expect(disabled('submit-score')).toBe(true); expect(disabled('save-selection')).toBe(true);
    expect(document.querySelector<HTMLAnchorElement>('.partner-auth a')!.getAttribute('href')).toBe('/login?redirect=%2Fgames%2Fai-partner%2Findex.html');
  });
  it('never replaces a failed AI evaluation with a local score', async () => {
    localStorage.setItem(draftKeyFor(11), JSON.stringify(draft('未配置', true)));
    mocks.evaluate.mockRejectedValue({response: {status: 503}});
    mountSelection(vi.fn()); await flush(); click('restore-selection'); click('run-test'); click('run-score'); await flush();
    expect(document.getElementById('score-result')!.textContent).toContain('后台评分模型配置');
    expect(disabled('submit-score')).toBe(true); expect(document.querySelectorAll('.score-dimensions li')).toHaveLength(0);
  });
  it.each(['edit', 'identity', 'restore'])('discards in-flight scoring after %s and aborts its request', async action => {
    let resolve!: (v: typeof evaluation) => void;
    mocks.evaluate.mockReturnValue(new Promise(r => {resolve = r;}));
    localStorage.setItem(draftKeyFor(11), JSON.stringify(draft('评分中', true)));
    mountSelection(vi.fn()); await flush(); click('restore-selection'); click('run-test'); click('run-score'); await flush();
    expect(disabled('run-score')).toBe(true); expect(disabled('submit-score')).toBe(true);
    const signal = mocks.evaluate.mock.calls[0][1] as AbortSignal;
    if (action === 'edit') input('selection-reason', '修改方案');
    if (action === 'identity') identity({pending: true, hasToken: true});
    if (action === 'restore') click('restore-selection');
    expect(signal.aborted).toBe(true);
    resolve(evaluation); await flush();
    expect(document.querySelectorAll('.score-dimensions li')).toHaveLength(0); expect(disabled('submit-score')).toBe(true);
  });

  it('sends exact IDs and design evidence, ignores repeated clicks and escapes model prose', async () => {
    localStorage.setItem(draftKeyFor(11), JSON.stringify(draft('课堂方案', true)));
    mocks.evaluate.mockResolvedValue({...evaluation, level: '<img src=x onerror=alert(1)>', dimensions: [{key: 'price', label: '<script>bad</script>', score: 20, max: 25, note: '<img src=x>'}], suggestions: ['<svg onload=alert(1)>']});
    mountSelection(vi.fn()); await flush(); click('restore-selection'); click('run-test'); click('run-score'); click('run-score'); await flush();
    expect(mocks.evaluate).toHaveBeenCalledTimes(1);
    expect(mocks.evaluate.mock.calls[0][0]).toMatchObject({expected_user_id: 11, ai_name: '课堂方案', selected_ids: expect.arrayContaining(['p01-01','p02-01']), primary_feature: 'organize', budget: null, paper_recorded: true, tested_core: true});
    expect(mocks.evaluate.mock.calls[0][0]).not.toHaveProperty('score');
    expect(document.querySelector('#score-result img, #score-result script, #score-result svg')).toBeNull();
    click('run-test'); expect(disabled('submit-score')).toBe(true);
  });

});
