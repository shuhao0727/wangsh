import React, { useEffect, useMemo, useState } from "react";
import { Alert, Card, Collapse, Empty, Progress, Space, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { pythonlabPseudocodeApi, type PythonLabPseudocodeParseResponse } from "../services/pythonlabDebugApi";

const { Text } = Typography;

function joinItems(items: Array<{ text?: string }> | undefined): string {
  const lines = (items ?? []).map((it) => String(it?.text ?? "").trimEnd()).filter(Boolean);
  return lines.length ? lines.join("\n") : "";
}

export function PseudocodePipelinePanel(props: { code: string; active: boolean }) {
  const { code, active } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PythonLabPseudocodeParseResponse | null>(null);
  const [reloadSeq, setReloadSeq] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await pythonlabPseudocodeApi.parsePseudocode(code, { limits: { maxParseMs: 1200 } });
        if (cancelled) return;
        setData(resp);
      } catch (e: any) {
        if (cancelled) return;
        const msg = String(e?.userMessage || e?.message || "伪代码解析失败");
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [active, code, reloadSeq]);

  const inputText = useMemo(() => joinItems(data?.input?.items), [data]);
  const processText = useMemo(() => joinItems(data?.process?.items), [data]);
  const outputText = useMemo(() => joinItems(data?.output?.items), [data]);

  const score = Number(data?.reversibility?.score ?? 0);
  const level = String(data?.reversibility?.level ?? "low") as "high" | "medium" | "low";
  const levelColor = level === "high" ? "green" : level === "medium" ? "orange" : "red";

  const rulesCount = data?.rulesUsed?.length ?? 0;
  const lossCount = data?.lossPoints?.length ?? 0;

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <span>伪代码</span>
          <Tag color={levelColor}>可逆性: {level}</Tag>
          <Text type="secondary">规则 {rulesCount}</Text>
          <Text type="secondary">损失 {lossCount}</Text>
        </Space>
      }
      extra={
        <Tag
          color="blue"
          style={{ cursor: "pointer", userSelect: "none" }}
          onClick={() => setReloadSeq((v) => v + 1)}
        >
          <Space size={6}>
            <ReloadOutlined />
            <span>刷新</span>
          </Space>
        </Tag>
      }
      styles={{ body: { padding: 12 } }}
    >
      {error ? (
        <Alert
          type="warning"
          showIcon
          message="伪代码生成失败"
          description={
            <div style={{ display: "grid", gap: 6 }}>
              <div>{error}</div>
              <Text type="secondary">降级：可先使用“原始代码 → 流程图”路径；稍后重试。</Text>
            </div>
          }
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {data ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Progress percent={Math.round(score * 100)} size="small" status={level === "low" ? "exception" : "normal"} style={{ flex: 1, margin: 0 }} />
            <Text type="secondary">{data?.stats?.cacheHit ? "cache" : "fresh"}</Text>
          </div>

          <Collapse
            size="small"
            defaultActiveKey={["input", "process", "output"]}
            items={[
              {
                key: "input",
                label: `输入 (${data?.input?.items?.length ?? 0})`,
                children: inputText ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
                    {inputText}
                  </pre>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="（未识别到输入要素）" />
                ),
              },
              {
                key: "process",
                label: `处理 (${data?.process?.items?.length ?? 0})`,
                children: processText ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
                    {processText}
                  </pre>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="（无处理步骤）" />
                ),
              },
              {
                key: "output",
                label: `输出 (${data?.output?.items?.length ?? 0})`,
                children: outputText ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
                    {outputText}
                  </pre>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="（未识别到输出要素）" />
                ),
              },
              {
                key: "meta",
                label: "规则 / 损失点",
                children: (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>规则</div>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
                        {(data.rulesUsed || [])
                          .map((r) => `${r.id} ×${r.count}${r.description ? ` — ${r.description}` : ""}`)
                          .join("\n") || "（无）"}
                      </pre>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>损失点</div>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
                        {(data.lossPoints || []).map((p) => `${p.code}: ${p.message}`).join("\n") || "（无）"}
                      </pre>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>可逆性原因</div>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
                        {(data.reversibility?.reasons || []).join("\n") || "（无）"}
                      </pre>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : loading ? (
        <Text type="secondary">正在解析伪代码…</Text>
      ) : (
        <Text type="secondary">切换到流水线页后自动解析。</Text>
      )}
    </Card>
  );
}
