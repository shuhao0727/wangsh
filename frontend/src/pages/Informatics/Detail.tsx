import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { publicTypstNotesApi } from "@services";
import type { PublicTypstNote } from "@services";
import PdfCanvasVirtualViewer from "@components/Pdf/PdfCanvasVirtualViewer";
import PanelCard from "@components/Layout/PanelCard";
import { formatDateTime } from "@/utils/dateFormat";
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
  const [pdfError, setPdfError] = useState("");
  const renderTokenRef = useRef(0);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const viewerWrapRef = useRef<HTMLDivElement | null>(null);

  const title = useMemo(() => note?.title || "内容", [note?.title]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!noteId) {
        void navigate("/informatics");
        return;
      }
      setLoading(true);
      setNote(null);
      setPdfData(null);
      try {
        const n = await publicTypstNotesApi.get(noteId);
        if (cancelled) return;
        setNote(n);
      } catch (e: any) {
        if (cancelled) return;
        showMessage.error(e?.response?.data?.detail || e?.message || "内容不存在");
        void navigate("/informatics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [noteId, navigate]);

  useEffect(() => {
    const token = ++renderTokenRef.current;
    const render = async () => {
      if (!note || note.id !== noteId) return;
      setPdfLoading(true);
      setPdfError("");
      setPdfData(null);
      try {
        if (note.pdf_available === false) {
          setPdfError("PDF 暂未生成，请联系管理员编译");
          return;
        }
        const blob = await publicTypstNotesApi.exportPdf(noteId, note.updated_at || Date.now());
        if (renderTokenRef.current !== token) return;
        const data = new Uint8Array(await blob.arrayBuffer());
        if (renderTokenRef.current !== token) return;
        setPdfData(data);
      } catch (e: any) {
        if (renderTokenRef.current !== token) return;
        const message = e?.response?.data?.detail || e?.message || "渲染失败";
        setPdfError(message);
        if (message !== "PDF 暂未生成，请联系管理员编译") showMessage.error(message);
      } finally {
        if (renderTokenRef.current === token) setPdfLoading(false);
      }
    };
    void render();
    return () => {
      renderTokenRef.current += 1;
    };
  }, [note, noteId]);

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
    <div className="informatics-page bg-module-shell-surface text-module-shell-text">
      <div className="informatics-detail-top">
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            className="border-module-shell-border bg-module-shell-input text-module-shell-text hover:bg-module-shell-hover focus-visible:ring-module-shell-focus"
            onClick={() => void navigate("/informatics")}
          >
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
          /* 原为无 aria 的裸 Loader2；LoadingState 自带 role="status" + 可访问名称。
             尺寸 xl(=h-8) 与原 h-7 视觉接近。 */
          <LoadingState label="正在加载笔记…" size="1.5x" className="py-panel-padding text-module-shell-muted" showLabel />
        ) : (
          <PanelCard>
            {note?.summary ? (
              <div className="mb-3">
                <span className="text-module-shell-muted">{note.summary}</span>
              </div>
            ) : null}
            <div className="mb-3">
              <span className="text-xs text-module-shell-muted">
                更新：{note?.updated_at ? formatDateTime(note.updated_at) : "-"}
              </span>
            </div>
            {note?.toc?.length ? (
              <Card className="mb-content-gap rounded-xl border-module-shell-border bg-module-shell-surface-2 text-module-shell-text">
                <CardHeader className="pb-xs pt-3">
                  <CardTitle className="text-sm font-semibold">目录</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-col gap-1.5">
                    {note.toc.map((it: any, idx: number) => (
                      <div key={idx} style={{ paddingLeft: Math.max(0, (it.level || 1) - 1) * 12 }}>
                        <span>{extractHeadingText(it.text || it)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
            <div
              className="informatics-typst-viewer no-copy"
              ref={viewerWrapRef}
              role="region"
              aria-label="PDF 阅读器"
              aria-busy={pdfLoading}
              tabIndex={0}
              style={{ userSelect: "none", WebkitUserSelect: "none" } as any}
            >
              {pdfLoading ? (
                <LoadingState label="正在加载 PDF…" size="md" className="py-panel-padding text-module-shell-muted" showLabel />
              ) : pdfError ? (
                <div
                  className={`p-panel-padding text-sm ${pdfError === "PDF 暂未生成，请联系管理员编译" ? "bg-info-soft text-info-text" : "bg-error-soft text-error-text"}`}
                  role="status"
                  aria-label={pdfError === "PDF 暂未生成，请联系管理员编译" ? "PDF 尚未生成" : "文档加载失败"}
                >
                  <div className="font-semibold">
                    {pdfError === "PDF 暂未生成，请联系管理员编译" ? "PDF 尚未生成" : "文档加载失败"}
                  </div>
                  <div className="mt-2xs">{pdfError}</div>
                  <div className="mt-xs">
                    {pdfError === "PDF 暂未生成，请联系管理员编译"
                      ? "这篇内容已经发布，但管理员还没有生成可供公开阅读的 PDF。"
                      : "请稍后重试，或联系管理员检查文档编译结果。"}
                  </div>
                </div>
              ) : (
                <PdfCanvasVirtualViewer data={pdfData} />
              )}
            </div>
          </PanelCard>
        )}
      </div>
    </div>
  );
};

export default InformaticsDetailPage;
