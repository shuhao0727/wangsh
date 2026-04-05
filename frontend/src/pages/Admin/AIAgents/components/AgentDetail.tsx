/**
 * AI智能体详情组件 - 模拟数据版
 */
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Cloud,
  Copy,
  KeyRound,
  Link,
  Zap,
} from "lucide-react";
import dayjs from "dayjs";
import { showMessage } from "@/lib/toast";
import type { AIAgent } from "@services/znt/types";

interface AgentDetailProps {
  visible: boolean;
  agent: AIAgent | null;
  onClose: () => void;
}

const formatApiKey = (agent: AIAgent): string => {
  if (!agent.has_api_key) return "未设置";
  if (agent.api_key_last4) return `****${agent.api_key_last4}`;
  return "已设置";
};

const FieldItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="space-y-1 rounded-md border border-border bg-surface-2 p-3">
    <div className="text-xs text-text-tertiary">{label}</div>
    <div className="text-sm text-text-base">{value}</div>
  </div>
);

// 智能体类型标签映射
const getAgentTypeTag = (agentType: string) => {
  switch (agentType) {
    case "general":
      return (
        <Badge variant="primarySubtle">
          <Zap className="h-3 w-3" />
          通用智能体
        </Badge>
      );
    case "dify":
      return (
        <Badge variant="violet">
          <Cloud className="h-3 w-3" />
          Dify智能体
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="border-border bg-surface-2 text-text-base">
          <Zap className="h-3 w-3" />
          {agentType}
        </Badge>
      );
  }
};

const AgentDetail: React.FC<AgentDetailProps> = ({
  visible,
  agent,
  onClose,
}) => {
  if (!agent) return null;

  return (
    <Dialog open={visible} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>智能体详情</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FieldItem label="名称" value={agent.name || agent.agent_name} />
          <FieldItem label="类型" value={getAgentTypeTag(agent.agent_type)} />

          {agent.model_name ? (
            <>
              <FieldItem label="模型名称" value={agent.model_name} />
              <FieldItem
                label="状态"
                value={
                  <Badge variant={agent.is_active ? "success" : "danger"}>
                    {agent.is_active ? "启用" : "停用"}
                  </Badge>
                }
              />
            </>
          ) : null}

          {agent.description ? (
            <div className="md:col-span-2">
              <FieldItem label="描述" value={agent.description} />
            </div>
          ) : null}

          {agent.api_endpoint ? (
            <div className="md:col-span-2">
              <FieldItem
                label="API地址"
                value={
                  <div className="flex items-center gap-2">
                    <Link className="h-4 w-4 text-primary" />
                    <code className="max-w-[420px] overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                      {agent.api_endpoint}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(agent.api_endpoint || "");
                          showMessage.success("API地址已复制");
                        } catch {
                          showMessage.error("复制失败");
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
            </div>
          ) : null}

          <div className="md:col-span-2">
            <FieldItem
              label="API密钥"
              value={
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[var(--ws-color-warning)]" />
                  <Badge
                    variant={agent.has_api_key ? "warning" : "outline"}
                  >
                    {formatApiKey(agent)}
                  </Badge>
                  <span className="text-xs text-text-tertiary">（部分隐藏）</span>
                </div>
              }
            />
          </div>

          {!agent.model_name ? (
            <>
              <FieldItem
                label="状态"
                value={
                  <Badge variant={agent.is_active ? "success" : "danger"}>
                    {agent.is_active ? "启用" : "停用"}
                  </Badge>
                }
              />
              <FieldItem label="创建时间" value={dayjs(agent.created_at).format("YYYY-MM-DD HH:mm")} />
            </>
          ) : (
            <>
              <FieldItem label="创建时间" value={dayjs(agent.created_at).format("YYYY-MM-DD HH:mm")} />
              <FieldItem
                label="状态显示"
                value={
                  <Badge variant={agent.status ? "success" : "danger"}>
                    {agent.status ? "在线" : "离线"}
                  </Badge>
                }
              />
            </>
          )}

          {agent.deleted_at ? (
            <div className="md:col-span-2">
              <FieldItem label="删除时间" value={dayjs(agent.deleted_at).format("YYYY-MM-DD HH:mm")} />
            </div>
          ) : null}

          {agent.is_deleted ? (
            <div className="md:col-span-2">
              <FieldItem
                label="已删除"
                value={
                  <div className="flex items-center gap-2">
                    <Badge variant="danger">是</Badge>
                    {agent.deleted_at ? (
                      <span className="text-xs text-text-tertiary">
                        （{dayjs(agent.deleted_at).format("YYYY-MM-DD HH:mm")}）
                      </span>
                    ) : null}
                  </div>
                }
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AgentDetail;
