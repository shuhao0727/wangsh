/**
 * Interactive lesson and game launcher.
 */
import React from "react";
import { ArrowLeft, ArrowUpRight, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const GAMES = [
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

const GamesPage: React.FC = () => (
  <div className="min-h-dvh bg-bg">
    <header className="flex h-12 items-center border-b border-border-secondary bg-surface px-4 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回
      </Button>
      <span className="ml-3 text-sm font-medium text-text-secondary">公开课</span>
    </header>

    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between border-b border-border-secondary pb-3">
        <h1 className="text-lg font-semibold text-text-base">互动课程</h1>
        <span className="text-xs text-text-tertiary">{GAMES.length} 项</span>
      </div>

      <div className="divide-y divide-border-secondary border-y border-border-secondary">
        {GAMES.map((game) => (
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
      </div>
    </main>
  </div>
);

export default GamesPage;
