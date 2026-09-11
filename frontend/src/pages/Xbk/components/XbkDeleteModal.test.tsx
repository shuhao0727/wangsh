import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { xbkDataApi } from "@services";
import { showMessage } from "@/lib/toast";
import { XbkDeleteModal } from "./XbkDeleteModal";

vi.mock("@services", () => ({ xbkDataApi: { deleteData: vi.fn() } }));
vi.mock("@/lib/toast", () => ({
  showMessage: { error: vi.fn(), success: vi.fn() },
}));

type Props = ComponentProps<typeof XbkDeleteModal>;
const setup = (
  filters: Props["filters"] = { year: "2026-2027", term: "上学期", grade: "高一" },
) => {
  const props: Props = {
    open: true,
    filters,
    onCancel: vi.fn(),
    onSuccess: vi.fn(),
  };
  const view = render(<XbkDeleteModal {...props} />);
  return {
    ...view,
    props,
    update: (next: Partial<Props>) => {
      Object.assign(props, next);
      view.rerender(<XbkDeleteModal {...props} />);
    },
  };
};
const submit = () => screen.getByRole("button", { name: "确认删除" });
const openScopes = () =>
  fireEvent.keyDown(screen.getByRole("combobox", { name: "删除范围" }), {
    key: "ArrowDown",
  });
const selectScope = async (name: string) => {
  openScopes();
  fireEvent.click(await screen.findByRole("option", { name }));
};
const deferred = () => {
  let resolve!: (value: { deleted: number }) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<{ deleted: number }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(xbkDataApi.deleteData).mockResolvedValue({ deleted: 3 });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("XBK deletion scope safety", () => {
  it("preserves default all and its exact filters when there is no class filter", async () => {
    const view = setup();
    expect(screen.getByRole("combobox")).toHaveTextContent("全部");
    expect(submit()).toBeEnabled();
    expect(screen.getByText("该操作为物理删除，不可恢复")).toBeInTheDocument();
    fireEvent.click(submit());
    await waitFor(() => expect(view.props.onSuccess).toHaveBeenCalledOnce());
    expect(xbkDataApi.deleteData).toHaveBeenCalledWith({
      scope: "all",
      year: "2026-2027",
      term: "上学期",
      grade: "高一",
      class_name: undefined,
    });
  });

  it("keeps default all selected but blocks submission and shared scopes for a class filter", async () => {
    setup({ year: "2026-2027", term: "上学期", grade: "高一", class_name: "1" });
    expect(screen.getByRole("combobox")).toHaveTextContent("全部");
    expect(
      screen.getByText("班级筛选不能用于删除共享课程"),
    ).toBeInTheDocument();
    expect(screen.getByText(/当前删除范围不会自动更改/)).toBeInTheDocument();
    expect(submit()).toBeDisabled();
    fireEvent.click(submit());
    expect(xbkDataApi.deleteData).not.toHaveBeenCalled();
    const scopeTrigger = screen.getByRole("combobox");
    openScopes();
    for (const name of ["全部", "选课目录"]) {
      const option = await screen.findByRole("option", { name });
      expect(option).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(option);
      expect(scopeTrigger).toHaveTextContent("全部");
    }
    expect(
      screen.getByRole("option", { name: "学生名单" }),
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("option", { name: "选课结果" }),
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(xbkDataApi.deleteData).not.toHaveBeenCalled();
  });

  it.each([
    { label: "学生名单", scope: "students" },
    { label: "选课结果", scope: "selections" },
  ])(
    "allows an explicit class-scoped $label without clearing the class or grade",
    async ({ label, scope }) => {
      const view = setup({
        year: "2026-2027",
        term: "下学期",
        grade: "高二",
        class_name: "2",
      });
      await selectScope(label);
      expect(submit()).toBeEnabled();
      fireEvent.click(submit());
      await waitFor(() => expect(view.props.onSuccess).toHaveBeenCalledOnce());
      expect(xbkDataApi.deleteData).toHaveBeenCalledWith({
        scope,
        year: "2026-2027",
        term: "下学期",
        grade: "高二",
        class_name: "2",
      });
    },
  );

  it("blocks a previously selected courses scope when a class filter arrives, without silently changing it", async () => {
    const view = setup();
    await selectScope("选课目录");
    view.update({ filters: { ...view.props.filters, class_name: "1" } });
    expect(screen.getByRole("combobox")).toHaveTextContent("选课目录");
    expect(submit()).toBeDisabled();
    fireEvent.click(submit());
    expect(xbkDataApi.deleteData).not.toHaveBeenCalled();
    view.update({ filters: { ...view.props.filters, class_name: undefined } });
    expect(screen.getByRole("combobox")).toHaveTextContent("选课目录");
    expect(submit()).toBeEnabled();
    fireEvent.click(submit());
    await waitFor(() =>
      expect(xbkDataApi.deleteData).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "courses", class_name: undefined }),
      ),
    );
  });

  it.each([
    { year: undefined, term: "上学期" as const },
    { year: "2026-2027", term: undefined },
    { year: undefined, term: undefined },
  ])("disables submission for missing required filters %j", (filters) => {
    setup(filters);
    expect(screen.getByText("请选择具体的学年和学期")).toBeInTheDocument();
    expect(submit()).toBeDisabled();
    fireEvent.click(submit());
    expect(xbkDataApi.deleteData).not.toHaveBeenCalled();
  });

  it("reacts to required filter changes without resetting the explicitly selected scope", async () => {
    const view = setup();
    await selectScope("选课结果");
    view.update({ filters: { year: "2026-2027" } });
    expect(submit()).toBeDisabled();
    view.update({ filters: { year: "2027-2028", term: "下学期" } });
    expect(screen.getByRole("combobox")).toHaveTextContent("选课结果");
    fireEvent.click(submit());
    await waitFor(() =>
      expect(xbkDataApi.deleteData).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "selections",
          year: "2027-2028",
          term: "下学期",
        }),
      ),
    );
  });

  it("retains the user's scope after closing and reopening", async () => {
    const view = setup();
    await selectScope("学生名单");
    view.update({ open: false });
    view.update({ open: true });
    expect(screen.getByRole("combobox")).toHaveTextContent("学生名单");
    expect(submit()).toBeEnabled();
    expect(xbkDataApi.deleteData).not.toHaveBeenCalled();
  });
});

describe("XBK deletion in-flight safety", () => {
  it("blocks double submission, scope changes, cancel, close, Escape and outside click until completion", async () => {
    const pending = deferred();
    vi.mocked(xbkDataApi.deleteData).mockReturnValueOnce(pending.promise);
    const view = setup();
    const button = submit();
    act(() => {
      button.click();
      button.click();
    });
    expect(xbkDataApi.deleteData).toHaveBeenCalledOnce();
    expect(submit()).toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    // Radix arms its document pointer listener on the next timer tick.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(document.body, { pointerType: "mouse", button: 0 });
    fireEvent.click(document.body);
    expect(view.props.onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => pending.resolve({ deleted: 3 }));
    expect(view.props.onSuccess).toHaveBeenCalledOnce();
    expect(showMessage.success).toHaveBeenCalledWith("删除完成，共 3 条");
    expect(submit()).toBeDisabled();
    fireEvent.click(submit());
    expect(xbkDataApi.deleteData).toHaveBeenCalledOnce();
    expect(screen.getByText("本次删除已完成")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(view.props.onCancel).toHaveBeenCalledOnce();
  });

  it.each(["取消", "Close"])("allows %s before deletion", (name) => {
    const view = setup();
    fireEvent.click(screen.getByRole("button", { name }));
    expect(view.props.onCancel).toHaveBeenCalledOnce();
    expect(xbkDataApi.deleteData).not.toHaveBeenCalled();
  });

  it("allows Escape before deletion", () => {
    const view = setup();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(view.props.onCancel).toHaveBeenCalledOnce();
  });

  it("shows backend failure, retains scope, and unlocks for explicit retry", async () => {
    vi.mocked(xbkDataApi.deleteData).mockRejectedValueOnce({
      response: { data: { detail: "删除失败，已回滚" } },
    });
    const view = setup();
    await selectScope("学生名单");
    fireEvent.click(submit());
    expect(await screen.findByText("删除失败，已回滚")).toBeInTheDocument();
    expect(view.props.onSuccess).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
    expect(screen.getByRole("combobox")).toBeEnabled();
    expect(screen.getByRole("combobox")).toHaveTextContent("学生名单");
    fireEvent.click(submit());
    await waitFor(() => expect(view.props.onSuccess).toHaveBeenCalledOnce());
    expect(xbkDataApi.deleteData).toHaveBeenCalledTimes(2);
  });

  it.each(["close", "unmount"])(
    "suppresses a late failure after external %s",
    async (mode) => {
      const pending = deferred();
      vi.mocked(xbkDataApi.deleteData).mockReturnValueOnce(pending.promise);
      const view = setup();
      fireEvent.click(submit());
      if (mode === "unmount") view.unmount();
      else {
        view.update({ open: false });
        view.update({ open: true });
      }
      await act(async () => pending.reject(new Error("late failure")));
      expect(showMessage.error).not.toHaveBeenCalled();
      expect(view.props.onSuccess).not.toHaveBeenCalled();
      if (mode === "close") expect(submit()).toBeEnabled();
    },
  );

  it("does not show an old successful delete in a new externally reopened session", async () => {
    const pending = deferred();
    vi.mocked(xbkDataApi.deleteData).mockReturnValueOnce(pending.promise);
    const view = setup();
    fireEvent.click(submit());
    view.update({ open: false });
    view.update({ open: true });
    expect(submit()).toBeDisabled();
    await act(async () => pending.resolve({ deleted: 2 }));
    expect(view.props.onSuccess).not.toHaveBeenCalled();
    expect(showMessage.success).not.toHaveBeenCalled();
    expect(screen.queryByText("本次删除已完成")).not.toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });
});
