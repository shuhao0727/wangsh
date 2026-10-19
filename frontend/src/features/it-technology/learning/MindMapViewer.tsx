import React, { useEffect, useRef } from "react";

interface Props { markdown: string; onNodeClick?: (text: string) => void; compact?: boolean; }

const MindMapViewer: React.FC<Props> = ({ markdown, onNodeClick, compact }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let fitFrame: number | null = null;
    let fitObserver: ResizeObserver | null = null;
    let mmInstance: any = null;

    const render = () => {
      const m = (window as any).markmap;
      if (!m?.Transformer || !m?.Markmap) { timer = setTimeout(render, 200); return; }
      if (cancelled) return;

      const transformer = new m.Transformer();
      const { root } = transformer.transform(markdown);
      container.innerHTML = "";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const bounds = container.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width || container.clientWidth || 1));
      const height = Math.max(
        1,
        Math.round(bounds.height || container.clientHeight || (compact ? 160 : 500)),
      );
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.style.width = "100%";
      svg.style.height = "100%";
      container.appendChild(svg);
      const instance = m.Markmap.create(svg, {
        autoFit: false,
        duration: compact ? 0 : 300,
      });
      mmInstance = instance;

      const fitWhenMeasurable = () => {
        if (cancelled || mmInstance !== instance) return;
        const viewport = svg.getBoundingClientRect();
        const layout = instance.state?.rect;
        const layoutIsFinite = !layout || [layout.x1, layout.x2, layout.y1, layout.y2]
          .every(Number.isFinite);
        if (viewport.width > 0 && viewport.height > 0 && layoutIsFinite) {
          fitObserver?.disconnect();
          fitObserver = null;
          void instance.fit();
          return;
        }
        if (!fitObserver && typeof ResizeObserver !== "undefined") {
          fitObserver = new ResizeObserver(fitWhenMeasurable);
          fitObserver.observe(container);
        }
      };

      void instance.setData(root).then(() => {
        if (cancelled || mmInstance !== instance) return;
        renderedRef.current = true;
        fitFrame = window.requestAnimationFrame(fitWhenMeasurable);
      });
    };

    render();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (fitFrame != null) window.cancelAnimationFrame(fitFrame);
      fitObserver?.disconnect();
      if (mmInstance) try { mmInstance.destroy(); } catch {}
      if (container && renderedRef.current) container.innerHTML = "";
      renderedRef.current = false;
    };
  }, [compact, markdown]);

  return (
    <div ref={containerRef} className="mindmap-container"
      style={{ width: "100%", height: compact ? 160 : "100%", minHeight: compact ? 160 : 500, overflow: "hidden" }} />
  );
};

export default MindMapViewer;
