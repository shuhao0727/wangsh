import React, { useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Button, Space, Typography } from "antd";
import { ExpandOutlined } from "@ant-design/icons";
import type { FlowBeautifyResult } from "../../flow/beautify";
import { FloatingPopup } from "../FloatingPopup";

const { Text } = Typography;

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
          <div style={{ fontWeight: 600 }}>完整流程图参考</div>
          <Space>
            <Button size="small" onClick={() => onRefreshBeautify?.()}>
              刷新
            </Button>
            <Button
              size="small"
              icon={<ExpandOutlined />}
              onClick={() => {
                setViewerScale(1);
                setViewerOpen(true);
              }}
            >
              放大查看
            </Button>
          </Space>
        </div>
        {beautifyLoading ? (
          <Text type="secondary">渲染中…（首次加载 wasm 可能较慢）</Text>
        ) : beautifyError ? (
          <div style={{ display: "grid", gap: 6 }}>
            <Text type="danger">Graphviz 渲染失败：{beautifyError}</Text>
            <Text type="secondary">可尝试：点击“刷新”，或刷新页面后重试。</Text>
          </div>
        ) : beautifyResult ? (
          <div style={{ border: "1px solid var(--ws-color-border-secondary)", borderRadius: 8, padding: 8, background: "var(--ws-color-surface)", overflow: "auto", maxHeight: 540 }}>
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(beautifyResult.svg, { USE_PROFILES: { svg: true }, ADD_TAGS: ["use"] }) }} />
          </div>
        ) : (
          <Text type="secondary">暂无 Graphviz 数据（请先在画布上构建流程）</Text>
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
            <Space>
              <Button size="small" onClick={() => setViewerScale((s) => Math.max(0.02, Number((s - 0.1).toFixed(2))))}>
                -
              </Button>
              <Text type="secondary">{Math.round(viewerScale * 100)}%</Text>
              <Button size="small" onClick={() => setViewerScale((s) => Math.min(6, Number((s + 0.1).toFixed(2))))}>
                +
              </Button>
              <Button size="small" onClick={fitFullGraph}>
                适配全图
              </Button>
              <Button size="small" onClick={() => setViewerScale(1)}>
                重置
              </Button>
            </Space>
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
              <Text type="secondary">暂无 Graphviz 数据（请先在画布上构建流程）</Text>
            )}
          </div>
        </div>
      </FloatingPopup>
    </>
  );
}
