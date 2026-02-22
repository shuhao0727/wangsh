type GraphvizLike = {
  layout: (dot: string, format: string, engine: string) => string;
};

let graphvizPromise: Promise<GraphvizLike> | null = null;

async function loadGraphviz(): Promise<GraphvizLike> {
  if (graphvizPromise) return graphvizPromise;
  graphvizPromise = (async () => {
    let mod: any;
    try {
      mod = await import("@hpcc-js/wasm");
    } catch (e: any) {
      const msg = (e?.message && String(e.message)) || "unknown";
      throw new Error(`Graphviz wasm 加载失败：模块导入失败（${msg}）`);
    }
    const loader =
      mod?.graphviz ??
      mod?.Graphviz ??
      mod?.default?.graphviz ??
      mod?.default?.Graphviz ??
      mod?.default;
    if (!loader || typeof (loader as any).load !== "function") {
      const keys = mod && typeof mod === "object" ? Object.keys(mod).slice(0, 12).join(",") : "";
      throw new Error(`Graphviz wasm 加载失败：未找到 Graphviz.load 导出（keys=${keys || "-"})`);
    }
    const gv = await (loader as any).load();
    if (!gv || typeof gv.layout !== "function") {
      throw new Error("Graphviz wasm 初始化失败：layout 不可用");
    }
    return gv as GraphvizLike;
  })();
  return graphvizPromise;
}

export type GraphvizRenderResult = {
  svg?: string;
  plain?: string;
};

type GraphvizFormat = "svg" | "plain";

const CACHE_LIMIT = 24;
const cache = new Map<string, string>();

function cacheGet(key: string) {
  const v = cache.get(key);
  if (v === undefined) return undefined;
  cache.delete(key);
  cache.set(key, v);
  return v;
}

function cacheSet(key: string, value: string) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) {
    const k = cache.keys().next().value as string | undefined;
    if (!k) break;
    cache.delete(k);
  }
}

export async function renderGraphviz(
  dot: string,
  engine: "dot" | "neato" | "fdp" = "dot",
  formats: GraphvizFormat[] = ["svg", "plain"]
): Promise<GraphvizRenderResult> {
  const gv = await loadGraphviz();
  const wantSvg = formats.includes("svg");
  const wantPlain = formats.includes("plain");
  const out: GraphvizRenderResult = {};

  if (wantSvg) {
    const key = `svg|${engine}|${dot}`;
    const hit = cacheGet(key);
    const svg = hit ?? gv.layout(dot, "svg", engine);
    if (hit === undefined) cacheSet(key, svg);
    out.svg = svg;
  }
  if (wantPlain) {
    const key = `plain|${engine}|${dot}`;
    const hit = cacheGet(key);
    const plain = hit ?? gv.layout(dot, "plain", engine);
    if (hit === undefined) cacheSet(key, plain);
    out.plain = plain;
  }
  return out;
}

export function __setGraphvizForTest(gv: GraphvizLike) {
  graphvizPromise = Promise.resolve(gv);
  cache.clear();
}

export function __resetGraphvizForTest() {
  graphvizPromise = null;
  cache.clear();
}
