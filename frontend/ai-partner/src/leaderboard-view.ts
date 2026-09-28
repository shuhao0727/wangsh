import type { LeaderboardController } from './leaderboard-controller';
import { partnerLoginHref } from './leaderboard-controller';

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
  const node = document.createElement(tag);
  node.innerText = text;
  if (className) node.className = className;
  return node;
};
const button = (text: string) => { const node = element('button', text); node.type = 'button'; return node; };

/** A non-modal dialog keeps the Three scene usable; close/Escape restores focus. */
export function mountLeaderboard(controller: LeaderboardController, authHost: HTMLElement) {
  document.body.classList.add('partner-board-enabled');
  const root = element('div', '', 'partner-floating');
  const launcher = button('榜单');
  launcher.className = 'partner-launcher';
  launcher.setAttribute('aria-controls', 'partner-leaderboard');
  launcher.setAttribute('aria-haspopup', 'dialog');
  const panel = element('section', '', 'partner-panel');
  panel.id = 'partner-leaderboard';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'partner-board-title');
  panel.tabIndex = -1;
  const header = element('header');
  const title = element('h2', '榜单'); title.id = 'partner-board-title';
  const close = button('×'); close.setAttribute('aria-label', '关闭榜单');
  header.append(title, close);
  const status = element('p', '', 'partner-round');
  const feedback = element('p', '', 'partner-feedback'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
  const refresh = button('刷新榜单');
  refresh.addEventListener('click', () => { void controller.refresh(true); });
  const content = element('div', '', 'partner-table-wrap');
  const table = element('table');
  table.setAttribute('aria-labelledby', 'partner-board-title');
  const head = element('thead'); const headings = element('tr');
  for (const label of ['名次', '姓名', '作品名', '分数']) { const th = element('th', label); th.scope = 'col'; headings.append(th); }
  head.append(headings);
  const body = element('tbody');
  table.append(head, body); content.append(table);
  const empty = element('p', '', 'partner-empty');
  panel.append(header, status, feedback, refresh, content, empty);
  root.append(panel, launcher); document.body.append(root);

  authHost.classList.add('partner-auth');
  const identity = element('span');
  const login = element('a', '登录后查看 / 提交'); login.href = partnerLoginHref;
  const retryAuth = button('重新验证身份');
  retryAuth.addEventListener('click', () => { void controller.verifyIdentity(); });
  authHost.append(identity, login, retryAuth);
  let previousFocus: HTMLElement | null = null;
  let wasOpen = false;
  const show = () => { previousFocus = document.activeElement as HTMLElement; controller.setOpen(true); };
  const hide = () => controller.setOpen(false);
  launcher.addEventListener('click', () => controller.state.open ? hide() : show());
  close.addEventListener('click', hide);
  const onEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && controller.state.open && !document.querySelector('dialog[open]')) {
      event.preventDefault(); hide();
    }
  };
  document.addEventListener('keydown', onEscape);
  const unsubscribe = controller.subscribe(state => {
    panel.hidden = !state.open;
    launcher.setAttribute('aria-expanded', String(state.open));
    if (state.open && !wasOpen) { previousFocus ??= document.activeElement as HTMLElement; close.focus(); }
    if (!state.open && wasOpen) { (previousFocus?.isConnected ? previousFocus : launcher).focus(); previousFocus = null; }
    wasOpen = state.open;
    identity.innerText = state.verifying ? '正在验证平台身份…' : state.user ? state.user.name : '未登录';
    login.hidden = !!state.user || state.verifying;
    retryAuth.hidden = !!state.user || !state.error;
    retryAuth.disabled = state.verifying;
    refresh.hidden = !state.user;
    refresh.disabled = state.loading || state.submitting;
    feedback.innerText = state.error;
    feedback.hidden = !state.error;
    feedback.classList.toggle('partner-error', !!state.error);
    body.replaceChildren();
    // Server ranks are authoritative: do not re-rank ties or sort by time.
    for (const row of state.user ? state.board?.rows ?? [] : []) {
      const tr = element('tr');
      if (row.is_me) { tr.className = 'partner-me'; tr.setAttribute('aria-label', '我的作品'); }
      for (const value of [String(row.rank), row.student_name + (row.is_me ? '（我）' : ''), row.ai_name, String(row.score)]) {
        tr.append(element('td', value)); // innerText, never interpolate participant data into HTML.
      }
      body.append(tr);
    }
    content.hidden = !state.user || !state.board?.rows.length;
    empty.hidden = !content.hidden || !!state.error;
    empty.innerText = state.verifying ? '正在验证身份…' : !state.user ? '请先登录' : state.loading && !state.board ? '正在加载…' : '暂无成绩';
    status.hidden = !state.user || !state.board || !controller.roundEnded();
    status.innerText = status.hidden ? '' : '本轮已结束';
  });
  const visibility = () => controller.setVisible(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', visibility);
  visibility();
  return {
    show,
    dispose() {
      unsubscribe(); root.remove(); authHost.replaceChildren();
      document.body.classList.remove('partner-board-enabled');
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
