import React from "react";
import { Input, Select, Button } from "antd";
import { ReloadOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
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
  searchKeyword, selectedType, selectedRowKeys,
  onSearchChange, onSearch, onTypeChange, onReset, onBatchDelete, onAddAgent,
}) => (
  <div className="flex flex-wrap items-center gap-2 mb-4">
    <Search
      placeholder="搜索智能体..."
      allowClear
      value={searchKeyword}
      onChange={(e) => onSearchChange(e.target.value)}
      onSearch={onSearch}
      style={{ width: 240 }}
    />
    <Select value={selectedType} onChange={onTypeChange} style={{ width: 140 }}>
      <Option value="all">全部类型</Option>
      <Option value={AgentTypeValues.GENERAL}>通用智能体</Option>
      <Option value={AgentTypeValues.DIFY}>Dify智能体</Option>
    </Select>
    <Button icon={<ReloadOutlined />} onClick={onReset} />
    <div className="flex-1" />
    {selectedRowKeys.length > 0 && (
      <Button danger icon={<DeleteOutlined />} onClick={onBatchDelete}>
        批量删除 ({selectedRowKeys.length})
      </Button>
    )}
    <Button type="primary" icon={<PlusOutlined />} onClick={onAddAgent}>新建智能体</Button>
  </div>
);

export default SearchBar;
