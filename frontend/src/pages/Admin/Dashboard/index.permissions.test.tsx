import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthState } from "@hooks/useAuth";
import AdminDashboard from "./index";

const mock = vi.hoisted(() => ({ get: vi.fn(), auth: {} as AuthState }));
vi.mock("@services", () => ({ api: { get: mock.get, client: { get: mock.get } }, config: { apiUrl: "/api/v1" } }));
vi.mock("@hooks/useAuth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@hooks/useAuth")>(),
  default: () => mock.auth,
}));

type Pending = {
  path: string;
  signal?: AbortSignal;
  resolve: (response: { data: unknown }) => void;
  reject: (error: unknown) => void;
};
let pending: Pending[];
const health = (version = "healthy-current") => ({
  status: "healthy", checks: { database: "healthy", redis: "healthy" },
  system: { version, environment: "Test" },
});
const overview = (users: number) => ({ counts: { users, articles: 23, agents: 7 } });
function identity(role: string, id = 1) {
  mock.auth = {
    user: { id, role_code: role, full_name: `Synthetic ${id}`, is_active: true, created_at: "", updated_at: "" },
    isAuthenticated: true, isLoading: false, error: null,
  };
}
async function request(path: string, index = 0) {
  await waitFor(() => expect(pending.filter((item) => item.path === path).length).toBeGreaterThan(index));
  return pending.filter((item) => item.path === path)[index];
}
async function resolve(item: Pending, data: unknown) {
  await act(async () => { item.resolve({ data }); });
}
async function reject(item: Pending, detail: string) {
  await act(async () => { item.reject({ response: { status: 403, data: { detail } } }); });
}
async function loaded(users = 101) {
  await resolve(await request("/health"), health());
  await resolve(await request("/system/overview"), overview(users));
}
const refresh = () => fireEvent.click(screen.getByRole("button", { name: "刷新" }));

beforeEach(() => {
  identity("super_admin");
  pending = [];
  mock.get.mockReset();
  // Deliberately ignore abort: verify the result gate even when transport cancellation loses a race.
  mock.get.mockImplementation((path: string, options?: { signal?: AbortSignal }) =>
    new Promise((resolve, reject) => pending.push({ path, signal: options?.signal, resolve, reject })),
  );
});
afterEach(cleanup);

describe("Dashboard permissions and request ownership", () => {
  it("admin only checks health, including refresh, and sees permission information rather than empty statistics", async () => {
    identity("admin");
    render(<AdminDashboard />);
    await resolve(await request("/health"), health());
    expect(pending.map((item) => item.path)).toEqual(["/health"]);
    expect(screen.queryByText("用户总数")).not.toBeInTheDocument();
    expect(screen.getByText(/仅超级管理员可查看系统统计/)).toBeInTheDocument();
    expect(screen.getByText("healthy-current")).toBeInTheDocument();
    refresh();
    await resolve(await request("/health", 1), health("admin-refreshed"));
    expect(pending.map((item) => item.path)).toEqual(["/health", "/health"]);
    expect(screen.getByText("admin-refreshed")).toBeInTheDocument();
  });

  it("super_admin requests and displays statistics and health", async () => {
    render(<AdminDashboard />);
    await loaded();
    expect(screen.getByText("用户总数")).toBeInTheDocument();
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getByText("healthy-current")).toBeInTheDocument();
  });

  it("hides already loaded statistics immediately on a same-user role downgrade", async () => {
    const view = render(<AdminDashboard />);
    await loaded();
    identity("admin");
    view.rerender(<AdminDashboard />);
    expect(screen.queryByText("101")).not.toBeInTheDocument();
    expect(screen.queryByText("用户总数")).not.toBeInTheDocument();
    await resolve(await request("/health", 1), health());
    expect(pending.filter((item) => item.path === "/system/overview")).toHaveLength(1);
  });

  it("discards late super_admin statistics after switching to admin", async () => {
    const view = render(<AdminDashboard />);
    await resolve(await request("/health"), health());
    const old = await request("/system/overview");
    identity("admin", 2);
    view.rerender(<AdminDashboard />);
    await resolve(old, overview(902));
    expect(screen.queryByText("902")).not.toBeInTheDocument();
    expect(screen.queryByText("用户总数")).not.toBeInTheDocument();
  });

  it("isolates different super_admin users and does not reuse earlier identity results on return", async () => {
    const view = render(<AdminDashboard />);
    await resolve(await request("/health"), health("identity-one"));
    const old = await request("/system/overview");
    identity("super_admin", 2);
    view.rerender(<AdminDashboard />);
    expect(screen.queryByText("identity-one")).not.toBeInTheDocument();
    await resolve(await request("/health", 1), health("identity-two"));
    await resolve(await request("/system/overview", 1), overview(202));
    await resolve(old, overview(901));
    expect(screen.getByText("202")).toBeInTheDocument();
    expect(screen.queryByText("901")).not.toBeInTheDocument();
    identity("super_admin", 1);
    view.rerender(<AdminDashboard />);
    expect(screen.queryByText("202")).not.toBeInTheDocument();
    expect(screen.queryByText("901")).not.toBeInTheDocument();
    await resolve(await request("/health", 2), health());
    await resolve(await request("/system/overview", 2), overview(303));
    expect(screen.getByText("303")).toBeInTheDocument();
  });

  it("starts overview after admin becomes super_admin", async () => {
    identity("admin");
    const view = render(<AdminDashboard />);
    await resolve(await request("/health"), health());
    expect(pending.filter((item) => item.path === "/system/overview")).toHaveLength(0);
    identity("super_admin");
    view.rerender(<AdminDashboard />);
    await resolve(await request("/health", 1), health());
    await resolve(await request("/system/overview"), overview(404));
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("reports an overview denial without empty cards and can recover by refresh", async () => {
    render(<AdminDashboard />);
    await resolve(await request("/health"), health());
    await reject(await request("/system/overview"), "overview denied");
    expect(screen.getByText("系统统计请求失败")).toBeInTheDocument();
    expect(screen.queryByText("用户总数")).not.toBeInTheDocument();
    expect(screen.getByText("healthy-current")).toBeInTheDocument();
    refresh();
    await resolve(await request("/health", 1), health());
    await resolve(await request("/system/overview", 1), overview(505));
    expect(screen.getByText("505")).toBeInTheDocument();
    expect(screen.queryByText("系统统计请求失败")).not.toBeInTheDocument();
  });

  it("does not let a late refresh success overwrite newer statistics", async () => {
    render(<AdminDashboard />);
    await loaded();
    refresh();
    await resolve(await request("/health", 1), health("older-refresh"));
    const old = await request("/system/overview", 1);
    refresh();
    await resolve(await request("/health", 2), health("newer-refresh"));
    await resolve(await request("/system/overview", 2), overview(606));
    await resolve(old, overview(903));
    expect(screen.getByText("606")).toBeInTheDocument();
    expect(screen.queryByText("903")).not.toBeInTheDocument();
    expect(screen.getByText("newer-refresh")).toBeInTheDocument();
  });

  it("does not let a late overview rejection erase newer statistics", async () => {
    render(<AdminDashboard />);
    await loaded();
    refresh();
    await resolve(await request("/health", 1), health());
    const old = await request("/system/overview", 1);
    refresh();
    await resolve(await request("/health", 2), health());
    await resolve(await request("/system/overview", 2), overview(707));
    await reject(old, "old denial");
    expect(screen.getByText("707")).toBeInTheDocument();
    expect(screen.queryByText("系统统计请求失败")).not.toBeInTheDocument();
  });

  it("ignores a late health failure and does not start follow-up requests from an obsolete refresh", async () => {
    render(<AdminDashboard />);
    await loaded();
    refresh();
    const oldHealth = await request("/health", 1);
    refresh();
    await resolve(await request("/health", 2), health("newest-health"));
    // Locate the newest overview in either sequential baseline or parallel implementation.
    const newestOverview = pending.filter((item) => item.path === "/system/overview").at(-1)!;
    await resolve(newestOverview, overview(808));
    const count = pending.length;
    await reject(oldHealth, "obsolete health denial");
    expect(screen.getByText("newest-health")).toBeInTheDocument();
    expect(screen.queryByText("obsolete health denial")).not.toBeInTheDocument();
    expect(pending).toHaveLength(count);
  });

  it.each(["loading", "signed-out"])("makes no requests or statistics visible while %s", async (state) => {
    mock.auth = { ...mock.auth, isLoading: state === "loading", isAuthenticated: state !== "signed-out" };
    render(<AdminDashboard />);
    await act(async () => {});
    expect(mock.get).not.toHaveBeenCalled();
    expect(screen.queryByText("用户总数")).not.toBeInTheDocument();
  });

  it("cancels pending work on unmount even if the transport later resolves", async () => {
    const view = render(<AdminDashboard />);
    const old = await request("/health");
    view.unmount();
    expect(old.signal?.aborted).toBe(true);
    const count = pending.length;
    await resolve(old, health());
    expect(pending).toHaveLength(count);
  });

  it("admin can recover a current health failure without requesting overview", async () => {
    identity("admin");
    render(<AdminDashboard />);
    await reject(await request("/health"), "health temporarily unavailable");
    expect(screen.getByText("健康检查请求失败")).toBeInTheDocument();
    refresh();
    await resolve(await request("/health", 1), health("health-recovered"));
    expect(screen.getByText("health-recovered")).toBeInTheDocument();
    expect(screen.queryByText("健康检查请求失败")).not.toBeInTheDocument();
    expect(pending.every((item) => item.path === "/health")).toBe(true);
  });

  it("discards a late denial from a different super_admin identity", async () => {
    const view = render(<AdminDashboard />);
    await resolve(await request("/health"), health());
    const old = await request("/system/overview");
    identity("super_admin", 2);
    view.rerender(<AdminDashboard />);
    await resolve(await request("/health", 1), health());
    await resolve(await request("/system/overview", 1), overview(909));
    await reject(old, "previous identity denial");
    expect(screen.getByText("909")).toBeInTheDocument();
    expect(screen.queryByText("系统统计请求失败")).not.toBeInTheDocument();
  });

  it("hides all loaded data on logout and rejects a pending refresh response", async () => {
    const view = render(<AdminDashboard />);
    await loaded();
    refresh();
    await resolve(await request("/health", 1), health());
    const old = await request("/system/overview", 1);
    mock.auth = { user: null, isAuthenticated: false, isLoading: false, error: null };
    view.rerender(<AdminDashboard />);
    expect(screen.queryByText("healthy-current")).not.toBeInTheDocument();
    expect(screen.queryByText("用户总数")).not.toBeInTheDocument();
    const count = pending.length;
    await resolve(old, overview(919));
    expect(screen.queryByText("919")).not.toBeInTheDocument();
    expect(pending).toHaveLength(count);
  });

  it("keeps a newer refresh pending when an obsolete request finishes, including late health success", async () => {
    render(<AdminDashboard />);
    await loaded();
    refresh();
    const oldHealth = await request("/health", 1);
    refresh();
    await resolve(await request("/health", 2), health("latest-health"));
    const count = pending.length;
    await resolve(oldHealth, health("stale-health"));
    expect(screen.getByText("latest-health")).toBeInTheDocument();
    expect(screen.queryByText("stale-health")).not.toBeInTheDocument();
    expect(pending).toHaveLength(count);
    // Older completion must not clear the current loading indicator.
    expect(screen.getByText("正在加载系统统计…")).toBeInTheDocument();
    await resolve(await request("/system/overview", 1), overview(929));
    expect(screen.getByText("正在加载系统统计…")).toBeInTheDocument();
    await resolve(await request("/system/overview", 2), overview(939));
    expect(screen.queryByText("正在加载系统统计…")).not.toBeInTheDocument();
    expect(screen.getByText("939")).toBeInTheDocument();
    expect(screen.queryByText("929")).not.toBeInTheDocument();
  });

  it("survives StrictMode effect cleanup without accepting its canceled requests", async () => {
    render(<React.StrictMode><AdminDashboard /></React.StrictMode>);
    await resolve(await request("/health", 1), health("strict-current"));
    const newestOverview = pending.filter((item) => item.path === "/system/overview").at(-1)!;
    await resolve(newestOverview, overview(949));
    await resolve(await request("/health"), health("strict-canceled"));
    expect(screen.getByText("strict-current")).toBeInTheDocument();
    expect(screen.queryByText("strict-canceled")).not.toBeInTheDocument();
    expect(screen.getByText("949")).toBeInTheDocument();
    expect(pending[0].signal?.aborted).toBe(true);
  });

});
