import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import AdminLayout from "./AdminLayout";

const viewport = vi.hoisted(() => ({ md: false }));
vi.mock("@hooks/useBreakpoint", () => ({ useBreakpoint: () => viewport }));
vi.mock("@hooks/useAuth", () => ({
  default: () => ({
    user: { username: "synthetic-admin", role_code: "admin" },
    isLoggedIn: () => true,
    isStaff: () => true,
    logout: vi.fn(),
  }),
}));
vi.mock("@hooks/useAppMeta", () => ({
  default: () => ({ version: "test", envLabel: "synthetic" }),
}));
vi.mock("@/components/Common/PageTransitionShell", () => ({
  PageTransitionShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// jsdom checks token selection and React handlers, NOT CSS painting/hit testing.
// Real Chrome must separately verify that pointer clicks reach the open sidebar.
const styleTokens = readFileSync("src/styles/index.css", "utf8");
const layer = (name: string) => `z-[var(` + `--ws-z-${name}` + `)]`;
const tokenValue = (name: string) => {
  const match = styleTokens.match(new RegExp(`--ws-z-${name}:\\s*(\\d+)\\s*;`));
  expect(match, `existing semantic z token: ${name}`).not.toBeNull();
  return Number(match![1]);
};
const sidebar = () => screen.getByRole("navigation", { name: "管理导航" });
const overlay = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("div")).find((el) => el.classList.contains(layer("overlay")));
const routeProbe = () => screen.getByTestId("current-route");
function RouteProbe() {
  return <output data-testid="current-route">{useLocation().pathname}</output>;
}
function Harness() {
  return <MemoryRouter initialEntries={["/admin/users"]}><AdminLayout /><RouteProbe /></MemoryRouter>;
}
const openMobile = (container: HTMLElement) => {
  const header = container.querySelector("header");
  expect(header).not.toBeNull();
  fireEvent.click(within(header!).getByRole("button", { name: "展开侧栏" }));
  expect(sidebar()).toHaveStyle({ transform: "translateX(0)" });
  expect(overlay(container)).toBeDefined();
};

beforeEach(() => { viewport.md = false; });
afterEach(cleanup);

describe("AdminLayout mobile sidebar", () => {
  it("uses the existing floating-panel layer above the backdrop, below modals", () => {
    const { container } = render(<Harness />);
    expect(sidebar()).toHaveStyle({ transform: "translateX(-100%)" });
    expect(overlay(container)).toBeUndefined();
    openMobile(container);
    expect(sidebar()).toHaveClass(layer("floating-panel"));
    expect(sidebar()).not.toHaveClass(layer("header"));
    expect(tokenValue("floating-panel")).toBeGreaterThan(tokenValue("overlay"));
    expect(tokenValue("floating-panel")).toBeLessThan(tokenValue("modal"));
    expect(sidebar().nextElementSibling).toHaveStyle({ marginLeft: "0px" });
  });

  it.each(["信息学竞赛", "AI智能体"])("navigates and closes on menu item %s", (label) => {
    const { container } = render(<Harness />);
    openMobile(container);
    fireEvent.click(within(sidebar()).getByRole("button", { name: label }));
    expect(routeProbe()).toHaveTextContent(label === "AI智能体" ? "/admin/ai-agents" : "/admin/informatics");
    expect(sidebar()).toHaveStyle({ transform: "translateX(-100%)" });
    expect(overlay(container)).toBeUndefined();
  });

  it("closes on backdrop click without navigating and can reopen", () => {
    const { container } = render(<Harness />);
    openMobile(container);
    fireEvent.click(overlay(container)!);
    expect(sidebar()).toHaveStyle({ transform: "translateX(-100%)" });
    expect(overlay(container)).toBeUndefined();
    expect(routeProbe()).toHaveTextContent("/admin/users");
    openMobile(container);
    fireEvent.click(within(sidebar()).getByRole("button", { name: "折叠侧栏" }));
    expect(overlay(container)).toBeUndefined();
    expect(sidebar()).toHaveStyle({ transform: "translateX(-100%)" });
  });

  it("keeps the desktop header layer, widths and collapse behavior without a backdrop", () => {
    viewport.md = true;
    const { container } = render(<Harness />);
    expect(sidebar()).toHaveClass(layer("header"));
    expect(sidebar()).not.toHaveClass(layer("floating-panel"));
    expect(sidebar()).toHaveStyle({ width: "var(--ws-sidebar-width)", transform: "translateX(0)", boxShadow: "none" });
    expect(sidebar().nextElementSibling).toHaveStyle({ marginLeft: "var(--ws-sidebar-width)" });
    expect(container.querySelector("header")).toBeNull();
    expect(overlay(container)).toBeUndefined();
    fireEvent.click(within(sidebar()).getByRole("button", { name: "信息学竞赛" }));
    expect(sidebar()).toHaveStyle({ width: "var(--ws-sidebar-width)" });
    fireEvent.click(within(sidebar()).getByRole("button", { name: "折叠侧栏" }));
    expect(sidebar()).toHaveClass(layer("header"));
    expect(sidebar()).toHaveStyle({ width: "var(--ws-sidebar-collapsed-width)", transform: "translateX(0)" });
    expect(sidebar().nextElementSibling).toHaveStyle({ marginLeft: "var(--ws-sidebar-collapsed-width)" });
    expect(overlay(container)).toBeUndefined();
  });

  it("restores the desktop layer when an open mobile sidebar crosses the breakpoint", () => {
    const { container, rerender } = render(<Harness />);
    openMobile(container);
    viewport.md = true;
    rerender(<Harness />);
    expect(sidebar()).toHaveClass(layer("header"));
    expect(sidebar()).not.toHaveClass(layer("floating-panel"));
    expect(overlay(container)).toBeUndefined();
    expect(sidebar().nextElementSibling).toHaveStyle({ marginLeft: "var(--ws-sidebar-width)" });
  });
});
