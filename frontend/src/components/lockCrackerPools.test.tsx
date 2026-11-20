import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import GameConfigPage from "@/pages/Games/GameConfig";
import LockCrackerPage from "@/pages/Games/LockCracker";

vi.mock("@/lib/toast", () => ({ showMessage: { success: vi.fn(), error: vi.fn() } }));

const storageKey = "wangsh_game_lock_pools";
const originalPools = { numeric: ["67890"], alpha: ["a67890"], mixed: ["#67890"] };

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it("does not store an empty password pool", () => {
  localStorage.setItem(storageKey, JSON.stringify(originalPools));
  render(<MemoryRouter><GameConfigPage /></MemoryRouter>);
  fireEvent.change(screen.getByRole("textbox", { name: "数字锁" }), { target: { value: " ， " } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(originalPools);
});

it("opens a legacy empty pool for editing and saves the repaired password", () => {
  localStorage.setItem(storageKey, JSON.stringify({ ...originalPools, numeric: [] }));
  render(<MemoryRouter><GameConfigPage /></MemoryRouter>);
  const input = screen.getByRole("textbox", { name: "数字锁" });
  expect(input).toHaveValue("");
  fireEvent.change(input, { target: { value: "0073" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual({ ...originalPools, numeric: ["0073"] });
});

it("plays a default lock for a legacy empty pool and keeps nonempty custom pools", () => {
  const legacy = { ...originalPools, numeric: [] };
  localStorage.setItem(storageKey, JSON.stringify(legacy));
  vi.spyOn(Math, "random").mockReturnValue(0);
  render(<LockCrackerPage />);
  fireEvent.change(screen.getByRole("textbox", { name: "输入尝试密码" }), { target: { value: "3829" } });
  fireEvent.click(screen.getByRole("button", { name: "尝试解锁" }));
  expect(screen.getByText("已破解")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /字母数字锁/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "输入尝试密码" }), { target: { value: "a67890" } });
  fireEvent.click(screen.getByRole("button", { name: "尝试解锁" }));
  expect(screen.getByText("已破解")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(legacy);
});
