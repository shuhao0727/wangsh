/**
 * 密码锁破解游戏 — 枚举法教学
 * 三层难度固定：纯数字 / 字母数字 / 字母数字+特殊字符
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Lock, Unlock, Hash, Type, Asterisk, Search, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Password pools (base64 encoded, teacher-configurable) ──
const DEFAULT_POOLS = {
  numeric: ["3829","1056","7491","2580","6307","9142","0073","4816"],
  alpha: ["a7k2","x9m4","b3t8","k5p1","w2n9","r8j3"],
  mixed: ["#4!2","@9$5","&*3#","!2@4","$7#1"],
};

type LockType = "numeric" | "alpha" | "mixed";
type Attempt = { id: number; guess: string; method: string; correct: boolean };
type GameState = { id: number; time: string };

const LOCK_LABELS: Record<LockType, { name: string; desc: string; icon: React.ReactNode; color: string; charset: string }> = {
  numeric:    { name:"数字锁", desc:"纯数字 0-9", icon:<Hash className="h-5 w-5"/>, color:"var(--ws-color-primary)", charset:"0-9" },
  alpha:      { name:"字母数字锁", desc:"字母+数字", icon:<Type className="h-5 w-5"/>, color:"var(--ws-color-warning)", charset:"a-z 0-9" },
  mixed:      { name:"特殊字符锁", desc:"特殊字符+字母+数字", icon:<Asterisk className="h-5 w-5"/>, color:"var(--ws-color-accent)", charset:"a-z 0-9 !@#$%^&*" },
};

const METHODS = ["穷举法","模式分析","直觉猜测","已知信息推导"];

function loadPools() {
  try {
    const saved = localStorage.getItem("wangsh_game_lock_pools");
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_POOLS;
}

const LockCrackerPage: React.FC = () => {
  const [lockType, setLockType] = useState<LockType>("numeric");
  const [password, setPassword] = useState("");
  const [guess, setGuess] = useState("");
  const [method, setMethod] = useState("穷举法");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [result, setResult] = useState<{ msg: string; color: string } | null>(null);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now()-startTime)/1000)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTime]);

  const pickPassword = useCallback((type: LockType) => {
    const pool = loadPools()[type];
    setPassword(pool[Math.floor(Math.random()*pool.length)]);
    setAttempts([]); setUnlocked(false); setResult(null); setGuess("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => { pickPassword(lockType); }, [lockType, pickPassword]);

  const handleGuess = () => {
    const g = guess.trim();
    if (!g) { setResult({msg:"请输入密码!",color:"#F59E0B"}); return; }
    const correct = g === password;
    const entry: Attempt = { id: attempts.length+1, guess: g, method, correct };
    setAttempts(prev => [...prev, entry]);
    if (correct) { setUnlocked(true); setResult({msg:"🎉 密码正确！锁已打开！",color:"#22C55E"}); }
    else { setResult({msg:"❌ 密码错误，继续尝试",color:"#EF4444"}); setGuess(""); }
  };

  const total = attempts.length;
  const successes = attempts.filter(a=>a.correct).length;
  const rate = total>0 ? Math.round(successes/total*100) : 0;
  const fmtTime = (s:number) => { const m=Math.floor(s/60); return `${m}分${s%60}秒`; };
  const config = LOCK_LABELS[lockType];

  return (
    <div className="min-h-screen bg-[var(--ws-color-bg)] text-text-base flex flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-border-secondary bg-surface/95 px-6 py-3 flex items-center justify-between shadow-sm backdrop-blur">
        <Button variant="ghost" size="sm" className="text-text-secondary hover:bg-primary-soft hover:text-primary" onClick={() => window.close()}>
          <ArrowLeft className="h-4 w-4 mr-1"/>返回
        </Button>
        <div className="text-center">
          <h1 className="text-base font-bold text-text-base">🔐 密码锁破解</h1>
          <p className="text-xs text-text-tertiary">理解枚举法 · 系统性地尝试所有可能</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium text-text-secondary">
          <span>⏱ {fmtTime(elapsed)}</span>
          <span>{total} 次尝试</span>
        </div>
      </header>

      {/* Main: 3-column */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Lock type selector */}
        <aside className="w-[220px] shrink-0 border-r border-border-secondary p-4 flex flex-col gap-3 bg-surface">
          <div className="text-xs font-semibold text-text-tertiary mb-1">🔑 密码锁类型</div>
          {(Object.entries(LOCK_LABELS) as [LockType,typeof LOCK_LABELS['numeric']][]).map(([key,cfg]) => (
            <button key={key} onClick={() => setLockType(key)}
              className={`text-left rounded-lg p-3 border transition-all cursor-pointer ${
                lockType===key ? "bg-primary-soft border-primary shadow-sm" : "bg-surface-2 border-border-secondary hover:border-primary/40 hover:bg-primary-soft/40"
              }`}
            >
              <div className="flex items-center gap-2" style={{color:cfg.color}}>{cfg.icon}<span className="font-semibold text-sm text-text-base">{cfg.name}</span></div>
              <div className="text-[11px] text-text-tertiary mt-1">{cfg.desc} · {cfg.charset}</div>
            </button>
          ))}
          <div className="flex-1"/>
          <Button variant="ghost" size="sm" className="text-text-secondary hover:bg-primary-soft hover:text-primary w-full" onClick={() => pickPassword(lockType)}>
            <RefreshCw className="h-4 w-4 mr-1"/>换一把锁
          </Button>
        </aside>

        {/* Center: Game area */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 gap-6 bg-gradient-to-br from-[var(--ws-color-bg)] via-surface to-primary-soft/50">
          <div className="text-center">
            <div className="text-7xl mb-3">{unlocked ? <Unlock className="inline h-20 w-20 text-[var(--ws-color-success)]"/>:<Lock className="inline h-20 w-20 text-primary drop-shadow-sm"/>}</div>
            <div className="text-lg font-semibold text-text-base">{unlocked?"🔓 已破解!":config.name+" · 已锁定"}</div>
            <div className="text-xs text-text-tertiary mt-1">密码长度: {password.length} 位</div>
          </div>

          {/* Search space visualization */}
          <div className="w-full max-w-[420px] rounded-xl bg-surface border border-border-secondary p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-text-tertiary">搜索空间</span><span className="font-medium text-text-secondary">{total} / — 种</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{width:`${Math.min(total*0.5,100)}%`}}/>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-text-tertiary">
              <span><span className="inline-block w-2 h-2 rounded-full bg-border-secondary mr-1"/>未尝试</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-primary mr-1"/>已尝试</span>
              {unlocked && <span><span className="inline-block w-2 h-2 rounded-full bg-[var(--ws-color-success)] mr-1"/>正确答案</span>}
            </div>
          </div>

          {/* Input area */}
          {!unlocked && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)}
                  maxLength={password.length}
                  onKeyDown={e=>{if(e.key==="Enter")handleGuess();}}
                  className="h-14 w-[260px] rounded-xl border-2 border-primary/50 bg-surface text-center font-mono text-3xl font-bold tracking-[8px] text-text-base shadow-sm placeholder:text-text-tertiary focus:border-primary focus:ring-4 focus:ring-primary-soft"
                  placeholder={password.replace(/./g,"•")} />
                <Button onClick={handleGuess} className="h-14 px-6 bg-primary text-white hover:bg-primary/90">
                  <Search className="h-5 w-5 mr-1"/>尝试解锁
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-tertiary">破译方法:</span>
                <select value={method} onChange={e=>setMethod(e.target.value)}
                  className="bg-surface border border-border-secondary rounded px-2 py-1 text-text-base text-xs cursor-pointer focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft">
                  {METHODS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {result && <div className="text-sm font-semibold" style={{color:result.color}}>{result.msg}</div>}
            </div>
          )}
          {unlocked && (
            <Button onClick={()=>pickPassword(lockType)} className="bg-primary text-white hover:bg-primary/90">
              <RefreshCw className="h-4 w-4 mr-1"/>换一把锁，再来一次
            </Button>
          )}
        </main>

        {/* Right: History + Stats */}
        <aside className="w-[280px] shrink-0 border-l border-border-secondary p-4 bg-surface flex flex-col min-h-0">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <BarChart3 className="h-4 w-4 text-primary"/>尝试记录
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 text-xs font-mono mb-3">
            {attempts.length===0 && <div className="text-text-tertiary text-center py-8">还没有尝试记录</div>}
            {attempts.slice().reverse().map(a=>(
              <div key={a.id} className="flex items-center gap-2 py-1.5 border-b border-border-secondary">
                <span className="text-text-tertiary">#{a.id}</span>
                <span className="font-semibold text-text-base">{a.guess}</span>
                <span className="text-text-tertiary">{a.method}</span>
                <span>{a.correct?"✅":"❌"}</span>
              </div>
            ))}
          </div>
          <div className="shrink-0 rounded-xl bg-surface-2 border border-border-secondary p-3 text-xs space-y-1">
            <div className="text-text-tertiary font-semibold mb-1">📊 统计</div>
            <div>总尝试: <span className="text-text-base font-semibold">{total}</span></div>
            <div>成功: <span className="text-[var(--ws-color-success)] font-semibold">{successes}</span></div>
            <div>成功率: <span className="text-[var(--ws-color-warning)] font-semibold">{rate}%</span></div>
            <div>耗时: <span className="text-text-base">{fmtTime(elapsed)}</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default LockCrackerPage;
