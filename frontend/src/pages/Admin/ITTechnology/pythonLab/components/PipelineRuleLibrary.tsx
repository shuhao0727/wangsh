import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Checkbox, Divider, Input, InputNumber, Modal, Progress, Segmented, Select, Space, Switch, Table, Tag, Tooltip, Typography, Upload } from "antd";
import { DownloadOutlined, UploadOutlined, PlayCircleOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import type { PythonLabRuleSetV1 } from "../pipeline/rules";
import {
  RULESET_PRESETS_V1,
  clearRuleSetOverrideV1,
  loadEffectiveRuleSetV1,
  loadRuleSetBundleV1,
  normalizeRuleSetBundleV1,
  normalizeRuleSetV1,
  saveRuleSetBundleV1,
  saveRuleSetGlobalV1,
  saveRuleSetOverrideV1,
} from "../pipeline/rules";
import useAuth from "@hooks/useAuth";
import { createRecord, loadPipelineRecords, savePipelineRecords, type PythonLabPipelineRecordV1 } from "../pipeline/records";
import { loadPythonLabExperiments } from "../storage";
import { pythonlabFlowApi } from "../services/pythonlabDebugApi";
import { cfgToFlow } from "../flow/cfg_to_flow";
import { arrangeFlow } from "../flow/arrange";
import { computeTidy } from "../flow/tidy";
import { computeBeautify } from "../flow/beautify";

const { Text } = Typography;

function downloadJson(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PipelineRuleLibrary(props: {
  experimentId: string;
  ruleSet: PythonLabRuleSetV1;
  setRuleSet: (next: PythonLabRuleSetV1) => void;
  currentTidy?: any;
  currentBeautify?: any;
}) {
  const { experimentId, ruleSet, setRuleSet, currentTidy, currentBeautify } = props;
  const auth = useAuth();
  const canEdit = auth.isAdmin();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"表单" | "JSON">("表单");
  const [scope, setScope] = useState<"全局" | "仅此示例">("全局");
  const [presetKey, setPresetKey] = useState<string>("classroom");
  const [jsonText, setJsonText] = useState(() => JSON.stringify(ruleSet, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [records, setRecords] = useState<PythonLabPipelineRecordV1[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ total: number; done: number; current?: string }>({ total: 0, done: 0 });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PythonLabPipelineRecordV1 | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    setRecords(loadPipelineRecords().sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    setJsonText(JSON.stringify(ruleSet, null, 2));
  }, [ruleSet]);

  useEffect(() => {
    try {
      const bundle = loadRuleSetBundleV1();
      const hasOverride = !!(bundle.overrides && bundle.overrides[String(experimentId)]);
      setScope(hasOverride ? "仅此示例" : "全局");
    } catch {
      setScope("全局");
    }
  }, [experimentId, open]);

  const currentExperimentTitle = useMemo(() => {
    const all = loadPythonLabExperiments();
    return all.find((e) => e.id === experimentId)?.title ?? experimentId;
  }, [experimentId]);

  const tidyLabels: Array<{ id: string; title: string }> = [
    { id: "R_TIDY_START_END", title: "规范入口/出口" },
    { id: "R_TIDY_CONNECT_DEG0", title: "连接孤立节点" },
    { id: "R_TIDY_JOIN_MERGE", title: "分支合流（join）" },
    { id: "R_TIDY_COLLAPSE_CONNECTOR", title: "折叠冗余连接点" },
    { id: "R_TIDY_MERGE_LINEAR_PROCESS", title: "合并线性步骤" },
    { id: "R_TIDY_MARK_CRITICAL", title: "标注关键路径" },
  ];

  const saveByScope = (next: PythonLabRuleSetV1) => {
    if (scope === "仅此示例") saveRuleSetOverrideV1(experimentId, next);
    else saveRuleSetGlobalV1(next);
  };

  const applyJson = () => {
    if (!canEdit) return;
    try {
      const parsed = JSON.parse(jsonText);
      const normalized = normalizeRuleSetV1(parsed);
      saveByScope(normalized);
      setRuleSet(normalized);
      setJsonError(null);
    } catch (e: any) {
      setJsonError((e?.message && String(e.message)) || "JSON 解析失败");
    }
  };

  const reloadFromStorage = () => {
    const v = loadEffectiveRuleSetV1(experimentId);
    setRuleSet(v);
    setJsonError(null);
  };

  const applyForm = () => {
    if (!canEdit) return;
    try {
      const normalized = normalizeRuleSetV1(ruleSet);
      saveByScope(normalized);
      setRuleSet(normalized);
      setJsonError(null);
    } catch (e: any) {
      setJsonError((e?.message && String(e.message)) || "规则集应用失败");
    }
  };

  const applyPreset = (key: string) => {
    const found = RULESET_PRESETS_V1.find((x) => x.key === key)?.ruleSet ?? RULESET_PRESETS_V1[0]?.ruleSet ?? ruleSet;
    setRuleSet(normalizeRuleSetV1(found));
    setJsonError(null);
  };

  const exportBundle = () => {
    if (!canEdit) return;
    const bundle = loadRuleSetBundleV1();
    downloadJson("pythonlab_ruleset_bundle.json", bundle);
  };

  const importBundle = async (text: string) => {
    if (!canEdit) return;
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && parsed.version === 1 && parsed.global) {
      const bundle = normalizeRuleSetBundleV1(parsed);
      saveRuleSetBundleV1(bundle);
      setScope(bundle.overrides && bundle.overrides[String(experimentId)] ? "仅此示例" : "全局");
      setRuleSet(loadEffectiveRuleSetV1(experimentId));
      setJsonError(null);
      return;
    }
    setJsonText(text);
  };

  const clearOverride = () => {
    if (!canEdit) return;
    clearRuleSetOverrideV1(experimentId);
    setScope("全局");
    setRuleSet(loadEffectiveRuleSetV1(experimentId));
    setJsonError(null);
  };

  const recordCurrent = async () => {
    const rec = await createRecord({ experimentId, ruleSet, tidy: currentTidy, beautify: currentBeautify });
    const next = [rec, ...records].slice(0, 200);
    setRecords(next);
    savePipelineRecords(next);
  };

  const deleteRecord = (id: string) => {
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    savePipelineRecords(next);
  };

  const runAllExperiments = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    const exps = loadPythonLabExperiments();
    setProgress({ total: exps.length, done: 0, current: "" });
    try {
      const produced: PythonLabPipelineRecordV1[] = [];
      for (let i = 0; i < exps.length; i++) {
        const exp = exps[i];
        setProgress({ total: exps.length, done: i, current: exp.title });
        try {
          const flow = await pythonlabFlowApi.parseFlow(exp.starterCode, { limits: { maxParseMs: 1500 } });
          const cfg: any = { sourcePath: `/${exp.id}.py`, version: flow.parserVersion, nodes: flow.nodes, edges: flow.edges, diagnostics: flow.diagnostics || [], exitNodeIds: flow.exitNodeIds, exitEdges: flow.exitEdges, entryNodeId: flow.entryNodeId };
          const raw = cfgToFlow(cfg as any);
          const laid = await arrangeFlow(raw.nodes as any, raw.edges as any, { width: 1200, height: 800 });
          const tidy = computeTidy(laid.nodes as any, laid.edges as any, { enabled: ruleSet.tidy.enabled });
          let beautify: any = null;
          let beautifyError: string | null = null;
          try {
            beautify = await computeBeautify(tidy.tidy.nodes as any, tidy.tidy.edges as any, ruleSet.beautify.params, ruleSet.beautify.thresholds);
          } catch (e: any) {
            beautifyError = (e?.message && String(e.message)) || "Beautify 失败";
          }
          const rec = await createRecord({
            experimentId: exp.id,
            ruleSet,
            tidy: { raw: tidy.raw.stats, tidy: tidy.tidy.stats, log: tidy.log },
            beautify: beautifyError ? { error: beautifyError } : { stats: beautify.stats, metrics: beautify.metrics },
          });
          produced.push(rec);
        } catch (e: any) {
          const rec = await createRecord({
            experimentId: exp.id,
            ruleSet,
            tidy: { error: (e?.message && String(e.message)) || "pipeline 失败" },
            beautify: { error: (e?.message && String(e.message)) || "pipeline 失败" },
          });
          produced.push(rec);
        }
      }
      const merged = produced.concat(records).slice(0, 500);
      setRecords(merged);
      savePipelineRecords(merged);
      setProgress({ total: exps.length, done: exps.length, current: "" });
    } finally {
      setRunning(false);
      runningRef.current = false;
    }
  };

  return (
    <>
      <Button size="small" onClick={() => setOpen(true)}>
        规则库
      </Button>
      <Modal title="规则库与迭代记录" open={open} onCancel={() => setOpen(false)} footer={null} width={980}>
        <div style={{ display: "grid", gap: 12 }}>
          <Card
            size="small"
            title={
              <Space size={8}>
                <span>规则集</span>
                <Text type="secondary">{currentExperimentTitle}</Text>
              </Space>
            }
            extra={
              <Space>
                <Segmented disabled={!canEdit} size="small" value={mode} onChange={(v) => setMode(v as any)} options={["表单", "JSON"]} />
                <Select
                  disabled={!canEdit}
                  size="small"
                  style={{ width: 150 }}
                  value={presetKey}
                  onChange={(v) => {
                    setPresetKey(String(v));
                    applyPreset(String(v));
                  }}
                  options={RULESET_PRESETS_V1.map((p) => ({ label: p.label, value: p.key }))}
                />
                <Select
                  disabled={!canEdit}
                  size="small"
                  style={{ width: 120 }}
                  value={scope}
                  onChange={(v) => setScope(v as any)}
                  options={[{ label: "全局", value: "全局" }, { label: "仅此示例", value: "仅此示例" }]}
                />
                <Button size="small" onClick={reloadFromStorage}>
                  从本地重载
                </Button>
                <Button disabled={!canEdit} size="small" icon={<DownloadOutlined />} onClick={exportBundle}>
                  导出
                </Button>
                <Upload
                  accept="application/json"
                  showUploadList={false}
                  disabled={!canEdit}
                  beforeUpload={async (file) => {
                    const text = await file.text();
                    await importBundle(text);
                    return false;
                  }}
                >
                  <Button disabled={!canEdit} size="small" icon={<UploadOutlined />}>
                    导入
                  </Button>
                </Upload>
                <Button disabled={!canEdit} size="small" type="primary" onClick={mode === "JSON" ? applyJson : applyForm}>
                  应用
                </Button>
                <Button size="small" danger disabled={!canEdit || scope !== "仅此示例"} onClick={clearOverride}>
                  清除覆盖
                </Button>
              </Space>
            }
            styles={{ body: { padding: 10 } }}
          >
            {mode === "JSON" ? (
              <div style={{ display: "grid", gap: 8 }}>
                {jsonError ? <Text type="danger">{jsonError}</Text> : null}
                <Input.TextArea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  rows={12}
                  readOnly={!canEdit}
                  style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}
                />
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {jsonError ? <Text type="danger">{jsonError}</Text> : null}
                <div style={{ display: "grid", gap: 6 }}>
                  <Text type="secondary">Tidy 规则</Text>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {tidyLabels.filter((x) => Object.prototype.hasOwnProperty.call(ruleSet.tidy.enabled, x.id)).map((x) => (
                      <Checkbox
                        key={x.id}
                        disabled={!canEdit}
                        checked={(ruleSet.tidy.enabled as any)[x.id]}
                        onChange={(e) => {
                          if (!canEdit) return;
                          const next = {
                            ...ruleSet,
                            tidy: { enabled: { ...ruleSet.tidy.enabled, [x.id]: e.target.checked } as any },
                          };
                          setRuleSet(next);
                        }}
                      >
                        {x.title}
                      </Checkbox>
                    ))}
                  </div>
                </div>
                <Divider style={{ margin: "6px 0" }} />
                <div style={{ display: "grid", gap: 8 }}>
                  <Text type="secondary">美化参数（Graphviz）</Text>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <Text type="secondary">方向</Text>
                    <Select
                      disabled={!canEdit}
                      size="small"
                      style={{ width: 90 }}
                      value={ruleSet.beautify.params.rankdir}
                      onChange={(v) => setRuleSet({ ...ruleSet, beautify: { ...ruleSet.beautify, params: { ...ruleSet.beautify.params, rankdir: v as any } } })}
                      options={[
                        { label: "TB", value: "TB" },
                        { label: "LR", value: "LR" },
                      ]}
                    />
                    <Text type="secondary">引擎</Text>
                    <Select
                      disabled={!canEdit}
                      size="small"
                      style={{ width: 110 }}
                      value={ruleSet.beautify.params.engine}
                      onChange={(v) => setRuleSet({ ...ruleSet, beautify: { ...ruleSet.beautify, params: { ...ruleSet.beautify.params, engine: v as any } } })}
                      options={[
                        { label: "dot", value: "dot" },
                        { label: "neato", value: "neato" },
                        { label: "fdp", value: "fdp" },
                      ]}
                    />
                    <Text type="secondary">连线</Text>
                    <Select
                      disabled={!canEdit}
                      size="small"
                      style={{ width: 120 }}
                      value={ruleSet.beautify.params.splines}
                      onChange={(v) => setRuleSet({ ...ruleSet, beautify: { ...ruleSet.beautify, params: { ...ruleSet.beautify.params, splines: v as any } } })}
                      options={[
                        { label: "spline", value: "spline" },
                        { label: "polyline", value: "polyline" },
                        { label: "ortho", value: "ortho" },
                      ]}
                    />
                    <Text type="secondary">合并同向</Text>
                    <Switch
                      disabled={!canEdit}
                      checked={!!ruleSet.beautify.params.concentrate}
                      onChange={(v) => {
                        if (!canEdit) return;
                        setRuleSet({ ...ruleSet, beautify: { ...ruleSet.beautify, params: { ...ruleSet.beautify.params, concentrate: v } } });
                      }}
                    />
                    <Text type="secondary">节点间距</Text>
                    <InputNumber
                      disabled={!canEdit}
                      size="small"
                      min={0.05}
                      max={2.5}
                      step={0.05}
                      value={ruleSet.beautify.params.nodesep}
                      onChange={(v) =>
                        setRuleSet({
                          ...ruleSet,
                          beautify: { ...ruleSet.beautify, params: { ...ruleSet.beautify.params, nodesep: typeof v === "number" ? v : ruleSet.beautify.params.nodesep } },
                        })
                      }
                    />
                    <Text type="secondary">层间距</Text>
                    <InputNumber
                      disabled={!canEdit}
                      size="small"
                      min={0.05}
                      max={3.5}
                      step={0.05}
                      value={ruleSet.beautify.params.ranksep}
                      onChange={(v) =>
                        setRuleSet({
                          ...ruleSet,
                          beautify: { ...ruleSet.beautify, params: { ...ruleSet.beautify.params, ranksep: typeof v === "number" ? v : ruleSet.beautify.params.ranksep } },
                        })
                      }
                    />
                    <Text type="secondary">字体大小</Text>
                    <InputNumber
                      disabled={!canEdit}
                      size="small"
                      min={8}
                      max={22}
                      step={1}
                      value={ruleSet.beautify.params.fontSize}
                      onChange={(v) =>
                        setRuleSet({
                          ...ruleSet,
                          beautify: { ...ruleSet.beautify, params: { ...ruleSet.beautify.params, fontSize: typeof v === "number" ? v : ruleSet.beautify.params.fontSize } },
                        })
                      }
                    />
                    <Text type="secondary">边距</Text>
                    <InputNumber
                      disabled={!canEdit}
                      size="small"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={ruleSet.beautify.params.pad}
                      onChange={(v) =>
                        setRuleSet({
                          ...ruleSet,
                          beautify: { ...ruleSet.beautify, params: { ...ruleSet.beautify.params, pad: typeof v === "number" ? v : ruleSet.beautify.params.pad } },
                        })
                      }
                    />
                  </div>
                </div>
                <Divider style={{ margin: "6px 0" }} />
                <div style={{ display: "grid", gap: 8 }}>
                  <Text type="secondary">美化阈值</Text>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <Text type="secondary">最大节点</Text>
                    <InputNumber
                      disabled={!canEdit}
                      size="small"
                      min={5}
                      max={200}
                      step={1}
                      value={ruleSet.beautify.thresholds.maxNodes}
                      onChange={(v) =>
                        setRuleSet({
                          ...ruleSet,
                          beautify: { ...ruleSet.beautify, thresholds: { ...ruleSet.beautify.thresholds, maxNodes: typeof v === "number" ? v : ruleSet.beautify.thresholds.maxNodes } },
                        })
                      }
                    />
                    <Text type="secondary">最大交叉</Text>
                    <InputNumber
                      disabled={!canEdit}
                      size="small"
                      min={0}
                      max={50}
                      step={1}
                      value={ruleSet.beautify.thresholds.maxCrossings}
                      onChange={(v) =>
                        setRuleSet({
                          ...ruleSet,
                          beautify: { ...ruleSet.beautify, thresholds: { ...ruleSet.beautify.thresholds, maxCrossings: typeof v === "number" ? v : ruleSet.beautify.thresholds.maxCrossings } },
                        })
                      }
                    />
                    <Text type="secondary">最小对比度</Text>
                    <InputNumber
                      disabled={!canEdit}
                      size="small"
                      min={1}
                      max={21}
                      step={0.1}
                      value={ruleSet.beautify.thresholds.minContrast}
                      onChange={(v) =>
                        setRuleSet({
                          ...ruleSet,
                          beautify: { ...ruleSet.beautify, thresholds: { ...ruleSet.beautify.thresholds, minContrast: typeof v === "number" ? v : ruleSet.beautify.thresholds.minContrast } },
                        })
                      }
                    />
                    <Text type="secondary">最大偏差</Text>
                    <InputNumber
                      disabled={!canEdit}
                      size="small"
                      min={0}
                      max={90}
                      step={1}
                      value={ruleSet.beautify.thresholds.maxFlowAngle}
                      onChange={(v) =>
                        setRuleSet({
                          ...ruleSet,
                          beautify: { ...ruleSet.beautify, thresholds: { ...ruleSet.beautify.thresholds, maxFlowAngle: typeof v === "number" ? v : ruleSet.beautify.thresholds.maxFlowAngle } },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card
            size="small"
            title="迭代执行"
            extra={
              <Space>
                <Button size="small" icon={<PlayCircleOutlined />} onClick={() => void recordCurrent()} disabled={!experimentId}>
                  记录当前示例
                </Button>
                <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={running} onClick={() => void runAllExperiments()}>
                  全示例重跑并记录
                </Button>
              </Space>
            }
            styles={{ body: { padding: 10 } }}
          >
            {running ? (
              <div style={{ display: "grid", gap: 8 }}>
                <Progress percent={progress.total ? Math.round((progress.done / progress.total) * 100) : 0} />
                <Text type="secondary">
                  {progress.done}/{progress.total} {progress.current ? `— ${progress.current}` : ""}
                </Text>
              </div>
            ) : (
              <Text type="secondary">建议在网络稳定时执行“全示例重跑”，会调用后端解析并进行 Graphviz 渲染。</Text>
            )}
          </Card>

          <Card size="small" title="迭代记录" styles={{ body: { padding: 10 } }}>
            <Table
              size="small"
              pagination={{ pageSize: 8 }}
              dataSource={records.map((r) => ({ ...r, key: r.id }))}
              columns={[
                { title: "时间", dataIndex: "createdAt", width: 170, render: (v) => new Date(Number(v)).toLocaleString() },
                { title: "示例", dataIndex: "experimentId", width: 180 },
                {
                  title: "Beautify",
                  width: 140,
                  render: (_: any, r: any) => {
                    const errText = typeof r?.beautify?.error === "string" ? r.beautify.error : "";
                    const metrics = Array.isArray(r?.beautify?.metrics) ? r.beautify.metrics : null;
                    const pass = metrics ? metrics.every((x: any) => !!x.pass) : !!r?.beautify?.stats;
                    const tag = <Tag color={pass ? "green" : "red"}>{pass ? "PASS" : "FAIL"}</Tag>;
                    if (!pass && errText) return <Tooltip title={errText}>{tag}</Tooltip>;
                    if (!pass && metrics) {
                      const fails = metrics.filter((m: any) => !m?.pass).map((m: any) => String(m?.name || "")).filter(Boolean).slice(0, 3);
                      const tip = fails.length ? `未通过：${fails.join(", ")}` : "未通过阈值";
                      return <Tooltip title={tip}>{tag}</Tooltip>;
                    }
                    return tag;
                  },
                },
                { title: "规则快照", dataIndex: "ruleSetHash", width: 220, ellipsis: true },
                {
                  title: "操作",
                  width: 120,
                  render: (_: any, r: any) => (
                    <Space>
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => {
                          setDetail(r as any);
                          setDetailOpen(true);
                        }}
                      />
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteRecord(String(r.id))} />
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </Modal>

      <Modal title="记录详情" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={900}>
        {detail ? (
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
            {JSON.stringify(detail, null, 2)}
          </pre>
        ) : null}
      </Modal>
    </>
  );
}
