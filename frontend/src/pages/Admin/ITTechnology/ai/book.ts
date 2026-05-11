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
  history: string;
  practice: string;
  output: string;
  terms: [string, string][];
  group: string;
}

const buildMarkdown = (chapter: ChapterSeed) => `# ${chapter.title}

## 学习定位
${chapter.summary}

## 知识脉络
${chapter.history}

## 实践方法
围绕 ${chapter.practice}，本章建议先观察、再动手、最后反思。

## 本章小结
一个可靠的 AI 学习者，既能说清能力边界，也能把复杂概念转化为可运行的小系统和可讨论的伦理判断。
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
  group: seed.group,
  markdown: chapterMarkdown[seed.slug] ?? buildMarkdown(seed),
  checklist: [
    "能用自己的话解释本章主题",
    "能列出一个真实应用中的数据、模型和风险",
    "能完成一次实践并写出记录",
  ],
  experiments: [
    {
      title: `${seed.title} 实践任务`,
      goal: `通过 ${seed.practice} 理解 ${seed.focus} 的真实作用`,
      steps: [
        "选择一个具体场景，写出用户目标和 AI 系统边界",
        "构造最小实验，记录输入、输出和异常情况",
      ],
      output: seed.output,
      difficulty: seed.difficulty,
    },
  ],
  glossary: seed.terms.map(([term, definition]) => ({ term, definition })),
  references: [],
});

const chapters: ChapterSeed[] = [
  // ===== 📖 第一篇：符号主义AI =====
  { slug: "symbolic-search", title: "走迷宫：教会电脑找路", summary: "从走迷宫理解状态空间搜索——BFS 逐层探索，DFS 一条路走到黑，A* 聪明地找捷径。", difficulty: "beginner", minutes: 30, group: "📖 符号主义AI", focus: "搜索与规划", history: "搜索是 AI 最古老的能力之一。从走迷宫到下棋，搜索算法让电脑能在无数可能性中找到最优解。", practice: "在方格迷宫上手工运行 BFS 和 A*", output: "一张标注搜索过程的迷宫图", terms: [["状态空间", "所有可能局面的集合"], ["启发式", "经验规则帮助快速找到答案"], ["A*", "结合实际代价和预估代价的最优搜索"]] },
  { slug: "knowledge-representation", title: "知识如何存进电脑", summary: "语义网络像思维导图，知识图谱像超大关系网——理解电脑如何组织知识。", difficulty: "intermediate", minutes: 32, group: "📖 符号主义AI", focus: "知识表示", history: "知识表示决定了 AI 能推理什么。从逻辑公式到语义网络再到知识图谱，人类一直在寻找更好的知识组织方式。", practice: "用思维导图工具画出学校知识网络", output: "一张包含 20+ 节点的学校知识图谱", terms: [["语义网络", "用节点和连线表示概念关系"], ["本体", "对领域知识的形式化描述"], ["知识图谱", "大规模结构化的实体关系网"]] },
  { slug: "expert-systems", title: "电脑当医生：规则引擎", summary: "用 if-then 规则做推理——像医生问诊一样，电脑也能根据症状推理疾病。", difficulty: "intermediate", minutes: 34, group: "📖 符号主义AI", focus: "专家系统", history: "专家系统是 AI 最早的成功应用。它把人类专家的知识写成规则，让电脑替人诊断、配置、排故。", practice: "设计一个选课推荐规则引擎", output: "一个规则表和推理示例", terms: [["规则引擎", "根据条件触发动作的系统"], ["前向链", "从事实推导结论"], ["不确定性", "不是非黑即白的推理"]] },

  // ===== 📊 第二篇：机器学习 =====
  { slug: "supervised-learning", title: "认猫还是认狗：学会分类", summary: "用标记数据训练模型——给它看 100 张猫狗照片，它自己学会区分。", difficulty: "beginner", minutes: 32, group: "📊 机器学习", focus: "监督学习", history: "监督学习是 ML 最常见的范式。从垃圾邮件过滤到人脸识别，都是它的杰作。", practice: "用 Excel 或 Python 训练一个简单分类器", output: "一个分类决策表格和可视化", terms: [["训练集", "用来学习的标记数据"], ["测试集", "用来验证效果的未见过数据"], ["过拟合", "背答案不会解题——记住了训练数据但无法泛化"]] },
  { slug: "unsupervised-learning", title: "物以类聚：没有标签也能分", summary: "没标签怎么办？K-Means 自动把相似的东西分到一组——就像整理房间。", difficulty: "intermediate", minutes: 34, group: "📊 机器学习", focus: "无监督学习", history: "现实中大部分数据没有标签。无监督学习让电脑自己发现数据中的隐藏结构。", practice: "用 K-Means 对班级同学的兴趣分组", output: "一个聚类散点图和各组特征描述", terms: [["聚类", "把相似数据放到一起"], ["降维", "把高维数据压缩到可视化维度"], ["PCA", "找出数据方差最大的方向"]] },
  { slug: "reinforcement-learning", title: "打游戏练级：AI 的试错之旅", summary: "AlphaGo 怎么学会下棋？靠试错！赢了加分输了扣分——AI 自己找到最优策略。", difficulty: "intermediate", minutes: 36, group: "📊 机器学习", focus: "强化学习", history: "强化学习让 AI 通过与环境互动来学习。从游戏到机器人控制，试错法让 AI 超越人类。", practice: "玩一局理解 Q-Learning 的更新过程", output: "一张 Q 表更新示意图", terms: [["Agent", "做出决策的行动者"], ["环境", "Agent 交互的世界"], ["奖励", "告诉 Agent 做得好不好的信号"]] },

  // ===== 🧠 第三篇：深度学习 =====
  { slug: "neural-networks", title: "叠乐高：搭一个数字大脑", summary: "神经元就像乐高积木——一个个简单的计算单元堆叠起来，能解决复杂问题。", difficulty: "intermediate", minutes: 36, group: "🧠 深度学习", focus: "神经网络基础", history: "神经网络受大脑启发，但远比大脑简单。多层网络+反向传播让深度学习成为可能。", practice: "手动计算一个简单神经元的输出", output: "一个前向传播计算表", terms: [["神经元", "接收输入计算加权和输出结果的单元"], ["激活函数", "决定神经元是否激活的开关"], ["反向传播", "从错误中学习——往减少损失的方向调整"]] },
  { slug: "cnn-vision", title: "AI 的眼睛：卷积神经网络", summary: "CNN 像用滤镜修图——一个卷积核检测边缘，另一个检测纹理，层层叠加看懂图片。", difficulty: "intermediate", minutes: 38, group: "🧠 深度学习", focus: "CNN 视觉", history: "CNN 让电脑看懂图片。从 LeNet 到 ResNet，视觉 AI 的准确率已经超过人类。", practice: "用在线工具可视化 CNN 的每一层输出", output: "一张 CNN 各层特征可视化图", terms: [["卷积", "用小窗口在图片上滑动检测特征"], ["池化", "缩小图片保留重要信息"], ["迁移学习", "借用一个已训练的模型来加速学习"]] },
  { slug: "transformer-attention", title: "团战注意力：Transformer 的秘密", summary: "Self-Attention 就像王者团战——你不需要看全图，只盯关键目标就行。", difficulty: "advanced", minutes: 40, group: "🧠 深度学习", focus: "Transformer", history: "2017 年 Transformer 问世，彻底改变了 AI 格局。注意力机制让模型并行处理、捕捉长距离依赖。", practice: "用示意图画出 Q K V 如何计算注意力", output: "一张注意力权重热力图", terms: [["Q", "你想找什么"], ["K", "我有什么特征"], ["V", "我的实际内容是什么"]] },

  // ===== 🤖 第四篇：大语言模型 =====
  { slug: "llm-pretraining", title: "海量阅读：让 AI 读完整个互联网", summary: "GPT 怎么学会说话的？读了几万亿个字之后，它自己就懂了语法、逻辑和常识。", difficulty: "intermediate", minutes: 34, group: "🤖 大语言模型", focus: "LLM 预训练", history: "LLM 的魔力来自规模——海量数据+超多参数=涌现能力。GPT-3 的 1750 亿参数让世界震惊。", practice: "对比不同规模模型在同一任务上的输出差异", output: "一个模型能力对比表", terms: [["预训练", "不针对特定任务的大规模学习"], ["Token", "文本的最小处理单元"], ["涌现", "规模变大后自动出现的新能力"]] },
  { slug: "finetune-alignment", title: "家教辅导：让 AI 听话", summary: "预训练只是打基础——还要微调和 RLHF，才能让 AI 变得有用。", difficulty: "advanced", minutes: 38, group: "🤖 大语言模型", focus: "微调与对齐", history: "GPT-3 虽然强大但经常胡说八道。通过指令微调和人类反馈，ChatGPT 变得好用多了。", practice: "理解 DPO 和 RLHF 的核心区别", output: "一张对齐方法对比表", terms: [["SFT", "用优质问答对来训练"], ["RLHF", "人类打分指导模型优化"], ["DPO", "直接从偏好数据中学习"]] },
  { slug: "inference-deploy", title: "压缩饼干：让大模型跑得快", summary: "200GB 的模型怎么塞进手机？量化压缩 4 倍、蒸馏变小 10 倍——模型减肥术。", difficulty: "advanced", minutes: 36, group: "🤖 大语言模型", focus: "推理与部署", history: "大模型虽强但不实用。量化、蒸馏、剪枝让它们跑在消费级硬件上。", practice: "用 Ollama 在本地运行一个量化模型", output: "一张量化对比速度和精度表", terms: [["量化", "降低数值精度减少存储"], ["蒸馏", "大模型教小模型"], ["Ollama", "一键本地运行开源 LLM"]] },

  // ===== 🚀 第五篇：AI 应用 =====
  { slug: "nlp-rag", title: "带小抄考试：AI 的知识外挂", summary: "RAG 让 AI 先翻书再回答——告别幻觉，每条答案都有出处。", difficulty: "intermediate", minutes: 38, group: "🚀 AI 应用", focus: "NLP 与 RAG", history: "RAG 把检索和生成结合起来。AI 不再只靠记忆回答，而是实时查资料再组织答案。", practice: "用 DeepSeek API + 本地文档搭建简易 RAG", output: "一个可运行的 RAG Demo", terms: [["检索", "从知识库找相关资料"], ["幻觉", "AI 编造不存在的信息"], ["引用", "答案指向原始出处"]] },
  { slug: "computer-vision", title: "AI 的五官：看懂世界", summary: "从人脸识别到自动驾驶——CV 如何让电脑拥有眼睛。", difficulty: "intermediate", minutes: 34, group: "🚀 AI 应用", focus: "计算机视觉", history: "CV 经历了从手工特征到深度学习的革命。如今 AI 不仅能识别物体，还能理解场景。", practice: "用通义千问 VL 分析一张课堂照片", output: "一张标注了检测结果的图片", terms: [["目标检测", "找到并框出图中的物体"], ["分割", "把每个像素分类"], ["VLM", "视觉语言模型——看得见也说得清"]] },
  { slug: "generative-ai-apps", title: "AI 画家：从噪声中创造美", summary: "Stable Diffusion 怎么画画的？从一团随机噪声开始，一步一步去噪直到画面清晰。", difficulty: "intermediate", minutes: 36, group: "🚀 AI 应用", focus: "生成式 AI", history: "扩散模型让 AI 绘画从实验室走进日常生活。Midjourney、DALL-E、通义万相都是它的后代。", practice: "用通义万相生成一组风格统一的图片", output: "一组对比图：不同 prompt 的生成效果", terms: [["扩散", "逐步去噪的过程"], ["提示词", "描述你想要什么的文字指令"], ["ControlNet", "精确控制生成内容的结构"]] },

  // ===== ⚖️ 第六篇：安全与未来 =====
  { slug: "ai-safety", title: "AI 也会犯错：幻觉、偏见与越狱", summary: "AI 不是完美的——它会胡说八道、歧视用户、被恶意操控。理解风险才能安全使用。", difficulty: "intermediate", minutes: 36, group: "⚖️ 安全与未来", focus: "AI 安全", history: "随着 AI 能力增强，安全问题日益重要。从社交媒体偏见到深度伪造，AI 的双刃剑越来越锋利。", practice: "测试并记录一次 AI 幻觉或偏见案例", output: "一份 AI 安全风险报告", terms: [["幻觉", "AI 自信地说出错误信息"], ["偏见", "AI 对特定群体不公平"], ["越狱", "绕过 AI 的安全限制"]] },
  { slug: "ai-ethics", title: "谁为 AI 的错误负责", summary: "AI 写的文章侵权怎么办？AI 做的医疗决策出错怪谁？探讨 AI 时代的伦理困境。", difficulty: "intermediate", minutes: 34, group: "⚖️ 安全与未来", focus: "AI 伦理", history: "AI 伦理不是空谈——从自动驾驶事故到 AI 换脸诈骗，伦理问题已进入法庭和立法机构。", practice: "对一款 AI 产品做伦理评估", output: "一份 AI 伦理评估清单", terms: [["版权", "AI 生成内容的归属问题"], ["隐私", "训练数据中的个人信息"], ["问责", "谁为 AI 决策负责"]] },
  { slug: "ai-future", title: "十年后的 AI 世界", summary: "AGI 还有多远？AI Agent 会取代 App 吗？具身智能会让机器人走进千家万户吗？", difficulty: "beginner", minutes: 32, group: "⚖️ 安全与未来", focus: "AI 未来", history: "预测未来很难，但我们可以基于当前趋势展望 AI 的演进方向。从专用 AI 到通用 AI，路还很长。", practice: "写出你对 2035 年 AI 生活的想象", output: "一篇 2035 AI 与我的一天短文", terms: [["AGI", "通用人工智能——能完成任何智力任务"], ["具身智能", "有身体的 AI 能物理交互"], ["AI Agent", "能规划执行学习的自主系统"]] },
];

export const AI_BOOK: LearningBook = {
  moduleKey: "ai",
  title: "人工智能探索百科式学习书",
  subtitle: "从符号推理到生成智能的系统化学习路径",
  description: "将 AI 历史、核心范式、大模型、工具生态和安全伦理组织成可编辑的 Markdown 学习书。",
  audience: "适合希望理解 AI 全貌、开展课堂项目或建设 AI 应用原型的学习者。",
  outcomes: [
    "能解释 AI 主要技术路线及其边界",
    "能选择合适的工具组合完成 AI 实践任务",
    "能识别 AI 应用中的安全伦理风险",
  ],
  chapters: chapters.map(makeChapter),
};
