import type { LearningBook, LearningBookChapter } from "../learning/types";

type ChapterDifficulty = LearningBookChapter["difficulty"];

interface ChapterSeed {
  slug: string;
  title: string;
  summary: string;
  difficulty: ChapterDifficulty;
  minutes: number;
  focus: string;
  system: string;
  implementation: string;
  output: string;
  terms: [string, string][];
}

const buildMarkdown = (chapter: ChapterSeed) => `# ${chapter.title}

## 学习定位
${chapter.summary}智能体学习的关键不是把大模型包装成聊天窗口，而是理解一个系统如何观察环境、形成目标、拆解任务、调用工具、保存记忆、验证结果并在失败时恢复。学习 ${chapter.focus} 时，要把它看作工程系统的一部分：它需要接口、权限、日志、评估、成本控制和人类监督。

## 系统视角
${chapter.system}一个可靠 Agent 通常包含模型、提示、工具注册、执行器、状态、记忆、计划器、观察器和安全边界。模型负责语言理解和决策倾向，工具负责连接真实世界，状态负责记录过程，评估负责判断结果是否达标。任何一个环节不清晰，Agent 都可能表现为“看似会思考，实际不可控”。因此本章强调可观察、可调试、可替换的设计。

## 实现路径
围绕 ${chapter.implementation}，建议先做最小闭环：给 Agent 一个明确任务、一个可控工具、一个失败可复现的测试样例和一个人工确认点。随后逐步加入计划、多工具、记忆、知识库和监控。每次增加能力都要回答三个问题：它解决了什么限制，带来了什么风险，如何证明它比简单流程更好。

> 智能体的成熟度不取决于提示词有多长，而取决于系统能否稳定完成任务、解释过程、控制权限，并在异常情况下安全停止。
`;

const makeChapter = (seed: ChapterSeed): LearningBookChapter => ({
  slug: seed.slug,
  title: seed.title,
  summary: seed.summary,
  estimatedMinutes: seed.minutes,
  difficulty: seed.difficulty,
  goals: [
    `解释 ${seed.focus} 在 Agent 系统中的作用`,
    "设计一个可控、可验证、可回退的最小实现",
    "识别工具调用、记忆、权限和评估中的主要风险",
  ],
  markdown: buildMarkdown(seed),
  checklist: [
    "能画出本章主题涉及的 Agent 组件关系",
    "能完成一个最小实现或伪代码流程",
    "能写出日志、失败处理和安全边界要求",
  ],
  experiments: [
    {
      title: `${seed.title} 实现任务`,
      goal: `围绕 ${seed.implementation} 构建一个可测试 Agent 片段`,
      steps: [
        "定义任务目标、允许使用的工具和禁止越界的操作",
        "实现或伪实现一次观察、决策、行动、验证循环",
        "记录成功路径、失败路径、日志字段和人工接管条件",
      ],
      output: seed.output,
      difficulty: seed.difficulty,
    },
  ],
  glossary: seed.terms.map(([term, definition]) => ({ term, definition })),
  references: [
    {
      title: `${seed.title} 可选参考`,
      source: "可选参考",
      note: "作为延伸阅读和框架对照使用，不作为完成本章的必要条件；优先理解页面内的实现模型。",
    },
  ],
});

const chapters: ChapterSeed[] = [
  { slug: "agent-concept", title: "Agent 概念：从对话模型到行动系统", summary: "建立智能体基本概念，理解 Agent 与普通聊天、脚本自动化和传统工作流的区别。", difficulty: "beginner", minutes: 30, focus: "Agent 基本概念", system: "Agent 是以目标为中心、能够在环境中选择行动的系统。它可能使用大模型做决策，也可能结合规则、工具和人工审批。", implementation: "把一个资料整理任务拆成目标、观察、行动和结果验证", output: "一张 Agent 组件图和一个最小任务流程", terms: [["Agent", "能根据目标和环境选择行动的软件系统。"], ["环境", "Agent 可观察和影响的外部系统。"], ["行动", "Agent 调用工具或输出结果的步骤。"]] },
  { slug: "react-pattern", title: "ReAct 模式：推理与行动交替", summary: "学习 ReAct 如何把思考、工具调用和观察结果串成可追踪的任务循环。", difficulty: "intermediate", minutes: 34, focus: "ReAct 模式", system: "ReAct 把 Reasoning 与 Acting 结合，让模型先分析，再选择工具，再根据观察继续推进。它适合需要多步查找、计算或操作的任务。", implementation: "设计一个课程资料问答的思考—行动—观察循环", output: "一份 ReAct 轨迹样例和失败处理说明", terms: [["Reasoning", "模型对当前状态和下一步的分析。"], ["Acting", "调用工具或执行操作。"], ["Observation", "工具返回或环境反馈。"]] },
  { slug: "tool-use", title: "工具使用：让模型连接真实能力", summary: "理解工具如何扩展模型能力，以及工具描述、输入校验和结果解释的重要性。", difficulty: "intermediate", minutes: 36, focus: "工具调用", system: "工具把模型从文本生成扩展到搜索、计算、数据库、文件、浏览器和业务系统。工具越强，权限和校验越重要。", implementation: "为 Agent 设计一个安全的课程查询工具", output: "一个工具接口定义和调用日志样例", terms: [["工具描述", "告诉模型工具用途和参数的说明。"], ["参数校验", "检查工具输入是否安全有效。"], ["工具结果", "外部系统返回给 Agent 的观察信息。"]] },
  { slug: "function-calling", title: "Function Calling：结构化调用与参数约束", summary: "掌握函数调用的基本结构，让 Agent 输出可被程序可靠解析和执行。", difficulty: "intermediate", minutes: 35, focus: "函数调用", system: "Function Calling 用 schema 约束模型输出，使模型选择函数并生成参数。它让自然语言意图进入可执行程序边界。", implementation: "定义一个创建学习计划的函数 schema", output: "一个函数 schema、三条测试输入和预期调用结果", terms: [["Schema", "描述数据结构和约束的规范。"], ["结构化输出", "可被程序解析的固定格式输出。"], ["调用路由", "根据意图选择合适函数。"]] },
  { slug: "mcp", title: "MCP：模型上下文协议与工具生态", summary: "理解 MCP 如何把模型、工具和外部服务解耦，形成可复用的上下文与能力接口。", difficulty: "advanced", minutes: 42, focus: "MCP", system: "MCP 将工具、资源和提示作为标准化服务暴露给模型应用，使不同客户端可以复用同一套外部能力。", implementation: "设计一个面向学习内容管理的 MCP 工具清单", output: "一份 MCP server 能力草图和安全说明", terms: [["MCP Server", "向模型应用提供工具和资源的服务。"], ["Resource", "可读取的上下文资料。"], ["Tool", "可执行的外部能力。"]] },
  { slug: "memory", title: "记忆系统：短期状态、长期偏好与知识沉淀", summary: "学习 Agent 记忆的类型、写入策略和隐私边界，避免记忆变成不可控黑箱。", difficulty: "advanced", minutes: 40, focus: "Agent 记忆", system: "记忆可以是当前任务状态、用户偏好、项目事实或检索知识。不同记忆有不同生命周期和权限要求。", implementation: "为学习助手设计记忆写入和遗忘规则", output: "一份记忆分类表和写入决策流程", terms: [["短期记忆", "当前任务中的临时上下文。"], ["长期记忆", "跨会话保留的偏好或事实。"], ["遗忘", "删除过期或不应保存的信息。"]] },
  { slug: "planning", title: "计划能力：任务拆解、检查点与恢复", summary: "理解 Agent 如何制定计划、执行步骤、复核结果，并在失败时调整路线。", difficulty: "advanced", minutes: 42, focus: "计划与执行", system: "计划器把复杂目标拆成可执行步骤。好的计划必须包含依赖关系、验证命令、失败条件和人工确认点。", implementation: "把一个项目报告生成任务拆成 Agent 执行计划", output: "一份带验证点的 Agent 执行计划", terms: [["计划器", "生成和维护任务步骤的组件。"], ["检查点", "用于确认阶段结果的节点。"], ["恢复", "失败后回到安全状态或替代路径。"]] },
  { slug: "rag-agent", title: "RAG Agent：知识库、引用与可追溯回答", summary: "把 RAG 与 Agent 结合，构建能检索、引用、判断资料充分性的问答系统。", difficulty: "advanced", minutes: 44, focus: "RAG Agent", system: "RAG Agent 不只是检索后回答，还要判断资料是否足够、是否需要再次检索、是否应拒答或提示不确定。", implementation: "实现一个课程知识库问答 Agent 的检索决策流程", output: "一份 RAG Agent 流程图和引用样例", terms: [["检索", "从知识库查找相关片段。"], ["上下文组装", "把检索结果组织进模型输入。"], ["可追溯", "答案能指向依据来源。"]] },
  { slug: "multi-agent", title: "多智能体：协作、分工与冲突处理", summary: "理解多个 Agent 如何分工合作，以及通信、仲裁和成本控制问题。", difficulty: "advanced", minutes: 45, focus: "多智能体", system: "多智能体系统可按角色分工，如研究、编写、审查和执行。它提升并行性，也增加协调成本和冲突风险。", implementation: "设计一个研究员、作者、审查员三角色协作流程", output: "一张多 Agent 协作图和消息协议草案", terms: [["角色分工", "为不同 Agent 指定职责。"], ["仲裁", "处理冲突意见并做决定。"], ["通信协议", "Agent 之间交换信息的格式和规则。"]] },
  { slug: "frameworks", title: "框架生态：LangChain、LlamaIndex 与 AutoGen 等", summary: "了解主流 Agent 框架解决的问题，学会按项目需求选择而不是盲目追新。", difficulty: "intermediate", minutes: 36, focus: "Agent 框架", system: "框架提供工具封装、链式调用、索引、工作流、多 Agent 和观测能力。选择框架要看复杂度、团队熟悉度和部署约束。", implementation: "为一个学习助手项目选择框架并说明理由", output: "一份框架选择矩阵", terms: [["编排", "组织多个步骤和工具的执行顺序。"], ["抽象层", "隐藏底层细节的接口。"], ["锁定效应", "过度依赖某框架导致迁移困难。"]] },
  { slug: "evaluation", title: "评估体系：任务成功率、轨迹质量与人工审查", summary: "建立 Agent 评估意识，用任务结果、过程轨迹、安全性和成本综合判断系统质量。", difficulty: "advanced", minutes: 44, focus: "Agent 评估", system: "Agent 评估不能只看最后回答，还要看工具是否正确、步骤是否必要、是否越权、成本是否可接受、失败是否可解释。", implementation: "为一个工具调用 Agent 设计评估集和评分表", output: "一份 Agent 评估 rubric 和测试样例", terms: [["成功率", "任务达到预期目标的比例。"], ["轨迹", "Agent 执行过程中的步骤记录。"], ["Rubric", "分维度评分标准。"]] },
  { slug: "security", title: "安全边界：权限、提示注入与人工确认", summary: "理解 Agent 的独特安全风险，设计最小权限、输入过滤、输出审查和确认机制。", difficulty: "expert", minutes: 48, focus: "Agent 安全", system: "Agent 能调用工具和影响外部系统，因此提示注入、越权访问、数据泄露和误操作风险比普通聊天更高。", implementation: "为文件整理 Agent 设计权限和确认流程", output: "一份 Agent 安全清单和威胁模型", terms: [["最小权限", "只授予完成任务必需的能力。"], ["提示注入", "恶意内容诱导模型忽略原有指令。"], ["人工确认", "高风险操作前由人批准。"]] },
  { slug: "production", title: "生产化：部署、成本、队列与降级", summary: "学习 Agent 从 Demo 走向生产系统需要的工程能力，包括并发、重试、限流和降级。", difficulty: "expert", minutes: 50, focus: "Agent 生产化", system: "生产 Agent 需要稳定 API、任务队列、状态持久化、错误重试、成本预算、速率限制和灰度发布。Demo 能跑不代表可长期服务。", implementation: "设计一个可部署的学习任务 Agent 后端架构", output: "一张生产架构图和运行清单", terms: [["队列", "缓冲和调度异步任务的机制。"], ["降级", "异常时退回更简单但安全的能力。"], ["幂等", "重复执行不会造成额外副作用。"]] },
  { slug: "observability", title: "可观测性：日志、追踪、指标与回放", summary: "掌握 Agent 调试和运维所需的观测能力，让问题可以定位、复现和改进。", difficulty: "expert", minutes: 46, focus: "Agent 可观测性", system: "可观测性记录模型输入输出、工具调用、耗时、成本、错误、用户反馈和中间状态。没有观测，Agent 问题只能靠猜。", implementation: "设计 Agent 运行日志字段和一次失败回放流程", output: "一份日志字段表和回放报告模板", terms: [["日志", "记录系统事件和上下文。"], ["追踪", "串联一次请求跨组件的执行路径。"], ["回放", "用历史输入重现 Agent 行为。"]] },
  { slug: "enterprise-project", title: "企业级项目：从需求到可治理 Agent 平台", summary: "把前面章节整合成完整项目，学习如何规划、交付和治理一个 Agent 平台。", difficulty: "expert", minutes: 52, focus: "企业级 Agent 项目", system: "企业级 Agent 平台需要需求管理、权限系统、工具市场、审计日志、评估平台、知识治理和变更流程。", implementation: "规划一个校内 AI 学习助手平台的 Agent 能力地图", output: "一份企业级 Agent 项目蓝图和迭代路线", terms: [["治理", "对权限、质量、安全和变更进行制度化管理。"], ["能力地图", "描述平台可提供能力及边界的图谱。"], ["审计", "记录和检查系统行为是否合规。"]] },
];

export const AGENTS_BOOK: LearningBook = {
  moduleKey: "agents",
  title: "智能体探索百科式学习书",
  subtitle: "从 Agent 概念到生产级系统的工程化路径",
  description: "围绕智能体的工具调用、记忆、计划、RAG、多智能体、安全、评估和生产化构建系统教材。",
  audience: "适合已经了解基础 AI 或大模型，希望进一步设计可执行智能体系统的学习者。",
  outcomes: [
    "能解释 Agent 系统的核心组件和执行循环",
    "能设计一个带工具、记忆、评估和安全边界的最小 Agent",
    "能从生产化角度审查 Agent 的日志、权限、成本和降级策略",
  ],
  chapters: chapters.map(makeChapter),
};
