/**
 * 公共思维导图广场 + 我的导图
 * 编辑在新标签页打开 Demo，预览独立页面
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Globe, BookOpen, Plus, Pencil, Eye, Trash2 } from "lucide-react";
import { showMessage } from "@/lib/toast";
import MindMapViewer from "./Admin/ITTechnology/learning/MindMapViewer";
import { markdownToMindMapData } from "./Admin/ITTechnology/learning/mindMapData";

type MindmapItem = {
  id: number; title: string; content: { markdown?: string }; updated_at: string;
};

const API_BASE = "/api/v1/learning/mindmaps";
const TOKEN_KEY = "ws_access_token";

function getToken(): string | null { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); }
function authHeaders(): Record<string,string> {
  const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {};
}

const MindmapGallery: React.FC = () => {
  const [tab, setTab] = useState("pub");
  const [pubMaps, setPubMaps] = useState<MindmapItem[]>([]);
  const [myMaps, setMyMaps] = useState<MindmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [pubError, setPubError] = useState("");
  const [myError, setMyError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const refreshRequestRef = useRef(0);
  const refreshAbortRef = useRef<AbortController | null>(null);

  const fetchPub = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch(API_BASE, { credentials: "include", signal });
    if (!res.ok) throw new Error(`Failed to load public mindmaps: ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : []) as MindmapItem[];
  }, []);

  const fetchMy = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch(API_BASE + "/my", {
      headers: authHeaders(),
      credentials: "include",
      signal,
    });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`Failed to load personal mindmaps: ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : []) as MindmapItem[];
  }, []);

  const refreshMaps = useCallback(async (showLoading = false) => {
    const requestId = ++refreshRequestRef.current;
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    setPubError("");
    setMyError("");
    if (showLoading) setLoading(true);

    try {
      const [publicResult, myResult] = await Promise.allSettled([
        fetchPub(controller.signal),
        fetchMy(controller.signal),
      ]);
      if (requestId !== refreshRequestRef.current) return;

      const errors: string[] = [];
      if (publicResult.status === "fulfilled") {
        setPubMaps(publicResult.value);
      } else {
        const message = publicResult.reason instanceof Error
          ? publicResult.reason.message
          : "公共导图加载失败";
        setPubError(message);
        errors.push("公共导图加载失败");
      }
      if (myResult.status === "fulfilled") {
        const personalMaps = myResult.value;
        setAuthenticated(personalMaps !== null);
        setMyMaps(personalMaps ?? []);
      } else {
        const message = myResult.reason instanceof Error
          ? myResult.reason.message
          : "我的导图加载失败";
        setMyError(message);
        errors.push("我的导图加载失败");
      }
      if (errors.length > 0) {
        showMessage.error(errors.join("，"));
      }
    } catch (error) {
      if (
        requestId !== refreshRequestRef.current ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }
      const message = error instanceof Error ? error.message : "公共导图加载失败";
      setPubError(message);
      showMessage.error("公共导图加载失败");
    } finally {
      if (requestId === refreshRequestRef.current) {
        setLoading(false);
      }
    }
  }, [fetchMy, fetchPub]);

  useEffect(() => {
    void refreshMaps(true);
    return () => {
      refreshRequestRef.current += 1;
      refreshAbortRef.current?.abort();
    };
  }, [refreshMaps]);

  // 页面聚焦时自动刷新（编辑新标签页返回后）
  useEffect(() => {
    const onFocus = () => { void refreshMaps(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshMaps]);

  // 新建后在新标签页打开编辑
  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newTitle.trim(), content: { markdown: `# ${newTitle.trim()}\n` } }),
      });
      if (res.ok) {
        const item = await res.json();
        // 写入 localStorage 供 Demo 读取
        localStorage.setItem("_wangsh_mindmap_data", JSON.stringify({
          root: { data: { text: newTitle.trim() }, children: [] },
          theme: { template: "classic4", config: {} },
          layout: "logicalStructure", config: {}, view: null,
        }));
        window.open(`/mindmap-demo/index.html?id=${item.id}`, "_blank");
        setCreateOpen(false); setNewTitle("");
        await refreshMaps();
        setTab("my");
      } else if (res.status === 401) {
        setAuthenticated(false);
        showMessage.error("请先登录");
      } else { showMessage.error("创建失败"); }
    } catch { showMessage.error("创建失败"); }
    finally { setCreating(false); }
  };

  const handleEdit = (item: MindmapItem) => {
    // 写入数据到 localStorage
    const title = item.title || "未命名";
    const md = item.content?.markdown || `# ${title}`;
    localStorage.setItem("_wangsh_mindmap_data", JSON.stringify({
      root: markdownToMindMapData(md, title),
      theme: { template: "classic4", config: {} },
      layout: "logicalStructure", config: {}, view: null,
    }));
    window.open(`/mindmap-demo/index.html?id=${item.id}`, "_blank");
  };

  const handlePreview = (item: MindmapItem) => {
    const title = item.title || "未命名";
    const md = item.content?.markdown || `# ${title}`;
    localStorage.setItem("_wangsh_mindmap_data", JSON.stringify({
      root: markdownToMindMapData(md, title),
      theme: { template: "classic4", config: {} },
      layout: "logicalStructure", config: {}, view: null,
    }));
    window.open(`/mindmap-demo/index.html?id=${item.id}&readonly=1`, "_blank");
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE", headers: authHeaders(), credentials: "include",
      });
      if (res.ok) { showMessage.success("已删除"); await refreshMaps(); }
      else showMessage.error("删除失败");
    } catch { showMessage.error("删除失败"); }
  };

  const renderCard = (item: MindmapItem, isMine: boolean) => (
    <div key={item.id} className="group relative rounded-lg border border-border bg-surface transition-shadow hover:shadow-md">
      <div className="h-40 w-full cursor-pointer overflow-hidden rounded-t-lg border-b border-border bg-surface-2 p-2"
        onClick={() => handleEdit(item)}>
        <MindMapViewer compact markdown={item.content?.markdown || `# ${item.title}`} />
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="text-xs text-text-tertiary">{new Date(item.updated_at).toLocaleDateString("zh-CN")}</p>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
            onClick={(e) => { e.stopPropagation(); handlePreview(item); }} title="预览">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
            onClick={(e) => { e.stopPropagation(); handleEdit(item); }} title="编辑（新标签页）">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {isMine && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
              onClick={(e) => { e.stopPropagation(); void handleDelete(item.id); }} title="删除">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">思维导图</h1>
          <p className="mt-1 text-sm text-text-secondary">浏览导图广场或创作个人导图</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />新建导图
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mb-4 w-fit">
          <TabsTrigger value="pub" className="gap-1.5"><Globe className="h-3.5 w-3.5" />导图广场 ({pubMaps.length})</TabsTrigger>
          <TabsTrigger value="my" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" />我的导图 ({myMaps.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pub" className="flex-1 overflow-auto outline-none">
          {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-text-tertiary" /></div>
          : pubError ? <LoadError message={pubError} onRetry={() => void refreshMaps(true)} />
          : pubMaps.length === 0 ? <Empty icon={<Globe className="h-12 w-12" />} text="导图广场暂无内容" />
          : <Grid>{pubMaps.map(m => renderCard(m, false))}</Grid>}
        </TabsContent>

        <TabsContent value="my" className="flex-1 overflow-auto outline-none">
          {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-text-tertiary" /></div>
          : myError ? <LoadError message={myError} onRetry={() => void refreshMaps(true)} />
          : !authenticated ? <Empty icon={<BookOpen className="h-12 w-12" />} text="登录后查看我的导图" />
          : myMaps.length === 0 ? <Empty icon={<BookOpen className="h-12 w-12" />} text="还没有导图" action="创建第一个导图" onAction={() => setCreateOpen(true)} />
          : <Grid>{myMaps.map(m => renderCard(m, true))}</Grid>}
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>新建思维导图</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="mm-title">导图标题</Label>
            <Input id="mm-title" placeholder="例如：机器学习知识体系"
              value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? "创建中..." : "创建并编辑"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
);

const LoadError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div role="alert" className="flex h-40 flex-col items-center justify-center gap-3 text-destructive">
    <p className="text-sm">{message}</p>
    <Button variant="outline" size="sm" onClick={onRetry}>重新加载</Button>
  </div>
);

const Empty: React.FC<{ icon: React.ReactNode; text: string; action?: string; onAction?: () => void }> = ({ icon, text, action, onAction }) => (
  <div className="flex h-40 flex-col items-center justify-center text-text-tertiary">
    {icon}
    <p className="mt-3 text-sm">{text}</p>
    {action && <Button variant="link" size="sm" className="mt-2" onClick={onAction}>{action}</Button>}
  </div>
);

export default MindmapGallery;
