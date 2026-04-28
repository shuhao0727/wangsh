/**
 * 搜索栏 — 主行紧凑，高级筛选可折叠
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
import { agentDataApi } from "@services/agents";

interface SearchBarProps {
  searchParams: SearchFilterParams;
  onSearch: (params: SearchFilterParams) => void;
  onReset: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
}

const DEFAULT_FILTER_OPTIONS = {
  grades: [] as string[],
  classNames: [] as string[],
  agentNames: [] as string[],
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
  const [filterOptions, setFilterOptions] = useState(DEFAULT_FILTER_OPTIONS);

  useEffect(() => {
    agentDataApi.getFilterOptions().then((res) => {
      if (res.success) {
        setFilterOptions({
          grades: res.data.grades || [],
          classNames: res.data.class_names || [],
          agentNames: res.data.agent_names || [],
        });
      }
    });
  }, []);

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

  const activeFilterCount = [form.class_name, form.grade, form.agent_name, form.student_id, form.student_name].filter(Boolean).length;

  return (
    <div className="flex-none">
      {/* 主行 */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="搜索问题或回答..."
          value={form.keyword}
          onChange={(e) => setField("keyword", e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          className="h-8 flex-1 min-w-0"
        />
        <Button type="button" size="sm" className="h-8 shrink-0" onClick={handleSearch}>
          <Search className="h-3.5 w-3.5" />
          查询
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={handleReset}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={showAdvanced ? "secondary" : "ghost"}
          size="sm"
          className="h-8 shrink-0"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          筛选
          {activeFilterCount > 0 ? (
            <span className="ml-1 rounded bg-primary px-1 text-[10px] text-primary-foreground">{activeFilterCount}</span>
          ) : null}
        </Button>
        {onExport ? (
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={onExport} disabled={exportDisabled}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {/* 高级筛选 */}
      {showAdvanced ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={form.start_date}
            onChange={(e) => setField("start_date", e.target.value)}
            className="h-8 w-[136px]"
          />
          <span className="text-xs text-text-tertiary">至</span>
          <Input
            type="date"
            value={form.end_date}
            onChange={(e) => setField("end_date", e.target.value)}
            className="h-8 w-[136px]"
          />
          <Select value={form.class_name || "__none__"} onValueChange={(v) => setField("class_name", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="班级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">全部班级</SelectItem>
              {filterOptions.classNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.grade || "__none__"} onValueChange={(v) => setField("grade", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue placeholder="学年" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">全部学年</SelectItem>
              {filterOptions.grades.map((g) => <SelectItem key={g} value={g}>{g}级</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.agent_name || "__none__"} onValueChange={(v) => setField("agent_name", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="智能体" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">全部智能体</SelectItem>
              {filterOptions.agentNames.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="学号"
            value={form.student_id}
            onChange={(e) => setField("student_id", e.target.value)}
            className="h-8 w-[100px] text-xs"
          />
          <Input
            placeholder="姓名"
            value={form.student_name}
            onChange={(e) => setField("student_name", e.target.value)}
            className="h-8 w-[100px] text-xs"
          />
        </div>
      ) : null}
    </div>
  );
};

export default SearchBar;
