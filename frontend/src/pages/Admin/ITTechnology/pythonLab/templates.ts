import type { FlowNodeTemplate } from "./types";

export const basicTemplates: FlowNodeTemplate[] = [
  { key: "start_end", title: "开始/结束", description: "流程入口或终点" },
  { key: "process", title: "处理", description: "赋值/计算/执行" },
  { key: "decision", title: "判断", description: "if / 条件分支" },
  { key: "io", title: "输入/输出", description: "input / print" },
  { key: "subroutine", title: "自定义函数", description: "调用/定义子程序" },
];

export const advancedTemplates: FlowNodeTemplate[] = [{ key: "connector", title: "连接符", description: "用于长流程分栏时的跨列跳转" }];

