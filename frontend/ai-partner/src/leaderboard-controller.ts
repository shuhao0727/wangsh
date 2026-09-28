import type { IdentityNotice, Leaderboard, PartnerSubmission, PartnerUser, PartnerEvaluation } from '../../src/services/aiPartner';

export type PartnerGateway = {
  subscribeIdentity: (listener: (notice: IdentityNotice) => void) => () => void;
  currentUser: (signal: AbortSignal) => Promise<PartnerUser>;
  getLeaderboard: (signal: AbortSignal) => Promise<Leaderboard>;
  submit: (payload: PartnerSubmission, signal: AbortSignal) => Promise<Leaderboard>;
};
export type BoardState = {
  user: PartnerUser | null;
  verifying: boolean;
  open: boolean;
  visible: boolean;
  board: Leaderboard | null;
  loading: boolean;
  submitting: boolean;
  error: string;
  message: string;
};
const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
export const draftKeyFor = (id: number) => `ws-ai-partner-draft-v1:${encodeURIComponent(String(id))}`;
// Fixed allowlisted in-app destination, never a user-supplied return URL.
export const partnerLoginHref = `/login?redirect=${encodeURIComponent('/games/ai-partner/index.html')}`;

export class LeaderboardController {
  readonly state: BoardState = { user: null, verifying: true, open: false, visible: true, board: null, loading: false, submitting: false, error: '', message: '' };
  private epoch = 0;
  private readSequence = 0;
  private readTask: Promise<boolean> | null = null;
  private readAbort: AbortController | null = null;
  private authAbort: AbortController | null = null;
  private postAbort: AbortController | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<(state: BoardState) => void>();
  private disposed = false;

  constructor(private gateway: PartnerGateway, private resetDesign: () => void, private now: () => number = Date.now) {}

  subscribe(listener: (state: BoardState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }
  private emit() { for (const listener of this.listeners) listener(this.state); }
  start() {
    if (this.unsubscribe || this.disposed) return;
    let receivedNotice = false;
    this.unsubscribe = this.gateway.subscribeIdentity(notice => {
      receivedNotice = true;
      this.invalidateIdentity(notice.pending);
      if (!notice.pending && notice.hasToken) void this.verifyIdentity();
    });
    if (!receivedNotice) void this.verifyIdentity();
  }
  private cancelRead() {
    ++this.readSequence;
    this.readAbort?.abort();
    this.readAbort = null;
    this.readTask = null;
    this.state.loading = false;
  }
  private invalidateIdentity(verifying = false) {
    ++this.epoch;
    this.authAbort?.abort();
    this.postAbort?.abort();
    this.cancelRead();
    Object.assign(this.state, { user: null, verifying, board: null, submitting: false, error: '', message: '' });
    // Clear the previous participant's design, notes, score and rendered data
    // before starting another asynchronous /auth/me request.
    this.resetDesign();
    this.syncPolling();
    this.emit();
  }
  async verifyIdentity() {
    if (this.disposed) return;
    this.invalidateIdentity(true);
    const epoch = this.epoch;
    const abort = new AbortController();
    this.authAbort = abort;
    try {
      const user = await this.gateway.currentUser(abort.signal);
      if (!this.current(epoch) || abort.signal.aborted) return;
      this.state.user = user;
      this.state.verifying = false;
      this.state.error = '';
      this.emit();
      this.syncPolling();
      if (this.canPoll()) await this.refresh();
    } catch (error) {
      if (!this.current(epoch) || abort.signal.aborted) return;
      this.state.verifying = false;
      this.state.error = [401, 403].includes(statusOf(error) ?? 0) ? '' : '身份验证暂不可用，请稍后重试；仍可设计与评分。';
      this.emit();
    }
  }
  private current(epoch: number) { return !this.disposed && epoch === this.epoch; }
  private canPoll() { return !!this.state.user && this.state.open && this.state.visible && !this.disposed; }
  private syncPolling() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    if (this.canPoll()) this.interval = setInterval(() => {
      if (!this.state.submitting) void this.refresh();
    }, 5000);
  }
  setOpen(open: boolean) {
    this.state.open = open;
    if (!open) this.cancelRead();
    this.syncPolling();
    this.emit();
    if (this.canPoll()) void this.refresh();
  }
  setVisible(visible: boolean) {
    this.state.visible = visible;
    if (!visible) this.cancelRead();
    this.syncPolling();
    if (this.canPoll()) void this.refresh();
  }
  roundEnded() {
    const board = this.state.board;
    return !!board && (board.status === 'ended' || (board.expires_at !== null && Date.parse(board.expires_at) <= this.now()));
  }
  canSubmit() { return !!this.state.user && !this.state.verifying && !this.state.submitting && !this.roundEnded(); }

  refresh(force = false): Promise<boolean> {
    if (!this.canPoll()) return Promise.resolve(false);
    if (this.readTask && !force) return this.readTask;
    if (force) this.cancelRead();
    const epoch = this.epoch;
    const sequence = ++this.readSequence;
    const abort = new AbortController();
    this.readAbort = abort;
    this.state.loading = true;
    this.emit();
    const current = () => this.current(epoch) && sequence === this.readSequence && !abort.signal.aborted;
    const task = (async () => {
      try {
        const board = await this.gateway.getLeaderboard(abort.signal);
        if (!current()) return false;
        this.state.board = board;
        this.state.error = '';
        return true;
      } catch (error) {
        if (!current()) return false;
        this.handleError(error);
        return false;
      } finally {
        if (current()) {
          this.state.loading = false;
          this.readTask = null;
          this.emit();
        }
      }
    })();
    this.readTask = task;
    return task;
  }
  private handleError(error: unknown) {
    const status = statusOf(error);
    if (status === 401 || status === 403) {
      this.invalidateIdentity();
      this.state.error = '登录状态已失效，请登录后查看实名榜或提交。';
    } else if (status === 409) {
      this.state.board = null;
      this.state.error = '身份或轮次已变化，请重新确认身份与轮次后再次点击提交。';
    } else if (status === 410) {
      if (this.state.board) this.state.board = { ...this.state.board, status: 'ended' };
      this.state.error = '本轮已结束，不能再提交；不会自动转投新轮次。';
    } else {
      this.state.board = null;
      this.state.error = status === 503 ? '榜单暂不可用，请稍后重试；方案与评分仍可继续。' : '榜单请求失败，请稍后重试。';
    }
    this.emit();
  }
  async submit(aiName: string, evaluation: Pick<PartnerEvaluation, 'evaluation_id' | 'round_id'>, stillEligible: () => boolean): Promise<boolean> {
    if (!this.canSubmit() || !stillEligible() || !evaluation.evaluation_id || !evaluation.round_id) return false;
    const epoch = this.epoch;
    const user = this.state.user!;
    this.state.submitting = true;
    this.state.error = '';
    this.state.message = '';
    this.setOpen(true);
    try {
      // A first explicit click may load the round, but never submits into a
      // different round after a conflict/expiry or retries a POST automatically.
      if (!this.state.board && !(await this.refresh())) return false;
      if (!this.current(epoch) || !stillEligible() || this.roundEnded() || !this.state.board) return false;
      if (this.state.board.round_id !== evaluation.round_id) {
        this.state.error = '轮次已变化，请重新评分后再提交。'; this.emit(); return false;
      }
      const payload = { round_id: evaluation.round_id, expected_user_id: user.id, ai_name: aiName.trim() || '未命名', evaluation_id: evaluation.evaluation_id };
      this.cancelRead();
      const abort = new AbortController();
      this.postAbort = abort;
      const board = await this.gateway.submit(payload, abort.signal);
      if (!this.current(epoch) || abort.signal.aborted) return false;
      this.state.board = board;
      this.state.message = '已提交';
      this.emit();
      // Refresh immediately after POST; this supersedes any pre-submit GET.
      await this.refresh(true);
      return this.current(epoch);
    } catch (error) {
      if (!this.current(epoch)) return false;
      this.handleError(error);
      if (statusOf(error) === 409) {
        const recovery = this.verifyIdentity();
        const recoveryEpoch = this.epoch;
        await recovery;
        if (this.current(recoveryEpoch)) {
          this.state.error = '身份或轮次已变化，旧提交未自动重试；请检查后重新评分并点击提交。';
          this.emit();
        }
      }
      return false;
    } finally {
      if (this.current(epoch)) {
        this.state.submitting = false;
        this.emit();
      }
    }
  }
  dispose() {
    this.disposed = true;
    ++this.epoch;
    this.unsubscribe?.();
    this.authAbort?.abort();
    this.postAbort?.abort();
    this.cancelRead();
    if (this.interval) clearInterval(this.interval);
    this.listeners.clear();
  }
}
