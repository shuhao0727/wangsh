import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw, Trash2, Plus, Search, X } from "lucide-react";
import { AgentTypeValues } from "@services/znt/types";

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
  <div className="flex flex-wrap items-center gap-2 mb-4 ws-responsive-toolbar">
    <div className="relative w-[220px] max-w-full">
      <Input
        placeholder="搜索智能体..."
        value={searchKeyword}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch((e.currentTarget as HTMLInputElement).value);
        }}
        className="pr-8"
      />
      {searchKeyword ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
          onClick={() => {
            onSearchChange("");
            onSearch("");
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
    <Button type="button" variant="outline" onClick={() => onSearch(searchKeyword)}>
      <Search className="h-4 w-4" />
      搜索
    </Button>
    <Select value={selectedType} onValueChange={onTypeChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="全部类型" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">全部类型</SelectItem>
        <SelectItem value={AgentTypeValues.GENERAL}>通用智能体</SelectItem>
        <SelectItem value={AgentTypeValues.DIFY}>Dify智能体</SelectItem>
      </SelectContent>
    </Select>
    <Button variant="outline" onClick={onReset}><RotateCcw className="h-4 w-4" /></Button>
    <div className="flex-1" />
    {selectedRowKeys.length > 0 && (
      <Button variant="destructive" onClick={onBatchDelete}>
        <Trash2 className="h-4 w-4" />批量删除 ({selectedRowKeys.length})
      </Button>
    )}
    <Button onClick={onAddAgent}><Plus className="h-4 w-4" />新建智能体</Button>
  </div>
);

export default SearchBar;
