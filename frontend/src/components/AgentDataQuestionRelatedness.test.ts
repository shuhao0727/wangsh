import { describe, expect, it } from "vitest";
import {
  buildRelatedQuestionGroups,
  type RelatedQuestionSource,
} from "../pages/Admin/AgentData/components/questionRelatedness";

const minute = 60 * 1000;

describe("buildRelatedQuestionGroups", () => {
  it("finds top related questions in the same time window", () => {
    const teacherQuestion = "递归和迭代的区别是什么？";
    const items: RelatedQuestionSource[] = [
      { studentName: "林同学", content: "请举个例子说明什么是递归。", time: 10 * minute, bloomLevel: "理解", teacherQuestion },
      { studentName: "周同学", content: "能不能举例说明递归和迭代？", time: 11 * minute, bloomLevel: "理解", teacherQuestion },
      { studentName: "陈同学", content: "请给一个递归和迭代都能写的例子。", time: 12 * minute, bloomLevel: "理解", teacherQuestion },
      { studentName: "王同学", content: "递归函数报错一般是什么原因？", time: 20 * minute, bloomLevel: "分析", teacherQuestion },
      { studentName: "赵同学", content: "怎样选择递归或迭代来解决实际问题？", time: 24 * minute, bloomLevel: "应用", teacherQuestion: "怎样选择递归或迭代来解决实际问题？" },
    ];

    const groups = buildRelatedQuestionGroups(items);
    const topContents = groups[0].top.map((item) => item.content);

    expect(groups[0].total).toBe(2);
    expect(topContents).toContain("能不能举例说明递归和迭代？");
    expect(topContents).toContain("请给一个递归和迭代都能写的例子。");
    expect(topContents).not.toContain("递归函数报错一般是什么原因？");
  });
});
