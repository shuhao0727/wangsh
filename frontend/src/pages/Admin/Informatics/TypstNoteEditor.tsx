import React, { useCallback, useEffect, useRef, useState } from "react";
import { App as AntdApp, Alert, Button, Card, Col, Input, Modal, Radio, Row, Select, Space, Spin, Typography } from "antd";
import { DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { publicTypstNotesApi, typstCategoriesApi, typstNotesApi, typstStylesApi } from "@services";
import type { TypstAssetListItem, TypstCategoryListItem, TypstNote, TypstStyleListItem, TypstStyleResponse } from "@services";
import PdfCanvasVirtualViewer from "@components/Pdf/PdfCanvasVirtualViewer";
import LineNumberedTextArea from "./typst/LineNumberedTextArea";
import TypstSidebar from "./typst/TypstSidebar";
import TypstTocDrawer from "./typst/TypstTocDrawer";
import "./typstEditor.css";

const { Text } = Typography;
const { TextArea } = Input;

type ViewMode = "split" | "edit" | "preview";

const normalizePath = (p: string) => (p || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();

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
  const hasImport = /#import\s+['"]style\/my_style\.typ['"]/.test(s);
  if (!hasImport) {
    s = `#import "style/my_style.typ":my_style\n${s}`;
  }
  
  if (!/#show:\s*my_style/.test(s)) {
    // 找到 import 行，在它后面插入 show 规则
    const lines = s.split('\n');
    const importIdx = lines.findIndex(l => /#import\s+['"]style\/my_style\.typ['"]/.test(l));
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

const TypstNoteEditorInner: React.FC<{
  note: TypstNote | null;
  isCreateMode: boolean;
  onCreated: (note: TypstNote) => void;
  onBack: () => void;
}> = ({ note, isCreateMode, onCreated, onBack }) => {
  const { message } = AntdApp.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [sideCollapsed, setSideCollapsed] = useState(false);

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
  const [stylesVersion, setStylesVersion] = useState(0);
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
  const [tocOpen, setTocOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
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
  const previewRefreshRequestRef = useRef<{ id?: number } | null>(null);
  const assetsCacheRef = useRef<Map<string, Uint8Array>>(new Map());
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const [previewRefreshSeq, setPreviewRefreshSeq] = useState(0);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    setTitle(note?.title || "");
    setSummary(note?.summary || "");
    setCategoryPath(note?.category_path || "");
    setPublished(Boolean(note?.published));
    setStyleKey(note?.style_key || "my_style");
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

  const [canSplit, setCanSplit] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mql = window.matchMedia("(min-width: 992px)");
      setCanSplit(mql.matches);
      const handler = (e: any) => setCanSplit(e.matches);
      if (mql.addEventListener) {
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
      } else if (mql.addListener) {
        mql.addListener(handler);
        return () => mql.removeListener(handler);
      }
    }
  }, []);

  const refreshAssetsCache = async (idOverride?: number) => {
    const id = idOverride ?? note?.id;
    if (!id) return;
    const list = await typstNotesApi.listAssets(id);
    setAssets(list || []);
    const cache = new Map<string, Uint8Array>();
    for (const a of list || []) {
      try {
        const blob = await typstNotesApi.downloadAsset(id, a.id);
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

      const blob = await typstNotesApi.compilePdf(note.id);
      if (previewTokenRef.current !== token || renderTokenRef.current !== renderToken) return { ok: false, rateLimited: false };
      const data = new Uint8Array(await blob.arrayBuffer());
      setPreviewPdfData(data);
      return { ok: true, rateLimited: false };
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

  const queuePreviewRefresh = useCallback((id?: number) => {
    previewRefreshRequestRef.current = { id };
    setPreviewRefreshSeq((v) => v + 1);
  }, []);

  const switchViewMode = async (next: ViewMode) => {
    setViewMode(next);
    if (next === "edit") return;
    if (!note?.id) {
      if (isCreateMode) {
        const created = await save();
        if (created?.id) queuePreviewRefresh(created.id);
      }
      return;
    }
    queuePreviewRefresh(note.id);
  };

  useEffect(() => {
    const req = previewRefreshRequestRef.current;
    if (!req) return;
    if (viewMode === "edit") return;
    if (!note?.id) return;
    if (req.id !== undefined && req.id !== note.id) return;
    if (renderLoading) return;
    previewRefreshRequestRef.current = null;
    renderServerPreview(++previewTokenRef.current);
  }, [note?.id, previewRefreshSeq, renderLoading, renderServerPreview, viewMode]);

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
      `sv=${stylesVersion}`,
      `toc=${hashString(JSON.stringify(toc || []))}`,
      `a=${assetsVersion}`,
      `m=${hashString(ensureDefaultStyleImport(content || ""))}`,
    ].join("|");

    if (autoPreviewLastSuccessKeyRef.current === previewKey && previewPdfData && !renderError) return;
    autoPreviewPendingKeyRef.current = previewKey;

    const token = ++previewTokenRef.current;
    const run = async () => {
      if (previewTokenRef.current !== token) return;

      const minIntervalMs = 1500;
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

    previewTimerRef.current = window.setTimeout(run, 700);
  }, [assetsVersion, autoPreview, categoryPath, content, note?.id, previewPdfData, published, renderError, renderServerPreview, styleKey, stylesVersion, summary, title, toc, viewMode]);

  useEffect(() => {
    if (!note?.id) return;
    if (viewMode === "edit") return;
    queuePreviewRefresh(note.id);
  }, [note?.id, queuePreviewRefresh, viewMode]);

  const save = async (): Promise<TypstNote | null> => {
    const t = title.trim() || "未命名";
    setSubmitting(true);
    try {
      const previewVisible = viewMode !== "edit";
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
        if (previewVisible) queuePreviewRefresh(created.id);
        return created;
      }
      if (!note) return null;
      const updated = await typstNotesApi.update(note.id, {
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
      if (previewVisible) queuePreviewRefresh(note.id);
      return updated;
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "保存失败");
      return null;
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
      const id = await ensureSavedThen(async (id) => {
        const prefix = normalizePath(assetPrefix || "images");
        for (const f of Array.from(fileList)) {
          const p = prefix ? `${prefix}/${f.name}` : f.name;
          await typstNotesApi.uploadAsset(id, { path: p, file: f });
        }
        return id;
      });
      await refreshAssetsCache(id);
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
    <LineNumberedTextArea
      textareaRef={editorRef}
      value={content}
      onChange={(v) => setContent(v)}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          save();
        }
      }}
      placeholder="输入 Typst 内容…"
    />
  );

  const jumpToTocItem = (it: any) => {
    const text = String(it?.text || "").trim();
    if (!text) return;
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^=+\\s*${escapeRegex(text)}\\s*$`);
    const lines = (content || "").split("\n");
    let offset = 0;
    let foundAt = -1;
    for (const line of lines) {
      if (re.test(line.trim())) {
        foundAt = offset;
        break;
      }
      offset += line.length + 1;
    }
    if (foundAt < 0) {
      offset = 0;
      for (const line of lines) {
        const idx = line.indexOf(text);
        if (idx >= 0) {
          foundAt = offset + idx;
          break;
        }
        offset += line.length + 1;
      }
    }
    const ta: HTMLTextAreaElement | null = editorRef.current?.resizableTextArea?.textArea || null;
    if (!ta) return;
    if (foundAt >= 0) {
      ta.focus();
      ta.setSelectionRange(foundAt, foundAt);
    } else {
      message.warning("未在正文中找到对应标题");
    }
    if (viewMode === "preview") {
      switchViewMode("split");
    }
    setTocOpen(false);
  };

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
      <PdfCanvasVirtualViewer data={previewPdfData} />
      {!renderLoading && !renderError && !previewPdfData ? (
        <div style={{ padding: 12 }}>
          <Space orientation="vertical">
            <Text type="secondary">暂无预览</Text>
            <Button icon={<ReloadOutlined />} onClick={() => queuePreviewRefresh(note?.id)} disabled={!note?.id}>
              刷新预览
            </Button>
          </Space>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="typst-editor-page">
        <div className={`typst-editor-grid ${sideCollapsed ? "typst-editor-grid-collapsed" : ""}`}>
          <TypstSidebar
            sideCollapsed={sideCollapsed}
            submitting={submitting}
            noteId={note?.id}
            isCreateMode={isCreateMode}
            compiledAt={note?.compiled_at}
            title={title}
            summary={summary}
            categoryPath={categoryPath}
            categoryOptions={categoryOptions}
            published={published}
            styleKey={styleKey}
            styleOptions={styleOptions}
            autoPreview={autoPreview}
            assetPrefix={assetPrefix}
            assets={assets}
            assetSearch={assetSearch}
            onOpenToc={() => setTocOpen(true)}
            onToggleCollapsed={() => setSideCollapsed((v) => !v)}
            onRefreshPreview={() => queuePreviewRefresh(note?.id)}
            onSave={save}
            onSetTitle={setTitle}
            onSetSummary={setSummary}
            onSetCategoryPath={setCategoryPath}
            onSetPublished={setPublished}
            onSetStyleKey={setStyleKey}
            onOpenStyleEditor={async () => {
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
            onOpenCategoryManage={() => setCategoryManageOpen(true)}
            onAddCategory={async () => {
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
            onSetAutoPreview={setAutoPreview}
            onSetAssetPrefix={setAssetPrefix}
            onUploadClick={() => assetInputRef.current?.click()}
            onUploadFiles={(files) => uploadAssets(files)}
            onRefreshAssets={() => refreshAssetsCache()}
            onDeleteAsset={(a) => deleteAsset(a)}
            onSetAssetSearch={setAssetSearch}
            assetInputRef={assetInputRef}
          />

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
              <div className="typst-editor-panel">
                {renderEditor()}
              </div>
            </Col>
            <Col
              xs={24}
              lg={viewMode === "edit" ? 0 : viewMode === "split" && canSplit ? 14 : 24}
              style={{ display: viewMode === "edit" ? "none" : "block" }}
            >
              <div className="typst-editor-panel">
                {renderPreviewCanvas()}
              </div>
            </Col>
          </Row>
        </Card>

        <Card size="small" className="typst-editor-card" style={{ position: "sticky", bottom: 0, zIndex: 100, boxShadow: "0 -2px 10px rgba(0,0,0,0.05)" }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Button onClick={onBack}>返回列表</Button>
            </Col>
            <Col>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={() => queuePreviewRefresh(note?.id)} disabled={!note?.id}>
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

      <TypstTocDrawer open={tocOpen} toc={toc} onClose={() => setTocOpen(false)} onJump={jumpToTocItem} />

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
                setStylesVersion((v) => v + 1);
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
                setStylesVersion((v) => v + 1);
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

const TypstNoteEditor: React.FC<{
  note: TypstNote | null;
  isCreateMode: boolean;
  onCreated: (note: TypstNote) => void;
  onBack: () => void;
}> = (props) => (
  <AntdApp>
    <TypstNoteEditorInner {...props} />
  </AntdApp>
);

export default TypstNoteEditor;
