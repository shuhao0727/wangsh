import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  actor: "admin",
  update: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@hooks/useAuth", () => ({ default: () => ({ user: { role_code: fixtures.actor } }) }));
vi.mock("@hooks/useAdminSSE", () => ({ useAdminSSE: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: fixtures.invalidate }) }));
vi.mock("@/lib/toast", () => ({ showMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@hooks/queries/useUsersQuery", () => ({
  useUsersList: () => ({ data: { users: [], total: 0 }, isLoading: false, isFetching: false }),
  useCreateUser: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateUser: () => ({ isPending: false, mutateAsync: fixtures.update }),
  useDeleteUser: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useBatchDeleteUsers: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useImportUsers: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { useUsers } from "../../pages/Admin/Users/hooks/useUsers";
import UserForm from "../../pages/Admin/Users/components/UserForm";

afterEach(() => { cleanup(); vi.clearAllMocks(); fixtures.actor = "admin"; });

describe("user management contracts", () => {
  it("persists a changed username through the update transport", async () => {
    let persisted = { id: 7, username: "full12_auth_before", full_name: "Full12", student_id: "S7", class_name: "A", study_year: "2026", role_code: "student", is_active: true, created_at: null, updated_at: null };
    fixtures.update.mockImplementation(async ({ data }) => { persisted = { ...persisted, ...data }; return persisted; });
    const { result } = renderHook(() => useUsers());
    act(() => result.current.actions.handleEdit(persisted));
    await act(async () => { await result.current.actions.handleFormSubmit({ ...persisted, username: "full12_auth_after" }); });
    expect(persisted.username).toBe("full12_auth_after");
    expect(result.current.state.formVisible).toBe(false);
  });

  it("offers only assignable roles to an administrator", () => {
    render(<UserForm visible editingUser={null} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.pointerDown(screen.getByLabelText("角色"), { button: 0, ctrlKey: false, pointerType: "mouse" });
    expect(screen.queryByRole("option", { name: "管理员" })).toBeNull();
    expect(screen.getByRole("option", { name: "教师" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "学生" })).toBeInTheDocument();
  });

  it("retains administrator creation for a super administrator", () => {
    fixtures.actor = "super_admin";
    render(<UserForm visible editingUser={null} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.pointerDown(screen.getByLabelText("角色"), { button: 0, ctrlKey: false, pointerType: "mouse" });
    expect(screen.getByRole("option", { name: "管理员" })).toBeInTheDocument();
  });
});
