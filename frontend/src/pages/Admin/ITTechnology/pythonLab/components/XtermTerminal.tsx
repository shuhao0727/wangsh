import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

interface XtermTerminalProps {
  output: string[];
  className?: string;
  onClear?: () => void;
}

const XtermTerminal: React.FC<XtermTerminalProps> = ({ output, className, onClear }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const outputLengthRef = useRef(0);
  const lastElementLengthRef = useRef(0);
  const firstElementRef = useRef<string | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [canInit, setCanInit] = useState(false);

  // Line number state
  const lineNumberRef = useRef(1);
  const isLineStartRef = useRef(true);

  // Helper to write with line numbers
  const writeWithLineNumbers = (term: Terminal, text: string) => {
    if (!text) return;
    
    let result = "";
    let ptr = 0;
    
    while (ptr < text.length) {
        if (isLineStartRef.current) {
            const numStr = lineNumberRef.current.toString().padEnd(4, ' ');
            // Use dim style for line numbers
            result += `\x1b[38;5;244m${numStr}\x1b[0m `; 
            isLineStartRef.current = false;
        }
        
        // Find next newline
        const nextCR = text.indexOf('\r', ptr);
        const nextLF = text.indexOf('\n', ptr);
        
        let nextLineEnd = -1;
        if (nextCR !== -1 && nextLF !== -1) nextLineEnd = Math.min(nextCR, nextLF);
        else if (nextCR !== -1) nextLineEnd = nextCR;
        else if (nextLF !== -1) nextLineEnd = nextLF;
        
        if (nextLineEnd === -1) {
            result += text.slice(ptr);
            ptr = text.length;
        } else {
            let endOfLineSeq = 1;
            if (text[nextLineEnd] === '\r' && text[nextLineEnd + 1] === '\n') {
                endOfLineSeq = 2;
            }
            
            result += text.slice(ptr, nextLineEnd + endOfLineSeq);
            ptr = nextLineEnd + endOfLineSeq;
            
            lineNumberRef.current++;
            isLineStartRef.current = true;
        }
    }
    
    term.write(result);
  };

  // 1. Setup ResizeObserver to detect when container is ready (visible and has size)
  useEffect(() => {
    if (!containerRef.current) return;

    // Use a simpler resize handling approach
    const fitTerminal = () => {
        if (!terminalRef.current || !fitAddonRef.current || !containerRef.current) return;
        if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) return;
        
        try {
            fitAddonRef.current.fit();
        } catch (e) {
            console.warn("Xterm fit failed", e);
        }
    };

    const ro = new ResizeObserver(() => {
        // Debounce slightly or just requestAnimationFrame
        requestAnimationFrame(fitTerminal);
    });

    ro.observe(containerRef.current);
    
    // Also fit on init
    setCanInit(true);

    return () => {
      ro.disconnect();
    };
  }, []);

  // 2. Initialize Terminal only when container is ready
  useEffect(() => {
    if (!canInit || !containerRef.current || terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      theme: {
        background: "#ffffff",
        foreground: "#000000",
        cursor: "#000000",
        selectionBackground: "rgba(0, 0, 0, 0.3)",
      },
      convertEol: true, 
      disableStdin: true, 
      allowProposedApi: true,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Force a fit after a short delay to ensure DOM is settled
    setTimeout(() => {
        try {
            fitAddon.fit();
        } catch {}
    }, 50);

    // Initial write
    if (output.length > 0) {
         try {
             // term.write(output.join(""));
             writeWithLineNumbers(term, output.join(""));
             outputLengthRef.current = output.length;
             if (output.length > 0) {
                lastElementLengthRef.current = output[output.length - 1].length;
                firstElementRef.current = output[0];
             }
         } catch(e) {
             console.error("Error writing initial output:", e);
         }
    }

    return () => {
      try {
        term.dispose();
      } catch {}
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [canInit]); // output excluded

  // Handle Visibility Change (e.g. Tab switch)
  useEffect(() => {
      // If we are re-rendered, check if we need to fit again
      const tid = setTimeout(() => {
          if (terminalRef.current && fitAddonRef.current && containerRef.current) {
              if (containerRef.current.clientWidth > 0) {
                  fitAddonRef.current.fit();
              }
          }
      }, 100);
      return () => clearTimeout(tid);
  });

  // 3. Sync output updates
  useEffect(() => {
    const term = terminalRef.current;
    if (!term || !output) return;

    try {
      // 如果输出被清空（例如重新运行），则清空终端
      if (output.length === 0 && outputLengthRef.current > 0) {
        term.clear();
        // Reset line numbers
        lineNumberRef.current = 1;
        isLineStartRef.current = true;
        
        outputLengthRef.current = 0;
        lastElementLengthRef.current = 0;
        firstElementRef.current = null;
        return;
      }
  
      // 检查是否发生截断或头部变化（Shift）
      const isLengthShrunk = output.length < outputLengthRef.current;
      const isFirstChanged = output.length > 0 && firstElementRef.current !== null && output[0] !== firstElementRef.current;
      
      // 特殊情况：单行追加 (例如 ["hello"] -> ["hello world"])
      let isSingleElementAppend = false;
      if (output.length === 1 && outputLengthRef.current === 1 && isFirstChanged) {
          if (output[0].startsWith(firstElementRef.current!)) {
              isSingleElementAppend = true;
          }
      }
  
      // 如果发生截断或非追加式的头部变化，则重置终端
      if (isLengthShrunk || (isFirstChanged && !isSingleElementAppend)) {
        term.clear();
        // Reset line numbers
        lineNumberRef.current = 1;
        isLineStartRef.current = true;
        
        // term.write(output.join(""));
        writeWithLineNumbers(term, output.join(""));
        outputLengthRef.current = output.length;
        lastElementLengthRef.current = output.length > 0 ? output[output.length - 1].length : 0;
        firstElementRef.current = output.length > 0 ? output[0] : null;
        return;
      }
  
      // 处理增量
      // Case 1: 数组长度没变，但最后一个元素变长了
      if (output.length === outputLengthRef.current) {
        const lastIdx = output.length - 1;
        if (lastIdx >= 0) {
          const lastStr = output[lastIdx];
          const prevLen = lastElementLengthRef.current;
          if (lastStr.length > prevLen) {
            // term.write(lastStr.slice(prevLen));
            writeWithLineNumbers(term, lastStr.slice(prevLen));
            lastElementLengthRef.current = lastStr.length;
          }
        }
        if (output.length > 0) firstElementRef.current = output[0];
        return;
      }
  
      // Case 2: 数组长度增加了
      let startIdx = outputLengthRef.current;
      
      // 检查之前的最后一个元素是否有追加
      if (startIdx > 0) {
        const prevLastIdx = startIdx - 1;
        const prevLastStr = output[prevLastIdx];
        const savedLen = lastElementLengthRef.current;
        if (prevLastStr.length > savedLen) {
          // term.write(prevLastStr.slice(savedLen));
          writeWithLineNumbers(term, prevLastStr.slice(savedLen));
        }
        lastElementLengthRef.current = prevLastStr.length;
      }
  
      // 写入新元素
      for (let i = startIdx; i < output.length; i++) {
        // term.write(output[i]);
        writeWithLineNumbers(term, output[i]);
      }
  
      outputLengthRef.current = output.length;
      if (output.length > 0) {
        lastElementLengthRef.current = output[output.length - 1].length;
        firstElementRef.current = output[0];
      } else {
        lastElementLengthRef.current = 0;
        firstElementRef.current = null;
      }
    } catch (e) {
      console.error("Error writing to terminal:", e);
    }
  }, [output]);

  return <div ref={containerRef} className={className} style={{ width: "100%", height: "100%", overflow: "hidden", background: "#ffffff" }} />;
};

export default XtermTerminal;
