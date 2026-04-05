/**
 * 搜索栏 — 紧凑单行，展开高级筛选
 */

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { SearchFilterParams } from "@services/znt/types";

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

type FormState = {
  keyword: string;
  student_id: string;
  student_name: string;
  class_name: string;
  grade: string;
  agent_name: string;
  start_date: string;
  end_date: string;
};

const EMPTY_FORM: FormState = {
  keyword: "",
  student_id: "",
  student_name: "",
  class_name: "",
  grade: "",
  agent_name: "",
  start_date: "",
  end_date: "",
};

const SearchBar: React.FC<SearchBarProps> = ({ searchParams, onSearch, onReset, onExport, exportDisabled }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    setForm({
      keyword: searchParams.keyword || "",
      student_id: searchParams.student_id || "",
      student_name: searchParams.student_name || "",
      class_name: searchParams.class_name || "",
      grade: searchParams.grade || "",
      agent_name: searchParams.agent_name || "",
      start_date: searchParams.start_date || "",
      end_date: searchParams.end_date || "",
    });
  }, [searchParams]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    const params: SearchFilterParams = {
      keyword: form.keyword || undefined,
      student_id: form.student_id || undefined,
      student_name: form.student_name || undefined,
      class_name: form.class_name || undefined,
      grade: form.grade || undefined,
      agent_name: form.agent_name || undefined,
      page: 1,
      page_size: searchParams.page_size || 20,
    };

    if (form.start_date && form.end_date) {
      params.start_date = form.start_date;
      params.end_date = form.end_date;
    }

    onSearch(params);
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    onReset();
  };

  return (
    <div className="mb-2 flex-none py-3">
      <div className="flex flex-nowrap items-center gap-3">
        <div className="grid flex-1 grid-cols-12 gap-3">
          <div className="col-span-4">
            <Input
              placeholder="搜索问题或回答..."
              value={form.keyword}
              onChange={(e) => setField("keyword", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
          </div>
          <div className="col-span-2">
            <Input
              placeholder="学号"
              value={form.student_id}
              onChange={(e) => setField("student_id", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
          </div>
          <div className="col-span-2">
            <Input
              placeholder="学生姓名"
              value={form.student_name}
              onChange={(e) => setField("student_name", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
          </div>
          <div className="col-span-4 flex items-center gap-2">
            <Button type="button" onClick={handleSearch}>
              <Search className="h-4 w-4" />
              查询
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              重置
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowAdvanced((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4" />
              {showAdvanced ? "收起" : "筛选"}
            </Button>
            {onExport ? (
              <Button type="button" variant="outline" onClick={onExport} disabled={exportDisabled}>
                <Download className="h-4 w-4" />
                导出
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {showAdvanced ? (
        <div className="mt-3 border-t border-border-secondary pt-3">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3 space-y-1">
              <div className="text-xs text-text-tertiary">班级</div>
              <Select
                value={form.class_name || "__none__"}
                onValueChange={(v) => setField("class_name", v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">全部</SelectItem>
                  {filterOptions.classNames.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-3 space-y-1">
              <div className="text-xs text-text-tertiary">学年</div>
              <Select
                value={form.grade || "__none__"}
                onValueChange={(v) => setField("grade", v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择学年" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">全部</SelectItem>
                  {filterOptions.grades.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}级
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-3 space-y-1">
              <div className="text-xs text-text-tertiary">智能体</div>
              <Select
                value={form.agent_name || "__none__"}
                onValueChange={(v) => setField("agent_name", v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择智能体" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">全部</SelectItem>
                  {filterOptions.agentNames.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-3 space-y-1">
              <div className="text-xs text-text-tertiary">时间范围</div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setField("start_date", e.target.value)}
                />
                <span className="text-text-tertiary">-</span>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setField("end_date", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SearchBar;
