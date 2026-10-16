import React, { useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FlowBeautifyResult } from "../../flow/beautify";
import { FloatingPopup } from "../FloatingPopup";

export function PipelineTab(props: {
  beautifyResult?: FlowBeautifyResult | null;
  beautifyLoading?: boolean;
  beautifyError?: string | null;
  onRefreshBeautify?: () => void;
}) {
  const {
    beautifyResult,
    beautifyLoading,
    beautifyError,
    onRefreshBeautify,
  } = props;

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerScale, setViewerScale] = useState(1);
  const viewerBoxRef = useRef<HTMLDivElement | null>(null);
  const viewerDragRef = useRef<{ sx: number; sy: number; sl: number; st: number } | null>(null);

  const fitFullGraph = () => {
    const host = viewerBoxRef.current;
    if (!host || !beautifyResult) return;
    const svg = host.querySelector("svg") as any;
    if (!svg) return;
    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
    const w = vb && vb.width ? Number(vb.width) : svg.getBBox ? Number(svg.getBBox().width) : 0;
    const h = vb && vb.height ? Number(vb.height) : svg.getBBox ? Number(svg.getBBox().height) : 0;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    const scale = Math.max(0.01, Math.min(6, Math.min(host.clientWidth / w, host.clientHeight / h)));
    setViewerScale(Number(scale.toFixed(2)));
    host.scrollLeft = 0;
    host.scrollTop = 0;
  };

  return (
    <>
      <div style={{ height: "100%", overflow: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
          <div className="font-semibold">完整流程图参考</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onRefreshBeautify?.()}>
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setViewerScale(1);
                setViewerOpen(true);
              }}
            >
              <Maximize2 className="h-4 w-4" />
              放大查看
            </Button>
          </div>
        </div>
        {beautifyLoading ? (
          <span className="text-sm text-text-secondary">渲染中…（首次加载 wasm 可能较慢）</span>
        ) : beautifyError ? (
          <div style={{ display: "grid", gap: 6 }}>
            <span className="text-sm text-destructive">Graphviz 渲染失败：{beautifyError}</span>
            <span className="text-sm text-text-secondary">可尝试：点击“刷新”，或刷新页面后重试。</span>
          </div>
        ) : beautifyResult ? (
          <div style={{ border: "1px solid var(--ws-color-border-secondary)", borderRadius: 8, padding: 8, background: "var(--ws-color-surface)", overflow: "auto", maxHeight: 540 }}>
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(beautifyResult.svg, { USE_PROFILES: { svg: true }, ADD_TAGS: ["use"] }) }} />
          </div>
        ) : (
          <span className="text-sm text-text-secondary">暂无 Graphviz 数据（请先在画布上构建流程）</span>
        )}
      </div>

      <FloatingPopup
        open={viewerOpen}
        title="完整流程图（Graphviz）"
        initialSize={{ w: 1020, h: 760 }}
        onClose={() => setViewerOpen(false)}
        scrollable={false}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "var(--ws-color-surface)",
              borderBottom: "1px solid var(--ws-color-border)",
              paddingBottom: 10,
              flexShrink: 0,
            }}
          >
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewerScale((s) => Math.max(0.02, Number((s - 0.1).toFixed(2))))}>
                -
              </Button>
              <span className="text-sm text-text-secondary">{Math.round(viewerScale * 100)}%</span>
              <Button variant="outline" size="sm" onClick={() => setViewerScale((s) => Math.min(6, Number((s + 0.1).toFixed(2))))}>
                +
              </Button>
              <Button variant="outline" size="sm" onClick={fitFullGraph}>
                适配全图
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewerScale(1)}>
                重置
              </Button>
            </div>
          </div>
          <div
            ref={viewerBoxRef}
            style={{ border: "1px solid var(--ws-color-border-secondary)", borderRadius: 8, padding: 8, background: "var(--ws-color-surface)", overflow: "auto", flex: 1, minHeight: 0, cursor: "grab" }}
            onPointerDown={(evt) => {
              const host = viewerBoxRef.current;
              if (!host) return;
              (evt.currentTarget as HTMLElement).setPointerCapture(evt.pointerId);
              viewerDragRef.current = { sx: evt.clientX, sy: evt.clientY, sl: host.scrollLeft, st: host.scrollTop };
            }}
            onPointerMove={(evt) => {
              const host = viewerBoxRef.current;
              const d = viewerDragRef.current;
              if (!host || !d) return;
              host.scrollLeft = d.sl - (evt.clientX - d.sx);
              host.scrollTop = d.st - (evt.clientY - d.sy);
            }}
            onPointerUp={() => {
              viewerDragRef.current = null;
            }}
          >
            {beautifyResult ? (
              <div style={{ transform: `scale(${viewerScale})`, transformOrigin: "0 0" }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(beautifyResult.svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ["use"] }) }} />
            ) : (
              <span className="text-sm text-text-secondary">暂无 Graphviz 数据（请先在画布上构建流程）</span>
            )}
          </div>
        </div>
      </FloatingPopup>
    </>
  );
}
