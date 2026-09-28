/** Pure classroom rules: tag coverage is not a real model or hardware test. */
export type Part = { id: string; n: string; params: string; p: number; d: string; t: string; simulated: boolean; extension: boolean; tags: string[]; priceNote?: string };
export type Catalog = Record<string, Part[]>;
export type Selection = Record<string, string[]>;
export type Entry = { category: string; part: Part };
export type TaskStep = { label: string; detail: string; category?: string; tags?: string[]; tagGroups?: string[][]; textOrSpeech?: boolean };
export type TestGuidance = {
  kind: 'missing' | 'suggestion';
  title: string;
  detail: string;
  target?: string;
  missing?: string;
  why?: string;
  suggestion?: string;
};
export const coreCategories = ['计算模块', '长期存储', '运行空间', '输入设备', '输出设备', '本地模型'];
export const taskIds = ['question', 'homework', 'organize', 'voice', 'vision', 'action', 'sense'];
export const tagLabels: Record<string, string> = {
  camera: '摄像头', ocr: '文字识别', vision: '图像理解', mic: '麦克风', asr: '语音识别',
  language: '语言模型', tts: '语音合成', display: '显示器', speaker: '扬声器', sensor: '环境传感器',
  motion: '动作规划', actuator: '执行机构', stop: '急停/人工接管', ram: '主内存', vram: '显存',
};
export const tagCategory: Record<string, string> = {
  camera: '输入设备', mic: '输入设备', sensor: '输入设备', ocr: '本地模型', vision: '本地模型',
  asr: '本地模型', language: '本地模型', motion: '本地模型', tts: '输出设备',
  display: '输出设备', speaker: '输出设备', actuator: '行动部件', stop: '供电与安全',
};
export const tagLabel = (tag: string) => tagLabels[tag] || tag;
export const hasCategory = (selected: Selection, category: string) => Boolean(selected[category]?.length);
export const isSelected = (selected: Selection, category: string, id: string) => Boolean(selected[category]?.includes(id));
export const catalogEntries = (catalog: Catalog): Entry[] => Object.entries(catalog).flatMap(([category, parts]) => parts.map(part => ({ category, part })));
export const chosenEntries = (catalog: Catalog, selected: Selection): Entry[] => Object.keys(catalog).flatMap(category =>
  [...new Set(selected[category] || [])].flatMap(id => { const part = catalog[category].find(p => p.id === id); return part ? [{ category, part }] : []; }));
export const selectedTags = (catalog: Catalog, selected: Selection) => new Set(chosenEntries(catalog, selected).flatMap(e => e.part.tags));
export const copySelection = (selected: Selection): Selection => Object.fromEntries(Object.entries(selected).map(([cat, ids]) => [cat, [...ids]]));
export const selectionSnapshot = (catalog: Catalog, selected: Selection) => ({
  selected: copySelection(selected), items: chosenEntries(catalog, selected).map(e => ({ category: e.category, ...e.part })),
});

/** Restore v1/v2 scalar IDs and v3 arrays without writing or truncating the user's archive.
 * Unknown IDs are reported; known but over-limit configurations remain visible and blocked. */
export function restoreSelection(raw: unknown, catalog: Catalog): { selected: Selection; skipped: number } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('选型格式无效');
  const selected: Selection = {}; let skipped = 0;
  for (const [cat, value] of Object.entries(raw)) {
    const ids = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [value];
    for (const id of ids) {
      if (typeof id !== 'string' || !catalog[cat]?.some(p => p.id === id) || selected[cat]?.includes(id)) { skipped++; continue; }
      (selected[cat] ||= []).push(id);
    }
  }
  return { selected, skipped };
}

// A shared-memory item counts as RAM; it does not mandate a separate graphics card.
const memoryKinds = (part: Part) => [
  ...(part.tags.some(t => ['ram', 'shared-memory', 'unified-memory'].includes(t)) ? ['ram'] : []),
  ...(part.tags.includes('vram') ? ['vram'] : []),
];
export function selectionIssues(catalog: Catalog, selected: Selection): string[] {
  const issues: string[] = [];
  for (const [cat, ids] of Object.entries(selected)) {
    const limit = cat === '本地模型' ? 3 : cat === '运行空间' ? 2 : 1;
    if (ids.length > limit) issues.push(`${cat}最多 ${limit} 项，请移除多余选项。`);
    if (new Set(ids).size !== ids.length || ids.some(id => !catalog[cat]?.some(p => p.id === id))) issues.push(`${cat}含重复或失效型号。`);
  }
  const memory = chosenEntries(catalog, selected).filter(e => e.category === '运行空间');
  for (const kind of ['ram', 'vram']) if (memory.filter(e => memoryKinds(e.part).includes(kind)).length > 1) issues.push(`运行空间的${tagLabel(kind)}最多 1 项。`);
  if (memory.some(e => !memoryKinds(e.part).length)) issues.push('运行空间缺少内存/显存类别标签，需核对目录。');
  if (totals(chosenEntries(catalog, selected)).enhanced > 2) issues.push('增强型全方案最多 2 项，请移除或替换。');
  return issues;
}
export function removePart(selected: Selection, category: string, id: string): Selection {
  const next = copySelection(selected);
  const rest = (next[category] || []).filter(value => value !== id);
  if (rest.length) next[category] = rest; else delete next[category];
  return next;
}
export function selectPart(catalog: Catalog, selected: Selection, id: string): { selected: Selection; error?: string; removed: string[]; action: 'added' | 'replaced' | 'removed' | 'blocked' } {
  const entry = catalogEntries(catalog).find(e => e.part.id === id);
  const blocked = (error: string) => ({ selected, error, removed: [], action: 'blocked' as const });
  if (!entry) return blocked('目录中没有该型号。');
  const { category, part } = entry;
  if (isSelected(selected, category, id)) return { selected: removePart(selected, category, id), removed: [id], action: 'removed' };
  const current = selected[category] || [];
  let kept: string[] = [];
  if (category === '本地模型') {
    if (current.length >= 3) return blocked('本地模型最多 3 项，请先移除不需要的模型，再加入新模型。');
    kept = current;
  } else if (category === '运行空间') {
    const kinds = memoryKinds(part);
    if (!kinds.length) return blocked('该运行空间缺少内存/显存标签，请核对目录。');
    kept = current.filter(previous => {
      const p = catalog[category].find(p => p.id === previous);
      return p && !memoryKinds(p).some(kind => kinds.includes(kind));
    });
    if (kept.length >= 2) return blocked('运行空间最多 2 项，内存与显存各至多 1 项。');
  }
  const next = { ...copySelection(selected), [category]: [...kept, id] };
  if (totals(chosenEntries(catalog, next)).enhanced > 2) return blocked('增强型全方案最多 2 项，请先替换或移除一项。');
  const removed = current.filter(previous => !kept.includes(previous));
  return { selected: next, removed, action: removed.length ? 'replaced' : 'added' };
}

export function totals(chosen: Entry[]) {
  const duplicate = chosen.some(e => e.category === '计算模块' && e.part.n.includes('RTX 4060'))
    && chosen.some(e => e.category === '运行空间' && e.part.tags.includes('vram') && e.part.n.includes('RTX 4060'));
  const unchargedIds = duplicate ? chosen.filter(e => e.category === '运行空间' && e.part.tags.includes('vram') && e.part.n.includes('RTX 4060')).map(e => e.part.id) : [];
  const charged = chosen.filter(e => !unchargedIds.includes(e.part.id));
  return { price: charged.reduce((sum, e) => sum + e.part.p, 0), simulated: charged.filter(e => e.part.simulated).reduce((sum, e) => sum + e.part.p, 0), enhanced: chosen.filter(e => e.part.t === '增强').length, duplicate, unchargedIds };
}

export function stepsFor(id: string): TaskStep[] {
  const output = (label: string, spokenText = false): TaskStep => spokenText
    ? { label, detail: '显示器，或语音合成 + 扬声器', category: '输出设备', textOrSpeech: true }
    : { label, detail: '文字或声音输出', category: '输出设备', tags: ['display', 'speaker'] };
  const readAndExplain = (input: string, read: string, last: string): TaskStep[] => [
    { label: input, detail: '摄像头', category: '输入设备', tags: ['camera'] },
    { label: read, detail: '模型组合：OCR 或图像理解', category: '本地模型', tags: ['ocr', 'vision'] },
    { label: '运行与思考', detail: '计算模块 + 语言模型', category: '计算模块', tags: ['language'] }, output(last, true),
  ];
  const table: Record<string, TaskStep[]> = {
    question: readAndExplain('拍下题目', '识别文字', '讲解并输出'),
    homework: readAndExplain('采集作业', '读取答案', '批改并反馈'),
    organize: [{ label: '收集资料', detail: '输入设备或已有文件', category: '输入设备' }, { label: '保存资料', detail: '长期存储', category: '长期存储' }, { label: '检索与整理', detail: '计算模块 + 语言模型', category: '计算模块', tags: ['language'] }, output('呈现结果')],
    voice: [{ label: '听到声音', detail: '麦克风', category: '输入设备', tags: ['mic'] }, { label: '语音转文字', detail: '模型组合：语音识别', category: '本地模型', tags: ['asr'] }, { label: '理解并生成回答', detail: '模型组合：语言模型', category: '本地模型', tags: ['language'] }, { label: '说出回答', detail: '本地语音合成 + 扬声器', category: '输出设备', tagGroups: [['tts'], ['speaker']] }],
    vision: [{ label: '采集图像', detail: '摄像头', category: '输入设备', tags: ['camera'] }, { label: '识别内容', detail: '图像理解或 OCR', category: '本地模型', tags: ['vision', 'ocr'] }, { label: '完成计算', detail: '计算模块', category: '计算模块' }, output('显示结果')],
    action: [{ label: '感知环境', detail: '传感器', category: '输入设备', tags: ['sensor'] }, { label: '理解与规划', detail: '本地动作规划或语言模型', category: '本地模型', tags: ['motion', 'language'] }, { label: '执行动作', detail: '电机、机械臂或轮组', category: '行动部件', tags: ['actuator'] }, { label: '急停/人工接管', detail: '仅检查 stop 标签；动作反馈仍需实测', category: '供电与安全', tags: ['stop'] }],
    sense: [{ label: '采集环境量', detail: '传感器', category: '输入设备', tags: ['sensor'] }, { label: '处理数据', detail: '计算模块', category: '计算模块' }, { label: '判断状态', detail: '本地模型或规则', category: '本地模型' }, output('输出提醒')],
  };
  return table[id] || [];
}
export function missingTagGroups(step: TaskStep, tags: Set<string>): string[][] {
  const groups = [...(step.tagGroups || (step.tags ? [step.tags] : []))];
  if (step.textOrSpeech && !tags.has('display')) groups.push(['tts'], ['speaker']);
  return groups.filter(group => !group.some(tag => tags.has(tag)));
}
export function matchStep(step: TaskStep, selected: Selection, tags: Set<string>): boolean {
  return (!step.category || hasCategory(selected, step.category)) && !missingTagGroups(step, tags).length;
}
export function stepGap(step: TaskStep, selected: Selection, tags: Set<string>): string {
  const gaps: string[] = [];
  if (step.category && !hasCategory(selected, step.category)) gaps.push(`缺少${step.category}${step.category === '本地模型' ? '（可组合最多 3 项）' : ''}`);
  const missing = missingTagGroups(step, tags);
  const models = missing.filter(group => group.every(tag => tagCategory[tag] === '本地模型'));
  if (models.length) gaps.push(`模型组合还需：${models.map(group => group.map(tagLabel).join('或')).join('、')}`);
  const other = missing.filter(group => !models.includes(group));
  if (other.length) gaps.push(`还需${other.map(group => group.map(tagLabel).join('或')).join('、')}`);
  if (missing.some(group => group.includes('tts'))) gaps.push('语音合成可由本地模型或含 tts 的输出组合提供');
  if (step.textOrSpeech && missing.length) gaps.push('也可改用显示器输出');
  return gaps.join('；');
}
export function gapTarget(step: TaskStep, selected: Selection, tags: Set<string>): string {
  if (step.category && !hasCategory(selected, step.category)) return step.category;
  return missingTagGroups(step, tags).flat().map(tag => tagCategory[tag]).find(Boolean) || step.category || 'configuration';
}

const categoryAdvice: Record<string, string> = {
  '计算模块': '在“计算模块”中选 1 项处理器或计算板；它负责运行程序，不等于模型本身。',
  '长期存储': '在“长期存储”中选 1 项硬盘或存储设备；它用来保存资料，和运行时的内存不是一回事。',
  '运行空间': '在“运行空间”中至少选 1 项标有“主内存/共享内存”的部件；需要运行视觉模型时，再考虑增加 1 项显存。',
  '输入设备': '在“输入设备”中选能采集任务信息的部件，例如拍题选摄像头、语音交互选麦克风。',
  '输出设备': '在“输出设备”中选结果呈现方式，例如文字结果选显示器；要听到声音，还需要语音合成和扬声器。',
  '本地模型': '在“本地模型”中选覆盖任务的模型，例如拍题至少需要文字识别或图像理解，再配语言模型；最多选 3 项。',
  '行动部件': '只有需要真实动作时才选行动部件；应选择与任务相符的电机、轮组或机械臂。',
  '供电与安全': '如果设计会行动，需考虑电源、散热、急停和人工接管；供电与安全不是“装上外壳”就完成。',
};

const categoryWhy: Record<string, string> = {
  '计算模块': 'AI同学需要处理器或计算板运行程序、处理输入并调用模型。',
  '长期存储': '资料、模型和用户文件需要长期保存；它和运行时使用的内存不是同一种空间。',
  '运行空间': '系统、程序和模型运行时需要主内存；显存主要服务图形或模型计算，不能单独代替主内存。',
  '输入设备': '没有输入设备，AI同学就不能获得题目、声音或环境信息。',
  '输出设备': 'AI同学需要把结果呈现给人；麦克风只能让它听见，不能让它说出来。',
  '本地模型': '部件只能采集或处理信息，还需要模型完成识别、理解、生成或规划。',
};

function makeGuidance(
  title: string,
  missing: string,
  why: string,
  suggestion: string,
  target?: string,
): TestGuidance {
  return {
    kind: 'missing', title, detail: `${missing}。${why} 建议：${suggestion}`,
    target, missing, why, suggestion,
  };
}

function guidanceForSelectionIssue(issue: string): TestGuidance | null {
  const category = Object.keys(categoryAdvice).find(cat => issue.startsWith(`${cat}最多`));
  if (category) return makeGuidance(
    `调整${category}的数量`,
    issue,
    '同一类别的选项太多会让方案难以比较，也不符合本课的选型限制。',
    '保留最符合第一优先功能的选项，再重新测试。',
    category,
  );
  if (issue.includes('重复或失效型号')) return makeGuidance(
    '清理失效或重复型号',
    issue,
    '无效或重复的型号不能作为可靠的设计依据。',
    '回到部件库，移除失效项或重复项，再重新测试。',
    'configuration',
  );
  if (issue.includes('增强型全方案')) return makeGuidance(
    '减少增强型部件',
    issue,
    '高配部件不一定能直接帮助第一优先功能，课堂设计还要考虑取舍。',
    '优先保留能直接支持第一优先功能的部件。',
    'configuration',
  );
  if (issue.startsWith('超出预算')) return makeGuidance(
    '调整预算或选型',
    issue,
    '当前方案的课堂参考总价超过了你设定的上限。',
    '先保留核心功能，替换或移除暂时不必要的增强型部件。',
    'selection-budget',
  );
  if (issue.startsWith('预算格式无效')) return makeGuidance(
    '修正预算',
    issue,
    '网页无法判断当前预算是否有效。',
    '请输入非负数字，或清空预算表示暂不设上限。',
    'selection-budget',
  );
  return null;
}

function buildGuidance(
  catalog: Catalog,
  selected: Selection,
  steps: TaskStep[],
  missingSteps: TaskStep[],
  missingCore: string[],
  blockers: string[],
  tags: Set<string>,
): TestGuidance[] {
  const guidance: TestGuidance[] = [];
  const add = (item: TestGuidance) => {
    if (!guidance.some(existing => existing.title === item.title && existing.detail === item.detail)) guidance.push(item);
  };
  for (const step of missingSteps) {
    const gap = stepGap(step, selected, tags) || '这一环节还没有对应部件或模型';
    const target = gapTarget(step, selected, tags);
    const suggestion = categoryAdvice[target] || '回到部件库选择能覆盖这一步的部件，再重新测试。';
    add(makeGuidance(
      `还缺：${step.label}`,
      gap,
      `任务链中的“${step.label}”还没有被完整覆盖，流程会在这里中断。`,
      suggestion,
      target,
    ));
  }
  for (const category of missingCore) {
    const missing = `基础配置缺少：${category}`;
    const why = categoryWhy[category] || '这一类部件是基础配置的一部分。';
    add(makeGuidance(`基础配置缺少：${category}`, missing, why, categoryAdvice[category] || '请回到部件库补选这一类部件。', category));
  }
  const memory = chosenEntries(catalog, selected).filter(e => e.category === '运行空间');
  const memoryReady = memory.some(e => memoryKinds(e.part).includes('ram'));
  if (memory.length && !memoryReady) {
    add(makeGuidance(
      '还缺：主内存',
      '主内存/RAM/共享内存',
      '你现在选的是显存（VRAM）。显存主要处理图形或模型运行时的临时数据，不能代替系统主内存（RAM）。',
      '保留当前显存，再在“运行空间”中另选 1 项标有“主内存/共享内存”的部件；主内存和显存各最多 1 项。',
      '运行空间',
    ));
  }
  for (const blocker of blockers) {
    if (blocker.includes('只有显存不能替代主内存')) continue;
    const item = guidanceForSelectionIssue(blocker);
    if (item) add(item);
    else if (!blocker.startsWith('基础模块还缺')) add(makeGuidance('配置需要调整', blocker, '这是当前规则检查发现的配置问题。', blocker, 'rule-results'));
  }
  return guidance;
}

export function evaluateTask(catalog: Catalog, selected: Selection, id: string, budget: number | null = null, budgetValid = true) {
  const chosen = chosenEntries(catalog, selected);
  const tags = selectedTags(catalog, selected);
  const steps = stepsFor(id);
  const missingSteps = steps.filter(step => !matchStep(step, selected, tags));
  const missingCore = coreCategories.filter(cat => !chosen.some(e => e.category === cat));
  const accounting = totals(chosen);
  const blockers = selectionIssues(catalog, selected);
  if (missingCore.length) blockers.push(`基础模块还缺：${missingCore.join('、')}`);
  const memory = chosen.filter(e => e.category === '运行空间');
  const memoryReady = memory.some(e => memoryKinds(e.part).includes('ram'));
  if (!memoryReady) {
    if (memory.some(e => memoryKinds(e.part).includes('vram'))) blockers.push('运行空间还缺主内存：你现在选的是显存（VRAM），显存不能代替系统主内存（RAM）。请在“运行空间”中补选 1 项带“主内存/RAM/共享内存”说明的部件；显存可以保留。');
    else if (!memory.length) blockers.push('运行空间还没有选择：请至少补选 1 项主内存/RAM/共享内存。');
    else blockers.push('运行空间没有明确的主内存：请改选或补选带“主内存/共享内存”说明的部件。');
  }
  if (!budgetValid || (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget > 1e9))) blockers.push('预算格式无效，请输入非负数字，或留空。');
  else if (budget !== null && accounting.price > budget) blockers.push(`超出预算 ¥${accounting.price - budget}，请替换或移除部件。`);
  if (!steps.length) blockers.push('先确定一个有效的第一优先功能。');
  const chainCovered = steps.length > 0 && missingSteps.length === 0;
  const baseComplete = missingCore.length === 0 && memoryReady;
  const guidance = buildGuidance(catalog, selected, steps, missingSteps, missingCore, blockers, tags);
  return { id, chainCovered, baseComplete, passed: chainCovered && blockers.length === 0,
    missingSteps, missingCore, blockers: [...new Set(blockers)], accounting, guidance,
    missing: [...new Set([...missingSteps.map(step => `${step.label}：${stepGap(step, selected, tags)}`), ...blockers])] };
}
export type TestResult = ReturnType<typeof evaluateTask>;
export function canComplete(current: TestResult, lastTest: TestResult | null): boolean {
  return current.passed && Boolean(lastTest?.passed && lastTest.id === current.id);
}
