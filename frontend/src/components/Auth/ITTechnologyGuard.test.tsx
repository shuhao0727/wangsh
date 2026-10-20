import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import AdminITTechnology from "@/pages/Admin/ITTechnology";
import ITTechnologyGuard from "./ITTechnologyGuard";
import AdminGuard from "./AdminGuard";
import RoleGuard from "./RoleGuard";
import { IT_TECHNOLOGY_MANAGEMENT_ROLES } from "./roleAccess";

const { auth, listFlags, publicFlag } = vi.hoisted(() => ({
  auth: { role: "teacher", loggedIn: true },
  listFlags: vi.fn(),
  publicFlag: vi.fn(),
}));
vi.mock("@hooks/useAuth", () => ({ default: () => ({
  user: { id: 41, username: "synthetic-staff", role_code: auth.role },
  isLoading: false,
  isLoggedIn: () => auth.loggedIn,
  isStaff: () => ["teacher", "admin", "super_admin"].includes(auth.role),
  logout: vi.fn(),
}) }));
vi.mock("@hooks/useBreakpoint", () => ({ useBreakpoint: () => ({ md: true }) }));
vi.mock("@hooks/useAppMeta", () => ({ default: () => ({ version: "test", envLabel: "synthetic" }) }));
vi.mock("@/components/Common/PageTransitionShell", () => ({
  PageTransitionShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/Admin", () => ({ AdminPage: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/pages/Admin/ITTechnology/DianmingManager", () => ({ default: () => null }));
vi.mock("@/pages/Admin/ITTechnology/components/AgentConfigModal", () => ({ default: () => null }));
vi.mock("@/pages/Admin/ITTechnology/learning/MindMapManager", () => ({ default: () => null }));
vi.mock("@/pages/Admin/ITTechnology/KnnManager", () => ({
  default: ({ onBack, backLabel }: { onBack: () => void; backLabel: string }) => <section>
    <h1>合成 KNN 管理工作区</h1><button onClick={onBack}>{backLabel}</button>
  </section>,
}));
vi.mock("@/services/system/featureFlags", () => ({ featureFlagsApi: {
  list: listFlags, getPublic: publicFlag, save: vi.fn(),
} }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}
function Harness({ entry }: { entry: string }) {
  return <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/login" element={<p>合成登录页</p>} />
      <Route element={<AdminGuard><AdminLayout /></AdminGuard>}>
        <Route path="/admin/dashboard" element={<p>合成管理首页</p>} />
        <Route path="/admin/it-technology" element={<ITTechnologyGuard><AdminITTechnology /></ITTechnologyGuard>} />
        <Route path="/admin/it-technology/ml-book-editor" element={<RoleGuard roles={IT_TECHNOLOGY_MANAGEMENT_ROLES}><p>合成 ML 编辑器</p></RoleGuard>} />
      </Route>
    </Routes>
    <LocationProbe />
  </MemoryRouter>;
}

beforeEach(() => {
  auth.role = "teacher"; auth.loggedIn = true;
  listFlags.mockReset().mockResolvedValue([]);
  publicFlag.mockReset().mockImplementation(async (key: string) => ({ key, value: { enabled: false } }));
});
afterEach(cleanup);

describe("IT entry and KNN view permissions", () => {
  it.each(["teacher", "admin", "super_admin"])("opens a direct KNN batch link for %s", role => {
    auth.role = role;
    const entry = "/admin/it-technology?view=knn&batch=synthetic-batch";
    render(<Harness entry={entry} />);
    expect(screen.getByRole("heading", { name: "合成 KNN 管理工作区" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(entry);
  });

  it("restores the teacher KNN view when the direct link is freshly mounted", () => {
    const entry = "/admin/it-technology?batch=synthetic-batch&view=knn";
    const first = render(<Harness entry={entry} />);
    first.unmount();
    render(<Harness entry={entry} />);
    expect(screen.getByRole("heading", { name: "合成 KNN 管理工作区" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(entry);
  });

  it("opens KNN from the teacher information technology menu", () => {
    render(<Harness entry="/admin/dashboard" />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "管理导航" })).getByRole("button", { name: "信息技术" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/it-technology?view=knn");
    expect(screen.getByRole("heading", { name: "合成 KNN 管理工作区" })).toBeInTheDocument();
    expect(publicFlag).not.toHaveBeenCalled();
    expect(listFlags).not.toHaveBeenCalled();
  });

  it("preserves the selected batch when teachers reselect the menu", () => {
    render(<Harness entry="/admin/it-technology?view=knn&batch=synthetic-batch" />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "管理导航" })).getByRole("button", { name: "信息技术" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/it-technology?view=knn&batch=synthetic-batch");
  });

  it.each(["", "?view=ml", "?view=KNN", "?batch=synthetic-batch"])("rejects the teacher catalog or another view: %s", search => {
    render(<Harness entry={`/admin/it-technology${search}`} />);
    expect(screen.getByText("权限不足")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "应用管理" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "合成 KNN 管理工作区" })).not.toBeInTheDocument();
    expect(publicFlag).not.toHaveBeenCalled();
    expect(listFlags).not.toHaveBeenCalled();
  });

  it("returns teachers to the dashboard without showing the application catalog", () => {
    render(<Harness entry="/admin/it-technology?view=knn&batch=synthetic-batch" />);
    fireEvent.click(screen.getByRole("button", { name: "管理首页" }));
    expect(screen.getByText("合成管理首页")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/dashboard");
  });

  it("rejects students from the KNN management view", () => {
    auth.role = "student";
    render(<Harness entry="/admin/it-technology?view=knn&batch=synthetic-batch" />);
    expect(screen.getByText("权限不足")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "合成 KNN 管理工作区" })).not.toBeInTheDocument();
  });

  it("preserves the complete KNN URL during the login redirect", () => {
    auth.loggedIn = false;
    render(<Harness entry="/admin/it-technology?view=knn&batch=synthetic-batch" />);
    expect(screen.getByText("合成登录页")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/login?redirect=%2Fadmin%2Fit-technology%3Fview%3Dknn%26batch%3Dsynthetic-batch");
  });

  it.each(["teacher", "student"])("continues to reject %s from the ML editor", role => {
    auth.role = role;
    render(<Harness entry="/admin/it-technology/ml-book-editor?view=knn" />);
    expect(screen.getByText("权限不足")).toBeInTheDocument();
    expect(screen.queryByText("合成 ML 编辑器")).not.toBeInTheDocument();
  });

  it.each(["admin", "super_admin"])("keeps the IT catalog for %s", role => {
    auth.role = role;
    render(<Harness entry="/admin/it-technology" />);
    expect(screen.getByRole("heading", { name: "应用管理" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "KNN 运动习惯采集管理" })).toBeInTheDocument();
  });
});
