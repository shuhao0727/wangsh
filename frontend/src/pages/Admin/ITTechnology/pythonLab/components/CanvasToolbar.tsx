import React from "react";
import { Button, Dropdown, Space, Tooltip } from "antd";
import {
  ApartmentOutlined,
  DeleteOutlined,
  DragOutlined,
  DownloadOutlined,
  EyeOutlined,
  ExperimentOutlined,
  LinkOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  ReloadOutlined,
  ShrinkOutlined,
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";

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
    leftCollapsed,
    toggleLeft,
    demoOptions,
    onLoadDemo,
    onArrange,
    autoLayout,
    onToggleAutoLayout,
    connectMode,
    onToggleConnect,
    panMode,
    onTogglePan,
    followMode,
    onToggleFollow,
    canDelete,
    onDelete,
    onClear,
    onAddNote,
    onExportFlow,
    onImportFlow,
    scale,
    setScale,
  } = props;
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  
  const toolButtonStyle: React.CSSProperties = {
    color: "var(--ws-color-text-secondary)",
  };
  const activeStyle: React.CSSProperties = {
    color: "var(--ws-color-primary)",
    background: "var(--ws-color-primary-bg)",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 4,
        maxWidth: "100%",
      }}
    >
      <Tooltip title={leftCollapsed ? "展开左侧模块" : "收起左侧模块"}>
        <Button type="text" icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={toggleLeft} style={toolButtonStyle} />
      </Tooltip>
      
      <div style={{ width: 1, height: 16, background: "var(--ws-color-border-secondary)", margin: "0 4px" }} />

      <Dropdown
        trigger={["click"]}
        menu={{
          items: demoOptions.map((d) => ({
            key: d.key,
            label: (
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 600 }}>{d.label}</div>
                {d.description ? <div style={{ fontSize: 12, color: "var(--ws-color-text-tertiary)" }}>{d.description}</div> : null}
              </div>
            ),
          })),
          onClick: ({ key }) => onLoadDemo(String(key)),
        }}
      >
        <Tooltip title="示例流程">
          <Button type="text" icon={<ExperimentOutlined />} style={toolButtonStyle} />
        </Tooltip>
      </Dropdown>
      <Tooltip title="立即执行整理">
        <Button type="text" icon={<ApartmentOutlined />} onClick={onArrange} style={toolButtonStyle} />
      </Tooltip>
      <Tooltip title={autoLayout ? "自动整理模式：开启" : "自动整理模式：关闭"}>
        <Button
          type="text"
          icon={<ApartmentOutlined />}
          style={autoLayout ? activeStyle : toolButtonStyle}
          onClick={onToggleAutoLayout}
        />
      </Tooltip>
      
      <div style={{ width: 1, height: 16, background: "var(--ws-color-border-secondary)", margin: "0 4px" }} />

      <Tooltip title="切换连线模式">
        <Button 
            type="text" 
            icon={<LinkOutlined />} 
            style={connectMode ? activeStyle : toolButtonStyle}
            onClick={onToggleConnect} 
        />
      </Tooltip>
      <Tooltip title="抓手移动画布">
        <Button 
            type="text" 
            icon={<DragOutlined />} 
            style={panMode ? activeStyle : toolButtonStyle}
            onClick={onTogglePan} 
        />
      </Tooltip>
      <Tooltip title="跟随执行点">
        <Button 
            type="text" 
            icon={<EyeOutlined />} 
            style={followMode ? activeStyle : toolButtonStyle}
            onClick={onToggleFollow} 
        />
      </Tooltip>

      <div style={{ width: 1, height: 16, background: "var(--ws-color-border-secondary)", margin: "0 4px" }} />

      <Tooltip title="删除选中节点/连线">
        <Button type="text" danger icon={<DeleteOutlined />} disabled={!canDelete} onClick={onDelete} />
      </Tooltip>
      <Tooltip title="清空画布">
        <Button type="text" danger icon={<ReloadOutlined />} onClick={onClear} />
      </Tooltip>
      <Tooltip title="注释工具">
        <Button type="text" icon={<MessageOutlined />} onClick={onAddNote} style={toolButtonStyle} />
      </Tooltip>

      <div style={{ width: 1, height: 16, background: "var(--ws-color-border-secondary)", margin: "0 4px" }} />

      <Tooltip title="导入流程图">
        <Button
          type="text"
          icon={<UploadOutlined />}
          onClick={() => fileRef.current?.click()}
          style={toolButtonStyle}
        />
      </Tooltip>
      <Tooltip title="导出流程图">
        <Button type="text" icon={<DownloadOutlined />} onClick={() => onExportFlow?.()} style={toolButtonStyle} />
      </Tooltip>
      <input
        id="import-flow-input"
        name="import-flow-input"
        aria-label="导入流程图"
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          if (!f) return;
          const r = new FileReader();
          r.onload = () => {
            const text = typeof r.result === "string" ? r.result : "";
            onImportFlow?.(text);
          };
          r.readAsText(f);
          e.currentTarget.value = "";
        }}
      />

      <div style={{ width: 1, height: 16, background: "var(--ws-color-border-secondary)", margin: "0 4px" }} />

      <Tooltip title="缩小">
        <Button type="text" icon={<ZoomOutOutlined />} onClick={() => setScale((s) => Math.max(0.2, s - 0.1))} style={toolButtonStyle} />
      </Tooltip>
      <Tooltip title={`重置缩放（当前 ${Math.round(scale * 100)}%）`}>
        <Button type="text" icon={<ShrinkOutlined />} onClick={() => setScale(1)} style={toolButtonStyle} />
      </Tooltip>
      <Tooltip title="放大">
        <Button type="text" icon={<ZoomInOutlined />} onClick={() => setScale((s) => Math.min(3, s + 0.1))} style={toolButtonStyle} />
      </Tooltip>
    </div>
  );
});
