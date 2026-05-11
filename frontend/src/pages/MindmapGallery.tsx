/**
 * 公共思维导图广场
 */
import React, { useEffect, useState } from "react";
import { Loader2, Globe, ExternalLink } from "lucide-react";
import MindMapViewer from "./Admin/ITTechnology/learning/MindMapViewer";

type MindmapItem = {
  id: number;
  title: string;
  content: { markdown?: string };
  updated_at: string;
};

const API_BASE = "/api/v1/learning/mindmaps";

const MindmapGallery: React.FC = () => {
  const [maps, setMaps] = useState<MindmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MindmapItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API_BASE, { credentials: "include" });
        if (res.ok) setMaps(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (selected) {
    return (
      <div className="flex h-full flex-col bg-surface">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <button
            onClick={() => setSelected(null)}
            className="text-sm text-text-secondary hover:text-text-base"
          >
            ← 返回广场
          </button>
          <h2 className="text-sm font-semibold">{selected.title}</h2>
        </div>
        <div className="flex-1 min-h-0 p-4">
          <MindMapViewer markdown={selected.content?.markdown || `# ${selected.title}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)]">
      <div className="mb-6">
        <h1 className="text-xl font-bold">思维导图广场</h1>
        <p className="mt-1 text-sm text-text-secondary">浏览已发布的公共思维导图</p>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
        </div>
      ) : maps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-text-tertiary">
          <Globe className="mb-3 h-12 w-12" />
          <p className="text-sm">导图广场暂无内容</p>
          <p className="mt-1 text-xs">管理员发布导图后将在这里展示</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((item) => (
            <div
              key={item.id}
              className="group cursor-pointer rounded-lg border border-border bg-surface p-4 transition-shadow hover:shadow-md"
              onClick={() => setSelected(item)}
            >
              <div className="mb-3 h-40 w-full overflow-hidden rounded border border-border bg-surface-2">
                <MindMapViewer markdown={item.content?.markdown || `# ${item.title}`} />
              </div>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-text-tertiary">
                    {new Date(item.updated_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MindmapGallery;
