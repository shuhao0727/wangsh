import React, { useRef, useState } from "react";
import { Button, Card, Collapse, Empty, InputNumber, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { ExpandOutlined } from "@ant-design/icons";
import type { FlowBeautifyParams, FlowBeautifyResult } from "../../flow/beautify";
import type { FlowTidyResult } from "../../flow/tidy";
import type { PythonLabPseudocodeParseResponse } from "../../services/pythonlabDebugApi";
import type { PythonLabRuleSetV1 } from "../../pipeline/rules";
import { PipelineRuleLibrary } from "../PipelineRuleLibrary";
import { FloatingPopup } from "../FloatingPopup";

const { Text } = Typography;

export function PipelineTab(props: {
  pipelineEnabled: boolean;
  canEdit: boolean;
  onTogglePipelineMode?: (v: boolean) => void;
  pseudocode?: PythonLabPseudocodeParseResponse | null;
  pseudocodeLoading?: boolean;
  pseudocodeError?: string | null;
  tidyResult?: FlowTidyResult | null;
  onApplyTidy?: () => void;
  beautifyParams?: FlowBeautifyParams;
  setBeautifyParams?: (next: FlowBeautifyParams) => void;
  beautifyResult?: FlowBeautifyResult | null;
  beautifyLoading?: boolean;
  beautifyError?: string | null;
  onRefreshBeautify?: () => void;
  onApplyBeautify?: (mode?: "nodes" | "nodes_edges") => void;
  canvasRoutingStyle?: "orthogonal" | "direct";
  setCanvasRoutingStyle?: (v: "orthogonal" | "direct") => void;
  ruleSet?: PythonLabRuleSetV1;
  setRuleSet?: (next: PythonLabRuleSetV1) => void;
  experimentId?: string;
}) {
  const {
    pipelineEnabled,
    canEdit,
    onTogglePipelineMode,
    pseudocode,
    pseudocodeLoading,
    pseudocodeError,
    tidyResult,
    onApplyTidy,
    beautifyParams,
    setBeautifyParams,
    beautifyResult,
    beautifyLoading,
    beautifyError,
    onRefreshBeautify,
    onApplyBeautify,
    canvasRoutingStyle,
    setCanvasRoutingStyle,
    ruleSet,
    setRuleSet,
    experimentId,
  } = props;

  const [pipelineViewerOpen, setPipelineViewerOpen] = useState(false);
  const [pipelineSvgScale, setPipelineSvgScale] = useState(1);
  const pipelineSvgBoxRef = useRef<HTMLDivElement | null>(null);
  const pipelineSvgDragRef = useRef<{ sx: number; sy: number; sl: number; st: number } | null>(null);

  const [fullGraphViewerOpen, setFullGraphViewerOpen] = useState(false);
  const [fullGraphScale, setFullGraphScale] = useState(1);
  const fullGraphBoxRef = useRef<HTMLDivElement | null>(null);
  const fullGraphDragRef = useRef<{ sx: number; sy: number; sl: number; st: number } | null>(null);

  const [applyBeautifyMode, setApplyBeautifyMode] = useState<"nodes" | "nodes_edges">("nodes");

  if (!pipelineEnabled) {
    return (
      <div style={{ height: "100%", overflow: "auto", padding: 12 }}>
        <Empty
          description={
            <div style={{ display: "grid", gap: 6 }}>
              <div>流水线模式已关闭</div>
              <Text type="secondary">开启后可在此预览伪代码、Tidy 与 Graphviz 布局。</Text>
            </div>
          }
        >
          <Button type="primary" disabled={!onTogglePipelineMode} onClick={() => onTogglePipelineMode?.(true)}>
            开启流水线
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <>
      <div style={{ height: "100%", overflow: "auto", padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>流水线模式</div>
          <Button
            size="small"
            icon={<ExpandOutlined />}
            onClick={() => {
              setPipelineSvgScale(1);
              setPipelineViewerOpen(true);
            }}
          >
            放大查看
          </Button>
          <Button
            size="small"
            onClick={() => {
              setFullGraphScale(1);
              setFullGraphViewerOpen(true);
            }}
          >
            完整流程图
          </Button>
        </div>
        <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 12 }}>原始代码 → 伪代码 → 流程图（Raw/Tidy/Beautify）</div>

        <div style={{ marginBottom: 10 }}>
          {ruleSet && setRuleSet && experimentId ? (
            <PipelineRuleLibrary
              experimentId={experimentId}
              ruleSet={ruleSet}
              setRuleSet={setRuleSet}
              currentTidy={tidyResult ? { raw: tidyResult.raw.stats, tidy: tidyResult.tidy.stats, log: tidyResult.log } : null}
              currentBeautify={beautifyResult ? { stats: beautifyResult.stats, metrics: beautifyResult.metrics } : null}
            />
          ) : (
            <Text type="secondary">规则库未就绪</Text>
          )}
        </div>

        <Card size="small" title="伪代码" styles={{ body: { padding: 10 } }}>
          {pseudocodeLoading ? (
            <Text type="secondary">加载中…</Text>
          ) : pseudocodeError ? (
            <div style={{ display: "grid", gap: 6 }}>
              <Text type="danger">{pseudocodeError}</Text>
              <Text type="secondary">可尝试：检查语法、点击“从流程图同步”、或重新进入示例。</Text>
            </div>
          ) : pseudocode ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>输入</div>
                {pseudocode.input.items.length ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {pseudocode.input.items.map((it, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8 }}>
                        <Text type="secondary">-</Text>
                        <Text>{it.text}</Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary">无</Text>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>处理</div>
                {pseudocode.process.items.length ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {pseudocode.process.items.map((it, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8 }}>
                        <Text type="secondary">{idx + 1}.</Text>
                        <Text>{it.text}</Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary">无</Text>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>输出</div>
                {pseudocode.output.items.length ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {pseudocode.output.items.map((it, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8 }}>
                        <Text type="secondary">-</Text>
                        <Text>{it.text}</Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary">无</Text>
                )}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 600 }}>转换信息</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Tag color={pseudocode.reversibility.level === "high" ? "green" : pseudocode.reversibility.level === "medium" ? "orange" : "red"}>
                    可逆性 {pseudocode.reversibility.score.toFixed(2)}
                  </Tag>
                  <Text type="secondary">Parser: {pseudocode.parserVersion}</Text>
                </div>
                {pseudocode.reversibility.reasons?.length ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {pseudocode.reversibility.reasons.map((r, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8 }}>
                        <Text type="secondary">-</Text>
                        <Text>{r}</Text>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 600 }}>规则使用</div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={pseudocode.rulesUsed}
                  rowKey="id"
                  columns={[
                    { title: "ID", dataIndex: "id", key: "id", width: 160 },
                    { title: "次数", dataIndex: "count", key: "count", width: 70 },
                    { title: "说明", dataIndex: "description", key: "description", ellipsis: true },
                  ]}
                  locale={{ emptyText: "暂无" }}
                  scroll={{ x: "max-content" }}
                />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 600 }}>信息损失点</div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={pseudocode.lossPoints}
                  rowKey={(r) => `${r.code}-${r.message}-${r.range?.startLine ?? 0}-${r.range?.startCol ?? 0}`}
                  columns={[
                    { title: "代码", dataIndex: "code", key: "code", width: 150 },
                    { title: "说明", dataIndex: "message", key: "message", ellipsis: true },
                    {
                      title: "位置",
                      key: "pos",
                      width: 90,
                      render: (_: any, r: any) => (
                        <Text type="secondary">{typeof r?.range?.startLine === "number" ? `${r.range.startLine}:${r.range.startCol ?? 0}` : "-"}</Text>
                      ),
                    },
                  ]}
                  locale={{ emptyText: "暂无" }}
                  scroll={{ x: "max-content" }}
                />
              </div>
            </div>
          ) : (
            <Text type="secondary">暂无数据（画布为空或后端解析失败）</Text>
          )}
        </Card>

        <div style={{ height: 10 }} />

        <Card
          size="small"
          title="Tidy（整理）"
          extra={
            <Button size="small" type="primary" onClick={() => onApplyTidy?.()} disabled={!tidyResult}>
              应用到画布
            </Button>
          }
          styles={{ body: { padding: 10 } }}
        >
          {tidyResult ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 600 }}>指标</div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={[
                    { key: "nodeCount", name: "节点数", raw: tidyResult.raw.stats.nodeCount, tidy: tidyResult.tidy.stats.nodeCount },
                    { key: "edgeCount", name: "边数", raw: tidyResult.raw.stats.edgeCount, tidy: tidyResult.tidy.stats.edgeCount },
                    { key: "cross", name: "交叉边数", raw: tidyResult.raw.stats.crossingCount, tidy: tidyResult.tidy.stats.crossingCount },
                    { key: "depth", name: "近似决策深度", raw: tidyResult.raw.stats.approxMaxDecisionDepth, tidy: tidyResult.tidy.stats.approxMaxDecisionDepth },
                    { key: "crit", name: "关键路径节点数", raw: tidyResult.raw.stats.criticalPathNodeCount, tidy: tidyResult.tidy.stats.criticalPathNodeCount },
                  ]}
                  columns={[
                    { title: "指标", dataIndex: "name", key: "name" },
                    { title: "Raw", dataIndex: "raw", key: "raw", width: 90 },
                    { title: "Tidy", dataIndex: "tidy", key: "tidy", width: 90 },
                  ]}
                  locale={{ emptyText: "暂无" }}
                  scroll={{ x: "max-content" }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 600 }}>变换记录</div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={tidyResult.log.map((x, i) => ({ ...x, key: `${x.ruleId}-${i}` }))}
                  columns={[
                    { title: "规则", dataIndex: "ruleId", key: "ruleId", width: 160 },
                    { title: "说明", dataIndex: "description", key: "description", ellipsis: true },
                  ]}
                  locale={{ emptyText: "暂无" }}
                  scroll={{ x: "max-content" }}
                />
              </div>
            </div>
          ) : (
            <Text type="secondary">暂无数据（画布为空或暂未生成可整理结果）</Text>
          )}
        </Card>

        <div style={{ height: 10 }} />

        <Card
          size="small"
          title="Beautify（Graphviz）"
          extra={
            <Space>
              <Button size="small" onClick={() => onRefreshBeautify?.()} disabled={!pipelineEnabled}>
                重新渲染
              </Button>
              <Select
                size="small"
                style={{ width: 118 }}
                value={applyBeautifyMode}
                onChange={(v) => setApplyBeautifyMode(v)}
                options={[
                  { label: "仅应用节点", value: "nodes" },
                  { label: "节点+连线", value: "nodes_edges" },
                ]}
              />
              <Button size="small" type="primary" onClick={() => onApplyBeautify?.(applyBeautifyMode)} disabled={!beautifyResult}>
                应用布局到画布
              </Button>
            </Space>
          }
          styles={{ body: { padding: 10 } }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Text type="secondary">方向</Text>
              <Select
                size="small"
                style={{ width: 90 }}
                value={beautifyParams?.rankdir ?? "TB"}
                onChange={(v) => {
                  if (!beautifyParams || !setBeautifyParams) return;
                  setBeautifyParams({ ...beautifyParams, rankdir: v });
                }}
                disabled={!canEdit}
                options={[
                  { label: "TB", value: "TB" },
                  { label: "LR", value: "LR" },
                ]}
              />
              <Text type="secondary">引擎</Text>
              <Select
                size="small"
                style={{ width: 100 }}
                value={(beautifyParams as any)?.engine ?? "dot"}
                onChange={(v) => {
                  if (!beautifyParams || !setBeautifyParams) return;
                  setBeautifyParams({ ...(beautifyParams as any), engine: v } as any);
                }}
                disabled={!canEdit}
                options={[
                  { label: "dot", value: "dot" },
                  { label: "neato", value: "neato" },
                  { label: "fdp", value: "fdp" },
                ]}
              />
              <Text type="secondary">连线</Text>
              <Select
                size="small"
                style={{ width: 120 }}
                value={(beautifyParams as any)?.splines ?? "spline"}
                onChange={(v) => {
                  if (!beautifyParams || !setBeautifyParams) return;
                  setBeautifyParams({ ...(beautifyParams as any), splines: v } as any);
                }}
                disabled={!canEdit}
                options={[
                  { label: "spline", value: "spline" },
                  { label: "polyline", value: "polyline" },
                  { label: "ortho", value: "ortho" },
                ]}
              />
              <Text type="secondary">合并同向</Text>
              <Switch
                size="small"
                checked={!!(beautifyParams as any)?.concentrate}
                onChange={(v) => {
                  if (!beautifyParams || !setBeautifyParams) return;
                  setBeautifyParams({ ...(beautifyParams as any), concentrate: v } as any);
                }}
                disabled={!canEdit}
              />
              <Text type="secondary">节点间距</Text>
              <InputNumber
                size="small"
                min={0.05}
                max={2.5}
                step={0.05}
                style={{ width: 110 }}
                value={beautifyParams?.nodesep ?? 0.35}
                onChange={(v) => {
                  if (!beautifyParams || !setBeautifyParams) return;
                  const n = typeof v === "number" ? v : beautifyParams.nodesep;
                  setBeautifyParams({ ...beautifyParams, nodesep: n });
                }}
                disabled={!canEdit}
              />
              <Text type="secondary">层间距</Text>
              <InputNumber
                size="small"
                min={0.05}
                max={3.5}
                step={0.05}
                style={{ width: 110 }}
                value={beautifyParams?.ranksep ?? 0.55}
                onChange={(v) => {
                  if (!beautifyParams || !setBeautifyParams) return;
                  const n = typeof v === "number" ? v : beautifyParams.ranksep;
                  setBeautifyParams({ ...beautifyParams, ranksep: n });
                }}
                disabled={!canEdit}
              />
              <Text type="secondary">字体大小</Text>
              <InputNumber
                size="small"
                min={8}
                max={22}
                step={1}
                style={{ width: 110 }}
                value={(beautifyParams as any)?.fontSize ?? 12}
                onChange={(v) => {
                  if (!beautifyParams || !setBeautifyParams) return;
                  const n = typeof v === "number" ? v : (beautifyParams as any).fontSize ?? 12;
                  setBeautifyParams({ ...(beautifyParams as any), fontSize: n } as any);
                }}
                disabled={!canEdit}
              />
              <Text type="secondary">边距</Text>
              <InputNumber
                size="small"
                min={0}
                max={1.5}
                step={0.05}
                style={{ width: 110 }}
                value={(beautifyParams as any)?.pad ?? 0.15}
                onChange={(v) => {
                  if (!beautifyParams || !setBeautifyParams) return;
                  const n = typeof v === "number" ? v : (beautifyParams as any).pad ?? 0.15;
                  setBeautifyParams({ ...(beautifyParams as any), pad: n } as any);
                }}
                disabled={!canEdit}
              />
              <Text type="secondary">画布连线</Text>
              <Select
                size="small"
                style={{ width: 120 }}
                value={canvasRoutingStyle ?? "orthogonal"}
                onChange={(v) => setCanvasRoutingStyle?.(v as any)}
                disabled={!canEdit}
                options={[
                  { label: "横平竖直", value: "orthogonal" },
                  { label: "直接连线", value: "direct" },
                ]}
              />
            </div>

            {beautifyLoading ? (
              <Text type="secondary">渲染中…（首次加载 wasm 可能较慢）</Text>
            ) : beautifyError ? (
              <div style={{ display: "grid", gap: 6 }}>
                <Text type="danger">Graphviz 渲染失败：{beautifyError}</Text>
                <Text type="secondary">可尝试：点击“重新渲染”，或刷新页面后重试。</Text>
              </div>
            ) : beautifyResult ? (
              <>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={beautifyResult.metrics.map((m) => ({ ...m, key: m.name }))}
                  columns={[
                    {
                      title: "指标",
                      dataIndex: "name",
                      key: "name",
                      width: 120,
                      render: (v: any) => {
                        const k = String(v || "");
                        const map: Record<string, string> = { nodes: "节点数", crossings: "交叉数", contrast: "对比度", flowAngle: "流向偏差" };
                        return map[k] ?? k;
                      },
                    },
                    { title: "值", dataIndex: "value", key: "value", width: 90 },
                    { title: "阈值", dataIndex: "thresholdText", key: "thresholdText", width: 100 },
                    { title: "结果", key: "pass", width: 80, render: (_: any, r: any) => <Tag color={r.pass ? "green" : "red"}>{r.pass ? "PASS" : "FAIL"}</Tag> },
                  ]}
                  locale={{ emptyText: "暂无" }}
                  scroll={{ x: "max-content" }}
                />
                <div style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: 8, background: "#fff", overflow: "auto", maxHeight: 420 }}>
                  <div dangerouslySetInnerHTML={{ __html: beautifyResult.svg }} />
                </div>
              </>
            ) : (
              <Text type="secondary">暂无数据（画布为空或暂未生成可渲染结果）</Text>
            )}
          </div>
        </Card>
      </div>

      <FloatingPopup open={pipelineViewerOpen} title="流水线（放大查看）" initialSize={{ w: 980, h: 720 }} onClose={() => setPipelineViewerOpen(false)}>
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "#ffffff",
              borderBottom: "1px solid var(--ws-color-border)",
              paddingBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 600 }}>原始代码 → 伪代码 → 流程图（Raw/Tidy/Beautify）</div>
              <Space>
                <Button size="small" onClick={() => setPipelineSvgScale((s) => Math.max(0.02, Number((s - 0.1).toFixed(2))))}>
                  -
                </Button>
                <Text type="secondary">{Math.round(pipelineSvgScale * 100)}%</Text>
                <Button size="small" onClick={() => setPipelineSvgScale((s) => Math.min(3, Number((s + 0.1).toFixed(2))))}>
                  +
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const host = pipelineSvgBoxRef.current;
                    if (!host) return;
                    const svg = host.querySelector("svg") as any;
                    if (!svg) return;
                    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
                    const w = vb && vb.width ? Number(vb.width) : svg.getBBox ? Number(svg.getBBox().width) : 0;
                    if (!Number.isFinite(w) || w <= 0) return;
                    const scale = Math.max(0.01, Math.min(6, host.clientWidth / w));
                    setPipelineSvgScale(Number(scale.toFixed(2)));
                    host.scrollLeft = 0;
                    host.scrollTop = 0;
                  }}
                >
                  适配宽度
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const host = pipelineSvgBoxRef.current;
                    if (!host) return;
                    const svg = host.querySelector("svg") as any;
                    if (!svg) return;
                    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
                    const h = vb && vb.height ? Number(vb.height) : svg.getBBox ? Number(svg.getBBox().height) : 0;
                    if (!Number.isFinite(h) || h <= 0) return;
                    const scale = Math.max(0.01, Math.min(6, host.clientHeight / h));
                    setPipelineSvgScale(Number(scale.toFixed(2)));
                    host.scrollLeft = 0;
                    host.scrollTop = 0;
                  }}
                >
                  适配高度
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const host = pipelineSvgBoxRef.current;
                    if (!host) return;
                    const svg = host.querySelector("svg") as any;
                    if (!svg) return;
                    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
                    const w = vb && vb.width ? Number(vb.width) : svg.getBBox ? Number(svg.getBBox().width) : 0;
                    const h = vb && vb.height ? Number(vb.height) : svg.getBBox ? Number(svg.getBBox().height) : 0;
                    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
                    const scale = Math.max(0.01, Math.min(6, Math.min(host.clientWidth / w, host.clientHeight / h)));
                    setPipelineSvgScale(Number(scale.toFixed(2)));
                    host.scrollLeft = 0;
                    host.scrollTop = 0;
                  }}
                >
                  适配全图
                </Button>
                <Button size="small" onClick={() => setPipelineSvgScale(1)}>
                  重置
                </Button>
              </Space>
            </div>
          </div>

          <div style={{ marginBottom: 4 }}>
            {ruleSet && setRuleSet && experimentId ? (
              <PipelineRuleLibrary
                experimentId={experimentId}
                ruleSet={ruleSet}
                setRuleSet={setRuleSet}
                currentTidy={tidyResult ? { raw: tidyResult.raw.stats, tidy: tidyResult.tidy.stats, log: tidyResult.log } : null}
                currentBeautify={beautifyResult ? { stats: beautifyResult.stats, metrics: beautifyResult.metrics } : null}
              />
            ) : null}
          </div>

          <Collapse
            size="small"
            defaultActiveKey={["beautify"]}
            items={[
              {
                key: "pseudocode",
                label: "伪代码",
                children: pseudocodeLoading ? (
                  <Text type="secondary">加载中…</Text>
                ) : pseudocodeError ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <Text type="danger">{pseudocodeError}</Text>
                    <Text type="secondary">可尝试：检查语法、点击“从流程图同步”、或重新进入示例。</Text>
                  </div>
                ) : pseudocode ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
                    {JSON.stringify(pseudocode, null, 2)}
                  </pre>
                ) : (
                  <Text type="secondary">暂无数据</Text>
                ),
              },
              {
                key: "tidy",
                label: "Tidy（整理）",
                children: tidyResult ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
                    {JSON.stringify({ stats: { raw: tidyResult.raw.stats, tidy: tidyResult.tidy.stats }, log: tidyResult.log }, null, 2)}
                  </pre>
                ) : (
                  <Text type="secondary">暂无数据</Text>
                ),
              },
              {
                key: "beautify",
                label: "Beautify（Graphviz）",
                children: beautifyLoading ? (
                  <Text type="secondary">渲染中…</Text>
                ) : beautifyError ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <Text type="danger">Graphviz 渲染失败：{beautifyError}</Text>
                    <Text type="secondary">可尝试：点击“重新渲染”，或刷新页面后重试。</Text>
                  </div>
                ) : beautifyResult ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={beautifyResult.metrics.map((m) => ({ ...m, key: m.name }))}
                      columns={[
                        {
                          title: "指标",
                          dataIndex: "name",
                          key: "name",
                          width: 120,
                          render: (v: any) => {
                            const k = String(v || "");
                            const map: Record<string, string> = { nodes: "节点数", crossings: "交叉数", contrast: "对比度", flowAngle: "流向偏差" };
                            return map[k] ?? k;
                          },
                        },
                        { title: "值", dataIndex: "value", key: "value", width: 90 },
                        { title: "阈值", dataIndex: "thresholdText", key: "thresholdText", width: 100 },
                        { title: "结果", key: "pass", width: 80, render: (_: any, r: any) => <Tag color={r.pass ? "green" : "red"}>{r.pass ? "PASS" : "FAIL"}</Tag> },
                      ]}
                      locale={{ emptyText: "暂无" }}
                      scroll={{ x: "max-content" }}
                    />
                    <div
                      ref={pipelineSvgBoxRef}
                      style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: 8, background: "#fff", overflow: "auto", height: 520, cursor: "grab" }}
                      onPointerDown={(evt) => {
                        const host = pipelineSvgBoxRef.current;
                        if (!host) return;
                        pipelineSvgDragRef.current = { sx: evt.clientX, sy: evt.clientY, sl: host.scrollLeft, st: host.scrollTop };
                        (evt.currentTarget as HTMLElement).setPointerCapture(evt.pointerId);
                      }}
                      onPointerMove={(evt) => {
                        const host = pipelineSvgBoxRef.current;
                        const d = pipelineSvgDragRef.current;
                        if (!host || !d) return;
                        host.scrollLeft = d.sl - (evt.clientX - d.sx);
                        host.scrollTop = d.st - (evt.clientY - d.sy);
                      }}
                      onPointerUp={() => {
                        pipelineSvgDragRef.current = null;
                      }}
                    >
                      <div style={{ transform: `scale(${pipelineSvgScale})`, transformOrigin: "0 0" }} dangerouslySetInnerHTML={{ __html: beautifyResult.svg }} />
                    </div>
                  </div>
                ) : (
                  <Text type="secondary">暂无数据</Text>
                ),
              },
            ]}
          />
        </div>
      </FloatingPopup>

      <FloatingPopup open={fullGraphViewerOpen} title="完整流程图（Graphviz）" initialSize={{ w: 1020, h: 760 }} onClose={() => setFullGraphViewerOpen(false)} scrollable={false}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "#ffffff",
              borderBottom: "1px solid var(--ws-color-border)",
              paddingBottom: 10,
              flexShrink: 0,
            }}
          >
            <Space>
              <Button size="small" onClick={() => setFullGraphScale((s) => Math.max(0.02, Number((s - 0.1).toFixed(2))))}>
                -
              </Button>
              <Text type="secondary">{Math.round(fullGraphScale * 100)}%</Text>
              <Button size="small" onClick={() => setFullGraphScale((s) => Math.min(6, Number((s + 0.1).toFixed(2))))}>
                +
              </Button>
              <Button
                size="small"
                onClick={() => {
                  const host = fullGraphBoxRef.current;
                  if (!host || !beautifyResult) return;
                  const svg = host.querySelector("svg") as any;
                  if (!svg) return;
                  const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
                  const w = vb && vb.width ? Number(vb.width) : svg.getBBox ? Number(svg.getBBox().width) : 0;
                  const h = vb && vb.height ? Number(vb.height) : svg.getBBox ? Number(svg.getBBox().height) : 0;
                  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
                  const scale = Math.max(0.01, Math.min(6, Math.min(host.clientWidth / w, host.clientHeight / h)));
                  setFullGraphScale(Number(scale.toFixed(2)));
                  host.scrollLeft = 0;
                  host.scrollTop = 0;
                }}
              >
                适配全图
              </Button>
              <Button size="small" onClick={() => setFullGraphScale(1)}>
                重置
              </Button>
            </Space>
          </div>
          <div
            ref={fullGraphBoxRef}
            style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: 8, background: "#fff", overflow: "auto", flex: 1, minHeight: 0, cursor: "grab" }}
            onPointerDown={(evt) => {
              const host = fullGraphBoxRef.current;
              if (!host) return;
              (evt.currentTarget as HTMLElement).setPointerCapture(evt.pointerId);
              fullGraphDragRef.current = { sx: evt.clientX, sy: evt.clientY, sl: host.scrollLeft, st: host.scrollTop };
            }}
            onPointerMove={(evt) => {
              const host = fullGraphBoxRef.current;
              const d = fullGraphDragRef.current;
              if (!host || !d) return;
              host.scrollLeft = d.sl - (evt.clientX - d.sx);
              host.scrollTop = d.st - (evt.clientY - d.sy);
            }}
            onPointerUp={() => {
              fullGraphDragRef.current = null;
            }}
          >
            {beautifyResult ? (
              <div style={{ transform: `scale(${fullGraphScale})`, transformOrigin: "0 0" }} dangerouslySetInnerHTML={{ __html: beautifyResult.svg }} />
            ) : (
              <Text type="secondary">暂无 Graphviz 数据（请先运行 Beautify）</Text>
            )}
          </div>
        </div>
      </FloatingPopup>
    </>
  );
}
