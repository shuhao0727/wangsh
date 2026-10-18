/**
 * 小游戏管理 — 密码池配置
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Hash, Type, Asterisk } from "lucide-react";
import { showMessage } from "@/lib/toast";

const STORAGE_KEY = "wangsh_game_lock_pools";

const DEFAULT_POOLS = {
  numeric: ["3829","1056","7491","2580","6307","9142","0073","4816"],
  alpha:   ["a7k2","x9m4","b3t8","k5p1","w2n9","r8j3"],
  mixed:   ["#4!2","@9$5","&7*3","!2@4","$7#1"],
};

const LOCK_META = [
  { key:"numeric", title:"数字锁", desc:"纯数字密码", icon:<Hash className="h-5 w-5"/>, color:"var(--ws-color-primary)", hint:"仅数字 0-9，长度不限", example:"3829" },
  { key:"alpha",   title:"字母数字锁", desc:"字母+数字混合", icon:<Type className="h-5 w-5"/>, color:"var(--ws-color-warning)", hint:"字母+数字，长度不限", example:"a7k2" },
  { key:"mixed",   title:"特殊字符锁", desc:"特殊字符+字母+数字", icon:<Asterisk className="h-5 w-5"/>, color:"var(--ws-color-secondary)", hint:"含特殊字符!@#$%^&*等", example:"#4!2" },
] as const;

const GameConfigPage: React.FC = () => {
  const navigate = useNavigate();
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
    <div className="ws-game-config-shell">
      <header className="ws-game-config-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8" onClick={() => navigate("/admin/it-technology")}>
            <ArrowLeft className="h-4 w-4 mr-1"/>返回
          </Button>
          <h1 className="text-sm font-semibold">密码锁破解 · 密码池配置</h1>
        </div>
        <Button size="sm" className="h-8 shrink-0" onClick={handleSave}>
          <Save className="h-4 w-4 mr-1"/>保存
        </Button>
      </header>
      <div className="ws-game-config-main">
        <p className="pb-4 text-sm text-text-secondary">每行一个密码，也可用逗号或空格分隔。</p>
        {LOCK_META.map(lock => (
          <div key={lock.key} className="ws-game-lock-section">
            <div className="ws-game-lock-label flex flex-wrap items-center gap-2">
              <span style={{color:lock.color}}>{lock.icon}</span>
              <label htmlFor={`pool-${lock.key}`} className="text-sm font-semibold">{lock.title}</label>
              <span className="text-xs text-text-tertiary">{pools[lock.key]?.length || 0} 个</span>
            </div>
            <Textarea
              id={`pool-${lock.key}`}
              className="h-28 min-w-0 resize-y font-mono text-sm"
              value={(pools[lock.key as keyof typeof pools] || []).join(", ")}
              onChange={e => updatePool(lock.key, e.target.value)}
              placeholder={lock.example}
            />
            <p className="ws-game-lock-hint text-xs leading-relaxed text-text-tertiary">{lock.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameConfigPage;
