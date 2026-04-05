import React, { useCallback, useEffect, useState } from "react";
import { Code, ChevronRight, Search, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyState from "@components/Common/EmptyState";
import { useNavigate } from "react-router-dom";
import { publicTypstNotesApi } from "@services";
import type { PublicTypstNoteListItem } from "@services";
import "./Informatics.css";

const InformaticsNotesPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PublicTypstNoteListItem[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await publicTypstNotesApi.list({ limit: 100, search: search.trim() || undefined });
      setItems(res || []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, []);

  return (
    <div className="informatics-page">
      {/* Hero 头部 */}
      <div className="informatics-hero">
        <div>
          <div className="flex items-center gap-2 text-xl font-bold text-primary">
            <Code className="h-5 w-5" />
            <span>信息学竞赛</span>
          </div>
          <div className="text-sm mt-1 text-text-secondary">
            整理的 Typst 笔记与讲义（已发布内容）
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="搜索标题"
              className="pl-9 w-[220px]"
            />
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            搜索
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="informatics-content">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <EmptyState description="暂无已发布内容" />
          </div>
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {items.map((it) => (
              <div
                key={it.id}
                className="informatics-note-card group rounded-lg p-4 cursor-pointer"
                onClick={() => navigate(`/informatics/${it.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-sm leading-snug flex-1 pr-2 text-text-base">
                    {it.title}
                  </div>
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 text-primary" />
                </div>
                <div className="text-xs leading-relaxed mb-2.5 line-clamp-2 text-text-secondary min-h-[28px]">
                  {it.summary || "暂无简介"}
                </div>
                <div className="flex items-center gap-1 text-xs text-text-tertiary">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(it.updated_at).toLocaleDateString("zh-CN")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InformaticsNotesPage;
