import React from "react";
import { Button, Card, Input, Select, Space, Switch, Tag, Tooltip, Typography } from "antd";
import { EditOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SettingOutlined, UnorderedListOutlined, UploadOutlined } from "@ant-design/icons";
import type { TypstAssetListItem, TypstCategoryListItem } from "@services";

const { Text } = Typography;
const { TextArea } = Input;

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

  return (
    <div className={`typst-editor-side ${sideCollapsed ? "typst-editor-side-collapsed" : ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Space size={0}>
          <Tooltip title="目录">
            <Button type="text" icon={<UnorderedListOutlined />} onClick={onOpenToc} />
          </Tooltip>
          <Tooltip title="刷新预览">
            <Button type="text" icon={<ReloadOutlined />} onClick={onRefreshPreview} disabled={!noteId} />
          </Tooltip>
          <Tooltip title="保存">
            <Button type="text" icon={<SaveOutlined />} onClick={onSave} loading={submitting} />
          </Tooltip>
        </Space>
        <Button type="text" icon={sideCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={onToggleCollapsed} />
      </div>

      {sideCollapsed ? null : (
        <>
          <Card title="基本信息" size="small" className="typst-editor-card">
            <Space orientation="vertical" size={10} style={{ width: "100%" }}>
              <div>
                <Text type="secondary">标题</Text>
                <Input value={title} onChange={(e) => onSetTitle(e.target.value)} placeholder="请输入标题" />
              </div>
              <div>
                <Text type="secondary">摘要</Text>
                <TextArea value={summary} onChange={(e) => onSetSummary(e.target.value)} rows={3} placeholder="用于前台列表展示" />
              </div>
              <div>
                <Text type="secondary">分类</Text>
                <Select
                  value={categoryPath || undefined}
                  allowClear
                  showSearch
                  placeholder="选择或输入，例如：竞赛/CSP/基础"
                  options={categoryOptions.map((c) => ({ value: c.path, label: c.path }))}
                  onChange={(v) => onSetCategoryPath(v || "")}
                  onSearch={(v) => onSetCategoryPath(v)}
                  popupRender={(menu) => (
                    <div>
                      {menu}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: 8 }}>
                        <Button icon={<SettingOutlined />} onClick={onOpenCategoryManage} size="small">
                          管理分类
                        </Button>
                        <Button icon={<PlusOutlined />} onClick={onAddCategory} size="small" type="primary">
                          添加
                        </Button>
                      </div>
                    </div>
                  )}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text type="secondary">发布</Text>
                <Switch checked={published} onChange={onSetPublished} checkedChildren="已发布" unCheckedChildren="未发布" />
              </div>
              <div>
                <Text type="secondary">样式</Text>
                <div style={{ display: "flex", gap: 8 }}>
                  <Select value={styleKey} onChange={(v) => onSetStyleKey(v)} options={styleOptions.map((k) => ({ value: k, label: k }))} style={{ flex: 1 }} />
                  <Button icon={<EditOutlined />} onClick={onOpenStyleEditor} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Text type="secondary">编译</Text>
                  <div>{compiledAt ? <Tag color="blue">已编译</Tag> : <Tag>未编译</Tag>}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <Text type="secondary">模式</Text>
                  <div>{isCreateMode ? <Tag color="blue">新建</Tag> : <Tag color="green">编辑</Tag>}</div>
                </div>
              </div>
            </Space>
          </Card>

          <Card title="写作面板" size="small" className="typst-editor-card">
            <Space orientation="vertical" size={10} style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <Text type="secondary">快捷</Text>
                <Text>Ctrl/⌘ + Enter 保存</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <Text type="secondary">建议</Text>
                <Text>分屏更利于排版</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text type="secondary">自动预览</Text>
                <Switch checked={autoPreview} onChange={onSetAutoPreview} checkedChildren="开" unCheckedChildren="关" />
              </div>
            </Space>
          </Card>

          <Card title="图片/资源" size="small" className="typst-editor-card">
            <Space orientation="vertical" size={10} style={{ width: "100%" }}>
              <div>
                <Text type="secondary">上传到目录</Text>
                <Input value={assetPrefix} onChange={(e) => onSetAssetPrefix(e.target.value)} placeholder="images" />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button icon={<UploadOutlined />} onClick={onUploadClick} disabled={submitting}>
                  上传资源
                </Button>
                <Button onClick={onRefreshAssets} disabled={submitting || !noteId}>
                  刷新列表
                </Button>
                <input ref={assetInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => onUploadFiles(e.target.files)} />
              </div>
              <Input value={assetSearch} onChange={(e) => onSetAssetSearch(e.target.value)} placeholder="搜索资源" />
              <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--ws-color-border)", borderRadius: "var(--ws-radius-md)" }}>
                {assetsShown.length === 0 ? (
                  <div style={{ padding: 10 }}>
                    <Text type="secondary">暂无资源</Text>
                  </div>
                ) : (
                  assetsShown.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: "8px 10px",
                        borderBottom: "1px solid var(--ws-color-border)",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <Text ellipsis style={{ maxWidth: 220, display: "inline-block" }}>
                          {a.path}
                        </Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {a.mime}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                            {(a.size_bytes ? `${a.size_bytes}B` : "-") + (a.uploaded_by_id ? ` · u${a.uploaded_by_id}` : "")}
                          </Text>
                          {a.sha256 ? (
                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                              {a.sha256.slice(0, 10)}
                            </Text>
                          ) : null}
                        </div>
                      </div>
                      <Button danger size="small" onClick={() => onDeleteAsset(a)} disabled={!noteId}>
                        删除
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Space>
          </Card>
        </>
      )}
    </div>
  );
}
