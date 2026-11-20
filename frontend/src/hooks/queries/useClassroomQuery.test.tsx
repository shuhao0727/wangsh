import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { classroomApi, type Activity } from "@services/classroom";
import { useActivityDetail } from "./useClassroomQuery";

vi.mock("@services/classroom", () => ({ classroomApi: { getDetail: vi.fn() } }));
afterEach(() => { vi.resetAllMocks(); vi.useRealTimers(); });

it.each([403, 404])("stops polling activity detail on HTTP %i even with old active data", async (status) => {
  vi.useFakeTimers();
  vi.mocked(classroomApi.getDetail)
    .mockResolvedValueOnce({ id: 3, status: "active" } as Activity)
    .mockRejectedValue({ response: { status } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useActivityDetail(3), { wrapper });
  try {
    await act(async () => { await vi.advanceTimersByTimeAsync(3001); });
    expect(classroomApi.getDetail).toHaveBeenCalledTimes(2);
    expect(result.current.isError).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(classroomApi.getDetail).toHaveBeenCalledTimes(2);
    await act(async () => { await client.invalidateQueries(); });
    expect(classroomApi.getDetail).toHaveBeenCalledTimes(2);
    vi.mocked(classroomApi.getDetail).mockResolvedValue({ id: 3, status: "ended" } as Activity);
    await act(async () => { await result.current.refetch(); });
    expect(classroomApi.getDetail).toHaveBeenCalledTimes(3);
  } finally {
    unmount();
    client.clear();
  }
});
