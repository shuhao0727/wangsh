import React, { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Button, Card, Input, Modal, Space, Spin, Typography, message } from "antd";
import { DeleteOutlined, DownloadOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import EmptyState from "@components/Common/EmptyState";
import { typstNotesApi } from "@services";
import type { TypstNote, TypstNoteListItem } from "@services";

const { Text } = Typography;
const { TextArea } = Input;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const TypstNotesPanel: React.FC = () => {
  const [listLoading, setListLoading] = useState(false);
  const [items, setItems] = useState<TypstNoteListItem[]>([]);
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [note, setNote] = useState<TypstNote | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const dirtyRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  const [svgLoading, setSvgLoading] = useState(false);
  const [svg, setSvg] = useState<string>("");
  const previewTimerRef = useRef<number | null>(null);
  const previewTokenRef = useRef(0);
  const typstImportRef = useRef<Promise<any> | null>(null);

  const loadList = async () => {
    setListLoading(true);
    try {
      const res = await typstNotesApi.list({ limit: 100, search: search.trim() || undefined });
      setItems(res || []);
      if (!selectedId && res?.length) setSelectedId(res[0].id);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "加载笔记失败");
    } finally {
      setListLoading(false);
    }
  };

  const loadNote = async (id: number) => {
    setNoteLoading(true);
    try {
      const n = await typstNotesApi.get(id);
      setNote(n);
      setTitle(n.title);
      setContent(n.content_typst || "");
      dirtyRef.current = false;
      setSvg("");
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "加载笔记详情失败");
      setNote(null);
      setTitle("");
      setContent("");
    } finally {
      setNoteLoading(false);
    }
  };

  const saveNow = async () => {
    if (!selectedId) return;
    if (!dirtyRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaving(true);
    try {
      const updated = await typstNotesApi.update(selectedId, { title: title.trim() || "未命名", content_typst: content });
      setNote(updated);
      dirtyRef.current = false;
      setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...it, title: updated.title, updated_at: updated.updated_at } : it)));
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (selectedId) loadNote(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (!dirtyRef.current) return;
    saveTimerRef.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        const updated = await typstNotesApi.update(selectedId, { title: title.trim() || "未命名", content_typst: content });
        setNote(updated);
        dirtyRef.current = false;
        setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...it, title: updated.title, updated_at: updated.updated_at } : it)));
      } catch (e: any) {
        message.error(e?.response?.data?.detail || e?.message || "自动保存失败");
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [title, content, selectedId]);

  const compileSvg = async (src: string, token: number) => {
    if (!typstImportRef.current) typstImportRef.current = import("@myriaddreamin/typst.ts");
    const m = await typstImportRef.current;
    const out = await m.$typst.svg({ mainContent: src || "" });
    if (previewTokenRef.current !== token) return;
    setSvg(out);
  };

  useEffect(() => {
    if (!selectedId) return;
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    const src = content;
    const token = ++previewTokenRef.current;
    previewTimerRef.current = window.setTimeout(async () => {
      setSvgLoading(true);
      try {
        await compileSvg(src, token);
      } catch (_e: any) {
        if (previewTokenRef.current === token) setSvg("");
      } finally {
        if (previewTokenRef.current === token) setSvgLoading(false);
      }
    }, 500);
  }, [content, selectedId]);

  const createNote = async () => {
    const titleInput = await new Promise<string | null>((resolve) => {
      let v = "";
      Modal.confirm({
        title: "新建 Typst 笔记",
        content: (
          <Input
            autoFocus
            placeholder="请输入标题"
            onChange={(e) => {
              v = e.target.value;
            }}
            onPressEnter={() => resolve(v)}
          />
        ),
        okText: "创建",
        cancelText: "取消",
        onOk: () => resolve(v),
        onCancel: () => resolve(null),
      });
    });
    if (titleInput === null) return;
    const t = titleInput.trim() || "未命名";
    try {
      const n = await typstNotesApi.create({ title: t, content_typst: "" });
      setItems((prev) => [{ id: n.id, title: n.title, updated_at: n.updated_at, compiled_at: n.compiled_at }, ...prev]);
      setSelectedId(n.id);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "创建失败");
    }
  };

  const removeNote = async () => {
    if (!selectedId) return;
    Modal.confirm({
      title: "删除笔记",
      content: "确认删除当前笔记？删除后不可恢复。",
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          await typstNotesApi.remove(selectedId);
          const next = items.filter((it) => it.id !== selectedId);
          setItems(next);
          setSelectedId(next[0]?.id ?? null);
        } catch (e: any) {
          message.error(e?.response?.data?.detail || e?.message || "删除失败");
        }
      },
    });
  };

  const exportTyp = () => {
    const blob = new Blob([content || ""], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${(title.trim() || "typst-note").replaceAll("/", "-")}.typ`);
  };

  const exportPdf = async () => {
    if (!selectedId) return;
    try {
      setSaving(true);
      if (dirtyRef.current) {
        const updated = await typstNotesApi.update(selectedId, { title: title.trim() || "未命名", content_typst: content });
        setNote(updated);
        dirtyRef.current = false;
      }
      const blob = await typstNotesApi.compilePdf(selectedId);
      downloadBlob(blob, `${(title.trim() || "typst-note").replaceAll("/", "-")}.pdf`);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "导出PDF失败");
    } finally {
      setSaving(false);
    }
  };

  const activeItem = useMemo(() => items.find((it) => it.id === selectedId) || null, [items, selectedId]);

  return (
    <div className="grid grid-cols-[320px_1fr] gap-4 items-start">
      <div className="sticky top-[72px]">
        <Card
          size="small"
          title="Typst 笔记"
          extra={
            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={createNote}>
                新建
              </Button>
            </Space>
          }
          className="!border-none !rounded-[10px]"
          styles={{ body: { padding: 12 } }}
        >
          <Input.Search
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={loadList}
            placeholder="搜索标题"
            allowClear
            className="mb-2.5"
          />
          {listLoading ? (
            <div className="text-center p-4">
              <Spin />
            </div>
          ) : items.length === 0 ? (
            <EmptyState description="暂无笔记" />
          ) : (
            <div className="flex flex-col gap-2 max-h-[calc(100vh-220px)] overflow-auto">
              {items.map((it) => (
                <div
                  key={it.id}
                  onClick={() => setSelectedId(it.id)}
                  className="cursor-pointer p-2.5 rounded-[10px] flex flex-col gap-1"
                  style={{
                    border:
                      it.id === selectedId
                        ? "1px solid #0EA5E9"
                        : "1px solid rgba(0,0,0,0.08)",
                    background: it.id === selectedId ? "rgba(14, 165, 233, 0.08)" : "#FFFFFF",
                  }}
                >
                  <Text strong ellipsis>
                    {it.title}
                  </Text>
                  <Text type="secondary" className="text-xs">
                    更新：{new Date(it.updated_at).toLocaleString()}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="min-w-0 flex flex-col gap-4">
        <Card
          size="small"
          title={
            <Space size={10}>
              <Text strong>{activeItem?.title || "未选择笔记"}</Text>
              {saving ? <Text type="secondary">保存中…</Text> : dirtyRef.current ? <Text type="secondary">未保存</Text> : <Text type="secondary">已保存</Text>}
            </Space>
          }
          extra={
            <Space>
              <Button icon={<SaveOutlined />} onClick={saveNow} disabled={!selectedId || saving || !dirtyRef.current}>
                保存
              </Button>
              <Button icon={<DownloadOutlined />} onClick={exportTyp} disabled={!selectedId}>
                导出 .typ
              </Button>
              <Button type="primary" icon={<DownloadOutlined />} onClick={exportPdf} disabled={!selectedId}>
                导出 PDF
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={removeNote} disabled={!selectedId}>
                删除
              </Button>
            </Space>
          }
          className="!border-none !rounded-[10px]"
          styles={{ body: { padding: 12 } }}
        >
          {noteLoading ? (
            <div className="text-center p-6">
              <Spin />
            </div>
          ) : !selectedId ? (
            <EmptyState description="请选择或新建一个笔记" />
          ) : (
            <Space orientation="vertical" size={12} style={{ width: "100%" }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Text type="secondary">标题</Text>
                  <Input
                    value={title}
                    onChange={(e) => {
                      dirtyRef.current = true;
                      setTitle(e.target.value);
                    }}
                    placeholder="输入标题"
                  />
                </div>
                <div>
                  <Text type="secondary">状态</Text>
                  <Input value={note?.compiled_at ? `已编译：${new Date(note.compiled_at).toLocaleString()}` : "未编译"} readOnly />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-start">
                <Card size="small" title="编辑" className="!border-none !rounded-[10px]" styles={{ body: { padding: 10 } }}>
                  <TextArea
                    value={content}
                    onChange={(e) => {
                      dirtyRef.current = true;
                      setContent(e.target.value);
                    }}
                    autoSize={{ minRows: 18, maxRows: 32 }}
                    className="font-mono"
                  />
                </Card>

                <Card size="small" title="实时预览（WASM）" className="!border-none !rounded-[10px]" styles={{ body: { padding: 10 } }}>
                  <div
                    className="min-h-[420px] rounded-xl border border-black/[0.04] bg-surface-2 overflow-auto p-2.5"
                  >
                    {svgLoading ? (
                      <div className="text-center p-6">
                        <Spin />
                      </div>
                    ) : svg ? (
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true }, ADD_TAGS: ["use"] }) }} />
                    ) : (
                      <Text type="secondary">暂无预览（可能是 Typst 语法错误或初始化中）</Text>
                    )}
                  </div>
                </Card>
              </div>
            </Space>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TypstNotesPanel;
