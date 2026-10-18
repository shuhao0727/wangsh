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
import { cn } from "@/lib/utils";

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
  className?: string;
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
  className,
}) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-2 border-b border-border-secondary px-4 py-2.5 ws-responsive-toolbar",
      className,
    )}
    role="toolbar"
    aria-label="智能体筛选与操作"
  >
    <div className="flex min-w-0 flex-[1_1_460px] flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <Input
          aria-label="搜索智能体名称"
          placeholder="搜索智能体..."
          value={searchKeyword}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              onSearch((e.currentTarget as HTMLInputElement).value);
          }}
          className="pl-9 pr-9"
        />
        {searchKeyword ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
            aria-label="清空搜索"
            title="清空搜索"
            onClick={() => {
              onSearchChange("");
              onSearch("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onSearch(searchKeyword)}
      >
        <Search className="h-3.5 w-3.5" />
        搜索
      </Button>
      <Select value={selectedType} onValueChange={onTypeChange}>
        <SelectTrigger aria-label="智能体类型" className="w-[140px]">
          <SelectValue placeholder="全部类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部类型</SelectItem>
          <SelectItem value={AgentTypeValues.GENERAL}>通用智能体</SelectItem>
          <SelectItem value={AgentTypeValues.DIFY}>Dify智能体</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onReset}
        aria-label="重置筛选"
        title="重置筛选"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {selectedRowKeys.length > 0 && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onBatchDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          批量删除 ({selectedRowKeys.length})
        </Button>
      )}
      <Button type="button" size="sm" onClick={onAddAgent}>
        <Plus className="h-3.5 w-3.5" />
        新建智能体
      </Button>
    </div>
  </div>
);

export default SearchBar;
