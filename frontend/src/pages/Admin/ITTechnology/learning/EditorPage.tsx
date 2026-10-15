import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { showMessage } from "@/lib/toast";
import { api } from "@services";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LearningModuleKey, LearningBook } from "./types";
import { BookReader } from "./BookReader";
import {
  loadLearningBook,
  mergeLearningBookChapters,
  type PersistedLearningChapter,
} from "./helpers";
import {
  ArrowLeft, Eye, Edit3, Save, BookOpen,
  Bold, Italic, Code, Link, List, ListOrdered, Image,
} from "lucide-react";

type EditorView = "edit" | "preview" | "split";

const LearningEditorPage: React.FC = () => {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const mk = (moduleKey ?? "ml") as LearningModuleKey;

  const [book, setBook] = useState<LearningBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState("");
  const [editValue, setEditValue] = useState("");
  const [view, setView] = useState<EditorView>("split");
  const [saving, setSaving] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bookRef = useRef<LearningBook | null>(null);
  const activeSlugRef = useRef("");
  const loadRequestRef = useRef(0);
  const saveRequestRef = useRef(0);
  const selectionGenerationRef = useRef(0);
  const draftRevisionRef = useRef(0);

  bookRef.current = book;

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++loadRequestRef.current;
    const selectionGeneration = ++selectionGenerationRef.current;
    const load = async () => {
      setLoading(true);
      setCanSave(false);
      setSaving(false);
      try {
        const resolved = await loadLearningBook(mk, controller.signal);
        if (requestId !== loadRequestRef.current) return;
        const resolvedBook = resolved.book;
        const nextSlug = resolvedBook.chapters.some((chapter) => chapter.slug === activeSlugRef.current)
          ? activeSlugRef.current
          : resolvedBook.chapters[0]?.slug ?? "";
        const nextChapter = resolvedBook.chapters.find((chapter) => chapter.slug === nextSlug);
        activeSlugRef.current = nextSlug;
        bookRef.current = resolvedBook;
        setBook(resolvedBook);
        setCanSave(resolved.canSave);
        setActiveSlug(nextSlug);
        setEditValue(nextChapter?.markdown ?? "");
        draftRevisionRef.current += 1;
      } catch {
        if (requestId === loadRequestRef.current) showMessage.error("加载失败");
      } finally {
        if (requestId === loadRequestRef.current && selectionGeneration === selectionGenerationRef.current) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      controller.abort();
      loadRequestRef.current += 1;
      selectionGenerationRef.current += 1;
      saveRequestRef.current += 1;
    };
  }, [mk]);

  const handleSelectChapter = useCallback((slug: string) => {
    selectionGenerationRef.current += 1;
    activeSlugRef.current = slug;
    setActiveSlug(slug);
    const ch = bookRef.current?.chapters.find((c) => c.slug === slug);
    setEditValue(ch?.markdown ?? "");
    draftRevisionRef.current += 1;
  }, []);

  const activeChapter = book?.chapters.find((c) => c.slug === activeSlug);

  // Insert text at cursor
  const insertAtCursor = (before: string, after = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selected = editValue.substring(start, end);
    const newText = editValue.substring(0, start) + before + selected + after + editValue.substring(end);
    draftRevisionRef.current += 1;
    setEditValue(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleSave = async () => {
    if (!activeChapter || !canSave || saving) return;
    const slug = activeChapter.slug;
    const saveRequestId = ++saveRequestRef.current;
    const selectionGeneration = selectionGenerationRef.current;
    const draftRevision = draftRevisionRef.current;
    setSaving(true);
    try {
      await api.put(`/learning/chapters/${mk}/${slug}`, {
        title: activeChapter.title,
        summary: activeChapter.summary,
        estimated_minutes: activeChapter.estimatedMinutes,
        difficulty: activeChapter.difficulty,
        group_name: activeChapter.group,
        markdown: editValue,
        sort_order: "sort_order" in activeChapter ? activeChapter.sort_order : book!.chapters.indexOf(activeChapter),
      });
      const readBack = await api.get(`/learning/chapters/${mk}/${slug}`);
      if (saveRequestId !== saveRequestRef.current) return;
      const saved = readBack.data as unknown as PersistedLearningChapter;
      if (saved?.slug !== slug || typeof saved.markdown !== "string") {
        throw new Error("Invalid chapter read-back");
      }
      const currentBook = bookRef.current;
      if (currentBook) {
        const updatedBook = mergeLearningBookChapters(currentBook, [saved]);
        bookRef.current = updatedBook;
        setBook(updatedBook);
        if (
          selectionGeneration === selectionGenerationRef.current &&
          activeSlugRef.current === slug && draftRevision === draftRevisionRef.current
        ) {
          setEditValue(saved.markdown ?? "");
        }
      }
      if (selectionGeneration === selectionGenerationRef.current && activeSlugRef.current === slug) {
        showMessage.success("保存成功");
      }
    } catch {
      if (saveRequestId === saveRequestRef.current) showMessage.error("保存失败");
    } finally {
      if (saveRequestId === saveRequestRef.current) setSaving(false);
    }
  };

  const moduleTitle = mk === "ml" ? "机器学习" : mk === "ai" ? "人工智能探索" : "智能体探索";

  if (loading) return <div className="flex h-full items-center justify-center"><p className="text-sm text-text-secondary">加载中...</p></div>;
  if (!book) return <div className="flex h-full items-center justify-center"><p className="text-sm text-text-secondary">加载失败</p></div>;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-xs border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={() => window.close()} className="gap-2xs h-7 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <span className="text-xs font-medium text-text-base">{moduleTitle} · 内容管理</span>
        <span className="text-3xs text-text-tertiary ml-2xs">{activeChapter?.title}</span>

        {/* Markdown quick-insert */}
        <div className="mx-xs h-4 w-px bg-border" />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="粗体" onClick={() => insertAtCursor("**", "**")}><Bold className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="斜体" onClick={() => insertAtCursor("*", "*")}><Italic className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="代码" onClick={() => insertAtCursor("`", "`")}><Code className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="链接" onClick={() => insertAtCursor("[", "](url)")}><Link className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="无序列表" onClick={() => insertAtCursor("\n- ")}><List className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="有序列表" onClick={() => insertAtCursor("\n1. ")}><ListOrdered className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="图片" onClick={() => insertAtCursor("![alt](", ")")}><Image className="h-3 w-3" /></Button>

        <div className="ml-auto flex items-center gap-2xs">
          <Button size="sm" variant={view === "edit" ? "secondary" : "ghost"} onClick={() => setView("edit")} className="h-7 text-xs gap-2xs"><Edit3 className="h-3 w-3" />编辑</Button>
          <Button size="sm" variant={view === "preview" ? "secondary" : "ghost"} onClick={() => setView("preview")} className="h-7 text-xs gap-2xs"><Eye className="h-3 w-3" />预览</Button>
          <Button size="sm" variant={view === "split" ? "secondary" : "ghost"} onClick={() => setView("split")} className="h-7 text-xs gap-2xs">分屏</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !canSave} className="h-7 text-xs gap-2xs"><Save className="h-3 w-3" />{saving ? "保存中..." : "保存"}</Button>
        </div>
      </div>

      {/* Main area */}
      {!canSave && <p role="status" className="px-3 py-xs text-xs text-text-secondary">服务端内容读取失败，当前展示备用内容。请重新加载后再保存。</p>}
      <div className="flex flex-1 min-h-0">
        {/* Chapter list */}
        <aside className="hidden w-[200px] shrink-0 border-r border-border lg:flex lg:flex-col bg-surface-2">
          <div className="shrink-0 border-b border-border px-3 py-xs">
            <div className="flex items-center gap-1.5 text-2xs font-semibold text-text-secondary">
              <BookOpen className="h-3 w-3 text-primary" />{book.title}
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1.5">
              {book.chapters.map((ch, i) => (
                <button key={ch.slug} type="button" onClick={() => handleSelectChapter(ch.slug)}
                  className={`flex w-full items-center gap-1.5 rounded px-xs py-1.5 text-left text-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    ch.slug === activeSlug ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-text-secondary"
                  }`}>
                  <span className="text-muted-foreground tabular-nums w-4 text-right">{i + 1}</span>
                  <span className="truncate flex-1">{ch.title}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Editor / Preview */}
        <div className="flex flex-1 min-w-0">
          {view === "preview" ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <BookReader
                book={book} activeSlug={activeSlug}
                completedChapters={{}} favoriteChapters={{}}
                onSelectChapter={handleSelectChapter}
                onToggleComplete={() => {}} onToggleFavorite={() => {}}
              />
            </div>
          ) : view === "edit" ? (
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => { draftRevisionRef.current += 1; setEditValue(e.target.value); }}
              className="h-full w-full resize-none border-0 bg-surface p-5 font-mono text-sm leading-relaxed outline-none text-text-base"
              placeholder="在此编辑 Markdown 内容..."
              spellCheck={false}
            />
          ) : (
            /* Split: editor | preview */
            <div className="flex flex-1 min-w-0">
              <div className="flex-1 min-w-0 border-r border-border">
                <textarea
                  ref={textareaRef}
                  value={editValue}
                  onChange={(e) => { draftRevisionRef.current += 1; setEditValue(e.target.value); }}
                  className="h-full w-full resize-none border-0 bg-surface p-4 font-mono text-xs leading-relaxed outline-none text-text-base"
                  placeholder="在此编辑..."
                  spellCheck={false}
                />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <BookReader
                  book={{ ...book, chapters: book.chapters.map(c => c.slug === activeSlug ? { ...c, markdown: editValue } : c) }}
                  activeSlug={activeSlug}
                  completedChapters={{}} favoriteChapters={{}}
                  onSelectChapter={handleSelectChapter}
                  onToggleComplete={() => {}} onToggleFavorite={() => {}}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LearningEditorPage;
