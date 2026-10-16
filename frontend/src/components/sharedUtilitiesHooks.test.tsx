import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/hooks/queries/queryKeys";
import { useBatchMutation } from "@/hooks/queries/useBatchMutation";
import { usePagination } from "@/hooks/usePagination";
import { useStandaloneReturn } from "@/hooks/useStandaloneReturn";
import { formatDate, formatDateTime, formatDuration } from "@/utils/dateFormat";
import { getErrorMessage } from "@/utils/errorHandling";
import { calculatePagination, fetchAllPages, generatePageNumbers, isValidPage, parsePaginationFromSearchParams } from "@/utils/pagination";

const originalOpener = Object.getOwnPropertyDescriptor(window, "opener");
const originalClosed = Object.getOwnPropertyDescriptor(window, "closed");
const restoreProperty = (name: string, descriptor?: PropertyDescriptor) => {
  if (descriptor) Object.defineProperty(window, name, descriptor);
  else Reflect.deleteProperty(window, name);
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  restoreProperty("opener", originalOpener);
  restoreProperty("closed", originalClosed);
});

describe("shared date and error utilities", () => {
  it("formats local date objects and explicit formats without timezone assumptions", () => {
    const date = new Date(2026, 9, 14, 12, 34, 56);
    expect(formatDate(date)).toBe("2026-10-14");
    expect(formatDate(date, "YYYY/MM/DD")).toBe("2026/10/14");
    expect(formatDateTime(date)).toBe("2026-10-14 12:34:56");
    expect(formatDateTime(date, "HH:mm")).toBe("12:34");
  });
  it.each([[0, "00:00"], [65, "01:05"], [3600, "60:00"]])("formats duration %s", (seconds, expected) => {
    expect(formatDuration(seconds as number)).toBe(expected);
  });
  it.each([
    [new Error("network"), "network"], ["failure", "failure"],
    [{ response: { data: { detail: "detail", message: "message" } } }, "detail"],
    [{ response: { data: { message: "message" } } }, "message"],
    [null, "未知错误"], [undefined, "未知错误"], [{ response: null }, "未知错误"],
    [{ response: { data: null } }, "未知错误"], [{ response: { data: undefined } }, "未知错误"],
    [{ response: { data: 42 } }, "未知错误"], [{ unexpected: true }, "未知错误"],
  ])("handles unknown error shape %# without throwing", (input, expected) => {
    expect(getErrorMessage(input)).toBe(expected);
  });
});

describe("pagination utilities and hook", () => {
  it("normalizes finite values, empty data, final-page indices and skip/limit", () => {
    expect(calculatePagination({ page: 9, pageSize: 10, total: 23 })).toMatchObject({ currentPage: 3, totalPages: 3, startIndex: 20, endIndex: 23, skip: 20, limit: 10, hasNext: false, hasPrevious: true });
    expect(calculatePagination({ page: -1, pageSize: 0, total: -2 })).toMatchObject({ currentPage: 1, pageSize: 1, total: 0, totalPages: 1, endIndex: 0 });
    expect(isValidPage(1.5, 3)).toBe(false);
    expect(isValidPage(3, 3)).toBe(true);
    expect(isValidPage(4, 3)).toBe(false);
  });
  it("preserves first/last pages and gaps at each pagination position", () => {
    expect(generatePageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(generatePageNumbers(1, 20)).toEqual([1, 2, 3, 4, 5, null, 20]);
    expect(generatePageNumbers(10, 20)).toEqual([1, null, 8, 9, 10, 11, 12, null, 20]);
    expect(generatePageNumbers(20, 20)).toEqual([1, null, 16, 17, 18, 19, 20]);
  });
  it("parses defaults, invalid values, and legacy limit", () => {
    expect(parsePaginationFromSearchParams(new URLSearchParams("page=2&limit=25"))).toEqual({ page: 2, pageSize: 25 });
    expect(parsePaginationFromSearchParams(new URLSearchParams("page=-2&pageSize=nope"), 3, 15)).toEqual({ page: 3, pageSize: 15 });
    expect(parsePaginationFromSearchParams(new URLSearchParams("pageSize=20&limit=25"))).toEqual({ page: 1, pageSize: 20 });
  });
  it("uses actual returned item counts and stops on an empty page", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ items: [1, 2], total: 5 }).mockResolvedValueOnce({ items: [3], total: 5 }).mockResolvedValueOnce({ items: [], total: 5 });
    expect(await fetchAllPages(fetch, 4)).toEqual([1, 2, 3]);
    expect(fetch.mock.calls).toEqual([[0, 4], [2, 4], [3, 4]]);
  });
  it("propagates failed page fetches rather than pretending to return all rows", async () => {
    const error = new Error("page unavailable");
    await expect(fetchAllPages(vi.fn().mockRejectedValue(error))).rejects.toBe(error);
  });
  it("supports bounded navigation and does not repeat unchanged callbacks", () => {
    const changed = vi.fn();
    const { result } = renderHook(() => usePagination({ total: 25, pageSize: 10, onPageChange: changed }));
    act(() => result.current.prevPage());
    act(() => result.current.nextPage());
    expect(result.current.currentPage).toBe(2);
    act(() => result.current.goToLastPage());
    act(() => result.current.nextPage());
    act(() => result.current.goToPage(99));
    expect(result.current.currentPage).toBe(3);
    act(() => result.current.goToFirstPage());
    expect(changed.mock.calls).toEqual([[2], [3], [1]]);
  });
  it("navigates from the displayed page after totals shrink and does not resurrect a stale page", () => {
    const { result, rerender } = renderHook(({ total }) => usePagination({ total, initialPage: 8, pageSize: 10 }), { initialProps: { total: 100 } });
    rerender({ total: 25 });
    expect(result.current.currentPage).toBe(3);
    act(() => result.current.prevPage());
    expect(result.current.currentPage).toBe(2);
    rerender({ total: 100 });
    expect(result.current.currentPage).toBe(2);
  });
});

const Standalone = () => {
  const back = useStandaloneReturn("/owner");
  const location = useLocation();
  return <><button onClick={back}>返回</button><output>{location.pathname}</output></>;
};
const renderStandalone = (search = "") => render(<MemoryRouter initialEntries={[`/preview${search}`]}><Standalone /></MemoryRouter>);

describe("standalone return", () => {
  it("returns a directly opened page without closing its window", () => {
    Object.defineProperty(window, "opener", { configurable: true, value: null });
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    renderStandalone();
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.getByText("/owner")).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
  it.each(["?launch=tab", "?launch=other"])("falls back when tab closure is refused (%s)", async (search) => {
    vi.useFakeTimers();
    Object.defineProperty(window, "closed", { configurable: true, value: false });
    Object.defineProperty(window, "opener", { configurable: true, value: search.includes("other") ? {} : null });
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    renderStandalone(search);
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(close).toHaveBeenCalledOnce();
    expect(screen.getByText("/preview")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTime(150));
    expect(screen.getByText("/owner")).toBeInTheDocument();
  });
  it("does not navigate a successfully closed tab and clears fallback on unmount", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "closed", { configurable: true, value: true });
    vi.spyOn(window, "close").mockImplementation(() => {});
    const view = renderStandalone("?launch=tab");
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    await act(() => vi.advanceTimersByTime(150));
    expect(screen.getByText("/preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("batch mutation", () => {
  it("settles synchronous item validation errors without skipping later items", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const failure = new Error("synchronous validation failed");
    const mutation = vi.fn((id: number) => { if (id === 2) throw failure; return Promise.resolve(id * 10); });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useBatchMutation({ mutationFn: mutation, invalidateKeys: [] }), { wrapper });
    let outcome: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => { outcome = await result.current.mutateAsync([1, 2, 3]); });
    expect(mutation.mock.calls.map(args => args[0])).toEqual([1, 2, 3]);
    expect(outcome).toEqual({ results: [{ status: "fulfilled", value: 10 }, { status: "rejected", reason: failure }, { status: "fulfilled", value: 30 }], successCount: 2, errorCount: 1 });
    unmount();
    client.clear();
  });
  it("settles every input in order, reports partial failure, and invalidates established query keys", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const success = vi.fn();
    const failure = new Error("one item failed");
    const mutation = vi.fn(async (id: number) => { if (id === 2) throw failure; return id * 10; });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useBatchMutation({ mutationFn: mutation, invalidateKeys: [queryKeys.articles.all], onSuccess: success }), { wrapper });
    let outcome: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => { outcome = await result.current.mutateAsync([1, 2, 3]); });
    expect(mutation.mock.calls.map(args => args[0])).toEqual([1, 2, 3]);
    expect(outcome).toMatchObject({ successCount: 2, errorCount: 1 });
    expect(outcome?.results).toEqual([{ status: "fulfilled", value: 10 }, { status: "rejected", reason: failure }, { status: "fulfilled", value: 30 }]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.articles.all });
    expect(success).toHaveBeenCalledWith(outcome?.results);
    await act(async () => { outcome = await result.current.mutateAsync([]); });
    expect(outcome).toEqual({ results: [], successCount: 0, errorCount: 0 });
    unmount();
    client.clear();
  });
});
