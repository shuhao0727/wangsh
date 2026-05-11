import type { LearningBook, LearningBookChapter } from "../learning/types";
import { chapterMarkdown } from "./chapters";

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
  group: string;
}

const buildMarkdown = (chapter: ChapterSeed) => `# ${chapter.title}

## 学习定位
${chapter.summary}

## 系统视角
${chapter.system}

## 实现路径
围绕 ${chapter.implementation}，建议先做最小闭环，再逐步加入更多能力。

## 本章小结
智能体的成熟度不取决于提示词有多长，而取决于系统能否稳定完成任务、解释过程、控制权限，并在异常情况下安全停止。
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
  ],
  group: seed.group,
  markdown: chapterMarkdown[seed.slug] ?? buildMarkdown(seed),
  checklist: [
    "能用自己的话解释本章主题",
    "能完成一个最小实现或伪代码流程",
  ],
  experiments: [
    {
      title: `${seed.title} 实现任务`,
      goal: `围绕 ${seed.implementation} 构建一个可测试 Agent 片段`,
      steps: ["定义任务目标和工具边界", "实现观察-决策-行动-验证循环", "记录成功路径和失败处理"],
      output: seed.output,
      difficulty: seed.difficulty,
    },
  ],
  glossary: seed.terms.map(([term, definition]) => ({ term, definition })),
  references: [],
});

const chapters: ChapterSeed[] = [
  // ===== 📖 第一篇：Agent 基础 =====
  { slug: "agent-concept", title: "你的AI私人助理：从答题器到行动派", summary: "用游戏角色理解 Agent——不只是回答问题，还能查日历、搜资料、订蛋糕、发消息。", difficulty: "beginner", minutes: 30, group: "📖 Agent基础", focus: "Agent 基本概念", system: "Agent 是以目标为中心、能够在环境中选择行动的系统。它可能使用大模型做决策，也可能结合规则、工具和人工审批。", implementation: "把一个资料整理任务拆成目标、观察、行动和结果验证", output: "一张 Agent 组件图和一个最小任务流程", terms: [["Agent", "能根据目标和环境选择行动的软件系统"], ["环境", "Agent 可观察和影响的外部系统"], ["行动", "Agent 调用工具或输出结果的步骤"]] },
  { slug: "react-pattern", title: "先想再做的循环：ReAct 模式", summary: "ReAct = Reasoning + Acting。就像考试做题：读题→想答案→写下来→检查→下一题。", difficulty: "intermediate", minutes: 34, group: "📖 Agent基础", focus: "ReAct 模式", system: "ReAct 把 Reasoning 与 Acting 结合，让模型先分析，再选择工具，再根据观察继续推进。它适合需要多步查找、计算或操作的任务。", implementation: "设计一个课程资料问答的思考-行动-观察循环", output: "一份 ReAct 轨迹样例和失败处理说明", terms: [["Reasoning", "模型对当前状态和下一步的分析"], ["Acting", "调用工具或执行操作"], ["Observation", "工具返回或环境反馈"]] },
  { slug: "planning", title: "写作业清单：任务拆解与计划", summary: "Agent 怎么把大任务拆成小步骤？计划器就像你写作业清单——做完一个勾一个。", difficulty: "advanced", minutes: 42, group: "📖 Agent基础", focus: "计划与执行", system: "计划器把复杂目标拆成可执行步骤。好的计划必须包含依赖关系、验证命令、失败条件和人工确认点。", implementation: "把一个项目报告生成任务拆成 Agent 执行计划", output: "一份带验证点的 Agent 执行计划", terms: [["计划器", "生成和维护任务步骤的组件"], ["检查点", "用于确认阶段结果的节点"], ["恢复", "失败后回到安全状态或替代路径"]] },
  { slug: "memory", title: "草稿纸 vs 笔记本：Agent 的记忆", summary: "Agent 也要记东西——短期记忆像草稿纸用完就扔，长期记忆像笔记本可以翻看。", difficulty: "advanced", minutes: 40, group: "📖 Agent基础", focus: "Agent 记忆", system: "记忆可以是当前任务状态、用户偏好、项目事实或检索知识。不同记忆有不同生命周期和权限要求。", implementation: "为学习助手设计记忆写入和遗忘规则", output: "一份记忆分类表和写入决策流程", terms: [["短期记忆", "当前任务中的临时上下文"], ["长期记忆", "跨会话保留的偏好或事实"], ["遗忘", "删除过期或不应保存的信息"]] },

  // ===== 🔧 第二篇：工具与能力 =====
  { slug: "tool-use", title: "文具盒里的超能力：工具调用", summary: "Agent 的工具就像你的文具盒——计算器算数、词典查词、浏览器搜索，各有用处。", difficulty: "intermediate", minutes: 36, group: "🔧 工具与能力", focus: "工具调用", system: "工具把模型从文本生成扩展到搜索、计算、数据库、文件、浏览器和业务系统。工具越强，权限和校验越重要。", implementation: "为 Agent 设计一个安全的课程查询工具", output: "一个工具接口定义和调用日志样例", terms: [["工具描述", "告诉模型工具用途和参数的说明"], ["参数校验", "检查工具输入是否安全有效"], ["工具结果", "外部系统返回给 Agent 的观察信息"]] },
  { slug: "function-calling", title: "遥控器按钮：Function Calling", summary: "Function Calling 就像遥控器——每个按钮有明确功能，按错了不会爆炸。用 DeepSeek API 实现。", difficulty: "intermediate", minutes: 35, group: "🔧 工具与能力", focus: "函数调用", system: "Function Calling 用 schema 约束模型输出，使模型选择函数并生成参数。它让自然语言意图进入可执行程序边界。国内 DeepSeek API 完美支持。", implementation: "定义一个创建学习计划的函数 schema 并用 DeepSeek API 调用", output: "一个函数 schema 和三条测试调用结果", terms: [["Schema", "描述数据结构和约束的规范"], ["结构化输出", "可被程序解析的固定格式输出"], ["DeepSeek", "国产大模型，完全兼容 OpenAI Function Calling 接口"]] },
  { slug: "mcp", title: "USB 接口：MCP 统一工具生态", summary: "MCP 就像 USB-C——统一标准，什么设备都能插。不同 AI 应用共享同一套工具。", difficulty: "advanced", minutes: 42, group: "🔧 工具与能力", focus: "MCP", system: "MCP 将工具、资源和提示作为标准化服务暴露给模型应用，使不同客户端可以复用同一套外部能力。", implementation: "设计一个面向学习内容管理的 MCP 工具清单", output: "一份 MCP server 能力草图和安全说明", terms: [["MCP Server", "向模型应用提供工具和资源的服务"], ["Resource", "可读取的上下文资料"], ["Tool", "可执行的外部能力"]] },

  // ===== 🧩 第三篇：多 Agent 协作 =====
  { slug: "multi-agent", title: "王者团战：多 Agent 分工协作", summary: "五个 Agent 各司其职——研究员查资料、写手整理、审校检查、翻译做多语言、报告员汇总。", difficulty: "advanced", minutes: 45, group: "🧩 多Agent协作", focus: "多智能体", system: "多智能体系统可按角色分工，如研究、编写、审查和执行。它提升并行性，也增加协调成本和冲突风险。", implementation: "设计一个研究员-作者-审查员三角色协作流程", output: "一张多 Agent 协作图和消息协议草案", terms: [["角色分工", "为不同 Agent 指定职责"], ["仲裁", "处理冲突意见并做决定"], ["通信协议", "Agent 之间交换信息的格式和规则"]] },
  { slug: "rag-agent", title: "侦探查案：RAG Agent 的检索推理", summary: "RAG Agent = 带图书馆的侦探——先查资料再推理，不是凭空瞎猜。", difficulty: "advanced", minutes: 44, group: "🧩 多Agent协作", focus: "RAG Agent", system: "RAG Agent 不只是检索后回答，还要判断资料是否足够、是否需要再次检索、是否应拒答或提示不确定。", implementation: "实现一个课程知识库问答 Agent 的检索决策流程", output: "一份 RAG Agent 流程图和引用样例", terms: [["检索", "从知识库查找相关片段"], ["上下文组装", "把检索结果组织进模型输入"], ["可追溯", "答案能指向依据来源"]] },
  { slug: "evaluation", title: "批改试卷：Agent 评估体系", summary: "评估 Agent 就像批改试卷——不是只看最后答案，还要看解题步骤对不对。", difficulty: "advanced", minutes: 44, group: "🧩 多Agent协作", focus: "Agent 评估", system: "Agent 评估不能只看最后回答，还要看工具是否正确、步骤是否必要、是否越权、成本是否可接受、失败是否可解释。", implementation: "为一个工具调用 Agent 设计评估集和评分表", output: "一份 Agent 评估 rubric 和测试样例", terms: [["成功率", "任务达到预期目标的比例"], ["轨迹", "Agent 执行过程中的步骤记录"], ["Rubric", "分维度评分标准"]] },

  // ===== ⚙️ 第四篇：工程与框架 =====
  { slug: "frameworks", title: "料理包做菜：Agent 框架", summary: "LangChain、CrewAI、Dify——框架就像料理包，不用从零开始，但要知道里面有什么。", difficulty: "intermediate", minutes: 36, group: "⚙️ 工程与框架", focus: "Agent 框架", system: "框架提供工具封装、链式调用、索引、工作流、多 Agent 和观测能力。选择框架要看复杂度、团队熟悉度和部署约束。", implementation: "为一个学习助手项目选择框架并说明理由", output: "一份框架选择矩阵", terms: [["编排", "组织多个步骤和工具的执行顺序"], ["抽象层", "隐藏底层细节的接口"], ["Dify", "国产低代码 Agent 平台，适合快速原型"]] },
  { slug: "observability", title: "游戏回放：Agent 的日志追踪", summary: "可观测性就像游戏的战斗回放——每一步都能回看，找到哪里出了问题。", difficulty: "expert", minutes: 46, group: "⚙️ 工程与框架", focus: "Agent 可观测性", system: "可观测性记录模型输入输出、工具调用、耗时、成本、错误、用户反馈和中间状态。没有观测，Agent 问题只能靠猜。", implementation: "设计 Agent 运行日志字段和一次失败回放流程", output: "一份日志字段表和回放报告模板", terms: [["日志", "记录系统事件和上下文"], ["追踪", "串联一次请求跨组件的执行路径"], ["回放", "用历史输入重现 Agent 行为"]] },
  { slug: "security", title: "门锁系统：Agent 的安全防护", summary: "Agent 能打电话能发邮件——不给它装门锁，它可能把你私密文件发出去。", difficulty: "expert", minutes: 48, group: "⚙️ 工程与框架", focus: "Agent 安全", system: "Agent 能调用工具和影响外部系统，因此提示注入、越权访问、数据泄露和误操作风险比普通聊天更高。", implementation: "为文件整理 Agent 设计权限和确认流程", output: "一份 Agent 安全清单和威胁模型", terms: [["最小权限", "只授予完成任务必需的能力"], ["提示注入", "恶意内容诱导模型忽略原有指令"], ["人工确认", "高风险操作前由人批准"]] },

  // ===== 🚀 第五篇：进阶与实践 =====
  { slug: "production", title: "排练 vs 正式演出：Agent 部署", summary: "从 Demo 到上线就像从排练到正式演出——台下随便错，上台必须稳。", difficulty: "expert", minutes: 50, group: "🚀 进阶与实践", focus: "Agent 生产化", system: "生产 Agent 需要稳定 API、任务队列、状态持久化、错误重试、成本预算、速率限制和灰度发布。Demo 能跑不代表可长期服务。", implementation: "设计一个可部署的学习任务 Agent 后端架构", output: "一张生产架构图和运行清单", terms: [["队列", "缓冲和调度异步任务的机制"], ["降级", "异常时退回更简单但安全的能力"], ["幂等", "重复执行不会造成额外副作用"]] },
  { slug: "enterprise-project", title: "期末大作业：完整 Agent 项目", summary: "把前面十六章学到的串起来——从需求分析到部署上线，做一个能真正用的 Agent。", difficulty: "expert", minutes: 52, group: "🚀 进阶与实践", focus: "企业级 Agent 项目", system: "企业级 Agent 平台需要需求管理、权限系统、工具市场、审计日志、评估平台、知识治理和变更流程。", implementation: "规划一个校内 AI 学习助手平台的 Agent 能力地图", output: "一份企业级 Agent 项目蓝图和迭代路线", terms: [["治理", "对权限、质量、安全和变更进行制度化管理"], ["能力地图", "描述平台可提供能力及边界的图谱"], ["审计", "记录和检查系统行为是否合规"]] },
];

export const AGENTS_BOOK: LearningBook = {
  moduleKey: "agents",
  title: "智能体探索百科式学习书",
  subtitle: "从对话模型到自主行动系统的系统化学习路径",
  description: "将 Agent 概念、ReAct 模式、工具调用、多 Agent 协作、安全治理和工程部署组织成可编辑的 Markdown 学习书。",
  audience: "适合希望理解 Agent 全貌、构建自主 AI 系统的学习者。",
  outcomes: [
    "能解释 Agent 的核心架构和工作原理",
    "能设计并实现一个完整的多工具 Agent 系统",
    "能识别 Agent 系统中的安全风险和治理需求",
  ],
  chapters: chapters.map(makeChapter),
};
