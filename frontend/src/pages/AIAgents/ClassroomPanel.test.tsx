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

  it("shows the management entry without starting student requests for an administrator", () => {
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
    expect(floatingBtnRegistry.register).toHaveBeenCalledWith(
      "classroom",
      expect.any(Number),
      expect.any(Function),
    );
    expect(screen.getByRole("link", { name: "课堂互动" })).toHaveAttribute(
      "href",
      "/admin/classroom-interaction",
    );
  });

  it.each([403, 404])("stops automatic classroom requests on HTTP %s until manual refresh", async (status) => {
    vi.useFakeTimers();
    vi.mocked(classroomApi.getActive).mockRejectedValueOnce({ response: { status } });
    render(<ClassroomPanel isAuthenticated isStudent isAdmin={false} userId={2} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(classroomApi.getActive).toHaveBeenCalledOnce();
    expect(MockEventSource.created).toHaveLength(1);
    expect(MockEventSource.created[0].close).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "课堂互动" }));
    expect(screen.getByRole("status")).toHaveTextContent("暂时无法读取课堂");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "刷新" })); });
    expect(classroomApi.getActive).toHaveBeenCalled();
    expect(screen.queryByText(/暂时无法读取课堂/)).not.toBeInTheDocument();
  });

  it("reconciles on stream connection and retries a transient notification read", async () => {
    vi.useFakeTimers();
    render(<ClassroomPanel isAuthenticated isStudent isAdmin={false} userId={2} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(classroomApi.getActive).toHaveBeenCalledOnce();
    const source = MockEventSource.created[0];
    vi.mocked(classroomApi.getActive).mockRejectedValueOnce({ response: { status: 503 } });
    await act(async () => {
      source.onmessage?.(new MessageEvent("message", { data: '{"type":"connected"}' }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(3);
  });

  it("backs off after consecutive transient classroom reads fail and resets on success", async () => {
    vi.useFakeTimers();
    vi.mocked(classroomApi.getActive)
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockRejectedValueOnce({ response: { status: 503 } });
    render(<ClassroomPanel isAuthenticated isStudent isAdmin={false} userId={2} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(5999); });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(4);
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

  it("stops the 3s fallback polling once SSE reports connected", async () => {
    vi.useFakeTimers();
    render(
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

    // SSE 未连通前，兜底轮询照常按 3 秒节奏触发
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(classroomApi.getActive).toHaveBeenCalledTimes(2);

    // 收到 connected 后停掉轮询
    const stream = MockEventSource.created[0];
    await act(async () => {
      stream?.onmessage?.(
        new MessageEvent("message", { data: JSON.stringify({ type: "connected" }) }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsAfterConnected = vi.mocked(classroomApi.getActive).mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
      await Promise.resolve();
    });
    // 连通期间不再有轮询请求（30 秒内本应产生 10 次）
    expect(classroomApi.getActive).toHaveBeenCalledTimes(callsAfterConnected);
  });

  it("resumes the fallback polling after SSE errors out", async () => {
    vi.useFakeTimers();
    render(
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
    const stream = MockEventSource.created[0];
    await act(async () => {
      stream?.onmessage?.(
        new MessageEvent("message", { data: JSON.stringify({ type: "connected" }) }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      stream?.onerror?.(new Event("error"));
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsAtDisconnect = vi.mocked(classroomApi.getActive).mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(vi.mocked(classroomApi.getActive).mock.calls.length).toBeGreaterThan(callsAtDisconnect);
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

  it("does not mark the next activity submitted when the previous answer arrives late", async () => {
    const answer = deferred<Awaited<ReturnType<typeof classroomApi.respond>>>();
    const current = { id: 11, title: "前一题", activity_type: "vote", status: "active", allow_multiple: false,
      options: [{ key: "A", text: "甲" }] } as Awaited<ReturnType<typeof classroomApi.getActive>>[number];
    vi.mocked(classroomApi.getActive).mockResolvedValueOnce([current])
      .mockResolvedValue([{ ...current, id: 12, title: "下一题" }]);
    vi.spyOn(classroomApi, "respond").mockReturnValueOnce(answer.promise);
    render(<ClassroomPanel isAuthenticated isStudent isAdmin={false} userId={2} />);
    fireEvent.click(await screen.findByRole("radio"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await act(async () => { MockEventSource.created[0].onmessage?.(new MessageEvent("message", { data: "{}" })); });
    await screen.findByText("下一题");
    await act(async () => { answer.resolve({ id: 99, answer: "A", is_correct: true, submitted_at: "2030-01-01T00:00:00Z" }); });
    expect(screen.getByRole("button", { name: "提交答案" })).toBeVisible();
    expect(screen.queryByText("你的答案：A")).not.toBeInTheDocument();
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

  it("reads student results for the latest selected history item", async () => {
    vi.spyOn(classroomApi, "getStatistics").mockRejectedValue(new Error("仅教职工可读"));
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
    const firstStats = deferred<Awaited<ReturnType<typeof classroomApi.getResult>>>();
    const secondStats = deferred<Awaited<ReturnType<typeof classroomApi.getResult>>>();
    vi.spyOn(classroomApi, "getResult")
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
    await waitFor(() => expect(classroomApi.getResult).toHaveBeenCalledWith(101));
    fireEvent.click(screen.getByRole("button", { name: /下一题/ }));
    await waitFor(() => expect(classroomApi.getResult).toHaveBeenCalledWith(102));

    const review = (id: number, count: number, my_answer: string): Awaited<ReturnType<typeof classroomApi.getResult>> => ({
      id, activity_type: "vote", title: "回顾", options: null, allow_multiple: false,
      my_answer, is_correct: true, correct_answer: null,
      stats: { activity_id: id, total_responses: count, option_counts: { A: count }, correct_count: count, correct_rate: 100 },
    });
    secondStats.resolve(review(102, 22, "只属于第二题的作答"));
    expect(await screen.findByText(/22 人参与/)).toBeInTheDocument();

    await act(async () => {
      firstStats.resolve(review(101, 11, "只属于第一题的作答"));
      await firstStats.promise;
    });

    expect(screen.getByText(/22 人参与/)).toBeInTheDocument();
    expect(screen.queryByText(/11 人参与/)).not.toBeInTheDocument();
    expect(screen.getByText(/只属于第二题的作答/)).toBeInTheDocument();
    expect(screen.queryByText(/只属于第一题的作答/)).not.toBeInTheDocument();
  });
});
