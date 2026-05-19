/**
 * 小游戏列表页 /games
 */
import React from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const GAMES = [
  { id:"lock-cracker", title:"密码锁破解", desc:"理解枚举法——系统性地尝试所有可能组合，破解三种难度密码锁", icon:<Lock className="h-12 w-12"/>, color:"#F59E0B", href:"/games/lock-cracker", available:true },
];

const GamesPage: React.FC = () => (
  <div className="min-h-screen bg-[var(--ws-color-bg)]">
    <header className="border-b border-border-secondary bg-surface px-6 py-3 flex items-center">
      <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4 mr-1"/>返回
      </Button>
      <span className="ml-4 text-sm font-semibold">小游戏</span>
    </header>
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-lg font-bold mb-2">教学小游戏</h2>
      <p className="text-sm text-text-tertiary mb-6">通过互动游戏理解编程概念</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map(g => (
          <a key={g.id} href={g.href} target="_blank" rel="noopener noreferrer"
            className="rounded-xl border border-border bg-surface p-5 hover:border-[var(--ws-color-primary)]/30 hover:shadow-sm transition-all no-underline group">
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-16 h-16 rounded-xl flex items-center justify-center"
                style={{background:`${g.color}15`,color:g.color}}>{g.icon}</div>
              <div className="min-w-0">
                <h3 className="font-semibold text-text-base group-hover:text-primary transition-colors">{g.title}</h3>
                <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{g.desc}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  </div>
);

export default GamesPage;
