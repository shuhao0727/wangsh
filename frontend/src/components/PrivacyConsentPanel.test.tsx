import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PrivacyConsentPanel from "./PrivacyConsentPanel";
import { privacyApi } from "@services/privacy";

vi.mock("@/lib/toast", () => ({
  showMessage: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@services/privacy", () => ({
  privacyApi: {
    list: vi.fn(),
    update: vi.fn(),
    withdraw: vi.fn(),
  },
}));

const initial = [
  { consent_type: "AI_USAGE", consented: null, consented_at: null, updated_at: null },
  { consent_type: "DATA_ANALYSIS", consented: true, consented_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
];

describe("PrivacyConsentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(privacyApi.list).mockResolvedValue(initial as never);
    vi.mocked(privacyApi.update).mockResolvedValue({
      consent_type: "AI_USAGE", consented: true, consented_at: "2026-01-02T00:00:00Z", updated_at: "2026-01-02T00:00:00Z",
    } as never);
  });

  it("loads consent states and records a grant", async () => {
    render(<PrivacyConsentPanel />);
    expect(await screen.findByText("AI 对话与智能体服务")).toBeInTheDocument();
    expect(screen.getByText(/当前：未记录/)).toBeInTheDocument();
    const checkbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);
    await waitFor(() => expect((checkbox as HTMLInputElement).checked).toBe(true));
    const buttons = screen.getAllByRole("button", { name: "保存" });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(privacyApi.update).toHaveBeenCalledWith("AI_USAGE", true));
  });

  it("shows a retry state when loading fails", async () => {
    vi.mocked(privacyApi.list).mockRejectedValueOnce(new Error("offline"));
    render(<PrivacyConsentPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/同意状态加载失败/);
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});