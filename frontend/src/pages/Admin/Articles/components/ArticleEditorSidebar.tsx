import React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MarkdownStyleListItem } from "@services";
import type { ArticleFormValues } from "../EditForm";

type Props = {
  categories: any[];
  loading: boolean;
  styleOptions: MarkdownStyleListItem[];
  styleKey: string | null;
  onStyleKeyChange: (next: string | null) => void;
  onOpenStyleManager: () => void;
};

export default function ArticleEditorSidebar({
  categories,
  loading,
  styleOptions,
  styleKey,
  onStyleKeyChange,
  onOpenStyleManager,
}: Props) {
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<ArticleFormValues>();
  const summary = watch("summary") || "";

  return (
    <>
      <Card className="article-edit-card article-edit-basic-card">
        <div className="article-edit-card-header">基本信息</div>
        <div className="article-edit-card-body">
          <div className="article-form-field">
            <label htmlFor="article-title" className="article-form-label">
              文章标题
            </label>
            <Input
              id="article-title"
              placeholder="请输入文章标题"
              maxLength={200}
              {...register("title")}
            />
            {errors.title?.message ? (
              <p className="article-form-error">{String(errors.title.message)}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="article-form-field">
              <label className="article-form-label">发布状态</label>
              <Controller
                control={control}
                name="published"
                render={({ field }) => (
                  <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                    <span className="text-sm text-text-secondary">
                      {field.value ? "发布" : "草稿"}
                    </span>
                    <Switch
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            </div>

            <div className="article-form-field">
              <label className="article-form-label">分类</label>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <Select
                    value={field.value || "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">未分类</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="article-form-field">
            <label htmlFor="article-summary" className="article-form-label">
              文章摘要
            </label>
            <Textarea
              id="article-summary"
              rows={3}
              maxLength={500}
              placeholder="请输入文章摘要"
              {...register("summary")}
            />
            <div className="mt-1 flex items-center justify-between">
              {errors.summary?.message ? (
                <p className="article-form-error">{String(errors.summary.message)}</p>
              ) : (
                <span className="text-xs text-text-tertiary">建议简洁概括核心内容</span>
              )}
              <span className="text-xs text-text-tertiary">{summary.length}/500</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="article-edit-card article-edit-side-card">
        <div className="article-edit-card-header">样式</div>
        <div className="article-edit-card-body">
          <Controller
            control={control}
            name="style_key"
            render={({ field }) => (
              <Select
                value={(styleKey ?? field.value) || "__none__"}
                onValueChange={(v) => {
                  const next = v === "__none__" ? null : v;
                  field.onChange(next);
                  onStyleKeyChange(next);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择 CSS 样式方案" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">默认样式</SelectItem>
                  {styleOptions.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.title ? `${s.title}（${s.key}）` : s.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={onOpenStyleManager}
          >
            管理样式
          </Button>

          <p className="text-xs text-text-tertiary">
            仅作用于当前文章内容区域
          </p>
        </div>
      </Card>
    </>
  );
}
