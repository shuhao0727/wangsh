import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ensureContentRuntime, resetContentRuntimeCache } from "./contentRuntimeLoader";

type RuntimeWindow = Window & {
  katex?: unknown;
  hljs?: unknown;
  mermaid?: unknown;
  markmap?: unknown;
  __mermaidReady?: boolean;
  __mermaidLoadFailed?: boolean;
  __markmapReady?: boolean;
  __markmapLoadFailed?: boolean;
  __katexAutoRenderReady?: boolean;
};

const runtime = window as RuntimeWindow;
const injectedScripts = (): HTMLScriptElement[] => [
  ...document.querySelectorAll<HTMLScriptElement>("script[data-ws-content-runtime]"),
];

/** 让脚本的 load 事件在微任务里触发（模拟网络成功）。 */
const settle = async (script: HTMLScriptElement | undefined, event: "load" | "error") => {
  expect(script).toBeDefined();
  script!.dispatchEvent(new Event(event));
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  resetContentRuntimeCache();
  delete runtime.katex;
  delete runtime.hljs;
  delete runtime.mermaid;
  delete runtime.markmap;
  delete runtime.__mermaidReady;
  delete runtime.__mermaidLoadFailed;
  delete runtime.__markmapReady;
  delete runtime.__markmapLoadFailed;
  delete runtime.__katexAutoRenderReady;
});

afterEach(() => {
  injectedScripts().forEach((node) => node.remove());
  vi.restoreAllMocks();
});

describe("ensureContentRuntime", () => {
  it("只注入该组的脚本，不牵动其他运行时（Mermaid 不再随首屏加载）", async () => {
    void ensureContentRuntime("mermaid");
    const scripts = injectedScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toContain("mermaid@");
    expect(scripts[0].integrity.startsWith("sha384-")).toBe(true);
    expect(scripts[0].crossOrigin).toBe("anonymous");
    await settle(scripts[0], "load");
  });

  it("markmap 组按 d3 → lib → view 串行，前置失败不再请求后续", async () => {
    void ensureContentRuntime("markmap");
    const first = injectedScripts()[0];
    expect(first.src).toContain("/d3@");
    // 前置未完成前，后续脚本不应出现
    expect(injectedScripts()).toHaveLength(1);
    await settle(first, "load");
    const lib = injectedScripts().find((node) => node.src.includes("markmap-lib"));
    expect(lib).toBeDefined();
    await settle(lib, "load");
    expect(injectedScripts().map((node) => node.src)).toContainEqual(
      expect.stringContaining("markmap-view"),
    );
  });

  it("前置失败会 reject、派发错误事件并允许后续显式重试", async () => {
    const failed = vi.fn();
    window.addEventListener("ws:markmap-error", failed);
    const first = ensureContentRuntime("markmap");
    await settle(injectedScripts()[0], "error");
    await expect(first).rejects.toThrow(/加载失败/);
    expect(failed).toHaveBeenCalledOnce();
    expect(runtime.__markmapLoadFailed).toBe(true);
    // 重试会重新注入 d3
    void ensureContentRuntime("markmap");
    expect(injectedScripts().filter((node) => node.src.includes("/d3@"))).toHaveLength(1);
    window.removeEventListener("ws:markmap-error", failed);
  });

  it("幂等：重复调用不重复注入，且返回同一个 Promise", async () => {
    const a = ensureContentRuntime("highlight");
    const b = ensureContentRuntime("highlight");
    expect(a).toBe(b);
    expect(injectedScripts()).toHaveLength(1);
  });

  it("全局对象已存在时完全不发请求（测试与已注入场景）", async () => {
    runtime.katex = {};
    runtime.hljs = {};
    await ensureContentRuntime("katex");
    await ensureContentRuntime("highlight");
    expect(injectedScripts()).toHaveLength(0);
  });

  it("就绪后设置全局标记并派发事件（BookReader 依赖）", async () => {
    const ready = vi.fn();
    const anyReady = vi.fn();
    window.addEventListener("ws:mermaid-ready", ready);
    window.addEventListener("ws:content-runtime-ready", anyReady);

    const pendingJob = ensureContentRuntime("mermaid");
    await settle(injectedScripts()[0], "load");
    await pendingJob;

    expect(runtime.__mermaidReady).toBe(true);
    expect(runtime.__mermaidLoadFailed).toBe(false);
    expect(ready).toHaveBeenCalledOnce();
    expect(anyReady).toHaveBeenCalledOnce();

    window.removeEventListener("ws:mermaid-ready", ready);
    window.removeEventListener("ws:content-runtime-ready", anyReady);
  });

  it("katex 组加载完成后置 __katexAutoRenderReady", async () => {
    const job = ensureContentRuntime("katex");
    await settle(injectedScripts()[0], "load");
    const autoRender = injectedScripts().find((node) => node.src.includes("auto-render"));
    await settle(autoRender, "load");
    await job;
    expect(runtime.__katexAutoRenderReady).toBe(true);
  });
});

describe("index.html 首屏合同", () => {
  const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

  it("不再引用任何第三方 CDN 脚本（只保留 Vite 入口 module script）", () => {
    const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
    const external = scripts.filter((tag) => /(?:src\s*=\s*["']?)(?:https?:)?\/\//i.test(tag));
    expect(external, external.join("\n")).toEqual([]);
    // 本地入口仍然保留
    expect(html).toContain('src="/src/index.tsx"');
  });

  it("保留字体与 KaTeX 样式表的静态引用不变", () => {
    expect(html).toContain("fonts.googleapis.com/css2?family=Inter");
    // KaTeX CSS 由 src/index.tsx 里的 import 'katex/dist/katex.min.css' 打包进产物
    expect(html).not.toMatch(/cdn\.jsdelivr\.net\/npm\/katex/);
  });

  it("说明懒加载归属，避免有人把 defer 脚本加回 index.html", () => {
    expect(html).toContain("contentRuntimeLoader.ts");
  });
});
