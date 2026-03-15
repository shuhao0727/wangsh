import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Terminal } from "xterm";
import type { FitAddon } from "xterm-addon-fit";

type TerminalInternal = Terminal & {
  element?: HTMLElement;
  buffer?: { active?: { cursorX?: number } };
  onRender?: (callback: () => void) => { dispose: () => void } | null;
};

export type XtermTerminalHandle = {
  clear: () => void;
  ensureNewline: () => void;
  write: (data: string) => void;
};

interface XtermTerminalProps {
  wsUrl?: string | null;
  className?: string;
  onClear?: () => void;
  fontSize?: number;
  showLineNumbers?: boolean;
}

const XtermTerminal = React.forwardRef<XtermTerminalHandle, XtermTerminalProps>(function XtermTerminal(
  { wsUrl, className, onClear, fontSize = 14, showLineNumbers },
  ref
) {
  const showLineNumbersOn = showLineNumbers !== false;
  const [gutterText, setGutterText] = useState("");
  const [gutterDigits, setGutterDigits] = useState(2);
  const gutterRafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<TerminalInternal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const fitRafRef = useRef<number | null>(null);
  const fitDebounceRef = useRef<number | null>(null);
  const fitTimerRef = useRef<number | null>(null);
  const textTailRef = useRef("");
  const [canInit, setCanInit] = useState(false);
  const afterEnterRef = useRef(false);
  const termEpochRef = useRef(0);
  const terminalDisposedRef = useRef(true);
  const trace = (phase: string, extra?: Record<string, unknown>) => {
    try {
      const enabled =
        Boolean((window as unknown as { __PYTHONLAB_TERMINAL_TRACE__?: boolean }).__PYTHONLAB_TERMINAL_TRACE__) ||
        window.localStorage?.getItem("pythonlab:terminal:trace") === "1";
      if (!enabled) return;
      console.info("[pythonlab:terminal:xterm]", {
        phase,
        epoch: termEpochRef.current,
        disposed: terminalDisposedRef.current,
        ts: Date.now(),
        ...(extra || {}),
      });
    } catch {}
  };

  const shouldHideLine = (line: string) => {
    const s = line.trim();
    if (!s) return false;
    if (/^debugpy exited rc=0 \(iter=\d+\)$/.test(s)) return true;
    if (/^\d+\.\d+s - Debugger warning: It seems that frozen modules are being used, which may$/.test(s)) return true;
    if (/^\d+\.\d+s - make the debugger miss breakpoints\. Please pass -Xfrozen_modules=off$/.test(s)) return true;
    if (/^\d+\.\d+s - to python to disable frozen modules\.$/.test(s)) return true;
    if (/^\d+\.\d+s - Note: Debugging will proceed\. Set PYDEVD_DISABLE_FILE_VALIDATION=1 to disable this validation\.$/.test(s)) return true;
    return false;
  };

  const filterTerminalText = (chunk: string) => {
    if (!chunk) return "";
    const combined = textTailRef.current + chunk;
    const parts = combined.split(/\r\n|\n|\r/);
    textTailRef.current = parts.pop() ?? "";
    const out: string[] = [];
    for (const line of parts) {
      if (!shouldHideLine(line)) out.push(line);
    }
    return out.length ? `${out.join("\r\n")}\r\n` : "";
  };

  const refreshGutter = () => {
    if (!showLineNumbersOn) return;
    const term = terminalRef.current;
    if (!term) return;
    const active = term.buffer?.active;
    const viewportY = typeof active?.viewportY === "number" ? active.viewportY : 0;
    const rows = Math.max(9, term.rows || 0);
    const start = viewportY + 1;
    const end = start + rows - 1;
    const digits = Math.max(2, String(end).length);
    let text = "";
    for (let i = start; i <= end; i++) {
      text += String(i).padStart(digits, " ") + "\n";
    }
    setGutterDigits(digits);
    setGutterText(text);
  };

  const scheduleRefreshGutter = () => {
    if (!showLineNumbersOn) return;
    if (gutterRafRef.current != null) window.cancelAnimationFrame(gutterRafRef.current);
    gutterRafRef.current = window.requestAnimationFrame(() => {
      gutterRafRef.current = null;
      refreshGutter();
    });
  };

  const safeFit = (expectedEpoch: number) => {
    try {
      const container = containerRef.current;
      const fit = fitAddonRef.current;
      const termAny = terminalRef.current;
      if (!container || !fit || !termAny) return;
      if (terminalDisposedRef.current) return;
      if (expectedEpoch !== termEpochRef.current) return;
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      if (!container.isConnected) return;
      if (container.offsetParent === null) return;
      if (!container.ownerDocument?.contains(container)) return;
      const termElement = termAny?.element as HTMLElement | undefined;
      if (!termElement || !termElement.isConnected) return;
      fit.fit();
      trace("safe_fit_ok", { expectedEpoch });
    } catch {}
  };

  const requestFit = () => {
    if (fitDebounceRef.current != null) {
      window.clearTimeout(fitDebounceRef.current);
      fitDebounceRef.current = null;
    }
    if (fitRafRef.current != null) window.cancelAnimationFrame(fitRafRef.current);
    const epoch = termEpochRef.current;
    fitDebounceRef.current = window.setTimeout(() => {
      fitDebounceRef.current = null;
      fitRafRef.current = window.requestAnimationFrame(() => {
        fitRafRef.current = null;
        trace("request_fit_fire", { epoch });
        safeFit(epoch);
        scheduleRefreshGutter();
      });
    }, 24);
  };

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        const t = terminalRef.current;
        if (!t) return;
        if (terminalDisposedRef.current) return;
        if (!t.element || !t.element.isConnected) return;
        trace("imperative_clear");
        try {
          t.write("\x1b[2J\x1b[3J\x1b[H");
        } catch {}
        scheduleRefreshGutter();
      },
      ensureNewline: () => {
        const t = terminalRef.current;
        if (!t) return;
        if (terminalDisposedRef.current) return;
        if (!t.element || !t.element.isConnected) return;
        const cx = t.buffer?.active?.cursorX;
        if (typeof cx === "number" && cx === 0) return;
        trace("imperative_newline");
        try {
          t.write("\r\n");
        } catch {}
        scheduleRefreshGutter();
      },
      write: (data: string) => {
        const t = terminalRef.current;
        if (!t) return;
        if (terminalDisposedRef.current) return;
        if (!t.element || !t.element.isConnected) return;
        trace("imperative_write", { size: data?.length ?? 0 });
        try {
          t.write(data);
        } catch {}
        scheduleRefreshGutter();
      },
    }),
    []
  );

  // 1. Setup ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    const fitTerminal = () => {
        if (!terminalRef.current || !fitAddonRef.current || !containerRef.current) return;
        if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) return;
        requestFit();
    };
    const maybeInit = () => {
      if (!containerRef.current) return;
      if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) return;
      if (!disposed) setCanInit(true);
    };
    const runResize = () => {
      maybeInit();
      fitTerminal();
    };
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", runResize);
      runResize();
      return () => {
        disposed = true;
        window.removeEventListener("resize", runResize);
        if (fitDebounceRef.current != null) {
          window.clearTimeout(fitDebounceRef.current);
          fitDebounceRef.current = null;
        }
        if (fitRafRef.current != null) {
          window.cancelAnimationFrame(fitRafRef.current);
          fitRafRef.current = null;
        }
      };
    }
    const ro = new ResizeObserver(() => {
      if (fitRafRef.current != null) window.cancelAnimationFrame(fitRafRef.current);
      fitRafRef.current = window.requestAnimationFrame(() => {
        fitRafRef.current = null;
        runResize();
      });
    });
    ro.observe(containerRef.current);
    maybeInit();
    return () => {
      disposed = true;
      if (fitDebounceRef.current != null) {
        window.clearTimeout(fitDebounceRef.current);
        fitDebounceRef.current = null;
      }
      if (fitRafRef.current != null) {
        window.cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = null;
      }
      ro.disconnect();
    };
  }, []);

  // 2. Initialize Terminal
  useEffect(() => {
    if (!canInit || !containerRef.current || terminalRef.current) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;
    const raf = window.requestAnimationFrame(() => {
      if (disposed) return;
      const container = containerRef.current;
      if (!container || terminalRef.current) return;
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      if (!container.isConnected || container.offsetParent === null) return;
      if (!container.ownerDocument?.contains(container)) return;

      Promise.all([
        import(/* webpackChunkName: "xterm" */ "xterm"),
        import(/* webpackChunkName: "xterm" */ "xterm-addon-fit"),
        import(/* webpackChunkName: "xterm" */ "xterm/css/xterm.css"),
      ]).then(([{ Terminal }, { FitAddon }]) => {
        if (disposed) return;
        if (!containerRef.current || terminalRef.current) return;
        const container = containerRef.current;

        const term = new Terminal({
          cursorBlink: true,
          fontSize: fontSize,
          lineHeight: 1.35,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, monospace",
          theme: {
            background: "#ffffff",
            foreground: "#1e293b",
            cursor: "#1e293b",
            selectionBackground: "rgba(37, 99, 235, 0.2)",
          },
          convertEol: true,
          disableStdin: false,
          allowProposedApi: true,
        });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      try {
        term.open(container);
      } catch (e: unknown) {
        trace("terminal_open_error", { message: e?.message || "open_failed" });
        try { term.dispose(); } catch {}
        return;
      }

      term.onKey(() => {});
      const inputDisposable = term.onData((data) => {
        const normalized = data === "\b" ? "\u007F" : data;
        if (data.includes("\r")) afterEnterRef.current = true;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(normalized);
        }
      });

      const scrollDisposable = term.onScroll(() => scheduleRefreshGutter());
      const renderDisposable = term.onRender ? term.onRender(() => scheduleRefreshGutter()) : null;

      terminalRef.current = term;
      fitAddonRef.current = fitAddon;
      termEpochRef.current += 1;
      terminalDisposedRef.current = false;
      trace("terminal_init");
      requestFit();

      cleanup = () => {
        terminalDisposedRef.current = true;
        termEpochRef.current += 1;
        terminalRef.current = null;
        fitAddonRef.current = null;
        trace("terminal_cleanup_start");
        inputDisposable.dispose();
        scrollDisposable.dispose();
        try { renderDisposable?.dispose(); } catch {}
        if (fitRafRef.current != null) {
          window.cancelAnimationFrame(fitRafRef.current);
          fitRafRef.current = null;
        }
        try { term.dispose(); } catch {}
        textTailRef.current = "";
        trace("terminal_cleanup_done");
      };
    }); // close .then()
    }); // close requestAnimationFrame

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [canInit]);

  // 3. WS Connection
  useEffect(() => {
      if (!wsUrl || !canInit || !terminalRef.current) return;
      const term = terminalRef.current;
      let disposed = false;

      const clearTimers = () => {
          if (reconnectRef.current != null) {
              window.clearTimeout(reconnectRef.current);
              reconnectRef.current = null;
          }
      };

      const closeCurrent = () => {
          if (wsRef.current) {
              const state = wsRef.current.readyState;
              if (state === WebSocket.OPEN) {
                try { wsRef.current.close(1000, "reconnect"); } catch {}
              }
              wsRef.current = null;
          }
      };

      const connect = () => {
          if (disposed) return;
          trace("ws_connect");
          clearTimers();
          closeCurrent();
          const ws = new WebSocket(wsUrl);
          ws.binaryType = "arraybuffer";
          wsRef.current = ws;

          ws.onopen = () => {
              reconnectAttemptsRef.current = 0;
              term.focus();
              trace("ws_open");
          };

          ws.onmessage = (ev) => {
              if (terminalDisposedRef.current) return;
              const termElement = term?.element;
              if (!termElement || !termElement.isConnected) return;
              const data = ev.data;
              if (typeof data === "string") {
                  if (data.length < 10 && !textTailRef.current) {
                      term.write(data);
                      scheduleRefreshGutter();
                      return;
                  }

                  const filtered = filterTerminalText(data);
                  if (!filtered) return;
                  if (afterEnterRef.current) {
                    afterEnterRef.current = false;
                    const first = filtered[0] || "";
                    const cx = term.buffer?.active?.cursorX;
                    if (typeof cx === "number" && cx > 0 && first !== "\r" && first !== "\n") {
                      try { term.write("\r\n"); } catch {}
                    }
                  }
                  term.write(filtered);
                  scheduleRefreshGutter();
              } else {
                  term.write(new Uint8Array(data));
                  scheduleRefreshGutter();
              }
          };

          ws.onclose = (ev) => {
              clearTimers();
              trace("ws_close", { code: ev.code });
              if (disposed) return;
              if (terminalDisposedRef.current) return;
              const termElement = term?.element;
              if (!termElement || !termElement.isConnected) return;
              const fatalCodes = new Set([4401, 4403, 4404, 4500]);
              if (ev.code !== 1000) {
                  if (fatalCodes.has(ev.code)) {
                      if (ev.code === 4500) {
                        term.write("\r\n终端附着失败（Code: 4500），请点击“运行”重建会话。\r\n");
                      } else if (ev.code === 4401) {
                        term.write("\r\n登录态失效（Code: 4401），请重新登录后再试。\r\n");
                      } else if (ev.code === 4403) {
                        term.write("\r\n无权访问该会话终端（Code: 4403）。\r\n");
                      } else if (ev.code === 4404) {
                        term.write("\r\n会话不存在或已结束（Code: 4404）。\r\n");
                      }
                      scheduleRefreshGutter();
                      return;
                  }
                  const attempts = reconnectAttemptsRef.current + 1;
                  reconnectAttemptsRef.current = attempts;
                  const delay = Math.min(8000, 500 * Math.pow(2, Math.min(attempts - 1, 4)));
                  if (attempts <= 8) {
                      term.write(`\r\n终端连接已断开 (Code: ${ev.code})，${Math.round(delay / 1000)}s 后重连...\r\n`);
                      reconnectRef.current = window.setTimeout(() => connect(), delay);
                  } else {
                      term.write(`\r\n终端连接多次失败 (Code: ${ev.code})，请点击运行重试。\r\n`);
                  }
              } else {
                  term.write("\r\n终端已断开\r\n");
              }
              scheduleRefreshGutter();
          };

          ws.onerror = () => {
              trace("ws_error");
              if (!disposed) {
                  if (terminalDisposedRef.current) return;
                  const termElement = term?.element;
                  if (!termElement || !termElement.isConnected) return;
                  term.write("\r\n终端连接错误\r\n");
                  scheduleRefreshGutter();
              }
          };
      };

      term.clear();
      scheduleRefreshGutter();
      connect();

      return () => {
          disposed = true;
          clearTimers();
          if (wsRef.current) {
              const state = wsRef.current.readyState;
              wsRef.current.onopen = null;
              wsRef.current.onmessage = null;
              wsRef.current.onclose = null;
              wsRef.current.onerror = null;
              if (state === WebSocket.OPEN) {
                try { wsRef.current.close(1000, "cleanup"); } catch {}
              }
              wsRef.current = null;
          }
          textTailRef.current = "";
      };
  }, [wsUrl, canInit, showLineNumbersOn]);

  useEffect(() => {
      return () => {
          if (reconnectRef.current != null) {
              window.clearTimeout(reconnectRef.current);
              reconnectRef.current = null;
          }
          if (gutterRafRef.current != null) {
              window.cancelAnimationFrame(gutterRafRef.current);
              gutterRafRef.current = null;
          }
      }
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontSize = fontSize;
      if (fitTimerRef.current != null) {
        window.clearTimeout(fitTimerRef.current);
        fitTimerRef.current = null;
      }
      fitTimerRef.current = window.setTimeout(() => {
        fitTimerRef.current = null;
        const container = containerRef.current;
        if (!terminalRef.current || !fitAddonRef.current || !container) return;
        if (container.clientWidth === 0 || container.clientHeight === 0) return;
        requestFit();
      }, 50);
    }
  }, [fontSize]);

  useEffect(() => {
    return () => {
      if (fitTimerRef.current != null) {
        window.clearTimeout(fitTimerRef.current);
        fitTimerRef.current = null;
      }
      if (fitDebounceRef.current != null) {
        window.clearTimeout(fitDebounceRef.current);
        fitDebounceRef.current = null;
      }
      if (fitRafRef.current != null) {
        window.cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = null;
      }
      if (gutterRafRef.current != null) {
        window.cancelAnimationFrame(gutterRafRef.current);
        gutterRafRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={className}
      style={{ height: "100%", width: "100%", overflow: "hidden", display: "flex" }}
      onClick={() => terminalRef.current?.focus()}
    >
      {showLineNumbersOn ? (
        <div
          style={{
            width: "30px",
            padding: "14px 0 12px 0",
            background: "#ffffff",
            color: "#237893",
            borderRight: "1px solid var(--ws-color-border-secondary)",
            overflow: "hidden",
            boxSizing: "border-box",
            userSelect: "none",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <pre style={{ margin: 0, paddingRight: 2, fontSize, lineHeight: 1.35, textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", opacity: 0.6 }}>{gutterText}</pre>
        </div>
      ) : null}
      <div ref={containerRef} style={{ flex: 1, minWidth: 0, height: "100%", overflow: "hidden", paddingLeft: 12, paddingTop: 12 }} />
    </div>
  );
});

export default XtermTerminal;
