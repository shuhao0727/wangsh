import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classroomApi, type Activity } from "@services/classroom";
import ActivityFormDialog from "./ActivityFormDialog";

vi.mock("@services/classroom", () => ({
  classroomApi: { create: vi.fn(), update: vi.fn() },
}));

const draft = {
  id: 12,
  activity_type: "fill_blank",
  title: "循环填空",
  class_name: "甲班",
  options: null,
  correct_answer: "2",
  allow_multiple: false,
  time_limit: 0,
  status: "draft",
  started_at: null,
  ended_at: null,
  created_by: 7,
  created_at: "2026-11-18T01:00:00Z",
} as const;

function renderForm(record: Activity | null = null) {
  render(
    <ActivityFormDialog
      open
      editingId={record?.id ?? null}
      editingRecord={record}
      activeAgents={[]}
      loadingAgents={false}
      onRefreshAgents={vi.fn()}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("课堂活动班级", () => {
  it("新建投票须填写班级，提交时去掉首尾空白", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("活动标题"), "循环投票");
    const classInput = screen.getByRole("textbox", { name: /班级/ });
    await user.type(classInput, "   ");
    const next = screen.getByRole("button", { name: "下一步" });
    await user.click(next);
    expect(screen.queryByPlaceholderText("选项 A")).toBeNull();
    expect(classInput).toBeVisible();
    expect(classroomApi.create).not.toHaveBeenCalled();

    await user.clear(classInput);
    await user.type(classInput, "  甲班  ");
    await user.click(next);
    await user.type(screen.getByPlaceholderText("选项 A"), "一");
    await user.type(screen.getByPlaceholderText("选项 B"), "二");
    await user.click(next);
    await user.click(next);
    await user.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => expect(classroomApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ activity_type: "vote", class_name: "甲班" }),
    ));
  });

  it("编辑填空班级时保留原来的无限时限", async () => {
    const user = userEvent.setup();
    renderForm(draft);

    const classInput = screen.getByRole("textbox", { name: /班级/ });
    expect(classInput).toHaveValue("甲班");
    await user.clear(classInput);
    await user.type(classInput, "  乙班  ");
    for (let step = 0; step < 3; step++) {
      await user.click(screen.getByRole("button", { name: "下一步" }));
    }
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(classroomApi.update).toHaveBeenCalledWith(
      12, expect.objectContaining({ activity_type: "fill_blank", class_name: "乙班", time_limit: 0 }),
    ));
  });
});
