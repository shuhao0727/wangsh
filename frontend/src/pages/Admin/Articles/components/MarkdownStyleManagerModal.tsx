import React, { useEffect, useState } from "react";
import { Button, Input, InputNumber, Modal, Select, Typography } from "antd";
import type { MarkdownStyleListItem, MarkdownStyleResponse } from "@services";
import { markdownStylesApi } from "@services";
import ArticlePreviewContent from "./ArticlePreviewContent";

const { TextArea } = Input;
const { Text } = Typography;

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
    <Modal title="管理 CSS 样式方案" open={open} width={960} footer={null} onCancel={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 10, marginBottom: 12 }}>
        <Input value={newStyleKey} onChange={(e) => setNewStyleKey(e.target.value)} placeholder="key（如：my_style）" />
        <Input value={newStyleTitle} onChange={(e) => setNewStyleTitle(e.target.value)} placeholder="标题（可选）" />
        <Button
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

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, minHeight: 520 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Select
            value={styleEditingKey || undefined}
            placeholder="选择样式"
            onChange={(v) => {
              setStyleEditingKey(v);
              onActiveStyleKeyChange(v || null);
            }}
            options={styleOptions.map((s) => ({
              value: s.key,
              label: s.title ? `${s.title}（${s.key}）` : s.key,
            }))}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              danger
              size="small"
              style={{ flex: 1 }}
              onClick={() => {
                if (!styleEditingKey) return;
                Modal.confirm({
                  title: "删除样式方案？",
                  content: styleEditingKey,
                  okText: "删除",
                  okButtonProps: { danger: true },
                  cancelText: "取消",
                  onOk: async () => {
                    await markdownStylesApi.remove(styleEditingKey);
                    const items = await refreshStyles();
                    const next = items[0]?.key || "";
                    setStyleEditingKey(next);
                    if (activeStyleKey === styleEditingKey) {
                      onActiveStyleKeyChange(null);
                      onStyleCssChange("");
                    }
                  },
                });
              }}
            >
              删除
            </Button>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            样式方案可复用，文章通过 style_key 选择
          </Text>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {styleDraft ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px", gap: 10 }}>
                <Input
                  value={styleDraft.title || ""}
                  onChange={(e) => setStyleDraft((p) => (p ? { ...p, title: e.target.value } : p))}
                  placeholder="标题"
                />
                <InputNumber
                  value={styleDraft.sort_order ?? 0}
                  onChange={(v) => setStyleDraft((p) => (p ? { ...p, sort_order: Number(v || 0) } : p))}
                  placeholder="排序"
                  style={{ width: "100%" }}
                />
                <Button
                  type="primary"
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 420 }}>
                <TextArea
                  value={styleDraft.content || ""}
                  onChange={(e) => setStyleDraft((p) => (p ? { ...p, content: e.target.value } : p))}
                  rows={18}
                  spellCheck={false}
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                />
                <div
                  style={{
                    border: "1px solid var(--ws-color-border)",
                    borderRadius: 8,
                    background: "var(--ws-color-surface)",
                    overflow: "auto",
                    padding: 12,
                  }}
                >
                  <ArticlePreviewContent content={STYLE_PREVIEW_MD} scopeId={`style-preview-${styleDraft.key}`} styleCss={styleDraft.content || ""} />
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Text type="secondary">请选择一个样式</Text>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
