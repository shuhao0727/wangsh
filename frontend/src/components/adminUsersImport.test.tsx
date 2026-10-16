import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsers from "@/pages/Admin/Users";
import { userApi } from "@services/users";
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
beforeEach(() => { vi.clearAllMocks(); vi.mocked(userApi.importUsers).mockReset().mockResolvedValue(success); });
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
      else pending.resolve({ ...success, error_count: 1, errors: [{ row_number: 2, student_id: null, full_name: "Synthetic", status: "error", message: "synthetic row failure", user_id: null }] });
    });
    await waitFor(() => expect(input.value).toBe(""));
    if (outcome === "partial") expect(showMessage.warning).toHaveBeenCalledOnce();
    else expect(showMessage.error).toHaveBeenCalledOnce();
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
