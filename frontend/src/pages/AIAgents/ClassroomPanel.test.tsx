import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { showMessage } from "@/lib/toast";
import { classroomApi } from "@services/classroom";
import { planApi } from "@services/classroomPlan";
import { floatingBtnRegistry } from "@utils/floatingBtnRegistry";

import ClassroomPanel from "./ClassroomPanel";

class MockEventSource {
  static created: MockEventSource[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();

  constructor(readonly url: string) {
    MockEventSource.created.push(this);
  }
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("ClassroomPanel role boundary", () => {
  beforeEach(() => {
    MockEventSource.created = [];
    localStorage.clear();
    vi.stubGlobal("EventSource", MockEventSource);
    vi.spyOn(classroomApi, "getActive").mockResolvedValue([]);
    vi.spyOn(planApi, "getActivePlan").mockResolvedValue(null);
    vi.spyOn(floatingBtnRegistry, "register").mockImplementation(() => undefined);
    vi.spyOn(floatingBtnRegistry, "unregister").mockImplementation(() => undefined);
    vi.spyOn(floatingBtnRegistry, "updateTop").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not start student classroom requests for an administrator", () => {
    render(
      <ClassroomPanel
        isAuthenticated
        isStudent={false}
        isAdmin
        userId={1}
      />,
    );

    expect(classroomApi.getActive).not.toHaveBeenCalled();
    expect(planApi.getActivePlan).not.toHaveBeenCalled();
    expect(MockEventSource.created).toHaveLength(0);
    expect(floatingBtnRegistry.register).not.toHaveBeenCalled();
    expect(screen.queryByText("课堂互动")).not.toBeInTheDocument();
  });

  it("keeps polling and realtime updates enabled for a student", async () => {
    render(
      <ClassroomPanel
        isAuthenticated
        isStudent
        isAdmin={false}
        userId={2}
      />,
    );

    await waitFor(() => {
      expect(classroomApi.getActive).toHaveBeenCalledOnce();
      expect(planApi.getActivePlan).toHaveBeenCalledOnce();
    });
    expect(MockEventSource.created).toHaveLength(1);
    expect(MockEventSource.created[0]?.url).toContain("/classroom/stream");
    expect(floatingBtnRegistry.register).toHaveBeenCalledWith(
      "classroom",
      expect.any(Number),
      expect.any(Function),
    );
    expect(screen.getByRole("button", { name: "课堂互动" })).toBeInTheDocument();
  });

  it("stops polling and closes realtime updates when the student scope changes", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ClassroomPanel
        isAuthenticated
        isStudent
        isAdmin={false}
        userId={2}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(classroomApi.getActive).toHaveBeenCalledOnce();
    expect(MockEventSource.created).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(2);

    const stream = MockEventSource.created[0];
    await act(async () => {
      stream?.onmessage?.(new MessageEvent("message", { data: "{}" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(3);

    rerender(
      <ClassroomPanel
        isAuthenticated
        isStudent={false}
        isAdmin
        userId={1}
      />,
    );
    expect(stream?.close).toHaveBeenCalledOnce();
    expect(floatingBtnRegistry.unregister).toHaveBeenCalledWith("classroom");

    const callsBeforeStaleEvents = vi.mocked(classroomApi.getActive).mock.calls.length;
    await act(async () => {
      stream?.onmessage?.(new MessageEvent("message", { data: "{}" }));
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(callsBeforeStaleEvents);
  });

  it("ignores an answer response returned after the student account changes", async () => {
    const response = deferred<{ answer: string; is_correct: boolean }>();
    vi.mocked(classroomApi.getActive).mockResolvedValue([
      {
        id: 9,
        title: "请选择正确答案",
        activity_type: "vote",
        status: "active",
        allow_multiple: false,
        options: [{ key: "A", text: "答案 A" }],
      } as Awaited<ReturnType<typeof classroomApi.getActive>>[number],
    ]);
    vi.spyOn(classroomApi, "respond").mockReturnValue(response.promise as never);
    const success = vi.spyOn(showMessage, "success").mockReturnValue(1);

    const { rerender } = render(
      <ClassroomPanel
        isAuthenticated
        isStudent
        isAdmin={false}
        userId={2}
      />,
    );

    const radio = await screen.findByRole("radio");
    fireEvent.click(radio);
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    expect(classroomApi.respond).toHaveBeenCalledWith(9, "A");

    rerender(
      <ClassroomPanel
        isAuthenticated
        isStudent
        isAdmin={false}
        userId={3}
      />,
    );

    await act(async () => {
      response.resolve({ answer: "A", is_correct: true });
      await response.promise;
    });

    expect(success).not.toHaveBeenCalled();
    expect(screen.queryByText("已提交")).not.toBeInTheDocument();
  });

  it("keeps the newest active refresh when same-student requests finish out of order", async () => {
    const first = deferred<Awaited<ReturnType<typeof classroomApi.getActive>>>();
    const second = deferred<Awaited<ReturnType<typeof classroomApi.getActive>>>();
    vi.mocked(classroomApi.getActive)
      .mockReset()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(
      <ClassroomPanel
        isAuthenticated
        isStudent
        isAdmin={false}
        userId={2}
      />,
    );

    await waitFor(() => expect(classroomApi.getActive).toHaveBeenCalledOnce());
    const stream = MockEventSource.created[0];
    await act(async () => {
      stream?.onmessage?.(new MessageEvent("message", { data: "{}" }));
    });
    await waitFor(() => expect(classroomApi.getActive).toHaveBeenCalledTimes(2));

    second.resolve([
      {
        id: 2,
        title: "较新的课堂题目",
        activity_type: "vote",
        status: "active",
        allow_multiple: false,
        options: [{ key: "A", text: "新答案" }],
      } as Awaited<ReturnType<typeof classroomApi.getActive>>[number],
    ]);
    expect(await screen.findByText("较新的课堂题目")).toBeInTheDocument();

    await act(async () => {
      first.resolve([
        {
          id: 1,
          title: "较旧的课堂题目",
          activity_type: "vote",
          status: "active",
          allow_multiple: false,
          options: [{ key: "A", text: "旧答案" }],
        } as Awaited<ReturnType<typeof classroomApi.getActive>>[number],
      ]);
      await first.promise;
    });

    expect(screen.getByText("较新的课堂题目")).toBeInTheDocument();
    expect(screen.queryByText("较旧的课堂题目")).not.toBeInTheDocument();
  });

  it("does not let an old account refresh unlock the new account refresh", async () => {
    const oldRefresh = deferred<Awaited<ReturnType<typeof classroomApi.getActive>>>();
    const newRefresh = deferred<Awaited<ReturnType<typeof classroomApi.getActive>>>();
    vi.mocked(classroomApi.getActive)
      .mockReset()
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(oldRefresh.promise)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(newRefresh.promise);

    const { rerender } = render(
      <ClassroomPanel
        isAuthenticated
        isStudent
        isAdmin={false}
        userId={2}
      />,
    );

    await waitFor(() => expect(classroomApi.getActive).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "课堂互动" }));
    const oldRefreshButton = document.querySelector(".lucide-rotate-ccw")?.closest("button");
    expect(oldRefreshButton).toBeTruthy();
    fireEvent.click(oldRefreshButton!);
    await waitFor(() => expect(classroomApi.getActive).toHaveBeenCalledTimes(2));

    rerender(
      <ClassroomPanel
        isAuthenticated
        isStudent
        isAdmin={false}
        userId={3}
      />,
    );
    await waitFor(() => expect(classroomApi.getActive).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole("button", { name: "课堂互动" }));
    const newRefreshButton = document.querySelector(".lucide-rotate-ccw")?.closest("button");
    expect(newRefreshButton).toBeTruthy();
    fireEvent.click(newRefreshButton!);
    await waitFor(() => expect(classroomApi.getActive).toHaveBeenCalledTimes(4));
    expect(newRefreshButton).toBeDisabled();

    await act(async () => {
      oldRefresh.resolve([]);
      await oldRefresh.promise;
    });

    expect(newRefreshButton).toBeDisabled();

    await act(async () => {
      newRefresh.resolve([]);
      await newRefresh.promise;
    });
    expect(newRefreshButton).not.toBeDisabled();
  });

  it("does not clear a newer activity when an older result request fails", async () => {
    const oldResult = deferred<Awaited<ReturnType<typeof classroomApi.getResult>>>();
    vi.mocked(classroomApi.getActive)
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: 10,
          title: "较早的课堂题目",
          activity_type: "vote",
          status: "active",
          allow_multiple: false,
          options: [{ key: "A", text: "旧答案" }],
        } as Awaited<ReturnType<typeof classroomApi.getActive>>[number],
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          id: 20,
          title: "较新的课堂题目",
          activity_type: "vote",
          status: "active",
          allow_multiple: false,
          options: [{ key: "A", text: "新答案" }],
        } as Awaited<ReturnType<typeof classroomApi.getActive>>[number],
      ]);
    vi.spyOn(classroomApi, "getResult").mockReturnValue(oldResult.promise);

    render(
      <ClassroomPanel
        isAuthenticated
        isStudent
        isAdmin={false}
        userId={2}
      />,
    );
    expect(await screen.findByText("较早的课堂题目")).toBeInTheDocument();

    const stream = MockEventSource.created[0];
    await act(async () => {
      stream?.onmessage?.(new MessageEvent("message", { data: "{}" }));
    });
    await waitFor(() => expect(classroomApi.getResult).toHaveBeenCalledWith(10));

    await act(async () => {
      stream?.onmessage?.(
        new MessageEvent("message", { data: "{}" }),
      );
    });
    await waitFor(() => expect(classroomApi.getActive).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("较新的课堂题目")).toBeInTheDocument();

    await act(async () => {
      oldResult.reject(new Error("旧结果请求失败"));
      await oldResult.promise.catch(() => undefined);
    });

    expect(screen.getByText("较新的课堂题目")).toBeInTheDocument();
  });

  it("keeps statistics for the latest selected history item", async () => {
    vi.mocked(classroomApi.getActive).mockResolvedValue([]);
    vi.mocked(planApi.getActivePlan).mockResolvedValue({
      id: 1,
      title: "历史课堂计划",
      status: "active",
      current_item_id: null,
      created_by: 1,
      created_at: "2026-07-19T00:00:00Z",
      items: [
        {
          id: 1,
          activity_id: 101,
          order_index: 1,
          status: "ended",
          activity: {
            id: 101,
            title: "历史第一题",
            activity_type: "vote",
            time_limit: 30,
            status: "ended",
            options: [{ key: "A", text: "第一题选项" }],
            correct_answer: "A",
            allow_multiple: false,
          },
        },
        {
          id: 2,
          activity_id: 102,
          order_index: 2,
          status: "ended",
          activity: {
            id: 102,
            title: "历史第二题",
            activity_type: "vote",
            time_limit: 30,
            status: "ended",
            options: [{ key: "A", text: "第二题选项" }],
            correct_answer: "A",
            allow_multiple: false,
          },
        },
      ],
    });
    const firstStats = deferred<Awaited<ReturnType<typeof classroomApi.getStatistics>>>();
    const secondStats = deferred<Awaited<ReturnType<typeof classroomApi.getStatistics>>>();
    vi.spyOn(classroomApi, "getStatistics")
      .mockReturnValueOnce(firstStats.promise)
      .mockReturnValueOnce(secondStats.promise);

    render(
      <ClassroomPanel
        isAuthenticated
        isStudent
        isAdmin={false}
        userId={2}
      />,
    );

    await waitFor(() => expect(planApi.getActivePlan).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "课堂互动" }));
    fireEvent.click(await screen.findByText("1"));
    await waitFor(() => expect(classroomApi.getStatistics).toHaveBeenCalledWith(101));
    fireEvent.click(screen.getByRole("button", { name: /下一题/ }));
    await waitFor(() => expect(classroomApi.getStatistics).toHaveBeenCalledWith(102));

    secondStats.resolve({
      activity_id: 102,
      total_responses: 22,
      option_counts: { A: 22 },
      correct_count: 22,
      correct_rate: 100,
    });
    expect(await screen.findByText(/22 人参与/)).toBeInTheDocument();

    await act(async () => {
      firstStats.resolve({
        activity_id: 101,
        total_responses: 11,
        option_counts: { A: 11 },
        correct_count: 11,
        correct_rate: 100,
      });
      await firstStats.promise;
    });

    expect(screen.getByText(/22 人参与/)).toBeInTheDocument();
    expect(screen.queryByText(/11 人参与/)).not.toBeInTheDocument();
  });
});
