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
  numeric:    { name:"数字锁", desc:"纯数字 0-9", icon:<Hash className="h-5 w-5"/>, color:"#0D9488", charset:"0-9" },
  alpha:      { name:"字母数字锁", desc:"字母+数字", icon:<Type className="h-5 w-5"/>, color:"#F59E0B", charset:"a-z 0-9" },
  mixed:      { name:"特殊字符锁", desc:"特殊字符+字母+数字", icon:<Asterisk className="h-5 w-5"/>, color:"#7C3AED", charset:"a-z 0-9 !@#$%^&*" },
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

  useEffect(() => { pickPassword(lockType); }, [lockType]);
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
    <div className="min-h-screen bg-[#1a1a2e] text-[#e0e0e0] flex flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[#2a2a4a] px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="text-[#9090b0] hover:text-white" onClick={() => window.close()}>
          <ArrowLeft className="h-4 w-4 mr-1"/>返回
        </Button>
        <div className="text-center">
          <h1 className="text-base font-bold">🔐 密码锁破解</h1>
          <p className="text-xs text-[#9090b0]">理解枚举法 · 系统性地尝试所有可能</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#9090b0]">
          <span>⏱ {fmtTime(elapsed)}</span>
          <span>{total} 次尝试</span>
        </div>
      </header>

      {/* Main: 3-column */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Lock type selector */}
        <aside className="w-[200px] shrink-0 border-r border-[#2a2a4a] p-4 flex flex-col gap-3 bg-[#16162a]">
          <div className="text-xs font-semibold text-[#9090b0] mb-1">🔑 密码锁类型</div>
          {(Object.entries(LOCK_LABELS) as [LockType,typeof LOCK_LABELS['numeric']][]).map(([key,cfg]) => (
            <button key={key} onClick={() => setLockType(key)}
              className={`text-left rounded-lg p-3 border transition-all cursor-pointer ${
                lockType===key ? "bg-[#222244] border-[#4a90d9] shadow-[0_0_12px_rgba(74,144,217,0.15)]" : "bg-[#1e1e3a] border-transparent hover:border-[#2a2a4a]"
              }`}
            >
              <div className="flex items-center gap-2" style={{color:cfg.color}}>{cfg.icon}<span className="font-semibold text-sm text-white">{cfg.name}</span></div>
              <div className="text-[11px] text-[#9090b0] mt-1">{cfg.desc} · {cfg.charset}</div>
            </button>
          ))}
          <div className="flex-1"/>
          <Button variant="ghost" size="sm" className="text-[#9090b0] w-full" onClick={() => pickPassword(lockType)}>
            <RefreshCw className="h-4 w-4 mr-1"/>换一把锁
          </Button>
        </aside>

        {/* Center: Game area */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <div className="text-center">
            <div className="text-7xl mb-3">{unlocked ? <Unlock className="inline h-20 w-20 text-[#4caf50]"/>:<Lock className="inline h-20 w-20 text-[#4a90d9]"/>}</div>
            <div className="text-lg font-semibold">{unlocked?"🔓 已破解!":config.name+" · 已锁定"}</div>
            <div className="text-xs text-[#9090b0] mt-1">密码长度: {password.length} 位</div>
          </div>

          {/* Search space visualization */}
          <div className="w-full max-w-[420px] rounded-lg bg-[#16162a] border border-[#2a2a4a] p-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-[#9090b0]">搜索空间</span><span>{total} / — 种</span>
            </div>
            <div className="h-2 rounded-full bg-[#2a2a4a] overflow-hidden">
              <div className="h-full rounded-full bg-[#4a90d9] transition-all" style={{width:`${Math.min(total*0.5,100)}%`}}/>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-[#9090b0]">
              <span><span className="inline-block w-2 h-2 rounded-full bg-[#2a2a4a] mr-1"/>未尝试</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-[#4a90d9] mr-1"/>已尝试</span>
              {unlocked && <span><span className="inline-block w-2 h-2 rounded-full bg-[#22C55E] mr-1"/>正确答案</span>}
            </div>
          </div>

          {/* Input area */}
          {!unlocked && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <Input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")handleGuess();}}
                  className="w-[220px] h-12 text-center text-2xl font-mono bg-[#2a2a4a] border-[#3a3a6a] text-white tracking-[6px]"
                  placeholder={password.replace(/./g,"·")} />
                <Button onClick={handleGuess} className="h-12 px-6 bg-[#4caf50] hover:bg-[#43a047]">
                  <Search className="h-5 w-5 mr-1"/>尝试解锁
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#9090b0]">破译方法:</span>
                <select value={method} onChange={e=>setMethod(e.target.value)}
                  className="bg-[#2a2a4a] border border-[#3a3a6a] rounded px-2 py-1 text-white text-xs cursor-pointer">
                  {METHODS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {result && <div className="text-sm font-semibold" style={{color:result.color}}>{result.msg}</div>}
            </div>
          )}
          {unlocked && (
            <Button onClick={()=>pickPassword(lockType)} className="bg-[#4a90d9] hover:bg-[#3a7bc8]">
              <RefreshCw className="h-4 w-4 mr-1"/>换一把锁，再来一次
            </Button>
          )}
        </main>

        {/* Right: History + Stats */}
        <aside className="w-[260px] shrink-0 border-l border-[#2a2a4a] p-4 bg-[#16162a] flex flex-col min-h-0">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <BarChart3 className="h-4 w-4 text-[#4a90d9]"/>尝试记录
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 text-xs font-mono mb-3">
            {attempts.length===0 && <div className="text-[#9090b0] text-center py-8">还没有尝试记录</div>}
            {attempts.slice().reverse().map(a=>(
              <div key={a.id} className="flex items-center gap-2 py-1 border-b border-[#1e1e3a]">
                <span className="text-[#9090b0]">#{a.id}</span>
                <span className="text-white">{a.guess}</span>
                <span className="text-[#9090b0]">{a.method}</span>
                <span>{a.correct?"✅":"❌"}</span>
              </div>
            ))}
          </div>
          <div className="shrink-0 rounded-lg bg-[#1e1e3a] border border-[#2a2a4a] p-3 text-xs space-y-1">
            <div className="text-[#9090b0] font-semibold mb-1">📊 统计</div>
            <div>总尝试: <span className="text-white font-semibold">{total}</span></div>
            <div>成功: <span className="text-[#22C55E] font-semibold">{successes}</span></div>
            <div>成功率: <span className="text-[#F59E0B] font-semibold">{rate}%</span></div>
            <div>耗时: <span className="text-white">{fmtTime(elapsed)}</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default LockCrackerPage;
