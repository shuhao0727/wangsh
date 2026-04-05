import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Download, Plus, Save, Search, Loader2 } from "lucide-react";
import EmptyState from "@components/Common/EmptyState";
import { typstNotesApi } from "@services";
import type { TypstNote, TypstNoteListItem } from "@services";

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
      showMessage.error(e?.response?.data?.detail || e?.message || "加载笔记失败");
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
      showMessage.error(e?.response?.data?.detail || e?.message || "加载笔记详情失败");
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
      showMessage.error(e?.response?.data?.detail || e?.message || "保存失败");
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
        showMessage.error(e?.response?.data?.detail || e?.message || "自动保存失败");
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
    const titleInput = window.prompt("新建 Typst 笔记：请输入标题", "");
    if (titleInput === null) return;
    const t = titleInput.trim() || "未命名";
    try {
      const n = await typstNotesApi.create({ title: t, content_typst: "" });
      setItems((prev) => [{ id: n.id, title: n.title, updated_at: n.updated_at, compiled_at: n.compiled_at }, ...prev]);
      setSelectedId(n.id);
    } catch (e: any) {
      showMessage.error(e?.response?.data?.detail || e?.message || "创建失败");
    }
  };

  const removeNote = async () => {
    if (!selectedId) return;
    if (!window.confirm("确认删除当前笔记？删除后不可恢复。")) return;
    try {
      await typstNotesApi.remove(selectedId);
      const next = items.filter((it) => it.id !== selectedId);
      setItems(next);
      setSelectedId(next[0]?.id ?? null);
    } catch (e: any) {
      showMessage.error(e?.response?.data?.detail || e?.message || "删除失败");
    }
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
      showMessage.error(e?.response?.data?.detail || e?.message || "导出PDF失败");
    } finally {
      setSaving(false);
    }
  };

  const activeItem = useMemo(() => items.find((it) => it.id === selectedId) || null, [items, selectedId]);

  return (
    <div className="grid grid-cols-[320px_1fr] gap-4 items-start">
      <div className="sticky top-[72px]">
        <Card className="!border-none !rounded-[10px]">
          <div className="flex items-center justify-between border-b border-border-secondary p-3">
            <span className="text-sm font-semibold">Typst 笔记</span>
            <Button size="sm" variant="outline" onClick={createNote}>
              <Plus className="h-4 w-4" /> 新建
            </Button>
          </div>
          <div className="p-3">
            <div className="mb-2.5 flex items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void loadList();
                  }
                }}
                placeholder="搜索标题"
              />
              <Button size="sm" variant="outline" onClick={() => void loadList()}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          {listLoading ? (
            <div className="flex items-center justify-center p-4 text-text-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState description="暂无笔记" />
          ) : (
            <div className="flex flex-col gap-2 max-h-[calc(100vh-220px)] overflow-auto">
              {items.map((it) => (
                <div
                  key={it.id}
                  onClick={() => setSelectedId(it.id)}
                  className={`cursor-pointer rounded-[10px] border p-2.5 flex flex-col gap-1 ${
                    it.id === selectedId
                      ? "border-[color:var(--ws-color-primary)] bg-primary-soft"
                      : "border-border bg-surface"
                  }`}
                >
                  <p className="truncate text-sm font-semibold">
                    {it.title}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    更新：{new Date(it.updated_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          </div>
        </Card>
      </div>

      <div className="min-w-0 flex flex-col gap-4">
        <Card className="!border-none !rounded-[10px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-secondary p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activeItem?.title || "未选择笔记"}</p>
              <p className="text-xs text-text-tertiary">
                {saving ? "保存中…" : dirtyRef.current ? "未保存" : "已保存"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={saveNow} disabled={!selectedId || saving || !dirtyRef.current}>
                <Save className="h-4 w-4" /> 保存
              </Button>
              <Button variant="outline" onClick={exportTyp} disabled={!selectedId}>
                <Download className="h-4 w-4" /> 导出 .typ
              </Button>
              <Button onClick={exportPdf} disabled={!selectedId}>
                <Download className="h-4 w-4" /> 导出 PDF
              </Button>
              <Button variant="destructive" onClick={removeNote} disabled={!selectedId}>
                <Trash2 className="h-4 w-4" /> 删除
              </Button>
            </div>
          </div>
          <div className="p-3">
          {noteLoading ? (
            <div className="flex items-center justify-center p-6 text-text-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : !selectedId ? (
            <EmptyState description="请选择或新建一个笔记" />
          ) : (
            <div className="flex w-full flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs text-text-tertiary">标题</p>
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
                  <p className="mb-1 text-xs text-text-tertiary">状态</p>
                  <Input value={note?.compiled_at ? `已编译：${new Date(note.compiled_at).toLocaleString()}` : "未编译"} readOnly />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-start">
                <Card className="!border-none !rounded-[10px]">
                  <div className="border-b border-border-secondary p-2.5 text-sm font-semibold">编辑</div>
                  <div className="p-2.5">
                  <Textarea
                    value={content}
                    onChange={(e) => {
                      dirtyRef.current = true;
                      setContent(e.target.value);
                    }}
                    className="min-h-[420px] resize-y font-mono leading-6"
                  />
                  </div>
                </Card>

                <Card className="!border-none !rounded-[10px]">
                  <div className="border-b border-border-secondary p-2.5 text-sm font-semibold">实时预览（WASM）</div>
                  <div className="p-2.5">
                  <div
                    className="min-h-[420px] rounded-xl border border-border-secondary bg-surface-2 overflow-auto p-2.5"
                  >
                    {svgLoading ? (
                      <div className="flex items-center justify-center p-6 text-text-tertiary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : svg ? (
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true }, ADD_TAGS: ["use"] }) }} />
                    ) : (
                      <p className="text-sm text-text-tertiary">暂无预览（可能是 Typst 语法错误或初始化中）</p>
                    )}
                  </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TypstNotesPanel;
