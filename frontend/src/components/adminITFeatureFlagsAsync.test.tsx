import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { featureFlagsApi } from "@/services/system/featureFlags";
import AdminITTechnology from "@/pages/Admin/ITTechnology";

vi.mock("@hooks/useAuth", () => ({
  default: () => ({
    user: { role_code: "admin" },
  }),
}));

vi.mock("@/services/system/featureFlags", () => ({
  featureFlagsApi: {
    list: vi.fn(),
    getPublic: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock("@/components/Admin", () => ({
  AdminPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminAppCard: ({ title, enabled }: { title: string; enabled: boolean }) => (
    <div data-testid={`app-${title}`} data-enabled={String(enabled)}>{title}</div>
  ),
}));

vi.mock("@/pages/Admin/ITTechnology/DianmingManager", () => ({ default: () => null }));
vi.mock("@/pages/Admin/ITTechnology/ml", () => ({ default: () => null }));
vi.mock("@/pages/Admin/ITTechnology/ai", () => ({ default: () => null }));
vi.mock("@/pages/Admin/ITTechnology/agents", () => ({ default: () => null }));
vi.mock("@/pages/Admin/ITTechnology/components/AgentConfigModal", () => ({ default: () => null }));
vi.mock("@/pages/Admin/ITTechnology/learning/MindMapManager", () => ({ default: () => null }));

describe("Admin IT feature flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlagsApi.getPublic).mockImplementation(async (key) => {
      if (key === "it_dianming_enabled") {
        return { key, value: { enabled: true } };
      }
      throw new Error(`failed: ${key}`);
    });
  });

  it("keeps successful public flag results when other flag requests fail", async () => {
    render(
      <MemoryRouter>
        <AdminITTechnology />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("app-随机点名")).toHaveAttribute("data-enabled", "true");
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/功能开关加载失败/);
  });
});
