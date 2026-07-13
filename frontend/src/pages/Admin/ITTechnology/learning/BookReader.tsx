import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CheckCircle2, Circle, Clock, Star, BookOpen, ListTree, ArrowUp, ChevronDown, ChevronRight } from "lucide-react";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

const useHeadings = (markdown: string): TocItem[] => {
  return useMemo(() => {
    const items: TocItem[] = [];
    const numbered = addChineseNumbering(preprocessMath(markdown));
    const lines = numbered.split("\n");
    for (const line of lines) {
      if (line.startsWith("## ")) {
        const text = line.slice(3).trim();
        items.push({ id: slugify(text), level: 2, text });
      } else if (line.startsWith("### ")) {
        const text = line.slice(4).trim();
        items.push({ id: slugify(text), level: 3, text });
      }
    }
    return items;
  }, [markdown]);
};

/* ─── Math preprocessor ─── */

const preprocessMath = (md: string): string => {
  // Inline \(...\) → code span
  let result = md.replace(/\\\(([\s\S]*?)\\\)/g, '`math-inline:$1`');
  // Display \[...\] → fenced math block
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, '```math\n$1\n```');
  // Standalone \begin{align} → open fence, \end{align} → close fence
  result = result.replace(/\\begin\{align\}/g, '```math\n\\begin{align}');
  result = result.replace(/\\end\{align\}/g, '\\end{align}\n```');
  // Cleanup: remove empty/duplicate math fences
  result = result.replace(/```math\s*```/g, '');
  result = result.replace(/```\s*```/g, '');
  return result;
};

/* ─── Chinese numbering ─── */

const CN_H2 = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];
const CN_H3 = CN_H2.map(n => '（' + n + '）');

const addChineseNumbering = (md: string): string => {
  let h2Idx = 0, h3Idx = 0;
  return md.split('\n').map(line => {
    if (line.startsWith('## ')) { h2Idx++; h3Idx = 0; const n = CN_H2[h2Idx - 1] || ''; return `## ${n}、${line.slice(3)}`; }
    if (line.startsWith('### ')) { h3Idx++; const n = CN_H3[h3Idx - 1] || ''; return `### ${n} ${line.slice(4)}`; }
    return line;
  }).join('\n');
};

/* ─── Mermaid pre component ─── */
const MermaidPre: React.FC<{ code: string }> = ({ code }) => {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const pre = ref.current;
    if (!pre || !(window as any).mermaid) return;
    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
    (window as any).mermaid.render(id, code).then((r: any) => {
      if (pre) pre.innerHTML = r.svg;
    }).catch(() => {});
  }, [code]);
  return <pre ref={ref} className="mermaid">{code}</pre>;
};

/* ─── Markdown Body (react-markdown) ─── */

const MarkdownBody: React.FC<{ markdown: string }> = ({ markdown }) => {
  const articleRef = useRef<HTMLElement>(null);

  const processed = useMemo(() => {
    let md = markdown;
    md = addChineseNumbering(md);
    md = preprocessMath(md);
    return md;
  }, [markdown]);

  // Track library readiness
  const [libsReady, setLibsReady] = useState(false);
  useEffect(() => {
    const check = () => !!(window as any).katex && !!(window as any).hljs;
    if (check()) { setLibsReady(true); return; }
    const id = setInterval(() => { if (check()) { setLibsReady(true); clearInterval(id); } }, 100);
    return () => clearInterval(id);
  }, []);
  const katex = libsReady ? (window as any).katex : null;
  const hljsLib = libsReady ? (window as any).hljs : null;

  return (
    <article className="br-article" ref={articleRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => {
            const text = typeof children === 'string' ? children : String(children);
            return <h2 id={slugify(text)} className="scroll-mt-20">{children}</h2>;
          },
          h3: ({ children }) => {
            const text = typeof children === 'string' ? children : String(children);
            return <h3 id={slugify(text)} className="scroll-mt-20">{children}</h3>;
          },
          code: ({ className, children, ...props }) => {
            const text = Array.isArray(children) ? children.join('') : String(children ?? '');
            const clean = text.replace(/\n$/, '');
            if (clean.startsWith('math-inline:')) {
              const latex = clean.slice(12);
              if (katex) {
                try {
                  const html = katex.renderToString(latex, { throwOnError: false, displayMode: false, trust: true });
                  return <span className="math-inline" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
                } catch (e) {}
              }
              return <span className="math-inline">{latex}</span>;
            }
            if (className === 'language-math') {
              if (katex) {
                try {
                  const html = katex.renderToString(clean, { throwOnError: false, displayMode: true, trust: true });
                  return <div className="math-block" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
                } catch (e) {}
              }
              return <div className="math-block">{clean}</div>;
            }
            // Inline code: just return as-is (react-markdown handles the wrapping)
            return <>{children}</>;
          },
          pre: ({ children }) => {
            const codeEl = children as any;
            const lang = codeEl?.props?.className?.replace('language-', '') || '';
            const codeText = codeEl?.props?.children || String(children ?? '');
            if (lang === 'mermaid') return <MermaidPre code={codeText} />;
            if (lang === 'math') {
              const tex = codeText.replace(/^```math\n?/, '').replace(/\n?```$/, '');
              if (katex) {
                try {
                  const html = katex.renderToString(tex, { throwOnError: false, displayMode: true, trust: true });
                  return <div className="math-block" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
                } catch (e) {}
              }
              return <div className="math-block">{tex}</div>;
            }
            if (hljsLib && lang) {
              try {
                const highlighted = hljsLib.highlight(codeText, { language: lang, ignoreIllegals: true }).value;
                return <pre><code className={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlighted) }} /></pre>;
              } catch {}
            }
            return <pre><code className={lang ? `language-${lang}` : undefined}>{codeText}</code></pre>;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
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
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            tab === "chapters" ? "text-primary border-b-2 border-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
        >章节目录</button>
        <button
          type="button"
          onClick={() => setTab("toc")}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            tab === "toc" ? "text-primary border-b-2 border-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
        >内容大纲</button>
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1">
        {tab === "chapters" ? (
          <div className="p-2">
            {groups.map((group) => {
              const isOpen = !collapsed[group.name];
              const done = groupCompleted(group);
              return (
                <div key={group.name}>
                  <button type="button" onClick={() => toggleGroup(group.name)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hover:bg-accent transition-colors">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <span className="flex-1">{group.name}</span>
                    <span className="text-[10px] tabular-nums font-normal normal-case text-text-tertiary">{done}/{group.chapters.length}</span>
                  </button>
                  {isOpen && group.chapters.map((ch) => (
                    <button key={ch.slug} type="button" onClick={() => onSelectChapter(ch.slug)}
                      className={`flex w-full items-center gap-2 rounded-md py-1.5 pl-8 pr-3 text-left text-xs transition-colors ${
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
                className={`flex w-full items-center gap-2 rounded-md py-1.5 pl-3 pr-3 text-left text-xs transition-colors ${
                  ch.slug === activeSlug ? "bg-primary/10 text-primary font-medium border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent hover:bg-accent text-text-secondary"
                }`}>
                {completedChapters[ch.slug] ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="truncate flex-1">{ch.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-2">
            {tocItems.length === 0 ? (
              <p className="px-2 py-4 text-xs text-text-tertiary">暂无大纲</p>
            ) : (
              tocItems.map((item) => (
                <button key={item.id} type="button" onClick={() => onTocClick(item.id)}
                  className={`block w-full rounded-md py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                    item.level === 2 ? "pl-2" : "pl-5"
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
          className={`fixed bottom-8 right-8 z-10 rounded-full p-3 shadow-lg bg-primary text-primary-foreground transition-all duration-300 ${
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
