import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CheckCircle2, Circle, Clock, Star, BookOpen, ListTree, ArrowUp, ChevronDown, ChevronRight } from "lucide-react";
import DOMPurify from "dompurify";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { getWangShMermaidTheme, type WangShMermaidTheme } from "@/lib/mermaidTheme";
import { readCssColor } from "@/lib/cssTokens";
import { getErrorMessage } from "@/utils/errorHandling";
import type { LearningBook, LearningBookChapter } from "./types";
import "./BookReader.css";

interface BookReaderProps {
  book: LearningBook;
  activeSlug: string;
  completedChapters: Record<string, boolean>;
  favoriteChapters: Record<string, boolean>;
  onSelectChapter: (slug: string) => void;
  onToggleComplete: (slug: string) => void;
  onToggleFavorite: (slug: string) => void;
}

const difficultyLabel: Record<string, string> = {
  beginner: "入门", intermediate: "进阶", advanced: "高级", expert: "专家",
};

/* ─── Group derivation ─── */

interface ChapterGroup { name: string; chapters: LearningBookChapter[] }

const useChapterGroups = (chapters: LearningBookChapter[]): { groups: ChapterGroup[]; standalone: LearningBookChapter[] } => {
  return useMemo(() => {
    const map = new Map<string, LearningBookChapter[]>();
    const standalone: LearningBookChapter[] = [];
    const orderedGroups: ChapterGroup[] = [];
    const seen = new Set<string>();
    chapters.forEach((ch) => {
      if (ch.group) {
        const list = map.get(ch.group) ?? [];
        list.push(ch);
        map.set(ch.group, list);
        if (!seen.has(ch.group)) { seen.add(ch.group); orderedGroups.push({ name: ch.group, chapters: list }); }
      } else { standalone.push(ch); }
    });
    return { groups: orderedGroups, standalone };
  }, [chapters]);
};

/* ─── Extract headings from markdown ─── */

const slugify = (text: string) => text.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9一-鿿\-_]/g, "");

interface TocItem { id: string; level: 2 | 3; text: string }

type FenceMarker = { char: "`" | "~"; length: number };

const getFenceMarker = (line: string): FenceMarker | null => {
  const match = line.match(/^\s*(`{3,}|~{3,})/);
  return match ? { char: match[1][0] as FenceMarker["char"], length: match[1].length } : null;
};

const closesFence = (line: string, opening: FenceMarker): boolean => {
  const marker = getFenceMarker(line);
  if (!marker || marker.char !== opening.char || marker.length < opening.length) return false;
  return new RegExp(`^\\s*${opening.char === "`" ? "`" : "~"}{${opening.length},}\\s*$`).test(line);
};

const useHeadings = (markdown: string): TocItem[] => {
  return useMemo(() => {
    const items: TocItem[] = [];
    const numbered = addChineseNumbering(preprocessMath(markdown));
    const lines = numbered.split("\n");
    let fence: FenceMarker | null = null;
    for (const line of lines) {
      if (fence) {
        if (closesFence(line, fence)) fence = null;
        continue;
      }
      const marker = getFenceMarker(line);
      if (marker) {
        fence = marker;
        continue;
      }
      const heading = line.match(/^\s*(##|###)\s+(.*)$/);
      if (heading) {
        const text = heading[2].trim();
        const level = heading[1] === "##" ? 2 : 3;
        items.push({ id: slugify(text), level, text });
      }
    }
    return items;
  }, [markdown]);
};

/* ─── Math preprocessor ─── */

const preprocessMath = (md: string): string => {
  const transformOutsideCode = (chunk: string): string => {
    let result = chunk.replace(/\\\(([\s\S]*?)\\\)/g, '`math-inline:$1`');
    // Blank lines keep adjacent display formulas as separate Markdown blocks.
    result = result.replace(/\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g,
      (_match, bracketMath: string | undefined, dollarMath: string | undefined) =>
        `\n\n\`\`\`math\n${bracketMath ?? dollarMath}\n\`\`\`\n\n`);
    result = result.replace(/\\begin\{align\}/g, '\n\n```math\n\\begin{align}');
    result = result.replace(/\\end\{align\}/g, '\\end{align}\n```\n\n');
    return result;
  };

  // Preserve literal math syntax inside fenced code samples.
  const output: string[] = [];
  let outside = '';
  let fence: FenceMarker | null = null;
  for (const line of md.split('\n')) {
    const marker = getFenceMarker(line);
    if (!fence && marker) {
      output.push(transformOutsideCode(outside).replace(/\n$/, ''));
      outside = '';
      output.push(line);
      fence = marker;
      continue;
    }
    if (fence) {
      output.push(line);
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    outside += `${line}\n`;
  }
  output.push(transformOutsideCode(outside).replace(/\n$/, ''));
  return output.join('\n');
};

/* ─── Chinese numbering ─── */

const CN_H2 = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];
const CN_H3 = CN_H2.map(n => '（' + n + '）');

const addChineseNumbering = (md: string): string => {
  let h2Idx = 0, h3Idx = 0;
  let fence: FenceMarker | null = null;
  return md.split('\n').map(line => {
    const marker = getFenceMarker(line);
    if (marker) {
      if (!fence) fence = marker;
      else if (closesFence(line, fence)) fence = null;
      return line;
    }
    if (fence) return line;
    if (line.startsWith('## ')) { h2Idx++; h3Idx = 0; const n = CN_H2[h2Idx - 1] || ''; return `## ${n}、${line.slice(3)}`; }
    if (line.startsWith('### ')) { h3Idx++; const n = CN_H3[h3Idx - 1] || ''; return `### ${n} ${line.slice(4)}`; }
    return line;
  }).join('\n');
};

/* ─── CDN rendering contracts (no eager library import) ─── */
type MermaidRuntime = {
  initialize: (config: WangShMermaidTheme) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};
type KatexRuntime = {
  renderToString: (code: string, options: { throwOnError: boolean; displayMode: boolean; trust: boolean; errorColor: string }) => string;
};
type HighlightRuntime = {
  highlight: (code: string, options: { language: string; ignoreIllegals: boolean }) => { value: string };
};
type ReaderWindow = Window & {
  mermaid?: MermaidRuntime;
  katex?: KatexRuntime;
  hljs?: HighlightRuntime;
  __mermaidLoadFailed?: boolean;
};
const contentLibraries = () => {
  const source = typeof window === "undefined" ? undefined : window as ReaderWindow;
  return {
    katex: typeof source?.katex?.renderToString === "function" ? source.katex : undefined,
    hljs: typeof source?.hljs?.highlight === "function" ? source.hljs : undefined,
  };
};
const LIBRARY_TIMEOUT_MS = 10_000;
let mermaidRenderId = 0;

/* ─── Mermaid: late CDN readiness, bounded fallback and stale-result isolation ─── */
type MermaidState = { code: string; status: "loading" | "ready" | "error" | "empty"; svg?: string; message?: string };
const pendingMermaid = (code: string): MermaidState => ({ code, status: code.trim() ? "loading" : "empty" });

const MermaidPre: React.FC<{ code: string }> = ({ code }) => {
  const [state, setState] = useState<MermaidState>(() => pendingMermaid(code));
  useEffect(() => {
    let cancelled = false;
    let started = false;
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const scripts = Array.from(document.scripts).filter((script) => /mermaid/i.test(script.src));
    const stopListening = () => {
      window.removeEventListener("ws:mermaid-ready", render);
      window.removeEventListener("ws:mermaid-error", loadFailed);
      scripts.forEach((script) => {
        script.removeEventListener("load", render);
        script.removeEventListener("error", loadFailed);
      });
    };
    const showLoadError = (message: string) => {
      if (cancelled || started) return;
      clearTimeout(timeout);
      setState({ code, status: "error", message });
      // No polling after fallback. Keep ready events until unmount so a late CDN can recover.
    };
    const loadFailed = () => showLoadError("图表运行库加载失败，已保留源代码。");
    const finish = (next: MermaidState) => {
      if (cancelled || settled) return;
      settled = true;
      clearTimeout(timeout);
      setState(next);
    };
    const render = () => {
      if (cancelled || started) return;
      const mermaid = (window as ReaderWindow).mermaid;
      if (typeof mermaid?.initialize !== "function" || typeof mermaid.render !== "function") return;
      started = true;
      stopListening();
      clearTimeout(timeout);
      setState(pendingMermaid(code));
      timeout = setTimeout(() => finish({ code, status: "error", message: "图表渲染超时，已保留源代码。请刷新后重试。" }), LIBRARY_TIMEOUT_MS);
      void Promise.resolve().then(() => {
        if (cancelled || settled) return;
        mermaid.initialize(getWangShMermaidTheme());
        return mermaid.render(`br-mermaid-${++mermaidRenderId}`, code);
      }).then((result) => {
        if (cancelled || settled) return;
        if (!result || typeof result.svg !== "string" || !result.svg.trim()) throw new Error("图表返回为空");
        // Keep SVG styles/user colors and a small safe HTML label vocabulary.
        // Mermaid strict disables diagram callbacks; do not bind untrusted handlers.
        const svg = DOMPurify.sanitize(result.svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          HTML_INTEGRATION_POINTS: { foreignobject: true },
          ADD_TAGS: ["foreignObject", "div", "span", "p", "br", "b", "strong", "em", "i", "code", "sub", "sup", "ul", "ol", "li"],
        });
        if (!/<svg[\s>]/i.test(svg)) throw new Error("图表未返回有效 SVG");
        finish({ code, status: "ready", svg });
      }).catch((error: unknown) => {
        finish({ code, status: "error", message: `图表渲染失败：${getErrorMessage(error) || "未知错误"}。已保留源代码。` });
      });
    };

    setState(pendingMermaid(code));
    if (!code.trim()) return () => { cancelled = true; };
    timeout = setTimeout(() => showLoadError("图表运行库未就绪，已保留源代码。请刷新后重试。"), LIBRARY_TIMEOUT_MS);
    window.addEventListener("ws:mermaid-ready", render);
    window.addEventListener("ws:mermaid-error", loadFailed);
    scripts.forEach((script) => {
      script.addEventListener("load", render);
      script.addEventListener("error", loadFailed);
    });
    render();
    if ((window as ReaderWindow).__mermaidLoadFailed) loadFailed();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      stopListening();
    };
  }, [code]);

  // Hide the previous SVG immediately, before the next effect starts.
  const current = state.code === code ? state : pendingMermaid(code);
  return (
    <section className="br-mermaid" aria-busy={current.status === "loading"}>
      {current.status === "ready" ? (
        <div className="br-mermaid-svg" role="img" aria-label="Mermaid 图表" dangerouslySetInnerHTML={{ __html: current.svg ?? "" }} />
      ) : (
        <>
          <p className="br-render-status" role={current.status === "error" ? "alert" : "status"}>
            {current.status === "empty" ? "暂无图表内容。" : current.status === "error" ? current.message : "图表加载中，源代码已保留。"}
          </p>
          {code.trim() && <pre><code className="language-mermaid">{code}</code></pre>}
        </>
      )}
    </section>
  );
};

type ReaderLibraries = ReturnType<typeof contentLibraries> & { katexWaiting: boolean };
const ReaderLibrariesContext = createContext<ReaderLibraries>({ katex: undefined, hljs: undefined, katexWaiting: false });

const MathMarkup: React.FC<{ code: string; display?: boolean }> = ({ code, display = false }) => {
  const { katex, katexWaiting } = useContext(ReaderLibrariesContext);
  let message = katexWaiting ? "公式加载中，已保留源码。" : "公式渲染不可用，已保留源码。";
  if (katex) {
    try {
      const html = DOMPurify.sanitize(katex.renderToString(code, { throwOnError: false, displayMode: display, trust: true, errorColor: readCssColor("--ws-color-error-text") }));
      return display
        ? <div className="math-block" dangerouslySetInnerHTML={{ __html: html }} />
        : <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      message = "公式渲染失败，已保留源码。";
    }
  }
  return display
    ? <div className="math-block"><p className="br-render-status" role="status">{message}</p><code>{code}</code></div>
    : <span className="math-inline" title={message}>{code}</span>;
};

const codeString = (value: React.ReactNode): string => {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value.map(codeString).join("") : "";
};

const ReaderCode: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => {
  const clean = codeString(children).replace(/\n$/, "");
  if (clean.startsWith("math-inline:")) return <MathMarkup code={clean.slice(12)} />;
  return <code className={className}>{children}</code>;
};

const ReaderPre: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { hljs } = useContext(ReaderLibrariesContext);
  const codeProps = React.isValidElement<{ className?: string; children?: React.ReactNode }>(children) ? children.props : undefined;
  const lang = codeProps?.className?.match(/(?:^|\s)language-([^\s]+)/)?.[1] ?? "";
  const codeText = codeString(codeProps ? codeProps.children : children);
  if (lang === "mermaid") return <MermaidPre code={codeText} />;
  if (lang === "math") return <MathMarkup code={codeText} display />;
  if (hljs && lang) {
    try {
      const highlighted = hljs.highlight(codeText, { language: lang, ignoreIllegals: true }).value;
      return <pre><code className={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlighted) }} /></pre>;
    } catch {
      // Unknown highlighter languages still retain the safe original code.
    }
  }
  return <pre><code className={lang ? `language-${lang}` : undefined}>{codeText}</code></pre>;
};

// Stable component identities prevent readiness updates from remounting Mermaid blocks.
const readerMarkdownComponents: Components = {
  h2: ({ children }) => <h2 id={slugify(typeof children === "string" ? children : String(children))} className="scroll-mt-20">{children}</h2>,
  h3: ({ children }) => <h3 id={slugify(typeof children === "string" ? children : String(children))} className="scroll-mt-20">{children}</h3>,
  code: ReaderCode,
  pre: ReaderPre,
};

/* ─── Markdown Body (react-markdown) ─── */
const MarkdownBody: React.FC<{ markdown: string }> = ({ markdown }) => {
  const processed = useMemo(() => preprocessMath(addChineseNumbering(markdown)), [markdown]);
  const [libraries, setLibraries] = useState<ReaderLibraries>(() => {
    const available = contentLibraries();
    return { ...available, katexWaiting: !available.katex };
  });
  useEffect(() => {
    let active = true;
    let timedOut = false;
    let katexFailed = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const scripts = Array.from(document.scripts).filter((script) => /katex|highlight/i.test(script.src));
    const stopListening = () => scripts.forEach((script) => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    });
    const check = () => {
      if (!active) return;
      const available = contentLibraries();
      setLibraries({ ...available, katexWaiting: !available.katex && !timedOut && !katexFailed });
      if (available.katex && available.hljs) {
        clearTimeout(timeout);
        stopListening();
      }
    };
    const onLoad: EventListener = () => check();
    const onError: EventListener = (event) => {
      const script = event.currentTarget as HTMLScriptElement;
      if (/katex(?:\.min)?\.js(?:[?#]|$)/i.test(script.src)) katexFailed = true;
      check();
    };
    timeout = setTimeout(() => { timedOut = true; check(); }, LIBRARY_TIMEOUT_MS);
    scripts.forEach((script) => {
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);
    });
    check();
    return () => {
      active = false;
      clearTimeout(timeout);
      stopListening();
    };
  }, []);

  return (
    <article className="br-article ws-markdown">
      {!processed.trim() && <p className="br-render-status" role="status">本章节暂无正文内容。</p>}
      <ReaderLibrariesContext.Provider value={libraries}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={readerMarkdownComponents}>{processed}</ReactMarkdown>
      </ReaderLibrariesContext.Provider>
    </article>
  );
};

/* ─── Left Sidebar (chapters / page TOC tab switching) ─── */

type SidebarTab = "chapters" | "toc";

const ChapterSidebar: React.FC<{
  book: LearningBook; groups: ChapterGroup[]; standalone: LearningBookChapter[];
  activeSlug: string; completedChapters: Record<string, boolean>;
  completedCount: number; progress: number;
  tocItems: TocItem[]; activeHeading: string;
  onSelectChapter: (slug: string) => void; onTocClick: (id: string) => void;
}> = ({ book, groups, standalone, activeSlug, completedChapters, completedCount, progress, tocItems, activeHeading, onSelectChapter, onTocClick }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<SidebarTab>("chapters");

  useEffect(() => {
    const activeGroup = groups.find((g) => g.chapters.some((c) => c.slug === activeSlug));
    if (activeGroup && collapsed[activeGroup.name]) {
      setCollapsed((prev) => { const next = { ...prev }; delete next[activeGroup.name]; return next; });
    }
  }, [activeSlug]);

  const toggleGroup = (name: string) => setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));
  const groupCompleted = (group: ChapterGroup) => group.chapters.filter((c) => completedChapters[c.slug]).length;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab("chapters")}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            tab === "chapters" ? "text-primary border-b-2 border-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
        >章节目录</button>
        <button
          type="button"
          onClick={() => setTab("toc")}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            tab === "toc" ? "text-primary border-b-2 border-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
        >内容大纲</button>
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1">
        {tab === "chapters" ? (
          <div className="p-xs">
            {groups.map((group) => {
              const isOpen = !collapsed[group.name];
              const done = groupCompleted(group);
              return (
                <div key={group.name}>
                  <button type="button" onClick={() => toggleGroup(group.name)}
                    className="flex w-full items-center gap-xs rounded-md px-xs py-xs text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <span className="flex-1">{group.name}</span>
                    <span className="text-3xs tabular-nums font-normal normal-case text-text-tertiary">{done}/{group.chapters.length}</span>
                  </button>
                  {isOpen && group.chapters.map((ch) => (
                    <button key={ch.slug} type="button" onClick={() => onSelectChapter(ch.slug)}
                      className={`flex w-full items-center gap-xs rounded-md py-1.5 pl-8 pr-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        ch.slug === activeSlug ? "bg-primary/10 text-primary font-medium border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent hover:bg-accent text-text-secondary"
                      }`}>
                      {completedChapters[ch.slug] ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <span className="truncate flex-1">{ch.title}</span>
                    </button>
                  ))}
                </div>
              );
            })}
            {standalone.map((ch) => (
              <button key={ch.slug} type="button" onClick={() => onSelectChapter(ch.slug)}
                className={`flex w-full items-center gap-xs rounded-md py-1.5 pl-3 pr-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  ch.slug === activeSlug ? "bg-primary/10 text-primary font-medium border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent hover:bg-accent text-text-secondary"
                }`}>
                {completedChapters[ch.slug] ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="truncate flex-1">{ch.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-xs">
            {tocItems.length === 0 ? (
              <p className="px-xs py-4 text-xs text-text-tertiary">暂无大纲</p>
            ) : (
              tocItems.map((item) => (
                <button key={item.id} type="button" onClick={() => onTocClick(item.id)}
                  className={`block w-full rounded-md py-1.5 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    item.level === 2 ? "pl-xs" : "pl-5"
                  } ${item.id === activeHeading ? "text-primary font-medium" : "text-text-secondary"}`}>
                  {item.text}
                </button>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Main BookReader
   ══════════════════════════════════════════════ */

export const BookReader: React.FC<BookReaderProps> = ({
  book, activeSlug, completedChapters, favoriteChapters,
  onSelectChapter, onToggleComplete, onToggleFavorite,
}) => {
  const activeChapter = book.chapters.find((c) => c.slug === activeSlug) ?? book.chapters[0];
  const { groups, standalone } = useChapterGroups(book.chapters);
  const tocItems = useHeadings(activeChapter?.markdown ?? "");
  const completedCount = book.chapters.filter((c) => completedChapters[c.slug]).length;
  const progress = book.chapters.length > 0 ? Math.round((completedCount / book.chapters.length) * 100) : 0;

  // Sidebar resize
  const [sidebarW, setSidebarW] = useState(260);
  const dragging = useRef(false);
  const startDragX = useRef(0);
  const startW = useRef(260);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startDragX.current = e.clientX;
    startW.current = sidebarW;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarW]);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startDragX.current;
      setSidebarW(Math.max(200, Math.min(500, startW.current + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Scroll tracking
  const mainRef = useRef<HTMLElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeHeading, setActiveHeading] = useState("");
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handler = () => {
      setShowScrollTop(el.scrollTop > 400);
      // Detect which heading is closest to the top
      if (tocItems.length === 0) return;
      let current = tocItems[0]?.id ?? "";
      for (const item of tocItems) {
        const h = el.querySelector<HTMLElement>(`[id="${item.id}"]`);
        if (h && h.getBoundingClientRect().top < 120) current = item.id;
      }
      setActiveHeading(current);
    };
    el.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => el.removeEventListener("scroll", handler);
  }, [tocItems]);

  const scrollToTop = () => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToHeading = useCallback((id: string) => {
    const el = mainRef.current?.querySelector<HTMLElement>(`[id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Mobile sheet
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const handleSelectChapter = useCallback((slug: string) => { onSelectChapter(slug); setMobileNavOpen(false); }, [onSelectChapter]);

  if (!activeChapter) {
    return (
      <Card><CardHeader><CardTitle>{book.title}</CardTitle><CardDescription>暂无章节内容，请在后台配置 Markdown 学习书章节。</CardDescription></CardHeader></Card>
    );
  }

  return (
    <div className="flex min-h-0 flex-col lg:flex lg:flex-row h-full">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col lg:min-h-0 lg:shrink-0"
        style={{ width: sidebarW }}
      >
        <ChapterSidebar
          book={book} groups={groups} standalone={standalone}
          activeSlug={activeSlug} completedChapters={completedChapters}
          completedCount={completedCount} progress={progress}
          tocItems={tocItems} activeHeading={activeHeading}
          onSelectChapter={handleSelectChapter} onTocClick={scrollToHeading}
        />
      </aside>

      {/* Resize handle */}
      <div
        className="hidden lg:block w-2 shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
        onMouseDown={onMouseDown}
      />

      {/* Main content */}
      <main ref={mainRef} className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto px-6 py-8 lg:px-12 lg:py-12" style={{ maxWidth: 1200 }}>
          <MarkdownBody markdown={activeChapter.markdown} />
          <div className="h-16" />
        </div>

        {/* Back to top */}
        <button type="button" onClick={scrollToTop}
          className={`fixed bottom-8 right-8 z-10 rounded-full p-3 shadow-lg bg-primary text-primary-foreground transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            showScrollTop ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}
          aria-label="回到顶部">
          <ArrowUp className="h-5 w-5" />
        </button>
      </main>

      {/* Mobile: floating nav */}
      <div className="fixed bottom-5 right-5 z-10 lg:hidden">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button size="sm" variant="secondary" className="rounded-full shadow-lg gap-1.5">
              <ListTree className="h-4 w-4" />目录
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
            <ChapterSidebar
              book={book} groups={groups} standalone={standalone}
              activeSlug={activeSlug} completedChapters={completedChapters}
              completedCount={completedCount} progress={progress}
              tocItems={tocItems} activeHeading={activeHeading}
              onSelectChapter={handleSelectChapter} onTocClick={scrollToHeading}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};
