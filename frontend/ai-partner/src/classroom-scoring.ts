/**
 * 面向课堂的自动评分：评价“设计过程是否完整”，不评价真实性能，也不把价格高低当成高分依据。
 * 平台提交仅发送当前作品名与课堂完成度分数，不保存本机成绩历史。
 */
export type ScoreEvaluation = {
  chainCovered: boolean;
  baseComplete: boolean;
  blockers: string[];
  missingSteps: { label?: string }[];
  missingCore: string[];
  accounting: { price: number };
};

export type ScoreInput = {
  evaluation: ScoreEvaluation;
  primaryFeature: string;
  reason: string;
  testPlan: string;
  risk: string;
  paperRecorded: boolean;
  testedCore: boolean;
};

export type ScoreDimension = { key: string; label: string; score: number; max: number; note: string };
export type ClassroomScore = { total: number; level: string; dimensions: ScoreDimension[]; suggestions: string[] };

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

export function scoreClassroomPlan(input: ScoreInput): ClassroomScore {
  const { evaluation: e } = input;
  const chain = e.chainCovered ? 30 : clamp(30 - e.missingSteps.length * 8, 0, 30);
  const configPenalty = e.missingCore.length * 5 + (e.baseComplete ? 0 : 6) + Math.max(0, e.blockers.length - e.missingCore.length) * 2;
  const configuration = clamp(25 - configPenalty, 0, 25);
  const reasoning = (input.reason.trim() ? 8 : 0) + (input.testPlan.trim() ? 7 : 0) + ((input.risk.trim() || input.paperRecorded) ? 5 : 0);
  const constraints = clamp(15 - Math.max(0, e.blockers.length - (e.missingCore.length ? 1 : 0)) * 3, 0, 15);
  const safety = input.primaryFeature === 'action'
    ? (input.risk.trim() ? 5 : 0) + (input.paperRecorded ? 5 : 0)
    : (input.risk.trim() || input.paperRecorded ? 10 : 5);
  const dimensions: ScoreDimension[] = [
    { key: 'task', label: '任务匹配', score: chain, max: 30, note: e.chainCovered ? '信息链各环节已覆盖' : '还有信息链环节未覆盖' },
    { key: 'configuration', label: '配置完整', score: configuration, max: 25, note: e.baseComplete ? '基础模块和运行空间满足课堂规则' : '基础模块或运行空间仍需补齐' },
    { key: 'reasoning', label: '设计说明', score: reasoning, max: 20, note: input.reason.trim() && input.testPlan.trim() ? '有取舍和测试计划' : '还需要把想法写清楚' },
    { key: 'constraints', label: '约束意识', score: constraints, max: 15, note: e.blockers.length ? '存在尚未处理的限制' : '暂未发现课堂规则冲突' },
    { key: 'safety', label: '风险意识', score: safety, max: 10, note: input.primaryFeature === 'action' ? '动作任务需要说明安全边界' : '已考虑使用风险' },
  ];
  let total = clamp(dimensions.reduce((sum, item) => sum + item.score, 0));
  if (!input.primaryFeature) total = Math.min(total, 20);
  if (!input.testedCore) total = Math.min(total, 79);
  const suggestions: string[] = [];
  if (!input.primaryFeature) suggestions.push('先确定一项第一优先功能，网页才知道要检查哪条任务链。');
  if (!e.chainCovered) suggestions.push('沿着任务链查看标红步骤，再回到对应类别选择部件。');
  if (!e.baseComplete) suggestions.push('检查六类基础模块；运行空间要有主内存或共享内存，显存不能单独代替主内存。');
  if (!input.testedCore) suggestions.push('在测试台选择第一优先功能，点击“运行一次流程测试”。');
  if (!input.reason.trim() && !input.paperRecorded) suggestions.push('写清楚：你优先投入什么，为什么，放弃了什么。');
  if (!input.testPlan.trim() && !input.paperRecorded) suggestions.push('写清楚：测试什么、观察什么、失败可能在哪一步。');
  if (input.primaryFeature === 'action' && !input.risk.trim() && !input.paperRecorded) suggestions.push('动作控制要特别说明急停、人工接管和安全边界。');
  const level = total >= 90 ? '设计表现突出' : total >= 75 ? '方案较完整' : total >= 60 ? '方案基本形成' : '还在搭建中';
  return { total, level, dimensions, suggestions: [...new Set(suggestions)].slice(0, 4) };
}
