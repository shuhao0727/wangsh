import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterToolbarProps {
  keyword: string;
  onKeywordChange: (v: string) => void;
  filter: string;
  onFilterChange: (v: string) => void;
  filterOptions: { value: string; label: string }[];
  totalCount: number;
  placeholder?: string;
  filterLabel?: string;
}

const FilterToolbar: React.FC<FilterToolbarProps> = ({
  keyword,
  onKeywordChange,
  filter,
  onFilterChange,
  filterOptions,
  totalCount,
  placeholder = "搜索...",
  filterLabel = "筛选",
}) => {
  return (
    <div className="rounded-lg border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder={placeholder}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {filterLabel && (
            <span className="shrink-0 text-xs text-text-tertiary">{filterLabel}</span>
          )}
          <Select value={filter} onValueChange={onFilterChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="mt-2 text-xs text-text-tertiary">
        匹配 {totalCount} 个条目
      </p>
    </div>
  );
};

export default FilterToolbar;
