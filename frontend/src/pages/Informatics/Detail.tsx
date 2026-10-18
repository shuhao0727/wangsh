import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { publicTypstNotesApi } from "@services";
import type { PublicTypstNote } from "@services";
import PdfCanvasVirtualViewer from "@components/Pdf/PdfCanvasVirtualViewer";
import PanelCard from "@components/Layout/PanelCard";
import "./Informatics.css";

const extractHeadingText = (h: any) => {
  if (!h) return "";
  if (typeof h === "string") return h;
  if (typeof h.text === "string") return h.text;
  return "";
};

const InformaticsDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const noteId = Number(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<PublicTypstNote | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const renderTokenRef = useRef(0);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const viewerWrapRef = useRef<HTMLDivElement | null>(null);

  const title = useMemo(() => note?.title || "内容", [note?.title]);

  useEffect(() => {
    const load = async () => {
      if (!noteId) {
        void navigate("/informatics");
        return;
      }
      setLoading(true);
      try {
        const n = await publicTypstNotesApi.get(noteId);
        setNote(n);
      } catch (e: any) {
        showMessage.error(e?.response?.data?.detail || e?.message || "内容不存在");
        void navigate("/informatics");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [noteId, navigate]);

  useEffect(() => {
    const render = async () => {
      if (!note) return;
      const token = ++renderTokenRef.current;
      setPdfLoading(true);
      try {
        const blob = await publicTypstNotesApi.exportPdf(noteId, note.updated_at || Date.now());
        const data = new Uint8Array(await blob.arrayBuffer());
        if (renderTokenRef.current !== token) return;
        setPdfData(data);
      } catch (e: any) {
        if (renderTokenRef.current !== token) return;
        showMessage.error(e?.message || "渲染失败");
      } finally {
        if (renderTokenRef.current === token) setPdfLoading(false);
      }
    };
    void render();
  }, [note, noteId]);

  useEffect(() => {
    return () => {
      renderTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const el = viewerWrapRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", prevent);
    el.addEventListener("copy", prevent);
    el.addEventListener("cut", prevent);
    el.addEventListener("paste", prevent);
    return () => {
      el.removeEventListener("contextmenu", prevent);
      el.removeEventListener("copy", prevent);
      el.removeEventListener("cut", prevent);
      el.removeEventListener("paste", prevent);
    };
  }, [noteId]);

  return (
    <div className="informatics-page">
      <div className="informatics-detail-top">
        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={() => void navigate("/informatics")}>
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <h3 className="text-lg font-semibold m-0">
            {title}
          </h3>
        </div>
      </div>

      <div className="informatics-content">
        {loading ? (
          <div className="text-center p-8">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <PanelCard>
            {(note?.summary || note?.updated_at) && (
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--ws-color-border-secondary)] pb-3">
                {note?.summary && <p className="m-0 min-w-0 flex-1 text-sm leading-relaxed text-text-secondary">{note.summary}</p>}
                <span className="shrink-0 text-xs text-text-tertiary">
                  更新于 {note?.updated_at ? new Date(note.updated_at).toLocaleDateString("zh-CN") : "-"}
                </span>
              </div>
            )}
            {note?.toc?.length ? (
              <section className="mb-3 grid gap-x-3 gap-y-1 border-b border-[var(--ws-color-border-secondary)] pb-3 sm:grid-cols-[36px_minmax(0,1fr)]" aria-label="文档目录">
                <h2 className="m-0 text-xs font-medium text-text-tertiary">目录</h2>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
                  {note.toc.map((it: any, idx: number) => (
                    <span key={idx} style={{ marginLeft: `${Math.max(0, (it.level || 1) - 1) * 8}px` }}>
                      {extractHeadingText(it.text || it)}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
            <div
              className="informatics-typst-viewer no-copy"
              ref={viewerWrapRef}
              style={{ userSelect: "none", WebkitUserSelect: "none" } as any}
            >
              {pdfLoading ? (
                <div className="text-center p-6">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                </div>
              ) : null}
              <PdfCanvasVirtualViewer data={pdfData} />
            </div>
          </PanelCard>
        )}
      </div>
    </div>
  );
};

export default InformaticsDetailPage;
