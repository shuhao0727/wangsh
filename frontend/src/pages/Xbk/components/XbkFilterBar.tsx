/** XBK 侧边筛选栏：学年（可输入）、学期、年级、班级与关键词。
 *
 * 从 index.tsx 抽出。学年使用草稿态，只在完整合法时提交，
 * 避免逐字符输入触发请求。
 */
import React from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XBK_GRADES, type XbkGrade } from "../grades";

export type XbkFilterBarProps = {
  yearDraft: string;
  onYearDraftChange: (value: string) => void;
  onYearCommit: (value: string) => void;
  years: string[];
  filters: { year?: string; term?: string; grade?: XbkGrade; class_name?: string; search_text?: string };
  setFilters: React.Dispatch<React.SetStateAction<XbkFilterBarProps["filters"]>>;
  termOptions: string[];
  classOptions: { value: string; label: string }[];
  allValue: string;
  normalizeYear: (value: string) => string | null | undefined;
  isFullYear: (value: string) => boolean;
  /** 当前页签；未选课/休学接口不支持关键字过滤，据此隐藏搜索框。 */
  activeTab: string;
  /** 重置筛选：学年回到当前学年，清空其他条件。 */
  onReset: () => void;
};

const XbkFilterBar: React.FC<XbkFilterBarProps> = ({
  yearDraft,
  onYearDraftChange,
  onYearCommit,
  years,
  filters,
  setFilters,
  termOptions,
  classOptions,
  allValue,
  normalizeYear,
  isFullYear,
  activeTab,
  onReset,
}) => (
  <Card className="xbk-sidebar-card">
    <div className="xbk-filter-body">
      <div className="xbk-filter-field">
        <label htmlFor="xbk-filter-year">学年</label>
        {/* 可输入 + 候选列表：允许录入数据库尚不存在的学年 */}
        <div className="xbk-year-combobox">
          <Input
            id="xbk-filter-year"
            className="h-[var(--ws-control-height)] text-sm"
            aria-label="学年"
            placeholder="如 2026-2027"
            value={yearDraft}
            onChange={(e) => {
              // 只更新本地草稿；非法中间值不进入 filters，因此不会触发请求
              const next = e.target.value;
              onYearDraftChange(next);
              // 完整格式立即提交；纯 4 位年份等失焦/回车再补全提交
              if (isFullYear(next.trim())) {
                onYearCommit(next);
              }
            }}
            onBlur={() => {
              // 失焦时提交合法值（纯年份自动补全）；非法输入保留原样供修改
              const normalized = normalizeYear(yearDraft);
              if (normalized) {
                onYearDraftChange(normalized);
                onYearCommit(normalized);
              } else if (!yearDraft.trim()) {
                // 清空输入框视为“全部学年”
                onYearDraftChange("");
                onYearCommit("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="xbk-year-combobox-trigger"
                aria-label="选择已有学年"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
              <DropdownMenuItem
                onSelect={() => {
                  onYearDraftChange("");
                  setFilters((prev) => ({
                    ...prev,
                    year: undefined,
                    class_name: undefined,
                  }));
                }}
              >
                全部学年
              </DropdownMenuItem>
              {years.map((year) => (
                <DropdownMenuItem
                  key={year}
                  onSelect={() => {
                    onYearDraftChange(year);
                    setFilters((prev) => ({
                      ...prev,
                      year,
                      class_name: undefined,
                    }));
                  }}
                >
                  {year}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {yearDraft.trim() && !normalizeYear(yearDraft) ? (
          <p className="mt-1 whitespace-nowrap text-xs text-[var(--ws-color-warning)]">
            格式：YYYY-YYYY
          </p>
        ) : null}
      </div>

      <div className="xbk-filter-field">
        <label htmlFor="xbk-filter-term">学期</label>
        <Select
          value={filters.term || allValue}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              term: value === allValue ? undefined : value,
            }))
          }
        >
          <SelectTrigger
            id="xbk-filter-term"
            className="h-[var(--ws-control-height)] text-sm"
            aria-label="学期"
          >
            <SelectValue placeholder="选择学期" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allValue}>全部学期</SelectItem>
            {termOptions.map((term) => (
              <SelectItem key={term} value={term}>
                {term}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="xbk-filter-field">
        <label htmlFor="xbk-filter-grade">年级</label>
        <Select
          value={filters.grade || allValue}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              grade:
                value === allValue
                  ? undefined
                  : (value as (typeof XBK_GRADES)[number]),
              class_name: undefined,
            }))
          }
        >
          <SelectTrigger
            id="xbk-filter-grade"
            className="h-[var(--ws-control-height)] text-sm"
            aria-label="年级"
          >
            <SelectValue placeholder="选择年级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allValue}>全部年级</SelectItem>
            {XBK_GRADES.map((grade) => (
              <SelectItem key={grade} value={grade}>
                {grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="xbk-filter-field">
        <label htmlFor="xbk-filter-class">班级</label>
        <Select
          value={filters.class_name || allValue}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              class_name: value === allValue ? undefined : value,
            }))
          }
        >
          <SelectTrigger
            id="xbk-filter-class"
            className="h-[var(--ws-control-height)] text-sm"
            aria-label="班级"
          >
            <SelectValue placeholder="选择班级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allValue}>全部班级</SelectItem>
            {classOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 未选课 / 休学接口不支持关键字过滤，隐藏搜索框并说明，避免误以为搜索生效 */}
      {activeTab === "unselected" || activeTab === "suspended" ? (
        <div className="xbk-filter-field">
          <span className="text-xs leading-[var(--ws-control-height)] text-text-secondary">
            搜索
          </span>
          <p className="text-xs text-text-tertiary">
            当前页签不支持搜索，切换回列表页签后可用
          </p>
        </div>
      ) : (
        <div className="xbk-filter-field">
          <label htmlFor="xbk-filter-search">搜索</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              id="xbk-filter-search"
              aria-label="搜索"
              className="h-[var(--ws-control-height)] text-sm pl-[var(--ws-search-input-padding-start)]"
              value={filters.search_text || ""}
              placeholder="关键字搜索..."
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  search_text: e.target.value,
                }))
              }
            />
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-[var(--ws-control-height)] text-sm"
          onClick={onReset}
        >
          重置筛选
        </Button>
      </div>
    </div>
  </Card>
);

export default XbkFilterBar;
