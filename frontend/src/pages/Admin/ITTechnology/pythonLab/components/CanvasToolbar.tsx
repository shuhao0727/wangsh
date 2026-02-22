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
  ReloadOutlined,
  ShrinkOutlined,
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";

export function CanvasToolbar(props: {
  leftCollapsed: boolean;
  toggleLeft: () => void;
  demoOptions: { key: string; label: string; description?: string }[];
  onLoadDemo: (key: string) => void;
  onArrange: () => void | Promise<void>;
  connectMode: boolean;
  onToggleConnect: () => void;
  panMode: boolean;
  onTogglePan: () => void;
  followMode: boolean;
  onToggleFollow: () => void;
  canDelete: boolean;
  onDelete: () => void;
  onClear: () => void;
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
    connectMode,
    onToggleConnect,
    panMode,
    onTogglePan,
    followMode,
    onToggleFollow,
    canDelete,
    onDelete,
    onClear,
    onExportFlow,
    onImportFlow,
    scale,
    setScale,
  } = props;
  const fileRef = React.useRef<HTMLInputElement | null>(null);
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
        <Button type="text" icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={toggleLeft} />
      </Tooltip>
      
      <div style={{ width: 1, height: 16, background: "#f0f0f0", margin: "0 4px" }} />

      <Dropdown
        trigger={["click"]}
        menu={{
          items: demoOptions.map((d) => ({
            key: d.key,
            label: (
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 600 }}>{d.label}</div>
                {d.description ? <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>{d.description}</div> : null}
              </div>
            ),
          })),
          onClick: ({ key }) => onLoadDemo(String(key)),
        }}
      >
        <Tooltip title="示例流程">
          <Button type="text" icon={<ExperimentOutlined />} />
        </Tooltip>
      </Dropdown>
      <Tooltip title="自动整理布局">
        <Button type="text" icon={<ApartmentOutlined />} onClick={onArrange} />
      </Tooltip>
      
      <div style={{ width: 1, height: 16, background: "#f0f0f0", margin: "0 4px" }} />

      <Tooltip title="切换连线模式">
        <Button 
            type="text" 
            icon={<LinkOutlined style={{ color: connectMode ? '#1890ff' : undefined }} />} 
            style={{ background: connectMode ? '#e6f7ff' : undefined }}
            onClick={onToggleConnect} 
        />
      </Tooltip>
      <Tooltip title="抓手移动画布">
        <Button 
            type="text" 
            icon={<DragOutlined style={{ color: panMode ? '#1890ff' : undefined }} />} 
            style={{ background: panMode ? '#e6f7ff' : undefined }}
            onClick={onTogglePan} 
        />
      </Tooltip>
      <Tooltip title="跟随执行点">
        <Button 
            type="text" 
            icon={<EyeOutlined style={{ color: followMode ? '#1890ff' : undefined }} />} 
            style={{ background: followMode ? '#e6f7ff' : undefined }}
            onClick={onToggleFollow} 
        />
      </Tooltip>

      <div style={{ width: 1, height: 16, background: "#f0f0f0", margin: "0 4px" }} />

      <Tooltip title="删除选中节点/连线">
        <Button type="text" danger icon={<DeleteOutlined />} disabled={!canDelete} onClick={onDelete} />
      </Tooltip>
      <Tooltip title="清空画布">
        <Button type="text" danger icon={<ReloadOutlined />} onClick={onClear} />
      </Tooltip>

      <div style={{ width: 1, height: 16, background: "#f0f0f0", margin: "0 4px" }} />

      <Tooltip title="导入流程图">
        <Button
          type="text"
          icon={<UploadOutlined />}
          onClick={() => fileRef.current?.click()}
        />
      </Tooltip>
      <Tooltip title="导出流程图">
        <Button type="text" icon={<DownloadOutlined />} onClick={() => onExportFlow?.()} />
      </Tooltip>
      <input
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

      <div style={{ width: 1, height: 16, background: "#f0f0f0", margin: "0 4px" }} />

      <Tooltip title="缩小">
        <Button type="text" icon={<ZoomOutOutlined />} onClick={() => setScale((s) => Math.max(0.2, s - 0.1))} />
      </Tooltip>
      <Tooltip title={`重置缩放（当前 ${Math.round(scale * 100)}%）`}>
        <Button type="text" icon={<ShrinkOutlined />} onClick={() => setScale(1)} />
      </Tooltip>
      <Tooltip title="放大">
        <Button type="text" icon={<ZoomInOutlined />} onClick={() => setScale((s) => Math.min(3, s + 0.1))} />
      </Tooltip>
    </div>
  );
}
