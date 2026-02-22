import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Col, Divider, Modal, Row, Space, Statistic, Tag, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { AdminCard } from "@components/Admin";
import { systemMetricsApi } from "@services";

const { Text } = Typography;

const pct = (x: number) => `${Math.round(x * 100)}%`;

const TypstMetricsPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await systemMetricsApi.typstMetrics();
      setData(res);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "加载 Typst 指标失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = data?.typst_compile?.counts;
  const dur = data?.typst_compile?.dur_ms;
  const waited = data?.typst_compile?.waited_ms;
  const q = data?.typst_compile?.queue_length;
  const hitRate = Number(data?.typst_compile?.cache_hit_rate_recent || 0);
  const http429 = Number(data?.http?.["429_total"] || 0);

  const statusTag = useMemo(() => {
    const fail = Number(counts?.fail || 0);
    const ql = Number(q?.typst || 0) + Number(q?.celery || 0);
    if (fail > 0) return <Tag color="red">有失败</Tag>;
    if (ql > 0) return <Tag color="orange">排队中</Tag>;
    return <Tag color="green">正常</Tag>;
  }, [counts?.fail, q?.typst, q?.celery]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Space>
          <Text strong>Typst 编译观测</Text>
          {statusTag}
        </Space>
        <Space>
          <Button
            onClick={() => {
              Modal.confirm({
                title: "清理未引用 PDF",
                content: "会删除超过保留天数且未被任何笔记引用的 PDF。建议先预演。",
                okText: "预演",
                cancelText: "取消",
                onOk: async () => {
                  const res = await systemMetricsApi.typstPdfCleanup({ dry_run: true });
                  message.info(`预演完成：scanned=${res?.scanned ?? 0} removed=${res?.removed ?? 0}`);
                },
              });
            }}
          >
            清理 PDF
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <AdminCard title="计数与命中率">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="总编译次数" value={Number(counts?.total || 0)} />
              </Col>
              <Col span={12}>
                <Statistic title="近期命中率" value={pct(hitRate)} />
              </Col>
              <Col span={12}>
                <Statistic title="命中" value={Number(counts?.hit || 0)} />
              </Col>
              <Col span={12}>
                <Statistic title="未命中" value={Number(counts?.miss || 0)} />
              </Col>
              <Col span={12}>
                <Statistic title="失败" value={Number(counts?.fail || 0)} />
              </Col>
              <Col span={12}>
                <Statistic title="429 总次数" value={http429} />
              </Col>
            </Row>
            <Divider />
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="队列(typst)" value={Number(q?.typst || 0)} />
              </Col>
              <Col span={12}>
                <Statistic title="队列(celery)" value={Number(q?.celery || 0)} />
              </Col>
            </Row>
          </AdminCard>
        </Col>

        <Col xs={24} lg={12}>
          <AdminCard title="耗时分布">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="样本数" value={Number(dur?.n || 0)} />
              </Col>
              <Col span={12}>
                <Statistic title="p50(ms)" value={Number(dur?.p50 || 0)} />
              </Col>
              <Col span={12}>
                <Statistic title="p90(ms)" value={Number(dur?.p90 || 0)} />
              </Col>
              <Col span={12}>
                <Statistic title="p95(ms)" value={Number(dur?.p95 || 0)} />
              </Col>
              <Col span={12}>
                <Statistic title="max(ms)" value={Number(dur?.max || 0)} />
              </Col>
              <Col span={12}>
                <Statistic title="等待 p95(ms)" value={Number(waited?.p95 || 0)} />
              </Col>
            </Row>
            <Divider />
            <Text type="secondary">
              提示：等待时间高通常意味着并发受限或队列积压；命中率低且耗时高意味着需要优化缓存或资源引用。
            </Text>
          </AdminCard>
        </Col>
      </Row>
    </div>
  );
};

export default TypstMetricsPanel;
