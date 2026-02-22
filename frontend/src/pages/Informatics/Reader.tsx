import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Empty, Input, Spin, Tree, Typography, message } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { publicTypstNotesApi } from "@services";
import type { PublicTypstNoteListItem } from "@services";
import PdfCanvasVirtualViewer, { type PdfCanvasVirtualViewerHandle } from "@components/Pdf/PdfCanvasVirtualViewer";
import SplitPanePage from "@components/Layout/SplitPanePage";
import PanelCard from "@components/Layout/PanelCard";
import "./Informatics.css";

const { Title, Text } = Typography;

type PdfOutlineItem = {
  title: string;
  level: number;
  pageNumber: number;
};

type TreeNode = {
  title: React.ReactNode;
  key: string;
  children?: TreeNode[];
  isLeaf?: boolean;
};

const InformaticsReaderPage: React.FC = () => {
  const [listLoading, setListLoading] = useState(false);
  const [items, setItems] = useState<PublicTypstNoteListItem[]>([]);
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string>("");
  const renderTokenRef = useRef(0);
  const [outline, setOutline] = useState<PdfOutlineItem[]>([]);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PdfCanvasVirtualViewerHandle | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const outlineTokenRef = useRef(0);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await publicTypstNotesApi.list({ limit: 200, search: search.trim() || undefined });
      setItems(res || []);
      setSelectedId((prev) => (prev ? prev : (res?.length ? res[0].id : null)));
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "加载目录失败");
    } finally {
      setListLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadNote = useCallback(async (id: number) => {
    const token = ++renderTokenRef.current;
    setPdfLoading(true);
    setPdfError("");
    setOutline([]);
    setPdfData(null);
    outlineTokenRef.current = token;
    try {
      await publicTypstNotesApi.get(id);
      if (renderTokenRef.current !== token) return;

      const blob = await publicTypstNotesApi.exportPdf(id);
      const data = new Uint8Array(await blob.arrayBuffer());
      if (renderTokenRef.current !== token) return;
      setPdfData(data);
    } catch (e: any) {
      if (renderTokenRef.current !== token) return;
      const msg = e?.message || e?.response?.data?.detail || "加载内容失败";
      setPdfError(msg);
      message.error(msg);
    } finally {
      if (renderTokenRef.current === token) setPdfLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadNote(selectedId);
  }, [selectedId, loadNote]);

  useEffect(() => {
    return () => {
      renderTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const el = rightScrollRef.current;
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
  }, []);

  const treeData = useMemo<TreeNode[]>(() => {
    const root: TreeNode = { title: "root", key: "root", children: [] };
    const catMap = new Map<string, TreeNode>();
    catMap.set("", root);

    const ensureCatNode = (path: string) => {
      const norm = (path || "").trim();
      if (catMap.has(norm)) return catMap.get(norm)!;
      const parts = norm.split("/").map((x) => x.trim()).filter(Boolean);
      let curPath = "";
      let cur = root;
      for (const p of parts) {
        curPath = curPath ? `${curPath}/${p}` : p;
        if (!catMap.has(curPath)) {
          const node: TreeNode = { title: p, key: `cat:${curPath}`, children: [] };
          cur.children = cur.children || [];
          cur.children.push(node);
          catMap.set(curPath, node);
        }
        cur = catMap.get(curPath)!;
      }
      return cur;
    };

    for (const it of items) {
      const cat = (it.category_path || "").trim();
      const catNode = ensureCatNode(cat || "未分类");
      catNode.children = catNode.children || [];
      catNode.children.push({
        key: `note:${it.id}`,
        isLeaf: true,
        title: (
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <Text strong style={{ display: "block" }} ellipsis={{ tooltip: it.title }}>
              {it.title}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: "block" }} ellipsis={{ tooltip: it.summary || "—" }}>
              {it.summary || "—"}
            </Text>
          </div>
        ),
      });
    }

    const sortTree = (node: TreeNode) => {
      if (!node.children) return;
      node.children.sort((a, b) => String(a.key).localeCompare(String(b.key), "zh-CN"));
      node.children.forEach(sortTree);
    };
    sortTree(root);
    return root.children || [];
  }, [items]);

  const scrollToPage = (pageNumber: number) => {
    viewerRef.current?.scrollToPage(pageNumber);
  };

  const handlePdfLoaded = useCallback((pdf: any) => {
    const token = outlineTokenRef.current;
    (async () => {
      try {
        const rawOutline = await pdf.getOutline();
        const flat: PdfOutlineItem[] = [];
        const walk = async (items: any[], level: number) => {
          for (const it of items || []) {
            let pageNumber = 1;
            try {
              let dest = it?.dest;
              if (typeof dest === "string") dest = await pdf.getDestination(dest);
              if (Array.isArray(dest) && dest.length) {
                const ref = dest[0];
                const pageIndex = await pdf.getPageIndex(ref);
                pageNumber = Number(pageIndex) + 1;
              }
            } catch {
              pageNumber = 1;
            }
            flat.push({ title: it?.title || "未命名", level, pageNumber });
            if (it?.items?.length) await walk(it.items, level + 1);
          }
        };
        await walk(rawOutline || [], 1);
        if (outlineTokenRef.current === token) setOutline(flat);
      } catch {
        if (outlineTokenRef.current === token) setOutline([]);
      }
    })();
  }, []);

  return (
    <div className="informatics-page">
      <SplitPanePage
        left={
          <PanelCard bodyPadding={12}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onPressEnter={loadList}
                  placeholder="搜索标题"
                  allowClear
                  prefix={<SearchOutlined />}
                />
                <Button icon={<ReloadOutlined />} onClick={loadList} loading={listLoading} />
            </div>

            <div style={{ maxHeight: "calc(100vh - 420px)", overflow: "auto", border: "1px solid var(--ws-color-border)", borderRadius: "var(--ws-radius-md)" }}>
                {listLoading ? (
                  <div style={{ textAlign: "center", padding: 18 }}>
                    <Spin />
                  </div>
                ) : null}
                <Tree
                  treeData={treeData as any}
                  className="informatics-tree"
                  selectedKeys={selectedId ? [`note:${selectedId}`] : []}
                  onSelect={(keys) => {
                    const k = String(keys?.[0] || "");
                    if (k.startsWith("note:")) setSelectedId(Number(k.slice("note:".length)));
                  }}
                  defaultExpandAll
                />
                {items.length === 0 ? <Empty description="暂无已发布内容" style={{ marginTop: 12 }} /> : null}
            </div>

            <div style={{ height: 16 }} />

            <div className="informatics-outline" style={{ minHeight: 320, maxHeight: "calc(100vh - 300px)", overflow: "auto", border: "1px solid var(--ws-color-border)", borderRadius: "var(--ws-radius-md)", padding: 10 }}>
                {outline.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {outline.map((it, idx) => (
                      <div
                        key={idx}
                        onClick={() => scrollToPage(it.pageNumber)}
                        className="informatics-outline-item"
                        style={{
                          paddingLeft: Math.max(0, (it.level || 1) - 1) * 12,
                          cursor: "pointer",
                          paddingTop: 2,
                          paddingBottom: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <Text ellipsis={{ tooltip: it.title }} style={{ display: "block" }}>
                          {it.title} <Text type="secondary">· p{it.pageNumber}</Text>
                        </Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary">暂无目录</Text>
                )}
            </div>
          </PanelCard>
        }
        right={
          <PanelCard
            title={
              <Title level={4} style={{ margin: 0, fontSize: "18px", color: "#2c3e50" }}>
                {selectedId ? items.find((x) => x.id === selectedId)?.title || "内容" : "内容"}
              </Title>
            }
          >
            <div
              className="informatics-typst-viewer no-copy"
              ref={rightScrollRef}
              style={{ userSelect: "none", WebkitUserSelect: "none" } as any}
            >
              {pdfLoading ? (
                <div style={{ textAlign: "center", padding: 24 }}>
                  <Spin />
                </div>
              ) : null}
              {!pdfLoading && pdfError ? (
                <div style={{ padding: 12 }}>
                  <Alert
                    type="error"
                    showIcon
                    message="文档编译失败"
                    description={<pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{pdfError}</pre>}
                  />
                  <div style={{ height: 10 }} />
                  <Text type="secondary">提示：通常是缺少图片资源（例如 images/a.png）或导入路径不正确，请在管理端上传资源或修正文档引用。</Text>
                </div>
              ) : null}
              <PdfCanvasVirtualViewer ref={viewerRef} data={pdfData} rootRef={rightScrollRef} onPdfLoaded={handlePdfLoaded} />
            </div>
          </PanelCard>
        }
      />
    </div>
  );
};

export default InformaticsReaderPage;
