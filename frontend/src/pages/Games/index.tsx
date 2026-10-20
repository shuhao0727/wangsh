/**
 * Interactive lesson and game launcher.
 */
import React, { useState } from "react";
import { ArrowLeft, ArrowUpRight, ClipboardList, Lock, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GAMES = [
  {
    id: "knn",
    title: "KNN 运动习惯采集",
    desc: "填写运动习惯与运动意向，为课堂 KNN 实验准备数据",
    icon: <ClipboardList className="h-6 w-6" />,
    color: "var(--ws-color-primary)",
    href: "/games/knn",
  },
  {
    id: "ai-partner",
    title: "召唤一名AI同学",
    desc: "通过三维选型课堂，体验 AI 同学的选择与协作",
    icon: <Sparkles className="h-6 w-6" />,
    color: "var(--ws-color-primary)",
    href: "/games/ai-partner/index.html",
  },
  {
    id: "lock-cracker",
    title: "密码锁破解",
    desc: "理解枚举法，系统地尝试所有可能的密码组合",
    icon: <Lock className="h-6 w-6" />,
    color: "var(--ws-color-warning)",
    href: "/games/lock-cracker",
  },
];

const GamesPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLocaleLowerCase();
  const games = GAMES.filter(game => `${game.title} ${game.desc}`.toLocaleLowerCase().includes(needle));
  return <div className="h-dvh overflow-y-auto bg-bg">
    <header className="flex h-12 items-center border-b border-border-secondary bg-surface px-4 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回
      </Button>
      <span className="ml-3 text-sm font-medium text-text-secondary">公开课</span>
    </header>

    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border-secondary pb-3">
        <h1 className="text-lg font-semibold text-text-base">互动课程</h1>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-72">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input aria-label="搜索互动课程" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索课程名称或内容" className="pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none" />
            {search && <Button variant="ghost" size="icon" aria-label="清除搜索" onClick={() => setSearch("")} className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"><X className="h-3.5 w-3.5" /></Button>}
          </div>
          <span aria-live="polite" className="shrink-0 text-xs text-text-tertiary">{needle ? `${games.length} / ${GAMES.length}` : GAMES.length} 项</span>
        </div>
      </div>

      <div className="divide-y divide-border-secondary border-y border-border-secondary">
        {games.map((game) => (
          <a
            key={game.id}
            href={game.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-24 items-center gap-4 px-2 py-4 transition-colors hover:bg-[var(--ws-color-workspace-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-3"
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-primary-soft"
              style={{ color: game.color }}
            >
              {game.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-text-base group-hover:text-primary">
                {game.title}
              </span>
              <span className="mt-1 block text-xs leading-5 text-text-secondary">
                {game.desc}
              </span>
            </span>
            <ArrowUpRight
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-text-tertiary transition-colors group-hover:text-primary"
            />
          </a>
        ))}
        {!games.length && <div className="py-12 text-center text-sm text-text-secondary" role="status"><p>没有匹配的互动课程</p><Button variant="link" className="mt-2" onClick={() => setSearch("")}>清除搜索</Button></div>}
      </div>
    </main>
  </div>;
};

export default GamesPage;
