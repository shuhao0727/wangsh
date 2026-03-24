import React, { useState, useEffect, useMemo } from "react";
import { Modal, Row, Col, Card, Statistic, Tabs, Table, Input, Space, Tag, Spin, Typography, message, Button } from "antd";
import { xbkDataApi } from "@services";
import type { XbkSummary, XbkCourseStatItem, XbkClassStatItem, XbkStudentRow } from "@services";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

interface XbkAnalysisModalProps {
  open: boolean;
  onCancel: () => void;
  filters: {
    year?: number;
    term?: "上学期" | "下学期";
    grade?: "高一" | "高二";
    class_name?: string;
  };
}

export const XbkAnalysisModal: React.FC<XbkAnalysisModalProps> = ({ open, onCancel, filters }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<XbkSummary | null>(null);
  const [courseStats, setCourseStats] = useState<XbkCourseStatItem[]>([]);
  const [classStats, setClassStats] = useState<XbkClassStatItem[]>([]);
  const [noSelection, setNoSelection] = useState<XbkStudentRow[]>([]);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [courseQuery, setCourseQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      setLoading(true);
      setActiveTab("overview");
      setCourseQuery("");
      setStudentQuery("");
      try {
        const params = {
          year: filters.year,
          term: filters.term,
          grade: filters.grade,
          class_name: filters.class_name,
        };
        const [sum, courses, classes, noSel] = await Promise.all([
          xbkDataApi.getSummary(params),
          xbkDataApi.getCourseStats(params),
          xbkDataApi.getClassStats(params),
          xbkDataApi.getStudentsWithoutSelection(params),
        ]);
        setSummary(sum);
        setCourseStats(courses.items || []);
        setClassStats(classes.items || []);
        setNoSelection(noSel.items || []);
      } catch (_e: any) {
        message.error("加载分析数据失败");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [open, filters]);

  const filteredCourseStats = useMemo(() => {
    const q = courseQuery.trim().toLowerCase();
    if (!q) return courseStats;
    return courseStats.filter((it) => {
      const code = String(it.course_code || "").toLowerCase();
      const name = String(it.course_name || "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [courseQuery, courseStats]);

  const filteredNoSelection = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return noSelection;
    return noSelection.filter((s) => {
      const cls = String(s.class_name || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const no = String(s.student_no || "").toLowerCase();
      return cls.includes(q) || name.includes(q) || no.includes(q);
    });
  }, [studentQuery, noSelection]);

  const courseColumns: ColumnsType<XbkCourseStatItem> = [
    {
      title: "课程",
      dataIndex: "course",
      render: (_: any, r: XbkCourseStatItem) => (
        <Text>
          {r.course_code} · {r.course_name || "-"}
        </Text>
      ),
    },
    {
      title: "人数",
      dataIndex: "count",
      width: 120,
      align: "right",
      render: (v: number, r: XbkCourseStatItem) =>
        typeof r.allowed_total === "number" && r.allowed_total > 0 ? (
          <Tag color={v > r.allowed_total ? "red" : "orange"}>
            {v}/{r.allowed_total}
          </Tag>
        ) : (
          <Tag color="orange">{v}</Tag>
        ),
    },
  ];

  const classColumns: ColumnsType<XbkClassStatItem> = [
    { title: "班级", dataIndex: "class_name" },
    {
      title: "人数",
      dataIndex: "count",
      width: 120,
      align: "right",
      render: (v: number) => <Tag color="orange">{v}</Tag>,
    },
  ];

  const noSelectionColumns: ColumnsType<XbkStudentRow> = [
    { title: "班级", dataIndex: "class_name", width: 140, ellipsis: true },
    { title: "学号", dataIndex: "student_no", width: 140, ellipsis: true },
    { title: "姓名", dataIndex: "name", width: 120, ellipsis: true },
  ];

  return (
    <Modal
      title="数据分析"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
      ]}
      width={980}
      styles={{ body: { maxHeight: '75vh', overflow: 'auto' } }}
    >
      {loading ? (
        <div className="ws-modal-loading">
          <Spin />
        </div>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div className="ws-modal-filter-info">
            当前筛选：{filters.year || "全部年份"} · {filters.term || "全部学期"} · {filters.grade || "全部年级"}
            {filters.class_name ? ` · ${filters.class_name}` : ""}
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <Card size="small" bordered={false} className="ws-stat-card">
                <Statistic title="学生数" value={summary?.students ?? 0} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small" bordered={false} className="ws-stat-card">
                <Statistic title="课程数" value={summary?.courses ?? 0} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small" bordered={false} className="ws-stat-card">
                <Statistic title="选课条目" value={summary?.selections ?? 0} />
              </Card>
            </Col>
            <Col xs={24} md={3}>
              <Card size="small" bordered={false} className="ws-stat-card">
                <Statistic title="未选课" value={summary?.unselected_count ?? 0} valueStyle={{ color: 'var(--ws-color-warning)' }} />
              </Card>
            </Col>
            <Col xs={24} md={3}>
              <Card size="small" bordered={false} className="ws-stat-card">
                <Statistic title="休学/其他" value={summary?.suspended_count ?? 0} valueStyle={{ color: 'var(--ws-color-text-tertiary)' }} />
              </Card>
            </Col>
          </Row>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: "overview",
                label: "概览",
                children: (
                  <Row gutter={[24, 24]}>
                    <Col xs={24} md={12}>
                      <Text strong className="ws-section-title">课程统计（按课程代码）</Text>
                      <Table
                        rowKey="course_code"
                        size="small"
                        columns={courseColumns}
                        dataSource={courseStats}
                        pagination={false}
                        scroll={{ y: 420 }}
                      />
                    </Col>
                    <Col xs={24} md={12}>
                      <Text strong className="ws-section-title">班级统计</Text>
                      <Table
                        rowKey="class_name"
                        size="small"
                        columns={classColumns}
                        dataSource={classStats}
                        pagination={false}
                        scroll={{ y: 420 }}
                      />
                    </Col>
                  </Row>
                ),
              },
              {
                key: "courses",
                label: "课程统计详情",
                children: (
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Input
                      placeholder="搜索课程代码/名称"
                      allowClear
                      value={courseQuery}
                      onChange={(e) => setCourseQuery(e.target.value)}
                      style={{ maxWidth: 300 }}
                    />
                    <Table
                      rowKey="course_code"
                      size="small"
                      columns={courseColumns}
                      dataSource={filteredCourseStats}
                      pagination={false}
                      scroll={{ y: 520 }}
                    />
                  </Space>
                ),
              },
              {
                key: "classes",
                label: "班级统计详情",
                children: (
                  <Table
                    rowKey="class_name"
                    size="small"
                    columns={classColumns}
                    dataSource={classStats}
                    pagination={false}
                    scroll={{ y: 560 }}
                  />
                ),
              },
              {
                key: "no_selection",
                label: `未选课学生 (${noSelection.length})`,
                children: (
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Input
                      placeholder="搜索班级/姓名/学号"
                      allowClear
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      style={{ maxWidth: 300 }}
                    />
                    <Table
                      rowKey="id"
                      size="small"
                      columns={noSelectionColumns}
                      dataSource={filteredNoSelection}
                      pagination={false}
                      scroll={{ y: 520 }}
                    />
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      )}
    </Modal>
  );
};
