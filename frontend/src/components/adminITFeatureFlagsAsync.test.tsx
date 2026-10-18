import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { featureFlagsApi } from "@/services/system/featureFlags";
import AdminITTechnology from "@/pages/Admin/ITTechnology";

const session = vi.hoisted(() => ({ role: "admin" }));

vi.mock("@hooks/useAuth", () => ({
  default: () => ({
    user: { role_code: session.role },
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
    session.role = "admin";
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
      expect(within(screen.getByRole("listitem", { name: "随机点名" })).getByText("已启用")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/功能开关加载失败/);
    expect(within(screen.getByRole("listitem", { name: "问卷调查" })).getByText("未获取")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(featureFlagsApi.list).not.toHaveBeenCalled();
  });

  it("disables unknown flags when the administrator request fails", async () => {
    session.role = "super_admin";
    vi.mocked(featureFlagsApi.list).mockRejectedValue(new Error("unavailable"));
    render(<MemoryRouter><AdminITTechnology /></MemoryRouter>);

    await screen.findByRole("alert");
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(9);
    switches.forEach((control) => expect(control).toBeDisabled());
    expect(featureFlagsApi.save).not.toHaveBeenCalled();
  });

  it("saves a known flag and updates its status within the same application row", async () => {
    session.role = "super_admin";
    vi.mocked(featureFlagsApi.list).mockResolvedValue([
      { key: "it_dianming_enabled", value: { enabled: true } },
    ]);
    vi.mocked(featureFlagsApi.save).mockResolvedValue({
      key: "it_dianming_enabled", value: { enabled: false },
    });
    const user = userEvent.setup();
    render(<MemoryRouter><AdminITTechnology /></MemoryRouter>);

    const control = screen.getByRole("switch", { name: "随机点名前台入口" });
    await waitFor(() => expect(control).toBeEnabled());
    expect(control).toHaveAttribute("aria-checked", "true");
    await user.click(control);
    await waitFor(() => expect(control).toHaveAttribute("aria-checked", "false"));
    expect(featureFlagsApi.save).toHaveBeenCalledWith({
      key: "it_dianming_enabled", value: { enabled: false },
    });
    expect(within(screen.getByRole("listitem", { name: "随机点名" })).getByText("已禁用")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "问卷调查前台入口" })).toBeDisabled();
  });
});
