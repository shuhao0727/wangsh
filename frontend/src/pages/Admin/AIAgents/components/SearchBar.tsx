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
    <div style={{ marginBottom: "24px" }}>
      <Row gutter={16} align="middle" justify="space-between">
        <Col xs={24} md={16} style={{ display: 'flex', gap: '16px' }}> {/* Increased gap */}
          <Search
            placeholder="搜索智能体..."
            allowClear
            size="large" 
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
            onSearch={onSearch}
            style={{ maxWidth: "480px" }} // Wider search bar
          />
          <Select
            value={selectedType}
            onChange={onTypeChange}
            size="large"
            style={{ width: "180px" }} // Wider select
          >
            <Option value="all">全部类型</Option>
            <Option value={AgentTypeValues.GENERAL}>通用智能体</Option>
            <Option value={AgentTypeValues.DIFY}>Dify智能体</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={onReset} />
        </Col>
        <Col xs={24} md={8} style={{ textAlign: 'right', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            {selectedRowKeys.length > 0 && (
              <Button danger size="middle" icon={<DeleteOutlined />} onClick={onBatchDelete}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            )}
            <Button type="primary" size="middle" icon={<PlusOutlined />} onClick={onAddAgent}>
              新建智能体
            </Button>
        </Col>
      </Row>
    </div>
  );
};

export default SearchBar;
