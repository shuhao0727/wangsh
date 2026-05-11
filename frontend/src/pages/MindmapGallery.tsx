/**
 * 公共思维导图广场 + 我的导图
 */
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Globe, BookOpen, Plus, Pencil, Eye } from "lucide-react";
import { showMessage } from "@/lib/toast";
import MindMapViewer from "./Admin/ITTechnology/learning/MindMapViewer";
import MindMapEditor from "./Admin/ITTechnology/learning/MindMapEditor";

type MindmapItem = {
  id: number;
  title: string;
  content: { markdown?: string };
  updated_at: string;
};

const API_BASE = "/api/v1/learning/mindmaps";

const MindmapGallery: React.FC = () => {
  const [tab, setTab] = useState("pub");
  const [pubMaps, setPubMaps] = useState<MindmapItem[]>([]);
  const [myMaps, setMyMaps] = useState<MindmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 查看导图全屏
  const [viewing, setViewing] = useState<MindmapItem | null>(null);

  // 编辑导图
  const [editing, setEditing] = useState<MindmapItem | null>(null);

  // 新建弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPub = useCallback(async () => {
    try {
      const res = await fetch(API_BASE, { credentials: "include" });
      if (res.ok) setPubMaps(await res.json());
    } catch {}
  }, []);

  const fetchMy = useCallback(async () => {
    try {
      const res = await fetch(API_BASE + "/my", { credentials: "include" });
      if (res.ok) setMyMaps(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchPub(), fetchMy()]);
      setLoading(false);
    })();
  }, [fetchPub, fetchMy]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newTitle.trim(), content: { markdown: `# ${newTitle.trim()}\n` } }),
      });
      if (res.ok) {
        showMessage.success("创建成功");
        setCreateOpen(false);
        setNewTitle("");
        const item = await res.json();
        await fetchMy();
        setTab("my");
        setEditing(item);
      } else {
        showMessage.error("创建失败，请先登录");
      }
    } catch {
      showMessage.error("创建失败");
    }
    setCreating(false);
  };

  const handleSaved = async () => {
    setEditing(null);
    await fetchMy();
  };

  const handleView = (item: MindmapItem) => setViewing(item);

  // 全屏查看
  if (viewing && !editing) {
    return (
      <div className="flex h-full flex-col bg-surface">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => setViewing(null)}>
            ← 返回广场
          </Button>
          <h2 className="text-sm font-semibold">{viewing.title}</h2>
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
              onClick={() => { setEditing(viewing); }}>
              <Pencil className="h-3 w-3" />编辑
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 p-4">
          <MindMapViewer markdown={viewing.content?.markdown || `# ${viewing.title}`} />
        </div>
      </div>
    );
  }

  // 全屏编辑
  if (editing) {
    return (
      <MindMapEditor
        mindmapId={editing.id}
        initialTitle={editing.title}
        initialMarkdown={editing.content?.markdown || ""}
        onBack={handleSaved}
        onSaved={handleSaved}
      />
    );
  }

  const renderCard = (item: MindmapItem, isMine: boolean) => (
    <div key={item.id} className="group relative rounded-lg border border-border bg-surface transition-shadow hover:shadow-md">
      <div className="h-40 w-full cursor-pointer overflow-hidden rounded-t-lg border-b border-border bg-surface-2 p-2"
        onClick={() => handleView(item)}>
        <MindMapViewer markdown={item.content?.markdown || `# ${item.title}`} />
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="text-xs text-text-tertiary">{new Date(item.updated_at).toLocaleDateString("zh-CN")}</p>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
            onClick={() => handleView(item)} title="查看">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {isMine && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => setEditing(item)} title="编辑">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)]">
      {/* Header */}
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
          <TabsTrigger value="pub" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />导图广场 ({pubMaps.length})
          </TabsTrigger>
          <TabsTrigger value="my" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />我的导图 ({myMaps.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pub" className="flex-1 overflow-auto outline-none">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-text-tertiary" /></div>
          ) : pubMaps.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-text-tertiary">
              <Globe className="mb-3 h-12 w-12" /><p className="text-sm">导图广场暂无内容</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pubMaps.map((m) => renderCard(m, false))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my" className="flex-1 overflow-auto outline-none">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-text-tertiary" /></div>
          ) : myMaps.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-text-tertiary">
              <BookOpen className="mb-3 h-12 w-12" />
              <p className="text-sm">还没有导图</p>
              <Button variant="link" size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>创建第一个导图</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myMaps.map((m) => renderCard(m, true))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 新建弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>新建思维导图</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="mm-title">导图标题</Label>
            <Input id="mm-title" placeholder="例如：机器学习知识体系"
              value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
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

export default MindmapGallery;
