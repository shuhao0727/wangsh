/**
 * 搜索栏 — 紧凑单行，展开高级筛选
 */

import React, { useState, useEffect } from "react";
import { Input, Select, Button, Space, Row, Col, DatePicker, Form } from "antd";
import { SearchOutlined, ReloadOutlined, FilterOutlined, DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { SearchFilterParams } from "@services/znt/types";

const { RangePicker } = DatePicker;
const { Option } = Select;

interface SearchBarProps {
  searchParams: SearchFilterParams;
  onSearch: (params: SearchFilterParams) => void;
  onReset: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
}

const filterOptions = {
  grades: ["2025", "2024", "2023", "2022"],
  classNames: ["高一(1)班", "高一(2)班", "高一(3)班", "高二(1)班", "高二(2)班"],
  agentNames: ["DeepSeek Chat", "硅基流动 - 文生图", "OpenAI GPT-4", "客户服务助手", "文档分析助手"],
};

const SearchBar: React.FC<SearchBarProps> = ({ searchParams, onSearch, onReset, onExport, exportDisabled }) => {
  const [form] = Form.useForm();
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      keyword: searchParams.keyword || "",
      student_id: searchParams.student_id || "",
      student_name: searchParams.student_name || "",
      class_name: searchParams.class_name || "",
      grade: searchParams.grade || "",
      agent_name: searchParams.agent_name || "",
      date_range: searchParams.start_date && searchParams.end_date
        ? [dayjs(searchParams.start_date), dayjs(searchParams.end_date)]
        : null,
    });
  }, [searchParams, form]);

  const handleSearch = () => {
    form.validateFields().then((values) => {
      const params: SearchFilterParams = {
        keyword: values.keyword,
        student_id: values.student_id,
        student_name: values.student_name,
        class_name: values.class_name,
        grade: values.grade,
        agent_name: values.agent_name,
        page: 1,
        page_size: searchParams.page_size || 20,
      };
      if (values.date_range?.length === 2) {
        params.start_date = values.date_range[0].format("YYYY-MM-DD");
        params.end_date = values.date_range[1].format("YYYY-MM-DD");
      }
      onSearch(params);
    });
  };

  const handleReset = () => { form.resetFields(); onReset(); };

  return (
    <div style={{ flex: "none", padding: "12px 0", marginBottom: 8 }}>
      <Form form={form} layout="vertical">
        <Row gutter={12} align="middle" wrap={false}>
          <Col flex="auto">
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="keyword" noStyle>
                  <Input
                    placeholder="搜索问题或回答..."
                    allowClear
                    prefix={<SearchOutlined style={{ color: "rgba(0,0,0,0.25)" }} />}
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col span={5}>
                <Form.Item name="student_id" noStyle>
                  <Input placeholder="学号" allowClear />
                </Form.Item>
              </Col>
              <Col span={5}>
                <Form.Item name="student_name" noStyle>
                  <Input placeholder="学生姓名" allowClear />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Space>
                  <Button type="primary" onClick={handleSearch}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                  <Button type="text" icon={<FilterOutlined />} onClick={() => setShowAdvanced(!showAdvanced)}>
                    {showAdvanced ? "收起" : "筛选"}
                  </Button>
                  {onExport && (
                    <Button icon={<DownloadOutlined />} onClick={onExport} disabled={exportDisabled}>导出</Button>
                  )}
                </Space>
              </Col>
            </Row>
          </Col>
        </Row>

        {showAdvanced && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            <Row gutter={12}>
              <Col span={6}>
                <Form.Item label="班级" name="class_name" style={{ marginBottom: 8 }}>
                  <Select placeholder="选择班级" allowClear>
                    {filterOptions.classNames.map((c) => <Option key={c} value={c}>{c}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="学年" name="grade" style={{ marginBottom: 8 }}>
                  <Select placeholder="选择学年" allowClear>
                    {filterOptions.grades.map((g) => <Option key={g} value={g}>{g}级</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="智能体" name="agent_name" style={{ marginBottom: 8 }}>
                  <Select placeholder="选择智能体" allowClear>
                    {filterOptions.agentNames.map((a) => <Option key={a} value={a}>{a}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="时间范围" name="date_range" style={{ marginBottom: 8 }}>
                  <RangePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                </Form.Item>
              </Col>
            </Row>
          </div>
        )}
      </Form>
    </div>
  );
};

export default SearchBar;
