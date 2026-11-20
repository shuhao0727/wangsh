import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { dianmingApi } from "@/services/xxjs/dianming";
import DianmingManager from "./DianmingManager";

vi.mock("@/services/xxjs/dianming", () => ({
  dianmingApi: { listClasses: vi.fn(), listStudents: vi.fn(), updateClassStudents: vi.fn() },
}));

it("updates the roster under its original class key", async () => {
  const original = { year: "2030届", class_name: "合成甲班", count: 1 };
  const other = { year: "2031届", class_name: "合成乙班", count: 1 };
  vi.mocked(dianmingApi.listClasses).mockResolvedValue([original, other]);
  vi.mocked(dianmingApi.listStudents).mockResolvedValue([
    { ...original, id: 1, student_name: "甲原名", created_at: "2030-01-01" },
  ]);
  vi.mocked(dianmingApi.updateClassStudents).mockResolvedValue([]);
  const user = userEvent.setup();
  render(<DianmingManager />);

  await user.click((await screen.findAllByRole("button", { name: "编辑" }))[0]);
  const editor = within(screen.getByRole("dialog", { name: "编辑班级名单" }));
  const names = editor.getByRole("textbox", { name: "学生名单" });
  await waitFor(() => expect(names).toHaveValue("甲原名"));
  const year = editor.getByRole("textbox", { name: "年份/届别" });
  const className = editor.getByRole("textbox", { name: "班级名称" });
  await user.type(year, other.year);
  await user.type(className, other.class_name);
  expect(year).toHaveValue(original.year);
  expect(className).toHaveValue(original.class_name);
  await user.clear(names);
  await user.type(names, "甲新名");
  await user.click(editor.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(dianmingApi.updateClassStudents).toHaveBeenCalledExactlyOnceWith({
    year: original.year, class_name: original.class_name, names_text: "甲新名",
  }));
});
