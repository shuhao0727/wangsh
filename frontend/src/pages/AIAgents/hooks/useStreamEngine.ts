/**
 * useStreamEngine — 标准化 SSE 流式请求引擎
 * 替代 index.tsx 中 130 行手写 SSE 解析逻辑
 */
import { useCallback, useRef } from "react";
import { createParser } from "eventsource-parser";
import type { ParsedEvent, ReconnectInterval } from "eventsource-parser";

import {
  createReasoningContentFilter,
  sanitizeReasoningContent,
} from "../utils/reasoningContentFilter";

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onEnd: (fullText: string) => void;
  onError: (errText: string, partialText?: string) => void;
  onWorkflowStarted?: (groupId: string) => void;
  onNodeStarted?: (name: string) => void;
  onNodeFinished?: (name: string, detail?: string) => void;
}

interface StreamOptions {
  url: string;
  body: Record<string, unknown>;
  callbacks: StreamCallbacks;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

type StopReason = "user_stop" | "navigation" | "unmount";

export function useStreamEngine() {
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (options: StreamOptions) => {
    const {
      url,
      body,
      callbacks,
      headers: extraHeaders,
      timeoutMs = 120_000,
    } = options;

    // 中止之前的请求
    if (abortRef.current) {
      abortRef.current.abort("superseded");
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // 空闲超时：只在持续一段时间没有收到新数据时中止，长回答只要仍在输出就继续等待。
    let timeoutTriggered = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const clearIdleTimeout = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    const armIdleTimeout = () => {
      clearIdleTimeout();
      timeoutId = setTimeout(() => {
        timeoutTriggered = true;
        controller.abort();
      }, timeoutMs);
    };
    armIdleTimeout();

    let fullText = "";
    let finished = false;
    let sawTerminalEvent = false;
    let deltaTimer: ReturnType<typeof setTimeout> | null = null;
    let lastNotifiedText = "";
    let reasoningFilterFinished = false;
    const reasoningFilter = createReasoningContentFilter();
    const hasVisibleText = (text: string) => text.trim().length > 0;

    const clearDeltaTimer = () => {
      if (deltaTimer !== null) {
        clearTimeout(deltaTimer);
        deltaTimer = null;
      }
    };

    const flushDelta = () => {
      clearDeltaTimer();
      if (fullText !== lastNotifiedText) {
        lastNotifiedText = fullText;
        callbacks.onDelta(fullText);
      }
    };

    const scheduleDelta = () => {
      if (deltaTimer !== null) return;
      deltaTimer = setTimeout(() => {
        deltaTimer = null;
        if (!finished && fullText !== lastNotifiedText) {
          lastNotifiedText = fullText;
          callbacks.onDelta(fullText);
        }
      }, 32);
    };

    const appendAnswerDelta = (value: unknown) => {
      if (reasoningFilterFinished || typeof value !== "string" || !value)
        return;
      const visibleDelta = reasoningFilter.push(value);
      if (visibleDelta) {
        fullText += visibleDelta;
        scheduleDelta();
      }
    };

    const finalizeReasoningFilter = () => {
      if (reasoningFilterFinished) return;
      reasoningFilterFinished = true;
      const tail = reasoningFilter.finish();
      if (tail) fullText += tail;
    };

    const replaceWithFinalAnswer = (value: unknown) => {
      if (typeof value !== "string" || !value) return;
      fullText = sanitizeReasoningContent(value);
      reasoningFilterFinished = true;
    };

    const finishSuccess = () => {
      if (finished) return;
      finalizeReasoningFilter();
      flushDelta();
      finished = true;
      clearIdleTimeout();
      callbacks.onEnd(fullText);
    };

    const finishError = (message: string) => {
      if (finished) return;
      finalizeReasoningFilter();
      finished = true;
      clearIdleTimeout();
      clearDeltaTimer();
      callbacks.onError(message, fullText || undefined);
    };

    const finishSilently = () => {
      if (finished) return;
      finished = true;
      clearIdleTimeout();
      clearDeltaTimer();
    };

    const stringValue = (value: unknown): string =>
      typeof value === "string" ? value : "";

    const eventData = (payload: any) =>
      payload?.data && typeof payload.data === "object"
        ? payload.data
        : payload;

    const getDeltaText = (eventType: string, payload: any): string => {
      const data = eventData(payload);
      if (eventType === "text_chunk") {
        return stringValue(data?.text) || stringValue(payload?.text);
      }
      if (eventType === "message_delta") {
        return (
          stringValue(data?.answer) ||
          stringValue(data?.delta) ||
          stringValue(payload?.delta) ||
          stringValue(data?.text)
        );
      }
      return stringValue(data?.answer) || stringValue(payload?.answer);
    };

    const getFinalAnswerText = (payload: any): string => {
      const data = eventData(payload);
      const outputs =
        data?.outputs && typeof data.outputs === "object" ? data.outputs : null;
      return (
        stringValue(data?.answer) ||
        stringValue(data?.text) ||
        stringValue(data?.content) ||
        stringValue(outputs?.answer) ||
        stringValue(outputs?.text) ||
        stringValue(outputs?.content)
      );
    };

    const handleEvent = (event: ParsedEvent | ReconnectInterval) => {
      if (event.type !== "event") return;
      const eventType = event.event || "";
      let payload: any = null;
      let parsedJson = true;
      try {
        payload = event.data ? JSON.parse(event.data) : null;
      } catch {
        parsedJson = false;
        payload = { text: event.data };
      }

      const resolvedEventType =
        eventType || (payload?.event ? String(payload.event) : "");
      if (
        !parsedJson &&
        ["message_end", "workflow_finished", "error"].includes(
          resolvedEventType,
        )
      ) {
        finishError("流式终止事件格式错误");
        return;
      }
      handleParsedEvent(resolvedEventType, payload);
    };

    const handleParsedEvent = (eventType: string, payload: any) => {
      if (finished) return;
      if (
        ["message_delta", "message", "agent_message", "text_chunk"].includes(
          eventType,
        )
      ) {
        appendAnswerDelta(getDeltaText(eventType, payload));
      } else if (eventType === "message_end") {
        sawTerminalEvent = true;
        replaceWithFinalAnswer(getFinalAnswerText(payload));
        finalizeReasoningFilter();
        if (hasVisibleText(fullText)) {
          finishSuccess();
          return;
        }
        finishError("模型未返回内容");
      } else if (eventType === "workflow_started") {
        callbacks.onWorkflowStarted?.(
          payload?.workflow_run_id || `wf-${Date.now()}`,
        );
      } else if (eventType === "node_started") {
        const name = payload?.data?.title || payload?.data?.node_name || "节点";
        callbacks.onNodeStarted?.(String(name));
      } else if (eventType === "node_finished") {
        const name = payload?.data?.title || payload?.data?.node_name || "节点";
        const rawSummary =
          stringValue(payload?.data?.summary) || stringValue(payload?.summary);
        const summary = sanitizeReasoningContent(rawSummary).slice(0, 500);
        callbacks.onNodeFinished?.(String(name), summary || undefined);
      } else if (eventType === "workflow_finished") {
        sawTerminalEvent = true;
        replaceWithFinalAnswer(getFinalAnswerText(payload));
        finalizeReasoningFilter();
        if (hasVisibleText(fullText)) {
          finishSuccess();
          return;
        }
        finishError("模型未返回内容");
      } else if (eventType === "error") {
        sawTerminalEvent = true;
        const baseMsg = payload?.message || payload?.error || "对话发生错误";
        const detail =
          typeof payload?.detail === "string" ? payload.detail.trim() : "";
        const errMsg = detail
          ? `${baseMsg}（${detail.slice(0, 220)}）`
          : baseMsg;
        finishError(String(errMsg));
      }
      // Unknown and reasoning-only events (for example agent_thought) are ignored.
    };

    try {
      // 使用 XHR 实现真正的流式读取
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("Accept", "text/event-stream");
        if (extraHeaders) {
          Object.entries(extraHeaders).forEach(([k, v]) =>
            xhr.setRequestHeader(k, v),
          );
        }
        xhr.withCredentials = true;

        const parser = createParser(handleEvent);
        let processedLength = 0;

        // 监听 abort 信号
        controller.signal.addEventListener("abort", () => xhr.abort());

        // 关键：onprogress 每次收到数据都触发
        xhr.onprogress = () => {
          const newText = xhr.responseText.substring(processedLength);
          processedLength = xhr.responseText.length;
          if (newText) {
            armIdleTimeout();
            parser.feed(newText);
          }
        };

        xhr.onload = () => {
          // 处理剩余数据
          const remaining = xhr.responseText.substring(processedLength);
          if (remaining) {
            parser.feed(remaining);
          }
          // eventsource-parser 需要空行派发最后一个事件；正常 SSE 多一个空行也不会产生事件。
          parser.feed("\n\n");
          if (!finished) {
            if (xhr.status < 200 || xhr.status >= 300) {
              let detail = "";
              try {
                const payload = JSON.parse(xhr.responseText);
                detail = String(
                  payload?.detail || payload?.message || payload?.error || "",
                ).trim();
              } catch {
                const text = xhr.responseText.trim();
                if (text && !text.startsWith("<")) detail = text.slice(0, 220);
              }
              const suffix = detail ? `：${detail.slice(0, 220)}` : "";
              finishError(`请求失败（HTTP ${xhr.status}）${suffix}`);
            } else {
              const contentType = xhr.getResponseHeader("Content-Type") || "";
              if (
                contentType &&
                !contentType.toLowerCase().includes("text/event-stream")
              ) {
                finishError("服务返回了非流式响应");
              } else if (hasVisibleText(fullText) && !sawTerminalEvent) {
                finishError("流式响应提前结束");
              } else {
                finishError("模型未返回内容");
              }
            }
          }
          resolve();
        };

        xhr.onerror = () => reject(new Error("网络错误"));
        xhr.onabort = () => {
          if (!finished && timeoutTriggered) {
            finishError(`请求超时（${Math.ceil(timeoutMs / 1000)}秒）`);
          } else if (!finished && controller.signal.reason === "user_stop") {
            finishError("已停止生成");
          } else {
            finishSilently();
          }
          resolve();
        };
        xhr.send(JSON.stringify(body));
      });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      finishError(e?.message || "网络错误");
    } finally {
      clearIdleTimeout();
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, []);

  const stopStream = useCallback((reason: StopReason = "user_stop") => {
    if (abortRef.current) {
      abortRef.current.abort(reason);
      abortRef.current = null;
    }
  }, []);

  const isStreaming = useCallback(() => abortRef.current !== null, []);

  return { startStream, stopStream, isStreaming };
}
