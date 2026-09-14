import axios, { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiService from "./api";

// Real Axios instance/interceptors/dispatch; only transport is controlled. No .env or network.
vi.mock("./config", () => ({ config: { apiUrl: "https://auth-race.invalid/api/v1", features: { debug: false } } }));
vi.mock("./logger", () => ({ logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

type PendingRequest = {
  config: InternalAxiosRequestConfig;
  reply: (status: number, data?: unknown) => void;
};
const observe = <T,>(promise: Promise<T>) => promise.then(
  value => ({ value, error: undefined }),
  (error: unknown) => ({ value: undefined, error }),
);
const flush = async () => { for (let i = 0; i < 30; i += 1) await Promise.resolve(); };

let service: typeof ApiService;
let requests: PendingRequest[];
let expired: ReturnType<typeof vi.fn<(event: Event) => void>>;
let originalAdapter: typeof service.api.client.defaults.adapter;

const next = async (url: string, index = 0) => {
  await vi.waitFor(() => expect(requests.filter(r => r.config.url === url).length).toBeGreaterThan(index), { interval: 1 });
  return requests.filter(r => r.config.url === url)[index];
};
const expectToken = (token: string | null) => {
  expect(service.getStoredAccessToken()).toBe(token);
  expect(localStorage.getItem("ws_access_token")).toBe(token);
  expect(sessionStorage.getItem("ws_access_token")).toBe(token);
};
const expectNoExpiry = () => {
  expect(expired).not.toHaveBeenCalled();
  expect(service.getPersistedAuthExpiredDetail()).toBeNull();
};
const loginB = async () => {
  const login = service.authApi.login("B", "synthetic-password");
  (await next("/auth/login")).reply(200, { access_token: "B" });
  await login;
  expectToken("B");
};
const startRefreshA = async () => {
  const result = observe(service.api.get("/private"));
  (await next("/private")).reply(401, { detail: "A expired" });
  return { result, refresh: await next("/auth/refresh") };
};

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "ws_access_token=; Max-Age=0; path=/";
  service = await import("./api");
  service.clearPersistedAuthExpiredDetail();
  requests = [];
  originalAdapter = service.api.client.defaults.adapter;
  const adapter: AxiosAdapter = config => new Promise((resolve, reject) => {
    requests.push({ config, reply(status, data = {}) {
      const response: AxiosResponse = { config, data, status, statusText: String(status), headers: new AxiosHeaders() };
      if (status >= 400) reject(new AxiosError(`HTTP ${status}`, AxiosError.ERR_BAD_RESPONSE, config, {}, response));
      else resolve(response);
    } });
  });
  service.api.client.defaults.adapter = adapter;
  expired = vi.fn<(event: Event) => void>();
  window.addEventListener(service.AUTH_EXPIRED_EVENT, expired);
  service.authTokenStorage.set("A");
});
afterEach(async () => {
  // Drain the real event replay before replacing this module/listener in the next case.
  if (vi.isFakeTimers()) await vi.runOnlyPendingTimersAsync();
  else await new Promise(resolve => setTimeout(resolve, 0));
  window.removeEventListener(service.AUTH_EXPIRED_EVENT, expired);
  service.api.client.defaults.adapter = originalAdapter;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("auth identity races through the real Axios adapter", () => {
  it("isolates storage synchronously at logout and preserves A Authorization for revocation", async () => {
    const logout = observe(service.authApi.logout());
    const immediateToken = service.getStoredAccessToken();
    const request = await next("/auth/logout");
    request.reply(200);
    await logout;
    expect(immediateToken).toBeNull();
    expect(request.config.headers.get("Authorization")).toBe("Bearer A");
    expectToken(null);
  });

  it.each([200, 500, 503])("late logout %s cannot clear a new B login", async status => {
    const logout = observe(service.authApi.logout());
    const request = await next("/auth/logout");
    await loginB();
    request.reply(status);
    await logout;
    expectToken("B");
    expectNoExpiry();
  });

  it("late refresh success cannot resurrect A after logout or retry the old request", async () => {
    const { result, refresh } = await startRefreshA();
    const logout = service.authApi.logout();
    (await next("/auth/logout")).reply(200);
    await logout;
    refresh.reply(200, { access_token: "A-refreshed" });
    await flush();
    // Drain a buggy retry as well, so the RED test fails assertions rather than hanging.
    requests.filter(r => r.config.url === "/private").slice(1).forEach(r => r.reply(200));
    const outcome = await result;
    expectToken(null);
    expect(axios.isCancel(outcome.error)).toBe(true);
    expect(requests.filter(r => r.config.url === "/private")).toHaveLength(1);
    expectNoExpiry();
  });

  it.each([200, 401, 500])("A refresh %s after B login cannot overwrite/clear B, retry or expire B", async status => {
    const { result, refresh } = await startRefreshA();
    await loginB();
    refresh.reply(status, status === 200 ? { data: { access_token: "A-refreshed" } } : { detail: "A expired" });
    await flush();
    requests.filter(r => r.config.url === "/private").slice(1).forEach(r => r.reply(200));
    const outcome = await result;
    expectToken("B");
    expect(axios.isCancel(outcome.error)).toBe(true);
    expect(requests.filter(r => r.config.url === "/private")).toHaveLength(1);
    expectNoExpiry();
  });

  it.each([200, 401])("late ordinary A response %s is canceled, never retried under B", async status => {
    const result = observe(service.api.get("/private"));
    const request = await next("/private");
    await loginB();
    request.reply(status, { owner: "A" });
    await flush();
    requests.filter(r => r.config.url === "/private").slice(1).forEach(r => r.reply(200));
    expect(axios.isCancel((await result).error)).toBe(true);
    expect(requests.filter(r => r.config.url === "/private")).toHaveLength(1);
    expectNoExpiry();
  });

  it("direct refreshToken callers cannot receive obsolete tokens to store after B login", async () => {
    const result = observe(service.authApi.refreshToken().then(resp => {
      service.authTokenStorage.set(resp.data.access_token);
      return resp;
    }));
    const refresh = await next("/auth/refresh");
    await loginB();
    refresh.reply(200, { access_token: "A-refreshed" });
    expect(axios.isCancel((await result).error)).toBe(true);
    expectToken("B");
  });

  it("late login A cannot replace newer login B even without an AbortSignal", async () => {
    const a = observe(service.authApi.login("A", "synthetic-password"));
    const aRequest = await next("/auth/login");
    const b = service.authApi.login("B", "synthetic-password");
    (await next("/auth/login", 1)).reply(200, { access_token: "B" });
    await b;
    aRequest.reply(200, { access_token: "A-late" });
    expect(axios.isCancel((await a).error)).toBe(true);
    expectToken("B");
  });

  it("login AbortSignal (the useAuth AuthRequestGate contract) prevents token commit", async () => {
    const controller = new AbortController();
    const login = observe(service.authApi.login("B", "synthetic-password", { signal: controller.signal }));
    const request = await next("/auth/login");
    controller.abort();
    request.reply(200, { access_token: "B" });
    expect(axios.isCancel((await login).error)).toBe(true);
    expectToken("A");
  });

  it("logout invalidates a pending login response", async () => {
    const login = observe(service.authApi.login("B", "synthetic-password"));
    const request = await next("/auth/login");
    const logout = service.authApi.logout();
    (await next("/auth/logout")).reply(200);
    await logout;
    request.reply(200, { access_token: "B" });
    expect(axios.isCancel((await login).error)).toBe(true);
    expectToken(null);
  });

  it("keeps same-identity single-flight refresh and successful authorized retries", async () => {
    const first = observe(service.api.get("/private"));
    const second = observe(service.api.get("/private"));
    (await next("/private", 0)).reply(401);
    (await next("/private", 1)).reply(401);
    const refresh = await next("/auth/refresh");
    await flush();
    expect(requests.filter(r => r.config.url === "/auth/refresh")).toHaveLength(1);
    expect(JSON.parse(refresh.config.data)).toEqual({});
    expect(refresh.config.withCredentials).toBe(true);
    refresh.reply(200, { access_token: "A-refreshed" });
    const retry1 = await next("/private", 2);
    const retry2 = await next("/private", 3);
    expect(retry1.config.headers.get("Authorization")).toBe("Bearer A-refreshed");
    expect(retry2.config.headers.get("Authorization")).toBe("Bearer A-refreshed");
    retry1.reply(200);
    retry2.reply(200);
    expect((await first).error).toBeUndefined();
    expect((await second).error).toBeUndefined();
    expectToken("A-refreshed");
    expectNoExpiry();
  });

  it("current refresh failure still clears tokens and emits the original expiry reason", async () => {
    const { result, refresh } = await startRefreshA();
    refresh.reply(401, { detail: "Refresh expired" });
    expect((await result).error).toBeInstanceOf(AxiosError);
    expectToken(null);
    expect(expired).toHaveBeenCalled();
    expect(service.getPersistedAuthExpiredDetail()).toBe("A expired");
  });

  it("guest 401 still does not refresh or emit expired", async () => {
    service.authTokenStorage.clear();
    const result = observe(service.api.get("/private"));
    (await next("/private")).reply(401);
    await result;
    expect(requests.filter(r => r.config.url === "/auth/refresh")).toHaveLength(0);
    expectNoExpiry();
  });

  it("dispatches one event and allows its persisted detail to be consumed only once", () => {
    service.notifyAuthExpired("你的账号已在其他地方登录");

    expect(expired).toHaveBeenCalledTimes(1);
    expect(service.consumeAuthExpiredDetail()).toMatchObject({
      reason: "你的账号已在其他地方登录",
      kind: "replaced",
    });
    expect(service.consumeAuthExpiredDetail()).toBeNull();
    expect(sessionStorage.getItem("ws_auth_expired_detail")).toBeNull();
    expect(localStorage.getItem("ws_auth_expired_detail")).toBeNull();
  });

  it("deduplicates the same immediate auth-expired notification without queuing a replay", () => {
    service.notifyAuthExpired("A expired");
    service.notifyAuthExpired("A expired");

    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("does not replay legacy localStorage text or expired sessionStorage events", () => {
    localStorage.setItem("ws_auth_expired_detail", "你的账号已在其他地方登录");
    expect(service.consumeAuthExpiredDetail()).toBeNull();
    expect(localStorage.getItem("ws_auth_expired_detail")).toBeNull();

    sessionStorage.setItem("ws_auth_expired_detail", JSON.stringify({
      reason: "你的账号已在其他地方登录",
      kind: "replaced",
      at: Date.now() - 60_001,
      eventId: "expired-event",
    }));
    expect(service.consumeAuthExpiredDetail()).toBeNull();
    expect(sessionStorage.getItem("ws_auth_expired_detail")).toBeNull();
  });

  it("does not dispatch refresh after logout during the cooldown", async () => {
    vi.useFakeTimers();
    localStorage.setItem("ws_refresh_attempt_at", String(Date.now()));
    const result = observe(service.authApi.refreshToken());
    await flush();
    const logout = observe(service.authApi.logout());
    await flush();
    requests.find(r => r.config.url === "/auth/logout")!.reply(200);
    await logout;
    await vi.advanceTimersByTimeAsync(5300);
    requests.filter(r => r.config.url === "/auth/refresh").forEach(r => r.reply(200));
    expect(axios.isCancel((await result).error)).toBe(true);
    expect(requests.filter(r => r.config.url === "/auth/refresh")).toHaveLength(0);
  });
});

// Additional same-generation and overlapping-flight contracts; no production network.
describe("refresh ownership and logout failure contracts", () => {
  it("current logout 503 propagates failure but leaves storage isolated", async () => {
    const logout = observe(service.authApi.logout());
    const request = await next("/auth/logout");
    expectToken(null);
    request.reply(503, { detail: "revocation not confirmed" });
    expect(((await logout).error as AxiosError).response?.status).toBe(503);
    expectToken(null);
    expectNoExpiry();
  });

  it("old refresh finally cannot release B's independent in-flight refresh", async () => {
    const a = await startRefreshA();
    await loginB();
    localStorage.removeItem("ws_refresh_attempt_at");
    sessionStorage.removeItem("ws_refresh_attempt_at");
    const b = observe(service.api.get("/b"));
    (await next("/b")).reply(401);
    const bRefresh = await next("/auth/refresh", 1);
    a.refresh.reply(200, { access_token: "A-late" });
    expect(axios.isCancel((await a.result).error)).toBe(true);
    const b2 = observe(service.api.get("/b2"));
    (await next("/b2")).reply(401);
    await flush();
    expect(requests.filter(r => r.config.url === "/auth/refresh")).toHaveLength(2);
    bRefresh.reply(200, { access_token: "B-refreshed" });
    const r1 = await next("/b", 1);
    const r2 = await next("/b2", 1);
    expect(r1.config.headers.get("Authorization")).toBe("Bearer B-refreshed");
    expect(r2.config.headers.get("Authorization")).toBe("Bearer B-refreshed");
    r1.reply(200);
    r2.reply(200);
    expect((await b).error).toBeUndefined();
    expect((await b2).error).toBeUndefined();
    expectToken("B-refreshed");
  });

  it("canceling one refresh waiter does not clear the session or cancel other waiters", async () => {
    const controller = new AbortController();
    const canceled = observe(service.api.get("/private", { signal: controller.signal }));
    (await next("/private")).reply(401);
    const refresh = await next("/auth/refresh");
    const live = observe(service.api.get("/live"));
    (await next("/live")).reply(401);
    await flush();
    controller.abort();
    refresh.reply(200, { access_token: "A-refreshed" });
    (await next("/live", 1)).reply(200);
    expect(axios.isCancel((await canceled).error)).toBe(true);
    expect((await live).error).toBeUndefined();
    expect(requests.filter(r => r.config.url === "/private")).toHaveLength(1);
    expectToken("A-refreshed");
    expectNoExpiry();
  });

  it("same-identity token rotation permits only one latest-token retry", async () => {
    const result = observe(service.api.get("/private"));
    const original = await next("/private");
    service.authTokenStorage.set("A-rotated");
    original.reply(401);
    const retry = await next("/private", 1);
    expect(retry.config.headers.get("Authorization")).toBe("Bearer A-rotated");
    retry.reply(401);
    expect((await result).error).toBeInstanceOf(AxiosError);
    expect(requests.filter(r => r.config.url === "/private")).toHaveLength(2);
    expect(requests.filter(r => r.config.url === "/auth/refresh")).toHaveLength(0);
    expectNoExpiry();
  });

  it("work started during B login cannot overwrite B when login succeeds", async () => {
    const login = service.authApi.login("B", "synthetic-password");
    const loginRequest = await next("/auth/login");
    const a = await startRefreshA();
    loginRequest.reply(200, { access_token: "B" });
    await login;
    a.refresh.reply(200, { access_token: "A-late" });
    expect(axios.isCancel((await a.result).error)).toBe(true);
    expectToken("B");
    expectNoExpiry();
  });

  it.each([200, 429])("current 429 retry preserves cooldown and final %s policy", async status => {
    vi.useFakeTimers();
    const result = observe(service.api.get("/private"));
    await flush();
    requests[0].reply(401);
    await flush();
    requests[1].reply(429);
    await flush();
    expect(requests.filter(r => r.config.url === "/auth/refresh")).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5199);
    expect(requests.filter(r => r.config.url === "/auth/refresh")).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    requests.filter(r => r.config.url === "/auth/refresh")[1].reply(status, { access_token: "A-refreshed" });
    await flush();
    if (status === 200) {
      requests.filter(r => r.config.url === "/private")[1].reply(200);
      expect((await result).error).toBeUndefined();
      expectToken("A-refreshed");
    } else {
      expect((await result).error).toBeInstanceOf(AxiosError);
      expectToken("A");
    }
    expectNoExpiry();
  });

  it("identity change cancels a 429 cooldown retry before another refresh is sent", async () => {
    vi.useFakeTimers();
    const result = observe(service.api.get("/private"));
    await flush();
    requests[0].reply(401);
    await flush();
    requests[1].reply(429);
    await flush();
    const login = service.authApi.login("B", "synthetic-password");
    await flush();
    requests.find(r => r.config.url === "/auth/login")!.reply(200, { access_token: "B" });
    await login;
    await vi.advanceTimersByTimeAsync(5300);
    expect(axios.isCancel((await result).error)).toBe(true);
    expect(requests.filter(r => r.config.url === "/auth/refresh")).toHaveLength(1);
    expectToken("B");
    expectNoExpiry();
  });
});

describe("pending login isolates prior-identity refresh effects", () => {
  for (const refreshStatus of [200, 401, 500]) {
    for (const loginStatus of [200, 401]) {
      it.each([true, false])(`refresh ${refreshStatus}, login ${loginStatus}, refresh settles first=%s`, async refreshFirst => {
        const login = observe(service.authApi.login("B", "synthetic-password"));
        const loginRequest = await next("/auth/login");
        const a = await startRefreshA();
        expect(requests.find(r => r.config.url === "/private")!.config.headers.get("Authorization")).toBe("Bearer A");
        if (refreshFirst) {
          a.refresh.reply(refreshStatus, { access_token: "A-late", detail: "A refresh failed" });
          await flush();
          // Drain a buggy successful retry without weakening the no-retry assertion.
          requests.filter(r => r.config.url === "/private").slice(1).forEach(r => r.reply(200));
          await a.result;
        }
        loginRequest.reply(loginStatus, { access_token: "B", detail: "B login rejected" });
        const outcome = await login;
        if (!refreshFirst) {
          a.refresh.reply(refreshStatus, { access_token: "A-late", detail: "A refresh failed" });
          await flush();
          requests.filter(r => r.config.url === "/private").slice(1).forEach(r => r.reply(200));
        }
        const aOutcome = await a.result;
        if (loginStatus === 200) expect(outcome.error).toBeUndefined();
        else {
          expect(axios.isCancel(outcome.error)).toBe(false);
          expect((outcome.error as AxiosError).response?.status).toBe(401);
        }
        expectToken(loginStatus === 200 ? "B" : "A");
        expect(axios.isCancel(aOutcome.error)).toBe(true);
        expect(requests.filter(r => r.config.url === "/private")).toHaveLength(1);
        await new Promise(resolve => setTimeout(resolve, 0));
        expectNoExpiry();
      });
    }
  }

  it("direct refresh cannot commit A during pending login, including when login fails", async () => {
    const login = observe(service.authApi.login("B", "synthetic-password"));
    const loginRequest = await next("/auth/login");
    const refresh = observe(service.authApi.refreshToken().then(response => {
      service.authTokenStorage.set(response.data.access_token);
      return response;
    }));
    (await next("/auth/refresh")).reply(200, { access_token: "A-late" });
    const outcome = await refresh;
    loginRequest.reply(401);
    await login;
    expect(axios.isCancel(outcome.error)).toBe(true);
    expectToken("A");
    expectNoExpiry();
  });

  it("failed login preserves A and releases the pending fence for a new ordinary refresh", async () => {
    const login = observe(service.authApi.login("B", "synthetic-password"));
    (await next("/auth/login")).reply(401);
    expect(((await login).error as AxiosError).response?.status).toBe(401);
    expectToken("A");
    expectNoExpiry();
    const a = await startRefreshA();
    a.refresh.reply(200, { access_token: "A-refreshed" });
    const retry = await next("/private", 1);
    expect(retry.config.headers.get("Authorization")).toBe("Bearer A-refreshed");
    retry.reply(200);
    expect((await a.result).error).toBeUndefined();
    expectToken("A-refreshed");
    expectNoExpiry();
  });

  it("older login finally cannot release the newer pending login fence", async () => {
    const older = observe(service.authApi.login("old", "synthetic-password"));
    const olderRequest = await next("/auth/login");
    const login = observe(service.authApi.login("B", "synthetic-password"));
    const loginRequest = await next("/auth/login", 1);
    olderRequest.reply(401);
    expect(axios.isCancel((await older).error)).toBe(true);
    const a = await startRefreshA();
    a.refresh.reply(401);
    await a.result;
    loginRequest.reply(200, { access_token: "B" });
    expect((await login).error).toBeUndefined();
    expectToken("B");
    expectNoExpiry();
  });
});

describe("cross-tab identity fence", () => {
  it("rejects old me success before the remote storage event is delivered", async () => {
    const result = observe(service.authApi.getCurrentUser());
    const me = await next("/auth/me");
    localStorage.setItem("ws_access_token", "B");
    me.reply(200, { id: "A" });
    expect(axios.isCancel((await result).error)).toBe(true);
    expect(service.getStoredAccessToken()).toBe("B");
  });

  it("does not let A refresh failure clear remotely installed B", async () => {
    const { result, refresh } = await startRefreshA();
    localStorage.setItem("ws_access_token", "B");
    refresh.reply(401, { detail: "A expired" });
    expect(axios.isCancel((await result).error)).toBe(true);
    expect(service.getStoredAccessToken()).toBe("B");
    expectNoExpiry();
  });

  it("remote logout never falls back to this tab's stale session token", async () => {
    const result = observe(service.authApi.getCurrentUser());
    const me = await next("/auth/me");
    localStorage.removeItem("ws_access_token");
    me.reply(200, { id: "A" });
    expect(axios.isCancel((await result).error)).toBe(true);
    expect(service.getStoredAccessToken()).toBeNull();
    expect(sessionStorage.getItem("ws_access_token")).toBeNull();
  });

  it("remote login start fences an in-flight local login even before token publication", async () => {
    const result = observe(service.authApi.login("local", "synthetic"));
    const login = await next("/auth/login");
    localStorage.setItem("ws_auth_identity", JSON.stringify({ id: "remote-attempt", phase: "pending" }));
    login.reply(200, { access_token: "stale-local" });
    expect(axios.isCancel((await result).error)).toBe(true);
    expect(service.getStoredAccessToken()).not.toBe("stale-local");
  });
});

it("remote pending login blocks new private traffic, then accepts same-token settlement", async () => {
  localStorage.setItem("ws_auth_identity", JSON.stringify({ id: "remote-pending", phase: "pending" }));
  const blocked = await observe(service.api.get("/private"));
  expect(axios.isCancel(blocked.error)).toBe(true);
  expect(requests).toHaveLength(0);
  localStorage.setItem("ws_auth_identity", JSON.stringify({ id: "remote-settled", phase: "settled" }));
  const allowed = observe(service.api.get("/private"));
  (await next("/private")).reply(200, { identity: "A" });
  expect((await allowed).error).toBeUndefined();
});

it("remote same-token ABA still rejects earlier work via identity marker", async () => {
  const result = observe(service.authApi.getCurrentUser());
  const me = await next("/auth/me");
  localStorage.setItem("ws_auth_identity", JSON.stringify({ id: "new-A-session", phase: "settled" }));
  me.reply(200, { id: "old-A" });
  expect(axios.isCancel((await result).error)).toBe(true);
  expect(service.getStoredAccessToken()).toBe("A");
});

it("a tab opened during remote pending login cannot refresh its cookies", async () => {
  localStorage.setItem("ws_auth_identity", JSON.stringify({ id: "remote-pending", phase: "pending" }));
  const result = await observe(service.authApi.refreshToken());
  expect(axios.isCancel(result.error)).toBe(true);
  expect(requests).toHaveLength(0);
});

it("logs method, safe path, status and server detail in the first error line", async () => {
  const { logger } = await import("./logger");
  vi.mocked(logger.error).mockClear();
  const detail = "活动 10「for语句」未设置班级，无法用于课堂计划";
  const result = observe(
    service.api.post("/classroom/plans/admin/3/start?source=console", {}),
  );

  (await next("/classroom/plans/admin/3/start?source=console")).reply(400, { detail });

  expect((await result).error).toBeInstanceOf(AxiosError);
  expect(logger.error).toHaveBeenCalledWith(
    `❌ API 错误响应: POST /classroom/plans/admin/3/start 400 - ${detail}`,
    {
      method: "POST",
      url: "/classroom/plans/admin/3/start",
      status: 400,
      data: { detail },
    },
  );
});
