import type { AgentUsageData } from "@services/znt/types";

export interface UsageConversationMessage {
  id: number | string;
  message_type: string;
  content: string;
  created_at?: string;
}

export interface AgentUsageDisplayRecord extends AgentUsageData {
  preview?: {
    messages: readonly UsageConversationMessage[];
  };
}

const PREVIEW_MESSAGES: readonly UsageConversationMessage[] = [
  {
    id: "preview-question-1",
    message_type: "question",
    content: "请帮我检查这段 KNN 程序，为什么排序后的前 3 个结果不对？",
    created_at: "2026-10-23T09:42:59+08:00",
  },
  {
    id: "preview-answer-1",
    message_type: "answer",
    content: "可以按三个步骤检查：\n\n1. 先确认距离列表和样本编号始终对应。\n2. 再对距离进行升序排序，只取前 `k` 个。\n3. 最后统计这 `k` 个样本的类别并投票。\n\n```python\nnearest = sorted(distances, key=lambda item: item[0])[:k]\n```\n\n你可以先打印 `nearest`，确认排序和截取发生在投票之前。",
    created_at: "2026-10-23T09:43:06+08:00",
  },
  {
    id: "preview-question-2",
    message_type: "question",
    content: "如果 `k=3` 时出现票数相同，应该怎么处理？",
    created_at: "2026-10-23T09:45:18+08:00",
  },
  {
    id: "preview-answer-2",
    message_type: "answer",
    content: "可以约定固定的平票规则，例如优先选择距离总和更小的类别，并把规则写进函数注释和测试用例。这样每次运行都能得到稳定结果。",
    created_at: "2026-10-23T09:45:31+08:00",
  },
];

export const PREVIEW_USAGE_RECORDS: AgentUsageDisplayRecord[] = [
  {
    id: -1,
    user_id: -1,
    moxing_id: -1,
    response_time_ms: 5880,
    used_at: "2026-10-23T09:46:33+08:00",
    question: PREVIEW_MESSAGES[0].content,
    answer: PREVIEW_MESSAGES[1].content,
    preview: { messages: PREVIEW_MESSAGES },
    user: {
      id: -1,
      student_id: "预览学生",
      name: "预览学生",
      class_name: "预览班级",
      is_active: true,
    },
    moxing: {
      id: -1,
      agent_name: "KNN 学习助手（预览）",
      agent_type: "dify",
      status: true,
    },
  },
];
