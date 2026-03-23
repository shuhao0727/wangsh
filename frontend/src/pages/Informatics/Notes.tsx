import React, { useCallback, useEffect, useState } from "react";
import { Button, Empty, Input, Spin } from "antd";
import { CodeOutlined, RightOutlined, SearchOutlined, ClockCircleOutlined } from "@ant-design/icons";
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
          <div className="flex items-center gap-2 text-2xl font-bold text-primary">
            <CodeOutlined />
            <span>信息学竞赛</span>
          </div>
          <div className="text-sm mt-1 text-text-secondary">
            整理的 Typst 笔记与讲义（已发布内容）
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={load}
            placeholder="搜索标题"
            allowClear
            style={{ width: 240 }}
            prefix={<SearchOutlined />}
          />
          <Button onClick={load} loading={loading}>搜索</Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="informatics-content">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spin size="large" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Empty description="暂无已发布内容" />
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {items.map((it) => (
              <div
                key={it.id}
                className="informatics-note-card group rounded-xl p-5 cursor-pointer"
                onClick={() => navigate(`/informatics/${it.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-sm leading-snug flex-1 pr-2 text-text-base">
                    {it.title}
                  </div>
                  <RightOutlined className="opacity-0 group-hover:opacity-100 transition-opacity text-xs flex-shrink-0 mt-0.5 text-primary" />
                </div>
                <div className="text-xs leading-relaxed mb-3 line-clamp-2 text-text-secondary min-h-[32px]">
                  {it.summary || "暂无简介"}
                </div>
                <div className="flex items-center gap-1 text-xs text-text-tertiary">
                  <ClockCircleOutlined />
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
