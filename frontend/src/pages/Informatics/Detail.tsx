import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Space, Spin, Typography, message } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { publicTypstNotesApi } from "@services";
import type { PublicTypstNote } from "@services";
import PdfCanvasVirtualViewer from "@components/Pdf/PdfCanvasVirtualViewer";
import PanelCard from "@components/Layout/PanelCard";
import "./Informatics.css";

const { Title, Text } = Typography;

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
        navigate("/informatics");
        return;
      }
      setLoading(true);
      try {
        const n = await publicTypstNotesApi.get(noteId);
        setNote(n);
      } catch (e: any) {
        message.error(e?.response?.data?.detail || e?.message || "内容不存在");
        navigate("/informatics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [noteId, navigate]);

  useEffect(() => {
    const render = async () => {
      if (!note) return;
      const token = ++renderTokenRef.current;
      setPdfLoading(true);
      try {
        const blob = await publicTypstNotesApi.exportPdf(noteId);
        const data = new Uint8Array(await blob.arrayBuffer());
        if (renderTokenRef.current !== token) return;
        setPdfData(data);
      } catch (e: any) {
        if (renderTokenRef.current !== token) return;
        message.error(e?.message || "渲染失败");
      } finally {
        if (renderTokenRef.current === token) setPdfLoading(false);
      }
    };
    render();
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
        <Space size={10}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/informatics")}>
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            {title}
          </Title>
        </Space>
      </div>

      <div className="informatics-content">
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : (
          <PanelCard>
            {note?.summary ? (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">{note.summary}</Text>
              </div>
            ) : null}
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                更新：{note?.updated_at ? new Date(note.updated_at).toLocaleString("zh-CN") : "-"}
              </Text>
            </div>
            {note?.toc?.length ? (
              <Card size="small" title="目录" style={{ marginBottom: 12, borderRadius: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {note.toc.map((it: any, idx: number) => (
                    <div key={idx} style={{ paddingLeft: Math.max(0, (it.level || 1) - 1) * 12 }}>
                      <Text>{extractHeadingText(it.text || it)}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
            <div
              className="informatics-typst-viewer no-copy"
              ref={viewerWrapRef}
              style={{ userSelect: "none", WebkitUserSelect: "none" } as any}
            >
              {pdfLoading ? (
                <div style={{ textAlign: "center", padding: 24 }}>
                  <Spin />
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
