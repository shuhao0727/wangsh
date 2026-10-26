/** 小组讨论管理页顶部工具栏：日期范围、关键词、智能体筛选与导出。 */
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export type DiscussionToolbarProps = {
  dateRange: [string, string];
  keyword: string;
  onKeywordChange: (value: string) => void;
  agents: { id: number; name?: string; agent_name?: string }[];
  selectedAgentId: number | null;
  onAgentChange: (value: number | null) => void;
  isLoading: boolean;
  exportLoading: boolean;
  onExport: () => void;
  frontendVisible: boolean;
  /** 切换学生端弹窗可见性：由主组件负责请求、提示与缓存失效。 */
  onFrontendVisibleChange: (enabled: boolean) => void | Promise<void>;
  /** 日期范围变化：回到第一页并重新拉取。 */
  onDateRangeChange: (range: [string, string]) => void;
  onResetPage: () => void;
  /** 当前筛选下的会话总数，用于工具栏计数展示。 */
  total: number;
  frontendVisibleLoading: boolean;
};

const DiscussionToolbar: React.FC<DiscussionToolbarProps> = ({
  dateRange, keyword, onKeywordChange, agents, selectedAgentId, onAgentChange,
  isLoading, exportLoading, onExport, frontendVisible, onFrontendVisibleChange, frontendVisibleLoading,
  onDateRangeChange, onResetPage, total,
}) => (
  <div
    className="ws-admin-filter-bar mb-0 flex flex-wrap items-center gap-2"
    role="toolbar"
    aria-label="小组讨论工具栏"
  >
      <div
        className="ws-admin-filter-bar mb-0 flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label="小组讨论工具栏"
      >
        <form
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          role="search"
          aria-label="小组讨论筛选"
          onSubmit={(event) => {
            event.preventDefault();
            onResetPage();
          }}
        >
          <div className="flex h-[var(--ws-control-height)] shrink-0 items-center gap-1 rounded-sm border border-border-secondary bg-surface px-1.5">
            <Input
              type="date"
              aria-label="开始日期"
              className="h-[34px] w-[132px] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
              value={dateRange[0]}
              onChange={(e) => onDateRangeChange([e.target.value, dateRange[1]])}
            />
            <span className="shrink-0 text-xs text-text-tertiary">至</span>
            <Input
              type="date"
              aria-label="结束日期"
              className="h-[34px] w-[132px] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
              value={dateRange[1]}
              onChange={(e) => onDateRangeChange([dateRange[0], e.target.value])}
            />
          </div>
          <Input
            aria-label="关键词"
            className="h-[var(--ws-control-height)] min-w-[180px] flex-1"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="搜索班级、组号或组名"
          />
          <Select
            value={selectedAgentId ? String(selectedAgentId) : "__none__"}
            onValueChange={(value) => onAgentChange(value === "__none__" ? null : Number(value))}
          >
            <SelectTrigger aria-label="分析智能体" className="h-[var(--ws-control-height)] w-[150px] shrink-0 text-sm">
              <SelectValue placeholder="智能体" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不指定智能体</SelectItem>
              {(agents || []).map((agent) => (
                <SelectItem key={agent.id} value={String(agent.id)}>
                  {agent.agent_name || agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="shrink-0"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            查询
          </Button>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {total > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 shrink-0"
              disabled={exportLoading}
              onClick={onExport}
            >
              {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              导出
            </Button>
          ) : null}
          <label className="flex h-8 shrink-0 items-center gap-2 px-2 text-xs text-text-secondary">
            <span>学生端弹窗</span>
            <Switch
              aria-label="切换学生端弹窗可见性"
              checked={frontendVisible}
              disabled={frontendVisibleLoading}
              onCheckedChange={onFrontendVisibleChange}
            />
            {frontendVisibleLoading ? <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" /> : null}
          </label>
        </div>
      </div>
  </div>
);

export default DiscussionToolbar;
