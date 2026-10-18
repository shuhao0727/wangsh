/**
 * GamesRepo — 游戏资源库页面
 *
 * 路由: /it-technology/games
 * 功能: 浏览游戏资源库、按分类筛选、搜索、查看详情、下载（需登录）
 * 仅展示页：管理操作（上传/编辑/删除）已移至后台
 */

import React, { useState } from "react";
import {
  ArrowLeft,
  Gamepad2,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import EmptyState from "@components/Common/EmptyState";
import { GameCard } from "./components/GameCard";
import { GameDetailModal } from "./components/GameDetailModal";
import type { GameResource } from "@services/it/games";
import { useDebounce } from "@hooks/useDebounce";
import {
  useITGameCategoriesQuery,
  useITGamesQuery,
} from "@hooks/queries/useITGamesQuery";

// 预设分类：与 GameUploadModal 的 PRESET_CATEGORIES 保持一致，
// 确保 DB 为空时下拉仍能看到全部分类，方便浏览
const PRESET_CATEGORIES = ["益智", "动作", "冒险", "模拟", "策略", "竞速", "工具", "其它"];

const GamesRepoPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  // 300ms 防抖：输入框受控使用 search，API 调用使用 debouncedSearch，避免每次按键都发请求
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState("__all__");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 弹窗状态（仅详情）
  const [selectedGame, setSelectedGame] = useState<GameResource | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const listQuery = useITGamesQuery({
    category: category === "__all__" ? undefined : category,
    search: debouncedSearch || undefined,
    page,
    size: pageSize,
  });
  const categoriesQuery = useITGameCategoriesQuery();
  const games = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const categories = categoriesQuery.data?.categories ?? [];
  const loading = listQuery.isLoading || categoriesQuery.isLoading;

  const handleSelect = (game: GameResource) => {
    setSelectedGame(game);
    setDetailOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="it-games-page w-full flex-1 mx-auto px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)] flex flex-col" style={{ maxWidth: "var(--ws-shell-max-width)" }}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--ws-color-border-secondary)] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/it-technology")} aria-label="返回信息技术">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">信息技术</span>
          </Button>
          <span className="h-5 border-l border-[var(--ws-color-border-secondary)]" aria-hidden="true" />
          <div className="flex min-w-0 items-center gap-2">
            <Gamepad2 className="h-4 w-4 shrink-0 text-primary" />
            <h1 className="truncate text-base font-semibold text-text-base">游戏资源库</h1>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1 sm:justify-end">
          <div className="relative min-w-[calc(var(--ws-space-unit)*45)] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <Input
              className="h-9 pl-[var(--ws-search-input-padding-start)] text-sm"
              value={search}
              placeholder="搜索游戏名称..."
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              aria-label="搜索游戏名称"
            />
          </div>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-36 text-sm" aria-label="按分类筛选游戏">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部分类</SelectItem>
              {Array.from(new Set([...PRESET_CATEGORIES, ...categories])).sort().map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            disabled={listQuery.isFetching}
            onClick={() => void listQuery.refetch()}
            aria-label="刷新游戏资源"
            title="刷新"
          >
            {listQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* 游戏网格 */}
      {loading ? (
        <div className="grid grid-cols-1 gap-x-[var(--ws-space-3)] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-border p-5 space-y-3">
              <Skeleton className="h-14 w-14 rounded-xl" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : listQuery.isError || categoriesQuery.isError ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            variant="error"
            description="游戏资源加载失败"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void listQuery.refetch();
                  void categoriesQuery.refetch();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重试
              </Button>
            }
          />
        </div>
      ) : games.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState description="暂无游戏资源" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-[var(--ws-space-3)] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {games.map((g) => (
              <div key={g.id} className="relative group">
                <GameCard game={g} onSelect={handleSelect} />
              </div>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <span className="text-xs text-text-tertiary">共 {total} 个游戏</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  上一页
                </Button>
                <span className="text-xs text-text-tertiary">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 弹窗 */}
      <GameDetailModal open={detailOpen} onClose={() => setDetailOpen(false)} game={selectedGame} />
    </div>
  );
};

export default GamesRepoPage;
