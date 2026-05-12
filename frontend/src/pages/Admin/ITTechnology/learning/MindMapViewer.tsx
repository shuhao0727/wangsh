import React, { useEffect, useRef } from "react";

interface Props { markdown: string; onNodeClick?: (text: string) => void; compact?: boolean; }

const MindMapViewer: React.FC<Props> = ({ markdown, onNodeClick, compact }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let timer: any = null;
    let mmInstance: any = null;

    const render = () => {
      const m = (window as any).markmap;
      if (!m?.Transformer || !m?.Markmap) { timer = setTimeout(render, 200); return; }
      if (cancelled) return;

      const transformer = new m.Transformer();
      const { root } = transformer.transform(markdown);
      container.innerHTML = "";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      container.appendChild(svg);
      mmInstance = m.Markmap.create(svg, { duration: 300 }, root);
      renderedRef.current = true;
    };

    render();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (mmInstance) try { mmInstance.destroy(); } catch {}
      if (container && renderedRef.current) container.innerHTML = "";
      renderedRef.current = false;
    };
  }, [markdown]);

  return (
    <div ref={containerRef} className="mindmap-container"
      style={{ width: "100%", height: compact ? 160 : "100%", minHeight: compact ? 160 : 500, overflow: "hidden" }} />
  );
};

export default MindMapViewer;
