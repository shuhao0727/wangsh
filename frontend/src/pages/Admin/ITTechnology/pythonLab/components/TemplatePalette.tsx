import React from "react";
import { Badge } from "@/components/ui/badge";
import type { FlowNodeTemplate } from "../types";
import { ShapeIcon } from "./ShapeIcon";

const NodeCard: React.FC<{ tpl: FlowNodeTemplate; badge?: boolean; onClick: () => void }> = ({ tpl, badge, onClick }) => (
  <div
    onClick={onClick}
    className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all duration-150 hover:bg-primary-soft"
  >
    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-surface-2 text-text-base flex-shrink-0">
      <ShapeIcon shape={tpl.key} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-sm text-text-base">{tpl.title}</span>
        {badge ? (
          <Badge className="h-4 border-0 bg-amber-100 px-1.5 text-[11px] leading-4 text-amber-700">高级</Badge>
        ) : null}
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
      <div className="flex-shrink-0 border-b border-border px-3 py-2.5 text-sm font-semibold text-text-base">
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
          <details className="group mt-2 rounded-lg border border-border bg-surface-2/40">
            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-text-secondary">
              高级模块
            </summary>
            <div className="flex flex-col -mx-2 pb-1">
              {advanced.map((tpl) => (
                <NodeCard key={tpl.key} tpl={tpl} badge onClick={() => onAddNode(tpl)} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
