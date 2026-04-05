import React, { useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DiffEditor } from "@monaco-editor/react";
import { FlowNodesLayer } from "./FlowNodesLayer";
import { FlowEdgesSvg } from "./FlowEdgesSvg";
import { useEdgeGeometries } from "../hooks/useEdgeGeometries";
import { FlowNode, FlowEdge } from "../flow/model";
import { computeBeautify, DEFAULT_BEAUTIFY_PARAMS, DEFAULT_BEAUTIFY_THRESHOLDS } from "../flow/beautify";
import { sortFlowGraphStable } from "../flow/determinism";
import { FloatingPopup } from "./FloatingPopup";
import { logger } from "@services/logger";
import { normalizeAnnotationForTeaching } from "../flow/annotationTeaching";
import { FlowAnnotationsSvg } from "./FlowAnnotationsSvg";

interface OptimizationDialogProps {
  visible: boolean;
  type: "code" | "flow";
  originalContent: any; // string for code, {nodes, edges} for flow
  optimizedContent: any; // string for code, {nodes, edges} for flow
  loading: boolean;
  onApply: () => void;
  onDiscard: () => void;
  onRegenerate: () => void;
  feedback: string;
  setFeedback: (val: string) => void;
}

const FlowPreview = ({ nodes, edges }: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
  const [layoutNodes, setLayoutNodes] = useState<FlowNode[]>([]);
  const [layoutEdges, setLayoutEdges] = useState<FlowEdge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const sorted = sortFlowGraphStable({ nodes, edges });
        const prepared = normalizeAnnotationForTeaching(sorted.nodes, sorted.edges);
        const flowNodes = prepared.nodes.filter((n) => n.type !== "annotation");
        const flowNodeIds = new Set(flowNodes.map((n) => n.id));
        const flowEdges = prepared.edges.filter((e) => flowNodeIds.has(e.from) && flowNodeIds.has(e.to));
        const resp = await computeBeautify(
          flowNodes,
          flowEdges,
          DEFAULT_BEAUTIFY_PARAMS,
          DEFAULT_BEAUTIFY_THRESHOLDS,
          { snapToGrid: true }
        );
        const laidFlowNodes = resp.layout.nodes;
        const laidNodeMap = new Map(laidFlowNodes.map((n) => [n.id, n]));
        const mergedNodes = prepared.nodes.map((n) => laidNodeMap.get(n.id) || n);
        const withAnnotations = normalizeAnnotationForTeaching(mergedNodes, prepared.edges);
        setLayoutNodes(withAnnotations.nodes);
        setLayoutEdges(withAnnotations.edges);
      } catch (e) {
        logger.error("Layout failed", e);
        setLayoutNodes(nodes);
        setLayoutEdges(edges);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [nodes, edges]);

  const { canvasMetrics, edgeGeometries } = useEdgeGeometries(layoutNodes, layoutEdges, "orthogonal", false);

  // Calculate bounds to center
  const bounds = useMemo(() => {
    if (layoutNodes.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    layoutNodes.forEach(n => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + 100); // approx width
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + 50); // approx height
    });
    return { minX, maxX, minY, maxY };
  }, [layoutNodes]);

  const scale = 0.6; // Mini preview scale
  const _width = (bounds.maxX - bounds.minX) * scale + 100;
  const _height = (bounds.maxY - bounds.minY) * scale + 100;
  const offsetX = -bounds.minX * scale + 50;
  const offsetY = -bounds.minY * scale + 50;

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative h-[400px] overflow-hidden rounded border border-border bg-surface-2">
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <FlowEdgesSvg
          edges={layoutEdges}
          edgeGeometries={edgeGeometries}
          scale={scale}
          offsetX={offsetX}
          offsetY={offsetY}
          canvasMetrics={canvasMetrics}
          selectedEdgeId={null}
          setSelectedEdgeId={() => {}}
          setSelectedNodeId={() => {}}
          connectMode={false}
          connectFromId={null}
          connectFromPort={null}
          setConnectFromId={() => {}}
          setConnectFromPort={() => {}}
          setEdges={() => {}}
          nextId={() => ""}
          onSourcePointerDown={() => {}}
          onTargetPointerDown={() => {}}
          onAnchorPointerDown={() => {}}
          canvasRef={{ current: null }}
        />
        <FlowNodesLayer
          nodes={layoutNodes}
          scale={scale}
          offsetX={offsetX}
          offsetY={offsetY}
          selectedNodeId={null}
          selectedEdgeId={null}
          selectedEdge={null}
          connectMode={false}
          connectFromId={null}
          connectFromPort={null}
          onNodePointerDown={() => {}}
          onNodeClick={() => {}}
          onPortClick={() => {}}
          onUpdateNodeTitle={() => {}}
        />
        <FlowAnnotationsSvg
          nodes={layoutNodes}
          scale={scale}
          offsetX={offsetX}
          offsetY={offsetY}
          selectedNodeId={null}
          onNodePointerDown={() => {}}
          onNodeClick={() => {}}
          onNodeDoubleClick={() => {}}
          onUpdateNodeTitle={() => {}}
        />
      </div>
    </div>
  );
};

export const OptimizationDialog: React.FC<OptimizationDialogProps> = (props) => {
  const {
    visible,
    type,
    originalContent,
    optimizedContent,
    loading,
    onApply,
    onDiscard,
    onRegenerate,
    feedback,
    setFeedback,
  } = props;
  const [flowPreviewTab, setFlowPreviewTab] = useState<"original" | "optimized">("optimized");

  return (
    <FloatingPopup
      title={type === "code" ? "代码优化建议" : "流程图优化建议"}
      open={visible}
      onClose={onDiscard}
      initialSize={{ w: 1000, h: 720 }}
      resizable
      draggable
      scrollable={false}
    >
      <div className="flex flex-col gap-4 h-full">
        <>
          {type === "code" ? (
              <div className="relative min-h-[360px] flex-1 rounded border border-border">
                <DiffEditor
                  original={typeof originalContent === "string" ? originalContent : ""}
                  modified={typeof optimizedContent === "string" ? optimizedContent : ""}
                  language="python"
                  keepCurrentOriginalModel
                  keepCurrentModifiedModel
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                  }}
                />
                {loading ? (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center"
                    style={{
                      background: "color-mix(in srgb, var(--ws-color-surface) 72%, transparent)",
                    }}
                  >
                    <div className="inline-flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm text-text-secondary shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI 正在思考优化方案...
                    </div>
                  </div>
                ) : null}
              </div>
          ) : (
            <div className="relative min-h-[360px] flex-1">
              <Tabs
                value={flowPreviewTab}
                onValueChange={(v) => setFlowPreviewTab(v as "original" | "optimized")}
                className="h-full"
              >
                <TabsList>
                  <TabsTrigger value="original">优化前</TabsTrigger>
                  <TabsTrigger value="optimized">优化后</TabsTrigger>
                </TabsList>
                <TabsContent value="original" className="mt-2">
                  <FlowPreview nodes={originalContent?.nodes || []} edges={originalContent?.edges || []} />
                </TabsContent>
                <TabsContent value="optimized" className="mt-2">
                  <FlowPreview nodes={optimizedContent?.nodes || []} edges={optimizedContent?.edges || []} />
                </TabsContent>
              </Tabs>
              {loading ? (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center"
                  style={{
                    background: "color-mix(in srgb, var(--ws-color-surface) 72%, transparent)",
                  }}
                >
                  <div className="inline-flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm text-text-secondary shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI 正在思考优化方案...
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div>
            <div className="mb-1 text-sm text-text-secondary">反馈与调整（可选）：</div>
            <Textarea
              rows={2}
              placeholder="例如：请保留原有的变量命名风格，或者减少循环嵌套..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={280}
            />
            <div className="mt-1 text-right text-xs text-text-tertiary">{feedback.length}/280</div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onRegenerate}>重新生成</Button>
            <Button variant="outline" onClick={onDiscard}>放弃</Button>
            <Button onClick={onApply}>
              应用优化
            </Button>
          </div>
        </>
      </div>
    </FloatingPopup>
  );
};
