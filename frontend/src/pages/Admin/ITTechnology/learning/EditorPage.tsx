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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load book
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let m: any;
        switch (mk) {
          case "ml": m = await import("../ml/book"); break;
          case "ai": m = await import("../ai/book"); break;
          case "agents": m = await import("../agents/book"); break;
          default: m = await import("../ml/book"); break;
        }
        const b = m.ML_BOOK ?? m.AI_BOOK ?? m.AGENTS_BOOK ?? m.default;
        if (!cancelled && b) {
          setBook(b as LearningBook);
          const slug = b.chapters[0]?.slug ?? "";
          setActiveSlug(slug);
          setEditValue(b.chapters[0]?.markdown ?? "");
        }
      } catch {
        if (!cancelled) showMessage.error("加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [mk]);

  const handleSelectChapter = useCallback((slug: string) => {
    setActiveSlug(slug);
    const ch = book?.chapters.find((c) => c.slug === slug);
    setEditValue(ch?.markdown ?? "");
  }, [book]);

  const activeChapter = book?.chapters.find((c) => c.slug === activeSlug);

  // Insert text at cursor
  const insertAtCursor = (before: string, after = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selected = editValue.substring(start, end);
    const newText = editValue.substring(0, start) + before + selected + after + editValue.substring(end);
    setEditValue(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleSave = async () => {
    if (!activeChapter) return;
    setSaving(true);
    try {
      await api.put(`/learning/chapters/${mk}/${activeChapter.slug}`, {
        title: activeChapter.title,
        summary: activeChapter.summary,
        estimated_minutes: activeChapter.estimatedMinutes,
        difficulty: activeChapter.difficulty,
        group_name: activeChapter.group,
        markdown: editValue,
      });
      showMessage.success("保存成功");
    } catch {
      showMessage.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const moduleTitle = mk === "ml" ? "机器学习" : mk === "ai" ? "人工智能探索" : "智能体探索";

  if (loading) return <div className="flex h-full items-center justify-center"><p className="text-sm text-text-secondary">加载中...</p></div>;
  if (!book) return <div className="flex h-full items-center justify-center"><p className="text-sm text-text-secondary">加载失败</p></div>;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={() => window.close()} className="gap-1 h-7 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <span className="text-xs font-medium text-text-base">{moduleTitle} · 内容管理</span>
        <span className="text-[10px] text-text-tertiary ml-1">{activeChapter?.title}</span>

        {/* Markdown quick-insert */}
        <div className="mx-2 h-4 w-px bg-border" />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="粗体" onClick={() => insertAtCursor("**", "**")}><Bold className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="斜体" onClick={() => insertAtCursor("*", "*")}><Italic className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="代码" onClick={() => insertAtCursor("`", "`")}><Code className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="链接" onClick={() => insertAtCursor("[", "](url)")}><Link className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="无序列表" onClick={() => insertAtCursor("\n- ")}><List className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="有序列表" onClick={() => insertAtCursor("\n1. ")}><ListOrdered className="h-3 w-3" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="图片" onClick={() => insertAtCursor("![alt](", ")")}><Image className="h-3 w-3" /></Button>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant={view === "edit" ? "secondary" : "ghost"} onClick={() => setView("edit")} className="h-7 text-xs gap-1"><Edit3 className="h-3 w-3" />编辑</Button>
          <Button size="sm" variant={view === "preview" ? "secondary" : "ghost"} onClick={() => setView("preview")} className="h-7 text-xs gap-1"><Eye className="h-3 w-3" />预览</Button>
          <Button size="sm" variant={view === "split" ? "secondary" : "ghost"} onClick={() => setView("split")} className="h-7 text-xs gap-1">分屏</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1"><Save className="h-3 w-3" />{saving ? "保存中..." : "保存"}</Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Chapter list */}
        <aside className="hidden w-[200px] shrink-0 border-r border-border lg:flex lg:flex-col bg-surface-2">
          <div className="shrink-0 border-b border-border px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
              <BookOpen className="h-3 w-3 text-primary" />{book.title}
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1.5">
              {book.chapters.map((ch, i) => (
                <button key={ch.slug} type="button" onClick={() => handleSelectChapter(ch.slug)}
                  className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
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
              onChange={(e) => setEditValue(e.target.value)}
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
                  onChange={(e) => setEditValue(e.target.value)}
                  className="h-full w-full resize-none border-0 bg-surface p-4 font-mono text-[13px] leading-relaxed outline-none text-text-base"
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
