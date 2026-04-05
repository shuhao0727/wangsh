import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MarkdownStyleListItem, MarkdownStyleResponse } from "@services";
import { markdownStylesApi } from "@services";
import ArticlePreviewContent from "./ArticlePreviewContent";

const STYLE_PREVIEW_MD = `# 标题一

这是段落，包含 \`行内代码\`、**粗体**、*斜体* 与 [链接](https://example.com)。

## 标题二

> 引用块：样式应该对引用也有明显效果。

\`\`\`ts
export const add = (a: number, b: number) => a + b;
\`\`\`

- 列表项 1
- 列表项 2

| 列 | 值 |
| --- | --- |
| A | 1 |
| B | 2 |
`;

type Props = {
  open: boolean;
  onClose: () => void;
  styleOptions: MarkdownStyleListItem[];
  refreshStyles: () => Promise<MarkdownStyleListItem[]>;
  activeStyleKey: string | null;
  onActiveStyleKeyChange: (next: string | null) => void;
  onStyleCssChange: (next: string) => void;
};

export default function MarkdownStyleManagerModal({
  open,
  onClose,
  styleOptions,
  refreshStyles,
  activeStyleKey,
  onActiveStyleKeyChange,
  onStyleCssChange,
}: Props) {
  const [styleEditingKey, setStyleEditingKey] = useState<string>("");
  const [styleDraft, setStyleDraft] = useState<MarkdownStyleResponse | null>(null);
  const [newStyleKey, setNewStyleKey] = useState("");
  const [newStyleTitle, setNewStyleTitle] = useState("");

  useEffect(() => {
    if (!open) return;
    refreshStyles()
      .then((items) => {
        const nextKey = activeStyleKey || items[0]?.key || "";
        setStyleEditingKey(nextKey);
        if (!nextKey) {
          setStyleDraft(null);
          return;
        }
        markdownStylesApi
          .get(nextKey)
          .then((s) => setStyleDraft(s))
          .catch(() => setStyleDraft(null));
      })
      .catch(() => {
        setStyleEditingKey("");
        setStyleDraft(null);
      });
  }, [open, activeStyleKey, refreshStyles]);

  useEffect(() => {
    if (!open) return;
    if (!styleEditingKey) {
      setStyleDraft(null);
      return;
    }
    markdownStylesApi
      .get(styleEditingKey)
      .then((s) => setStyleDraft(s))
      .catch(() => setStyleDraft(null));
  }, [open, styleEditingKey]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[1100px]">
        <DialogHeader>
          <DialogTitle>管理 CSS 样式方案</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_1fr_120px]">
          <Input
            value={newStyleKey}
            onChange={(e) => setNewStyleKey(e.target.value)}
            placeholder="key（如：my_style）"
          />
          <Input
            value={newStyleTitle}
            onChange={(e) => setNewStyleTitle(e.target.value)}
            placeholder="标题（可选）"
          />
          <Button
            variant="outline"
            onClick={async () => {
              const key = newStyleKey.trim();
              if (!key) return;
              await markdownStylesApi.upsert({
                key,
                title: newStyleTitle.trim() || undefined,
                content: "",
                sort_order: 0,
              });
              setNewStyleKey("");
              setNewStyleTitle("");
              await refreshStyles();
              setStyleEditingKey(key);
            }}
          >
            新建
          </Button>
        </div>

        <div className="grid min-h-[520px] grid-cols-1 gap-3 md:grid-cols-[260px_1fr]">
          <div className="flex flex-col gap-2.5">
            <Select
              value={styleEditingKey || "__none__"}
              onValueChange={(v) => {
                const next = v === "__none__" ? "" : v;
                setStyleEditingKey(next);
                onActiveStyleKeyChange(next || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择样式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未选择</SelectItem>
                {styleOptions.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.title ? `${s.title}（${s.key}）` : s.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                aria-label="删除样式方案"
                onClick={async () => {
                  if (!styleEditingKey) return;
                  if (!window.confirm(`删除样式方案？\n${styleEditingKey}`)) return;
                  await markdownStylesApi.remove(styleEditingKey);
                  const items = await refreshStyles();
                  const next = items[0]?.key || "";
                  setStyleEditingKey(next);
                  if (activeStyleKey === styleEditingKey) {
                    onActiveStyleKeyChange(null);
                    onStyleCssChange("");
                  }
                }}
              >
                删除
              </Button>
            </div>

            <p className="text-xs text-text-tertiary">样式方案可复用，文章通过 `style_key` 选择</p>
          </div>

          <div className="flex flex-col gap-2.5">
            {styleDraft ? (
              <>
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_160px_120px]">
                  <Input
                    value={styleDraft.title || ""}
                    onChange={(e) =>
                      setStyleDraft((p) => (p ? { ...p, title: e.target.value } : p))
                    }
                    placeholder="标题"
                  />
                  <Input
                    type="number"
                    value={String(styleDraft.sort_order ?? 0)}
                    onChange={(e) =>
                      setStyleDraft((p) =>
                        p ? { ...p, sort_order: Number(e.target.value || 0) } : p,
                      )
                    }
                    placeholder="排序"
                  />
                  <Button
                    onClick={async () => {
                      if (!styleDraft) return;
                      const saved = await markdownStylesApi.update(styleDraft.key, {
                        title: styleDraft.title,
                        sort_order: styleDraft.sort_order,
                        content: styleDraft.content,
                      });
                      setStyleDraft(saved);
                      await refreshStyles();
                      if (activeStyleKey === saved.key) onStyleCssChange(saved.content || "");
                    }}
                  >
                    保存
                  </Button>
                </div>

                <div className="grid min-h-[420px] grid-cols-1 gap-3 md:grid-cols-2">
                  <Textarea
                    value={styleDraft.content || ""}
                    onChange={(e) =>
                      setStyleDraft((p) => (p ? { ...p, content: e.target.value } : p))
                    }
                    rows={18}
                    spellCheck={false}
                    className="font-mono"
                  />
                  <div className="overflow-auto rounded-lg border border-border-secondary bg-surface-2 p-3">
                    <ArticlePreviewContent
                      content={STYLE_PREVIEW_MD}
                      scopeId={`style-preview-${styleDraft.key}`}
                      styleCss={styleDraft.content || ""}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-text-tertiary">
                请选择一个样式
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
