import React, { useEffect, useMemo, useState } from "react";
import { Card, Col, Input, Row, Space, Tag, Typography } from "antd";
import { CodeOutlined, PlayCircleOutlined } from "@ant-design/icons";
import type { PythonLabExperiment, PythonLabLevel } from "./types";
import { loadPythonLabExperiments } from "./storage";

const { Text, Title } = Typography;

function levelColor(level: PythonLabLevel) {
  if (level === "入门") return "green";
  if (level === "基础") return "blue";
  return "purple";
}

const PythonLabSelector: React.FC<{ onSelect: (exp: PythonLabExperiment) => void }> = ({ onSelect }) => {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PythonLabExperiment[]>([]);

  useEffect(() => {
    setItems(loadPythonLabExperiments());
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((x) => {
      const hay = `${x.title} ${x.level} ${x.scenario} ${x.tags.join(" ")}`.toLowerCase();
      return hay.includes(keyword);
    });
  }, [items, q]);

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            请选择实验
          </Title>
          <Text type="secondary">先选模板，再进入实验台绘制流程图与查看代码。</Text>
        </div>
        <Input
          placeholder="搜索实验/标签/难度"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 280, maxWidth: "100%" }}
          allowClear
        />
      </div>

      <Row gutter={[16, 16]}>
        {filtered.map((exp) => (
          <Col xs={24} sm={12} md={8} lg={6} key={exp.id}>
            <Card
              hoverable
              style={{ height: "100%", borderRadius: 12 }}
              onClick={() => onSelect(exp)}
              actions={[
                <span key="run">
                  <PlayCircleOutlined /> 进入实验
                </span>,
              ]}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: "#f0f5ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#1677ff",
                    fontSize: 22,
                  }}
                >
                  <CodeOutlined />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {exp.title}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Space size={6} wrap>
                      <Tag color={levelColor(exp.level)} style={{ marginInlineEnd: 0 }}>
                        {exp.level}
                      </Tag>
                      <Tag style={{ marginInlineEnd: 0 }}>{exp.scenario}</Tag>
                    </Space>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {exp.tags.slice(0, 6).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </Card>
          </Col>
        ))}
        {filtered.length === 0 && (
          <Col span={24} style={{ textAlign: "center", padding: 32 }}>
            <Text type="secondary">没有匹配的实验</Text>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default PythonLabSelector;
