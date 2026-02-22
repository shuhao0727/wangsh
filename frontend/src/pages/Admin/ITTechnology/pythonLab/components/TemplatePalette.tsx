import React from "react";
import { Card, Collapse, Space, Tag } from "antd";
import type { FlowNodeTemplate } from "../types";
import { ShapeIcon } from "./ShapeIcon";

export function TemplatePalette(props: {
  basic: FlowNodeTemplate[];
  advanced: FlowNodeTemplate[];
  onAddNode: (tpl: FlowNodeTemplate) => void;
}) {
  const { basic, advanced, onAddNode } = props;
  return (
    <Card
      title="流程图模块"
      style={{ borderRadius: "var(--ws-radius-lg)", height: "100%", display: "flex", flexDirection: "column" }}
      styles={{ body: { paddingTop: 12, overflowY: "auto", flex: 1, minHeight: 0 } }}
    >
      <Space orientation="vertical" size={10} style={{ width: "100%" }}>
        {basic.map((tpl) => (
          <Card
            key={tpl.key}
            hoverable
            style={{ borderRadius: "var(--ws-radius-lg)" }}
            styles={{ body: { padding: 12 } }}
            onClick={() => onAddNode(tpl)}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--ws-radius-lg)",
                  background: "var(--ws-color-surface-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShapeIcon shape={tpl.key} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{tpl.title}</div>
                <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>{tpl.description}</div>
              </div>
            </div>
          </Card>
        ))}
        <Collapse
          ghost
          items={[
            {
              key: "advanced",
              label: "高级模块",
              children: (
                <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                  {advanced.map((tpl) => (
                    <Card
                      key={tpl.key}
                      hoverable
                      style={{ borderRadius: "var(--ws-radius-lg)" }}
                      styles={{ body: { padding: 12 } }}
                      onClick={() => onAddNode(tpl)}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "var(--ws-radius-lg)",
                            background: "var(--ws-color-surface-2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <ShapeIcon shape={tpl.key} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{tpl.title}</span>
                            <Tag color="gold" style={{ marginInlineEnd: 0 }}>
                              高级
                            </Tag>
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>{tpl.description}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Card>
  );
}
