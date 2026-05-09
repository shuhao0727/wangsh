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
  scenario: string;
  method: string;
  output: string;
  terms: [string, string][];
  group?: string;
  markdown?: string;
  references?: { title: string; source: string; note: string; url?: string }[];
}

const buildMarkdown = (chapter: ChapterSeed) => `# ${chapter.title}

## 学习定位
${chapter.summary}本章不是把概念当作孤立名词背诵，而是把它放回真实项目的工作流中理解：先明确问题边界，再判断数据是否足够，再选择可解释、可验证、可迭代的方法。学习 ${chapter.focus} 时，最容易犯的错误是只记住工具名称，却不知道何时使用、如何评估、怎样向他人说明结果。因此本章会把核心概念、判断标准、课堂实验和作品化产出串成一个闭环。

## 核心框架
在 ${chapter.scenario} 场景里，机器学习首先是一种从数据中归纳规律的工程方法。你需要区分目标变量、特征、样本、噪声、偏差和约束，知道哪些信息可以进入模型，哪些信息会造成泄漏。然后使用 ${chapter.method} 建立基线，把复杂方案与简单方案比较，而不是一开始就追求“最先进”。每一次建模都应记录数据来源、处理步骤、参数选择、指标变化和失败原因。这样的记录比单次高分更重要，因为它能帮助学习者把经验迁移到新的任务中。

## 实践节奏
1. 用一页纸写清楚业务问题、可用数据、预期输出和不可接受的风险。
2. 建立最小可运行管线，先让数据从读取、清洗、训练、评估到报告完整跑通。
3. 每次只改变一个因素，例如特征、模型、阈值或验证方式，并记录变化前后的证据。
4. 最后把 ${chapter.output} 整理成可展示作品，说明它解决了什么问题、还有哪些限制、下一步如何改进。

> 判断是否真正掌握本章，不看你能否复述定义，而看你能否用自己的数据复现一条完整证据链，并能解释为什么这个方案值得信任。
`;

const makeChapter = (seed: ChapterSeed): LearningBookChapter => ({
  slug: seed.slug,
  title: seed.title,
  summary: seed.summary,
  estimatedMinutes: seed.minutes,
  difficulty: seed.difficulty,
  goals: [
    `解释 ${seed.focus} 在机器学习项目中的位置`,
    "把概念转化为可执行的数据与建模步骤",
    "用指标和记录说明模型改进是否真实有效",
  ],
  group: seed.group,
  markdown: chapterMarkdown[seed.slug] ?? seed.markdown ?? buildMarkdown(seed),
  checklist: [
    "能写出本章主题的输入、处理、输出和风险",
    "能建立一个最小可运行实验并保存结果",
    "能说明至少一个常见误区及其规避方式",
  ],
  experiments: [
    {
      title: `${seed.title} 小型实证任务`,
      goal: `围绕 ${seed.scenario} 完成一次可复盘的学习实验`,
      steps: [
        "选择一个公开或课堂数据集，写下字段含义和目标问题",
        "完成数据读取、基础检查、处理和一个基线模型或分析流程",
        "记录关键指标、可视化结果、失败原因和下一步改进计划",
      ],
      output: seed.output,
      difficulty: seed.difficulty,
    },
  ],
  glossary: seed.terms.map(([term, definition]) => ({ term, definition })),
  references: seed.references ?? [
    {
      title: `${seed.title} 延伸阅读`,
      source: "可选参考",
      note: "作为课后拓展材料使用，不作为本章学习的必需入口；优先完成页面内的概念、实验和作品产出。",
    },
  ],
});

const chapters: ChapterSeed[] = [
  {
    slug: "overview",
    title: "第1章：机器学习是什么",
    summary: "建立机器学习的整体地图，理解核心定义、三大学习范式、八阶段项目工作流，以及传统编程与机器学习的本质区别。",
    difficulty: "beginner",
    minutes: 35,
    group: "认知篇",
    focus: "机器学习全流程",
    scenario: "校园成绩分析、社团活动预测或学习行为观察",
    method: "问题定义、数据画像、基线建模和结果复盘",
    output: "一张机器学习项目路线图和一个项目选题说明",
    terms: [["样本", "一条可用于分析或训练的记录。"], ["特征", "描述样本的输入信息。"], ["标签", "模型希望预测或解释的目标。"]],
  },
  {
    slug: "math-foundations",
    title: "第2章：K近邻（KNN）",
    summary: "用工程直觉理解向量与矩阵、概率与不确定性、以及如何找到最优解，每一步都配 ML 场景和代码。",
    difficulty: "beginner",
    minutes: 40,
    group: "认知篇",
    focus: "数学基础",
    scenario: "用表格数据解释多个因素如何共同影响一个结果",
    method: "向量化表达、概率估计、损失函数比较和梯度更新演示",
    output: "一份用图示解释梯度下降和损失变化的学习笔记",
    terms: [["向量", "一组有顺序的数，可表示样本特征。"], ["损失函数", "衡量预测与真实结果差距的函数。"], ["梯度", "指示参数调整方向和幅度的信息。"]],
  },
  {
    slug: "python-data-stack",
    title: "第3章：朴素贝叶斯",
    summary: "掌握 ML 项目中最常用的数据读取、清洗、统计和可视化工具——NumPy、Pandas、Matplotlib/Seaborn，让实验可以快速迭代。",
    difficulty: "beginner",
    minutes: 35,
    group: "认知篇",
    focus: "Python 数据分析工具链",
    scenario: "分析一份学生学习行为或课程选择数据表",
    method: "Pandas 数据框操作、统计汇总、缺失检查和图表表达",
    output: "一个可运行的数据探索 Notebook 或脚本",
    terms: [["DataFrame", "带行列索引的二维数据结构。"], ["可视化", "把数据规律转化为图形证据。"], ["探索性分析", "建模前理解数据质量与分布的过程。"]],
  },
  {
    slug: "data-cleaning",
    title: "第4章：决策树",
    summary: "理解缺失值、异常值、重复记录和格式不一致的处理策略，掌握数据偏差的检测方法，建立数据质量治理的系统意识。",
    difficulty: "intermediate",
    minutes: 40,
    group: "认知篇",
    focus: "数据质量治理",
    scenario: "把多来源学习记录整理成可建模的数据集",
    method: "缺失分析、异常检测、字段标准化、数据字典和清洗日志",
    output: "一份清洗前后对比报告和数据字典",
    terms: [["缺失值", "字段没有观测到有效数据的情况。"], ["异常值", "明显偏离常规范围或业务逻辑的记录。"], ["数据泄漏", "训练时使用了预测时不可获得的信息。"]],
  },
  {
    slug: "supervised-learning",
    title: "第5章：随机森林",
    summary: "掌握分类与回归两种核心预测任务，理解数据划分的必要性，建立第一个可运行的基线模型。",
    difficulty: "intermediate",
    minutes: 45,
    group: "监督学习",
    focus: "监督学习",
    scenario: "预测学生是否需要学习支持或估计作业完成时间",
    method: "训练验证划分、逻辑回归、决策树和误差分析",
    output: "一个包含基线模型、指标和误差样例的实验报告",
    terms: [["分类", "预测离散类别的任务。"], ["回归", "预测连续数值的任务。"], ["基线模型", "用于比较复杂方案是否有价值的简单模型。"]],
  },
  {
    slug: "unsupervised-learning",
    title: "第6章：支持向量机（SVM）",
    summary: "在没有标签的情况下发现数据结构，理解聚类和降维如何服务观察、分组和解释。",
    difficulty: "intermediate",
    minutes: 38,
    group: "监督学习",
    focus: "无监督学习",
    scenario: "根据学习行为把学生或资源分成可解释群组",
    method: "标准化、KMeans、PCA、轮廓系数和二维可视化",
    output: "一份群组画像和降维可视化说明",
    terms: [["聚类", "根据相似性自动形成群组。"], ["降维", "用更少维度保留主要信息。"], ["轮廓系数", "衡量聚类紧密度与分离度的指标。"]],
  },
  {
    slug: "model-evaluation",
    title: "第7章：逻辑回归",
    summary: "建立评估意识，理解准确率、召回率、F1、AUC、MAE 等指标与业务目标的关系。",
    difficulty: "intermediate",
    minutes: 42,
    group: "监督学习",
    focus: "模型评估",
    scenario: "比较不同模型对学习风险识别的可靠性",
    method: "混淆矩阵、交叉验证、阈值调节和错误案例分析",
    output: "一个指标选择说明和模型对比表",
    terms: [["召回率", "真实正例中被识别出来的比例。"], ["精确率", "预测为正例中真正正确的比例。"], ["交叉验证", "多次划分数据以评估稳定性的技术。"]],
  },
  {
    slug: "feature-engineering",
    title: "第8章：线性回归",
    summary: "学习如何构造、筛选和解释特征，让模型不只是吃原始字段，而能利用更有意义的信号。",
    difficulty: "intermediate",
    minutes: 44,
    group: "监督学习",
    focus: "特征工程",
    scenario: "从学习日志中提取频率、间隔、趋势和完成质量特征",
    method: "类别编码、时间窗口统计、交互特征和特征重要性分析",
    output: "一份特征清单、构造代码和重要性解释",
    terms: [["编码", "把非数值信息转成模型可处理的表示。"], ["交互特征", "组合多个字段形成的新信号。"], ["特征重要性", "估计特征对预测贡献的指标。"]],
  },
  {
    slug: "ensemble-learning",
    title: "第9章：模型评估",
    summary: "理解多个弱模型如何组合成更强系统，掌握随机森林和梯度提升的适用场景。",
    difficulty: "advanced",
    minutes: 46,
    group: "监督学习",
    focus: "集成学习",
    scenario: "在表格预测任务中提升稳定性并控制过拟合",
    method: "Bagging、Boosting、参数对比、特征重要性和验证曲线",
    output: "一份集成模型与基线模型的对比实验记录",
    terms: [["Bagging", "并行训练多个模型后投票或平均。"], ["Boosting", "按错误逐步强化后续模型。"], ["过拟合", "模型过度记住训练数据而泛化变差。"]],
  },
  {
    slug: "deep-learning",
    title: "第10章：K-Means聚类",
    summary: "从感知机到多层网络理解深度学习，关注表示学习、激活函数、反向传播和训练稳定性。",
    difficulty: "advanced",
    minutes: 50,
    group: "无监督学习",
    focus: "深度学习",
    scenario: "用简单神经网络处理图像、文本或表格表示任务",
    method: "张量表示、网络结构、训练循环、正则化和学习曲线诊断",
    output: "一个小型神经网络训练脚本和学习曲线解读",
    terms: [["张量", "多维数组，是深度学习框架的基本数据结构。"], ["反向传播", "根据损失计算参数梯度的算法。"], ["正则化", "减少过拟合、提升泛化的约束方法。"]],
  },
  {
    slug: "nlp",
    title: "第11章：PCA降维",
    summary: "学习文本如何进入机器学习系统，理解分词、向量化、文本分类、相似度和语义检索。",
    difficulty: "advanced",
    minutes: 45,
    group: "无监督学习",
    focus: "自然语言处理",
    scenario: "分析学生提问、课程反馈或文章摘要数据",
    method: "文本清洗、TF-IDF、嵌入向量、分类器和相似度搜索",
    output: "一个文本分类或语义检索演示项目",
    terms: [["分词", "把文本切成词或子词单元。"], ["嵌入", "把文本映射为向量表示。"], ["语义检索", "按含义而不只按关键词查找内容。"]],
  },
  {
    slug: "computer-vision",
    title: "第12章：强化学习基础",
    summary: "理解图像数据如何表示，掌握分类、检测、分割等视觉任务的基本思路和实验方法。",
    difficulty: "advanced",
    minutes: 48,
    group: "强化学习与深度学习",
    focus: "计算机视觉",
    scenario: "识别课堂板书、实验器材或简单手写图像",
    method: "图像预处理、卷积特征、数据增强、分类评估和错误可视化",
    output: "一个视觉分类实验和误判样例分析",
    terms: [["像素", "图像中最小的颜色或亮度单元。"], ["卷积", "局部滑动提取图像特征的操作。"], ["数据增强", "通过变换扩充训练样本多样性。"]],
  },
  {
    slug: "recommendation-systems",
    title: "第13章：神经网络基础",
    summary: "学习推荐系统如何连接用户行为和资源内容，理解协同过滤、内容推荐和冷启动问题。",
    difficulty: "advanced",
    minutes: 44,
    group: "强化学习与深度学习",
    focus: "推荐系统",
    scenario: "为学生推荐练习、文章、实验或下一步学习主题",
    method: "用户物品矩阵、相似度、排序指标、内容标签和反馈闭环",
    output: "一个学习资源推荐原型和推荐理由说明",
    terms: [["协同过滤", "利用相似用户或物品的行为进行推荐。"], ["冷启动", "新用户或新物品缺少历史数据的问题。"], ["排序", "按相关性或价值排列候选内容。"]],
  },
  {
    slug: "rag",
    title: "第14章：卷积神经网络（CNN）",
    summary: "理解检索增强生成如何把资料库与大模型连接起来，形成可引用、可更新的问答系统。",
    difficulty: "advanced",
    minutes: 46,
    group: "强化学习与深度学习",
    focus: "RAG",
    scenario: "基于课程资料、实验文档或校内知识库构建问答助手",
    method: "文档切分、向量索引、召回排序、上下文组装和答案校验",
    output: "一个带引用片段的课程知识库问答 Demo",
    terms: [["切分", "把长文档拆成可检索片段。"], ["向量索引", "支持相似度搜索的数据结构。"], ["幻觉", "模型生成了缺少依据或错误的信息。"]],
  },
  {
    slug: "mlops",
    title: "第15章：特征工程",
    summary: "把机器学习从一次性实验推进到可复现、可部署、可监控的工程系统。",
    difficulty: "expert",
    minutes: 52,
    group: "核心工具",
    focus: "MLOps",
    scenario: "让一个课堂预测模型能够定期更新并被前端页面调用",
    method: "版本管理、数据校验、训练流水线、模型注册、API 服务和监控",
    output: "一张机器学习上线架构图和最小部署清单",
    terms: [["流水线", "把数据处理、训练、评估、部署串联的流程。"], ["模型漂移", "线上数据分布变化导致效果下降。"], ["监控", "持续观察服务质量、指标和异常。"]],
  },
  {
    slug: "portfolio",
    title: "第16章：损失函数",
    summary: "学习如何把零散练习整理成项目作品，形成可复盘、可演示、可评价的学习成果。",
    difficulty: "expert",
    minutes: 40,
    group: "核心工具",
    focus: "机器学习作品集",
    scenario: "把一个学期的实验整理成个人或班级机器学习项目展",
    method: "项目叙事、代码整理、指标证据、限制说明和演示页面",
    output: "一个包含 README、代码、报告和演示截图的作品集条目",
    terms: [["作品集", "展示能力和成长路径的项目集合。"], ["复盘", "总结目标、过程、证据、问题和改进。"], ["可复现", "他人能按说明重新运行并得到相近结果。"]],
  },
];

export const ML_BOOK: LearningBook = {
  moduleKey: "ml",
  title: "机器学习百科式学习书",
  subtitle: "从数据理解到模型作品的完整成长路径",
  description: "面向信息技术课堂和项目学习的机器学习内置教材，强调概念、实验、证据和作品产出。",
  audience: "适合具备基础 Python 或数据表格经验，准备系统学习机器学习的学生与教师。",
  outcomes: [
    "能独立描述机器学习项目从问题定义到部署复盘的完整流程",
    "能完成至少三个可运行实验，并用指标和图表解释结果",
    "能把一次建模过程整理成可展示、可复现的学习作品",
  ],
  chapters: chapters.map(makeChapter),
};
