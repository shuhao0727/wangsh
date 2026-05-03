import type { LearningBook, LearningBookChapter } from "../learning/types";

type ChapterDifficulty = LearningBookChapter["difficulty"];

interface ChapterSeed {
  slug: string;
  title: string;
  summary: string;
  difficulty: ChapterDifficulty;
  minutes: number;
  focus: string;
  history: string;
  practice: string;
  output: string;
  terms: [string, string][];
}

const buildMarkdown = (chapter: ChapterSeed) => `# ${chapter.title}

## 学习定位
${chapter.summary}人工智能不是一个单一工具，而是一组关于表示、推理、学习、生成、交互和治理的技术体系。学习 ${chapter.focus} 时，要避免把所有能力都归因于“模型很聪明”，而要追问：输入如何表示，系统如何得到中间证据，输出如何验证，失败时如何回退。这样才能从使用者变成设计者。

## 知识脉络
${chapter.history}在课堂和项目环境中，AI 的价值不在于替代所有思考，而在于把重复的信息处理、模式发现和交互生成变成可控流程。你需要理解符号方法、机器学习方法、深度学习方法和大模型方法之间的差异：符号系统重规则，机器学习重数据统计，深度学习重表示，大模型重通用生成与上下文适配。它们不是互相取代，而是在不同约束下组合。

## 实践方法
围绕 ${chapter.practice}，本章建议采用“观察—拆解—实验—评估—反思”的节奏。先观察一个真实 AI 功能，拆出输入、模型、工具、知识库、安全边界和用户反馈；再设计一个小实验验证其中一个环节；最后记录成功案例、失败案例和改进策略。学习成果必须包含证据，而不是只展示漂亮截图。

> 一个可靠的 AI 学习者，既能说清能力边界，也能把复杂概念转化为可运行的小系统和可讨论的伦理判断。
`;

const makeChapter = (seed: ChapterSeed): LearningBookChapter => ({
  slug: seed.slug,
  title: seed.title,
  summary: seed.summary,
  estimatedMinutes: seed.minutes,
  difficulty: seed.difficulty,
  goals: [
    `说明 ${seed.focus} 的关键概念和适用边界`,
    "把 AI 能力拆解为输入、处理、输出和反馈环节",
    "设计一个小型实践任务并形成证据化记录",
  ],
  markdown: buildMarkdown(seed),
  checklist: [
    "能用自己的话解释本章主题与其他 AI 范式的关系",
    "能列出一个真实应用中的数据、模型、工具和风险",
    "能完成一次实践并写出成功、失败和改进记录",
  ],
  experiments: [
    {
      title: `${seed.title} 实践任务`,
      goal: `通过 ${seed.practice} 理解 ${seed.focus} 的真实作用`,
      steps: [
        "选择一个具体场景，写出用户目标和 AI 系统边界",
        "构造最小实验，记录输入、提示、输出、评价和异常情况",
        "把观察结果整理成一页实践报告，指出可用性和风险点",
      ],
      output: seed.output,
      difficulty: seed.difficulty,
    },
  ],
  glossary: seed.terms.map(([term, definition]) => ({ term, definition })),
  references: [
    {
      title: `${seed.title} 可选延伸参考`,
      source: "可选参考",
      note: "这些资料只作为拓展阅读，不替代本章内置内容与实践任务；课堂使用时可按需要选择。",
    },
  ],
});

const chapters: ChapterSeed[] = [
  { slug: "history", title: "AI 发展史：从规则推理到生成智能", summary: "梳理人工智能的关键阶段，理解不同技术路线为什么兴起、受限并再次融合。", difficulty: "beginner", minutes: 30, focus: "AI 历史脉络", history: "从早期符号主义、专家系统，到统计学习、深度学习和生成式 AI，人工智能的发展始终围绕“知识从哪里来、如何表示、如何泛化”展开。", practice: "制作一条 AI 技术时间线并标注代表系统", output: "一张带解释的 AI 技术演进时间线", terms: [["符号主义", "用规则和逻辑表达智能的方法。"], ["连接主义", "用神经网络连接权重表达能力的方法。"], ["AI 冬天", "AI 期望过高但落地不足导致投入下降的时期。"]] },
  { slug: "core-concepts", title: "核心概念：智能、表示、推理与学习", summary: "建立 AI 的概念底座，区分智能行为、知识表示、推理机制和学习机制。", difficulty: "beginner", minutes: 32, focus: "AI 基础概念", history: "AI 系统看似多样，但都离不开表示、搜索、推理、学习和反馈。理解这些概念有助于判断一个功能究竟是规则驱动、模型驱动还是混合系统。", practice: "拆解一个校园 AI 助手的输入输出结构", output: "一份 AI 系统概念拆解图", terms: [["表示", "把现实对象转成系统可处理形式。"], ["推理", "根据已知信息得出结论的过程。"], ["反馈", "用于改进系统表现的外部或内部信号。"]] },
  { slug: "symbolic-ai", title: "符号 AI：规则、知识库与专家系统", summary: "理解规则系统的优势和局限，学习如何用显式知识构建可解释的智能功能。", difficulty: "intermediate", minutes: 34, focus: "符号 AI", history: "符号 AI 曾长期代表人工智能主流，它擅长表达明确规则、流程和约束，但面对模糊语义、噪声数据和开放环境时维护成本很高。", practice: "设计一个课堂设备故障诊断规则库", output: "一个规则表和推理流程说明", terms: [["规则库", "由条件和动作组成的知识集合。"], ["专家系统", "模拟专家决策流程的程序。"], ["可解释性", "系统决策可被人理解和追踪。"]] },
  { slug: "machine-learning-paradigm", title: "机器学习范式：从规则编写到数据归纳", summary: "理解机器学习如何通过样本归纳规律，并掌握任务、数据、模型和评估的关系。", difficulty: "intermediate", minutes: 36, focus: "机器学习范式", history: "当规则难以手写时，机器学习通过数据学习模式。它改变了 AI 系统的构建方式：工程重点从写规则转向收集数据、定义目标、训练模型和评估泛化。", practice: "比较规则分类器和学习分类器的表现", output: "一份规则方法与学习方法对比报告", terms: [["训练", "用数据调整模型参数。"], ["泛化", "模型在新样本上保持效果的能力。"], ["评估", "用指标和案例判断模型质量。"]] },
  { slug: "deep-learning-paradigm", title: "深度学习范式：表示学习与端到端训练", summary: "理解深度学习如何自动学习表示，以及为什么它推动视觉、语音和语言任务突破。", difficulty: "advanced", minutes: 40, focus: "深度学习范式", history: "深度学习把特征学习和任务学习结合起来，用多层网络从原始数据中形成表示。它依赖算力、数据和优化技巧，也带来了可解释性和资源消耗问题。", practice: "观察一个小型神经网络的训练曲线", output: "一份训练曲线与过拟合分析", terms: [["表示学习", "模型自动形成有用特征的能力。"], ["端到端", "从原始输入直接训练到目标输出。"], ["过拟合", "模型记住训练数据但泛化较差。"]] },
  { slug: "transformer", title: "Transformer：注意力机制与通用架构", summary: "掌握 Transformer 的基本直觉，理解注意力机制为什么适合序列和多模态建模。", difficulty: "advanced", minutes: 42, focus: "Transformer", history: "Transformer 用自注意力替代传统递归结构，使模型能并行处理序列并捕捉长距离依赖。它逐渐成为语言、视觉、语音和多模态模型的基础架构。", practice: "用示意图解释一句话中词语之间的注意力关系", output: "一张注意力关系图和文字说明", terms: [["注意力", "根据上下文为不同信息分配权重。"], ["Token", "模型处理文本或其他数据的基本单元。"], ["位置编码", "给序列元素加入顺序信息的方法。"]] },
  { slug: "llm", title: "大语言模型：预训练、对齐与上下文学习", summary: "理解大语言模型如何通过预训练获得通用能力，并通过提示、对齐和工具扩展应用。", difficulty: "advanced", minutes: 45, focus: "大语言模型", history: "大语言模型通过海量文本预训练学习语言和世界知识的统计结构，再通过指令微调、人类反馈和安全策略更适合对话与任务执行。", practice: "比较不同提示方式对同一任务输出的影响", output: "一份提示对比和输出质量评价表", terms: [["预训练", "在大规模数据上学习通用模式。"], ["对齐", "让模型行为更符合人类意图和安全要求。"], ["上下文学习", "模型根据当前输入示例临时适配任务。"]] },
  { slug: "generative-ai", title: "生成式 AI：文本、图像、音频与视频生成", summary: "理解生成式 AI 的能力谱系，学会从创作流程、版权、质量控制和安全角度使用它。", difficulty: "advanced", minutes: 40, focus: "生成式 AI", history: "生成式 AI 将模型从识别和预测扩展到内容生成。它能提升创作效率，也会带来真实性、版权、偏见和滥用风险，需要以流程和规范管理。", practice: "设计一个图文生成工作流并进行质量审查", output: "一个生成作品样例和质量检查清单", terms: [["扩散模型", "逐步去噪生成图像等内容的模型。"], ["采样", "从模型概率分布中生成具体结果。"], ["版权风险", "生成内容可能涉及来源、授权或相似性问题。"]] },
  { slug: "prompt-engineering", title: "Prompt 工程：任务说明、约束与评估", summary: "把提示词从玄学变成工程方法，学习目标、上下文、格式、示例和评价标准。", difficulty: "intermediate", minutes: 36, focus: "Prompt 工程", history: "Prompt 工程不是堆砌修饰词，而是把任务边界、背景材料、输出格式、判断标准和反例组织清楚，让模型更稳定地完成任务。", practice: "为同一任务设计三版提示并比较输出", output: "一份 Prompt 迭代记录和最佳版本说明", terms: [["系统提示", "定义模型角色和全局约束的提示。"], ["Few-shot", "通过少量示例引导模型完成任务。"], ["输出格式", "约束结果结构以便阅读或程序处理。"]] },
  { slug: "rag", title: "RAG：让 AI 基于资料回答", summary: "学习检索增强生成如何降低幻觉，让模型回答可追溯、可更新的知识问题。", difficulty: "advanced", minutes: 42, focus: "RAG", history: "RAG 把外部知识库检索结果放入模型上下文，使回答能引用资料而不是只依赖参数记忆。它适合课程问答、制度查询和资料助手。", practice: "用三篇课程资料设计一个检索问答流程", output: "一份 RAG 流程图和问答样例", terms: [["召回", "从知识库中找出候选片段。"], ["重排", "对候选片段按相关性再次排序。"], ["引用", "把答案依据指向原始资料片段。"]] },
  { slug: "multimodal-ai", title: "多模态 AI：文本、图像与行动的统一理解", summary: "理解多模态模型如何处理不同类型输入，以及它在教育、创作和机器人中的应用。", difficulty: "advanced", minutes: 40, focus: "多模态 AI", history: "多模态 AI 把文本、图像、音频、视频和动作放到统一表示空间中，使系统能看图回答、理解屏幕、生成图文并辅助真实世界任务。", practice: "分析一个看图问答或屏幕理解任务", output: "一份多模态输入输出拆解报告", terms: [["模态", "信息的表现形式，如文本、图像、声音。"], ["对齐", "让不同模态表达相同语义时接近。"], ["视觉语言模型", "同时处理图像和文本的模型。"]] },
  { slug: "ai-tools", title: "AI 工具生态：从单点工具到工作流", summary: "学习如何选择和组合 AI 工具，让它们服务真实学习、教学、办公和开发流程。", difficulty: "intermediate", minutes: 34, focus: "AI 工具体系", history: "AI 工具包括对话助手、写作工具、编程助手、图像生成、知识库、自动化和智能体平台。关键不是收藏工具，而是建立可复用工作流。", practice: "设计一个教师备课或学生项目的 AI 工作流", output: "一张工具选择矩阵和工作流说明", terms: [["工作流", "由多个步骤和工具组成的稳定流程。"], ["自动化", "让系统按规则或触发器执行任务。"], ["人机协作", "人负责目标、判断和责任，AI 负责辅助处理。"]] },
  { slug: "safety-ethics", title: "安全与伦理：偏见、隐私、责任和边界", summary: "理解 AI 应用中的安全伦理问题，建立可执行的课堂和项目治理清单。", difficulty: "advanced", minutes: 44, focus: "AI 安全伦理", history: "AI 系统会继承数据偏见，可能泄露隐私、生成错误信息或被滥用。伦理不是附加章节，而是每个 AI 项目的设计约束。", practice: "对一个 AI 应用做风险评估和改进建议", output: "一份 AI 风险清单和治理建议", terms: [["偏见", "系统对不同群体产生不公平表现。"], ["隐私", "个人信息收集、使用和保护问题。"], ["责任", "明确 AI 输出由谁审核和承担后果。"]] },
  { slug: "industry-cases", title: "行业案例：教育、医疗、制造与公共服务", summary: "通过行业案例理解 AI 的落地条件、价值来源和失败原因。", difficulty: "advanced", minutes: 38, focus: "AI 行业应用", history: "AI 在不同行业的成功取决于数据质量、流程嵌入、合规要求、用户接受度和持续维护。案例学习能帮助我们避免只看演示效果。", practice: "选择一个行业案例分析价值链和风险点", output: "一页行业案例分析卡片", terms: [["场景适配", "技术能力与真实流程匹配。"], ["合规", "满足法律、行业和组织规范。"], ["ROI", "投入产出或价值回报。"]] },
  { slug: "future", title: "未来趋势：AI 原生应用与学习者能力", summary: "面向未来理解 AI 原生软件、智能体、具身智能和个人能力结构的变化。", difficulty: "expert", minutes: 36, focus: "AI 未来趋势", history: "未来 AI 会更深地嵌入软件、设备和组织流程。学习者需要同时具备问题定义、工具组合、数据判断、伦理意识和持续学习能力。", practice: "设计一个未来校园 AI 应用并评估可行性", output: "一份未来 AI 应用概念稿和能力清单", terms: [["AI 原生", "围绕 AI 能力重新设计的软件或流程。"], ["具身智能", "能感知并作用于物理世界的智能系统。"], ["终身学习", "持续更新知识与能力以适应变化。"]] },
];

export const AI_BOOK: LearningBook = {
  moduleKey: "ai",
  title: "人工智能探索百科式学习书",
  subtitle: "从技术脉络到负责任应用的系统化学习路径",
  description: "将 AI 历史、核心范式、大模型、工具生态和安全伦理组织成可编辑的 Markdown 学习书。",
  audience: "适合希望理解 AI 全貌、开展课堂项目或建设 AI 应用原型的学习者。",
  outcomes: [
    "能解释 AI 主要技术路线及其边界",
    "能设计并评估一个小型 AI 应用或工作流",
    "能从安全、伦理和可用性角度审查 AI 输出",
  ],
  chapters: chapters.map(makeChapter),
};
