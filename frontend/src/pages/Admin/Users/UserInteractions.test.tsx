import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import UserForm from "./components/UserForm";
import { getUserColumns } from "./columns";
vi.mock("@hooks/useAuth", () => ({ default: () => ({ user: { role_code: "super_admin" } }) }));
afterEach(cleanup);
const user = { id: 17, student_id: "b04-17", username: "b04-user", full_name: "B04 User", role_code: "student", study_year: "2026", class_name: "B04 Class", is_active: true, created_at: "2026-10-15T00:00:00Z", updated_at: "2026-10-15T00:00:00Z" };
describe("B04 minimal interactions", () => {
  it("keeps save and cancel disabled until the actual submission settles", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const submit = vi.fn(() => pending);
    render(<UserForm visible editingUser={user} onSubmit={submit} onCancel={vi.fn()} />);
    const save = screen.getByRole("button", { name: "保存" });
    fireEvent.click(save);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(save).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    fireEvent.click(save);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await pending; });
    await waitFor(() => expect(save).toBeEnabled());
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
  });
  it("names all row actions and preserves their callbacks", () => {
    const actions = { handleView: vi.fn(), handleEdit: vi.fn(), handleDelete: vi.fn() };
    const column = getUserColumns(actions).find((item) => item.id === "action")!;
    const Cell = column.cell as React.ComponentType<any>;
    render(<Cell row={{ original: user }} />);
    fireEvent.click(screen.getByRole("button", { name: "查看详情" }));
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(actions.handleView).toHaveBeenCalledWith(user);
    expect(actions.handleEdit).toHaveBeenCalledWith(user);
    expect(actions.handleDelete).toHaveBeenCalledWith(user.id);
  });
});
