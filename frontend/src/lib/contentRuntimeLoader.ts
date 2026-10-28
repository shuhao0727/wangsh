/**
 * 内容运行时（KaTeX / highlight.js / Mermaid / Markmap）**按需**加载器。
 *
 * 背景：
 *   这 4 组库原先写在 index.html 的 `<script defer>` 里，全部属于首屏请求
 *   （gzip 合计约 1.37MB，其中 Mermaid 单文件就 ~980KB）。它们的唯一消费方是
 *   BookReader（Markdown 正文）与 MindMapViewer（思维导图），而这两个组件本身
 *   就在懒加载路由里。改成运行时按需注入后，首屏静态请求归零。
 *
 * 设计要点：
 *   1. **不进首屏**：`index.html` 不再引用任何 CDN 脚本，只有字体样式表。
 *   2. **组内串行、组间独立**：同一组按依赖顺序加载，前一个失败后续不再请求，
 *      不会因为 Mermaid 挂了连累 KaTeX。
 *   3. **可等待**：`ensureContentRuntime(name)` 返回 Promise，组件可以选择 await
 *      或沿用"轮询 window 全局 + 监听事件"的既有兼容方式。
 *   4. **幂等**：同一运行时重复调用只注入一次脚本；失败后**不自动重试**，
 *      但允许显式再次调用（失败状态会清空），避免把失败永久固化。
 *   5. 保留 SRI + `crossorigin=anonymous`，和原来 `<script defer>` 的安全基线一致。
 *
 * 就绪信号（对外合同，BookReader / MindMapViewer 依赖）：
 *   - Mermaid：`window.__mermaidReady`、事件 `ws:mermaid-ready`；
 *     失败：`window.__mermaidLoadFailed`、事件 `ws:mermaid-error`。
 *   - Markmap：`window.__markmapReady`、事件 `ws:markmap-ready`（**仅指核心就绪**）；
 *     失败：`window.__markmapLoadFailed`、事件 `ws:markmap-error`。
 *   - KaTeX：加载完成即 `window.katex` 可用；`window.__katexAutoRenderReady` 表示
 *     auto-render 扩展就绪。highlight.js 完成后即 `window.hljs`。
 */

export type ContentRuntimeName = "katex" | "highlight" | "mermaid" | "markmap";

interface RuntimeWindow extends Window {
  katex?: unknown;
  hljs?: unknown;
  mermaid?: unknown;
  markmap?: { Transformer?: unknown; Markmap?: unknown };
  __mermaidReady?: boolean;
  __mermaidLoadFailed?: boolean;
  __markmapReady?: boolean;
  __markmapLoadFailed?: boolean;
  __katexAutoRenderReady?: boolean;
}

interface RuntimeAsset {
  /** 脚本地址（固定版本 + 固定 SRI，升级必须两处一起改）。 */
  src: string;
  integrity: string;
  /** 该资源加载成功后的收尾动作（置全局标记、派发事件）。 */
  onReady?: (window: RuntimeWindow) => void;
  /** 该资源失败后的收尾动作。 */
  onError?: (window: RuntimeWindow) => void;
}

/** 组件判断"是否已经可以直接用"的全局探测；命中则完全不发请求。 */
const READY_PROBES: Record<ContentRuntimeName, (window: RuntimeWindow) => boolean> = {
  katex: (window) => Boolean(window.katex),
  highlight: (window) => Boolean(window.hljs),
  mermaid: (window) => Boolean(window.mermaid),
  markmap: (window) => Boolean(window.markmap?.Transformer && window.markmap?.Markmap),
};

const markRuntimeReady = (name: ContentRuntimeName) => (window: RuntimeWindow) => {
  if (name === "mermaid") {
    window.__mermaidReady = true;
    window.__mermaidLoadFailed = false;
    window.dispatchEvent(new Event("ws:mermaid-ready"));
  } else if (name === "markmap") {
    window.__markmapReady = true;
    window.__markmapLoadFailed = false;
    window.dispatchEvent(new Event("ws:markmap-ready"));
  }
  // 统一信号：任何一组就绪都派发，消费方可用一个监听覆盖多个运行时。
  window.dispatchEvent(new CustomEvent("ws:content-runtime-ready", { detail: { name } }));
};

const markRuntimeFailed = (name: ContentRuntimeName) => (window: RuntimeWindow) => {
  if (name === "mermaid") {
    window.__mermaidLoadFailed = true;
    window.dispatchEvent(new Event("ws:mermaid-error"));
  } else if (name === "markmap") {
    window.__markmapLoadFailed = true;
    window.dispatchEvent(new Event("ws:markmap-error"));
  }
};

/**
 * 运行时定义。
 * 注意 markmap 的两个 UMD 构建必须用 `dist/browser/*`：包根的 `dist/index.js`
 * 是 ESM，用传统 script 加载会抛 "Cannot use import statement outside a module"。
 */
const RUNTIME_ASSETS: Record<ContentRuntimeName, readonly RuntimeAsset[]> = {
  // 公式渲染：katex 核心 + auto-render 扩展
  katex: [
    {
      src: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js",
      integrity: "sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg",
    },
    {
      src: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js",
      integrity: "sha384-43gviWU0YVjaDtb/GhzOouOXtZMP/7XUzwPTstBeZFe/+rCMvRwr4yROQP43s0Xk",
      onReady: (window) => {
        window.__katexAutoRenderReady = true;
      },
    },
  ],
  // 代码高亮
  highlight: [
    {
      src: "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js",
      integrity: "sha384-F/bZzf7p3Joyp5psL90p/p89AZJsndkSoGwRpXcZhleCWhd8SnRuoYo4d0yirjJp",
    },
  ],
  // 流程图（体积最大，必须延后）
  mermaid: [
    {
      src: "https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.min.js",
      integrity: "sha384-EOXBFmc3gx5mb+vn0vPvvGqACToJD24hhacX5Yx+8NUUQrHIle/Qi5Bg9o3zKwW2",
    },
  ],
  // 思维导图：d3 → lib/view（两者都挂到 window.markmap）
  markmap: [
    {
      src: "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
      integrity: "sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i",
    },
    {
      src: "https://cdn.jsdelivr.net/npm/markmap-lib@0.18.12/dist/browser/index.iife.js",
      integrity: "sha384-ZlXKtR0wcZqxEYI8i3TPFFiOJR1MEdIzdVvnhSOonCrPsBup4dnkRw49FeYhfsHF",
    },
    {
      src: "https://cdn.jsdelivr.net/npm/markmap-view@0.18.12/dist/browser/index.js",
      integrity: "sha384-p+gyhsDIg0RmvIKRr9BBGSyJ9NDDkiFsbilRwdZd20Q8mUL2v7e8+orY4pvTV52w",
    },
  ],
};

/** 每个运行时只保留一个进行中/已完成的 Promise，保证幂等。 */
const pending = new Map<ContentRuntimeName, Promise<void>>();
/** 已注入过的脚本地址，避免重复 appendChild。 */
const injected = new Set<string>();

const injectScript = (asset: RuntimeAsset): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    // index.html 里仍保留 KaTeX/highlight 的 defer 脚本（公式与代码块是首屏刚需），
    // 这时同一 src 已经存在，不能重复注入，只能等它自己加载完。
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${asset.src}"]`);
    if (existing && !existing.dataset.wsContentRuntime) {
      if (existing.dataset.wsRuntimeSettled === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`内容运行时资源加载失败: ${asset.src}`)),
        { once: true },
      );
      return;
    }
    if (injected.has(asset.src)) {
      // 已经注入过但 Promise 被重建（理论上不会发生），直接认为成功。
      resolve();
      return;
    }
    injected.add(asset.src);
    const script = document.createElement("script");
    script.src = asset.src;
    script.integrity = asset.integrity;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.dataset.wsContentRuntime = "true";
    script.addEventListener(
      "load",
      () => {
        script.dataset.wsRuntimeSettled = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        // 允许显式重试：把地址从已注入集合里移除。
        injected.delete(asset.src);
        script.remove();
        reject(new Error(`内容运行时资源加载失败: ${asset.src}`));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

/**
 * 确保某个内容运行时可用。
 *
 * - 全局对象已存在（例如另有脚本注入、或测试里已 stub）→ 立即 resolve，不发请求。
 * - 加载失败 → reject，并清空缓存，后续显式调用可以重试。
 *
 * 调用方可以忽略返回的 Promise（fire-and-forget），也可以 await。
 */
export function ensureContentRuntime(name: ContentRuntimeName): Promise<void> {
  const runtimeWindow = window as RuntimeWindow;
  const existing = pending.get(name);
  if (existing) return existing;

  // 已经是可用状态，直接返回。
  if (READY_PROBES[name](runtimeWindow)) {
    const done = Promise.resolve();
    pending.set(name, done);
    return done;
  }

  const task = (async () => {
    for (const asset of RUNTIME_ASSETS[name]) {
      await injectScript(asset);
      asset.onReady?.(runtimeWindow);
    }
    markRuntimeReady(name)(runtimeWindow);
  })();

  pending.set(
    name,
    task.catch((error: unknown) => {
      // 失败不固化：清掉缓存，下次调用重新尝试。
      pending.delete(name);
      if (name === "mermaid" || name === "markmap") markRuntimeFailed(name)(runtimeWindow);
      throw error;
    }),
  );

  return pending.get(name)!;
}

/** 仅用于测试与诊断：清空幂等缓存。 */
export function resetContentRuntimeCache(): void {
  pending.clear();
  injected.clear();
}
