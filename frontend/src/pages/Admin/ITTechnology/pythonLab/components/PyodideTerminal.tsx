import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { logger } from "@services/logger";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import type { PyodideTerminalBridge } from "../hooks/usePyodideRunner";

export type PyodideTerminalHandle = {
  clear: () => void;
  ensureNewline: () => void;
};

const PyodideTerminal = React.forwardRef<PyodideTerminalHandle, { bridge: PyodideTerminalBridge; fontSize: number; showLineNumbers?: boolean }>(
  function PyodideTerminal(props, ref) {
    const { bridge, fontSize, showLineNumbers } = props;
    const showLineNumbersOn = showLineNumbers !== false;
    const [gutterText, setGutterText] = useState("");
    const [_gutterDigits, setGutterDigits] = useState(2);
    const gutterRafRef = useRef<number | null>(null);
    const hostRef = useRef<HTMLDivElement | null>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const fitRafRef = useRef<number | null>(null);
    const fitDebounceRef = useRef<number | null>(null);
    const inputBufRef = useRef("");
    const clearingRef = useRef(false);
    const [canInit, setCanInit] = useState(false);
    const termEpochRef = useRef(0);
    const terminalDisposedRef = useRef(true);
    const trace = (phase: string, extra?: Record<string, unknown>) => {
      try {
        const enabled =
          Boolean((window as any).__PYTHONLAB_TERMINAL_TRACE__) ||
          window.localStorage?.getItem("pythonlab:terminal:trace") === "1";
        if (!enabled) return;
        logger.info("[pythonlab:terminal:pyodide]", {
          phase,
          epoch: termEpochRef.current,
          disposed: terminalDisposedRef.current,
          ts: Date.now(),
          ...(extra || {}),
        });
      } catch {}
    };

    const refreshGutter = () => {
      if (!showLineNumbersOn) return;
      const term = termRef.current as any;
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
        const host = hostRef.current;
        const fit = fitRef.current;
        const termAny = termRef.current as any;
        if (!host || !fit || !termAny) return;
        if (terminalDisposedRef.current) return;
        if (expectedEpoch !== termEpochRef.current) return;
        if (!termAny.element || !termAny.element.isConnected) return;
        if (!host.isConnected || host.offsetParent === null) return;
        if (host.clientWidth === 0 || host.clientHeight === 0) return;
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
          if (clearingRef.current) return;
          const t = termRef.current;
          if (!t) return;
          if (terminalDisposedRef.current) return;
          if (!(t as any).element || !(t as any).element.isConnected) return;
          trace("imperative_clear");
          clearingRef.current = true;
          inputBufRef.current = "";
          try {
            t.clear();
          } catch {}
          try {
            requestFit();
          } catch {}
          try {
            scheduleRefreshGutter();
          } finally {
            clearingRef.current = false;
          }
        },
        ensureNewline: () => {
          const t = termRef.current;
          if (!t) return;
          if (terminalDisposedRef.current) return;
          if (!(t as any).element || !(t as any).element.isConnected) return;
          const cx = (t as any).buffer?.active?.cursorX;
          if (typeof cx === "number" && cx === 0) return;
          trace("imperative_newline");
          try {
            t.write("\r\n");
          } catch {}
          scheduleRefreshGutter();
        },
      }),
      []
    );

    const theme = useMemo(
      () => ({
        background: (() => {
          try {
            return getComputedStyle(document.documentElement).getPropertyValue("--ws-color-surface").trim() || "#ffffff";
          } catch {
            return "#ffffff";
          }
        })(),
        foreground: (() => {
          try {
            return getComputedStyle(document.documentElement).getPropertyValue("--ws-color-text").trim() || "#000000";
          } catch {
            return "#000000";
          }
        })(),
        cursor: (() => {
          try {
            return getComputedStyle(document.documentElement).getPropertyValue("--ws-color-text").trim() || "#000000";
          } catch {
            return "#000000";
          }
        })(),
        selectionBackground: "rgba(37, 99, 235, 0.2)",
      }),
      []
    );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const check = () => {
      if (!hostRef.current) return;
      if (hostRef.current.clientWidth === 0 || hostRef.current.clientHeight === 0) return;
      if (!disposed) setCanInit(true);
    };
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", check);
      check();
      return () => {
        disposed = true;
        window.removeEventListener("resize", check);
      };
    }
    const ro = new ResizeObserver(() => requestAnimationFrame(check));
    ro.observe(host);
    check();
    return () => {
      disposed = true;
      try {
        ro.disconnect();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !canInit) return;
    if (host.clientWidth === 0 || host.clientHeight === 0) return;
    host.innerHTML = "";
    const term = new Terminal({
      fontSize,
      lineHeight: 1.35,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      theme,
      convertEol: true,
      cursorBlink: true,
      scrollback: 4000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    requestAnimationFrame(() => {
      try {
        requestFit();
      } catch {}
      scheduleRefreshGutter();
    });
    termRef.current = term;
    fitRef.current = fit;
    terminalDisposedRef.current = false;
    termEpochRef.current += 1;
    trace("terminal_init");

    let resizeObserver: ResizeObserver | null = null;
    const onWindowResize = () => requestFit();
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        requestFit();
      });
      resizeObserver.observe(host);
    } else {
      window.addEventListener("resize", onWindowResize);
    }

    const dispose = bridge.subscribe((s) => {
      try {
        if (terminalDisposedRef.current) return;
        if (!termRef.current || !(termRef.current as any).element || !(termRef.current as any).element.isConnected) return;
        trace("bridge_write", { size: String(s).length });
        term.write(String(s));
        scheduleRefreshGutter();
      } catch {}
    });

    const onData = term.onData((data) => {
      const t = termRef.current;
      if (!t) return;
      if (terminalDisposedRef.current) return;
      if (!(t as any).element || !(t as any).element.isConnected) return;
      trace("on_data", { size: data?.length ?? 0 });
      if (data === "\r") {
        t.write("\r\n");
        const v = inputBufRef.current;
        inputBufRef.current = "";
        bridge.sendInputLine(v);
        scheduleRefreshGutter();
        return;
      }
      if (data === "\u007F") {
        if (inputBufRef.current.length > 0) {
          inputBufRef.current = inputBufRef.current.slice(0, -1);
          t.write("\b \b");
          scheduleRefreshGutter();
        }
        return;
      }
      if (data === "\u0003") {
        t.write("^C\r\n");
        inputBufRef.current = "";
        bridge.sendInputLine("");
        scheduleRefreshGutter();
        return;
      }
      if (data >= " " && data !== "\u007F") {
        inputBufRef.current += data;
        t.write(data);
        scheduleRefreshGutter();
      }
    });

    const scrollDisposable = term.onScroll(() => scheduleRefreshGutter());
    const renderDisposable = (term as any).onRender ? (term as any).onRender(() => scheduleRefreshGutter()) : null;
    scheduleRefreshGutter();

    return () => {
      trace("terminal_cleanup_start");
      terminalDisposedRef.current = true;
      termEpochRef.current += 1;
      termRef.current = null;
      fitRef.current = null;
      try {
        onData.dispose();
      } catch {}
      try {
        scrollDisposable.dispose();
      } catch {}
      try { renderDisposable?.dispose(); } catch {}
      try {
        dispose();
      } catch {}
      try {
        resizeObserver?.disconnect();
      } catch {}
      window.removeEventListener("resize", onWindowResize);
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
      try {
        term.dispose();
      } catch {}
      trace("terminal_cleanup_done");
    };
  }, [bridge, canInit, fontSize, theme, showLineNumbersOn]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", overflow: "hidden" }} onClick={() => termRef.current?.focus()}>
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
      <div ref={hostRef} style={{ flex: 1, minWidth: 0, height: "100%", overflow: "hidden", paddingLeft: 12, paddingTop: 12 }} />
    </div>
  );
  }
);

export default PyodideTerminal;
