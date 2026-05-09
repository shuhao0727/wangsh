import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showMessage } from "@/lib/toast";
import { mlBookAdminApi, type MLBookChapter, type MLBookResponse, type ReorderItem } from "@/services/ml/books";
import { BookOpen, Eye, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "@/styles/editor.css";
import LineNumberedMarkdownTextArea from "@/pages/Admin/Articles/LineNumberedMarkdownTextArea";
import { ChapterList } from "./ChapterList";
import { MetadataPanel } from "./MetadataPanel";
import { AdminPage } from "@/components/Admin";

type EditMode = "edit" | "preview" | "split";

const DEFAULT_CHAPTER: Omit<MLBookChapter, "id" | "book_id" | "created_at" | "updated_at"> = {
  slug: "",
  chapter_number: 0,
  title: "",
  summary: "",
  difficulty: "beginner",
  estimated_minutes: 30,
  markdown: "",
  goals: [],
  checklist: [],
  experiments: [],
  glossary: [],
  references: [],
  prerequisites: [],
  keywords: [],
  quiz: [],
  sort_order: 0,
  enabled: true,
};

const EMPTY_CHAPTER_SLUG = "__new__";

interface Props {
  onBack?: () => void;
}

const MlBookEditor: React.FC<Props> = ({ onBack }) => {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate("/admin/it-technology"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookId, setBookId] = useState<number | null>(null);
  const [bookTitle, setBookTitle] = useState("机器学习百科式学习书");
  const [chapters, setChapters] = useState<MLBookChapter[]>([]);
  const [activeSlug, setActiveSlug] = useState("");
  const [editMode, setEditMode] = useState<EditMode>("edit");

  // Active chapter form state (editable copy)
  const [editedChapter, setEditedChapter] = useState<Omit<MLBookChapter, "id" | "book_id" | "created_at" | "updated_at">>(DEFAULT_CHAPTER);

  const activeChapter = useMemo(() => chapters.find((ch) => ch.slug === activeSlug), [chapters, activeSlug]);
  const isNewChapter = activeSlug === EMPTY_CHAPTER_SLUG || (!loading && !activeChapter && activeSlug);

  // Load book data
  const loadBook = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mlBookAdminApi.getBook("ml");
      const data = (res.data as unknown as MLBookResponse)?.book;
      if (data) {
        setBookId(data.id ?? null);
        setBookTitle(data.title);
        const sorted = [...data.chapters].sort((a, b) => a.sort_order - b.sort_order);
        setChapters(sorted);
        if (sorted.length > 0 && !sorted.find((ch) => ch.slug === activeSlug)) {
          setActiveSlug(sorted[0].slug);
        }
      } else {
        // No book yet - auto-create one
        await mlBookAdminApi.upsertBook("ml", {
          module_key: "ml",
          title: "机器学习百科式学习书",
          subtitle: "从数据理解到模型作品的完整成长路径",
          description: "面向信息技术课堂和项目学习的机器学习内置教材，强调概念、实验、证据和作品产出。",
          audience: "具备基础 Python 或数据表格经验的学习者",
          outcomes: [
            "能独立描述机器学习项目从问题定义到部署复盘的完整流程",
            "能完成至少三个可运行实验，并用指标和图表解释结果",
            "能把一次建模过程整理成可展示、可复现的学习作品",
          ],
          enabled: true,
        });
        showMessage.success("书籍已自动创建");
        await loadBook();
      }
    } catch {
      showMessage.error("加载书籍失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBook();
  }, []);

  // Sync edited chapter when activeSlug changes
  useEffect(() => {
    if (isNewChapter) {
      setEditedChapter({ ...DEFAULT_CHAPTER, chapter_number: chapters.length + 1, slug: EMPTY_CHAPTER_SLUG });
      return;
    }
    const ch = chapters.find((c) => c.slug === activeSlug);
    if (ch) {
      setEditedChapter({
        slug: ch.slug,
        chapter_number: ch.chapter_number,
        title: ch.title,
        summary: ch.summary ?? "",
        difficulty: ch.difficulty ?? "beginner",
        estimated_minutes: ch.estimated_minutes ?? 30,
        markdown: ch.markdown ?? "",
        goals: ch.goals ?? [],
        checklist: ch.checklist ?? [],
        experiments: ch.experiments ?? [],
        glossary: ch.glossary ?? [],
        references: ch.references ?? [],
        prerequisites: ch.prerequisites ?? [],
        keywords: ch.keywords ?? [],
        quiz: ch.quiz ?? [],
        sort_order: ch.sort_order ?? 0,
        enabled: ch.enabled ?? true,
      });
    }
  }, [activeSlug, chapters, isNewChapter]);

  // Save current chapter
  const saveChapter = async () => {
    if (!bookId) return;
    if (!editedChapter.title.trim()) {
      showMessage.error("请输入章节标题");
      return;
    }
    const slug = isNewChapter
      ? editedChapter.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || `chapter-${editedChapter.chapter_number}`
      : editedChapter.slug;

    setSaving(true);
    try {
      const res = await mlBookAdminApi.upsertChapter("ml", slug, {
        ...editedChapter,
        slug,
      });
      const saved = (res.data as unknown as { chapter: MLBookChapter })?.chapter;
      showMessage.success("章节已保存");
      setChapters((prev) => {
        const rest = prev.filter((ch) => ch.slug !== slug);
        const updated = saved ? [saved, ...rest] : rest;
        return updated.sort((a, b) => a.sort_order - b.sort_order);
      });
      if (isNewChapter && saved) {
        setActiveSlug(saved.slug);
      }
    } catch {
      showMessage.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  // Delete chapter
  const deleteChapter = async (slug: string) => {
    try {
      await mlBookAdminApi.deleteChapter("ml", slug);
      showMessage.success("章节已删除");
      setChapters((prev) => prev.filter((ch) => ch.slug !== slug));
      if (activeSlug === slug) {
        setActiveSlug(chapters.find((ch) => ch.slug !== slug)?.slug ?? "");
      }
    } catch {
      showMessage.error("删除失败");
    }
  };

  // Toggle chapter enabled
  const toggleChapter = async (slug: string, enabled: boolean) => {
    try {
      await mlBookAdminApi.toggleChapter("ml", slug, enabled);
      setChapters((prev) => prev.map((ch) => (ch.slug === slug ? { ...ch, enabled } : ch)));
    } catch {
      showMessage.error("操作失败");
    }
  };

  // Reorder chapters
  const handleReorder = async (items: ReorderItem[]) => {
    // Optimistic update
    setChapters((prev) => {
      const map = new Map(items.map((item) => [item.slug, item.chapter_number]));
      return prev
        .map((ch) => ({ ...ch, chapter_number: map.get(ch.slug) ?? ch.chapter_number, sort_order: map.get(ch.slug) ?? ch.sort_order }))
        .sort((a, b) => a.sort_order - b.sort_order);
    });
    try {
      await mlBookAdminApi.reorderChapters("ml", items);
    } catch {
      showMessage.error("排序保存失败");
    }
  };

  // Create new empty chapter
  const handleNewChapter = () => {
    const newSlug = EMPTY_CHAPTER_SLUG;
    setActiveSlug(newSlug);
    setEditMode("edit");
  };

  // Keyboard shortcut: Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void saveChapter();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editedChapter, bookId]);

  const toolbarButtons = [
    { label: "B", action: "**粗体**", title: "加粗 (Ctrl+B)" },
    { label: "I", action: "*斜体*", title: "斜体 (Ctrl+I)" },
    { label: "</>", action: "```\n代码块\n```", title: "代码块" },
    { label: "🔗", action: "[链接文字](url)", title: "链接" },
    { label: "≡", action: "- 列表项", title: "无序列表" },
    { label: "1.", action: "1. 列表项", title: "有序列表" },
    { label: "🖼", action: "![描述](url)", title: "图片" },
  ];

  return (
    <AdminPage padding="var(--ws-panel-padding)" scrollable={false}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button variant="link" onClick={handleBack} className="!p-0 text-text-secondary">
            ← 返回 IT 应用管理
          </Button>
          <BookOpen className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-text-base sm:text-lg">ML 学习书编辑器</h1>
            <p className="text-xs text-text-tertiary">{bookTitle} · {chapters.length} 章</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-text-secondary">
              <Eye className="mr-1 h-3 w-3" />
              {isNewChapter ? "新建章节" : `编辑: ${activeChapter?.title ?? ""}`}
            </Badge>
            <Button size="sm" onClick={saveChapter} disabled={saving || loading}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "保存中..." : "保存 (⌘S)"}
            </Button>
          </div>
        </div>

        {/* Three-Column Layout */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-text-tertiary">加载中...</div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
            {/* Left: Chapter List */}
            <ChapterList
              chapters={chapters}
              activeSlug={activeSlug}
              onSelectChapter={setActiveSlug}
              onDeleteChapter={deleteChapter}
              onToggleChapter={toggleChapter}
              onReorder={handleReorder}
              onNewChapter={handleNewChapter}
            />

            {/* Center: Markdown Editor */}
            <div className="flex min-h-0 min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-0.5 border-b border-border-secondary px-3 py-1.5 shrink-0">
                <span className="mr-2 text-xs text-text-tertiary">快捷工具</span>
                {toolbarButtons.map((btn) => (
                  <Button
                    key={btn.title}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-xs text-text-secondary hover:text-text-base"
                    title={btn.title}
                    onClick={() => {
                      // Find the textarea and insert at cursor
                      const ta = document.getElementById("ml-book-editor-textarea") as HTMLTextAreaElement | null;
                      if (!ta) return;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const before = editedChapter.markdown?.slice(0, start) ?? "";
                      const after = editedChapter.markdown?.slice(end) ?? "";
                      const next = before + btn.action + after;
                      setEditedChapter((prev) => ({ ...prev, markdown: next }));
                      setTimeout(() => {
                        ta.focus();
                        const newPos = start + btn.action.length;
                        ta.setSelectionRange(newPos, newPos);
                      }, 0);
                    }}
                  >
                    {btn.label}
                  </Button>
                ))}
                <div className="ml-auto flex items-center gap-0.5">
                  {(["edit", "split", "preview"] as EditMode[]).map((mode) => (
                    <Button
                      key={mode}
                      variant={editMode === mode ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setEditMode(mode)}
                    >
                      {mode === "edit" ? "编辑" : mode === "split" ? "分屏" : "预览"}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Editor Body */}
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Edit mode */}
                {(editMode === "edit" || editMode === "split") && (
                  <div className={editMode === "split" ? "flex min-h-0 flex-1 flex-col lg:w-1/2" : "flex min-h-0 flex-1 flex-col"}>
                    <div className="min-h-[300px] flex-1 overflow-hidden">
                      <LineNumberedMarkdownTextArea
                        id="ml-book-editor-textarea"
                        value={editedChapter.markdown ?? ""}
                        onChange={(text) => setEditedChapter((prev) => ({ ...prev, markdown: text }))}
                        placeholder="输入章节 Markdown 内容，支持 GFM、LaTeX 公式、代码块..."
                      />
                    </div>
                    <div className="flex items-center gap-3 border-t border-border-secondary px-3 py-1.5 text-xs text-text-tertiary shrink-0">
                      <span>{(editedChapter.markdown ?? "").length} 字</span>
                      <span>预计 {Math.max(1, Math.round((editedChapter.markdown ?? "").length / 500))} 分钟阅读</span>
                    </div>
                  </div>
                )}

                {/* Preview mode - renders with react-markdown + GFM + KaTeX */}
                {(editMode === "preview" || editMode === "split") && (
                  <div className={editMode === "split" ? "flex min-h-0 flex-1 flex-col border-l border-border lg:w-1/2" : "flex min-h-0 flex-1 flex-col"}>
                    <div className="overflow-auto p-4">
                      {(editedChapter.markdown) ? (
                        <div className="ws-markdown text-sm leading-7 text-text-base">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {editedChapter.markdown}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-border-secondary p-6 text-center text-sm text-text-tertiary">
                          在编辑器中输入内容后，此处将实时预览
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Metadata Panel */}
            <MetadataPanel
              chapter={editedChapter}
              allChapters={chapters}
              onChange={setEditedChapter}
            />
          </div>
        )}
      </div>
    </AdminPage>
  );
};

export default MlBookEditor;
