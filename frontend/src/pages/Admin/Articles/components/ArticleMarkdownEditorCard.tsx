import React from "react";
import { useFormContext } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  BarChart2,
  Bold,
  Clock,
  Code,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Pencil,
} from "lucide-react";
import LineNumberedMarkdownTextArea from "../LineNumberedMarkdownTextArea";
import type { ArticleFormValues } from "../EditForm";

type Tool = {
  icon: React.ReactNode;
  tooltip: string;
  action: () => void;
};

type Props = {
  viewMode: "split" | "edit" | "preview";
  canSplit: boolean;
  onViewModeChange: (next: "split" | "edit" | "preview") => void;
};

export default function ArticleMarkdownEditorCard({ viewMode, canSplit, onViewModeChange }: Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ArticleFormValues>();
  const content = watch("content") || "";

  const insertText = (text: string) => {
    const current = content;
    const textarea = document.getElementById("article-content-textarea") as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = current.substring(0, start) + text + current.substring(end);
    setValue("content", next, { shouldDirty: true, shouldValidate: true });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const tools: Tool[] = [
    { icon: <Bold className="h-4 w-4" />, tooltip: "粗体", action: () => insertText("**粗体文字**") },
    { icon: <Italic className="h-4 w-4" />, tooltip: "斜体", action: () => insertText("*斜体文字*") },
    { icon: <Code className="h-4 w-4" />, tooltip: "行内代码", action: () => insertText("`代码`") },
    { icon: <Link className="h-4 w-4" />, tooltip: "链接", action: () => insertText("[链接文字](https://)") },
    { icon: <ListOrdered className="h-4 w-4" />, tooltip: "有序列表", action: () => insertText("1. 列表项") },
    { icon: <List className="h-4 w-4" />, tooltip: "无序列表", action: () => insertText("- 列表项") },
    { icon: <Image className="h-4 w-4" />, tooltip: "图片", action: () => insertText("![图片描述](图片链接)") },
  ];

  const modeOptions: Array<{
    value: "split" | "edit" | "preview";
    label: string;
    visible: boolean;
  }> = [
    { value: "split", label: "分屏", visible: canSplit },
    { value: "edit", label: "编辑", visible: true },
    { value: "preview", label: "预览", visible: true },
  ];

  const estimatedMinutes = Math.max(1, Math.ceil(content.length / 500));

  return (
    <div className="article-editor-card rounded-lg border border-border-secondary bg-surface">
      <div className="flex items-center gap-2 border-b border-border-secondary px-3 py-2">
        <Pencil className="h-4 w-4 text-primary" />
        <span className="text-text-base font-semibold">编辑</span>
      </div>

      <div className="article-editor-toolbar">
        <span className="article-editor-toolbar-label text-text-tertiary">快捷工具</span>
        <div className="flex flex-wrap items-center gap-1">
          {tools.map((tool, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={tool.action}
                  className="article-editor-toolbar-btn"
                >
                  {tool.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tool.tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="flex-1" />
        <div className="inline-flex items-center rounded-md border border-border bg-surface p-0.5">
          {modeOptions
            .filter((item) => item.visible)
            .map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onViewModeChange(item.value)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs transition-colors",
                  viewMode === item.value
                    ? "bg-surface text-text shadow-sm"
                    : "text-text-tertiary hover:text-text",
                )}
              >
                {item.label}
              </button>
            ))}
        </div>
        <Badge variant="warning" className="text-[11px]">Markdown</Badge>
      </div>

      <div className="article-editor-body">
        <LineNumberedMarkdownTextArea
          id="article-content-textarea"
          value={content}
          placeholder="请输入文章内容，支持 Markdown 格式…"
          onChange={(next) =>
            setValue("content", next, { shouldDirty: true, shouldValidate: true })
          }
        />
        {errors.content?.message ? (
          <p className="mt-2 text-xs text-destructive">{String(errors.content.message)}</p>
        ) : null}
      </div>

      <div className="article-editor-footer">
        <Badge variant="info" className="text-[11px]">
          <BarChart2 className="mr-0.5 inline h-3 w-3" /> 字数: {content.length} 字符
        </Badge>
        <Badge variant="success" className="text-[11px]">
          <Clock className="mr-0.5 inline h-3 w-3" /> 预计 {estimatedMinutes} 分钟阅读
        </Badge>
      </div>
    </div>
  );
}
