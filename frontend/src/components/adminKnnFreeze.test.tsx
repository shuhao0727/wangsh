import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { FreezeDialog } from "@pages/Admin/ITTechnology/KnnManager/DataDialogs";
import type { BatchDetail } from "@/services/knn";

const date = "2030-05-01T10:00:00Z";
const batch: BatchDetail = {
  id: "fixture-batch", title: "合成采集", starts_at: date, ends_at: date, created_at: date,
  phase: "open", state: "scheduled", expected: 5, submitted: 4, missing: 1, pending_refill: 1, frozen_at: null,
  rows: ["A11", "A12", "A13", "A14", "A15"].map((student_no, index) => ({
    student_no, current_revision: index < 4 ? 1 : 0, refill_allowed: index === 2,
    answer: index < 4 ? {
      revision: 1, features: [2, 3, 2, 1, 0, 4], label: "耐力类", display_consent: false, submitted_at: date,
    } : null,
  })),
};

it("freezes four ordinary answers using the server's default student A", async () => {
  const onFreeze = vi.fn(async (_studentNo?: string) => {});
  render(<FreezeDialog batch={batch} onClose={vi.fn()} onFreeze={onFreeze} />);
  const button = screen.getByRole("button", { name: "冻结并下载" });
  expect(button).toBeEnabled();
  await userEvent.setup().click(button);
  await waitFor(() => expect(onFreeze).toHaveBeenCalledExactlyOnceWith(undefined));
});

it("offers submitted students including pending refill and skips unsubmitted students", async () => {
  const onFreeze = vi.fn(async (_studentNo?: string) => {});
  render(<FreezeDialog batch={batch} onClose={vi.fn()} onFreeze={onFreeze} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  expect(screen.getByRole("option", { name: "学号 A13" })).toBeVisible();
  expect(screen.queryByRole("option", { name: "学号 A15" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("option", { name: "学号 A13" }));
  await user.click(screen.getByRole("button", { name: "冻结并下载" }));
  await waitFor(() => expect(onFreeze).toHaveBeenCalledExactlyOnceWith("A13"));
});
