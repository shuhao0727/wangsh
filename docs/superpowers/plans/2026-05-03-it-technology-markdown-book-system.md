# IT Technology Markdown Book System Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans

**Goal:** Convert the ML, AI, and Agents learning pages from shallow card/resource lists into editable, markdown-based encyclopedia-style learning books.

**Architecture:** Each module exposes a `LearningBook` object with 15+ rich chapters. Built-in TypeScript content provides a full offline fallback, while the existing `/learning/content/{module_key}` API can override the book through `section_key=raw` and `item_key=book`. The frontend renders a shared book reader with a chapter outline, Markdown article body, chapter goals, experiments, checklists, glossary, and references; existing roadmap/tools/experiments/progress tabs are simplified around the book data.

**Tech Stack:** React 19, TypeScript, Vite, existing UI components, FastAPI, SQLAlchemy, existing `sys_learning_content_items` table.

## Task 1: Create shared book types

Modify `frontend/src/pages/Admin/ITTechnology/learning/types.ts` and append these interfaces below the existing progress types:

```ts
export interface LearningBookReference {
  title: string;
  source?: string;
  note: string;
  url?: string;
}

export interface LearningBookExperiment {
  title: string;
  goal: string;
  steps: string[];
  output: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface LearningBookChapter {
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  goals: string[];
  markdown: string;
  checklist: string[];
  experiments: LearningBookExperiment[];
  glossary: { term: string; definition: string }[];
  references: LearningBookReference[];
}

export interface LearningBook {
  moduleKey: LearningModuleKey;
  title: string;
  subtitle: string;
  description: string;
  audience: string;
  outcomes: string[];
  chapters: LearningBookChapter[];
}
```

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
```

Expected output: TypeScript completes without errors.

## Task 2: Create shared Markdown book reader component

Create `frontend/src/pages/Admin/ITTechnology/learning/BookReader.tsx` with a single React component that accepts `book`, `activeSlug`, `completedChapters`, `favoriteChapters`, `onSelectChapter`, `onToggleComplete`, and `onToggleFavorite`. The component must not depend on browser storage. It should render markdown with a small local renderer that supports headings, paragraphs, unordered lists, ordered lists, blockquotes, code fences, and inline code.

Use this complete implementation:

```tsx
import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock, Star, BookOpen, FlaskConical, ListChecks, Quote, Code2 } from "lucide-react";
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

const renderInline = (text: string) => {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

const MarkdownBody: React.FC<{ markdown: string }> = ({ markdown }) => {
  const blocks = useMemo(() => {
    const lines = markdown.trim().split("\n");
    const result: { type: string; content: string[] }[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i += 1;
        continue;
      }
      if (line.startsWith("```")) {
        const code: string[] = [];
        i += 1;
        while (i < lines.length && !lines[i].startsWith("```")) {
          code.push(lines[i]);
          i += 1;
        }
        result.push({ type: "code", content: code });
        i += 1;
        continue;
      }
      if (line.startsWith("### ")) {
        result.push({ type: "h3", content: [line.slice(4)] });
        i += 1;
        continue;
      }
      if (line.startsWith("## ")) {
        result.push({ type: "h2", content: [line.slice(3)] });
        i += 1;
        continue;
      }
      if (line.startsWith("# ")) {
        result.push({ type: "h1", content: [line.slice(2)] });
        i += 1;
        continue;
      }
      if (line.startsWith("> ")) {
        const quote: string[] = [];
        while (i < lines.length && lines[i].startsWith("> ")) {
          quote.push(lines[i].slice(2));
          i += 1;
        }
        result.push({ type: "quote", content: quote });
        continue;
      }
      if (/^[-*] /.test(line)) {
        const list: string[] = [];
        while (i < lines.length && /^[-*] /.test(lines[i])) {
          list.push(lines[i].replace(/^[-*] /, ""));
          i += 1;
        }
        result.push({ type: "ul", content: list });
        continue;
      }
      if (/^\d+\. /.test(line)) {
        const list: string[] = [];
        while (i < lines.length && /^\d+\. /.test(lines[i])) {
          list.push(lines[i].replace(/^\d+\. /, ""));
          i += 1;
        }
        result.push({ type: "ol", content: list });
        continue;
      }
      const paragraph: string[] = [line];
      i += 1;
      while (i < lines.length && lines[i].trim() && !/^(#|>|[-*] |\d+\. |```)/.test(lines[i])) {
        paragraph.push(lines[i]);
        i += 1;
      }
      result.push({ type: "p", content: [paragraph.join(" ")] });
    }
    return result;
  }, [markdown]);

  return (
    <article className="space-y-4 text-sm leading-7 text-text-base">
      {blocks.map((block, index) => {
        if (block.type === "h1") return <h1 key={index} className="text-2xl font-bold tracking-tight">{block.content[0]}</h1>;
        if (block.type === "h2") return <h2 key={index} className="border-b border-border pb-2 text-xl font-semibold">{block.content[0]}</h2>;
        if (block.type === "h3") return <h3 key={index} className="text-base font-semibold">{block.content[0]}</h3>;
        if (block.type === "quote") return <blockquote key={index} className="rounded-lg border-l-4 border-primary bg-muted/40 p-3 text-muted-foreground"><Quote className="mb-1 h-4 w-4" />{block.content.join(" ")}</blockquote>;
        if (block.type === "code") return <pre key={index} className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100"><Code2 className="mb-2 h-4 w-4" />{block.content.join("\n")}</pre>;
        if (block.type === "ul") return <ul key={index} className="ml-5 list-disc space-y-1">{block.content.map((item) => <li key={item}>{renderInline(item)}</li>)}</ul>;
        if (block.type === "ol") return <ol key={index} className="ml-5 list-decimal space-y-1">{block.content.map((item) => <li key={item}>{renderInline(item)}</li>)}</ol>;
        return <p key={index}>{renderInline(block.content[0])}</p>;
      })}
    </article>
  );
};

export const BookReader: React.FC<BookReaderProps> = ({ book, activeSlug, completedChapters, favoriteChapters, onSelectChapter, onToggleComplete, onToggleFavorite }) => {
  const activeChapter = book.chapters.find((chapter) => chapter.slug === activeSlug) ?? book.chapters[0];
  const completedCount = book.chapters.filter((chapter) => completedChapters[chapter.slug]).length;
  const progress = book.chapters.length > 0 ? Math.round((completedCount / book.chapters.length) * 100) : 0;

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
```

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
```

Expected output: no TypeScript errors.

## Task 3: Create built-in ML book content

Create `frontend/src/pages/Admin/ITTechnology/ml/book.ts` exporting `ML_BOOK`. It must import `LearningBook` and contain 16 chapters. Each chapter must have at least 350 Chinese characters of markdown. Use the following chapter slugs exactly: `overview`, `math-foundations`, `python-data-stack`, `data-cleaning`, `supervised-learning`, `unsupervised-learning`, `model-evaluation`, `feature-engineering`, `ensemble-learning`, `deep-learning`, `nlp`, `computer-vision`, `recommendation-systems`, `rag`, `mlops`, `portfolio`.

Every chapter must include one experiment and one reference. References must be described as optional further reading, not as required content.

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
```

Expected output: no TypeScript errors.

## Task 4: Create built-in AI book content

Create `frontend/src/pages/Admin/ITTechnology/ai/book.ts` exporting `AI_BOOK`. It must import `LearningBook` and contain 15 chapters. Use slugs: `history`, `core-concepts`, `symbolic-ai`, `machine-learning-paradigm`, `deep-learning-paradigm`, `transformer`, `llm`, `generative-ai`, `prompt-engineering`, `rag`, `multimodal-ai`, `ai-tools`, `safety-ethics`, `industry-cases`, `future`.

Every chapter must contain detailed markdown, one experiment-like practice task, glossary entries, and references marked as optional.

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
```

Expected output: no TypeScript errors.

## Task 5: Create built-in Agents book content

Create `frontend/src/pages/Admin/ITTechnology/agents/book.ts` exporting `AGENTS_BOOK`. It must import `LearningBook` and contain 15 chapters. Use slugs: `agent-concept`, `react-pattern`, `tool-use`, `function-calling`, `mcp`, `memory`, `planning`, `rag-agent`, `multi-agent`, `frameworks`, `evaluation`, `security`, `production`, `observability`, `enterprise-project`.

Every chapter must contain detailed markdown, one implementation-style experiment, glossary entries, and optional references.

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
```

Expected output: no TypeScript errors.

## Task 6: Add book tab to ML page

Modify `frontend/src/pages/Admin/ITTechnology/ml/index.tsx`:

1. Import `BookReader` from `../learning/BookReader`.
2. Import `ML_BOOK` from `./book`.
3. Extend `TabKey` with `"book"` and include it in `normalizeTab`.
4. Add local states `activeBookSlug`, `completedChapters`, and `favoriteChapters`.
5. Add `book?: typeof ML_BOOK` to `MLLearningContentPayload`.
6. Resolve `const bookData = contentPayload?.book ?? ML_BOOK`.
7. Add one TabsTrigger labeled `学习书`.
8. Add a TabsContent rendering `BookReader` with `bookData`.
9. Save completed/favorite chapter maps inside the existing progress payload as `completedChapters` and `favoriteChapters`.

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
```

Expected output: no TypeScript errors.

## Task 7: Add book tab to AI page

Modify `frontend/src/pages/Admin/ITTechnology/ai/index.tsx` similarly:

1. Import `BookReader` and `AI_BOOK`.
2. Add `"book"` to `TabKey`, `ALL_TABS`, `TAB_LABELS`, and `TAB_ICONS`.
3. Add `book?: typeof AI_BOOK` to `AIExplorationContentPayload`.
4. Resolve `const bookData = contentPayload?.book ?? AI_BOOK`.
5. Track `activeBookSlug`, `completedChapters`, and `favoriteChapters`.
6. Render `BookReader` in the new `book` tab.
7. Persist maps in `/learning/progress/ai` payload.

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
```

Expected output: no TypeScript errors.

## Task 8: Add book tab to Agents page

Modify `frontend/src/pages/Admin/ITTechnology/agents/index.tsx` similarly:

1. Import `BookReader` and `AGENTS_BOOK`.
2. Add `"book"` to `TabKey` and tab config.
3. Add `book?: typeof AGENTS_BOOK` to `AgentExplorationContentPayload`.
4. Resolve `const bookData = contentPayload?.book ?? AGENTS_BOOK`.
5. Track `activeBookSlug`, `completedChapters`, and `favoriteChapters`.
6. Render `BookReader` in the new `book` tab.
7. Persist maps in `/learning/progress/agents` payload.

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
```

Expected output: no TypeScript errors.

## Task 9: Improve backend schema for markdown editing metadata

Modify `backend/app/schemas/learning/content.py` to document that `content` supports a book payload. Do not change database columns yet. Add stricter field descriptions with `Field(..., description=...)` for `section_key`, `item_key`, `title`, `summary`, `content`, `tags`, `difficulty`, `sort_order`, `enabled`, and `source_type`.

Run:

```bash
cd /Users/wsh/wangsh/backend && python -m py_compile app/schemas/learning/content.py
```

Expected output: no output.

## Task 10: Add book content API usage documentation

Modify `docs/development/API.md` in the `/learning` section. Add an example JSON body for `PUT /learning/content/ml/raw/book` where `content` contains `{ "book": { ... } }`. Explain that the frontend treats this as an editable markdown book override.

Run:

```bash
cd /Users/wsh/wangsh && git diff --check
```

Expected output: no output.

## Task 11: Final verification

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
cd /Users/wsh/wangsh/backend && python -m py_compile app/models/learning/content.py app/schemas/learning/content.py app/api/endpoints/learning/content.py alembic/versions/20260503_0002_learning_content_items.py
cd /Users/wsh/wangsh && git diff --check
```

Expected output: frontend type-check exits 0, backend py_compile emits no output, diff check emits no output.

## Self-review checklist

This plan avoids a new database migration because the existing content table can store markdown book payloads as JSON. The frontend does not rely on broken external links for primary learning content. The implementation keeps built-in content as a fallback while allowing backend override through editable markdown. No browser storage is used. The plan preserves existing progress APIs and only extends their JSON payload shape.
