import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pencil,
  List,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Upload,
} from "lucide-react";
import type { TypstAssetListItem, TypstCategoryListItem } from "@services";

type Props = {
  sideCollapsed: boolean;
  submitting: boolean;
  noteId?: number;
  isCreateMode: boolean;
  compiledAt?: string | null;

  title: string;
  summary: string;
  categoryPath: string;
  categoryOptions: TypstCategoryListItem[];
  published: boolean;
  styleKey: string;
  styleOptions: string[];
  autoPreview: boolean;
  assetPrefix: string;
  assets: TypstAssetListItem[];
  assetSearch: string;

  onOpenToc: () => void;
  onToggleCollapsed: () => void;
  onRefreshPreview: () => void;
  onSave: () => void;

  onSetTitle: (v: string) => void;
  onSetSummary: (v: string) => void;
  onSetCategoryPath: (v: string) => void;
  onSetPublished: (v: boolean) => void;
  onSetStyleKey: (v: string) => void;
  onOpenStyleEditor: () => void;
  onOpenCategoryManage: () => void;
  onAddCategory: () => void;
  onSetAutoPreview: (v: boolean) => void;
  onSetAssetPrefix: (v: string) => void;
  onUploadClick: () => void;
  onUploadFiles: (files: FileList | null) => void;
  onRefreshAssets: () => void;
  onDeleteAsset: (asset: TypstAssetListItem) => void;
  onSetAssetSearch: (v: string) => void;
  assetInputRef: React.RefObject<HTMLInputElement | null>;
};

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="typst-editor-card typst-card rounded-lg bg-card text-card-foreground">
      <div className="typst-card-head">
        <div className="typst-card-head-wrapper">
          <div className="typst-card-head-title">{title}</div>
        </div>
      </div>
      <div className="typst-card-body">
        <div className="flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-medium text-text-tertiary">{children}</p>;
}

export default function TypstSidebar({
  sideCollapsed,
  submitting,
  noteId,
  isCreateMode,
  compiledAt,
  title,
  summary,
  categoryPath,
  categoryOptions,
  published,
  styleKey,
  styleOptions,
  autoPreview,
  assetPrefix,
  assets,
  assetSearch,
  onOpenToc,
  onToggleCollapsed,
  onRefreshPreview,
  onSave,
  onSetTitle,
  onSetSummary,
  onSetCategoryPath,
  onSetPublished,
  onSetStyleKey,
  onOpenStyleEditor,
  onOpenCategoryManage,
  onAddCategory,
  onSetAutoPreview,
  onSetAssetPrefix,
  onUploadClick,
  onUploadFiles,
  onRefreshAssets,
  onDeleteAsset,
  onSetAssetSearch,
  assetInputRef,
}: Props) {
  const assetsShown = (assets || []).filter((a) => {
    const q = (assetSearch || "").trim().toLowerCase();
    if (!q) return true;
    return String(a.path || "").toLowerCase().includes(q);
  });

  const categoryListId = React.useId();
  const mergedStyleOptions =
    styleKey && !styleOptions.includes(styleKey)
      ? [styleKey, ...styleOptions]
      : styleOptions;

  return (
    <TooltipProvider delayDuration={120}>
      <div className={`typst-editor-side ${sideCollapsed ? "typst-editor-side-collapsed" : ""}`}>
        <div className={`typst-editor-side-toolbar ${sideCollapsed ? "justify-center py-1" : ""}`}>
          {!sideCollapsed && (
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onOpenToc}>
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>目录</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onRefreshPreview} disabled={!noteId}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>刷新预览</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onSave} disabled={submitting}>
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>保存</TooltipContent>
              </Tooltip>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapsed}
                aria-label={sideCollapsed ? "展开侧边栏" : "收起侧边栏"}
              >
                {sideCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{sideCollapsed ? "展开侧边栏" : "收起侧边栏"}</TooltipContent>
          </Tooltip>
        </div>

        {sideCollapsed ? null : (
          <>
            <PanelCard title="基本信息">
              <div>
                <FieldLabel>标题</FieldLabel>
                <Input value={title} onChange={(e) => onSetTitle(e.target.value)} placeholder="请输入标题" />
              </div>

              <div>
                <FieldLabel>摘要</FieldLabel>
                <Textarea
                  value={summary}
                  onChange={(e) => onSetSummary(e.target.value)}
                  rows={3}
                  placeholder="用于前台列表展示"
                />
              </div>

              <div>
                <FieldLabel>分类</FieldLabel>
                <Input
                  value={categoryPath}
                  list={categoryListId}
                  onChange={(e) => onSetCategoryPath(e.target.value)}
                  placeholder="选择或输入，例如：竞赛/CSP/基础"
                />
                <datalist id={categoryListId}>
                  {categoryOptions.map((c) => (
                    <option key={c.path} value={c.path} />
                  ))}
                </datalist>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Button variant="outline" onClick={onOpenCategoryManage} size="sm" className="h-8">
                    <Settings className="h-4 w-4" /> 管理分类
                  </Button>
                  <Button onClick={onAddCategory} size="sm" className="h-8">
                    <Plus className="h-4 w-4" /> 添加
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border-secondary bg-surface-2 px-2.5 py-1.5">
                <p className="text-sm text-text-tertiary">发布</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">
                    {published ? "已发布" : "未发布"}
                  </span>
                  <Switch checked={published} onCheckedChange={onSetPublished} />
                </div>
              </div>

              <div>
                <FieldLabel>样式</FieldLabel>
                <div className="flex gap-2">
                  <Select
                    value={styleKey || "__none__"}
                    onValueChange={(v) => onSetStyleKey(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="选择样式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">默认样式</SelectItem>
                      {mergedStyleOptions.map((k) => (
                        <SelectItem key={k} value={k}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={onOpenStyleEditor} className="h-9 w-9 p-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between gap-3">
                <div className="flex-1">
                  <FieldLabel>编译</FieldLabel>
                  {compiledAt ? (
                    <Badge variant="sky">
                      已编译
                    </Badge>
                  ) : (
                    <Badge variant="outline">未编译</Badge>
                  )}
                </div>
                <div className="flex-1">
                  <FieldLabel>模式</FieldLabel>
                  {isCreateMode ? (
                    <Badge variant="sky">
                      新建
                    </Badge>
                  ) : (
                    <Badge variant="success">
                      编辑
                    </Badge>
                  )}
                </div>
              </div>
            </PanelCard>

            <PanelCard title="写作面板">
              <div className="flex justify-between gap-2.5">
                <span className="text-sm text-text-tertiary">快捷</span>
                <span className="text-sm">Ctrl/⌘ + Enter 保存</span>
              </div>
              <div className="flex justify-between gap-2.5">
                <span className="text-sm text-text-tertiary">建议</span>
                <span className="text-sm">分屏更利于排版</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border-secondary bg-surface-2 px-2.5 py-1.5">
                <span className="text-sm text-text-tertiary">自动预览</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">
                    {autoPreview ? "开" : "关"}
                  </span>
                  <Switch checked={autoPreview} onCheckedChange={onSetAutoPreview} />
                </div>
              </div>
            </PanelCard>

            <PanelCard title="图片/资源">
              <div>
                <FieldLabel>上传到目录</FieldLabel>
                <Input value={assetPrefix} onChange={(e) => onSetAssetPrefix(e.target.value)} placeholder="images" />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={onUploadClick} disabled={submitting} className="h-8">
                  <Upload className="h-4 w-4" /> 上传资源
                </Button>
                <Button variant="outline" onClick={onRefreshAssets} disabled={submitting || !noteId} className="h-8">
                  刷新列表
                </Button>
                <input
                  id="typst-asset-upload"
                  name="typst-asset-upload"
                  aria-label="上传资源"
                  ref={assetInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => onUploadFiles(e.target.files)}
                />
              </div>

              <Input value={assetSearch} onChange={(e) => onSetAssetSearch(e.target.value)} placeholder="搜索资源" />

              <div className="max-h-[220px] overflow-y-auto rounded-md border border-border bg-surface">
                {assetsShown.length === 0 ? (
                  <div className="p-2.5">
                    <span className="text-sm text-text-tertiary">暂无资源</span>
                  </div>
                ) : (
                  assetsShown.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-[var(--ws-space-1)] border-b border-border-secondary px-[10px] py-2 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="max-w-[220px] truncate text-sm">{a.path}</p>
                        <div className="text-xs text-text-tertiary">
                          <span>{a.mime}</span>
                          <span className="ml-2">
                            {(a.size_bytes ? `${a.size_bytes}B` : "-") + (a.uploaded_by_id ? ` · u${a.uploaded_by_id}` : "")}
                          </span>
                          {a.sha256 ? (
                            <span className="ml-2">
                              {a.sha256.slice(0, 10)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => onDeleteAsset(a)} disabled={!noteId}>
                        删除
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </PanelCard>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
