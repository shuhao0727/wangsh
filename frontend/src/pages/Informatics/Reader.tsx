import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  RotateCcw,
  Search,
  Menu,
  ArrowLeft,
  FileText,
  List,
  Folder,
  ChevronRight,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import EmptyState from "@components/Common/EmptyState";
import { publicTypstNotesApi } from "@services";
import type { PublicTypstNoteListItem } from "@services";
import PdfCanvasVirtualViewer, { type PdfCanvasVirtualViewerHandle } from "@components/Pdf/PdfCanvasVirtualViewer";
import SplitPanePage from "@components/Layout/SplitPanePage";
import PanelCard from "@components/Layout/PanelCard";
import { useDebounce } from "@hooks/useDebounce";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import "./Informatics.css";

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

type TreeOptions = {
  expandedKeys: string[];
  selectedKeys?: string[];
  onToggle: (key: string) => void;
  onSelect: (key: string) => void;
  className?: string;
};

const toPlainText = (node: React.ReactNode): string => {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toPlainText).join("");
  if (React.isValidElement(node)) return toPlainText((node as any).props?.children);
  return "";
};

const renderTreeNodes = (
  nodes: TreeNode[],
  options: TreeOptions,
  depth = 0,
): React.ReactNode => {
  return nodes.map((node) => {
    const key = String(node.key);
    const hasChildren = Boolean(node.children?.length);
    const expanded = hasChildren && options.expandedKeys.includes(key);
    const selected = options.selectedKeys?.includes(key);
    const nodeAriaLabel = toPlainText(node.title).trim() || "文档节点";

    return (
      <div key={key}>
        <button
          type="button"
          className={`appearance-none border-0 informatics-tree-row ${selected ? "informatics-tree-row-selected" : ""}`}
          style={{ paddingLeft: `calc(var(--ws-space-1) + ${depth} * var(--ws-space-2))` }}
          aria-label={nodeAriaLabel}
          aria-expanded={hasChildren ? expanded : undefined}
          onClick={() => {
            if (hasChildren && !node.isLeaf) {
              options.onToggle(key);
            } else {
              options.onSelect(key);
            }
          }}
        >
          <span className="informatics-tree-switcher">
            {hasChildren ? (
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
            ) : (
              <span className="h-3.5 w-3.5" />
            )}
          </span>
          {node.icon ? <span className="text-primary">{node.icon}</span> : null}
          <span className="min-w-0 flex-1">{node.title}</span>
        </button>

        {hasChildren && expanded ? renderTreeNodes(node.children || [], options, depth + 1) : null}
      </div>
    );
  });
};

const InformaticsReaderPage: React.FC = () => {
  const screens = useBreakpoint();
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
  const [outlineExpandedKeys, setOutlineExpandedKeys] = useState<string[]>([]);

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
      showMessage.error(msg);
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
      showMessage.error(msg);
    } finally {
      if (renderTokenRef.current === token) setPdfLoading(false);
    }
  }, []);

  const handleManualRefresh = useCallback(async () => {
    await loadList();
    if (selectedId) {
      await loadNote(selectedId);
    }
  }, [loadList, selectedId, loadNote]);

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
            title: <span className="font-medium text-text-secondary">{p}</span>,
            key: `cat:${curPath}`,
            children: [],
            icon: <Folder className="h-4 w-4" />,
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
        icon: <FileText className="h-4 w-4 text-text-tertiary" />,
        title: (
          <div className="flex min-w-0 flex-col text-left">
            <span className="block truncate text-sm font-medium text-text-base" title={sourceStem || it.title}>
              {sourceStem || it.title}
            </span>
            {it.title && sourceStem && it.title !== sourceStem ? (
              <span className="block truncate text-xs text-text-tertiary" title={it.title}>
                {it.title}
              </span>
            ) : null}
            {it.summary ? (
              <span className="block truncate text-xs text-text-tertiary" title={it.summary}>
                {it.summary}
              </span>
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
        isLeaf: true,
        title: (
          <div className="flex items-center gap-[var(--ws-space-1)] text-left">
            <span className="truncate text-sm" title={it.title}>{it.title}</span>
            <span className="text-xs text-text-tertiary">p{it.pageNumber}</span>
          </div>
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

  const collectBranchKeys = useCallback((nodes: TreeNode[]) => {
    const keys: string[] = [];
    const walk = (arr: TreeNode[]) => {
      arr.forEach((node) => {
        if (node.children?.length) {
          keys.push(String(node.key));
          walk(node.children);
        }
      });
    };
    walk(nodes);
    return keys;
  }, []);

  useEffect(() => {
    setOutlineExpandedKeys(collectBranchKeys(outlineTreeData));
  }, [outlineTreeData, collectBranchKeys]);

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
        const walk = async (list: any[], level: number) => {
          for (const it of list || []) {
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

  const handleDocSelect = useCallback((key: string) => {
    if (!key.startsWith("note:")) return;
    const noteId = Number(key.slice("note:".length));
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
  }, [isMobile, items]);

  const renderSearch = () => (
    <div className="mb-[var(--ws-space-2)] flex items-center gap-[var(--ws-space-1)]">
      <div className="relative flex-1 min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadList()}
          placeholder="搜索文档..."
          aria-label="搜索文档"
          className="pl-[var(--ws-search-input-padding-start)]"
        />
      </div>
      <Button
        onClick={() => {
          void handleManualRefresh();
        }}
        disabled={listLoading || pdfLoading}
        variant="outline"
        size="sm"
        className="h-9 w-9 shrink-0 px-0"
        aria-busy={listLoading || pdfLoading}
        aria-label="刷新文档列表"
      >
        {(listLoading || pdfLoading)
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <RotateCcw className="h-4 w-4" />}
      </Button>
    </div>
  );

  const renderDocTree = () => (
    <div className="informatics-scroll-container">
      {listLoading ? (
        <div className="space-y-[var(--ws-space-1)] p-[var(--ws-panel-padding)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="informatics-tree">
            {renderTreeNodes(treeData, {
              expandedKeys: docExpandedKeys,
              selectedKeys: selectedId ? [`note:${selectedId}`] : [],
              onToggle: (key) => {
                setDocExpandedKeys((prev) => {
                  if (prev.includes(key)) return prev.filter((it) => it !== key);
                  return [...prev, key];
                });
              },
              onSelect: handleDocSelect,
            })}
          </div>
          {items.length === 0 ? <EmptyState description="暂无已发布内容" className="mt-3" /> : null}
        </>
      )}
    </div>
  );

  const renderOutline = () => (
    <div className="informatics-scroll-container">
      {outline.length ? (
        <div className="informatics-tree informatics-outline-tree">
          {renderTreeNodes(outlineTreeData, {
            expandedKeys: outlineExpandedKeys,
            onToggle: (key) => {
              setOutlineExpandedKeys((prev) => {
                if (prev.includes(key)) return prev.filter((it) => it !== key);
                return [...prev, key];
              });
            },
            onSelect: (key) => {
              const page = outlinePageMap.get(key);
              if (page) {
                scrollToPage(page);
              }
            },
          })}
        </div>
      ) : (
        <div className="p-4 text-center text-sm text-text-tertiary">暂无目录</div>
      )}
    </div>
  );

  const renderLeftContent = () => (
    <div className="flex h-full flex-col">
      {renderSearch()}
        <Tabs defaultValue="docs" className="informatics-full-height-tabs">
          <TabsList className="grid w-full grid-cols-2 gap-[calc(var(--ws-space-1)/2)] rounded-lg bg-surface-2 p-[calc(var(--ws-space-1)/2)]">
          <TabsTrigger value="docs" className="w-full justify-center gap-[var(--ws-space-1)] text-[var(--ws-text-sm)] data-[state=active]:bg-primary-soft data-[state=active]:text-primary">
            <FileText className="h-4 w-4" />文档列表
          </TabsTrigger>
          <TabsTrigger value="outline" className="w-full justify-center gap-[var(--ws-space-1)] text-[var(--ws-text-sm)] data-[state=active]:bg-primary-soft data-[state=active]:text-primary">
            <List className="h-4 w-4" />目录大纲
          </TabsTrigger>
        </TabsList>
        <TabsContent value="docs" className="informatics-tab-content">
          {renderDocTree()}
        </TabsContent>
        <TabsContent value="outline" className="informatics-tab-content">
          {renderOutline()}
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderReader = () => (
    <div
      className="informatics-typst-viewer no-copy"
      ref={rightScrollRef}
      style={{ userSelect: "none", WebkitUserSelect: "none" } as any}
    >
      {pdfLoading ? (
        <div className="space-y-[var(--ws-layout-gap)] p-[var(--ws-panel-padding)]">
          <div className="space-y-[var(--ws-space-1)]">
            <Skeleton className="h-6 w-2/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
          </div>
          <div className="space-y-[var(--ws-space-1)]">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-10/12" />
          </div>
        </div>
      ) : null}
      {!pdfLoading && pdfError ? (
        <div className="p-3">
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>文档编译失败</AlertTitle>
            <AlertDescription>
              <pre className="mb-0 whitespace-pre-wrap">{pdfError}</pre>
            </AlertDescription>
          </Alert>
          <div className="h-2.5" />
          <div className="text-sm text-text-secondary">
            提示：通常是缺少图片资源（例如 images/a.png）或导入路径不正确，请在管理端上传资源或修正文档引用。
          </div>
        </div>
      ) : null}
      <div className={pdfLoading ? "hidden" : "block"}>
        <PdfCanvasVirtualViewer ref={viewerRef} data={pdfData} rootRef={rightScrollRef} onPdfLoaded={handlePdfLoaded} />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col p-3" style={{ maxWidth: "var(--ws-shell-max-width)" }}>
        {selectedId ? (
          <div className="flex h-full flex-col">
            <div className="sticky top-0 z-sticky flex flex-shrink-0 items-center gap-[var(--ws-space-1)] bg-surface border-b border-[var(--ws-color-border-secondary)] px-[var(--ws-space-2)] py-[var(--ws-space-1)]">
              <Button variant="ghost" onClick={() => setSelectedId(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="flex-1 truncate text-base font-semibold text-text-base" title={items.find((x) => x.id === selectedId)?.title || "内容"}>
                {items.find((x) => x.id === selectedId)?.title || "内容"}
              </span>
              <Button variant="ghost" onClick={() => setMobileDrawerOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
            </div>
            <div className="informatics-mobile-content">{renderReader()}</div>

            <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
              <SheetContent side="left" className="w-[min(85%,22rem)] p-0 sm:max-w-none">
                <SheetHeader className="border-b border-border px-4 py-3">
                  <SheetTitle className="text-left text-lg">导航</SheetTitle>
                </SheetHeader>
                <div className="h-full min-h-0 p-[var(--ws-space-2)]">{renderLeftContent()}</div>
              </SheetContent>
            </Sheet>
          </div>
        ) : (
          <div className="flex h-full flex-col p-[var(--ws-space-2)]">{renderLeftContent()}</div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full flex-1 flex-col p-3" style={{ maxWidth: "var(--ws-shell-max-width)" }}>
      <SplitPanePage
        leftWidth={320}
        alignItems="stretch"
        left={
          <PanelCard bodyPadding="var(--ws-panel-padding-sm)">
            {renderLeftContent()}
          </PanelCard>
        }
        right={
          <PanelCard
            title={<span className="text-base font-semibold text-text-base">{selectedId ? items.find((x) => x.id === selectedId)?.title || "内容" : "内容"}</span>}
            bodyPadding="var(--ws-panel-padding-sm)"
          >
            {renderReader()}
          </PanelCard>
        }
      />
    </div>
  );
};

export default InformaticsReaderPage;
