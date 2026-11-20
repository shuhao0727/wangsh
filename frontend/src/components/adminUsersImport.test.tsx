import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsers from "@/pages/Admin/Users";
import { userApi, type User } from "@services/users";
import { showMessage } from "@/lib/toast";

// Real AdminUsers input/event handler, useUsers and TanStack mutation. Only the
// HTTP boundary, live subscriptions and unrelated closed dialogs are replaced.
vi.mock("@hooks/useAdminSSE", () => ({ useAdminSSE: () => undefined }));
vi.mock("@/pages/Admin/Users/components/UserForm", () => ({ default: () => null }));
vi.mock("@/pages/Admin/Users/components/UserDetailModal", () => ({ default: () => null }));
vi.mock("@services/users", () => ({ userApi: {
  getUsers: vi.fn(async () => ({ users: [], total: 0 })),
  getUsersStats: vi.fn(async () => ({ total_users: 0 })),
  importUsers: vi.fn(),
  batchDeleteUsers: vi.fn(),
} }));
vi.mock("@/lib/toast", () => ({ showMessage: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@services/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
type Result = Awaited<ReturnType<typeof userApi.importUsers>>;
const success: Result = { success: true, message: "synthetic success", total_rows: 1, imported_count: 1, updated_count: 0, error_count: 0, errors: [] };
const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><AdminUsers /></QueryClientProvider>);
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  return { ...view, input, client };
};
const file = new File(["username,full_name\nsynthetic,Synthetic"], "users.csv", { type: "text/csv" });
const usersResponse = (users: User[] = []) => ({ users, total: users.length, skip: 0, limit: 20, has_more: false });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userApi.getUsers).mockReset().mockResolvedValue(usersResponse());
  vi.mocked(userApi.importUsers).mockReset().mockResolvedValue(success);
});
afterEach(cleanup);

describe("FE-05 real AdminUsers import input", () => {
  it("captures the input before await and allows selecting the identical File twice", async () => {
    const { input } = mount(); const pending = deferred<Result>();
    vi.mocked(userApi.importUsers).mockReturnValueOnce(pending.promise);
    const user = userEvent.setup(); await user.upload(input, file);
    expect(userApi.importUsers).toHaveBeenCalledTimes(1); expect(input.files?.[0]).toBe(file); expect(input.value).not.toBe("");
    await act(async () => pending.resolve(success));
    await waitFor(() => expect(input.value).toBe(""));
    expect(showMessage.success).toHaveBeenCalledWith("synthetic success");
    await user.upload(input, file);
    await waitFor(() => expect(userApi.importUsers).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(input.value).toBe(""));
    expect(showMessage.error).not.toHaveBeenCalled();
  });
  it.each(["business", "network", "partial"])("resets in finally after %s result, preserving hook notifications and retry", async outcome => {
    const { input } = mount(); const pending = deferred<Result>(); vi.mocked(userApi.importUsers).mockReturnValueOnce(pending.promise);
    const user = userEvent.setup(); await user.upload(input, file); expect(input.value).not.toBe("");
    await act(async () => {
      if (outcome === "network") pending.reject(new Error("synthetic network failure"));
      else if (outcome === "business") pending.resolve({ ...success, success: false, message: "synthetic business failure" });
      else pending.resolve({ ...success, success: false, total_rows: 2, error_count: 1, errors: [{ row_number: 2, student_id: null, full_name: "Synthetic", status: "error", message: "synthetic row failure", user_id: null }] });
    });
    await waitFor(() => expect(input.value).toBe(""));
    if (outcome === "partial") {
      expect(showMessage.warning).toHaveBeenCalledOnce();
      const dialog = await screen.findByRole("dialog", { name: "用户导入结果" });
      await user.click(within(dialog).getByRole("button", { name: "关闭" }));
    } else {
      expect(showMessage.error).toHaveBeenCalledOnce();
    }
    expect(showMessage.success).not.toHaveBeenCalled();
    await user.upload(input, file); await waitFor(() => expect(userApi.importUsers).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(input.value).toBe("")); expect(showMessage.success).toHaveBeenCalledOnce();
  });
  it("cancelled picker does not upload or report an error", async () => {
    const { input } = mount(); fireEvent.change(input, { target: { files: [] } }); await act(async () => {});
    expect(userApi.importUsers).not.toHaveBeenCalled(); expect(showMessage.error).not.toHaveBeenCalled();
  });
  it("repeated import button clicks and same file while pending do not duplicate upload", async () => {
    const { input, getByRole } = mount(); const pending = deferred<Result>(); vi.mocked(userApi.importUsers).mockReturnValueOnce(pending.promise);
    const user = userEvent.setup(); await user.upload(input, file);
    await user.click(getByRole("button", { name: "导入用户" })); await user.click(getByRole("button", { name: "导入用户" }));
    await user.upload(input, file); expect(userApi.importUsers).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(success)); await waitFor(() => expect(input.value).toBe(""));
  });
  it.each(["success", "failure"])("settles detached input after unmount on %s without touching a newly mounted input", async outcome => {
    const old = mount(); const pending = deferred<Result>(); vi.mocked(userApi.importUsers).mockReturnValueOnce(pending.promise);
    const user = userEvent.setup(); await user.upload(old.input, file); old.unmount();
    const next = mount(); const nextPending = deferred<Result>(); vi.mocked(userApi.importUsers).mockReturnValueOnce(nextPending.promise);
    await user.upload(next.input, file);
    await act(async () => outcome === "success" ? pending.resolve(success) : pending.reject(new Error("detached failure")));
    await waitFor(() => expect(old.input.value).toBe("")); expect(next.input.files?.[0]).toBe(file);
    await act(async () => nextPending.resolve(success)); await waitFor(() => expect(next.input.value).toBe(""));
  });
});


it("clears a previous selection when search changes and deletes only the confirmed users", async () => {
  const account = (id: number, full_name: string): User => ({
    id, full_name, student_id: `S${id}`, username: null, class_name: null, study_year: null,
    role_code: "student", is_active: true, created_at: null, updated_at: null,
  });
  const secondPage = deferred<ReturnType<typeof usersResponse>>();
  vi.mocked(userApi.getUsers).mockImplementation(({ search } = {}) =>
    search ? secondPage.promise : Promise.resolve(usersResponse([account(1, "合成甲")])));
  vi.mocked(userApi.batchDeleteUsers).mockResolvedValue({ success: true, message: "已删除", deleted_ids: [2] });
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("checkbox", { name: "选择用户 合成甲" }));
  expect(screen.getByRole("button", { name: "删除 (1)" })).toBeEnabled();
  fireEvent.change(screen.getByRole("textbox", { name: "搜索用户姓名、学号或用户名" }), { target: { value: "合成乙" } });
  await act(async () => secondPage.resolve(usersResponse([account(2, "合成乙")])));
  const second = await screen.findByRole("checkbox", { name: "选择用户 合成乙" });
  expect(screen.queryByRole("button", { name: "删除 (1)" })).not.toBeInTheDocument();
  await user.click(second);
  await user.click(screen.getByRole("button", { name: "删除 (1)" }));
  const dialog = screen.getByRole("alertdialog", { name: "确认批量删除" });
  expect(within(dialog).getByText(/合成乙/)).toBeInTheDocument();
  expect(within(dialog).queryByText(/合成甲/)).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "删除" }));
  await waitFor(() => expect(userApi.batchDeleteUsers).toHaveBeenCalledExactlyOnceWith([2]));
});

it("shows actual counts and row errors from a partially successful import", async () => {
  const { input } = mount();
  vi.mocked(userApi.importUsers).mockResolvedValue({
    success: false, message: "导入完成", total_rows: 6, imported_count: 2, updated_count: 3, error_count: 1,
    errors: [{ row_number: 4, student_id: "S8", full_name: "合成用户", status: "error", message: "状态值无效", user_id: null }],
  });
  await userEvent.setup().upload(input, file);
  const dialog = await screen.findByRole("dialog", { name: "用户导入结果" });
  expect(within(dialog).getByText(/新增 2.*更新 3.*失败 1/)).toBeVisible();
  expect(within(dialog).getByText(/第 4 行/)).toBeVisible();
  expect(within(dialog).getByText(/模板说明也计入/)).toBeVisible();
  expect(within(dialog).getByText(/状态值无效/)).toBeVisible();
});
