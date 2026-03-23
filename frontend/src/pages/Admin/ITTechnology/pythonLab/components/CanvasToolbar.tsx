import React from "react";
import { Button, Dropdown, Tooltip } from "antd";
import {
  ApartmentOutlined,
  ClearOutlined,
  NodeIndexOutlined,
  DragOutlined,
  DownloadOutlined,
  EyeOutlined,
  ExperimentOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  ColumnWidthOutlined,
  SyncOutlined,
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

const Divider = () => (
  <div className="w-px h-4 bg-black/[0.1] mx-2 flex-shrink-0" />
);

// 按钮组：组内按钮紧凑，组间用 Divider
const Group: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-0.5">{children}</div>
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

  return (
    <div className="flex items-center flex-wrap gap-1 max-w-full px-1">
      {/* 左侧面板切换 */}
      <Group>
        <Tooltip title={leftCollapsed ? "展开左侧模块" : "收起左侧模块"}>
          <Button type="text" size="small"
            icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleLeft} className={btn} />
        </Tooltip>
      </Group>

      <Divider />

      {/* 示例 + 整理 */}
      <Group>
        <Dropdown trigger={["click"]} menu={{
          items: demoOptions.map((d) => ({
            key: d.key,
            label: (
              <div style={{ minWidth: 180 }}>
                <div className="font-semibold text-sm">{d.label}</div>
                {d.description && <div className="text-xs text-text-tertiary">{d.description}</div>}
              </div>
            ),
          })),
          onClick: ({ key }) => onLoadDemo(String(key)),
        }}>
          <Tooltip title="示例流程">
            <Button type="text" size="small" icon={<ExperimentOutlined />} className={btn} />
          </Tooltip>
        </Dropdown>
        <Tooltip title="立即整理">
          <Button type="text" size="small" icon={<ApartmentOutlined />} onClick={onArrange} className={btn} />
        </Tooltip>
        <Tooltip title={autoLayout ? "自动整理：开启" : "自动整理：关闭"}>
          <Button type="text" size="small" icon={<SyncOutlined />}
            className={autoLayout ? activeCls : btn} onClick={onToggleAutoLayout} />
        </Tooltip>
      </Group>

      <Divider />

      {/* 交互模式 */}
      <Group>
        <Tooltip title="连线模式">
          <Button type="text" size="small" icon={<NodeIndexOutlined />}
            className={connectMode ? activeCls : btn} onClick={onToggleConnect} />
        </Tooltip>
        <Tooltip title="抓手移动">
          <Button type="text" size="small" icon={<DragOutlined />}
            className={panMode ? activeCls : btn} onClick={onTogglePan} />
        </Tooltip>
        <Tooltip title="跟随执行点">
          <Button type="text" size="small" icon={<EyeOutlined />}
            className={followMode ? activeCls : btn} onClick={onToggleFollow} />
        </Tooltip>
      </Group>

      <Divider />

      {/* 编辑操作 */}
      <Group>
        <Tooltip title="删除选中">
          <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete} onClick={onDelete} />
        </Tooltip>
        <Tooltip title="清空画布">
          <Button type="text" size="small" danger icon={<ClearOutlined />} onClick={onClear} />
        </Tooltip>
        <Tooltip title="添加注释">
          <Button type="text" size="small" icon={<MessageOutlined />} onClick={onAddNote} className={btn} />
        </Tooltip>
      </Group>

      <Divider />

      {/* 导入/导出 */}
      <Group>
        <Tooltip title="导入流程图">
          <Button type="text" size="small" icon={<UploadOutlined />}
            onClick={() => fileRef.current?.click()} className={btn} />
        </Tooltip>
        <Tooltip title="导出流程图">
          <Button type="text" size="small" icon={<DownloadOutlined />}
            onClick={() => onExportFlow?.()} className={btn} />
        </Tooltip>
        <input id="import-flow-input" name="import-flow-input" aria-label="导入流程图"
          ref={fileRef} type="file" accept="application/json" className="hidden"
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
        <Tooltip title="缩小">
          <Button type="text" size="small" icon={<ZoomOutOutlined />}
            onClick={() => setScale((s) => Math.max(0.2, s - 0.1))} className={btn} />
        </Tooltip>
        <Tooltip title={`重置缩放（${Math.round(scale * 100)}%）`}>
          <Button type="text" size="small" icon={<ColumnWidthOutlined />}
            onClick={() => setScale(1)} className={btn} />
        </Tooltip>
        <Tooltip title="放大">
          <Button type="text" size="small" icon={<ZoomInOutlined />}
            onClick={() => setScale((s) => Math.min(3, s + 0.1))} className={btn} />
        </Tooltip>
      </Group>
    </div>
  );
});
