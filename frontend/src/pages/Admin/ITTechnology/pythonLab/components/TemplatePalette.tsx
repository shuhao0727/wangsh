import React from "react";
import { Collapse, Tag } from "antd";
import type { FlowNodeTemplate } from "../types";
import { ShapeIcon } from "./ShapeIcon";

const NodeCard: React.FC<{ tpl: FlowNodeTemplate; badge?: boolean; onClick: () => void }> = ({ tpl, badge, onClick }) => (
  <div
    onClick={onClick}
    className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-150 hover:bg-primary-soft"
  >
    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-2 text-text-base flex-shrink-0">
      <ShapeIcon shape={tpl.key} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-sm text-text-base">{tpl.title}</span>
        {badge && <Tag color="gold" className="!m-0 !text-xs !leading-4 !h-[16px]">高级</Tag>}
      </div>
      <div className="text-xs text-text-tertiary truncate">{tpl.description}</div>
    </div>
  </div>
);

export function TemplatePalette(props: {
  basic: FlowNodeTemplate[];
  advanced: FlowNodeTemplate[];
  onAddNode: (tpl: FlowNodeTemplate) => void;
}) {
  const { basic, advanced, onAddNode } = props;
  return (
    <div className="flex flex-col h-full">
      {/* 标题 */}
      <div className="px-3 py-2.5 text-sm font-semibold text-text-base flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        流程图模块
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
        {/* 基础模块 */}
        <div className="flex flex-col">
          {basic.map((tpl) => (
            <NodeCard key={tpl.key} tpl={tpl} onClick={() => onAddNode(tpl)} />
          ))}
        </div>

        {/* 高级模块 */}
        {advanced.length > 0 && (
          <Collapse
            ghost
            className="!px-0"
            items={[{
              key: "advanced",
              label: <span className="text-xs font-medium text-text-secondary">高级模块</span>,
              children: (
                <div className="flex flex-col -mx-2">
                  {advanced.map((tpl) => (
                    <NodeCard key={tpl.key} tpl={tpl} badge onClick={() => onAddNode(tpl)} />
                  ))}
                </div>
              ),
            }]}
          />
        )}
      </div>
    </div>
  );
}
