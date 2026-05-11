/**
 * 思维导图管理器 — 我的导图 + 导图广场
 */
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Globe, ArrowLeft, BookOpen } from "lucide-react";
import { showMessage } from "@/lib/toast";
import MindMapViewer from "./MindMapViewer";
import InteractiveMindMapEditor from "./InteractiveMindMapEditor";

type MindmapItem = {
  id: number;
  title: string;
  content: { markdown?: string };
  owner_id: number | null;
  created_at: string;
  updated_at: string;
  module_key: string;
};

const API_BASE = "/api/v1/learning/mindmaps";

const MindMapManager: React.FC = () => {
  const [tab, setTab] = useState("my");
  const [myMaps, setMyMaps] = useState<MindmapItem[]>([]);
  const [pubMaps, setPubMaps] = useState<MindmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 新建弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // 编辑
  const [editing, setEditing] = useState<MindmapItem | null>(null);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<MindmapItem | null>(null);

  const fetchMy = useCallback(async () => {
    try {
      const res = await fetch(API_BASE + "/my", { credentials: "include" });
      if (res.ok) setMyMaps(await res.json());
    } catch {}
  }, []);

  const fetchPub = useCallback(async () => {
    try {
      const res = await fetch(API_BASE, { credentials: "include" });
      if (res.ok) setPubMaps(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchMy(), fetchPub()]);
      setLoading(false);
    })();
  }, [fetchMy, fetchPub]);

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
        setEditing(item);
        await fetchMy();
      } else {
        showMessage.error("创建失败");
      }
    } catch {
      showMessage.error("创建失败");
    }
    setCreating(false);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        showMessage.success("已删除");
        setDeleteTarget(null);
        await fetchMy();
      } else {
        showMessage.error("删除失败");
      }
    } catch {
      showMessage.error("删除失败");
    }
  };

  const handlePublish = async (item: MindmapItem) => {
    try {
      const res = await fetch(`${API_BASE}/${item.id}/publish`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        showMessage.success(item.owner_id === null ? "已取消发布" : "已发布到广场");
        await Promise.all([fetchMy(), fetchPub()]);
      } else {
        showMessage.error("操作失败");
      }
    } catch {
      showMessage.error("操作失败");
    }
  };

  const handleSaved = async () => {
    setEditing(null);
    await fetchMy();
  };

  // 全屏编辑模式
  if (editing) {
    return (
      <InteractiveMindMapEditor
        mindmapId={editing.id}
        initialTitle={editing.title}
        initialMarkdown={editing.content?.markdown || ""}
        onBack={handleSaved}
        onSaved={handleSaved}
      />
    );
  }

  const renderCard = (item: MindmapItem, isMine: boolean) => (
    <div
      key={item.id}
      className="group relative flex flex-col rounded-lg border border-border bg-surface transition-shadow hover:shadow-md"
    >
      {/* 缩略预览 */}
      <div
        className="h-40 w-full overflow-hidden rounded-t-lg border-b border-border bg-surface-2 p-2"
        onClick={() => setEditing(item)}
        style={{ cursor: "pointer" }}
      >
        <MindMapViewer markdown={item.content?.markdown || `# ${item.title}`} />
      </div>

      {/* 底部信息 */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.title}>{item.title}</p>
          <p className="text-xs text-text-tertiary">
            {new Date(item.updated_at).toLocaleDateString("zh-CN")}
          </p>
        </div>

        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {isMine && (
            <>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => setEditing(item)} title="编辑">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                onClick={() => setDeleteTarget(item)} title="删除">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {!isMine && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => handlePublish(item)} title="取消发布">
              <Globe className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => window.history.back()}>
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <h2 className="text-sm font-semibold">思维导图管理</h2>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />新建导图
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 w-fit">
          <TabsTrigger value="my" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />我的导图 ({myMaps.length})
          </TabsTrigger>
          <TabsTrigger value="pub" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />导图广场 ({pubMaps.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="flex-1 overflow-auto px-4 pb-4 pt-3 outline-none">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
            </div>
          ) : myMaps.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-text-tertiary">
              <BookOpen className="mb-2 h-8 w-8" />
              <p className="text-sm">还没有导图，点击右上角「新建导图」开始创作</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {myMaps.map((m) => renderCard(m, true))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pub" className="flex-1 overflow-auto px-4 pb-4 pt-3 outline-none">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
            </div>
          ) : pubMaps.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-text-tertiary">
              <Globe className="mb-2 h-8 w-8" />
              <p className="text-sm">导图广场暂无内容</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pubMaps.map((m) => renderCard(m, false))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 新建弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>新建思维导图</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="mm-title">导图标题</Label>
            <Input
              id="mm-title"
              placeholder="例如：机器学习知识体系"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? "创建中..." : "创建并编辑"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            确定要删除「{deleteTarget?.title}」吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget.id)}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MindMapManager;
