import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Col, Input, Modal, Radio, Row, Select, Space, Spin, Switch, Tag, Typography, message } from "antd";
import { DeleteOutlined, EditOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SettingOutlined, UploadOutlined } from "@ant-design/icons";
import { publicTypstNotesApi, typstCategoriesApi, typstNotesApi, typstStylesApi } from "@services";
import type { TypstAssetListItem, TypstCategoryListItem, TypstNote, TypstStyleListItem, TypstStyleResponse } from "@services";
import PdfCanvasVirtualViewer from "@components/Pdf/PdfCanvasVirtualViewer";
import "./typstEditor.css";

const { Text } = Typography;
const { TextArea } = Input;

type ViewMode = "split" | "edit" | "preview";

const normalizePath = (p: string) => (p || "").replaceAll("\\", "/").replace(/^\/+/, "").trim();

const readAsUint8Array = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

const hashString = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
};

const ensureDefaultStyleImport = (source: string) => {
  let s = source || "";
  if (!s.includes('import "style/my_style.typ"')) {
    s = `#import "style/my_style.typ":my_style\n${s}`;
  }
  if (!s.includes('show: my_style')) {
    // 找到 import 行，在它后面插入 show 规则
    const lines = s.split('\n');
    const importIdx = lines.findIndex(l => l.includes('import "style/my_style.typ"'));
    if (importIdx !== -1) {
      lines.splice(importIdx + 1, 0, '#show: my_style');
      s = lines.join('\n');
    } else {
      // 如果没找到 import（理论上前面已经加了），就加在最前面
      s = `#show: my_style\n${s}`;
    }
  }
  return s;
};

const TypstNoteEditor: React.FC<{
  note: TypstNote | null;
  isCreateMode: boolean;
  onCreated: (note: TypstNote) => void;
  onBack: () => void;
}> = ({ note, isCreateMode, onCreated, onBack }) => {
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const panelHeightRef = useRef<number | null>(null);

  const [title, setTitle] = useState(note?.title || "");
  const [summary, setSummary] = useState(note?.summary || "");
  const [categoryPath, setCategoryPath] = useState(note?.category_path || "");
  const [published, setPublished] = useState(Boolean(note?.published));
  const [styleKey, setStyleKey] = useState(note?.style_key || "my_style");
  const [content, setContent] = useState((note?.files && (note.files as any)["main.typ"]) || note?.content_typst || "");
  const [assetPrefix, setAssetPrefix] = useState<string>("images");
  const [assets, setAssets] = useState<TypstAssetListItem[]>([]);
  const [styleOptions, setStyleOptions] = useState<string[]>(["my_style"]);
  const [autoPreview, setAutoPreview] = useState(true);
  const [assetsVersion, setAssetsVersion] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState<TypstCategoryListItem[]>([]);
  const [categoryManageOpen, setCategoryManageOpen] = useState(false);
  const [stylesManageOpen, setStylesManageOpen] = useState(false);
  const [styleList, setStyleList] = useState<TypstStyleListItem[]>([]);
  const [styleEditingKey, setStyleEditingKey] = useState<string>("my_style");
  const [styleEditing, setStyleEditing] = useState<TypstStyleResponse | null>(null);
  const [categoryDrafts, setCategoryDrafts] = useState<TypstCategoryListItem[]>([]);
  const [newCategoryPath, setNewCategoryPath] = useState("");
  const [styleDraft, setStyleDraft] = useState<TypstStyleResponse | null>(null);

  const [toc, setToc] = useState<any[]>(note?.toc || []);
  const [renderLoading, setRenderLoading] = useState(false);
  const [renderError, setRenderError] = useState<string>("");
  const [previewPdfData, setPreviewPdfData] = useState<Uint8Array | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const previewTokenRef = useRef(0);
  const renderTokenRef = useRef(0);
  const autoPreviewInFlightRef = useRef(false);
  const autoPreviewLastAtRef = useRef(0);
  const autoPreviewPendingKeyRef = useRef<string>("");
  const autoPreviewLastSuccessKeyRef = useRef<string>("");
  const assetsCacheRef = useRef<Map<string, Uint8Array>>(new Map());
  const assetInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitle(note?.title || "");
    setSummary(note?.summary || "");
    setCategoryPath(note?.category_path || "");
    setPublished(Boolean(note?.published));
    setStyleKey(note?.style_key || "my_style");
    setPanelHeight(null);
    panelHeightRef.current = null;
    setPreviewPdfData(null);
    const nf = (note?.files as any) && typeof note?.files === "object" ? (note?.files as any) : null;
    const nextFiles = (nf as Record<string, string>) || { "main.typ": note?.content_typst || "" };
    setContent(nextFiles["main.typ"] || note?.content_typst || "");
    setToc((note?.toc as any[]) || []);
    setAssets([]);
    assetsCacheRef.current.clear();
    if (note?.id) {
      typstNotesApi
        .listAssets(note.id)
        .then((res) => setAssets(res || []))
        .catch(() => {});
    }
  }, [note]);

  useEffect(() => {
    publicTypstNotesApi
      .listStyles()
      .then((res) => setStyleOptions((res && res.length ? res : ["my_style"]).filter(Boolean)))
      .catch(() => setStyleOptions(["my_style"]));
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const list = await typstCategoriesApi.list();
      setCategoryOptions(list || []);
    } catch {
      setCategoryOptions([]);
    }
  }, []);

  const refreshStyles = useCallback(async () => {
    try {
      const list = await typstStylesApi.list();
      setStyleList(list || []);
    } catch {
      setStyleList([]);
    }
  }, []);

  useEffect(() => {
    refreshCategories();
    refreshStyles();
  }, [refreshCategories, refreshStyles]);

  useEffect(() => {
    if (!categoryManageOpen) return;
    setCategoryDrafts([...(categoryOptions || [])]);
    setNewCategoryPath("");
  }, [categoryManageOpen, categoryOptions]);

  useEffect(() => {
    if (!stylesManageOpen) return;
    setStyleDraft(styleEditing ? { ...styleEditing } : null);
  }, [stylesManageOpen, styleEditing]);

  const canSplit = useMemo(() => window.matchMedia && window.matchMedia("(min-width: 992px)").matches, []);

  const refreshAssetsCache = async () => {
    if (!note?.id) return;
    const list = await typstNotesApi.listAssets(note.id);
    setAssets(list || []);
    const cache = new Map<string, Uint8Array>();
    for (const a of list || []) {
      try {
        const blob = await typstNotesApi.downloadAsset(note.id, a.id);
        cache.set(normalizePath(a.path), await readAsUint8Array(blob));
      } catch {
        cache.set(normalizePath(a.path), new Uint8Array());
      }
    }
    assetsCacheRef.current = cache;
    setAssetsVersion((v) => v + 1);
  };

  const parseAxiosBlobError = useCallback(async (e: any) => {
    const blob = e?.response?.data;
    if (blob instanceof Blob) {
      try {
        const text = await blob.text();
        try {
          const obj = JSON.parse(text);
          return String(obj?.detail || text);
        } catch {
          return String(text || "预览失败");
        }
      } catch {
        return "预览失败";
      }
    }
    return String(e?.message || "预览失败");
  }, []);

  const renderServerPreview = useCallback(async (token: number): Promise<{ ok: boolean; rateLimited: boolean }> => {
    const renderToken = ++renderTokenRef.current;

    setRenderLoading(true);
    setRenderError("");
    try {
      if (!note?.id) {
        throw new Error("请先保存后再预览");
      }

      const ep = "main.typ";
      const nextFiles: Record<string, string> = { "main.typ": ensureDefaultStyleImport(content || "") };

      await typstNotesApi.update(note.id, {
        title: title.trim() || "未命名",
        summary: summary || "",
        category_path: categoryPath || "",
        published,
        style_key: styleKey || "my_style",
        entry_path: ep,
        files: nextFiles,
        toc,
        content_typst: nextFiles["main.typ"] || "",
      });

      const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

      try {
        const { job_id } = await typstNotesApi.compilePdfAsync(note.id);
        for (let i = 0; i < 200; i++) {
          if (previewTokenRef.current !== token || renderTokenRef.current !== renderToken) {
            try {
              await typstNotesApi.cancelCompileJob(job_id);
            } catch {}
            return { ok: false, rateLimited: false };
          }
          const st = await typstNotesApi.getCompileJob(job_id);
          const state = String(st?.state || "PENDING");
          if (state === "SUCCESS") break;
          if (state === "FAILURE") throw new Error(String(st?.error || "编译失败"));
          await sleep(Math.min(1500, 300 + i * 10));
        }

        const blob = await typstNotesApi.exportPdf(note.id);
        if (previewTokenRef.current !== token || renderTokenRef.current !== renderToken) return { ok: false, rateLimited: false };
        const data = new Uint8Array(await blob.arrayBuffer());
        setPreviewPdfData(data);
        return { ok: true, rateLimited: false };
      } catch (e: any) {
        const status = Number(e?.response?.status);
        if (status === 400 || status === 404) {
          const blob = await typstNotesApi.compilePdf(note.id);
          if (previewTokenRef.current !== token || renderTokenRef.current !== renderToken) return { ok: false, rateLimited: false };
          const data = new Uint8Array(await blob.arrayBuffer());
          setPreviewPdfData(data);
          return { ok: true, rateLimited: false };
        }
        throw e;
      }
    } catch (e: any) {
      if (previewTokenRef.current !== token || renderTokenRef.current !== renderToken) return { ok: false, rateLimited: false };
      const status = Number(e?.response?.status);
      if (status === 429) {
        setRenderError("请求过于频繁，稍后将自动重试");
        return { ok: false, rateLimited: true };
      }
      setRenderError(await parseAxiosBlobError(e));
      setPreviewPdfData(null);
      return { ok: false, rateLimited: false };
    } finally {
      if (previewTokenRef.current === token && renderTokenRef.current === renderToken) setRenderLoading(false);
    }
  }, [categoryPath, content, note?.id, parseAxiosBlobError, published, styleKey, summary, title, toc]);

  const switchViewMode = async (next: ViewMode) => {
    setViewMode(next);
    if (next === "edit") return;
    if (!note?.id) {
      if (isCreateMode) {
        await save();
      }
      return;
    }
    await renderServerPreview(++previewTokenRef.current);
  };

  useEffect(() => {
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    if (!autoPreview) return;
    if (viewMode === "edit") return;
    if (!note?.id) return;

    const previewKey = [
      `id=${note.id}`,
      `t=${title.trim() || ""}`,
      `s=${summary || ""}`,
      `c=${categoryPath || ""}`,
      `p=${published ? 1 : 0}`,
      `sk=${styleKey || ""}`,
      `toc=${hashString(JSON.stringify(toc || []))}`,
      `a=${assetsVersion}`,
      `m=${hashString(ensureDefaultStyleImport(content || ""))}`,
    ].join("|");

    if (autoPreviewLastSuccessKeyRef.current === previewKey && previewPdfData && !renderError) return;
    autoPreviewPendingKeyRef.current = previewKey;

    const token = ++previewTokenRef.current;
    const run = async () => {
      if (previewTokenRef.current !== token) return;

      const minIntervalMs = 2500;
      const now = Date.now();
      const elapsed = now - autoPreviewLastAtRef.current;
      if (elapsed >= 0 && elapsed < minIntervalMs) {
        previewTimerRef.current = window.setTimeout(run, minIntervalMs - elapsed);
        return;
      }

      if (autoPreviewInFlightRef.current) {
        previewTimerRef.current = window.setTimeout(run, 300);
        return;
      }

      autoPreviewInFlightRef.current = true;
      autoPreviewLastAtRef.current = Date.now();
      const desiredKey = autoPreviewPendingKeyRef.current || previewKey;
      const res = await renderServerPreview(token);
      autoPreviewInFlightRef.current = false;
      if (previewTokenRef.current !== token) return;

      if (res.ok) {
        autoPreviewLastSuccessKeyRef.current = desiredKey;
      }

      if (res.rateLimited) {
        previewTimerRef.current = window.setTimeout(run, 1600);
        return;
      }

      if (autoPreviewPendingKeyRef.current && autoPreviewPendingKeyRef.current !== desiredKey) {
        previewTimerRef.current = window.setTimeout(run, 200);
      }
    };

    previewTimerRef.current = window.setTimeout(run, 1200);
  }, [assetsVersion, autoPreview, categoryPath, content, note?.id, previewPdfData, published, renderError, renderServerPreview, styleKey, summary, title, toc, viewMode]);

  useEffect(() => {
    if (!note?.id) return;
    renderServerPreview(++previewTokenRef.current);
  }, [note?.id, renderServerPreview]);

  const save = async () => {
    const t = title.trim() || "未命名";
    setSubmitting(true);
    try {
      const nextFiles: Record<string, string> = { "main.typ": ensureDefaultStyleImport(content || "") };
      if (isCreateMode) {
        const created = await typstNotesApi.create({
          title: t,
          summary: summary || "",
          category_path: categoryPath || "",
          published,
          style_key: styleKey || "my_style",
          entry_path: "main.typ",
          files: nextFiles,
          toc,
          content_typst: nextFiles["main.typ"] || "",
        });
        message.success("创建成功");
        onCreated(created);
        return;
      }
      if (!note) return;
      await typstNotesApi.update(note.id, {
        title: t,
        summary: summary || "",
        category_path: categoryPath || "",
        published,
        style_key: styleKey || "my_style",
        entry_path: "main.typ",
        files: nextFiles,
        toc,
        content_typst: nextFiles["main.typ"] || "",
      });
      message.success("保存成功");
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const ensureSavedThen = async <T,>(fn: (id: number) => Promise<T>) => {
    if (!note?.id && isCreateMode) {
      const nextFiles: Record<string, string> = { "main.typ": ensureDefaultStyleImport(content || "") };
      const created = await typstNotesApi.create({
        title: title.trim() || "未命名",
        summary: summary || "",
        category_path: categoryPath || "",
        style_key: styleKey || "my_style",
        published,
        entry_path: "main.typ",
        files: nextFiles,
        toc,
        content_typst: nextFiles["main.typ"] || "",
      });
      onCreated(created);
      return await fn(created.id);
    }
    if (!note?.id) throw new Error("笔记未创建");
    return await fn(note.id);
  };

  const uploadAssets = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setSubmitting(true);
    try {
      await ensureSavedThen(async (id) => {
        const prefix = normalizePath(assetPrefix || "images");
        for (const f of Array.from(fileList)) {
          const p = prefix ? `${prefix}/${f.name}` : f.name;
          await typstNotesApi.uploadAsset(id, { path: p, file: f });
        }
        return true;
      });
      await refreshAssetsCache();
      message.success("资源上传成功");
    } catch (e: any) {
      message.error(e?.message || "上传失败");
    } finally {
      setSubmitting(false);
      if (assetInputRef.current) assetInputRef.current.value = "";
    }
  };

  const deleteAsset = async (asset: TypstAssetListItem) => {
    if (!note?.id) return;
    Modal.confirm({
      title: "删除资源",
      content: `确认删除 ${asset.path}？`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        await typstNotesApi.deleteAsset(note.id, asset.id);
        await refreshAssetsCache();
        message.success("已删除");
      },
    });
  };

  const renderEditor = () => (
    <TextArea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          save();
        }
      }}
      placeholder="输入 Typst 内容…"
      style={{
        height: "100%",
        resize: "none",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    />
  );

  const renderPreviewCanvas = () => (
    <div className="typst-preview-box">
      {renderLoading ? (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin />
        </div>
      ) : null}
      {renderError ? (
        <div style={{ padding: 12 }}>
          <Alert type="error" showIcon message="Typst 预览失败" description={<pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{renderError}</pre>} />
        </div>
      ) : null}
      <PdfCanvasVirtualViewer
        data={previewPdfData}
        onFirstPageWrapHeight={(h) => {
          if (!panelHeightRef.current && h > 0) {
            panelHeightRef.current = h;
            setPanelHeight(h);
          }
        }}
      />
      {!renderLoading && !renderError && !previewPdfData ? <Text type="secondary">暂无预览</Text> : null}
    </div>
  );

  return (
    <>
      <div className="typst-editor-page">
        <div className={`typst-editor-grid ${sideCollapsed ? "typst-editor-grid-collapsed" : ""}`}>
      <div className={`typst-editor-side ${sideCollapsed ? "typst-editor-side-collapsed" : ""}`}>
        <div style={{ display: "flex", justifyContent: sideCollapsed ? "center" : "flex-end" }}>
          <Button
            type="text"
            icon={sideCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSideCollapsed((v) => !v)}
          />
        </div>
        {sideCollapsed ? null : (
          <>
        <Card title="基本信息" size="small" className="typst-editor-card">
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <div>
              <Text type="secondary">标题</Text>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="请输入标题" />
            </div>
            <div>
              <Text type="secondary">摘要</Text>
              <TextArea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="用于前台列表展示" />
            </div>
            <div>
              <Text type="secondary">分类</Text>
              <Select
                value={categoryPath || undefined}
                allowClear
                showSearch
                placeholder="选择或输入，例如：竞赛/CSP/基础"
                options={categoryOptions.map((c) => ({ value: c.path, label: c.path }))}
                onChange={(v) => setCategoryPath(v || "")}
                onSearch={(v) => setCategoryPath(v)}
                dropdownRender={(menu) => (
                  <div>
                    {menu}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: 8 }}>
                      <Button icon={<SettingOutlined />} onClick={() => setCategoryManageOpen(true)} size="small">
                        管理分类
                      </Button>
                      <Button
                        icon={<PlusOutlined />}
                        onClick={async () => {
                          const v = (categoryPath || "").trim();
                          if (!v) return;
                          try {
                            await typstCategoriesApi.create({ path: v });
                            await refreshCategories();
                            message.success("已添加分类");
                          } catch (e: any) {
                            message.error(e?.response?.data?.detail || e?.message || "添加失败");
                          }
                        }}
                        size="small"
                        type="primary"
                      >
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
              <Switch checked={published} onChange={setPublished} checkedChildren="已发布" unCheckedChildren="未发布" />
            </div>
            <div>
              <Text type="secondary">样式</Text>
              <div style={{ display: "flex", gap: 8 }}>
                <Select
                  value={styleKey}
                  onChange={(v) => setStyleKey(v)}
                  options={styleOptions.map((k) => ({ value: k, label: k }))}
                  style={{ flex: 1 }}
                />
                <Button
                  icon={<EditOutlined />}
                  onClick={async () => {
                    try {
                      await refreshStyles();
                      setStyleEditingKey(styleKey || "my_style");
                      const s = await typstStylesApi.get(styleKey || "my_style");
                      setStyleEditing(s);
                      setStylesManageOpen(true);
                    } catch (e: any) {
                      message.error(e?.response?.data?.detail || e?.message || "加载样式失败");
                    }
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Text type="secondary">编译</Text>
                <div>{note?.compiled_at ? <Tag color="blue">已编译</Tag> : <Tag>未编译</Tag>}</div>
              </div>
              <div style={{ flex: 1 }}>
                <Text type="secondary">模式</Text>
                <div>{isCreateMode ? <Tag color="blue">新建</Tag> : <Tag color="green">编辑</Tag>}</div>
              </div>
            </div>
          </Space>
        </Card>

        <Card title="写作面板" size="small" className="typst-editor-card">
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
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
              <Switch checked={autoPreview} onChange={setAutoPreview} checkedChildren="开" unCheckedChildren="关" />
            </div>
          </Space>
        </Card>

        <Card title="图片/资源" size="small" className="typst-editor-card">
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <div>
              <Text type="secondary">上传到目录</Text>
              <Input value={assetPrefix} onChange={(e) => setAssetPrefix(e.target.value)} placeholder="images" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button icon={<UploadOutlined />} onClick={() => assetInputRef.current?.click()} disabled={submitting}>
                上传资源
              </Button>
              <Button onClick={refreshAssetsCache} disabled={submitting || !note?.id}>
                刷新列表
              </Button>
              <input
                ref={assetInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => uploadAssets(e.target.files)}
              />
            </div>
            <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--ws-color-border)", borderRadius: "var(--ws-radius-md)" }}>
              {assets.length === 0 ? (
                <div style={{ padding: 10 }}>
                  <Text type="secondary">暂无资源</Text>
                </div>
              ) : (
                assets.map((a) => (
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
                    <Button danger size="small" onClick={() => deleteAsset(a)} disabled={!note?.id}>
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

      <div className="typst-editor-main">
        <Card
          size="small"
          title={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>内容</span>
              <Radio.Group
                value={viewMode}
                onChange={(e) => switchViewMode(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                size="small"
              >
                {canSplit && <Radio.Button value="split">分屏</Radio.Button>}
                <Radio.Button value="edit">编辑</Radio.Button>
                <Radio.Button value="preview">预览</Radio.Button>
              </Radio.Group>
            </div>
          }
          className="typst-editor-card"
        >
          <Row gutter={16}>
            <Col
              xs={24}
              lg={viewMode === "preview" ? 0 : viewMode === "split" && canSplit ? 10 : 24}
              style={{ display: viewMode === "preview" ? "none" : "block" }}
            >
              <div className="typst-editor-panel" style={panelHeight ? { height: panelHeight } : undefined}>
                {renderEditor()}
              </div>
            </Col>
            <Col
              xs={24}
              lg={viewMode === "edit" ? 0 : viewMode === "split" && canSplit ? 14 : 24}
              style={{ display: viewMode === "edit" ? "none" : "block" }}
            >
              <div className="typst-editor-panel" style={panelHeight ? { height: panelHeight } : undefined}>
                {renderPreviewCanvas()}
              </div>
            </Col>
          </Row>
        </Card>

        <Card size="small" title="目录（来自 Typst heading 查询）" className="typst-editor-card" styles={{ body: { padding: 10 } }}>
          {toc?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {toc.map((it: any, idx: number) => (
                <div key={idx} style={{ paddingLeft: Math.max(0, (it.level || 1) - 1) * 12 }}>
                  <Text>{it.text}</Text>
                </div>
              ))}
            </div>
          ) : (
            <Text type="secondary">暂无目录（可能没有 heading 或未成功编译）</Text>
          )}
        </Card>

        <Card size="small" className="typst-editor-card" style={{ position: "sticky", bottom: 0, zIndex: 100, boxShadow: "0 -2px 10px rgba(0,0,0,0.05)" }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Button onClick={onBack}>返回列表</Button>
            </Col>
            <Col>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={() => renderServerPreview(++previewTokenRef.current)} disabled={!note?.id}>
                  刷新预览
                </Button>
                <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={save}>
                  保存
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      </div>
    </div>
      </div>

      <Modal
        open={categoryManageOpen}
        onCancel={() => setCategoryManageOpen(false)}
        title="管理分类"
        width={760}
        footer={null}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <Button icon={<ReloadOutlined />} onClick={refreshCategories}>
            刷新
          </Button>
          <div style={{ display: "flex", gap: 8 }}>
            <Input value={newCategoryPath} onChange={(e) => setNewCategoryPath(e.target.value)} placeholder="例如：竞赛/CSP/基础" />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={async () => {
                const v = (newCategoryPath || "").trim();
                if (!v) return;
                try {
                  await typstCategoriesApi.create({ path: v });
                  message.success("已添加");
                  await refreshCategories();
                  setNewCategoryPath("");
                  setCategoryDrafts([...(await typstCategoriesApi.list())]);
                } catch (e: any) {
                  message.error(e?.response?.data?.detail || e?.message || "添加失败");
                }
              }}
            >
              添加
            </Button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {categoryDrafts.map((c, idx) => (
            <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Input
                value={c.path}
                onChange={(e) =>
                  setCategoryDrafts((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], path: e.target.value };
                    return next;
                  })
                }
              />
              <Input
                value={String(c.sort_order ?? 0)}
                onChange={(e) =>
                  setCategoryDrafts((prev) => {
                    const next = [...prev];
                    const n = Number(e.target.value);
                    next[idx] = { ...next[idx], sort_order: Number.isFinite(n) ? n : 0 };
                    return next;
                  })
                }
                style={{ width: 120 }}
                placeholder="排序"
              />
              <Button
                icon={<SaveOutlined />}
                onClick={async () => {
                  try {
                    await typstCategoriesApi.update(c.id, { path: c.path.trim(), sort_order: c.sort_order });
                    message.success("已保存");
                    await refreshCategories();
                  } catch (e: any) {
                    message.error(e?.response?.data?.detail || e?.message || "保存失败");
                  }
                }}
              >
                保存
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={async () => {
                  try {
                    await typstCategoriesApi.remove(c.id);
                    message.success("已删除");
                    await refreshCategories();
                    setCategoryDrafts((prev) => prev.filter((x) => x.id !== c.id));
                  } catch (e: any) {
                    message.error(e?.response?.data?.detail || e?.message || "删除失败");
                  }
                }}
              />
            </div>
          ))}
          {categoryDrafts.length === 0 ? <Text type="secondary">暂无分类</Text> : null}
        </div>
      </Modal>

      <Modal
        open={stylesManageOpen}
        onCancel={() => setStylesManageOpen(false)}
        title="编辑样式"
        width={980}
        footer={null}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <Select
            value={styleEditingKey}
            options={styleList.map((s) => ({ value: s.key, label: s.key }))}
            style={{ width: 240 }}
            onChange={async (k) => {
              setStyleEditingKey(k);
              try {
                const s = await typstStylesApi.get(k);
                setStyleEditing(s);
                setStyleDraft({ ...s });
              } catch (e: any) {
                message.error(e?.response?.data?.detail || e?.message || "加载失败");
              }
            }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={async () => {
              await refreshStyles();
              try {
                const s = await typstStylesApi.get(styleEditingKey);
                setStyleEditing(s);
                setStyleDraft({ ...s });
              } catch {}
            }}
          >
            刷新
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={async () => {
              try {
                const s = await typstStylesApi.seedFromResource(styleEditingKey);
                setStyleEditing(s);
                setStyleDraft({ ...s });
                await refreshStyles();
                message.success("已从资源重置");
              } catch (e: any) {
                message.error(e?.response?.data?.detail || e?.message || "重置失败");
              }
            }}
          >
            从资源重置
          </Button>
          <div style={{ flex: 1 }} />
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={async () => {
              if (!styleDraft) return;
              try {
                const s = await typstStylesApi.update(styleDraft.key, {
                  title: styleDraft.title,
                  sort_order: styleDraft.sort_order,
                  content: styleDraft.content,
                });
                setStyleEditing(s);
                setStyleDraft({ ...s });
                await refreshStyles();
                const keys = await publicTypstNotesApi.listStyles();
                setStyleOptions((keys && keys.length ? keys : ["my_style"]).filter(Boolean));
                message.success("已保存");
              } catch (e: any) {
                message.error(e?.response?.data?.detail || e?.message || "保存失败");
              }
            }}
          >
            保存
          </Button>
        </div>

        {styleDraft ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10, marginBottom: 12 }}>
            <Input value={styleDraft.title} onChange={(e) => setStyleDraft((p) => (p ? { ...p, title: e.target.value } : p))} placeholder="标题" />
            <Input
              value={String(styleDraft.sort_order ?? 0)}
              onChange={(e) => {
                const n = Number(e.target.value);
                setStyleDraft((p) => (p ? { ...p, sort_order: Number.isFinite(n) ? n : 0 } : p));
              }}
              placeholder="排序"
            />
          </div>
        ) : null}

        <TextArea
          value={styleDraft?.content || ""}
          onChange={(e) => setStyleDraft((p) => (p ? { ...p, content: e.target.value } : p))}
          autoSize={{ minRows: 18, maxRows: 28 }}
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
        />
      </Modal>
    </>
  );
};

export default TypstNoteEditor;
