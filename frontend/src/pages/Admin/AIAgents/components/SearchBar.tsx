/**
 * 搜索栏组件
 */
import React from "react";
import { Input, Select, Button, Space, Card, Row, Col } from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { AgentTypeValues } from "@services/znt/types";

const { Search } = Input;
const { Option } = Select;

interface SearchBarProps {
  searchKeyword: string;
  selectedType: string;
  selectedRowKeys: React.Key[];
  onSearchChange: (value: string) => void;
  onSearch: (value: string) => void;
  onTypeChange: (value: string) => void;
  onReset: () => void;
  onBatchDelete: () => void;
  onAddAgent: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchKeyword,
  selectedType,
  selectedRowKeys,
  onSearchChange,
  onSearch,
  onTypeChange,
  onReset,
  onBatchDelete,
  onAddAgent,
}) => {
  return (
    <Card
      size="small"
      style={{ marginBottom: "16px" }}
      styles={{ body: { padding: "16px" } }}
    >
      <Row gutter={16} align="middle">
        <Col flex="1">
          <Search
            placeholder="搜索智能体名称、描述或URL..."
            allowClear
            enterButton={<SearchOutlined />}
            size="middle"
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
            onSearch={onSearch}
            style={{ maxWidth: "400px", marginRight: "16px" }}
          />
          <Select
            value={selectedType}
            onChange={onTypeChange}
            style={{ width: "150px" }}
          >
            <Option value="all">全部类型</Option>
            <Option value={AgentTypeValues.GENERAL}>通用智能体</Option>
            <Option value={AgentTypeValues.DIFY}>Dify智能体</Option>
          </Select>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={onReset}>
              重置
            </Button>
            {selectedRowKeys.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={onBatchDelete}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={onAddAgent}>
              添加智能体
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

export default SearchBar;
