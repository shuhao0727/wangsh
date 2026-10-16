import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsers from "@/pages/Admin/Users";
import { userApi } from "@services/users";
import type { User } from "@/pages/Admin/Users/types";
import { queryKeys } from "@hooks/queries/queryKeys";

// Keep real table callbacks, useUsers, UserForm and Radix focus scopes; isolate HTTP/SSE/auth.
vi.mock("@hooks/useAuth", () => ({ default: () => ({ user: { role_code: "super_admin" } }) }));
vi.mock("@hooks/useAdminSSE", () => ({ useAdminSSE: () => undefined }));
vi.mock("@services/users", () => ({ userApi: { getUsers: vi.fn(), getUsersStats: vi.fn() } }));

const record: User = {
  id: 17, full_name: "Focus Student", student_id: "focus-17", username: "focus-student",
  role_code: "student", study_year: "2026", class_name: "Focus Class", is_active: true,
  created_at: "2026-10-12T00:00:00Z", updated_at: "2026-10-12T00:00:00Z",
};

const listResponse = (users: User[]): Awaited<ReturnType<typeof userApi.getUsers>> => ({
  users, total: users.length, skip: 0, limit: 20, has_more: false,
});

function mountUsers() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { ...render(<QueryClientProvider client={client}><AdminUsers /></QueryClientProvider>), client };
}

async function closeWithEscape(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userApi.getUsers).mockResolvedValue(listResponse([record]));
  vi.mocked(userApi.getUsersStats).mockResolvedValue({
    total: 134, active: 134, inactive: 0,
    by_role: { student: 96, teacher: 10, admin: 9, super_admin: 11, guest: 8 },
  });
});
afterEach(cleanup);

describe("admin-ui explicit user form return focus", () => {
  it.each(["pointer", "keyboard"])("returns to Add after %s opening and Escape", async (mode) => {
    mountUsers();
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "添加用户" });
    if (mode === "keyboard") {
      trigger.focus();
      await user.keyboard("{Enter}");
    } else {
      screen.getByRole("textbox", { name: "搜索用户" }).focus();
      // A pointer click may leave focus elsewhere in WebKit; do not pre-focus the trigger.
      fireEvent.click(trigger);
    }
    expect(await screen.findByRole("dialog", { name: "添加用户" })).toBeInTheDocument();
    await closeWithEscape(user, trigger);
  });

  it("returns to the row Edit button when pointer click does not focus it", async () => {
    mountUsers();
    const user = userEvent.setup();
    const row = (await screen.findByText(record.full_name)).closest("tr")!;
    const trigger = within(row).getAllByRole("button")[1];
    screen.getByRole("textbox", { name: "搜索用户" }).focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "编辑用户" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue(record.full_name);
    await closeWithEscape(user, trigger);
  });

  it("returns to the row View button after details transitions to Edit", async () => {
    mountUsers();
    const user = userEvent.setup();
    const row = (await screen.findByText(record.full_name)).closest("tr")!;
    const trigger = within(row).getAllByRole("button")[0];
    await user.click(trigger);
    const detail = await screen.findByRole("dialog", { name: "用户详情" });
    await user.click(within(detail).getByRole("button", { name: "编辑" }));
    expect(await screen.findByRole("dialog", { name: "编辑用户" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("dialog", { name: "编辑用户" })).toContainElement(document.activeElement as HTMLElement));
    await closeWithEscape(user, trigger);
  });

  it.each(["escape", "close-button", "close-icon"])("returns to the row View button after details %s without pointer focus", async (mode) => {
    mountUsers();
    const user = userEvent.setup();
    const row = (await screen.findByText(record.full_name)).closest("tr")!;
    const trigger = within(row).getAllByRole("button")[0];
    screen.getByRole("textbox", { name: "搜索用户" }).focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "用户详情" });
    if (mode === "escape") await user.keyboard("{Escape}");
    else await user.click(within(dialog).getByRole("button", { name: mode === "close-button" ? /^关闭$/ : /^Close$/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("restores the empty-state Add action after Cancel", async () => {
    vi.mocked(userApi.getUsers).mockResolvedValue(listResponse([]));
    mountUsers();
    const user = userEvent.setup();
    const trigger = await screen.findByRole("button", { name: "添加第一个用户" });
    fireEvent.click(trigger);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "取消" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("returns to Add when a refresh removes the original row trigger", async () => {
    const { client } = mountUsers();
    const user = userEvent.setup();
    const row = (await screen.findByText(record.full_name)).closest("tr")!;
    const trigger = within(row).getAllByRole("button")[1];
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "编辑用户" });
    vi.mocked(userApi.getUsers).mockResolvedValue(listResponse([]));
    await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.users.all }); });
    await waitFor(() => expect(trigger.isConnected).toBe(false));
    await closeWithEscape(user, screen.getByRole("button", { name: "添加用户", hidden: true }));
  });

  it("returns to Add after the close icon and repeated opening", async () => {
    mountUsers();
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "添加用户" });
    await user.click(trigger);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "添加用户" });
    await closeWithEscape(user, trigger);
  });

  it("keeps every role statistic visible when the viewport is narrow", async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    try {
      mountUsers();
      const stats = await screen.findByRole("group", { name: "用户统计" });
      for (const label of ["用户", "激活", "学生", "教师", "管理", "超管", "guest"]) {
        expect(within(stats).getByText(label)).toBeVisible();
      }
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    }
  });
});
