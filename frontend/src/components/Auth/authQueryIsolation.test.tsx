import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuth, { AuthProvider, type User } from "@hooks/useAuth";
import { useUsersList } from "@hooks/queries/useUsersQuery";
import { queryKeys } from "@hooks/queries/queryKeys";
import type { UserListResponse } from "@services/users";

const mocks = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn(), me: vi.fn(), users: vi.fn() }));
vi.mock("@services", () => ({ authApi: { login: mocks.login, logout: mocks.logout, getCurrentUser: mocks.me } }));
vi.mock("@services/users", () => ({ userApi: { getUsers: mocks.users } }));
vi.mock("@services/api", () => ({
  subscribeAuthIdentityChange: vi.fn(() => () => {}),
  AUTH_EXPIRED_EVENT: "ws:auth-expired", clearPersistedAuthExpiredDetail: vi.fn(),
  extractAuthErrorDetail: vi.fn(() => ""), getPersistedAuthExpiredDetail: vi.fn(() => null),
  getStoredAccessToken: vi.fn(() => null), getCookieToken: vi.fn(() => null), notifyAuthExpired: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const user = (id: number, role_code: string): User => ({
  id, role_code, full_name: `user-${id}`, is_active: true, created_at: "", updated_at: "",
});
const A = user(9001, "super_admin");
const B = user(8001, "admin");
const params = { skip: 0, limit: 20 };
const listKey = queryKeys.users.list(params);
const records = (name: string): UserListResponse => ({
  users: [{ ...user(1, "student"), full_name: name, student_id: null, username: null, class_name: null, study_year: null }],
  total: 1, skip: 0, limit: 20, has_more: false,
});
let auth: ReturnType<typeof useAuth>;
let client: QueryClient;
let mutate: () => void;
let mutationResult: ReturnType<typeof deferred<UserListResponse>>;
let renders: { id: number | null; role: string | undefined; names: string[] }[];
const clients = new Set<QueryClient>();
function UserTable() {
  const { data } = useUsersList(params);
  const auth = useAuth();
  const names = data?.users.map((u) => u.full_name) ?? [];
  renders.push({ id: auth.user?.id ?? null, role: auth.user?.role_code, names });
  return <div data-testid="records">{names.join(",") || "pending"}</div>;
}
function Probe() {
  auth = useAuth();
  client = useQueryClient();
  clients.add(client);
  const capturedClient = client;
  const mutation = useMutation({
    mutationFn: () => mutationResult.promise,
    onSuccess: (data) => { capturedClient.setQueryData(listKey, data); },
  });
  mutate = () => mutation.mutate();
  return auth.isAuthenticated ? <UserTable /> : <div>guest</div>;
}
function mount(strict = false) {
  // The old application used one outer client; after the fix AuthProvider owns
  // the inner identity scope. Keep this wrapper to prove the pre-fix regression.
  const legacyClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } });
  clients.add(legacyClient);
  const app = <QueryClientProvider client={legacyClient}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>;
  render(strict ? <React.StrictMode>{app}</React.StrictMode> : app);
}
async function loginAs(identity: User) {
  mocks.me.mockResolvedValue({ data: identity });
  let result: Awaited<ReturnType<typeof auth.login>> | undefined;
  await act(async () => { result = await auth.login(identity.full_name, "synthetic"); });
  expect(result?.success).toBe(true);
}
async function expire() {
  await act(async () => { window.dispatchEvent(new CustomEvent("ws:auth-expired", { detail: { reason: "expired" } })); });
}
async function loadA(strict = false) {
  mount(strict);
  await loginAs(A);
  await screen.findByText("A privileged record");
}
function expectNoOldRender(identity = B) {
  const matching = renders.filter((r) => r.id === identity.id && r.role === identity.role_code);
  expect(matching.length).toBeGreaterThan(0);
  expect(matching.every((r) => !r.names.includes("A privileged record"))).toBe(true);
}

beforeEach(() => {
  vi.clearAllMocks(); renders = [];
  window.history.replaceState({}, "", "/login");
  mocks.login.mockResolvedValue({}); mocks.logout.mockResolvedValue({});
  mocks.users.mockResolvedValue(records("A privileged record"));
  mutationResult = deferred<UserListResponse>();
});
afterEach(() => {
  cleanup(); for (const c of clients) c.clear(); clients.clear();
});

describe("FE-04 identity-scoped business queries", () => {
  it("never renders A's fresh cached list when B logs in after expiry", async () => {
    await loadA(); const oldClient = client;
    await expire();
    const pendingB = deferred<UserListResponse>(); mocks.users.mockReturnValue(pendingB.promise);
    await loginAs(B);
    expectNoOldRender();
    expect(client).not.toBe(oldClient);
    expect(screen.getByTestId("records")).toHaveTextContent("pending");
    await act(async () => { pendingB.resolve(records("B student")); });
    await screen.findByText("B student"); expect(mocks.users).toHaveBeenCalledTimes(2);
  });

  it("isolates a direct account switch without an expiry event", async () => {
    await loadA(); mocks.users.mockResolvedValue(records("B student"));
    await loginAs(B); expectNoOldRender(); await screen.findByText("B student");
  });

  it("isolates permissions when /me changes the role of the same user", async () => {
    await loadA(); const downgraded = { ...A, role_code: "admin" };
    mocks.users.mockResolvedValue(records("limited records")); mocks.me.mockResolvedValue({ data: downgraded });
    await act(async () => { await auth.fetchCurrentUser(); });
    expectNoOldRender(downgraded); await screen.findByText("limited records");
  });

  it("keeps fresh data and mounted query scope for same-identity /me refresh", async () => {
    await loadA(); const before = client;
    mocks.me.mockResolvedValue({ data: { ...A, full_name: "Updated display name" } });
    await act(async () => { await auth.fetchCurrentUser(); });
    expect(client).toBe(before); expect(mocks.users).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("records")).toHaveTextContent("A privileged record");
  });

  it("starts a new scope when the same account logs in again after expiry", async () => {
    await loadA();
    const oldClient = client;
    await expire();
    expect(oldClient.getQueryData(listKey)).toBeUndefined();
    renders = [];
    mocks.users.mockResolvedValue(records("current records"));
    await loginAs(A);
    expect(client).not.toBe(oldClient);
    expectNoOldRender(A);
    await screen.findByText("current records");
  });

  it.each([
    { class_name: "new class" },
    { study_year: "2026-2027" },
  ])("isolates same-user permission scope changes: %j", async (scope) => {
    await loadA();
    const oldClient = client;
    renders = [];
    mocks.me.mockResolvedValue({ data: { ...A, ...scope } });
    mocks.users.mockResolvedValue(records("new scope records"));
    await act(async () => { await auth.fetchCurrentUser(); });
    expect(client).not.toBe(oldClient);
    expectNoOldRender(A);
    await screen.findByText("new scope records");
  });

  it("detaches the old scope immediately, even while logout HTTP is pending", async () => {
    await loadA(); const pending = deferred<void>(); mocks.logout.mockReturnValue(pending.promise);
    let logout!: Promise<void>;
    await act(async () => { logout = auth.logout(); });
    expect(auth.isAuthenticated).toBe(false); expect(screen.queryByTestId("records")).not.toBeInTheDocument();
    await act(async () => { pending.resolve(); await logout; });
  });

  it("does not let a delayed query ignoring AbortSignal refill B's scope", async () => {
    const lateA = deferred<UserListResponse>(); mocks.users.mockReturnValueOnce(lateA.promise);
    mount(); await loginAs(A); await waitFor(() => expect(mocks.users).toHaveBeenCalledOnce());
    const oldClient = client;
    await expire(); mocks.users.mockResolvedValue(records("B student")); await loginAs(B);
    await screen.findByText("B student");
    await act(async () => { lateA.resolve(records("A privileged record")); });
    expect(client).not.toBe(oldClient); expectNoOldRender();
    expect(client.getQueryData<UserListResponse>(listKey)?.users[0].full_name).toBe("B student");
  });

  it("contains a late mutation's setQueryData callback in the discarded client", async () => {
    await loadA(); await act(async () => { mutate(); }); const oldClient = client;
    await expire(); mocks.users.mockResolvedValue(records("B student")); await loginAs(B);
    await screen.findByText("B student");
    await act(async () => { mutationResult.resolve(records("A privileged record")); });
    expect(client).not.toBe(oldClient); expectNoOldRender();
    expect(client.getQueryData<UserListResponse>(listKey)?.users[0].full_name).toBe("B student");
  });

  it("clears the scope when a direct /me call fails with 401", async () => {
    await loadA(); const oldClient = client;
    mocks.me.mockRejectedValue({ response: { status: 401 } });
    await act(async () => { await auth.fetchCurrentUser(); });
    expect(auth.isAuthenticated).toBe(false); expect(client).not.toBe(oldClient);
    expect(client.getQueryData(listKey)).toBeUndefined();
  });

  it("keeps the first authenticated query usable under StrictMode", async () => {
    await loadA(true); expect(auth.user?.id).toBe(A.id);
    expect(client.getQueryData<UserListResponse>(listKey)?.users[0].full_name).toBe("A privileged record");
  });
});
