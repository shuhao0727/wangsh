/**
 * 搜索栏 — 控件直接融入工作区，语义由占位符与无障碍名称承载
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
import { RotateCcw, Search } from "lucide-react";
import type { SearchFilterParams } from "@services/znt/types";
import { agentDataApi } from "@services/agents";

interface SearchBarProps {
  searchParams: SearchFilterParams;
  onSearch: (params: SearchFilterParams) => void;
  onReset: () => void;
  actionSlot?: React.ReactNode;
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

const SearchBar: React.FC<SearchBarProps> = ({ searchParams, onSearch, onReset, actionSlot }) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filterOptions, setFilterOptions] = useState(DEFAULT_FILTER_OPTIONS);

  useEffect(() => {
    void agentDataApi.getFilterOptions().then((res) => {
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

  return (
    <div className="ws-admin-filter-bar ws-usage-filters" role="search" aria-label="使用记录筛选">
      <div className="ws-usage-filter-top">
        <div className="ws-usage-field ws-usage-keyword">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              id="usage-filter-keyword"
              aria-label="搜索问题或回答"
              placeholder="搜索问题或回答..."
              value={form.keyword}
              onChange={(e) => setField("keyword", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              className="pl-9"
            />
          </div>
        </div>
        <div className="ws-usage-field">
          <div className="ws-usage-date-range" role="group" aria-label="使用日期范围">
            <Input
              type="date"
              aria-label="开始日期"
              value={form.start_date}
              onChange={(e) => setField("start_date", e.target.value)}
              className="w-[140px] border-0 bg-transparent"
            />
            <span className="text-xs text-text-tertiary">至</span>
            <Input
              type="date"
              aria-label="结束日期"
              value={form.end_date}
              onChange={(e) => setField("end_date", e.target.value)}
              className="w-[140px] border-0 bg-transparent"
            />
          </div>
        </div>
      </div>
      <div className="ws-usage-filter-bottom">
        <div className="ws-usage-conditions">
          <div className="ws-usage-field">
            <Select value={form.class_name || "__none__"} onValueChange={(v) => setField("class_name", v === "__none__" ? "" : v)}>
              <SelectTrigger id="usage-filter-class" aria-label="班级">
                <SelectValue placeholder="班级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">全部班级</SelectItem>
                {filterOptions.classNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ws-usage-field">
            <Select value={form.grade || "__none__"} onValueChange={(v) => setField("grade", v === "__none__" ? "" : v)}>
              <SelectTrigger id="usage-filter-year" aria-label="学年">
                <SelectValue placeholder="学年" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">全部学年</SelectItem>
                {filterOptions.grades.map((g) => <SelectItem key={g} value={g}>{g}级</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ws-usage-field">
            <Select value={form.agent_name || "__none__"} onValueChange={(v) => setField("agent_name", v === "__none__" ? "" : v)}>
              <SelectTrigger id="usage-filter-agent" aria-label="智能体">
                <SelectValue placeholder="智能体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">全部智能体</SelectItem>
                {filterOptions.agentNames.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ws-usage-field">
            <Input
              id="usage-filter-student"
              aria-label="学号"
              placeholder="输入学号"
              value={form.student_id}
              onChange={(e) => setField("student_id", e.target.value)}
            />
          </div>
          <div className="ws-usage-field">
            <Input
              id="usage-filter-name"
              aria-label="姓名"
              placeholder="输入姓名"
              value={form.student_name}
              onChange={(e) => setField("student_name", e.target.value)}
            />
          </div>
        </div>
        <div className="ws-usage-filter-actions">
          <Button type="button" onClick={handleSearch}>
            <Search className="h-4 w-4" />
            查询
          </Button>
          <Button type="button" variant="ghost" onClick={handleReset} aria-label="重置筛选" title="重置筛选">
            <RotateCcw className="h-4 w-4" />
            重置
          </Button>
          {actionSlot}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
