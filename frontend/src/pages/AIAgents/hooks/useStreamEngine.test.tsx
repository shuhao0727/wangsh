import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStreamEngine } from "./useStreamEngine";

class MockXMLHttpRequest {
  static latest: MockXMLHttpRequest | null = null;

  responseText = "";
  status = 200;
  withCredentials = false;
  onprogress: (() => void) | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private aborted = false;

  constructor() {
    MockXMLHttpRequest.latest = this;
  }

  open() {}

  setRequestHeader() {}

  getResponseHeader(name: string) {
    return name.toLowerCase() === "content-type"
      ? this.contentType
      : null;
  }

  send() {}

  abort() {
    if (this.aborted) return;
    this.aborted = true;
    this.onabort?.();
  }

  push(chunk: string) {
    if (this.aborted) return;
    this.responseText += chunk;
    this.onprogress?.();
  }

  contentType = "text/event-stream; charset=utf-8";

  finish(status = 200, contentType = "text/event-stream; charset=utf-8") {
    if (this.aborted) return;
    this.status = status;
    this.contentType = contentType;
    this.onload?.();
  }
}

const deltaEvent = (answer: string) =>
  `event: message_delta\ndata: ${JSON.stringify({ answer })}\n\n`;

const endEvent = (answer: string) =>
  `event: message_end\ndata: ${JSON.stringify({ answer })}\n\n`;

describe("useStreamEngine long responses", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockXMLHttpRequest.latest = null;
    vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses an inactivity timeout instead of cutting off an active long stream", async () => {
    const callbacks = {
      onDelta: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    };
    const { result } = renderHook(() => useStreamEngine());

    let streamPromise!: Promise<void>;
    act(() => {
      streamPromise = result.current.startStream({
        url: "/api/v1/ai-agents/stream",
        body: { message: "long" },
        callbacks,
        timeoutMs: 50,
      });
    });

    const xhr = MockXMLHttpRequest.latest;
    expect(xhr).not.toBeNull();

    act(() => xhr?.push(deltaEvent("第一段")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });
    act(() => xhr?.push(deltaEvent("第二段")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });
    act(() => {
      xhr?.push(endEvent("第一段第二段"));
      xhr?.finish();
    });
    await act(async () => {
      await streamPromise;
    });

    expect(callbacks.onEnd).toHaveBeenCalledWith("第一段第二段");
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("returns partial text when a stream becomes inactive", async () => {
    const callbacks = {
      onDelta: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    };
    const { result } = renderHook(() => useStreamEngine());

    let streamPromise!: Promise<void>;
    act(() => {
      streamPromise = result.current.startStream({
        url: "/api/v1/ai-agents/stream",
        body: { message: "long" },
        callbacks,
        timeoutMs: 50,
      });
    });

    act(() => MockXMLHttpRequest.latest?.push(deltaEvent("已经生成的内容")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
      await streamPromise;
    });

    expect(callbacks.onEnd).not.toHaveBeenCalled();
    expect(callbacks.onError).toHaveBeenCalledWith(
      "请求超时（1秒）",
      "已经生成的内容",
    );
  });

  it("reports an HTTP error with the server detail", async () => {
    const callbacks = {
      onDelta: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    };
    const { result } = renderHook(() => useStreamEngine());

    let streamPromise!: Promise<void>;
    act(() => {
      streamPromise = result.current.startStream({
        url: "/api/v1/ai-agents/stream",
        body: { message: "long" },
        callbacks,
      });
    });

    const xhr = MockXMLHttpRequest.latest;
    if (!xhr) throw new Error("missing mock xhr");
    xhr.responseText = JSON.stringify({ detail: "上游网关失败" });
    act(() => xhr.finish(502, "application/json"));
    await act(async () => {
      await streamPromise;
    });

    expect(callbacks.onEnd).not.toHaveBeenCalled();
    expect(callbacks.onError).toHaveBeenCalledWith(
      "请求失败（HTTP 502）：上游网关失败",
      undefined,
    );
  });

  it("treats EOF without a terminal event as an incomplete stream", async () => {
    const callbacks = {
      onDelta: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    };
    const { result } = renderHook(() => useStreamEngine());

    let streamPromise!: Promise<void>;
    act(() => {
      streamPromise = result.current.startStream({
        url: "/api/v1/ai-agents/stream",
        body: { message: "long" },
        callbacks,
      });
    });

    act(() => {
      MockXMLHttpRequest.latest?.push(deltaEvent("未完成回答"));
      MockXMLHttpRequest.latest?.finish();
    });
    await act(async () => {
      await streamPromise;
    });

    expect(callbacks.onEnd).not.toHaveBeenCalled();
    expect(callbacks.onError).toHaveBeenCalledWith(
      "流式响应提前结束",
      "未完成回答",
    );
  });

  it("keeps partial text when the user stops generation", async () => {
    const callbacks = {
      onDelta: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    };
    const { result } = renderHook(() => useStreamEngine());

    let streamPromise!: Promise<void>;
    act(() => {
      streamPromise = result.current.startStream({
        url: "/api/v1/ai-agents/stream",
        body: { message: "long" },
        callbacks,
      });
    });

    act(() => {
      MockXMLHttpRequest.latest?.push(deltaEvent("保留下来的内容"));
      result.current.stopStream();
    });
    await act(async () => {
      await streamPromise;
    });

    expect(callbacks.onEnd).not.toHaveBeenCalled();
    expect(callbacks.onError).toHaveBeenCalledWith(
      "已停止生成",
      "保留下来的内容",
    );
  });

  it("coalesces many deltas before updating the UI", async () => {
    const callbacks = {
      onDelta: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    };
    const { result } = renderHook(() => useStreamEngine());

    let streamPromise!: Promise<void>;
    act(() => {
      streamPromise = result.current.startStream({
        url: "/api/v1/ai-agents/stream",
        body: { message: "long" },
        callbacks,
      });
    });

    const pieces = Array.from({ length: 1000 }, (_, index) => String(index % 10));
    act(() => {
      MockXMLHttpRequest.latest?.push(pieces.map(deltaEvent).join(""));
      MockXMLHttpRequest.latest?.push(endEvent(pieces.join("")));
      MockXMLHttpRequest.latest?.finish();
    });
    await act(async () => {
      await streamPromise;
    });

    expect(callbacks.onEnd).toHaveBeenCalledWith(pieces.join(""));
    expect(callbacks.onDelta.mock.calls.length).toBeLessThan(10);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it.each(["message_end", "workflow_finished"])(
    "rejects a truncated %s terminal event",
    async (eventType) => {
      const callbacks = {
        onDelta: vi.fn(),
        onEnd: vi.fn(),
        onError: vi.fn(),
      };
      const { result } = renderHook(() => useStreamEngine());

      let streamPromise!: Promise<void>;
      act(() => {
        streamPromise = result.current.startStream({
          url: "/api/v1/ai-agents/stream",
          body: { message: "long" },
          callbacks,
        });
      });

      act(() => {
        MockXMLHttpRequest.latest?.push(deltaEvent("已经生成的内容"));
        MockXMLHttpRequest.latest?.push(
          `event: ${eventType}\ndata: {"answer":"残缺`,
        );
        MockXMLHttpRequest.latest?.finish();
      });
      await act(async () => {
        await streamPromise;
      });

      expect(callbacks.onEnd).not.toHaveBeenCalled();
      expect(callbacks.onError).toHaveBeenCalledWith(
        "流式终止事件格式错误",
        "已经生成的内容",
      );
    },
  );

  it("silently stops a stale stream during navigation", async () => {
    const callbacks = {
      onDelta: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    };
    const { result } = renderHook(() => useStreamEngine());

    let streamPromise!: Promise<void>;
    act(() => {
      streamPromise = result.current.startStream({
        url: "/api/v1/ai-agents/stream",
        body: { message: "long" },
        callbacks,
      });
    });

    act(() => {
      MockXMLHttpRequest.latest?.push(deltaEvent("旧会话内容"));
      result.current.stopStream("navigation");
    });
    await act(async () => {
      await streamPromise;
    });

    expect(callbacks.onEnd).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
});
