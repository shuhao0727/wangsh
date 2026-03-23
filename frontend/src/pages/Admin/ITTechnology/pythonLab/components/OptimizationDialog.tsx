import React, { useEffect, useState, useMemo } from "react";
import { Button, Input, Tabs, Spin, Typography } from "antd";
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

const { Text } = Typography;

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
  const width = (bounds.maxX - bounds.minX) * scale + 100;
  const height = (bounds.maxY - bounds.minY) * scale + 100;
  const offsetX = -bounds.minX * scale + 50;
  const offsetY = -bounds.minY * scale + 50;

  if (loading) return <div className="h-[400px] flex items-center justify-center"><Spin /></div>;

  return (
    <div className="h-[400px] relative overflow-hidden rounded bg-surface-2" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
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
              <div className="flex-1 relative rounded" style={{ minHeight: 360, border: "1px solid rgba(0,0,0,0.08)" }}>
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
                  <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: "rgba(255,255,255,0.72)" }}>
                    <Spin tip="AI 正在思考优化方案...">
                      <div className="p-12" />
                    </Spin>
                  </div>
                ) : null}
              </div>
          ) : (
            <div className="flex-1 relative" style={{ minHeight: 360 }}>
              <Tabs
                defaultActiveKey="optimized"
                className="h-full"
                items={[
                  {
                    key: "original",
                    label: "优化前",
                    children: <FlowPreview nodes={originalContent?.nodes || []} edges={originalContent?.edges || []} />,
                  },
                  {
                    key: "optimized",
                    label: "优化后",
                    children: <FlowPreview nodes={optimizedContent?.nodes || []} edges={optimizedContent?.edges || []} />,
                  },
                ]}
              />
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: "rgba(255,255,255,0.72)" }}>
                  <Spin tip="AI 正在思考优化方案...">
                    <div className="p-12" />
                  </Spin>
                </div>
              ) : null}
            </div>
          )}

          <div>
            <Text type="secondary">反馈与调整（可选）：</Text>
            <Input.TextArea
              rows={2}
              placeholder="例如：请保留原有的变量命名风格，或者减少循环嵌套..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={280}
              showCount
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={onRegenerate}>重新生成</Button>
            <Button onClick={onDiscard}>放弃</Button>
            <Button type="primary" onClick={onApply}>
              应用优化
            </Button>
          </div>
        </>
      </div>
    </FloatingPopup>
  );
};
