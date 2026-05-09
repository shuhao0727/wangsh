import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, CheckCircle2, Circle } from "lucide-react";
import type { MLBookChapter, ReorderItem } from "@/services/ml/books";

interface ChapterListProps {
  chapters: MLBookChapter[];
  activeSlug: string;
  onSelectChapter: (slug: string) => void;
  onDeleteChapter: (slug: string) => void;
  onToggleChapter: (slug: string, enabled: boolean) => void;
  onReorder: (items: ReorderItem[]) => void;
  onNewChapter: () => void;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级",
  expert: "专家",
};

export const ChapterList: React.FC<ChapterListProps> = ({
  chapters,
  activeSlug,
  onSelectChapter,
  onDeleteChapter,
  onToggleChapter,
  onReorder,
  onNewChapter,
}) => {
  const enabledCount = chapters.filter((ch) => ch.enabled).length;

  const handleDragStart = (e: React.DragEvent, slug: string) => {
    e.dataTransfer.setData("text/plain", slug);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetSlug: string) => {
    e.preventDefault();
    const draggedSlug = e.dataTransfer.getData("text/plain");
    if (draggedSlug === targetSlug) return;

    const newChapters = [...chapters];
    const draggedIdx = newChapters.findIndex((ch) => ch.slug === draggedSlug);
    const targetIdx = newChapters.findIndex((ch) => ch.slug === targetSlug);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const [removed] = newChapters.splice(draggedIdx, 1);
    newChapters.splice(targetIdx, 0, removed);

    const reorderItems: ReorderItem[] = newChapters.map((ch, idx) => ({
      slug: ch.slug,
      chapter_number: idx + 1,
    }));
    onReorder(reorderItems);
  };

  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-border bg-surface">
      {/* Header */}
      <div className="border-b border-border-secondary p-3 shrink-0">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-text-base">章节列表</span>
          <span className="text-xs text-text-tertiary">{enabledCount}/{chapters.length} 启用</span>
        </div>
        <div className="h-1.5 mt-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: chapters.length > 0 ? `${Math.round((enabledCount / chapters.length) * 100)}%` : "0%" }}
          />
        </div>
      </div>

      {/* Chapter Items */}
      <nav className="flex-1 overflow-auto p-1.5">
        {chapters.length === 0 && (
          <div className="p-4 text-center text-xs text-text-tertiary">
            暂无章节，点击下方按钮创建
          </div>
        )}
        {chapters.map((chapter, index) => (
          <div
            key={chapter.slug}
            draggable
            onDragStart={(e) => handleDragStart(e, chapter.slug)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, chapter.slug)}
            className={`mb-0.5 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors group ${
              chapter.slug === activeSlug
                ? "bg-primary/10 text-primary"
                : "hover:bg-surface-2 text-text-secondary"
            } ${!chapter.enabled ? "opacity-50" : ""}`}
            onClick={() => onSelectChapter(chapter.slug)}
          >
            <GripVertical className="h-3 w-3 shrink-0 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
            <span className="w-5 shrink-0 text-center text-text-tertiary">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{chapter.title}</span>
            <div className="flex items-center gap-1 shrink-0">
              {chapter.difficulty && (
                <span className="hidden rounded px-1 py-0.5 text-[10px] bg-surface-2 text-text-tertiary group-hover:hidden md:inline">
                  {DIFFICULTY_LABELS[chapter.difficulty] ?? chapter.difficulty}
                </span>
              )}
              <Switch
                checked={chapter.enabled}
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={(checked) => onToggleChapter(chapter.slug, checked)}
                className="scale-75"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onDeleteChapter(chapter.slug); }}
                title="删除章节"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </nav>

      {/* Add Chapter Button */}
      <div className="border-t border-border-secondary p-2 shrink-0">
        <Button variant="outline" size="sm" className="w-full" onClick={onNewChapter}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          新增章节
        </Button>
      </div>
    </div>
  );
};
