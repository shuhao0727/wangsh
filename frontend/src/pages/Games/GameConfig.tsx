/**
 * 小游戏管理 — 密码池配置
 */
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Hash, Type, Asterisk } from "lucide-react";
import { showMessage } from "@/lib/toast";

const STORAGE_KEY = "wangsh_game_lock_pools";

const DEFAULT_POOLS = {
  numeric: ["3829","1056","7491","2580","6307","9142","0073","4816"],
  alpha:   ["a7k2","x9m4","b3t8","k5p1","w2n9","r8j3"],
  mixed:   ["#4!2","@9$5","&7*3","!2@4","$7#1"],
};

const LOCK_META = [
  { key:"numeric", title:"数字锁", desc:"纯数字密码", icon:<Hash className="h-5 w-5"/>, color:"#0D9488", hint:"仅数字 0-9，长度不限", example:"3829" },
  { key:"alpha",   title:"字母数字锁", desc:"字母+数字混合", icon:<Type className="h-5 w-5"/>, color:"#F59E0B", hint:"字母+数字，长度不限", example:"a7k2" },
  { key:"mixed",   title:"特殊字符锁", desc:"特殊字符+字母+数字", icon:<Asterisk className="h-5 w-5"/>, color:"#7C3AED", hint:"含特殊字符!@#$%^&*等", example:"#4!2" },
] as const;

const GameConfigPage: React.FC = () => {
  const [pools, setPools] = useState(DEFAULT_POOLS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPools(JSON.parse(saved));
    } catch {}
  }, []);

  const updatePool = (key: string, value: string) => {
    const items = value.split(/[,，\s]+/).filter(Boolean);
    setPools(prev => ({ ...prev, [key]: items }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pools));
    showMessage.success("密码池已保存");
  };

  return (
    <div className="min-h-screen bg-[var(--ws-color-bg)]">
      <header className="border-b border-border-secondary bg-surface px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => window.close()}>
            <ArrowLeft className="h-4 w-4 mr-1"/>返回
          </Button>
          <span className="text-sm font-semibold">小游戏管理 · 密码池配置</span>
        </div>
        <Button size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-1"/>保存
        </Button>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-lg font-bold">密码锁破解 · 密码池设置</h2>
          <p className="text-sm text-text-tertiary mt-1">设置三种锁类型的密码池，每行一个或多个（逗号/空格分隔）。学生游戏时随机抽取。</p>
        </div>
        {LOCK_META.map(lock => (
          <div key={lock.key} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-3">
              <span style={{color:lock.color}}>{lock.icon}</span>
              <h3 className="font-semibold">{lock.title}</h3>
              <span className="text-xs text-text-tertiary">{lock.desc}</span>
            </div>
            <textarea
              className="w-full h-24 resize-y rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ws-color-focus-ring)]"
              value={(pools[lock.key as keyof typeof pools] || []).join(", ")}
              onChange={e => updatePool(lock.key, e.target.value)}
              placeholder={lock.example}
            />
            <div className="mt-1 text-xs text-text-tertiary">{lock.hint} · 当前 {pools[lock.key as keyof typeof pools]?.length || 0} 个密码</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameConfigPage;
