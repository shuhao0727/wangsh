/** Prompt 工程体系 */
export const PROMPT_LEVELS = [
  {
    level: "基础 (L1)",
    icon: "star",
    items: [
      { title: "角色设定 (Persona)", desc: "明确 AI 的身份、专业领域和沟通风格，如'你是一位有 10 年经验的 Python 架构师'", example: "你是一位资深数据分析师，擅长用通俗语言解释统计概念。", when_to_use: "需要专业知识输出或特定语言风格时" },
      { title: "指令清晰化", desc: "使用直接动词 (分析/列出/对比/生成)、步骤化描述、避免否定句和歧义表达", example: "请分三步完成：1) 识别问题 2) 分析原因 3) 给出解决方案。", when_to_use: "所有场景的基础要求" },
      { title: "输出格式控制", desc: "指定 JSON/Markdown/CSV/表格/YAML 等格式，可附加 Schema 约束", example: "请以 JSON 格式输出，包含 name, age, skills 三个字段。", when_to_use: "需要程序化解析输出时" },
      { title: "上下文限定", desc: "提供背景信息、知识边界和时间范围，限定回答的深度和范围", example: "基于以下 2024 年财报数据回答问题，不要使用外部知识：{数据}", when_to_use: "需要精确范围和知识边界时" },
      { title: "负面约束 (Negative Prompting)", desc: "明确告知'不要做什么'，如禁止幻觉、禁止推测、禁止特定格式", example: "如果答案不确定，请直接说'我无法确定'，不要编造信息。", when_to_use: "防止模型生成不可靠内容" },
    ],
    color: "var(--ws-tag-green)",
  },
  {
    level: "进阶 (L2)",
    icon: "target",
    items: [
      { title: "Few-shot 示例学习", desc: "提供 2-5 个输入输出对，让模型从示例中归纳模式，保持格式和风格一致", example: "输入：天气真好 | 输出：positive\n输入：糟糕透了 | 输出：negative\n输入：一般般吧 | 输出：", when_to_use: "格式特殊或分类标准不直观时" },
      { title: "思维链 (Chain-of-Thought, CoT)", desc: "要求模型'逐步思考'，显示中间推理过程，显著提升数学和逻辑推理准确率", example: "请一步步推理：一个水池，进水管 3 小时注满，出水管 5 小时放空，同时开需要多久？", when_to_use: "数学、逻辑、多步骤推理问题" },
      { title: "结构化分解", desc: "将复杂任务拆解为子任务链，逐个处理并组合结果", example: "请按以下结构回答：\n## 问题分析\n## 方案对比\n## 推荐方案\n## 风险提示", when_to_use: "复杂分析、报告撰写、方案设计" },
      { title: "温度与解码参数调优", desc: "根据场景调整 temperature (创造性)、top_p (多样性)、frequency_penalty (重复控制)", example: "temperature=0.1 (事实性问答) / temperature=0.8 (创意写作)", when_to_use: "事实性 vs 创造性任务的区分" },
      { title: "对抗性审查 (Self-Critique)", desc: "要求模型在回答后自我审查：指出可能错误、局限性和改进空间", example: "请回答后，列出你的回答可能存在的 3 个局限或不确定之处。", when_to_use: "需要高质量和可靠性保证的场景" },
    ],
    color: "var(--ws-tag-amber)",
  },
  {
    level: "高级 (L3)",
    icon: "zap",
    items: [
      { title: "ReAct 模式 (Reasoning + Acting)", desc: "让模型交替进行思考与行动：观察 -> 思考 -> 行动 -> 观察循环，适合工具调用", example: "Thought: 我需要查询天气 API\nAction: weather_api(city='北京')\nObservation: 晴，25°C\nThought: 现在我可以给出穿衣建议了", when_to_use: "需要外部工具、API 调用或多步信息收集" },
      { title: "思维树 (Tree-of-Thought, ToT)", desc: "同时探索多个推理分支，评估每个分支的前景，选择最优路径继续深入", example: "对于这个问题，请生成 3 种不同的解决思路，分别评估优劣，选择最优方案展开。", when_to_use: "创造性问题求解、策略规划" },
      { title: "自洽性 (Self-Consistency)", desc: "对同一问题多次推理 (temperature>0)，取多数票或最优结果，提升推理可靠性", example: "请独立推理 5 次并比较结果一致性，如果出现分歧请说明原因。", when_to_use: "高可靠性数学/逻辑推理" },
      { title: "约束解码与结构化生成", desc: "通过 Grammar/JSON Schema/Regex 约束 Token 生成，确保输出严格符合格式", example: "使用 outlines/instructor 库的 JSON Schema 约束", when_to_use: "需要严格 Schema 合规的 API 输出" },
      { title: "System Prompt 工程设计", desc: "设计系统级提示定义模型全局行为：角色、规则、输出格式、安全边界、知识范围", example: "System: 你是专业代码审查员。始终检查：安全漏洞 > 性能 > 可读性。不确定时标注 [待确认]。", when_to_use: "构建 AI 产品或 Agent 时" },
      { title: "MCP 提示资源模板化", desc: "通过 Model Context Protocol 将 Prompt 模板标准化、版本化，支持参数化和团队复用", example: "使用 MCP Prompt Resource 定义'代码审查模板'，团队通过参数注入代码语言和审查重点", when_to_use: "团队协作和 Prompt 资产化管理" },
    ],
    color: "var(--ws-tag-purple)",
  },
  {
    level: "专家 (L4)",
    icon: "lightbulb",
    items: [
      { title: "Meta-Prompting 元提示", desc: "让 AI 自己设计 Prompt 策略：给定任务，AI 生成优化后的 Prompt，再基于该 Prompt 执行", example: "请为'AI 辅助高中物理教学方案设计'这个任务，先生成一个最优的 Prompt 模板，然后基于该模板回答。", when_to_use: "复杂任务需要最优 Prompt 设计时" },
      { title: "DSPy 编程式提示优化", desc: "使用 DSPy 框架将 Prompt 视为可优化参数，通过自动编译将声明式程序转为最优提示", example: "dspy.ChainOfThought('context, question -> answer') 自动优化提示和 Few-shot 示例", when_to_use: "需要系统化优化 Pipeline 性能" },
      { title: "Constitutional Prompting", desc: "在 Prompt 中嵌入宪法级原则约束，让模型在回答前逐条自查是否符合原则", example: "在回答前自查：1) 是否尊重隐私？2) 是否避免了刻板印象？3) 是否标注了不确定？", when_to_use: "高风险决策、伦理敏感场景" },
      { title: "多 Agent 角色 Prompting", desc: "为不同 Agent 分配不同角色/Prompt，通过辩论、协作或审查提升综合输出质量", example: "Agent A: 激进创新方案 | Agent B: 风险评估 | Agent C: 综合仲裁。请三方分别输出后综合。", when_to_use: "复杂决策、方案评审、内容审核" },
      { title: "RAG 上下文工程", desc: "精细设计检索片段的注入格式、引用标记、冲突处理策略，而非简单拼接", example: "检索到 {N} 条相关文献，如有冲突请标注来源并说明差异，不确定处标注 [待查证]。", when_to_use: "知识密集型任务、长文档问答" },
    ],
    color: "var(--ws-tag-pink)",
  },
  {
    level: "研究前沿 (L5)",
    icon: "telescope",
    items: [
      { title: "Automated Prompt Optimization (APO)", desc: "使用梯度-free 优化或 LLM-as-Judge 自动搜索最优 Prompt，如 TextGrad/OPRO", example: "使用 TextGrad 自动优化 Prompt，以测试集准确率为目标函数，迭代改进提示表述", when_to_use: "大规模 Prompt 自动调优" },
      { title: "Multi-Turn 对话策略设计", desc: "设计多轮对话的状态机模型、澄清策略和错误恢复机制", example: "第一轮收集需求 -> 第二轮确认理解 -> 第三轮生成方案 -> 第四轮根据反馈修改。每轮都有回退路径。", when_to_use: "客服 Agent、对话式引导系统" },
      { title: "上下文压缩与记忆管理", desc: "长对话中通过摘要、关键信息提取和遗忘策略管理 Token 预算", example: "对超过 10 轮的历史对话进行逐层摘要压缩，保留关键决策点和用户偏好。", when_to_use: "长对话、长期 Agent 运行" },
      { title: "Adaptive In-Context Learning", desc: "基于当前上下文动态选择最优 Few-shot 示例和推理策略", example: "从示例库中通过语义相似度检索最相关的 5 个示例注入 Prompt，而非固定示例。", when_to_use: "任务多样、示例库庞大的场景" },
    ],
    color: "var(--ws-tag-teal)",
  },
];

/** Prompt 模板示例 */
export const PROMPT_TEMPLATES = [
  { title: "角色写作", template: "你是一位资深{领域}专家，请用{风格}风格写一篇关于{主题}的文章，字数约{字数}字。要求：1) 结构清晰 2) 数据支撑 3) 避免行话堆砌" },
  { title: "代码审查", template: "Review 以下 {语言} 代码，按优先级列出：\n1) [严重] 安全漏洞和运行时错误\n2) [中等] 性能瓶颈和资源浪费\n3) [建议] 可读性和维护性改进\n\n```\n{代码}\n```\n\n对每个问题给出具体修改建议。" },
  { title: "学习助手", template: "我想学习{主题}，请按以下框架输出：\n1. 前置知识清单（我需要先会什么）\n2. 分阶段学习路径（初级/中级/高级，每阶段含目标与项目）\n3. 推荐资源（课程/书籍/项目/社区）\n4. 常见误区和避坑指南\n5. 自我检验题目" },
  { title: "数据分析", template: "我有以下{数据描述}数据。请：\n1. 识别 3-5 个关键趋势并解释业务含义\n2. 标记异常点并提供可能原因\n3. 给出 3 条可操作建议\n\n数据：\n{数据}\n\n要求：每个结论标注置信度 (高/中/低)。" },
  { title: "方案对比", template: "针对{问题}，请对比 {方案A} 和 {方案B}：\n| 维度 | 方案A | 方案B |\n|------|-------|-------|\n| 技术可行性 | | |\n| 成本 | | |\n| 风险 | | |\n| 扩展性 | | |\n| 团队匹配 | | |\n\n最终推荐及其理由：" },
];

/** Prompt Checklist */
export const PROMPT_CHECKLIST = [
  "模型是否清楚自己的角色和任务边界？",
  "指令是否使用直接动词，避免双重否定和歧义？",
  "是否需要 Few-shot 示例来统一输出格式？",
  "输出格式是否明确指定 (JSON/Markdown/表格)？",
  "是否提供了必要的背景上下文和知识边界？",
  "复杂问题是否拆解为子任务链？",
  "是否采用了逐步推理策略 (CoT/ReAct)？",
  "温度/top_p 参数是否根据场景调整？",
  "是否通过 MCP Prompt 资源复用了标准化模板？",
  "是否添加了负面约束 (不要编造/不要推测)？",
  "是否有自我审查或人类校验步骤？",
  "是否建立了 Prompt 版本管理和 A/B 测试机制？",
  "输出是否经过可访问性检查 (屏幕阅读器友好)？",
  "针对安全敏感场景，是否添加了宪法级原则约束？",
];
