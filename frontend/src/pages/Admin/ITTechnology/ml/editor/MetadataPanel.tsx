import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Target, ListChecks, FlaskConical, BookMarked, Link, Brain, HelpCircle } from "lucide-react";
import type { MLBookChapter } from "@/services/ml/books";

interface MetadataPanelProps {
  chapter: Omit<MLBookChapter, "id" | "book_id" | "created_at" | "updated_at">;
  allChapters: MLBookChapter[];
  onChange: (updated: Omit<MLBookChapter, "id" | "book_id" | "created_at" | "updated_at">) => void;
}

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "入门" },
  { value: "intermediate", label: "进阶" },
  { value: "advanced", label: "高级" },
  { value: "expert", label: "专家" },
];

/** Editable string array helper */
const StringArrayField: React.FC<{
  label: string;
  icon: React.ReactNode;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}> = ({ label, icon, items, onChange, placeholder }) => {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v) return;
    onChange([...items, v]);
    setInput("");
  };
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-xs font-medium text-text-secondary">
        {icon}
        {label}
      </Label>
      <div className="flex flex-wrap gap-1">
        {items.map((item, idx) => (
          <Badge key={idx} variant="secondary" className="gap-1 text-[11px]">
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          className="h-7 text-xs"
        />
        <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={add}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export const MetadataPanel: React.FC<MetadataPanelProps> = ({ chapter, allChapters, onChange }) => {
  const patch = (partial: Partial<typeof chapter>) => onChange({ ...chapter, ...partial });

  return (
    <div className="flex min-h-0 flex-col gap-1.5 overflow-auto rounded-lg border border-border bg-surface p-3">
      <h3 className="mb-1 text-sm font-semibold text-text-base">章节设置</h3>

      {/* Slug */}
      <div className="space-y-1">
        <Label className="text-xs text-text-tertiary">Slug</Label>
        <Input
          value={chapter.slug}
          onChange={(e) => patch({ slug: e.target.value })}
          disabled={!!chapter.slug && chapter.slug !== "__new__"}
          className="h-8 text-xs font-mono"
          placeholder="overview"
        />
      </div>

      {/* Chapter Number */}
      <div className="space-y-1">
        <Label className="text-xs text-text-tertiary">章节序号</Label>
        <Input
          type="number"
          min={1}
          value={chapter.chapter_number}
          onChange={(e) => patch({ chapter_number: Math.max(1, parseInt(e.target.value) || 1) })}
          className="h-8 text-xs"
        />
      </div>

      {/* Title */}
      <div className="space-y-1">
        <Label className="text-xs text-text-tertiary">标题</Label>
        <Input
          value={chapter.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="h-8 text-xs"
          placeholder="章节标题"
        />
      </div>

      {/* Difficulty */}
      <div className="space-y-1">
        <Label className="text-xs text-text-tertiary">难度</Label>
        <Select value={chapter.difficulty ?? "beginner"} onValueChange={(v) => patch({ difficulty: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Estimated Minutes */}
      <div className="space-y-1">
        <Label className="text-xs text-text-tertiary">预计时长 (分钟)</Label>
        <Input
          type="number"
          min={1}
          value={chapter.estimated_minutes ?? 30}
          onChange={(e) => patch({ estimated_minutes: Math.max(1, parseInt(e.target.value) || 1) })}
          className="h-8 text-xs"
        />
      </div>

      {/* Prerequisites */}
      <div className="space-y-1">
        <Label className="text-xs text-text-tertiary">前置章节</Label>
        <Select
          value=""
          onValueChange={(slug) => {
            if (slug && !chapter.prerequisites.includes(slug)) {
              patch({ prerequisites: [...chapter.prerequisites, slug] });
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="选择前置章节" />
          </SelectTrigger>
          <SelectContent>
            {allChapters.filter((ch) => ch.slug !== chapter.slug).map((ch) => (
              <SelectItem key={ch.slug} value={ch.slug}>{ch.chapter_number}. {ch.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {chapter.prerequisites.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chapter.prerequisites.map((slug) => (
              <Badge key={slug} variant="outline" className="gap-1 text-[11px] cursor-pointer" onClick={() => patch({ prerequisites: chapter.prerequisites.filter((s) => s !== slug) })}>
                {allChapters.find((ch) => ch.slug === slug)?.title ?? slug}
                <X className="h-2.5 w-2.5" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="space-y-1">
        <Label className="text-xs text-text-tertiary">摘要</Label>
        <Textarea
          value={chapter.summary ?? ""}
          onChange={(e) => patch({ summary: e.target.value })}
          className="h-16 resize-none text-xs"
          placeholder="章节摘要..."
        />
      </div>

      {/* Goals */}
      <StringArrayField
        label="学习目标"
        icon={<Target className="h-3 w-3" />}
        items={chapter.goals ?? []}
        onChange={(items) => patch({ goals: items })}
        placeholder="添加学习目标"
      />

      {/* Checklist */}
      <StringArrayField
        label="检查清单"
        icon={<ListChecks className="h-3 w-3" />}
        items={chapter.checklist ?? []}
        onChange={(items) => patch({ checklist: items })}
        placeholder="添加检查项"
      />

      {/* Keywords */}
      <StringArrayField
        label="关键词"
        icon={<Brain className="h-3 w-3" />}
        items={chapter.keywords ?? []}
        onChange={(items) => patch({ keywords: items })}
        placeholder="添加关键词"
      />

      {/* Enabled Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-border-secondary">
        <Label className="text-xs text-text-secondary">启用</Label>
        <Switch checked={chapter.enabled} onCheckedChange={(checked) => patch({ enabled: checked })} />
      </div>
    </div>
  );
};
