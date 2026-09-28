import './selection.css';
import './leaderboard.css';
import { aiPartnerService } from '../../src/services/aiPartner';
import { LeaderboardController, draftKeyFor } from './leaderboard-controller';
import { mountLeaderboard } from './leaderboard-view';
import type { PartnerEvaluation } from '../../src/services/aiPartner';
import {
  coreCategories, stepsFor, hasCategory, isSelected, selectPart, removePart, restoreSelection,
  chosenEntries, selectionSnapshot, selectedTags as collectTags, totals as calculateTotals,
  matchStep as coversStep, stepGap as describeGap, gapTarget, evaluateTask, canComplete,
} from './selection-rules.ts';
import type { Part, Catalog, Selection, TaskStep, TestResult } from './selection-rules.ts';

type Concept = 'compute' | 'memory' | 'power' | 'perception' | 'cognition' | 'output' | 'action';
type Filter = 'all' | 'real' | 'simulated';
type CheckGroup = { title: string; tone: 'must' | 'explain' | 'discuss'; rows: string[] };

const mapping: Record<string, Concept> = { '计算模块': 'compute', '长期存储': 'memory', '运行空间': 'memory', '输入设备': 'perception', '输出设备': 'output', '本地模型': 'cognition', '行动部件': 'action', '供电与安全': 'power' };
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number) => `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
const supplied = import.meta.glob('./catalog.json', { eager: true, import: 'default' });

const functions: { id: string; label: string; cat: string[]; summary: string }[] = [
  { id: 'question', label: '📚 拍题讲解', cat: ['计算模块', '输入设备', '本地模型'], summary: '拍下题目，识别内容并生成讲解。' },
  { id: 'homework', label: '✍️ 作业批改', cat: ['计算模块', '输入设备', '本地模型'], summary: '读取作业，给出批改意见并输出结果。' },
  { id: 'organize', label: '📋 资料整理', cat: ['计算模块', '长期存储'], summary: '保存资料、检索内容并整理成结构化信息。' },
  { id: 'voice', label: '🎤 语音交互', cat: ['计算模块', '输入设备', '输出设备', '本地模型'], summary: '听懂语音、组织回答，再用声音表达。' },
  { id: 'vision', label: '👁️ 图像识别', cat: ['计算模块', '输入设备', '本地模型'], summary: '识别图像中的文字、物体或场景。' },
  { id: 'action', label: '🦾 动作控制', cat: ['计算模块', '行动部件', '本地模型'], summary: '根据判断规划动作，并与环境交互。' },
  { id: 'sense', label: '📡 环境感知', cat: ['输入设备', '计算模块'], summary: '采集温度、距离、光线等环境信息。' },
];
const functionText = (id: string) => functions.find(f => f.id === id)?.label || id;
const plainFunction = (id: string) => functionText(id).replace(/^\S+\s/, '');
const extensionCategories = ['行动部件', '供电与安全'];
export function mountSelection(highlight: (key: Concept | null) => void) {
  const left = document.querySelector<HTMLElement>('.left-panel')!;
  const right = document.querySelector<HTMLElement>('.right-panel')!;
  const stage = document.querySelector<HTMLElement>('.stage-panel')!;
  const inspector = document.createElement('details');
  inspector.className = 'model-inspector';
  inspector.innerHTML = '<summary>结构观察 <span>展开</span></summary><div class="model-inspector-body"></div>';
  inspector.querySelector('.model-inspector-body')!.append(document.querySelector('#module-list')!);
  while (right.firstChild) inspector.querySelector('.model-inspector-body')!.append(right.firstChild);
  stage.append(inspector);

  let catalog: Catalog = Object.fromEntries(Object.keys(mapping).map(cat => [cat, []]));
  const source = 'catalog.json · 唯一型号目录';
  let dataError = '型号目录未加载，暂不可选型。请确认 src/catalog.json 已到位并重新构建。';
  if (supplied['./catalog.json']) {
    try {
      const candidate = supplied['./catalog.json'] as Catalog;
      if (!candidate || Object.keys(candidate).length !== 8 || Object.keys(mapping).some(cat => !Array.isArray(candidate[cat]) || candidate[cat].length !== 12)) throw new Error('类别或条目数量不符');
      const ids = new Set<string>();
      for (const items of Object.values(candidate)) for (const item of items) {
        if (!item || ['id', 'n', 'params', 'd', 't'].some(k => typeof item[k as keyof Part] !== 'string') || typeof item.p !== 'number' || !Number.isFinite(item.p) || item.p < 0 || typeof item.simulated !== 'boolean' || typeof item.extension !== 'boolean' || !Array.isArray(item.tags) || item.tags.some(tag => typeof tag !== 'string') || ids.has(item.id)) throw new Error('字段或 ID 不符');
        ids.add(item.id);
      }
      catalog = candidate; dataError = '';
    } catch { dataError = 'catalog.json 格式未通过检查，暂不可选型。需提供 8 类各 12 项、唯一 ID、完整字段及 tags。'; }
  }

  const categories = Object.keys(mapping);
  const entries = categories.flatMap(category => catalog[category].map(part => ({ category, part })));
  const find = (id: string) => entries.find(e => e.part.id === id);
  let category = '全部';
  let query = '';
  let filter: Filter = 'all';
  let selected: Selection = {};
  let compared: string[] = [];
  let budget: number | null = null;
  let budgetValid = true;
  let name = '';
  let primaryFeature = '';
  let features: string[] = [];
  let reason = '';
  let testPlan = '';
  let risk = '';
  let paperRecorded = false;
  let dirty = false;
  let tested = false;
  let lastTest: TestResult | null = null;
  let primaryTest: TestResult | null = null;
  let currentScore: PartnerEvaluation | null = null;
  let scoreAbort: AbortController | null = null;
  let scoreVersion = 0;
  let scoring = false;
  let scoreError = '';
  const invalidateScore = () => {
    ++scoreVersion; scoreAbort?.abort(); scoreAbort = null;
    scoring = false; scoreError = ''; currentScore = null;
  };
  let boardController: LeaderboardController | undefined;

  const notify = (message: string) => { const target = document.querySelector('#selection-status'); if (target) target.textContent = message; };
  const selectedEntries = () => chosenEntries(catalog, selected);
  const selectedTags = () => collectTags(catalog, selected);
  const currentEvaluation = () => evaluateTask(catalog, selected, primaryFeature, budget, budgetValid);
  const notesRecorded = () => paperRecorded || Boolean(reason.trim() && testPlan.trim());
  const snapshot = () => ({ version: 3, savedAt: new Date().toISOString(), name, primaryFeature, features, budget, reason, testPlan, risk, paperRecorded, ...selectionSnapshot(catalog, selected), source, validation: currentEvaluation(), completion: canComplete(currentEvaluation(), primaryTest) && notesRecorded(), priceNote: '课堂参考价，未重新核价；真实型号标记不代表已核实性能或可采购。' });
  const markDirty = (configurationChanged = true) => {
    dirty = true;
    invalidateScore();
    if (configurationChanged) { tested = false; lastTest = null; primaryTest = null; renderTestResult(); }
    notify(configurationChanged ? '有未保存的修改，请重新测试。' : '记录已修改，请保存。');
    updateJourney();
  };
  const updateJourney = () => {
    const coreDone = coreCategories.filter(cat => hasCategory(selected, cat)).length;
    const step1 = Boolean(primaryFeature);
    const evaluation = currentEvaluation();
    const step2 = step1 && evaluation.baseComplete && evaluation.blockers.length === 0;
    const step3 = step2 && canComplete(evaluation, primaryTest);
    const step4 = step3 && notesRecorded();
    const states = [step1, step2, step3, step4];
    document.querySelectorAll<HTMLElement>('[data-journey-step]').forEach(el => { const n = Number(el.dataset.journeyStep); const done = states[n - 1]; el.classList.toggle('is-done', Boolean(done)); el.classList.toggle('is-current', !done && states.slice(0, n - 1).every(Boolean)); });
    const testLabel = step3 ? '核心任务概念检查通过' : primaryTest ? '核心任务待调整' : tested ? '核心任务仍需测试' : '尚未测试';
    document.querySelector('#journey-summary')!.textContent = `${primaryFeature ? `核心任务：${plainFunction(primaryFeature)}` : '尚未确定核心任务'} · 核心模块 ${coreDone}/6 · ${testLabel}`;
    document.querySelectorAll<HTMLElement>('[data-journey-step]').forEach(el => { el.setAttribute('aria-current', el.classList.contains('is-current') ? 'step' : 'false'); });
  };

  left.innerHTML = `<div class="selection-panel-title"><h1>部件库 <small>${entries.length} 型号</small></h1></div><label class="search-label">搜索全部型号<input id="part-search" type="search" placeholder="型号、参数或用途" autocomplete="off"></label><div class="catalog-filters" role="group" aria-label="型号筛选"><button data-filter="all" aria-pressed="true">全部</button><button data-filter="real" aria-pressed="false">真实型号</button><button data-filter="simulated" aria-pressed="false">课堂模拟</button></div><nav id="category-nav" aria-label="部件类别"></nav><div class="library-meta"><span id="result-count"></span><button id="clear-search" type="button">重置筛选</button></div><div id="part-results" class="part-results"></div><div class="compare-tray"><span id="compare-count">选择 2–3 项对比</span><button id="open-compare" disabled>对比</button><button id="clear-compare">清空</button></div><details class="catalog-note"><summary>选型规则</summary><p>模型最多 3 项；内存、显存各 1 项；其余每类 1 项。增强型最多 2 项。价格仅供教学参考。</p></details>`;
  right.innerHTML = `<div class="selection-panel-title"><h2>我的 AI 同学</h2></div><div class="config-scroll"><label class="name-label" for="selection-name">AI同学名称 <span>选填</span></label><input id="selection-name" maxlength="80" type="text" maxlength="20" placeholder="给你的AI同学起个名字"><div id="next-guidance" class="next-guidance start" role="status" aria-live="polite"></div><section class="mission-block" id="mission-block"><div class="section-heading"><h3>第一优先功能</h3><span>只能选一个</span></div><p class="mission-hint" id="mission-hint">选择后查看任务链。</p><div id="primary-options" class="primary-options" role="radiogroup" aria-label="第一优先功能"></div><div class="section-heading extension-heading"><h3>扩展能力</h3><span id="extension-caption">可多选</span></div><div id="feature-options" class="feature-options" role="group" aria-label="扩展能力"></div><p class="mission-hint">扩展选填，完成判定只看核心任务。</p></section><label class="budget-label" for="selection-budget">预算上限 <span>元 · 可选</span></label><div class="budget-presets" role="group" aria-label="预算预设"><button data-budget="5000">¥5,000</button><button data-budget="8000">¥8,000</button><button data-budget="12000">¥12,000</button><button data-budget="clear">不设上限</button></div><input id="selection-budget" type="number" min="0" max="1000000000" step="any" placeholder="未设置 · 可选"><section class="task-chain" id="task-chain-section"><div class="section-heading"><h3>任务链</h3><span id="task-chain-caption">先选一个核心任务</span></div><div id="task-chain-content"></div></section><div class="budget-summary" id="budget-summary"></div><section><div class="section-heading"><h3>配置清单</h3><span id="selected-count"></span></div><div id="configuration"></div></section><section class="test-bench" id="test-bench"><div class="section-heading"><h3>03 / 测试台</h3><span>选型检查，非实测</span></div><label for="test-scenario">选择测试任务</label><select id="test-scenario"></select><button id="run-test" class="test-button">运行一次流程测试</button><div id="test-result" class="test-result" role="status" aria-live="polite">选好部件后，点击测试。</div></section><label class="paper-record"><input id="paper-recorded" type="checkbox">取舍、测试计划与风险已在纸面记录</label><label class="reason-label" id="selection-reason-block" for="selection-reason">04 / 我的取舍<textarea id="selection-reason" maxlength="4000" rows="3" maxlength="4000" placeholder="我优先投入……，因为……；仍需……"></textarea></label><label class="test-plan-label" for="test-plan">我的测试计划<textarea id="test-plan" maxlength="1000" rows="3" maxlength="1000" placeholder="测试什么？怎样判断结果？"></textarea></label><label class="risk-label" for="risk-select">需要注意的风险<select id="risk-select"><option value="">请选择一项</option><option>收集过多声音或图像</option><option>AI给出错误答案</option><option>误解人的意图</option><option>自动行动造成危险</option><option>人类过度依赖AI</option></select></label><section class="checks"><div class="section-heading"><h3>检查与调整</h3><button id="run-checks">重新检查</button></div><div id="rule-results"></div></section><section class="score-panel" id="score-panel"><div class="section-heading"><h3>AI 智能评分</h3><span>价格 · 完成度 · 选择合理性</span></div><div class="score-actions"><button id="run-score" class="score-primary">生成我的分数</button><button id="submit-score" disabled>提交到榜单</button><button id="show-leaderboard">查看榜单</button></div><div id="score-result" class="score-result" role="status" aria-live="polite">完成方案后，点击评分。</div><div id="partner-auth-status" role="status" aria-live="polite"></div></section><details class="data-source"><summary>数据说明</summary><p>${escape(source)}</p><p>草稿保存在本机；评分发送方案，提交后才上榜。</p><p>${escape(dataError || '价格仅供教学参考；选型检查不验证真实性能与兼容性。')}</p></details></div><div class="save-actions"><button id="save-selection">保存</button><button id="restore-selection">恢复</button><button id="export-report">导出课堂报告</button><button id="export-selection">导出 JSON</button></div><p id="selection-status" role="status" aria-live="polite">${escape(dataError || '草稿保存在本机；评分发送方案，提交后才上榜。')}</p>`;

  const conceptNote = document.createElement('p');
  conceptNote.className = 'concept-note';
  conceptNote.id = 'concept-note';
  conceptNote.textContent = '三维示意，非真实装配。';
  stage.querySelector('.stage-head')!.after(conceptNote);
  const assembly = document.createElement('section');
  assembly.className = 'assembly-state';
  assembly.setAttribute('aria-label', '示意装配状态');
  assembly.innerHTML = '<div class="assembly-state-head"><strong id="assembly-count">核心选型 0 / 6 · 扩展 0 / 2</strong></div><p id="assembly-change" role="status" aria-live="polite">尚未选择部件。</p><div id="assembly-selection"></div>';
  stage.querySelector('.canvas-wrap')!.after(assembly);
  function assemblyFeedback(message: string) { document.querySelector('#assembly-change')!.textContent = message; }

  const dialog = document.createElement('dialog');
  dialog.className = 'comparison-dialog';
  dialog.setAttribute('aria-labelledby', 'compare-title');
  dialog.innerHTML = '<header><div><span>并排阅读原始数据</span><h2 id="compare-title">型号对比</h2></div><button id="close-compare" aria-label="关闭对比">关闭 ×</button></header><div id="comparison-content"></div>';
  document.body.append(dialog);

  function renderFeatures() {
    document.querySelector('#primary-options')!.innerHTML = functions.map(f => `<label class="primary-option ${primaryFeature === f.id ? 'is-selected' : ''}"><input type="radio" name="primary-feature" value="${f.id}" ${primaryFeature === f.id ? 'checked' : ''}><span><strong>${escape(plainFunction(f.id))}</strong><small>${escape(f.summary)}</small></span></label>`).join('');
    const hint = document.querySelector('#mission-hint');
    if (hint) hint.textContent = primaryFeature ? `当前任务：${plainFunction(primaryFeature)}` : '选择后查看任务链。';
    const extensionCaption = document.querySelector('#extension-caption');
    if (extensionCaption) extensionCaption.textContent = features.length ? `已选 ${features.length} 项` : '可多选';
    document.querySelector('#feature-options')!.innerHTML = primaryFeature
      ? functions.filter(f => f.id !== primaryFeature).map(f => `<label><input type="checkbox" value="${f.id}" ${features.includes(f.id) ? 'checked' : ''}><span>${escape(plainFunction(f.id))}</span></label>`).join('')
      : '<p class="empty-inline">先选择核心任务。</p>';
  }

  function showConcept(cat: string) {
    highlight(mapping[cat]);
    const label = cat === '本地模型' ? '认知软件' : cat === '长期存储' || cat === '运行空间' ? '记忆区域' : '对应结构区域';
    conceptNote.textContent = `${cat} → ${label}（示意，非安装位置）。`;
  }

  function renderLibrary() {
    document.querySelector('#category-nav')!.innerHTML = ['全部', ...categories].map(cat => `<button data-category="${escape(cat)}" aria-pressed="${category === cat}">${escape(cat)}<small>${cat === '全部' ? entries.length : catalog[cat].length}</small></button>`).join('');
    document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.filter === filter)); });
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const visible = entries.filter(e => {
      const filterOk = filter === 'all' || (filter === 'simulated' ? e.part.simulated : !e.part.simulated);
      const text = `${e.category} ${e.part.id} ${e.part.n} ${e.part.params} ${e.part.d} ${e.part.t}`.toLowerCase();
      return filterOk && (category === '全部' || e.category === category) && terms.every(term => text.includes(term));
    });
    document.querySelector('#result-count')!.textContent = `${category} · ${visible.length} 项`;
    document.querySelector('#part-results')!.innerHTML = visible.length ? visible.map(({ category: cat, part: p }) => `<article class="part-row ${isSelected(selected, cat, p.id) ? 'is-selected' : ''}"><div class="part-tags"><span>${escape(cat)} · ${escape(p.t)}</span><span class="${p.simulated ? 'simulated' : ''}">${p.simulated ? '课堂模拟' : '真实型号'}${p.extension ? ' · 扩展' : ''}</span></div><h3>${escape(p.n)}</h3><p class="part-params">${escape(p.params)}</p><p class="part-purpose">${escape(p.d)}</p><div class="part-actions"><strong>${money(p.p)}</strong><label><input type="checkbox" data-compare="${escape(p.id)}" ${compared.includes(p.id) ? 'checked' : ''}>对比</label><button data-select="${escape(p.id)}" aria-pressed="${isSelected(selected, cat, p.id)}">${selectionLabel(cat, p.id)}</button></div></article>`).join('') : `<div class="empty-results" role="status">${escape(dataError || '没有匹配型号，请修改关键词或重置筛选。')}</div>`;
    document.querySelector('#compare-count')!.textContent = compared.length ? `已加入 ${compared.length} / 3 项` : '选择 2–3 项对比';
    (document.querySelector('#open-compare') as HTMLButtonElement).disabled = compared.length < 2;
  }

  function selectionLabel(cat: string, id: string) {
    if (isSelected(selected, cat, id)) return '移除此项';
    if (cat === '本地模型') return `加入模型组合 (${selected[cat]?.length || 0}/3)`;
    if (cat === '运行空间') {
      const change = selectPart(catalog, selected, id);
      return change.action === 'replaced' ? '替换同类运行空间' : '加入运行空间';
    }
    return hasCategory(selected, cat) ? '替换同类' : '加入配置';
  }
  function totals(chosen = selectedEntries()) { return calculateTotals(chosen); }
  function matchStep(step: TaskStep, tags: Set<string>) { return coversStep(step, selected, tags); }
  function stepGap(step: TaskStep, tags: Set<string>) { return describeGap(step, selected, tags); }

  function nextGuidance() {
    if (!primaryFeature) return { tone: 'start', title: '从任务开始', detail: '选择一项核心任务。', target: 'mission-block' };
    const tags = selectedTags();
    const missingStep = stepsFor(primaryFeature).find(step => !matchStep(step, tags));
    if (missingStep) {
      const target = gapTarget(missingStep, selected, tags);
      return { tone: 'next', title: `下一步：补齐“${missingStep.label}”`, detail: stepGap(missingStep, tags) || '选择对应部件。', target };
    }
    const missingCore = coreCategories.filter(cat => !hasCategory(selected, cat));
    if (missingCore.length) return { tone: 'next', title: '再补齐基础模块', detail: `请补充“${missingCore[0]}”。`, target: missingCore[0] };
    const evaluation = currentEvaluation();
    if (evaluation.blockers.length) return { tone: 'next', title: '先处理配置限制', detail: evaluation.blockers.join('；'), target: 'rule-results' };
    if (!canComplete(evaluation, primaryTest)) return { tone: 'test', title: '下一步：测试第一优先功能', detail: '请测试核心任务，而非扩展任务。', target: 'test-bench' };
    if (!notesRecorded()) return { tone: 'reflect', title: '下一步：说明你的取舍', detail: '填写取舍、测试计划与风险，或勾选纸面记录。', target: 'selection-reason-block' };
    return { tone: 'done', title: '课堂方案已形成', detail: '检查已通过，可评分、保存或导出；实际效果仍需验证。', target: 'rule-results' };
  }

  function renderGuidance() {
    const guidance = nextGuidance();
    const box = document.querySelector('#next-guidance');
    if (!box) return;
    box.className = `next-guidance ${guidance.tone}`;
    box.innerHTML = `<div><strong>${escape(guidance.title)}</strong><p>${escape(guidance.detail)}</p></div><button type="button" data-guide-target="${escape(guidance.target)}">前往</button>`;
  }

  function renderTaskChain() {
    const id = primaryFeature;
    const steps = id ? stepsFor(id) : [];
    const tags = selectedTags();
    const readyCount = steps.filter(step => matchStep(step, tags)).length;
    document.querySelector('#task-chain-caption')!.textContent = id ? `${plainFunction(id)} · ${readyCount}/${steps.length} 步已覆盖` : '先选一个核心任务';
    document.querySelector('#task-chain-content')!.innerHTML = steps.length ? `<div class="chain-flow">${steps.map((step, index) => { const ready = matchStep(step, tags); const gap = ready ? '已覆盖' : stepGap(step, tags) || '待补充'; return `<div class="chain-step ${ready ? 'is-ready' : 'is-missing'}"><span>${index + 1}</span><strong>${escape(step.label)}</strong><small>${escape(step.detail)}</small><em>${escape(gap)}</em></div>${index < steps.length - 1 ? '<i class="chain-arrow">→</i>' : ''}`; }).join('')}</div>` : '<div class="empty-inline">先选择核心任务。</div>';
    renderGuidance();
  }

  function getChecks(): CheckGroup[] {
    const evaluation = currentEvaluation();
    const must: string[] = evaluation.guidance.length
      ? evaluation.guidance.map(item => `${item.title}：${item.detail}`)
      : [...evaluation.missing];
    const explain: string[] = [];
    const discuss: string[] = [];
    if (!must.length) must.push(canComplete(evaluation, primaryTest) ? '选型检查通过，实际效果需验证。' : '配置已齐，请测试核心任务。');
    if (hasCategory(selected, '行动部件') && primaryFeature !== 'action') explain.push('行动部件不是当前任务必需，请说明用途。');
    if (hasCategory(selected, '供电与安全')) explain.push('请说明供电、散热与安全措施。');
    if (!paperRecorded && !testPlan.trim()) explain.push('补充测试计划，或勾选纸面记录。');
    if (!paperRecorded && !reason.trim()) explain.push('补充选型理由，或勾选纸面记录。');
    if (!explain.length) explain.push(paperRecorded ? '已完成纸面记录。' : '取舍与计划已填，请记录风险应对。');
    if (features.length) discuss.push('扩展选填；调整配置后重新测试。');
    if (primaryFeature === 'action') discuss.push('急停标签不代表动作控制已验证。');
    discuss.push(paperRecorded ? '风险已在纸面记录。' : risk ? `风险：${risk}。请说明应对方法。` : '请选择一项风险。');
    discuss.push('实装前需核验兼容性、许可与安全。');
    discuss.push('采集声音、图像须先获授权。');
    return [{ title: '必须补齐', tone: 'must', rows: must }, { title: '需要说明', tone: 'explain', rows: explain }, { title: '课堂讨论', tone: 'discuss', rows: discuss }];
  }

  function renderChecks() {
    const result = totals();
    const groups = getChecks();
    document.querySelector('#rule-results')!.innerHTML = groups.map(group => `<section class="check-group ${group.tone}"><div class="check-group-title"><h4>${group.title}</h4><span>${group.rows.length}项</span></div><ul>${group.rows.map(row => `<li>${escape(row)}</li>`).join('')}</ul></section>`).join('');
    document.querySelector('#budget-summary')!.innerHTML = `<div><span>课堂参考总价 · 含模拟 ${money(result.simulated)}</span><strong>${money(result.price)}</strong></div><span class="${!budgetValid || (budget !== null && result.price > budget) ? 'over-budget' : ''}">${!budgetValid ? '预算无效' : budget === null ? '未设上限' : result.price > budget ? `超出 ${money(result.price - budget)}` : `剩余 ${money(budget - result.price)}`}</span>`;
    updateJourney();
    renderGuidance();
    renderScore();
  }

  function renderTestOptions() {
    const ids = [...new Set([primaryFeature, ...features].filter(Boolean))];
    const select = document.querySelector<HTMLSelectElement>('#test-scenario')!;
    select.innerHTML = ids.length ? ids.map(id => `<option value="${id}" ${id === (lastTest?.id || primaryFeature) ? 'selected' : ''}>${escape(plainFunction(id))}</option>`).join('') : '<option value="">请先选择功能</option>';
  }

  function renderTestResult() {
    const box = document.querySelector('#test-result')!;
    if (!lastTest) { box.className = 'test-result'; box.textContent = '选好部件后，点击测试。'; return; }
    const steps = stepsFor(lastTest.id);
    const status = lastTest.passed
      ? '概念检查通过（非真实运行）'
      : lastTest.chainCovered
        ? '任务链已连通，但还缺基础配置'
        : '任务链还缺少环节';
    const intro = lastTest.passed
      ? `${lastTest.id === primaryFeature ? '核心任务' : '扩展任务'}的部件与模型已经覆盖主要处理步骤。接下来把测试任务、取舍和风险记在任务单上。`
      : '网页已经把问题拆开显示：先看“还缺什么”，再按“建议”回到部件库选择。';
    const guidance = lastTest.guidance.length
      ? `<div class="test-guidance" aria-label="测试改进建议">${lastTest.guidance.map(item => `<div class="test-guidance-item"><strong>${escape(item.title)}</strong><dl class="test-guidance-layers"><div><dt>还缺什么</dt><dd>${escape(item.missing || item.detail)}</dd></div><div><dt>为什么</dt><dd>${escape(item.why || '这是当前规则检查发现的问题。')}</dd></div><div><dt>建议如何选择</dt><dd>${escape(item.suggestion || item.detail)}</dd></div></dl>${item.target && item.target !== 'configuration' && item.target !== 'rule-results' ? `<button type="button" data-test-guide-target="${escape(item.target)}">去选择</button>` : ''}</div>`).join('')}</div>`
      : '';
    const summary = lastTest.passed
      ? `<div class="test-success-note"><strong>通过条件</strong><p>任务链已连通，6 类基础模块也已补齐。</p></div>`
      : `<div class="test-failure-note"><strong>当前状态</strong><p>信息链：${lastTest.chainCovered ? '已覆盖' : '未覆盖'}；基础模块：${lastTest.baseComplete ? '完整' : '不完整'}。请按下面的“还缺什么—为什么—建议如何选择”逐项调整。</p></div>`;
    box.className = `test-result ${lastTest.passed ? 'passed' : 'failed'}`;
    box.innerHTML = `<strong>${status}</strong><p>${intro}</p>${guidance}${summary}<div class="test-trace">${steps.map((step, index) => `<span class="${matchStep(step, selectedTags()) ? 'ok' : 'fail'}">${index + 1}. ${escape(step.label)}</span>`).join('')}</div><p class="test-boundary">仅检查选型逻辑，非真实运行测试。</p>`;
    box.querySelectorAll<HTMLButtonElement>('[data-test-guide-target]').forEach(button => button.addEventListener('click', () => {
      const target = button.dataset.testGuideTarget || '';
      if (categories.includes(target)) {
        category = target;
        showConcept(target);
        renderLibrary();
        document.querySelector('#part-results')?.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }));
  }

  function renderScore() {
    const result = document.querySelector<HTMLElement>('#score-result');
    const submit = document.querySelector<HTMLButtonElement>('#submit-score');
    if (!result || !submit) return;
    const run = document.querySelector<HTMLButtonElement>('#run-score')!;
    run.disabled = scoring || !boardController?.state.user || !!dataError;
    run.textContent = scoring ? 'AI 正在评估…' : '生成我的分数';
    submit.textContent = boardController?.state.submitting ? '正在提交…' : '提交到榜单';
    if (!currentScore) {
      result.className = 'score-result';
      result.textContent = scoring ? 'AI 正在评分，请稍候…' : scoreError || (!boardController?.state.user ? '登录后可使用 AI 智能评分。' : '完成方案后，点击评分。');
      submit.disabled = true;
      return;
    }
    const eligible = canComplete(currentEvaluation(), primaryTest) && notesRecorded();
    result.className = `score-result ${currentScore.total >= 75 ? 'score-good' : 'score-guide'}`;
    result.innerHTML = `<div class="score-total"><strong>${currentScore.total}</strong><span> / 100</span><em>${escape(currentScore.level)}</em></div><ul class="score-dimensions">${currentScore.dimensions.map(item => `<li><span>${escape(item.label)}</span><b>${item.score}/${item.max}</b><small>${escape(item.note)}</small></li>`).join('')}</ul>${currentScore.suggestions.length ? `<div class="score-suggestions"><strong>改进建议</strong><ul>${currentScore.suggestions.slice(0, 3).map(item => `<li>${escape(item)}</li>`).join('')}</ul></div>` : '<p class="score-positive">暂无补充建议。</p>'}${eligible ? '<p class="score-ready">已满足上榜条件。</p>' : '<p class="score-not-ready">上榜前请完成配置检查、核心测试及课堂记录。</p>'}`;
    submit.disabled = !eligible || !boardController?.canSubmit();
    submit.textContent = boardController?.state.submitting ? '正在提交…' : '提交到榜单';
  }

  async function makeScore() {
    const user = boardController?.state.user;
    if (!user || scoring || dataError) return;
    if (!budgetValid || !primaryFeature || !selectedEntries().length) {
      scoreError = '请先选择核心任务和部件，并填写有效预算（可留空）。'; renderScore(); return;
    }
    invalidateScore();
    const version = scoreVersion;
    const abort = new AbortController(); scoreAbort = abort; scoring = true;
    renderScore();
    try {
      const board = await aiPartnerService.getLeaderboard(abort.signal);
      if (version !== scoreVersion || abort.signal.aborted) return;
      if (board.status === 'ended') throw {response: {status: 410}};
      const result = await aiPartnerService.evaluate({
        round_id: board.round_id,
        expected_user_id: user.id, ai_name: name.trim() || '未命名',
        selected_ids: selectedEntries().map(entry => entry.part.id),
        primary_feature: primaryFeature, features: [...features], budget,
        reason, test_plan: testPlan, risk, paper_recorded: paperRecorded,
        tested_core: canComplete(currentEvaluation(), primaryTest),
      }, abort.signal);
      if (version !== scoreVersion || abort.signal.aborted || boardController?.state.user?.id !== user.id) return;
      currentScore = result;
      notify('AI 评分已完成，请阅读分项理由与改进建议。');
    } catch (error) {
      if (version !== scoreVersion || abort.signal.aborted) return;
      const status = (error as {response?: {status?: number}})?.response?.status;
      scoreError = status === 503 ? 'AI 评分暂不可用，请检查后台评分模型配置与服务状态。'
        : status === 401 || status === 403 ? '请重新登录后使用 AI 评分。'
        : status === 429 ? '评分请求较多，请稍后再试。'
        : status === 409 || status === 410 ? '身份或课堂轮次已变化，请刷新后重新评分。'
        : status === 422 ? '方案信息不完整或已失效，请检查后重试。'
        : 'AI 评分未完成，请稍后重试；未生成替代分数。';
    } finally {
      if (version === scoreVersion) { scoring = false; scoreAbort = null; renderScore(); }
    }
  }

  async function submitScore() {
    if (!currentScore) return notify('请先点击“生成我的分数”。');
    if (!canComplete(currentEvaluation(), primaryTest) || !notesRecorded()) return notify('方案还未完成：请先通过核心测试，并完成取舍与测试记录。');
    if (!boardController?.state.user) return notify('请先登录并完成身份验证；未登录仍可设计。');
    const submittedScore = currentScore;
    await boardController.submit(name.trim() || '未命名', submittedScore,
      () => currentScore === submittedScore && canComplete(currentEvaluation(), primaryTest) && notesRecorded());
  }

  function renderConfiguration() {
    const chosen = selectedEntries();
    const result = totals(chosen);
    const coreDone = coreCategories.filter(cat => hasCategory(selected, cat)).length;
    const extensionDone = extensionCategories.filter(cat => hasCategory(selected, cat)).length;
    document.querySelector('#assembly-count')!.textContent = `核心选型 ${coreDone} / 6 · 扩展 ${extensionDone} / 2`;
    document.querySelector('#assembly-selection')!.innerHTML = categories.map(cat => {
      const names = chosen.filter(e => e.category === cat).map(e => e.part.n).join(' + ');
      return `<span data-assembly-category="${escape(cat)}" data-selected="${Boolean(names)}" title="${escape(names || '未选')}">${names ? '✓' : '○'} ${escape(cat)}：${escape(names || '未选')}</span>`;
    }).join('');
    document.querySelector('#selected-count')!.textContent = `核心 ${coreDone}/6 · 扩展 ${extensionDone}/2 · 已选 ${chosen.length} 项 · 增强 ${result.enhanced}/2`;
    document.querySelector('#configuration')!.innerHTML = categories.map(cat => {
      const items = chosen.filter(e => e.category === cat);
      if (!items.length) return `<div class="config-row"><button data-jump="${escape(cat)}" class="config-item"><span>${escape(cat)}</span><strong>待选择</strong></button></div>`;
      return items.map((e, index) => `<div class="config-row"><button data-jump="${escape(cat)}" class="config-item"><span>${escape(cat)}${items.length > 1 ? ` ${index + 1}/${items.length}` : ''}</span><strong>${escape(e.part.n)}</strong><small>${result.unchargedIds.includes(e.part.id) ? '¥0 · 共用已计价整卡' : money(e.part.p)} · ${e.part.simulated ? '课堂模拟' : '真实型号'}</small></button><button class="remove-part" data-remove="${escape(e.part.id)}" aria-label="移除${escape(e.part.n)}">×</button></div>`).join('');
    }).join('');
    renderTaskChain(); renderTestOptions(); renderTestResult(); renderChecks();
  }

  function performTest(id: string) {
    if (!id) return notify('请先选择一个测试任务。');
    lastTest = evaluateTask(catalog, selected, id, budget, budgetValid);
    tested = true;
    if (id === primaryFeature) { primaryTest = lastTest; invalidateScore(); }
    renderTestResult(); renderChecks();
    notify(lastTest.passed ? '选型检查通过，请补齐课堂记录。' : `概念检查未通过：${lastTest.missing.join('；')}。`);
  }

  function download(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reportText() {
    const result = totals();
    const checks = getChecks().flatMap(group => [`【${group.title}】`, ...group.rows.map(row => `- ${row}`)]).join('\n');
    const chosen = selectedEntries().map(e => `- ${e.category}：${e.part.n}（${e.part.params}；${e.part.simulated ? '课堂模拟' : '真实型号'}；${result.unchargedIds.includes(e.part.id) ? '¥0，共用已计价 RTX 4060 整卡' : money(e.part.p)}）`).join('\n') || '- 尚未选择';
    return `《召唤一名“AI同学”》课堂方案\n\nAI同学名称：${name || '未命名'}\n第一优先功能：${primaryFeature ? plainFunction(primaryFeature) : '未确定'}\n扩展能力：${features.length ? features.map(plainFunction).join('、') : '无'}\n预算上限：${budget === null ? '未设置' : money(budget)}\n课堂参考总价：${money(result.price)}\n选中 ${selectedEntries().length} 项；增强 ${result.enhanced}/2\n方案状态：${canComplete(currentEvaluation(), primaryTest) && notesRecorded() ? '课堂方案已形成（非真实系统验证）' : '草案，仍需检查或记录'}\n信息链覆盖：${currentEvaluation().chainCovered ? '已覆盖' : '未覆盖'}；基础模块：${currentEvaluation().baseComplete ? '完整' : '未完整'}\n\n【部件选择】\n${chosen}\n\n【选型理由】\n${reason || (paperRecorded ? '见纸面任务单' : '未填写，可在纸面记录')}\n\n【测试计划】\n${testPlan || (paperRecorded ? '见纸面任务单' : '未填写，可在纸面记录')}\n\n【风险与边界】\n${risk || (paperRecorded ? '见纸面任务单' : '未选择，可在纸面记录')}\n\n【检查结果】\n${checks}\n\n说明：本方案用于课堂探究，不是实际采购清单；参数、接口、功耗、驱动、模型许可与真实性能仍需进一步核验。`;
  }

  left.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.filter) { filter = button.dataset.filter as Filter; renderLibrary(); return; }
    if (button.dataset.category) { category = button.dataset.category; if (category !== '全部') showConcept(category); renderLibrary(); document.querySelector('#part-results')!.scrollTop = 0; return; }
    if (button.dataset.select) {
      const e = find(button.dataset.select)!;
      const change = selectPart(catalog, selected, e.part.id);
      if (change.error) { notify(change.error); assemblyFeedback(`未装入：${change.error}原配置保持不变。`); return; }
      selected = change.selected;
      const previousNames = change.removed.map(id => find(id)?.part.n || id).join('、');
      assemblyFeedback(change.action === 'removed' ? `已移除 ${e.category}：${e.part.n}。示意外形保留。` : change.action === 'replaced' ? `已替换 ${e.category}：${previousNames} → ${e.part.n}` : `已加入 ${e.category}：${e.part.n}`);
      showConcept(e.category); markDirty(); renderLibrary(); renderConfiguration(); return;
    }
  });
  document.querySelectorAll<HTMLElement>('[data-journey-target]').forEach(step => {
    const go = () => document.getElementById(step.dataset.journeyTarget || '')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    step.addEventListener('click', go);
    step.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go(); } });
  });
  document.querySelector('#part-search')!.addEventListener('input', event => { query = (event.target as HTMLInputElement).value.trim(); category = '全部'; renderLibrary(); document.querySelector('#part-results')!.scrollTop = 0; });
  document.querySelector('#clear-search')!.addEventListener('click', () => { query = ''; category = '全部'; (document.querySelector('#part-search') as HTMLInputElement).value = ''; filter = 'all'; renderLibrary(); });
  left.addEventListener('change', event => { const input = event.target as HTMLInputElement; if (!input.dataset.compare) return; if (input.checked && compared.length >= 3) { input.checked = false; notify('最多对比 3 项，请先取消一项。'); return; } compared = input.checked ? [...compared, input.dataset.compare] : compared.filter(id => id !== input.dataset.compare); renderLibrary(); });
  document.querySelector('#clear-compare')!.addEventListener('click', () => { compared = []; renderLibrary(); });
  document.querySelector('#open-compare')!.addEventListener('click', () => {
    const items = compared.map(id => find(id)!).filter(Boolean);
    const rows: [string, (e: typeof items[number]) => string][] = [['类别', e => e.category], ['当前状态', e => isSelected(selected, e.category, e.part.id) ? '已选入配置' : '未选'], ['型号', e => e.part.n], ['原始参数', e => e.part.params], ['参考价', e => money(e.part.p)], ['用途', e => e.part.d], ['档位', e => e.part.t], ['性质', e => `${e.part.simulated ? '课堂模拟' : '真实型号'}${e.part.extension ? ' · 扩展' : ''}`]];
    document.querySelector('#comparison-content')!.innerHTML = `<p>不同类别可对照阅读；参数按原文展示，不生成性能排名或兼容结论。</p><div class="compare-table-wrap"><table><thead><tr><th scope="col">项目</th>${items.map((_, i) => `<th scope="col">候选 ${i + 1}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, get]) => `<tr><th scope="row">${label}</th>${items.map(e => `<td>${escape(get(e))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    dialog.showModal();
  });
  document.querySelector('#close-compare')!.addEventListener('click', () => dialog.close());
  right.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.budget) {
      const input = document.querySelector<HTMLInputElement>('#selection-budget')!;
      input.value = button.dataset.budget === 'clear' ? '' : button.dataset.budget;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (button.dataset.remove) {
      const entry = find(button.dataset.remove);
      if (!entry) return;
      selected = removePart(selected, entry.category, entry.part.id);
      markDirty();
      renderLibrary();
      renderConfiguration();
      assemblyFeedback(`已移除 ${entry.category}：${entry.part.n}；组合中其他选项保留。`);
      return;
    }
    if (button.dataset.jump) {
      category = button.dataset.jump;
      showConcept(category);
      renderLibrary();
      document.querySelector('#part-results')!.scrollTop = 0;
      return;
    }
    if (button.dataset.guideTarget) {
      const guideTarget = button.dataset.guideTarget;
      if (categories.includes(guideTarget)) {
        category = guideTarget;
        showConcept(category);
        renderLibrary();
        document.querySelector('#part-results')!.scrollTop = 0;
      } else {
        document.getElementById(guideTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
  document.querySelector('#selection-name')!.addEventListener('input', event => { name = (event.target as HTMLInputElement).value; markDirty(false); });
  document.querySelector('#selection-budget')!.addEventListener('input', event => { const input = event.target as HTMLInputElement; const n = input.valueAsNumber; budgetValid = input.value === '' && !input.validity.badInput || Number.isFinite(n) && n >= 0 && n <= 1e9; budget = budgetValid && input.value !== '' ? n : null; input.setAttribute('aria-invalid', String(!budgetValid)); markDirty(); renderChecks(); });
  document.querySelector('#primary-options')!.addEventListener('change', event => { const input = event.target as HTMLInputElement; if (input.name !== 'primary-feature') return; primaryFeature = input.value; features = features.filter(id => id !== primaryFeature); lastTest = null; tested = false; renderFeatures(); renderConfiguration(); markDirty(); });
  document.querySelector('#feature-options')!.addEventListener('change', () => { features = Array.from(document.querySelectorAll<HTMLInputElement>('#feature-options input:checked')).map(i => i.value).filter(id => id !== primaryFeature); if (lastTest && lastTest.id !== primaryFeature && !features.includes(lastTest.id)) lastTest = null; markDirty(false); renderTestOptions(); renderTestResult(); renderChecks(); });
  document.querySelector('#selection-reason')!.addEventListener('input', event => { reason = (event.target as HTMLTextAreaElement).value; markDirty(false); renderChecks(); });
  document.querySelector('#test-plan')!.addEventListener('input', event => { testPlan = (event.target as HTMLTextAreaElement).value; markDirty(false); renderChecks(); });
  document.querySelector('#risk-select')!.addEventListener('change', event => { risk = (event.target as HTMLSelectElement).value; markDirty(false); renderChecks(); });
  document.querySelector('#paper-recorded')!.addEventListener('change', event => { paperRecorded = (event.target as HTMLInputElement).checked; markDirty(false); renderChecks(); });
  document.querySelector('#test-scenario')!.addEventListener('change', () => { lastTest = null; renderTestResult(); renderChecks(); });
  document.querySelector('#run-test')!.addEventListener('click', () => performTest((document.querySelector('#test-scenario') as HTMLSelectElement).value));
  document.querySelector('#run-checks')!.addEventListener('click', () => { renderChecks(); notify('检查已更新；请根据三类提示完善方案。'); });
  document.querySelector('#run-score')!.addEventListener('click', makeScore);
  document.querySelector('#submit-score')!.addEventListener('click', submitScore);
  document.querySelector('#show-leaderboard')!.addEventListener('click', () => boardController?.setOpen(true));
  document.querySelector('#save-selection')!.addEventListener('click', () => { if (!budgetValid) return notify('请先修正预算，再保存。'); const user = boardController?.state.user; if (!user) return notify('请先验证登录身份；匿名草稿不会自动归入账号，可先导出方案。'); try { localStorage.setItem(draftKeyFor(user.id), JSON.stringify(snapshot())); dirty = false; notify('草稿已保存到本机，成绩不保存。'); } catch { notify('浏览器存储不可用，请导出课堂报告留存。'); } });
  document.querySelector('#restore-selection')!.addEventListener('click', () => {
    const user = boardController?.state.user;
    if (!user) return notify('请先验证登录身份，只能恢复当前账号的草稿。');
    if (dataError) return notify('目录不可用，不能恢复型号；原存档未修改。');
    if (dirty && !window.confirm('恢复将替换当前未保存配置，是否继续？')) return;
    try {
      const text = localStorage.getItem(draftKeyFor(user.id)); if (!text) return notify('尚无本机存档，请先保存一份方案。');
      const saved = JSON.parse(text);
      if (!saved || !saved.selected || typeof saved.selected !== 'object') throw new Error();
      if (saved.budget !== null && saved.budget !== undefined && (!Number.isFinite(Number(saved.budget)) || Number(saved.budget) < 0 || Number(saved.budget) > 1e9)) throw new Error();
      const restored = restoreSelection(saved.selected, catalog);
      const removed = restored.skipped;
      selected = restored.selected; budget = saved.budget === null || saved.budget === undefined || saved.budget === '' ? null : Number(saved.budget); budgetValid = true; name = typeof saved.name === 'string' ? saved.name.slice(0, 20) : '';
      const restoredFeatures = Array.isArray(saved.features) ? saved.features.filter((id: unknown): id is string => typeof id === 'string' && functions.some(f => f.id === id)) : [];
      primaryFeature = typeof saved.primaryFeature === 'string' && functions.some(f => f.id === saved.primaryFeature) ? saved.primaryFeature : restoredFeatures[0] || '';
      features = [...new Set(restoredFeatures.filter((id: string) => id !== primaryFeature))] as string[]; reason = typeof saved.reason === 'string' ? saved.reason.slice(0, 4000) : ''; testPlan = typeof saved.testPlan === 'string' ? saved.testPlan.slice(0, 1000) : ''; risk = typeof saved.risk === 'string' ? saved.risk : ''; paperRecorded = saved.paperRecorded === true; dirty = false; tested = false; lastTest = null; primaryTest = null; invalidateScore();
      (document.querySelector('#selection-name') as HTMLInputElement).value = name; const budgetInput = document.querySelector<HTMLInputElement>('#selection-budget')!; budgetInput.value = budget === null ? '' : String(budget); budgetInput.setAttribute('aria-invalid', 'false'); (document.querySelector('#selection-reason') as HTMLTextAreaElement).value = reason; (document.querySelector('#test-plan') as HTMLTextAreaElement).value = testPlan; (document.querySelector('#risk-select') as HTMLSelectElement).value = risk; (document.querySelector('#paper-recorded') as HTMLInputElement).checked = paperRecorded;
      renderFeatures(); renderLibrary(); renderConfiguration(); assemblyFeedback(`已恢复 ${selectedEntries().length} 项选型；型号与总价按当前目录更新。`); notify(`已恢复方案${removed ? `，已跳过 ${removed} 项失效或重复型号` : ''}；组合按现行规则重新检查，需重新测试和评分。`);
    } catch { notify('存档无法读取或格式不符；当前配置未替换。'); }
  });
  document.querySelector('#export-report')!.addEventListener('click', () => { if (!budgetValid) return notify('请先修正预算，再导出。'); download('AI同学-课堂方案.txt', reportText(), 'text/plain;charset=utf-8'); notify('课堂报告已导出。'); });
  document.querySelector('#export-selection')!.addEventListener('click', () => { if (!budgetValid) return notify('请先修正预算，再导出。'); const payload = { ...snapshot(), total: totals().price, accounting: totals(), checks: getChecks(), limitations: '类别覆盖不等于功能可实现；不作性能、容量、功耗与兼容性保证。' }; download('AI同学-选型方案.json', JSON.stringify(payload, null, 2), 'application/json'); notify('已导出完整配置、任务链、理由与检查结果。'); });

  function resetIdentityDesign() {
    selected = {}; compared = []; category = '全部'; query = ''; filter = 'all';
    budget = null; budgetValid = true; name = ''; primaryFeature = ''; features = [];
    reason = ''; testPlan = ''; risk = ''; paperRecorded = false;
    dirty = false; tested = false; lastTest = null; primaryTest = null; invalidateScore();
    for (const id of ['selection-name', 'selection-budget', 'selection-reason', 'test-plan', 'risk-select', 'part-search']) {
      (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value = '';
    }
    document.getElementById('selection-budget')!.setAttribute('aria-invalid', 'false');
    (document.getElementById('paper-recorded') as HTMLInputElement).checked = false;
    if (dialog.open) dialog.close();
    document.getElementById('comparison-content')!.replaceChildren();
    highlight(null);
    renderFeatures(); renderLibrary(); renderConfiguration(); renderTestResult();
    assemblyFeedback('身份待确认或已变化；已清空上一身份的设计、记录和分数。');
    notify('可恢复本账号草稿，不自动载入匿名设计。');
  }
  renderFeatures(); renderLibrary(); renderConfiguration();
  boardController = new LeaderboardController(aiPartnerService, resetIdentityDesign);
  const leaderboardView = mountLeaderboard(boardController, document.getElementById('partner-auth-status')!);
  boardController.subscribe(state => {
    renderScore();
    for (const id of ['save-selection', 'restore-selection']) {
      (document.getElementById(id) as HTMLButtonElement).disabled = !state.user || !!dataError;
    }
  });
  boardController.start();
  window.addEventListener('pagehide', () => {
    // BFCache pages are revalidated on pageshow; never retain a previous identity.
    invalidateScore(); boardController?.dispose(); leaderboardView.dispose();
  }, { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  if (dataError) { ['save-selection', 'restore-selection', 'export-report', 'export-selection', 'run-checks', 'run-test'].forEach(id => { (document.getElementById(id) as HTMLButtonElement).disabled = true; }); assemblyFeedback('型号目录不可用，未装配任何选型；原存档未读取或修改。'); }
  updateJourney();
}
