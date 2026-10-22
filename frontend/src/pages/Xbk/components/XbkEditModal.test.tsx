import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { XbkEditModal } from "./XbkEditModal";
import { xbkDataApi } from "@services";
import { showMessage } from "@/lib/toast";

vi.mock("@services", () => ({
  xbkDataApi: {
    createStudent: vi.fn(),
    updateStudent: vi.fn(),
  },
}));
vi.mock("@/lib/toast", () => ({
  showMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const meta = { years: [], terms: ["上学期", "下学期"], classes: [] };

const setup = (overrides: Record<string, unknown> = {}) => {
  const props = {
    open: true,
    onCancel: vi.fn(),
    onSuccess: vi.fn(),
    kind: "students" as const,
    mode: "edit" as const,
    targetId: 7,
    initialValues: {
      year: "2026-2027",
      term: "上学期",
      grade: "高三",
      class_name: "1班",
      student_no: "S001",
      name: "张同学",
    },
    meta,
    filters: {},
    ...overrides,
  };
  const view = render(<XbkEditModal {...props} />);
  return { ...view, props };
};

const selectGrade = async (name: string) => {
  fireEvent.keyDown(screen.getAllByRole("combobox")[1], { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name }));
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(xbkDataApi.updateStudent).mockResolvedValue({} as never);
  vi.mocked(xbkDataApi.createStudent).mockResolvedValue({} as never);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("XBK edit modal grade enum", () => {
  it("offers 高三 and saves a 高三 record", async () => {
    const user = userEvent.setup();
    const { props } = setup();
    expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("高三");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(xbkDataApi.updateStudent).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ grade: "高三" }),
      ),
    );
    expect(props.onSuccess).toHaveBeenCalledOnce();
  });

  it("keeps an enum-outside legacy grade editable and saves it unchanged", async () => {
    const user = userEvent.setup();
    const { props } = setup({
      initialValues: {
        year: "2026-2027",
        term: "上学期",
        grade: "中一",
        class_name: "1班",
        student_no: "S002",
        name: "李同学",
      },
    });
    // 历史值仍作为下拉选项展示，避免打开即以空值呈现、保存时被清掉
    expect(screen.getAllByRole("combobox")[1]).toHaveTextContent(
      "中一（历史值）",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(xbkDataApi.updateStudent).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ grade: "中一" }),
      ),
    );
    expect(showMessage.error).not.toHaveBeenCalled();
    expect(props.onSuccess).toHaveBeenCalledOnce();
  });

  it("allows replacing a legacy grade with a standard one", async () => {
    const user = userEvent.setup();
    setup({
      initialValues: {
        year: "2026-2027",
        term: "上学期",
        grade: "中一",
        class_name: "1班",
        student_no: "S003",
        name: "王同学",
      },
    });
    await selectGrade("高二");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(xbkDataApi.updateStudent).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ grade: "高二" }),
      ),
    );
  });
});
