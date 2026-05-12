/**
 * 公共思维导图广场 + 我的导图
 * 编辑在新标签页打开 Demo，预览独立页面
 */
import React, { useCallback, useEffect, useState } from "react";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPub = useCallback(async () => {
    try {
      const res = await fetch(API_BASE, { headers: authHeaders(), credentials: "include" });
      if (res.ok) setPubMaps(await res.json());
    } catch {}
  }, []);

  const fetchMy = useCallback(async () => {
    try {
      const res = await fetch(API_BASE + "/my", { headers: authHeaders(), credentials: "include" });
      if (res.ok) setMyMaps(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await Promise.all([fetchPub(), fetchMy()]); setLoading(false); })();
  }, [fetchPub, fetchMy]);

  // 页面聚焦时自动刷新（编辑新标签页返回后）
  useEffect(() => {
    const onFocus = () => { fetchMy(); fetchPub(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchMy, fetchPub]);

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
        await fetchMy(); setTab("my");
      } else { showMessage.error("创建失败，请先登录"); }
    } catch { showMessage.error("创建失败"); }
    setCreating(false);
  };

  const handleEdit = async (item: MindmapItem) => {
    // 写入数据到 localStorage
    const title = item.title || "未命名";
    const md = item.content?.markdown || `# ${title}`;
    localStorage.setItem("_wangsh_mindmap_data", JSON.stringify({
      root: parseMarkdownToTree(md, title),
      theme: { template: "classic4", config: {} },
      layout: "logicalStructure", config: {}, view: null,
    }));
    window.open(`/mindmap-demo/index.html?id=${item.id}`, "_blank");
  };

  const handlePreview = (item: MindmapItem) => {
    localStorage.setItem("_wangsh_preview_data", JSON.stringify(item));
    window.open(`/mindmap-preview?id=${item.id}`, "_blank");
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE", headers: authHeaders(), credentials: "include",
      });
      if (res.ok) { showMessage.success("已删除"); await fetchMy(); }
      else showMessage.error("删除失败");
    } catch { showMessage.error("删除失败"); }
  };

  const renderCard = (item: MindmapItem, isMine: boolean) => (
    <div key={item.id} className="group relative rounded-lg border border-border bg-surface transition-shadow hover:shadow-md">
      <div className="h-40 w-full cursor-pointer overflow-hidden rounded-t-lg border-b border-border bg-surface-2 p-2"
        onClick={() => handleEdit(item)}>
        <MindMapViewer markdown={item.content?.markdown || `# ${item.title}`} />
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
              onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} title="删除">
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
          : pubMaps.length === 0 ? <Empty icon={<Globe className="h-12 w-12" />} text="导图广场暂无内容" />
          : <Grid>{pubMaps.map(m => renderCard(m, false))}</Grid>}
        </TabsContent>

        <TabsContent value="my" className="flex-1 overflow-auto outline-none">
          {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-text-tertiary" /></div>
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

const Empty: React.FC<{ icon: React.ReactNode; text: string; action?: string; onAction?: () => void }> = ({ icon, text, action, onAction }) => (
  <div className="flex h-40 flex-col items-center justify-center text-text-tertiary">
    {icon}
    <p className="mt-3 text-sm">{text}</p>
    {action && <Button variant="link" size="sm" className="mt-2" onClick={onAction}>{action}</Button>}
  </div>
);

function parseMarkdownToTree(md: string, rootText: string) {
  const lines = md.split("\n").filter(l => l.trim());
  const root: any = { data: { text: rootText }, children: [] };
  const stack: { level: number; node: any }[] = [{ level: 0, node: root }];
  for (const line of lines) {
    const m = line.match(/^(#+)\s+(.+)/); if (!m) continue;
    const child: any = { data: { text: m[2].trim() }, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= m[1].length) stack.pop();
    if (stack.length > 0) stack[stack.length - 1].node.children.push(child);
    stack.push({ level: m[1].length, node: child });
  }
  return root;
}

export default MindmapGallery;
