import React, { useCallback, useEffect, useState } from "react";
import { Button, Card, Empty, Input, Row, Col, Space, Spin, Typography } from "antd";
import { CodeOutlined, RightOutlined, SearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { publicTypstNotesApi } from "@services";
import type { PublicTypstNoteListItem } from "@services";
import "./Informatics.css";

const { Title, Text } = Typography;

const InformaticsNotesPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PublicTypstNoteListItem[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await publicTypstNotesApi.list({ limit: 100, search: search.trim() || undefined });
      setItems(res || []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="informatics-page">
      <div className="informatics-hero">
        <div className="informatics-hero-left">
          <Title level={2} style={{ margin: 0 }}>
            <CodeOutlined /> 信息学竞赛
          </Title>
          <Text type="secondary">整理的 Typst 笔记与讲义（已发布内容）</Text>
        </div>
        <div className="informatics-hero-right">
          <Space>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={load}
              placeholder="搜索标题"
              allowClear
              style={{ width: 260 }}
              prefix={<SearchOutlined />}
            />
            <Button onClick={load} loading={loading}>
              搜索
            </Button>
          </Space>
        </div>
      </div>

      <div className="informatics-content">
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : items.length === 0 ? (
          <Card className="informatics-card">
            <Empty description="暂无已发布内容" />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {items.map((it) => (
              <Col key={it.id} xs={24} sm={12} lg={8} xl={6}>
                <Card
                  className="informatics-card"
                  title={<Text strong>{it.title}</Text>}
                  extra={
                    <Button type="link" onClick={() => navigate(`/informatics/${it.id}`)} icon={<RightOutlined />}>
                      阅读
                    </Button>
                  }
                >
                  <div style={{ minHeight: 46 }}>
                    <Text type="secondary">{it.summary || "—"}</Text>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      更新：{new Date(it.updated_at).toLocaleString("zh-CN")}
                    </Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
};

export default InformaticsNotesPage;

