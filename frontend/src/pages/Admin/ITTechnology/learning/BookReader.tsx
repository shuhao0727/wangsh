import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock, Star, BookOpen, FlaskConical, ListChecks } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { LearningBook } from "./types";

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
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级",
  expert: "专家",
};

const MarkdownBody: React.FC<{ markdown: string }> = ({ markdown }) => {
  if (!markdown?.trim()) {
    return <p className="text-sm text-muted-foreground">暂无内容。</p>;
  }

  return (
    <div className="ws-markdown text-sm leading-7 text-text-base">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children, ...props }) => <h1 className="text-2xl font-bold tracking-tight mb-4" {...props}>{children}</h1>,
          h2: ({ children, ...props }) => <h2 className="border-b border-border pb-2 text-xl font-semibold mt-6 mb-3" {...props}>{children}</h2>,
          h3: ({ children, ...props }) => <h3 className="text-base font-semibold mt-4 mb-2" {...props}>{children}</h3>,
          h4: ({ children, ...props }) => <h4 className="text-sm font-semibold mt-3 mb-1" {...props}>{children}</h4>,
          p: ({ children, ...props }) => <p className="mb-3" {...props}>{children}</p>,
          ul: ({ children, ...props }) => <ul className="ml-5 list-disc space-y-1 mb-3" {...props}>{children}</ul>,
          ol: ({ children, ...props }) => <ol className="ml-5 list-decimal space-y-1 mb-3" {...props}>{children}</ol>,
          li: ({ children, ...props }) => <li {...props}>{children}</li>,
          blockquote: ({ children, ...props }) => <blockquote className="rounded-lg border-l-4 border-primary bg-muted/40 p-3 mb-3 text-muted-foreground" {...props}>{children}</blockquote>,
          code: ({ className, children, ...props }: any) => {
            const codeString = String(children).replace(/\n$/, "");
            const isInline = !className;
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";

            if (language === "mermaid") {
              return (
                <div className="my-4 rounded-lg border border-border bg-surface-2 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs text-text-tertiary">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">Mermaid 图表</span>
                    <span>渲染需 Mermaid.js 支持</span>
                  </div>
                  <pre className="overflow-x-auto text-xs text-text-secondary font-mono whitespace-pre-wrap">{codeString}</pre>
                </div>
              );
            }

            if (isInline) {
              return <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]" {...props}>{children}</code>;
            }
            return (
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100 mb-4">
                <code className={className} {...props}>{children}</code>
              </pre>
            );
          },
          a: ({ children, href, ...props }: any) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline" {...props}>{children}</a>
          ),
          img: ({ alt, src, ...props }: any) => (
            <img alt={alt || ""} src={src} loading="lazy" decoding="async" className="rounded-lg max-w-full my-3" {...props} />
          ),
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border-collapse border border-border text-xs" {...props}>{children}</table>
            </div>
          ),
          th: ({ children, ...props }) => <th className="border border-border bg-surface-2 px-3 py-1.5 text-left font-semibold" {...props}>{children}</th>,
          td: ({ children, ...props }) => <td className="border border-border px-3 py-1.5" {...props}>{children}</td>,
          hr: ({ ...props }) => <hr className="my-6 border-border" {...props} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export const BookReader: React.FC<BookReaderProps> = ({ book, activeSlug, completedChapters, favoriteChapters, onSelectChapter, onToggleComplete, onToggleFavorite }) => {
  const activeChapter = book.chapters.find((chapter) => chapter.slug === activeSlug) ?? book.chapters[0];
  const completedCount = book.chapters.filter((chapter) => completedChapters[chapter.slug]).length;
  const progress = book.chapters.length > 0 ? Math.round((completedCount / book.chapters.length) * 100) : 0;

  if (!activeChapter) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{book.title}</CardTitle>
          <CardDescription>暂无章节内容，请在后台配置 Markdown 学习书章节。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
      <aside className="min-h-0 rounded-lg border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4 text-primary" />{book.title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{completedCount}/{book.chapters.length} 章 · {progress}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
        <nav className="max-h-[calc(100vh-260px)] overflow-auto p-2">
          {book.chapters.map((chapter, index) => (
            <button key={chapter.slug} type="button" onClick={() => onSelectChapter(chapter.slug)} className={`mb-1 flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${chapter.slug === activeChapter.slug ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              {completedChapters[chapter.slug] ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1"><span className="mr-1 text-muted-foreground">{index + 1}.</span>{chapter.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 rounded-lg border bg-card p-5">
        <div className="mb-5 border-b border-border pb-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{difficultyLabel[activeChapter.difficulty]}</Badge>
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{activeChapter.estimatedMinutes} 分钟</Badge>
          </div>
          <h1 className="text-2xl font-bold">{activeChapter.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{activeChapter.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant={completedChapters[activeChapter.slug] ? "secondary" : "outline"} onClick={() => onToggleComplete(activeChapter.slug)}>{completedChapters[activeChapter.slug] ? "已完成" : "标记完成"}</Button>
            <Button size="sm" variant={favoriteChapters[activeChapter.slug] ? "secondary" : "outline"} onClick={() => onToggleFavorite(activeChapter.slug)}><Star className="mr-1 h-3.5 w-3.5" />{favoriteChapters[activeChapter.slug] ? "已收藏" : "收藏本章"}</Button>
          </div>
        </div>
        <MarkdownBody markdown={activeChapter.markdown} />
      </main>

      <aside className="space-y-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">本章目标</CardTitle><CardDescription>读完后应该能做到</CardDescription></CardHeader>
          <CardContent><ul className="space-y-1.5 text-xs text-muted-foreground">{activeChapter.goals.map((goal) => <li key={goal}>• {goal}</li>)}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-sm"><ListChecks className="h-4 w-4" />检查清单</CardTitle></CardHeader>
          <CardContent><ul className="space-y-1.5 text-xs text-muted-foreground">{activeChapter.checklist.map((item) => <li key={item}>□ {item}</li>)}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-sm"><FlaskConical className="h-4 w-4" />实验任务</CardTitle></CardHeader>
          <CardContent className="space-y-3">{activeChapter.experiments.map((experiment) => <div key={experiment.title} className="rounded-md border border-border/70 p-2"><div className="text-xs font-semibold">{experiment.title}</div><p className="mt-1 text-[11px] text-muted-foreground">{experiment.goal}</p><div className="mt-1 text-[11px] text-muted-foreground">产出：{experiment.output}</div></div>)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">术语表</CardTitle></CardHeader>
          <CardContent className="space-y-2">{activeChapter.glossary.map((item) => <div key={item.term}><div className="text-xs font-semibold">{item.term}</div><div className="text-[11px] text-muted-foreground">{item.definition}</div></div>)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">延伸参考</CardTitle></CardHeader>
          <CardContent className="space-y-2">{activeChapter.references.map((item) => <div key={item.title} className="text-xs"><div className="font-medium">{item.title}</div><div className="text-[11px] text-muted-foreground">{item.note}</div></div>)}</CardContent>
        </Card>
      </aside>
    </div>
  );
};
