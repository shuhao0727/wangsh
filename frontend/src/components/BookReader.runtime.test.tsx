/**
 * BookReader 的 Mermaid / 公式消费方生命周期测试。
 *
 * 重点不是渲染漂亮的图，而是这几条**静默失败**风险：
 *   - 库晚于组件就绪 → 必须能补渲染，且只渲染一次；
 *   - 组件卸载后迟到的 SVG 不能写回已脱离的 pre；
 *   - 切章时旧章节的迟到结果不能覆盖新章节；
 *   - 渲染失败保留源码文本，不崩组件。
 */
import React, { StrictMode } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookReader } from "@/features/it-technology/learning/BookReader";
import { resetContentRuntimeCache } from "@/lib/contentRuntimeLoader";
import type { LearningBook, LearningBookChapter } from "@/features/it-technology/learning/types";

type MermaidResult = { svg: string };
/** 测试里只关心 Window 上的全局库句柄，用 any 绕开与既有 katex 全局声明的冲突。 */
type RuntimeWindow = {
  mermaid?: { render: ReturnType<typeof vi.fn> };
  katex?: { renderToString: ReturnType<typeof vi.fn> };
  hljs?: unknown;
};

const runtime = window as unknown as RuntimeWindow & Record<string, unknown>;
const codeA = "graph TD; A-->B";
const codeB = "graph TD; C-->D";

const chapter = (slug: string, code: string): LearningBookChapter => ({
  slug,
  title: slug,
  summary: "",
  estimatedMinutes: 1,
  difficulty: "beginner",
  goals: [],
  markdown: `\`\`\`mermaid\n${code}\n\`\`\``,
  checklist: [],
  experiments: [],
  glossary: [],
  references: [],
});

const book: LearningBook = {
  moduleKey: "ml",
  title: "Runtime test",
  subtitle: "",
  description: "",
  audience: "",
  outcomes: [],
  chapters: [chapter("first", codeA), chapter("second", codeB)],
};

const props = {
  book,
  activeSlug: "first",
  completedChapters: {},
  favoriteChapters: {},
  onSelectChapter: vi.fn(),
  onToggleComplete: vi.fn(),
  onToggleFavorite: vi.fn(),
};

function deferred() {
  let resolve!: (value: MermaidResult) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<MermaidResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const svg = (name: string) => `<svg data-testid="${name}"><text>${name}</text></svg>`;
const fireReady = () => act(() => window.dispatchEvent(new Event("ws:mermaid-ready")));
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

let previousMermaid: PropertyDescriptor | undefined;

beforeEach(() => {
  resetContentRuntimeCache();
  previousMermaid = Object.getOwnPropertyDescriptor(window, "mermaid");
  delete runtime.mermaid;
  // KaTeX/hljs 视为已就绪，避免触发真实 CDN 注入
  runtime.katex = { renderToString: vi.fn(() => "<span>tex</span>") };
  runtime.hljs = {};
});

afterEach(() => {
  cleanup();
  document.querySelectorAll("script[data-ws-content-runtime]").forEach((node) => node.remove());
  if (previousMermaid) Object.defineProperty(window, "mermaid", previousMermaid);
  else delete runtime.mermaid;
  delete runtime.katex;
  delete runtime.hljs;
  vi.restoreAllMocks();
});

describe("BookReader Mermaid 消费方生命周期", () => {
  it("组件管理的 pre 带 data-processed，避免全局自动扫描重复处理", () => {
    const view = render(<BookReader {...props} />);
    expect(view.container.querySelector("pre.mermaid")).toHaveAttribute("data-processed", "true");
    expect(view.container.querySelector("pre.mermaid")).toHaveTextContent(codeA);
  });

  it("库晚于挂载就绪时补渲染，且只渲染一次", async () => {
    const view = render(<BookReader {...props} />);
    expect(view.container.querySelector("pre.mermaid")).toHaveTextContent(codeA);

    const renderDiagram = vi.fn().mockResolvedValue({ svg: svg("late") });
    runtime.mermaid = { render: renderDiagram };
    fireReady();
    await waitFor(() => expect(view.queryByTestId("late")).not.toBeNull());
    expect(renderDiagram).toHaveBeenCalledTimes(1);
  });

  it("就绪时已可用的库立即渲染，重复 ready 事件不重复渲染", async () => {
    const renderDiagram = vi.fn().mockResolvedValue({ svg: svg("immediate") });
    runtime.mermaid = { render: renderDiagram };
    const view = render(<BookReader {...props} />);
    await waitFor(() => expect(view.queryByTestId("immediate")).not.toBeNull());
    fireReady();
    fireReady();
    await flush();
    expect(renderDiagram).toHaveBeenCalledTimes(1);
  });

  it("卸载后移除 late-ready 订阅，不再发起渲染", async () => {
    const view = render(<BookReader {...props} />);
    view.unmount();
    const renderDiagram = vi.fn().mockResolvedValue({ svg: svg("orphan") });
    runtime.mermaid = { render: renderDiagram };
    fireReady();
    await flush();
    expect(renderDiagram).not.toHaveBeenCalled();
  });

  it("在途结果不写回已脱离的 pre", async () => {
    const request = deferred();
    runtime.mermaid = { render: vi.fn().mockReturnValue(request.promise) };
    const view = render(<BookReader {...props} />);
    const pre = view.container.querySelector("pre.mermaid")!;
    await flush();
    expect(runtime.mermaid.render).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => { request.resolve({ svg: svg("detached") }); await request.promise; });
    expect(pre.querySelector("svg")).toBeNull();
    expect(pre.textContent?.trim()).toBe(codeA);
  });

  it("切章时旧章节的迟到结果不覆盖新章节", async () => {
    const first = deferred();
    const second = deferred();
    const renderDiagram = vi.fn((_id: string, code: string) =>
      code.trim() === codeA ? first.promise : second.promise,
    );
    runtime.mermaid = { render: renderDiagram };
    const view = render(<BookReader {...props} />);
    const oldPre = view.container.querySelector("pre.mermaid")!;
    await flush();

    view.rerender(<BookReader {...props} activeSlug="second" />);
    await flush();
    await act(async () => { second.resolve({ svg: svg("current") }); await second.promise; });
    await waitFor(() => expect(view.queryByTestId("current")).not.toBeNull());

    await act(async () => { first.resolve({ svg: svg("stale") }); await first.promise; });
    expect(view.queryByTestId("stale")).toBeNull();
    expect(view.getByTestId("current")).toBeInTheDocument();
    expect(oldPre.querySelector("svg")).toBeNull();
  });

  it("渲染 reject 时保留源码文本", async () => {
    const request = deferred();
    runtime.mermaid = { render: vi.fn().mockReturnValue(request.promise) };
    const view = render(<BookReader {...props} />);
    await flush();
    await act(async () => {
      request.reject(new Error("render unavailable"));
      await request.promise.catch(() => undefined);
    });
    await flush();
    expect(view.container.querySelector("pre.mermaid")).toHaveTextContent(codeA);
    expect(view.container.querySelector("pre.mermaid svg")).toBeNull();
  });

  it("渲染 API 同步抛错时不崩组件", async () => {
    runtime.mermaid = {
      render: vi.fn(() => { throw new Error("synchronous render failure"); }),
    };
    const view = render(<BookReader {...props} />);
    await flush();
    expect(view.container.querySelector("pre.mermaid")).toHaveTextContent(codeA);
    expect(view.container.querySelector("pre.mermaid svg")).toBeNull();
  });

  it("StrictMode 下清理/重放不会重复渲染", async () => {
    const renderDiagram = vi.fn().mockResolvedValue({ svg: svg("strict") });
    runtime.mermaid = { render: renderDiagram };
    const view = render(
      <StrictMode>
        <BookReader {...props} />
      </StrictMode>,
    );
    await waitFor(() => expect(view.queryByTestId("strict")).not.toBeNull());
    expect(renderDiagram).toHaveBeenCalledTimes(1);
    fireReady();
    await flush();
    expect(renderDiagram).toHaveBeenCalledTimes(1);
  });
});

describe("BookReader 首次进入时才拉取 CDN 运行时", () => {
  it("挂载后注入 Mermaid 脚本（首屏 HTML 不再引用它）", async () => {
    const view = render(<BookReader {...props} />);
    const sources = [...document.querySelectorAll<HTMLScriptElement>("script[data-ws-content-runtime]")]
      .map((node) => node.src);
    expect(sources.some((src) => src.includes("mermaid@"))).toBe(true);
    view.unmount();
  });

  it("KaTeX/highlight 已就绪时不发任何请求", async () => {
    const view = render(<BookReader {...props} />);
    const sources = [...document.querySelectorAll<HTMLScriptElement>("script[data-ws-content-runtime]")]
      .map((node) => node.src);
    expect(sources.filter((src) => src.includes("katex@") || src.includes("highlight.min.js"))).toEqual([]);
    view.unmount();
  });
});
