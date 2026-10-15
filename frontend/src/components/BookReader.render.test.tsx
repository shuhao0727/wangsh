import React from "react";
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookReader } from "../pages/Admin/ITTechnology/learning/BookReader";
import type { LearningBook } from "../pages/Admin/ITTechnology/learning/types";
import { parseColor, readCssColor } from "../lib/cssTokens";

const bookWith = (markdown: string): LearningBook => ({
  moduleKey: "ml", title: "样板学习书", subtitle: "样板", description: "正文", audience: "学习者", outcomes: [],
  chapters: [{ slug: "intro", title: "第一章", summary: "概述", estimatedMinutes: 5, difficulty: "beginner",
    goals: [], markdown, checklist: [], experiments: [], glossary: [], references: [] }],
});
const props = (markdown: string) => ({
  book: bookWith(markdown), activeSlug: "intro", completedChapters: {}, favoriteChapters: {},
  onSelectChapter: vi.fn(), onToggleComplete: vi.fn(), onToggleFavorite: vi.fn(),
});
const diagram = (source = "flowchart TD\nA-->B") => "```mermaid\n" + source + "\n```";
const svg = (label: string) => `<svg xmlns="http://www.w3.org/2000/svg"><text>${label}</text></svg>`;
const runtime = (renderSvg = vi.fn().mockResolvedValue({ svg: svg("就绪图表") })) => {
  const mermaid = { initialize: vi.fn(), render: renderSvg };
  Object.defineProperty(window, "mermaid", { configurable: true, writable: true, value: mermaid });
  return mermaid;
};
const setGlobal = (name: string, value: unknown) => Object.defineProperty(window, name, { configurable: true, writable: true, value });
const libraryScript = (name: string) => {
  const script = document.createElement("script");
  script.src = `/fixtures/${name}.min.js`;
  script.dataset.readerTestScript = "true";
  document.head.appendChild(script);
  return script;
};
const flush = () => act(async () => { await Promise.resolve(); });
const ready = () => act(() => { window.dispatchEvent(new Event("ws:mermaid-ready")); });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const contrast = (foreground: string, background: string) => {
  const luminance = (value: string) => {
    const color = parseColor(value);
    if (!color) throw new Error(`测试颜色无法解析：${value}`);
    const [red, green, blue] = [color.red, color.green, color.blue].map((channel) => {
      const s = channel / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  ["mermaid", "katex", "hljs", "__mermaidLoadFailed"].forEach((name) => Reflect.deleteProperty(window, name));
  document.querySelectorAll("[data-reader-test-script]").forEach((script) => script.remove());
  document.documentElement.removeAttribute("style");
});

describe("BookReader rendering boundaries", () => {
  it("keeps shared Markdown styling, chapter content, numbering and real code elements", () => {
    const select = vi.fn();
    const { container } = render(<BookReader {...props("## 原有标题\n\n正文与 `inline()`。\n\n```python\nprint('<tag>')\n```\n\n> 引用内容")} onSelectChapter={select} />);
    expect(container.querySelector("article")).toHaveClass("br-article", "ws-markdown");
    expect(container.querySelector("h2")).toHaveTextContent("一、原有标题");
    expect(container.querySelector("p code")).toHaveTextContent("inline()");
    expect(container.querySelector("pre code.language-python")).toHaveTextContent("print('<tag>')");
    expect(container.querySelector("pre tag")).toBeNull();
    expect(container.querySelector("blockquote")).toHaveTextContent("引用内容");
    fireEvent.click(screen.getByText("第一章"));
    expect(select).toHaveBeenCalledWith("intro");
  });

  it("does not mutate headings inside code fences or merge adjacent display math blocks", () => {
    const renderToString = vi.fn((code: string) => `<span class="katex">${code}</span>`);
    setGlobal("katex", { renderToString });
    const markdown = [
      "## 正文标题",
      "",
      "```text",
      "## 代码标题",
      "### 代码子标题",
      "```",
      "",
      "\\[a\\]",
      "\\[b\\]",
    ].join("\n");
    const { container } = render(<BookReader {...props(markdown)} />);

    expect(container.querySelector("pre code")).toHaveTextContent("## 代码标题");
    expect(container.querySelector("pre code")).toHaveTextContent("### 代码子标题");
    expect(container.querySelector("pre code")).not.toHaveTextContent("一、代码标题");
    expect(container.querySelectorAll(".math-block")).toHaveLength(2);
    expect(renderToString.mock.calls.map(([code]) => code.trim())).toEqual(
      expect.arrayContaining(["a", "b"]),
    );
  });

  it.each(["$$a$$\n$$b$$", "$$\na\n$$\n$$\nb\n$$"])("renders adjacent dollar display blocks independently: %s", (markdown) => {
    const renderToString = vi.fn((code: string) => `<span class="katex">${code}</span>`);
    setGlobal("katex", { renderToString });
    const { container } = render(<BookReader {...props(markdown)} />);

    expect(container.querySelectorAll(".math-block")).toHaveLength(2);
    expect(Array.from(container.querySelectorAll(".math-block"), (block) => block.textContent?.trim())).toEqual(["a", "b"]);
    expect([...new Set(renderToString.mock.calls.map(([code]) => code.trim()))]).toEqual(["a", "b"]);
    renderToString.mock.calls.forEach((call) => {
      expect(call).toEqual([expect.any(String), expect.objectContaining({ displayMode: true })]);
    });
  });

  it.each(["```", "~~~"])("preserves dollar math as literal source inside %s fences", (fence) => {
    const renderToString = vi.fn((code: string) => `<span class="katex">${code}</span>`);
    setGlobal("katex", { renderToString });
    const source = "$$a$$\n$$\nb\n$$";
    const { container } = render(<BookReader {...props(`${fence}text\n${source}\n${fence}`)} />);

    expect(container.querySelector("pre code.language-text")?.textContent).toBe(`${source}\n`);
    expect(container.querySelector(".math-block")).toBeNull();
    expect(renderToString).not.toHaveBeenCalled();
  });

  it("keeps longer fences open and excludes fenced headings from the table of contents", () => {
    const markdown = [
      "````python",
      "## 代码标题",
      "```",
      "仍在代码围栏内",
      "````",
      "",
      "## 正文标题",
    ].join("\n");
    const { container } = render(<BookReader {...props(markdown)} />);

    expect(container.querySelector("pre code")).toHaveTextContent("## 代码标题");
    expect(container.querySelectorAll("article h2")).toHaveLength(1);
    expect(container.querySelector("article h2")).toHaveTextContent("一、正文标题");

    fireEvent.click(screen.getByRole("button", { name: "内容大纲" }));
    const sidebar = screen.getByRole("complementary");
    expect(sidebar).toHaveTextContent("一、正文标题");
    expect(sidebar).not.toHaveTextContent("代码标题");
  });

  it("configures the CDN runtime and keeps safe foreignObject text and user SVG colors", async () => {
    const bindFunctions = vi.fn();
    const sourceSvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="evil()">
      <style>.user-color { fill: #abcdef; }</style>
      <rect id="user-node" fill="#12AB34" stroke="#245ABC" style="fill:#556677;stroke:#AABBCC" />
      <foreignObject width="120" height="40"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#126A34">
        <span>安全标签</span><strong>强调文字</strong><br/><img src="x" onerror="evil()"/>
        <iframe src="about:blank"></iframe></div></foreignObject>
      <script>evil()</script><a href="javascript:evil()"><text>危险链接</text></a>
    </svg>`;
    const mermaid = runtime(vi.fn().mockResolvedValue({ svg: sourceSvg, bindFunctions }));
    const { container } = render(<BookReader {...props(diagram())} />);
    const image = await screen.findByRole("img", { name: "Mermaid 图表" });
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: "base", securityLevel: "strict", startOnLoad: false, suppressErrorRendering: true }));
    const config = mermaid.initialize.mock.calls[0][0];
    Object.values(config.themeVariables).forEach((value) => expect(value).toMatch(/^#[0-9A-F]{6}$/));
    expect(image).toHaveTextContent(/安全标签\s*强调文字/);
    expect(image.querySelector("foreignObject div span")).toHaveTextContent("安全标签");
    const user = image.querySelector("#user-node");
    expect(user).toHaveAttribute("fill", "#12AB34");
    expect(user).toHaveAttribute("stroke", "#245ABC");
    expect(user).toHaveAttribute("style", "fill:#556677;stroke:#AABBCC");
    expect(image.querySelector("foreignObject div")).toHaveAttribute("style", "color:#126A34");
    expect(image.querySelector("style")).toHaveTextContent("#abcdef");
    expect(image.querySelector("script,iframe,img,[onerror],[onload],[href^='javascript:']")).toBeNull();
    expect(container.querySelector("section.br-mermaid")).toHaveAttribute("aria-busy", "false");
    expect(bindFunctions).not.toHaveBeenCalled();
  });

  it("waits for late-ready without polling and ignores duplicate ready events", async () => {
    const interval = vi.spyOn(window, "setInterval");
    render(<BookReader {...props(diagram())} />);
    expect(screen.getByRole("status")).toHaveTextContent("图表加载中");
    expect(screen.getByText(/flowchart TD/)).toBeInTheDocument();
    const mermaid = runtime();
    ready();
    ready();
    await flush();
    expect(screen.getByRole("img", { name: "Mermaid 图表" })).toBeInTheDocument();
    expect(mermaid.render).toHaveBeenCalledTimes(1);
    expect(interval).not.toHaveBeenCalled();
  });

  it("uses a bounded missing-runtime fallback but can recover on a later ready event", async () => {
    vi.useFakeTimers();
    render(<BookReader {...props(diagram())} />);
    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("图表运行库未就绪");
    expect(screen.getByText(/flowchart TD/)).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    const mermaid = runtime();
    ready();
    await flush();
    expect(screen.getByRole("img", { name: "Mermaid 图表" })).toHaveTextContent("就绪图表");
    expect(mermaid.render).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["script", "event", "recorded"])("shows an explicit CDN error (%s) and safe source fallback", (kind) => {
    const script = libraryScript("mermaid");
    if (kind === "recorded") setGlobal("__mermaidLoadFailed", true);
    render(<BookReader {...props(diagram("flowchart TD\nA[<script>用户源码</script>]"))} />);
    if (kind === "script") fireEvent.error(script);
    if (kind === "event") act(() => { window.dispatchEvent(new Event("ws:mermaid-error")); });
    expect(screen.getByRole("alert")).toHaveTextContent("运行库加载失败");
    expect(screen.getByText(/用户源码/).tagName).toBe("CODE");
    expect(document.querySelector("article script")).toBeNull();
  });

  it("surfaces render errors without swallowing them or interpreting error/source HTML", async () => {
    runtime(vi.fn().mockRejectedValue(new Error("语法错误 <img onerror='evil()'>")));
    render(<BookReader {...props(diagram())} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("图表渲染失败：语法错误");
    expect(screen.getByText(/flowchart TD/)).toBeInTheDocument();
    expect(document.querySelector("article img")).toBeNull();
  });

  it.each(["", "<div>不是 SVG</div>"])("rejects empty or non-SVG render output (%s)", async (invalidSvg) => {
    runtime(vi.fn().mockResolvedValue({ svg: invalidSvg }));
    render(<BookReader {...props(diagram())} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("图表渲染失败");
    expect(screen.queryByRole("img", { name: "Mermaid 图表" })).toBeNull();
  });

  it.each(["```mermaid\n```", "```mermaid\n\n```", "```mermaid\n \t \n```"])("handles an empty fence through ReactMarkdown without object source or runtime calls (%s)", async (markdown) => {
    const mermaid = runtime();
    const { container } = render(<BookReader {...props(markdown)} />);
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("暂无图表内容");
    expect(container.querySelector(".br-mermaid pre")).toBeNull();
    expect(container).not.toHaveTextContent("[object Object]");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mermaid.initialize).not.toHaveBeenCalled();
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it("ignores late render completion after its bounded render timeout", async () => {
    vi.useFakeTimers();
    const pending = deferred<{ svg: string }>();
    runtime(vi.fn().mockReturnValue(pending.promise));
    render(<BookReader {...props(diagram())} />);
    await flush();
    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("图表渲染超时");
    await act(async () => { pending.resolve({ svg: svg("超时旧图") }); });
    expect(screen.queryByRole("img", { name: "Mermaid 图表" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("图表渲染超时");
  });

  it("hides previous SVG immediately and prevents old responses from replacing an updated chapter", async () => {
    const old = deferred<{ svg: string }>(), latest = deferred<{ svg: string }>();
    const renderSvg = vi.fn().mockResolvedValueOnce({ svg: svg("第一版") }).mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    runtime(renderSvg);
    const view = render(<BookReader {...props(diagram("flowchart TD\nA[第一版]"))} />);
    await screen.findByRole("img", { name: "Mermaid 图表" });
    view.rerender(<BookReader {...props(diagram("flowchart TD\nA[第二版]"))} />);
    expect(screen.queryByRole("img", { name: "Mermaid 图表" })).toBeNull();
    await flush();
    view.rerender(<BookReader {...props(diagram("flowchart TD\nA[第三版]"))} />);
    await flush();
    await act(async () => { latest.resolve({ svg: svg("第三版图表") }); });
    await act(async () => { old.resolve({ svg: svg("过期第二版") }); });
    expect(screen.getByRole("img", { name: "Mermaid 图表" })).toHaveTextContent("第三版图表");
    expect(screen.queryByText("过期第二版")).toBeNull();
    expect(new Set(renderSvg.mock.calls.map(([id]) => id)).size).toBe(3);
  });

  it("cleans ready/script listeners and timers on unmount while still waiting", async () => {
    vi.useFakeTimers();
    const script = libraryScript("mermaid");
    const removeScript = vi.spyOn(script, "removeEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const view = render(<BookReader {...props(diagram())} />);
    view.unmount();
    expect(removeScript).toHaveBeenCalledWith("load", expect.any(Function));
    expect(removeScript).toHaveBeenCalledWith("error", expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith("ws:mermaid-ready", expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith("ws:mermaid-error", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    const mermaid = runtime();
    ready();
    fireEvent.load(script);
    await flush();
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it("does not apply pending render results after unmount, including StrictMode cleanup", async () => {
    vi.useFakeTimers();
    const pending = deferred<{ svg: string }>();
    const mermaid = runtime(vi.fn().mockReturnValue(pending.promise));
    const view = render(<React.StrictMode><BookReader {...props(diagram())} /></React.StrictMode>);
    await flush();
    expect(mermaid.render).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { pending.resolve({ svg: svg("卸载旧图") }); });
    expect(document.querySelector(".br-mermaid-svg")).toBeNull();
  });

  it("lets math/highlight arrive independently without remounting a rendered Mermaid block", async () => {
    const katexScript = libraryScript("katex"), highlightScript = libraryScript("highlight");
    const mermaid = runtime();
    const { container } = render(<BookReader {...props(diagram() + "\n\n## 公式\n\n\\(x+y\\)\n\n## 代码\n\n```python\nprint(1)\n```")} />);
    await screen.findByRole("img", { name: "Mermaid 图表" });
    const katex = { renderToString: vi.fn().mockReturnValue('<span class="katex">就绪公式</span>') };
    setGlobal("katex", katex);
    fireEvent.load(katexScript);
    expect(container.querySelector(".math-inline")).toHaveTextContent("就绪公式");
    expect(container.querySelector("pre code.hljs")).toBeNull();
    const hljs = { highlight: vi.fn().mockReturnValue({ value: '<span class="hljs-keyword">print</span>(1)' }) };
    setGlobal("hljs", hljs);
    fireEvent.load(highlightScript);
    expect(container.querySelector("pre code.hljs .hljs-keyword")).toHaveTextContent("print");
    expect(mermaid.render).toHaveBeenCalledTimes(1);
    expect(katex.renderToString).toHaveBeenCalledWith("x+y", expect.objectContaining({ displayMode: false }));
  });

  it("keeps highlighting available when KaTeX is missing, then recovers math after timeout", async () => {
    vi.useFakeTimers();
    const script = libraryScript("katex");
    const remove = vi.spyOn(script, "removeEventListener");
    setGlobal("hljs", { highlight: vi.fn().mockReturnValue({ value: '<span class="hljs-keyword">print</span>()' }) });
    const view = render(<BookReader {...props("\\[x^2\\]\n\n## 代码\n\n```python\nprint()\n```")} />);
    expect(view.container.querySelector(".math-block")).toHaveTextContent("公式加载中");
    expect(view.container.querySelector("pre .hljs-keyword")).toHaveTextContent("print");
    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(view.container.querySelector(".math-block")).toHaveTextContent("公式渲染不可用");
    expect(vi.getTimerCount()).toBe(0);
    setGlobal("katex", { renderToString: vi.fn().mockReturnValue('<span class="katex">迟到公式</span>') });
    fireEvent.load(script);
    expect(view.container.querySelector(".math-block")).toHaveTextContent("迟到公式");
    view.unmount();
    expect(remove).toHaveBeenCalledWith("load", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("does not let a highlight script error end KaTeX loading prematurely", () => {
    const katexScript = libraryScript("katex"), highlightScript = libraryScript("highlight");
    const { container } = render(<BookReader {...props("\\[x\\]")} />);
    fireEvent.error(highlightScript);
    expect(container.querySelector(".math-block")).toHaveTextContent("公式加载中");
    fireEvent.error(katexScript);
    expect(container.querySelector(".math-block")).toHaveTextContent("公式渲染不可用");
    expect(container.querySelector(".math-block code")).toHaveTextContent("x");
  });

  it("passes resolved KaTeX error-text color with readable contrast without overriding explicit math colors", () => {
    const renderToString = vi.fn((code: string, options: { errorColor: string; displayMode: boolean }) => {
      if (code.includes("notacommand")) return `<span title="Parse error" style="color:${options.errorColor}">错误公式</span>`;
      return '<span class="katex"><span class="mord" style="color:#126A34">用户公式颜色</span></span>';
    });
    setGlobal("katex", { renderToString });
    const { container } = render(<BookReader {...props("\\(\\notacommand\\)\n\n\\[\\notacommand\\]\n\n\\(\\color{#126A34}{x}\\)")} />);
    const errorColor = readCssColor("--ws-color-error-text");
    const surface = readCssColor("--ws-color-surface");
    expect(parseColor(errorColor)).not.toBeNull();
    expect(errorColor).not.toMatch(/var\(|color-mix\(/);
    expect(contrast(errorColor, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(errorColor, readCssColor("--ws-color-diagram-canvas"))).toBeGreaterThanOrEqual(4.5);
    expect(renderToString).toHaveBeenCalledWith("\\notacommand", expect.objectContaining({ throwOnError: false, displayMode: false, errorColor }));
    expect(renderToString).toHaveBeenCalledWith("\\notacommand\n", expect.objectContaining({ throwOnError: false, displayMode: true, errorColor }));
    container.querySelectorAll('[title="Parse error"]').forEach((element) => {
      expect(element).toHaveAttribute("style", `color:${errorColor}`);
    });
    expect(container.querySelector(".katex .mord")).toHaveAttribute("style", "color:#126A34");
  });

  it("uses a visible safe fallback when KaTeX throws or a highlighter rejects a language", () => {
    setGlobal("katex", { renderToString: vi.fn(() => { throw new Error("invalid math"); }) });
    setGlobal("hljs", { highlight: vi.fn(() => { throw new Error("unknown language"); }) });
    const { container } = render(<BookReader {...props("\\[bad_math\\]\n\n## 代码\n\n```unknown\n<script>源码</script>\n```")} />);
    expect(container.querySelector(".math-block")).toHaveTextContent("公式渲染失败");
    expect(container.querySelector(".math-block code")).toHaveTextContent("bad_math");
    expect(container.querySelector("code.language-unknown")).toHaveTextContent("<script>源码</script>");
    expect(container.querySelector("script")).toBeNull();
  });

  it("preserves block code typography and zero padding without restoring color overrides", () => {
    const css = readFileSync("src/pages/Admin/ITTechnology/learning/BookReader.css", "utf8");
    const blockCode = css.match(/\.br-article\.ws-markdown pre code\s*\{([^}]+)\}/)?.[1];
    const highlightedCode = css.match(/\.br-article\.ws-markdown pre code\.hljs\s*\{([^}]+)\}/)?.[1];
    expect(blockCode).toBeDefined();
    expect(blockCode).toMatch(/\bpadding:\s*0\s*;/);
    expect(blockCode).toMatch(/\bfont-family:\s*inherit\s*;/);
    expect(blockCode).toMatch(/\bfont-size:\s*inherit\s*;/);
    expect(highlightedCode).toBeDefined();
    expect(highlightedCode).toMatch(/\bpadding:\s*0\s*;/);
    if (blockCode === undefined || highlightedCode === undefined) {
      throw new Error("BookReader code block CSS rules are missing");
    }
    expect(blockCode + highlightedCode).not.toMatch(/\b(?:color|background(?:-color)?)\s*:/);
  });

  it("shows the empty body state and keeps CSS color ownership in the shared Markdown layer", () => {
    const { container } = render(<BookReader {...props("")} />);
    expect(container.querySelector("article")).toHaveTextContent("本章节暂无正文内容");
    const css = readFileSync("src/pages/Admin/ITTechnology/learning/BookReader.css", "utf8");
    expect(css).not.toMatch(/--ws-color-code-(?:bg|text)/);
    expect(css).not.toMatch(/\.katex[^\{]*\{[^}]*\b(?:background|color)\s*:/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(css).toContain(".br-mermaid-svg");
  });
});
