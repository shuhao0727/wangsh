import React from "react";
import {
  Network,
  XCircle,
  GitMerge,
  GripVertical,
  Download,
  Eye,
  FlaskConical,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Columns,
  RefreshCw,
  Upload,
  ZoomIn,
  ZoomOut,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Divider = () => (
  <div className="w-px h-3 bg-border mx-3.5 flex-shrink-0" />
);

// 按钮组：组内按钮紧凑，组间用 Divider
const Group: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2">{children}</div>
);

const Tip: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children as React.ReactElement}</TooltipTrigger>
    <TooltipContent>{title}</TooltipContent>
  </Tooltip>
);

export const CanvasToolbar = React.memo(function CanvasToolbar(props: {
  leftCollapsed: boolean;
  toggleLeft: () => void;
  demoOptions: { key: string; label: string; description?: string }[];
  onLoadDemo: (key: string) => void;
  onArrange: () => void | Promise<void>;
  autoLayout: boolean;
  onToggleAutoLayout: () => void;
  connectMode: boolean;
  onToggleConnect: () => void;
  panMode: boolean;
  onTogglePan: () => void;
  followMode: boolean;
  onToggleFollow: () => void;
  canDelete: boolean;
  onDelete: () => void;
  onClear: () => void;
  onAddNote: () => void;
  onExportFlow?: () => void;
  onImportFlow?: (jsonText: string) => void;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
}) {
  const {
    leftCollapsed, toggleLeft, demoOptions, onLoadDemo,
    onArrange, autoLayout, onToggleAutoLayout,
    connectMode, onToggleConnect, panMode, onTogglePan,
    followMode, onToggleFollow, canDelete, onDelete, onClear,
    onAddNote, onExportFlow, onImportFlow, scale, setScale,
  } = props;
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const btn = "text-text-secondary";
  const activeCls = "text-primary bg-primary-soft";
  const iconBtn = "h-8 w-8 p-0";

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex items-center flex-wrap gap-2 max-w-full px-0.5">
        {/* 左侧面板切换 */}
        <Group>
          <Tip title={leftCollapsed ? "展开左侧模块" : "收起左侧模块"}>
            <Button variant="ghost" size="sm"
              onClick={toggleLeft} className={`${btn} ${iconBtn}`}>
              {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </Tip>
        </Group>

        <Divider />

        {/* 示例 + 整理 */}
        <Group>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={`${btn} ${iconBtn}`} title="示例流程">
                <FlaskConical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px]">
              {demoOptions.map((d) => (
                <DropdownMenuItem key={d.key} onClick={() => onLoadDemo(String(d.key))}>
                  <div>
                    <div className="text-sm font-semibold">{d.label}</div>
                    {d.description ? <div className="text-xs text-text-tertiary">{d.description}</div> : null}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Tip title="立即整理">
            <Button variant="ghost" size="sm" onClick={onArrange} className={`${btn} ${iconBtn}`}><Network className="h-4 w-4" /></Button>
          </Tip>
          <Tip title={autoLayout ? "自动整理：开启" : "自动整理：关闭"}>
            <Button variant="ghost" size="sm"
              className={`${autoLayout ? activeCls : btn} ${iconBtn}`} onClick={onToggleAutoLayout}><RefreshCw className="h-4 w-4" /></Button>
          </Tip>
        </Group>

        <Divider />

        {/* 交互模式 */}
        <Group>
          <Tip title="连线模式">
            <Button variant="ghost" size="sm"
              className={`${connectMode ? activeCls : btn} ${iconBtn}`} onClick={onToggleConnect}><GitMerge className="h-4 w-4" /></Button>
          </Tip>
          <Tip title="抓手移动">
            <Button variant="ghost" size="sm"
              className={`${panMode ? activeCls : btn} ${iconBtn}`} onClick={onTogglePan}><GripVertical className="h-4 w-4" /></Button>
          </Tip>
          <Tip title="跟随执行点">
            <Button variant="ghost" size="sm"
              className={`${followMode ? activeCls : btn} ${iconBtn}`} onClick={onToggleFollow}><Eye className="h-4 w-4" /></Button>
          </Tip>
        </Group>

        <Divider />

        {/* 编辑操作 */}
        <Group>
          <Tip title="删除选中">
            <Button variant="destructive" size="sm" disabled={!canDelete} onClick={onDelete} className={iconBtn}><Trash2 className="h-4 w-4" /></Button>
          </Tip>
          <Tip title="清空画布">
            <Button variant="destructive" size="sm" onClick={onClear} className={iconBtn}><XCircle className="h-4 w-4" /></Button>
          </Tip>
          <Tip title="添加注释">
            <Button variant="ghost" size="sm" onClick={onAddNote} className={`${btn} ${iconBtn}`}><MessageSquare className="h-4 w-4" /></Button>
          </Tip>
        </Group>

        <Divider />

        {/* 导入/导出 */}
        <Group>
          <Tip title="导入流程图">
            <Button variant="ghost" size="sm"
              onClick={() => fileRef.current?.click()} className={`${btn} ${iconBtn}`}><Upload className="h-4 w-4" /></Button>
          </Tip>
          <Tip title="导出流程图">
            <Button variant="ghost" size="sm"
              onClick={() => onExportFlow?.()} className={`${btn} ${iconBtn}`}><Download className="h-4 w-4" /></Button>
          </Tip>
          <input
            id="import-flow-input"
            name="import-flow-input"
            aria-label="导入流程图"
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              if (!f) return;
              const r = new FileReader();
              r.onload = () => { onImportFlow?.(typeof r.result === "string" ? r.result : ""); };
              r.readAsText(f);
              e.currentTarget.value = "";
            }}
          />
        </Group>

        <Divider />

        {/* 缩放 */}
        <Group>
          <Tip title="缩小">
            <Button variant="ghost" size="sm"
              onClick={() => setScale((s) => Math.max(0.2, s - 0.1))} className={`${btn} ${iconBtn}`}><ZoomOut className="h-4 w-4" /></Button>
          </Tip>
          <Tip title={`重置缩放（${Math.round(scale * 100)}%）`}>
            <Button variant="ghost" size="sm"
              onClick={() => setScale(1)} className={`${btn} ${iconBtn}`}><Columns className="h-4 w-4" /></Button>
          </Tip>
          <Tip title="放大">
            <Button variant="ghost" size="sm"
              onClick={() => setScale((s) => Math.min(3, s + 0.1))} className={`${btn} ${iconBtn}`}><ZoomIn className="h-4 w-4" /></Button>
          </Tip>
        </Group>
      </div>
    </TooltipProvider>
  );
});
