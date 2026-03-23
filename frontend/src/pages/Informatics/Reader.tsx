
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Empty, Input, Tree, Typography, message, Skeleton, Tabs, Drawer, Grid } from "antd";
import { ReloadOutlined, SearchOutlined, MenuOutlined, ArrowLeftOutlined, FileTextOutlined, UnorderedListOutlined, FolderOutlined, RightOutlined } from "@ant-design/icons";
import { publicTypstNotesApi } from "@services";
import type { PublicTypstNoteListItem } from "@services";
import PdfCanvasVirtualViewer, { type PdfCanvasVirtualViewerHandle } from "@components/Pdf/PdfCanvasVirtualViewer";
import SplitPanePage from "@components/Layout/SplitPanePage";
import PanelCard from "@components/Layout/PanelCard";
import { useDebounce } from "@hooks/useDebounce";
import "./Informatics.css";

const { Text } = Typography;

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
  icon?: React.ReactNode;
};

const InformaticsReaderPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [listLoading, setListLoading] = useState(false);
  const [items, setItems] = useState<PublicTypstNoteListItem[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string>("");
  const renderTokenRef = useRef(0);
  const [outline, setOutline] = useState<PdfOutlineItem[]>([]);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PdfCanvasVirtualViewerHandle | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const outlineTokenRef = useRef(0);

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [docExpandedKeys, setDocExpandedKeys] = useState<string[]>([]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await publicTypstNotesApi.list({ limit: 100, search: debouncedSearch.trim() || undefined });
      setItems(res || []);
      if (res?.length && !isMobile) {
        setSelectedId((prev) => prev ?? res[0].id);
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (e?.message || "加载目录失败");
      message.error(msg);
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch, isMobile]);

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
    const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
    const getNodeSortKey = (key: string) => key.replace(/^cat:/, "").replace(/^note:/, "");
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
          const node: TreeNode = { 
            title: (
              <span className="font-medium text-text-secondary">{p}</span>
            ),
            key: `cat:${curPath}`,
            children: [],
            icon: <FolderOutlined className="text-primary" />
          };
          cur.children = cur.children || [];
          cur.children.push(node);
          catMap.set(curPath, node);
        }
        cur = catMap.get(curPath)!;
      }
      return cur;
    };

    const sortedItems = [...items].sort((a, b) => {
      const ac = String(a.category_path || "");
      const bc = String(b.category_path || "");
      if (ac !== bc) return collator.compare(ac, bc);
      const an = String(a.source_path || "").split("/").pop() || String(a.title || "");
      const bn = String(b.source_path || "").split("/").pop() || String(b.title || "");
      return collator.compare(an, bn);
    });

    for (const it of sortedItems) {
      const cat = (it.category_path || "").trim();
      const catNode = ensureCatNode(cat || "未分类");
      catNode.children = catNode.children || [];
      const sourceName = String(it.source_path || "").split("/").pop() || "";
      const sourceStem = sourceName ? sourceName.replace(/\.typ$/i, "") : "";
      catNode.children.push({
        key: `note:${it.id}`,
        isLeaf: true,
        icon: <FileTextOutlined className="text-text-tertiary" />,
        title: (
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <Text strong style={{ display: "block", fontSize: 13 }} ellipsis={{ tooltip: sourceStem || it.title }}>
              {sourceStem || it.title}
            </Text>
            {it.title && sourceStem && it.title !== sourceStem ? (
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: -2 }} ellipsis={{ tooltip: it.title }}>
                {it.title}
              </Text>
            ) : null}
            {it.summary ? (
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: -2 }} ellipsis={{ tooltip: it.summary }}>
                {it.summary}
              </Text>
            ) : null}
          </div>
        ),
      });
    }

    const sortTree = (node: TreeNode) => {
      if (!node.children) return;
      node.children.sort((a, b) => {
        const aKey = String(a.key);
        const bKey = String(b.key);
        const aIsCat = aKey.startsWith("cat:");
        const bIsCat = bKey.startsWith("cat:");
        if (aIsCat !== bIsCat) return aIsCat ? -1 : 1;
        if (!aIsCat && !bIsCat) return 0;
        return collator.compare(getNodeSortKey(aKey), getNodeSortKey(bKey));
      });
      node.children.forEach(sortTree);
    };
    sortTree(root);
    return root.children || [];
  }, [items]);

  useEffect(() => {
    setDocExpandedKeys((prev) => {
      if (prev.length > 0) return prev;
      if (!treeData[0]) return prev;
      return [String(treeData[0].key)];
    });
  }, [treeData]);

  const outlineTreeData = useMemo<TreeNode[]>(() => {
    const roots: TreeNode[] = [];
    const stack: Array<{ level: number; node: TreeNode }> = [];
    outline.forEach((it, idx) => {
      const level = Math.max(1, Number(it.level) || 1);
      const key = `outline:${idx}`;
      const node: TreeNode = {
        key,
        title: (
          <Text ellipsis={{ tooltip: it.title }} className="block text-sm">
            {it.title} <Text type="secondary" className="text-[10px]">p{it.pageNumber}</Text>
          </Text>
        ),
      };
      while (stack.length && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      if (!stack.length) {
        roots.push(node);
      } else {
        const parent = stack[stack.length - 1].node;
        parent.children = parent.children || [];
        parent.children.push(node);
      }
      stack.push({ level, node });
    });
    return roots;
  }, [outline]);

  const outlinePageMap = useMemo(() => {
    const map = new Map<string, number>();
    outline.forEach((it, idx) => {
      map.set(`outline:${idx}`, it.pageNumber);
    });
    return map;
  }, [outline]);

  const scrollToPage = (pageNumber: number) => {
    viewerRef.current?.scrollToPage(pageNumber);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
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
              if (typeof dest === "string") {
                dest = await pdf.getDestination(dest);
              }
              if (Array.isArray(dest) && dest.length > 0) {
                const ref = dest[0];
                if (typeof ref === "object" && ref !== null) {
                  const pageIndex = await pdf.getPageIndex(ref);
                  pageNumber = Number(pageIndex) + 1;
                } else if (typeof ref === "number") {
                  pageNumber = ref + 1;
                }
              }
            } catch {
              pageNumber = 1;
            }
            flat.push({ title: it?.title || "未命名", level, pageNumber });
            if (it?.items?.length) await walk(it.items, level + 1);
          }
        };
        if (rawOutline) {
          await walk(rawOutline, 1);
        }
        if (outlineTokenRef.current === token) setOutline(flat);
      } catch {
        if (outlineTokenRef.current === token) setOutline([]);
      }
    })();
  }, []);

  // --- Render Helpers ---

  const renderSearch = () => (
    <div className="flex gap-2 mb-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onPressEnter={loadList}
        placeholder="搜索文档..."
        allowClear
        prefix={<SearchOutlined className="text-text-tertiary" />}
        size="middle"
        className="flex-1"
      />
      <Button icon={<ReloadOutlined />} onClick={loadList} loading={listLoading}
        size="middle" type="text" className="text-text-secondary" />
    </div>
  );

  const renderDocTree = () => (
    <div className="informatics-scroll-container">
      {listLoading ? (
        <div className="p-4">
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : (
        <>
          <Tree
            treeData={treeData as any}
            className="informatics-tree"
            selectedKeys={selectedId ? [`note:${selectedId}`] : []}
            expandedKeys={docExpandedKeys}
            onExpand={(keys) => setDocExpandedKeys(keys.map((k) => String(k)))}
            onSelect={(keys) => {
              const k = String(keys?.[0] || "");
              if (k.startsWith("note:")) {
                const noteId = Number(k.slice("note:".length));
                setSelectedId(noteId);
                const current = items.find((x) => x.id === noteId);
                const cat = String(current?.category_path || "").trim();
                if (cat) {
                  const parts = cat.split("/").map((x) => x.trim()).filter(Boolean);
                  let cur = "";
                  const keysToOpen: string[] = [];
                  for (const p of parts) {
                    cur = cur ? `${cur}/${p}` : p;
                    keysToOpen.push(`cat:${cur}`);
                  }
                  setDocExpandedKeys((prev) => Array.from(new Set([...prev, ...keysToOpen])));
                }
                if (isMobile) {
                  setMobileDrawerOpen(false);
                }
              }
            }}
            blockNode
            showIcon
            showLine={{ showLeafIcon: false }}
            switcherIcon={({ expanded }: any) => (
              <MenuOutlined className={`text-[10px] opacity-40 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
            )}
          />
          {items.length === 0 ? <Empty description="暂无已发布内容" className="mt-3" /> : null}
        </>
      )}
    </div>
  );

  const renderOutline = () => (
    <div className="informatics-scroll-container">
      {outline.length ? (
        <Tree
          treeData={outlineTreeData as any}
          className="informatics-tree informatics-outline-tree"
          defaultExpandAll
          blockNode
          showLine={{ showLeafIcon: false }}
          switcherIcon={({ expanded }: any) => (
            <RightOutlined className={`text-[10px] opacity-50 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
          )}
          onSelect={(keys) => {
            const key = String(keys?.[0] || "");
            const page = outlinePageMap.get(key);
            if (page) {
              scrollToPage(page);
            }
          }}
        />
      ) : (
        <div className="p-4 text-center">
          <Text type="secondary">暂无目录</Text>
        </div>
      )}
    </div>
  );

  const renderLeftContent = () => (
    <div className="flex flex-col h-full">
      {renderSearch()}
      <Tabs
        defaultActiveKey="docs"
        className="informatics-full-height-tabs"
        items={[
          { 
            key: 'docs', 
            label: <span><FileTextOutlined />文档列表</span>, 
            children: renderDocTree() 
          },
          { 
            key: 'outline', 
            label: <span><UnorderedListOutlined />目录大纲</span>, 
            children: renderOutline() 
          }
        ]}
      />
    </div>
  );

  const renderReader = () => (
    <div
      className="informatics-typst-viewer no-copy"
      ref={rightScrollRef}
      style={{ userSelect: "none", WebkitUserSelect: "none" } as any}
    >
      {pdfLoading ? (
        <div className="p-8">
          <Skeleton active avatar paragraph={{ rows: 8 }} />
          <div className="h-8" />
          <Skeleton active avatar paragraph={{ rows: 8 }} />
        </div>
      ) : null}
      {!pdfLoading && pdfError ? (
        <div className="p-3">
          <Alert
            type="error"
            showIcon
            message="文档编译失败"
            description={<pre className="!m-0 whitespace-pre-wrap">{pdfError}</pre>}
          />
          <div className="h-2.5" />
          <Text type="secondary">提示：通常是缺少图片资源（例如 images/a.png）或导入路径不正确，请在管理端上传资源或修正文档引用。</Text>
        </div>
      ) : null}
      <div className={pdfLoading ? 'hidden' : 'block'}>
        <PdfCanvasVirtualViewer ref={viewerRef} data={pdfData} rootRef={rightScrollRef} onPdfLoaded={handlePdfLoaded} />
      </div>
    </div>
  );

  // --- Mobile Layout ---
  if (isMobile) {
    return (
      <div className="w-full flex-1 min-h-0 flex flex-col mx-auto p-4" style={{ maxWidth: "var(--ws-page-max-width-wide)" }}>
        {selectedId ? (
          // Mobile Reader View
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-3 py-3 flex-shrink-0 bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setSelectedId(null)} />
              <Text ellipsis strong className="flex-1">
                {items.find((x) => x.id === selectedId)?.title || "内容"}
              </Text>
              <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileDrawerOpen(true)} />
            </div>
            <div className="informatics-mobile-content">
              {renderReader()}
            </div>
            <Drawer 
              open={mobileDrawerOpen} 
              onClose={() => setMobileDrawerOpen(false)} 
              placement="left" 
              width="85%"
              title="导航"
              styles={{ body: { padding: 12 } }}
            >
              {renderLeftContent()}
            </Drawer>
          </div>
        ) : (
          // Mobile List View
          <div className="h-full p-3 flex flex-col">
            {renderLeftContent()}
          </div>
        )}
      </div>
    );
  }

  // --- Desktop Layout ---
  return (
    <div className="w-full flex-1 min-h-0 flex flex-col mx-auto p-4" style={{ maxWidth: "var(--ws-page-max-width-wide)" }}>
      <SplitPanePage
        leftWidth={320}
        alignItems="stretch"
        left={
          <PanelCard bodyPadding={12}>
            {renderLeftContent()}
          </PanelCard>
        }
        right={
          <PanelCard
            title={
              <span className="text-lg font-semibold text-text-base">
                {selectedId ? items.find((x) => x.id === selectedId)?.title || "内容" : "内容"}
              </span>
            }
          >
            {renderReader()}
          </PanelCard>
        }
      />
    </div>
  );
};

export default InformaticsReaderPage;
