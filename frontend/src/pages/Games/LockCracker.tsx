/**
 * 密码锁破解游戏 — 枚举法教学
 * 三层难度固定：纯数字 / 字母数字 / 字母数字+特殊字符
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Lock, Unlock, Hash, Type, Asterisk, Search, BarChart3, Check, X, Timer } from "lucide-react";
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
  const [result, setResult] = useState<{ msg: string; kind: "warning" | "error" | "success" } | null>(null);
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
    if (!g) { setResult({msg:"请输入密码",kind:"warning"}); return; }
    const correct = g === password;
    const entry: Attempt = { id: attempts.length+1, guess: g, method, correct };
    setAttempts(prev => [...prev, entry]);
    if (correct) { setUnlocked(true); setResult({msg:"密码正确，锁已打开",kind:"success"}); }
    else { setResult({msg:"密码错误，请继续尝试",kind:"error"}); setGuess(""); }
  };

  const total = attempts.length;
  const successes = attempts.filter(a=>a.correct).length;
  const rate = total>0 ? Math.round(successes/total*100) : 0;
  const fmtTime = (s:number) => { const m=Math.floor(s/60); return `${m}分${s%60}秒`; };
  const config = LOCK_LABELS[lockType];

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-bg text-text-base">
      {/* Header */}
      <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-border-secondary bg-surface px-3 py-2 sm:flex sm:justify-between sm:px-6">
        <Button variant="ghost" size="sm" className="text-text-secondary hover:bg-primary-soft hover:text-primary" onClick={() => window.close()}>
          <ArrowLeft className="mr-1 h-4 w-4"/>返回
        </Button>
        <div className="min-w-0 text-center sm:mx-auto">
          <h1 className="flex items-center justify-center gap-2 truncate text-sm font-semibold text-text-base sm:text-base">
            <Lock className="h-4 w-4 shrink-0 text-primary" />
            密码锁破解
          </h1>
          <p className="hidden text-xs text-text-tertiary sm:block">理解枚举法 · 系统性地尝试所有可能</p>
        </div>
        <div className="col-span-2 flex items-center justify-end gap-4 text-xs font-medium text-text-secondary sm:col-span-1">
          <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" />{fmtTime(elapsed)}</span>
          <span>{total} 次尝试</span>
        </div>
      </header>

      {/* Main: 3-column */}
      <main className="mx-auto grid min-h-0 w-full max-w-[1800px] flex-1 grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
        {/* Left: Lock type selector */}
        <aside className="flex w-full shrink-0 flex-col gap-2 border-b border-border-secondary bg-surface p-3 xl:min-h-0 xl:w-[220px] xl:border-b-0 xl:border-r xl:p-4">
          <div className="mb-1 hidden text-xs font-semibold text-text-tertiary xl:block">密码锁类型</div>
          <div className="grid grid-cols-3 gap-2 xl:flex xl:flex-col xl:gap-3">
          {(Object.entries(LOCK_LABELS) as [LockType,typeof LOCK_LABELS['numeric']][]).map(([key,cfg]) => (
            <button key={key} onClick={() => setLockType(key)} aria-pressed={lockType===key}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-sm border p-2 text-center transition-colors cursor-pointer xl:items-start xl:p-3 xl:text-left ${
                lockType===key ? "bg-primary-soft border-primary" : "bg-surface-2 border-border-secondary hover:border-primary/40 hover:bg-primary-soft/40"
              }`}
            >
              <div className="flex min-w-0 items-center gap-1.5 xl:gap-2" style={{color:cfg.color}}>{cfg.icon}<span className="font-semibold text-xs text-text-base xl:text-sm">{cfg.name}</span></div>
              <div className="hidden text-[11px] text-text-tertiary xl:block">{cfg.desc} · {cfg.charset}</div>
            </button>
          ))}
          </div>
          <div className="hidden flex-1 xl:block"/>
          <Button variant="ghost" size="sm" className="hidden w-full text-text-secondary hover:bg-primary-soft hover:text-primary xl:flex" onClick={() => pickPassword(lockType)}>
            <RefreshCw className="mr-1 h-4 w-4"/>换一把锁
          </Button>
        </aside>

        {/* Center: Game area */}
        <section className="flex min-h-[420px] min-w-0 flex-col items-center justify-center gap-5 overflow-hidden bg-surface px-4 py-6 sm:px-8 xl:min-h-0 xl:py-8">
          <div className="text-center">
            <div className="mb-3">{unlocked ? <Unlock className="mx-auto h-14 w-14 text-[var(--ws-color-success)]"/>:<Lock className="mx-auto h-14 w-14 text-primary"/>}</div>
            <div className="text-base font-semibold text-text-base">{unlocked?"已破解":config.name+" · 已锁定"}</div>
            <div className="text-xs text-text-tertiary mt-1">密码长度: {password.length} 位</div>
          </div>

          <div className="w-full max-w-[520px] border-y border-border-secondary py-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-text-tertiary">本轮挑战</span><span className="font-medium text-text-secondary">{config.name} · {password.length} 位</span>
            </div>
            <p className="text-xs leading-5 text-text-secondary">已尝试 {total} 次 · 选择方法后输入猜测</p>
          </div>

          {/* Input area */}
          {!unlocked && (
            <div className="flex w-full max-w-[520px] flex-col items-stretch gap-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)}
                  maxLength={password.length}
                  onKeyDown={e=>{if(e.key==="Enter")handleGuess();}}
                  aria-label="输入尝试密码"
                  inputMode={lockType==="numeric"?"numeric":"text"}
                  autoComplete="off"
                  className="h-12 min-w-0 rounded-sm border border-border bg-surface text-center font-mono text-2xl font-semibold tracking-[0.3em] text-text-base shadow-none placeholder:text-text-tertiary focus:border-primary focus:ring-2 focus:ring-primary-soft"
                  placeholder={password.replace(/./g,"•")} />
                <Button onClick={handleGuess} className="h-12 px-3 sm:px-5">
                  <Search className="mr-1.5 h-4 w-4"/>尝试解锁
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label htmlFor="crack-method" className="shrink-0 text-text-tertiary">破译方法</label>
                <select id="crack-method" value={method} onChange={e=>setMethod(e.target.value)}
                  className="h-9 min-w-0 rounded-sm border border-border bg-surface px-2 text-text-base text-xs cursor-pointer transition-colors hover:border-text-tertiary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0">
                  {METHODS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {result && <div role="status" aria-live="polite" className={`flex items-center gap-2 text-sm font-medium ${
                result.kind==="success" ? "text-[var(--ws-color-success)]" : result.kind==="warning" ? "text-[var(--ws-color-warning)]" : "text-destructive"
              }`}>{result.kind==="success" ? <Check className="h-4 w-4"/> : result.kind==="warning" ? <span aria-hidden="true">!</span> : <X className="h-4 w-4"/>}{result.msg}</div>}
            </div>
          )}
          {unlocked && (
            <Button onClick={()=>pickPassword(lockType)} className="bg-primary text-white hover:bg-primary/90">
              <RefreshCw className="mr-1 h-4 w-4"/>换一把锁，再来一次
            </Button>
          )}
        </section>

        {/* Right: History + Stats */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-border-secondary bg-surface p-4 xl:w-[280px] xl:border-l xl:border-t-0">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <BarChart3 className="h-4 w-4 text-primary"/>尝试记录
          </div>
          <div className="max-h-48 flex-1 overflow-y-auto space-y-1 text-xs font-mono mb-3 xl:max-h-none">
            {attempts.length===0 && <div className="text-text-tertiary text-center py-8">还没有尝试记录</div>}
            {attempts.slice().reverse().map(a=>(
              <div key={a.id} className="flex items-center gap-2 py-1.5 border-b border-border-secondary">
                <span className="text-text-tertiary">#{a.id}</span>
                <span className="font-semibold text-text-base">{a.guess}</span>
                <span className="min-w-0 flex-1 truncate text-text-tertiary">{a.method}</span>
                {a.correct ? <Check aria-label="正确" className="h-4 w-4 text-[var(--ws-color-success)]"/> : <X aria-label="错误" className="h-4 w-4 text-destructive"/>}
              </div>
            ))}
          </div>
          <div className="shrink-0 border-t border-border-secondary pt-3 text-xs">
            <div className="mb-2 font-medium text-text-secondary">本局统计</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>总尝试 <span className="font-semibold text-text-base">{total}</span></div>
              <div>成功 <span className="font-semibold text-[var(--ws-color-success)]">{successes}</span></div>
              <div>成功率 <span className="font-semibold text-[var(--ws-color-warning)]">{rate}%</span></div>
              <div>耗时 <span className="text-text-base">{fmtTime(elapsed)}</span></div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default LockCrackerPage;
