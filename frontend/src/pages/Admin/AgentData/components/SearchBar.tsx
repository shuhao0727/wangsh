/**
 * 智能体数据搜索栏组件
 * 支持多维度筛选：学生、班级、学年、智能体、时间范围等
 */

import React, { useState, useEffect } from "react";
import {
  Input,
  Select,
  Button,
  Space,
  Card,
  Row,
  Col,
  DatePicker,
  Form,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  FilterOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import type { SearchFilterParams } from "@services/znt/types";

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface SearchBarProps {
  searchParams: SearchFilterParams;
  onSearch: (params: SearchFilterParams) => void;
  onReset: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchParams,
  onSearch,
  onReset,
  onExport,
  exportDisabled,
}) => {
  const [form] = Form.useForm();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filterOptions = {
    grades: ["2025", "2024", "2023", "2022"],
    classNames: [
      "高一(1)班",
      "高一(2)班",
      "高一(3)班",
      "高二(1)班",
      "高二(2)班",
    ],
    agentNames: [
      "DeepSeek Chat",
      "硅基流动 - 文生图",
      "OpenAI GPT-4",
      "客户服务助手",
      "文档分析助手",
    ],
  };

  // 初始化表单值
  useEffect(() => {
    form.setFieldsValue({
      keyword: searchParams.keyword || "",
      student_id: searchParams.student_id || "",
      student_name: searchParams.student_name || "",
      class_name: searchParams.class_name || "",
      grade: searchParams.grade || "",
      agent_name: searchParams.agent_name || "",
      // agent_type字段已移除，因为SearchFilterParams类型中没有该属性
      date_range:
        searchParams.start_date && searchParams.end_date
          ? [dayjs(searchParams.start_date), dayjs(searchParams.end_date)]
          : null,
    });
  }, [searchParams, form]);

  // 处理搜索提交
  const handleSearch = () => {
    form.validateFields().then((values) => {
      const params: SearchFilterParams = {
        keyword: values.keyword,
        student_id: values.student_id,
        student_name: values.student_name,
        class_name: values.class_name,
        grade: values.grade,
        agent_name: values.agent_name,
        // agent_type字段已移除，因为SearchFilterParams类型中没有该属性
        page: 1,
        page_size: searchParams.page_size || 20,
      };

      // 处理时间范围
      if (values.date_range && values.date_range.length === 2) {
        params.start_date = values.date_range[0].format("YYYY-MM-DD");
        params.end_date = values.date_range[1].format("YYYY-MM-DD");
      }

      onSearch(params);
    });
  };

  // 处理重置
  const handleReset = () => {
    form.resetFields();
    onReset();
  };

  return (
    <Card
      size="small"
      style={{ marginBottom: "16px" }}
      styles={{ body: { padding: "16px" } }}
    >
      <Form form={form} layout="vertical">
        {/* 基础搜索行 */}
        <Row
          gutter={16}
          align="middle"
          style={{ marginBottom: showAdvanced ? "16px" : 0 }}
        >
          <Col flex="1">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="keyword" noStyle>
                  <Search
                    placeholder="搜索问题或回答内容..."
                    allowClear
                    enterButton={<SearchOutlined />}
                    size="middle"
                    onSearch={handleSearch}
                  />
                </Form.Item>
              </Col>

              <Col span={6}>
                <Form.Item name="student_id" noStyle>
                  <Input placeholder="学号" allowClear size="middle" />
                </Form.Item>
              </Col>

              <Col span={6}>
                <Form.Item name="student_name" noStyle>
                  <Input placeholder="学生姓名" allowClear size="middle" />
                </Form.Item>
              </Col>

              <Col span={4}>
                <Button
                  type="link"
                  icon={<FilterOutlined />}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? "收起筛选" : "展开筛选"}
                </Button>
              </Col>
            </Row>
          </Col>

          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
              {onExport && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={onExport}
                  disabled={exportDisabled}
                >
                  导出
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        {/* 高级筛选区域 */}
        {showAdvanced && (
          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid var(--ws-color-border)",
            }}
          >
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item label="班级" name="class_name">
                  <Select placeholder="选择班级" allowClear>
                    {filterOptions.classNames.map((className) => (
                      <Option key={className} value={className}>
                        {className}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col span={6}>
                <Form.Item label="学年" name="grade">
                  <Select placeholder="选择学年" allowClear>
                    {filterOptions.grades.map((grade) => (
                      <Option key={grade} value={grade}>
                        {grade}级
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col span={6}>
                <Form.Item label="智能体名称" name="agent_name">
                  <Select placeholder="选择智能体" allowClear>
                    {filterOptions.agentNames.map((agent) => (
                      <Option key={agent} value={agent}>
                        {agent}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              {/* 注释掉智能体类型字段，因为它不在SearchFilterParams类型中 */}
              {/* <Col span={6}>
                <Form.Item label="智能体类型" name="agent_type">
                  <Select placeholder="选择智能体类型" allowClear>
                    <Option value="general">通用智能体</Option>
                    <Option value="dify">Dify智能体</Option>
                  </Select>
                </Form.Item>
              </Col> */}
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="时间范围" name="date_range">
                  <RangePicker
                    style={{ width: "100%" }}
                    placeholder={["开始时间", "结束时间"]}
                    format="YYYY-MM-DD"
                  />
                </Form.Item>
              </Col>

              <Col
                span={12}
                style={{ display: "flex", alignItems: "flex-end" }}
              >
                <Space>
                  <Button type="primary" onClick={handleSearch}>
                    应用筛选
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Form>
    </Card>
  );
};

export default SearchBar;
