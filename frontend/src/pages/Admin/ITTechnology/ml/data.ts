/** 机器学习学习板块内置内容。 */

export type StageStatus = "pending" | "in-progress" | "completed";
export interface RoadmapStage {
  id: string;
  name: string;
  duration: string;
  topics: string[];
  milestones: string[];
  status: StageStatus;
  prerequisites?: string[];
  skills_gained?: string[];
  color?: string;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  children?: KnowledgeNode[];
  description?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  estimated_hours?: number;
  related_chapters?: string[];
}

export interface Experiment {
  name: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  data: string;
  tools: string[];
  skills: string[];
  goal: string;
  estimated_time?: string;
  deliverables?: string;
  steps?: string[];
  code?: string;
  expected_output?: string;
  reflection?: string[];
  download_url?: string;
  data_source?: string;
  dataset_url?: string;
  dataset_format?: string;
  answer_format?: string;
  estimatedMinutes?: number;
  notebookUrl?: string;
}

export interface ToolItem {
  name: string;
  description: string;
  category: string;
  url?: string;
  difficulty?: "beginner" | "intermediate" | "advanced" | "expert";
  best_for?: string;
  pip_install?: string;
  related_experiments?: string[];
  gettingStarted?: string;
  pricing?: string;
}

export interface ResourceItem {
  title: string;
  type: "book" | "course" | "paper" | "website" | "competition" | "community" | "github" | "video" | "blog";
  description: string;
  url: string;
  rating?: number;
  difficulty_level?: "beginner" | "intermediate" | "advanced" | "expert";
  best_for?: string;
  author?: string;
  language?: string;
}

export const ROADMAP_STAGES: RoadmapStage[] = [
  // ── 阶段一：基础认知与工具 ──────────────────────────────
  {
    id: "fundamentals",
    name: "基础认知与工具",
    duration: "4-6 周",
    topics: [
      "机器学习全景图：监督/无监督/强化学习三大范式，典型应用场景与产业地图",
      "线性代数核心：向量、矩阵运算、特征值与特征向量、奇异值分解 (SVD) 的几何直觉",
      "概率论基础：随机变量、条件概率、贝叶斯定理、常见分布（高斯/伯努利/多项式）",
      "统计学入门：描述性统计、抽样分布、置信区间、假设检验与 p 值直觉",
      "微积分与优化直觉：导数与梯度、偏导数、链式法则、梯度下降的几何与代数解释",
      "Python 编程强化：列表推导式、函数式编程、面向对象基础、异常处理与类型标注",
      "NumPy 深度掌握：ndarray 创建与广播机制、向量化运算、线性代数模块、随机数生成",
      "Pandas 数据工程：Series/DataFrame 操作、分组聚合、透视表、缺失值处理、时间序列基础",
      "Matplotlib 与 Seaborn 可视化：折线/散点/柱状/箱线/热力图，面向分析的可视化叙事",
      "Jupyter 工作流：Notebook 最佳实践、魔法命令、交互式控件、版本管理与导出",
    ],
    milestones: [
      "独立完成一个数据集的完整探索分析 (EDA)，含统计描述与可视化图表",
      "用 NumPy 从零实现梯度下降，可视化损失函数下降过程",
      "掌握 Jupyter Notebook 高效工作流，能在一个 Notebook 中完成读取、清洗、可视化和基础建模",
      "能用自己的话向非技术听众解释「什么是机器学习」及其三种学习范式",
    ],
    status: "pending",
    prerequisites: [],
    skills_gained: [
      "Python 数据处理与向量化编程能力",
      "用线性代数和概率论语言描述数据与模型",
      "数据可视化叙事与探索性分析思维",
      "Jupyter 交互式实验工作流",
    ],
  },

  // ── 阶段二：核心算法入门 ────────────────────────────────
  {
    id: "core-algorithms",
    name: "核心算法入门",
    duration: "8-12 周",
    topics: [
      "线性回归：最小二乘法、梯度下降求解、正则化（L1 Lasso / L2 Ridge / ElasticNet）、残差分析与模型诊断",
      "逻辑回归：从线性到概率的 Sigmoid 映射、对数似然损失、决策边界可视化、多分类扩展 (One-vs-Rest / Softmax)",
      "决策树：信息增益与基尼不纯度、CART 剪枝策略、可解释性优势与过拟合风险",
      "K 近邻 (KNN)：距离度量选择（欧氏/曼哈顿/余弦）、K 值影响、维度灾难与特征缩放必要性",
      "朴素贝叶斯：条件独立性假设、高斯/多项式/伯努利变体、在文本分类中的经典应用",
      "支持向量机 (SVM)：最大间隔超平面、核技巧 (RBF/多项式)、软间隔与正则化参数 C",
      "K-Means 聚类：肘部法则选择 K 值、初始化敏感性 (K-Means++)、轮廓系数评估聚类质量",
      "DBSCAN 密度聚类：核心点与边界点、噪声识别、与 K-Means 的适用场景对比",
      "主成分分析 (PCA)：协方差矩阵特征分解、方差解释率、降维可视化与去噪应用",
      "t-SNE 与 UMAP：流形学习降维、困惑度/邻居数调参与高维数据可视化最佳实践",
    ],
    milestones: [
      "用 Scikit-learn 完成至少 5 种算法的分类/回归实验，并对比性能",
      "理解并可视化 K-Means 和 DBSCAN 在同一数据集上的聚类差异",
      "用 PCA 将高维数据降至 2 维并可视化，解释各主成分的含义",
      "独立完成数据预处理流水线（缺失值填充、编码、标准化、划分）并避免数据泄漏",
      "能向同伴清晰解释「偏差-方差权衡」并用验证曲线展示",
    ],
    status: "pending",
    prerequisites: ["基础认知与工具"],
    skills_gained: [
      "独立完成分类与回归建模全流程",
      "根据数据特点选择合适的算法并给出理由",
      "聚类分析与降维可视化的工程能力",
      "用交叉验证和指标选择来诊断模型问题",
    ],
  },

  // ── 阶段三：模型进阶与评估 ──────────────────────────────
  {
    id: "advanced-ml",
    name: "模型进阶与评估",
    duration: "8-12 周",
    topics: [
      "集成学习原理：Bagging（方差缩减）与 Boosting（偏差缩减）的统计学直觉与证明思路",
      "随机森林深度：Bootstrap 采样、特征随机子空间、OOB 误差估计、特征重要性排序",
      "梯度提升框架：GBDT 残差拟合原理、XGBoost 的正则化目标与列块并行、LightGBM 的 GOSS 与 EFB",
      "CatBoost：有序目标编码与对称树，处理类别特征和高基数变量的最佳实践",
      "Stacking 与 Blending：多层模型融合策略、元学习器选择与过拟合风险控制",
      "模型评估体系：混淆矩阵、精确率/召回率/F1、ROC-AUC、PR 曲线、对数损失——何时用哪一个",
      "回归评估指标：MAE/MSE/RMSE/R-squared/MAPE，残差分布分析与异方差检测",
      "交叉验证策略：K-Fold/Stratified/Group/TimeSeries Split，嵌套交叉验证用于模型选择",
      "特征工程系统方法：数值特征变换（分箱/对数/标准化）、类别编码（One-Hot/Label/Target/Count）、时间特征构造",
      "特征选择三板斧：Filter（方差/卡方/互信息）、Wrapper（RFE）、Embedded（L1/树模型重要性）",
    ],
    milestones: [
      "用 XGBoost/LightGBM 在表格数据上超越基线模型 10%+ 指标提升",
      "能画出混淆矩阵和多阈值下的精确率-召回率曲线并解读",
      "独立完成一个包含 20+ 特征的完整特征工程方案并验证提升效果",
      "用嵌套交叉验证完成一次严谨的模型选择，写出选择理由",
      "提交一个 Kaggle 表格竞赛并进入前 50% 排名",
    ],
    status: "pending",
    prerequisites: ["基础认知与工具", "核心算法入门"],
    skills_gained: [
      "集成学习算法选型与调参能力",
      "多维度模型评估与指标驱动的决策能力",
      "系统化特征工程方法论",
      "Kaggle 竞赛实战经验",
    ],
  },

  // ── 阶段四：深度学习与前沿 ──────────────────────────────
  {
    id: "deep-learning",
    name: "深度学习与前沿",
    duration: "12-16 周",
    topics: [
      "神经网络基础：感知机模型、多层感知机 (MLP)、激活函数对比（ReLU/GELU/Swish）、Xavier/He 初始化原理",
      "反向传播与自动微分：计算图构建、链式法则的工程实现、PyTorch autograd 机制与钩子函数",
      "优化器演进：SGD/Momentum/AdaGrad/RMSProp/Adam/AdamW，学习率调度策略（Cosine/Warmup/Cyclic）",
      "卷积神经网络 (CNN)：卷积核/池化/感受野、经典架构（AlexNet/VGG/ResNet）、BatchNorm 与跳连",
      "循环神经网络与序列建模：RNN/LSTM/GRU 的门控机制、梯度消失与爆炸、双向与深层 RNN",
      "注意力机制与 Transformer：自注意力的 Query-Key-Value 推导、多头注意力、位置编码（正弦/可学习/RoPE）",
      "预训练与迁移学习：ImageNet 预训练权重迁移、微调策略（全量/逐层/冻结）、领域自适应",
      "生成对抗网络 (GAN)：生成器与判别器的博弈训练、DCGAN/WGAN/CycleGAN、模式坍塌与训练稳定性",
      "扩散模型原理：前向加噪与反向去噪、DDPM/DDIM 采样、Stable Diffusion 的潜在空间扩散",
      "图神经网络入门：图卷积 (GCN)、消息传递框架、节点分类与链路预测应用场景",
    ],
    milestones: [
      "用 PyTorch 从零搭建并训练 MLP/CNN/RNN 三种架构，理解各自的适用场景",
      "在 CIFAR-10/CIFAR-100 上使用迁移学习达到 85%+ 准确率",
      "实现一个迷你 Transformer 并在文本分类任务上验证注意力可视化",
      "训练一个简单的 GAN 生成手写数字或人脸，解决模式坍塌问题",
      "能画出训练过程中的损失曲线和学习率曲线，诊断过拟合/欠拟合",
    ],
    status: "pending",
    prerequisites: ["基础认知与工具", "核心算法入门", "模型进阶与评估"],
    skills_gained: [
      "PyTorch 框架的熟练使用与调试能力",
      "主流神经网络架构的设计与训练能力",
      "迁移学习与预训练模型的应用能力",
      "训练过程诊断与超参数调优的工程直觉",
    ],
  },

  // ── 阶段五：工程实践与作品 ──────────────────────────────
  {
    id: "engineering-practice",
    name: "工程实践与作品",
    duration: "8-12 周",
    topics: [
      "MLOps 全生命周期：从数据版本管理 (DVC) 到实验追踪 (MLflow/W&B)，再到模型注册与流水线编排",
      "模型部署策略：Flask/FastAPI REST API、ONNX 跨框架导出、TensorRT 推理优化、批处理与实时服务",
      "大模型推理优化：vLLM PagedAttention、Continuous Batching、量化部署 (GPTQ/AWQ/GGUF)、投机采样",
      "RAG 系统设计与实现：文档解析与智能切分策略、Embedding 模型选型、混合检索（关键词+向量）、重排序与引用溯源",
      "Agent 系统架构：ReAct/Plan-Execute 范式、工具定义与调用 (Function Calling / MCP 协议)、记忆管理与上下文窗口优化",
      "高效微调工程：LoRA/QLoRA 原理与实践、适配器注入策略、灾难性遗忘缓解、模型合并 (Model Merging)",
      "容器化与编排：Docker 镜像构建最佳实践、GPU 容器配置、Kubernetes 基础与模型服务自动扩缩容",
      "模型监控与反馈闭环：数据漂移与概念漂移检测、模型性能退化告警、A/B 测试框架与在线评估",
      "LLM 应用评估：RAGAS 评估框架、人工评估与自动评估的权衡、幻觉检测与事实一致性校验",
      "作品集构建：项目叙事与可视化、README 工程文档规范、演示 Demo 与复盘报告、GitHub Profile 优化",
    ],
    milestones: [
      "搭建一个完整的 RAG 知识库问答系统，包含前端交互与 API 服务",
      "用 LoRA/QLoRA 微调一个开源 LLM 并在领域任务上验证效果提升",
      "将至少一个 ML 模型容器化部署到云服务器，提供可访问的 API",
      "建立 MLflow/W&B 实验管理体系，能回溯任意一次实验的完整配置与结果",
      "整理并发布 3+ 个完整的 ML 作品到 GitHub，含 README/代码/报告/演示",
    ],
    status: "pending",
    prerequisites: ["基础认知与工具", "核心算法入门", "模型进阶与评估", "深度学习与前沿"],
    skills_gained: [
      "ML 模型从实验到上线的完整工程能力",
      "RAG 系统与 Agent 系统的架构设计能力",
      "大模型微调与推理优化的实践经验",
      "可复现的 MLOps 工作流与模型监控思维",
      "专业作品集展示与技术写作能力",
    ],
  },
];

export const KNOWLEDGE_TREE: KnowledgeNode[] = [
  // ── 1. 数学基础 ────────────────────────────────────────
  {
    id: "math",
    label: "数学基础",
    description: "机器学习所需的数学理论与工具，是所有算法的共同语言",
    difficulty: "beginner",
    related_chapters: ["math-foundations"],
    children: [
      {
        id: "linear-algebra",
        label: "线性代数",
        description: "向量、矩阵、张量运算，特征分解与奇异值分解 (SVD)，投影与最小二乘法的几何直观",
        difficulty: "beginner",
        estimated_hours: 20,
        related_chapters: ["math-foundations"],
      },
      {
        id: "probability",
        label: "概率论与统计",
        description: "随机变量、条件概率、贝叶斯定理、常见分布族（高斯/伯努利/指数族）、期望与方差",
        difficulty: "beginner",
        estimated_hours: 18,
        related_chapters: ["math-foundations"],
      },
      {
        id: "calculus",
        label: "微积分",
        description: "单变量/多变量导数、偏导数与梯度、链式法则、泰勒展开、积分在期望与熵中的应用",
        difficulty: "beginner",
        estimated_hours: 14,
        related_chapters: ["math-foundations"],
      },
      {
        id: "optimization",
        label: "最优化方法",
        description: "梯度下降及其变体（SGD/Momentum/Adam）、凸优化基础、拉格朗日乘子法与约束优化、对偶问题",
        difficulty: "intermediate",
        estimated_hours: 16,
        related_chapters: ["math-foundations", "deep-learning"],
      },
      {
        id: "information-theory",
        label: "信息论",
        description: "熵、交叉熵、KL 散度、互信息——理解损失函数设计与决策树分裂的数学基础",
        difficulty: "intermediate",
        estimated_hours: 10,
        related_chapters: ["math-foundations", "supervised-learning"],
      },
      {
        id: "statistical-inference",
        label: "统计推断",
        description: "参数估计（MLE/MAP）、置信区间构建、自助法 (Bootstrap)、贝叶斯推断与共轭先验",
        difficulty: "intermediate",
        estimated_hours: 14,
        related_chapters: ["math-foundations", "model-evaluation"],
      },
      {
        id: "numerical-methods",
        label: "数值计算方法",
        description: "浮点精度与数值稳定性、迭代求解器、稀疏矩阵运算、自动微分的数值实现原理",
        difficulty: "intermediate",
        estimated_hours: 12,
        related_chapters: ["math-foundations", "deep-learning"],
      },
    ],
  },

  // ── 2. 编程工具 ────────────────────────────────────────
  {
    id: "programming",
    label: "编程工具",
    description: "机器学习开发必备工具链，从数据处理到模型构建的工程基础设施",
    difficulty: "beginner",
    related_chapters: ["python-data-stack"],
    children: [
      {
        id: "python",
        label: "Python 编程",
        description: "面向对象与函数式编程、类型标注 (Type Hints)、上下文管理器、装饰器、并发编程基础",
        difficulty: "beginner",
        estimated_hours: 24,
        related_chapters: ["python-data-stack"],
      },
      {
        id: "numpy",
        label: "NumPy",
        description: "多维数组与广播机制、向量化运算与通用函数 (ufunc)、线性代数模块、随机数生成与种子控制",
        difficulty: "beginner",
        estimated_hours: 14,
        related_chapters: ["python-data-stack"],
      },
      {
        id: "pandas",
        label: "Pandas",
        description: "DataFrame/Series 操作、分组聚合与透视表、多表连接与合并、时间序列处理与窗口函数",
        difficulty: "beginner",
        estimated_hours: 16,
        related_chapters: ["python-data-stack", "data-cleaning"],
      },
      {
        id: "matplotlib",
        label: "Matplotlib / Seaborn",
        description: "面向对象式画图、子图布局与自定义样式、面向分析的可视化类型选择、交互式可视化 (Plotly)",
        difficulty: "beginner",
        estimated_hours: 12,
        related_chapters: ["python-data-stack"],
      },
      {
        id: "scikit-learn-basics",
        label: "Scikit-learn 核心API",
        description: "统一的 fit/predict/transform 接口、Pipeline 与 ColumnTransformer 流水线、模型持久化与版本管理",
        difficulty: "beginner",
        estimated_hours: 10,
        related_chapters: ["python-data-stack", "supervised-learning"],
      },
      {
        id: "jupyter-ecosystem",
        label: "Jupyter 生态与 VS Code",
        description: "Notebook/Lab 高效工作流、IPython 魔法命令、交互式控件 (ipywidgets)、VS Code Python 调试与远程开发",
        difficulty: "beginner",
        estimated_hours: 8,
        related_chapters: ["python-data-stack"],
      },
      {
        id: "git-ml-workflow",
        label: "Git 与 ML 版本管理",
        description: "Git 分支策略与协作流程、数据版本控制 (DVC)、模型与实验的版本追溯、.gitignore 与大文件管理 (Git LFS)",
        difficulty: "beginner",
        estimated_hours: 8,
        related_chapters: ["portfolio"],
      },
    ],
  },

  // ── 3. 经典机器学习 ─────────────────────────────────────
  {
    id: "classic-ml",
    label: "经典机器学习",
    description: "传统机器学习算法体系，覆盖监督学习、无监督学习、集成方法和特征工程",
    difficulty: "intermediate",
    related_chapters: ["supervised-learning", "unsupervised-learning", "model-evaluation", "feature-engineering", "ensemble-learning"],
    children: [
      {
        id: "supervised",
        label: "监督学习",
        description: "有标签数据上的预测建模——分类与回归的核心算法族",
        difficulty: "intermediate",
        related_chapters: ["supervised-learning"],
        children: [
          { id: "regression", label: "回归 (线性/多项式/Ridge/Lasso)", description: "从最小二乘法到正则化回归，残差分析与模型诊断", difficulty: "intermediate", estimated_hours: 14, related_chapters: ["supervised-learning"] },
          { id: "classification", label: "分类 (逻辑回归/SVM/决策树)", description: "线性分类器与非线性决策边界，概率校准与阈值选择", difficulty: "intermediate", estimated_hours: 16, related_chapters: ["supervised-learning"] },
          { id: "knn", label: "K 近邻 (KNN)", description: "基于实例的非参数方法，距离度量选择与维度灾难的实战应对", difficulty: "beginner", estimated_hours: 6, related_chapters: ["supervised-learning"] },
          { id: "naive-bayes", label: "朴素贝叶斯", description: "条件独立性假设与贝叶斯推断，文本分类与垃圾邮件过滤的经典选择", difficulty: "beginner", estimated_hours: 6, related_chapters: ["supervised-learning"] },
        ],
      },
      {
        id: "unsupervised",
        label: "无监督学习",
        description: "无标签数据中的结构发现——聚类、降维与密度估计",
        difficulty: "intermediate",
        related_chapters: ["unsupervised-learning"],
        children: [
          { id: "clustering", label: "聚类 (K-Means/DBSCAN/层次聚类)", description: "基于距离、密度和层次的三种聚类范式，评估指标与可视化", difficulty: "intermediate", estimated_hours: 12, related_chapters: ["unsupervised-learning"] },
          { id: "dim-reduction", label: "降维 (PCA/t-SNE/UMAP)", description: "线性与流形降维方法，方差保留与局部结构保持的权衡", difficulty: "intermediate", estimated_hours: 10, related_chapters: ["unsupervised-learning"] },
          { id: "association", label: "关联规则 (Apriori/FP-Growth)", description: "频繁项集挖掘与关联规则生成，支持度/置信度/提升度的工程理解", difficulty: "intermediate", estimated_hours: 6, related_chapters: ["unsupervised-learning"] },
          { id: "anomaly-detection", label: "异常检测 (Isolation Forest/LOF)", description: "孤立森林与局部异常因子，在不平衡场景中识别离群点的统计方法", difficulty: "intermediate", estimated_hours: 8, related_chapters: ["unsupervised-learning"] },
        ],
      },
      {
        id: "ensemble",
        label: "集成学习",
        description: "将多个弱学习器组合为强系统的策略与工程实践",
        difficulty: "advanced",
        related_chapters: ["ensemble-learning"],
        children: [
          { id: "bagging", label: "Bagging (随机森林/ExtraTrees)", description: "Bootstrap 采样与并行训练，方差缩减与 OOB 误差估计", difficulty: "intermediate", estimated_hours: 8, related_chapters: ["ensemble-learning"] },
          { id: "boosting", label: "Boosting (XGBoost/LightGBM/CatBoost)", description: "序贯纠错与梯度提升框架，三大主流库的差异化特性与选型指南", difficulty: "advanced", estimated_hours: 14, related_chapters: ["ensemble-learning"] },
          { id: "stacking", label: "Stacking / Blending", description: "多层模型融合与元学习器设计，过拟合风险控制与时间序列场景的注意事项", difficulty: "advanced", estimated_hours: 6, related_chapters: ["ensemble-learning"] },
        ],
      },
      {
        id: "feature-eng",
        label: "特征工程",
        description: "从原始数据中构造、选择和组织高质量模型输入的系统方法论",
        difficulty: "intermediate",
        estimated_hours: 16,
        related_chapters: ["feature-engineering", "data-cleaning"],
      },
      {
        id: "imbalanced-learning",
        label: "不平衡学习",
        description: "类别不平衡的采样策略（SMOTE/ADASYN/TomekLinks）、代价敏感学习与阈值移动",
        difficulty: "intermediate",
        estimated_hours: 8,
        related_chapters: ["model-evaluation", "supervised-learning"],
      },
      {
        id: "model-interpretation",
        label: "模型可解释性",
        description: "SHAP 值与特征归因、LIME 局部解释、部分依赖图 (PDP) 与累积局部效应 (ALE)",
        difficulty: "intermediate",
        estimated_hours: 10,
        related_chapters: ["model-evaluation", "feature-engineering"],
      },
    ],
  },

  // ── 4. 深度学习 ────────────────────────────────────────
  {
    id: "deep-learning-top",
    label: "深度学习",
    description: "深度神经网络技术，从基础感知机到现代架构的完整体系",
    difficulty: "advanced",
    related_chapters: ["deep-learning", "computer-vision", "nlp"],
    children: [
      {
        id: "cnn",
        label: "CNN 与视觉模型",
        description: "卷积核/池化/感受野，经典架构演进 (LeNet/AlexNet/VGG/ResNet/EfficientNet)，BatchNorm 与跳连",
        difficulty: "advanced",
        estimated_hours: 20,
        related_chapters: ["deep-learning", "computer-vision"],
      },
      {
        id: "rnn",
        label: "RNN / LSTM / GRU",
        description: "循环网络的门控机制、梯度消失与爆炸的根本原因及应对、双向与深层架构、序列标注与生成",
        difficulty: "advanced",
        estimated_hours: 16,
        related_chapters: ["deep-learning", "nlp"],
      },
      {
        id: "transformer",
        label: "Transformer 架构",
        description: "自注意力的 QKV 推导、多头机制、位置编码方案演进（正弦/可学习/RoPE）、Encoder-Decoder 与 Decoder-Only 范式",
        difficulty: "advanced",
        estimated_hours: 22,
        related_chapters: ["deep-learning", "nlp"],
      },
      {
        id: "gan-diffusion",
        label: "GAN 与扩散模型",
        description: "对抗训练的博弈论视角、WGAN 与梯度惩罚、DDPM/DDIM 去噪扩散、潜在空间扩散 (Latent Diffusion)",
        difficulty: "advanced",
        estimated_hours: 18,
        related_chapters: ["deep-learning"],
      },
      {
        id: "vae",
        label: "变分自编码器 (VAE)",
        description: "编码器-解码器结构与重参数化技巧、ELBO 推导、潜在空间插值与属性编辑、VQ-VAE 离散表示",
        difficulty: "advanced",
        estimated_hours: 12,
        related_chapters: ["deep-learning"],
      },
      {
        id: "transfer-learning",
        label: "迁移学习与域适应",
        description: "预训练特征提取与微调策略 (全量/逐层/冻结)、域偏移检测与对抗域适应、少样本学习 (Few-shot)",
        difficulty: "advanced",
        estimated_hours: 14,
        related_chapters: ["deep-learning", "computer-vision"],
      },
      {
        id: "self-supervised",
        label: "自监督学习",
        description: "对比学习 (SimCLR/MoCo/SimSiam)、掩码自编码器 (MAE)、文本自监督 (MLM/NSP)——从无标签数据中学习表示",
        difficulty: "advanced",
        estimated_hours: 16,
        related_chapters: ["deep-learning"],
      },
      {
        id: "graph-neural",
        label: "图神经网络 (GNN)",
        description: "图卷积 (GCN)、消息传递框架 (MPNN)、GraphSAGE 归纳式学习、GAT 注意力聚合与分子/社交网络应用",
        difficulty: "advanced",
        estimated_hours: 14,
        related_chapters: ["deep-learning"],
      },
    ],
  },

  // ── 5. 大语言模型 ──────────────────────────────────────
  {
    id: "llm-top",
    label: "大语言模型",
    description: "预训练大模型与构建 LLM 应用的完整技术栈",
    difficulty: "advanced",
    related_chapters: ["nlp", "rag"],
    children: [
      {
        id: "llm",
        label: "LLM 架构原理",
        description: "GPT 系列自回归解码、LLaMA 架构优化（RoPE/SwiGLU/RMSNorm）、Qwen/ChatGLM/DeepSeek 等国产模型的设计哲学",
        difficulty: "advanced",
        estimated_hours: 20,
        related_chapters: ["nlp", "rag"],
      },
      {
        id: "rag",
        label: "RAG 检索增强生成",
        description: "文档解析与语义切分、Embedding 模型选型与对比、混合检索策略（稀疏+稠密）、重排序 (Reranker) 与引用溯源",
        difficulty: "advanced",
        estimated_hours: 18,
        related_chapters: ["rag"],
      },
      {
        id: "finetune",
        label: "高效微调",
        description: "LoRA/QLoRA 低秩适配原理、Adapter/Prefix-Tuning/Prompt-Tuning 对比、全参微调的资源规划与灾难性遗忘缓解",
        difficulty: "advanced",
        estimated_hours: 16,
        related_chapters: ["mlops"],
      },
      {
        id: "prompt",
        label: "提示工程",
        description: "System/User/Assistant 角色设计、Chain-of-Thought/Tree-of-Thought 推理引导、In-Context Learning 与少样本示例选择策略",
        difficulty: "intermediate",
        estimated_hours: 10,
        related_chapters: ["nlp", "rag"],
      },
      {
        id: "agent",
        label: "AI Agent 系统",
        description: "ReAct/Plan-Execute/Reflection 范式对比、Function Calling 与 MCP 协议、工具编排与沙箱、长期记忆与会话管理",
        difficulty: "advanced",
        estimated_hours: 20,
        related_chapters: ["rag", "mlops"],
      },
      {
        id: "alignment",
        label: "对齐与安全",
        description: "RLHF/DPO/KTO 偏好对齐算法推导、奖励模型训练与合成数据、红队测试方法论与越狱防御策略",
        difficulty: "advanced",
        estimated_hours: 16,
        related_chapters: ["mlops"],
      },
      {
        id: "tokenization",
        label: "分词与词汇表",
        description: "BPE/WordPiece/SentencePiece/Unigram 分词算法对比、词汇表大小对训练与推理的影响、多语言分词的特殊处理",
        difficulty: "advanced",
        estimated_hours: 8,
        related_chapters: ["nlp"],
      },
      {
        id: "inference-optimization",
        label: "推理优化",
        description: "KV Cache 原理与量化、投机采样 (Speculative Decoding)、Continuous Batching、Flash Attention 与内存高效的注意力",
        difficulty: "advanced",
        estimated_hours: 14,
        related_chapters: ["mlops"],
      },
      {
        id: "llm-evaluation",
        label: "LLM 评估体系",
        description: "通用基准 (MMLU/HellaSwag/HumanEval)、领域评估 (C-Eval/CMMLU)、RAGAS/DeepEval 框架、人类偏好评估与竞技场排名",
        difficulty: "advanced",
        estimated_hours: 12,
        related_chapters: ["model-evaluation", "rag"],
      },
    ],
  },

  // ── 6. 多模态与生成 ────────────────────────────────────
  {
    id: "multimodal-top",
    label: "多模态与生成",
    description: "跨模态学习——让模型理解文本、图像、视频、音频的联合表示",
    difficulty: "advanced",
    related_chapters: ["computer-vision", "nlp"],
    children: [
      {
        id: "vision-lang",
        label: "视觉语言模型 (VLM)",
        description: "CLIP/SigLIP 对比预训练、BLIP-2 Q-Former 桥梁架构、LLaVA/Qwen-VL/InternVL 的多模态指令微调与评估",
        difficulty: "advanced",
        estimated_hours: 18,
        related_chapters: ["computer-vision", "nlp"],
      },
      {
        id: "diffusion",
        label: "文生图与视频生成",
        description: "Stable Diffusion 潜在扩散管道、ControlNet/IP-Adapter 可控生成、DiT/Sora 扩散 Transformer 与视频生成的时空建模",
        difficulty: "advanced",
        estimated_hours: 16,
        related_chapters: ["computer-vision"],
      },
      {
        id: "speech",
        label: "语音与音频",
        description: "Whisper/Conformer 语音识别管道、VALL-E/CosyVoice 零样本语音合成、CLAP 音频-文本联合表示与音乐生成",
        difficulty: "advanced",
        estimated_hours: 14,
        related_chapters: ["nlp"],
      },
      {
        id: "video-generation",
        label: "视频理解与生成",
        description: "Video-LLaMA/VideoChat 视频问答架构、时间注意力与帧采样策略、动作识别、视频字幕与密集描述",
        difficulty: "advanced",
        estimated_hours: 16,
        related_chapters: ["computer-vision"],
      },
      {
        id: "cross-modal-retrieval",
        label: "跨模态检索",
        description: "图文互搜 (CLIP 嵌入空间)、文本检索视频片段、多模态 Embedding 索引构建与大规模近似最近邻搜索",
        difficulty: "advanced",
        estimated_hours: 12,
        related_chapters: ["computer-vision", "rag"],
      },
      {
        id: "3d-generation",
        label: "3D 内容生成",
        description: "NeRF/3D Gaussian Splatting 场景表示、文本到 3D (DreamFusion/InstantMesh)、多视角一致性与可微分渲染",
        difficulty: "advanced",
        estimated_hours: 14,
        related_chapters: ["computer-vision"],
      },
    ],
  },

  // ── 7. AI 前沿方向 ─────────────────────────────────────
  {
    id: "frontier-top",
    label: "AI 前沿方向",
    description: "推动机器学习能力边界的前沿研究领域与新兴范式",
    difficulty: "advanced",
    related_chapters: [],
    children: [
      {
        id: "rl",
        label: "强化学习",
        description: "MDP 与 Bellman 方程、Q-Learning/DQN 值函数方法、PPO/TRPO 策略梯度、多智能体强化学习与自博弈 (Self-Play)",
        difficulty: "advanced",
        estimated_hours: 24,
        related_chapters: [],
      },
      {
        id: "federated",
        label: "联邦学习",
        description: "FedAvg 联邦平均算法、差分隐私与安全聚合、Non-IID 数据挑战与个性化联邦学习、横向/纵向/迁移联邦架构",
        difficulty: "advanced",
        estimated_hours: 14,
        related_chapters: ["mlops"],
      },
      {
        id: "automl",
        label: "AutoML 与神经架构搜索",
        description: "超参数自动优化 (Optuna/Hyperopt)、NAS (ENAS/DARTS/Once-for-All)、自动特征工程与全自动 ML 流水线 (AutoGluon/H2O)",
        difficulty: "advanced",
        estimated_hours: 12,
        related_chapters: ["model-evaluation"],
      },
      {
        id: "xai",
        label: "可解释 AI (XAI)",
        description: "SHAP 博弈论归因与 TreeSHAP、LIME 局部代理模型、积分梯度与注意力权重可视化、反事实解释与因果可解释性",
        difficulty: "advanced",
        estimated_hours: 14,
        related_chapters: ["model-evaluation", "feature-engineering"],
      },
      {
        id: "causal-ml",
        label: "因果机器学习",
        description: "相关 vs 因果的根本区别、do-演算与结构因果模型 (SCM)、双重机器学习 (Double ML)、工具变量与断点回归",
        difficulty: "advanced",
        estimated_hours: 18,
        related_chapters: ["feature-engineering"],
      },
      {
        id: "continual-learning",
        label: "持续学习",
        description: "灾难性遗忘的神经科学启发、弹性权重巩固 (EWC)、记忆回放与动态架构、持续预训练 (CPT) 与知识编辑",
        difficulty: "advanced",
        estimated_hours: 14,
        related_chapters: ["mlops"],
      },
      {
        id: "neuro-symbolic",
        label: "神经符号 AI",
        description: "神经网络与符号推理的融合路径、可微分逻辑编程、知识图谱推理与规则学习、数学定理证明的深度学习增强",
        difficulty: "advanced",
        estimated_hours: 16,
        related_chapters: [],
      },
    ],
  },

  // ── 8. 工程部署 ────────────────────────────────────────
  {
    id: "engineering",
    label: "工程部署",
    description: "将 ML 模型从实验环境推向生产系统的全流程工程实践",
    difficulty: "advanced",
    related_chapters: ["mlops", "portfolio"],
    children: [
      {
        id: "mlops",
        label: "MLOps",
        description: "MLflow 实验追踪与模型注册、Kubeflow 流水线编排、特征存储 (Feast/Tecton) 与数据版本管理 (DVC)",
        difficulty: "advanced",
        estimated_hours: 18,
        related_chapters: ["mlops"],
      },
      {
        id: "optimization-ml",
        label: "模型优化与压缩",
        description: "量化 (GPTQ/AWQ/GGUF) 与精度校准、知识蒸馏 (Logit/Feature/Relation-based)、剪枝 (结构化/非结构化) 与神经架构搜索",
        difficulty: "advanced",
        estimated_hours: 16,
        related_chapters: ["mlops"],
      },
      {
        id: "deploy",
        label: "模型部署与服务化",
        description: "FastAPI/gRPC 推理服务构建、ONNX 与 TensorRT 推理加速、vLLM/SGLang 大模型推理引擎、Serverless 部署与冷启动优化",
        difficulty: "advanced",
        estimated_hours: 20,
        related_chapters: ["mlops", "portfolio"],
      },
      {
        id: "vector-db",
        label: "向量数据库",
        description: "Chroma 原型开发 / Qdrant 高性能过滤 / Milvus 分布式规模、近似最近邻索引 (HNSW/IVF/PQ)、向量 + 标量混合查询",
        difficulty: "intermediate",
        estimated_hours: 12,
        related_chapters: ["rag"],
      },
      {
        id: "monitoring",
        label: "模型监控与告警",
        description: "数据漂移与概念漂移检测 (Evidently AI/Whylogs)、性能退化自动告警、影子部署与 A/B 测试统计显著性、在线评估指标",
        difficulty: "advanced",
        estimated_hours: 14,
        related_chapters: ["mlops", "model-evaluation"],
      },
      {
        id: "ci-cd-ml",
        label: "ML CI/CD 流水线",
        description: "GitHub Actions/Jenkins ML 自动化、模型测试（正确性/鲁棒性/公平性）、自动回滚机制、GitOps for ML 最佳实践",
        difficulty: "advanced",
        estimated_hours: 12,
        related_chapters: ["mlops"],
      },
      {
        id: "feature-store",
        label: "特征平台",
        description: "在线/离线特征一致性保障、特征复用与血缘追踪、点查延迟优化与批量特征回填、Feast/Tecton 选型对比",
        difficulty: "advanced",
        estimated_hours: 10,
        related_chapters: ["feature-engineering", "mlops"],
      },
    ],
  },

  // ── 9. 基础设施 ────────────────────────────────────────
  {
    id: "infra",
    label: "基础设施",
    description: "支撑大规模机器学习训练与推理的底层计算与数据基础设施",
    difficulty: "advanced",
    related_chapters: ["mlops"],
    children: [
      {
        id: "gpu-compute",
        label: "GPU 计算与 CUDA",
        description: "CUDA 编程模型（线程层次/共享内存/流）、cuDNN/cuBLAS 算子库、GPU 显存管理与碎片化、混合精度训练 (AMP/FP16/BF16)",
        difficulty: "advanced",
        estimated_hours: 20,
        related_chapters: ["mlops"],
      },
      {
        id: "data-eng",
        label: "数据工程",
        description: "Apache Spark/Ray 分布式数据处理、数据湖/湖仓一体架构、流式数据管道 (Kafka/Flink)、数据质量与 Schema 演化治理",
        difficulty: "advanced",
        estimated_hours: 18,
        related_chapters: ["data-cleaning", "mlops"],
      },
      {
        id: "experiment",
        label: "实验管理",
        description: "W&B/MLflow/Neptune 实验追踪对比、超参搜索策略（Bayesian/TPE/Hyperband）、实验文档与可复现性清单、随机种子与消融实验规范",
        difficulty: "intermediate",
        estimated_hours: 10,
        related_chapters: ["model-evaluation", "mlops"],
      },
      {
        id: "distributed-training",
        label: "分布式训练",
        description: "数据并行 (DDP/FSDP) 与模型并行 (Tensor/Pipeline/Sequence Parallelism)、DeepSpeed ZeRO 优化器状态分片、Megatron-LM 与 3D 并行",
        difficulty: "advanced",
        estimated_hours: 20,
        related_chapters: ["mlops"],
      },
      {
        id: "cloud-ml-platforms",
        label: "云原生 ML 平台",
        description: "AWS SageMaker / GCP Vertex AI / 阿里云 PAI 托管训练与推理、Kubernetes 上的 GPU 调度与弹性扩缩、成本优化与竞价实例策略",
        difficulty: "advanced",
        estimated_hours: 16,
        related_chapters: ["mlops"],
      },
      {
        id: "edge-deployment",
        label: "边缘推理部署",
        description: "ONNX Runtime Mobile/NCNN/MNN 端侧推理框架、TFLite/CoreML 移动端量化部署、TinyML 与微控制器上的 ML、端云协同推理架构",
        difficulty: "advanced",
        estimated_hours: 14,
        related_chapters: ["mlops"],
      },
    ],
  },
];

export const EXPERIMENTS: Record<string, Experiment[]> = {
  beginner: [
    {
      name: "从零实现线性回归",
      difficulty: "beginner",
      data: "California Housing 房价数据",
      tools: ["NumPy", "Pandas", "Matplotlib", "Scikit-learn（仅用于对比）"],
      skills: ["梯度下降", "损失函数设计", "向量化计算", "模型评估"],
      goal: "从零实现线性回归的梯度下降优化过程，理解参数更新与收敛机制，对比自实现与 sklearn 的结果差异",
      estimated_time: "2-3小时",
      deliverables: "一个完整的 Jupyter Notebook，包含自实现线性回归类、损失曲线可视化、与 sklearn 的对比分析报告",

      data_source: "sklearn.datasets.fetch_california_housing() —— 加州房价数据，20640条记录，8个特征",      steps: [
        "步骤1：加载 California Housing 数据集，查看数据维度和特征含义",
        "步骤2：选择 'MedInc'（收入中位数）作为特征 X，房价作为目标 y，用 plt.scatter 画散点图",
        "步骤3：对 X 做标准化（减均值除以标准差），让梯度下降更快收敛",
        "步骤4：手写梯度下降——初始化 w=0, b=0，学习率=0.01，迭代500次，每步计算 MSE 损失和梯度，记录损失值",
        "步骤5：绘制损失曲线（plt.plot），观察损失是否持续下降",
        "步骤6：用 sklearn 的 LinearRegression 训练并对比 w 和 b 的差异"
      ],
      code: `# 从零实现线性回归
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import fetch_california_housing
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

# 1. 加载数据
data = fetch_california_housing()
X = data.data[:, 0:1]  # MedInc 特征
y = data.target         # 房价（单位：10万美元）
print(f"数据维度: {X.shape}, 标签范围: {y.min():.2f} ~ {y.max():.2f}")

# 2. 标准化
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# 3. 手写梯度下降
w, b = 0.0, 0.0
lr, epochs = 0.01, 500
n = len(y)
losses = []
for _ in range(epochs):
    y_pred = w * X_scaled.ravel() + b
    loss = np.mean((y_pred - y) ** 2)  # MSE
    losses.append(loss)
    dw = (2/n) * np.sum((y_pred - y) * X_scaled.ravel())
    db = (2/n) * np.sum(y_pred - y)
    w -= lr * dw
    b -= lr * db

print(f"手写模型: w={w:.4f}, b={b:.4f}, 最终损失={losses[-1]:.4f}")

# 4. 损失曲线
plt.plot(losses)
plt.xlabel('迭代次数'); plt.ylabel('MSE 损失')
plt.title('梯度下降收敛过程'); plt.show()

# 5. 与 sklearn 对比
lr_sk = LinearRegression().fit(X_scaled, y)
print(f"sklearn: w={lr_sk.coef_[0]:.4f}, b={lr_sk.intercept_:.4f}")

# 6. 可视化拟合线
plt.scatter(X_scaled, y, alpha=0.3, s=5)
plt.plot(X_scaled, w * X_scaled.ravel() + b, 'r-', lw=2, label='手写')
plt.legend(); plt.show()`,
      expected_output: "损失曲线从约 1.3 持续下降到约 0.5，手写模型 w≈0.8, b≈2.0，与 sklearn 的 w 和 b 基本一致（误差 < 1%），拟合线穿过散点中心区域。",
      reflection: [
        "学习率 0.001 vs 0.01 vs 0.1 时，损失曲线分别是什么形态？哪个最好？",
        "如果把迭代次数从 500 改成 5000，损失能继续下降多少？为什么？",
        "不使用标准化，直接用原始数据训练，梯度下降会怎样？（试试看！）"
      ],
    },
    {
      name: "Pandas 数据探索与可视化实战",
      difficulty: "beginner",
      data: "Seaborn 内置 Titanic 数据集",
      tools: ["Pandas", "Matplotlib", "Seaborn"],
      skills: ["描述性统计", "缺失值检测", "分组聚合", "可视化叙事"],
      goal: "掌握 Pandas 数据探索完整流程，能独立完成数据清洗、统计描述和可视化报告",
      estimated_time: "2-3小时",
      deliverables: "EDA 分析报告 Notebook，包含数据质量评估、8+图表和初步洞察",

      download_url: "https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv",
      data_source: "seaborn.load_dataset('titanic') —— 泰坦尼克号乘客数据，891条记录",      steps: [
        "步骤1：用 seaborn.load_dataset('titanic') 加载数据，查看 shape 和前10行",
        "步骤2：df.info() 和 df.describe() 快速了解数据类型、缺失情况、数值分布",
        "步骤3：用 df.isnull().sum() 统计缺失值，对年龄用中位数填充，对登船港口用众数填充",
        "步骤4：分组聚合——按性别(pclass)和船舱等级(sex)分组，计算平均生存率",
        "步骤5：可视化——sns.countplot 看生存分布，sns.boxplot 看年龄-生存关系，sns.heatmap 看相关性矩阵"
      ],
      code: `import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# 1. 加载数据
df = sns.load_dataset('titanic')
print(f"数据维度: {df.shape}")
print(df.head())

# 2. 快速检视
print(df.info())
print(df.describe())

# 3. 缺失值处理
print(f"\\n缺失值:\\n{df.isnull().sum()}")
df['age'].fillna(df['age'].median(), inplace=True)
df['embarked'].fillna(df['embarked'].mode()[0], inplace=True)

# 4. 分组聚合: 按性别+船舱看生存率
print(df.groupby(['sex', 'pclass'])['survived'].mean().unstack())

# 5. 可视化
fig, axes = plt.subplots(2, 2, figsize=(12, 9))
sns.countplot(data=df, x='survived', ax=axes[0,0])
sns.countplot(data=df, x='pclass', hue='survived', ax=axes[0,1])
sns.boxplot(data=df, x='survived', y='age', ax=axes[1,0])
sns.heatmap(df.select_dtypes(include='number').corr(), annot=True, cmap='coolwarm', ax=axes[1,1])
plt.tight_layout(); plt.show()`,
      expected_output: "缺失值统计显示年龄缺失177个、船舱缺失687个、登船港缺失2个。女性生存率(74%)远高于男性(19%)，一等舱生存率(63%)高于三等舱(24%)。年龄与生存关系不大。",
      reflection: [
        "一等舱的生存率为什么比三等舱高那么多？这和「女士和儿童优先」的救援规则有关吗？",
        "船舱(Cabin)缺失率高达77%，这个特征还有用吗？你会怎么处理它？",
        "如果让你预测一个20岁、三等舱、女性的生存概率，你估计大概是多少？"
      ],
    },
    {
      name: "KNN 手写数字分类器",
      difficulty: "beginner",
      data: "MNIST 手写数字数据集（取前2000个样本）",
      tools: ["NumPy", "Scikit-learn", "Matplotlib"],
      skills: ["K近邻算法", "距离度量", "交叉验证", "混淆矩阵"],
      goal: "理解 KNN 的非参数分类原理，实验不同 K 值和距离度量对分类效果的影响",
      estimated_time: "1.5-2小时",
      deliverables: "KNN 分类器代码，K值-准确率曲线图，混淆矩阵分析报告",

      data_source: "sklearn.datasets.load_digits() —— MNIST手写数字，1797条记录，8×8像素",      steps: [
        "步骤1：从 sklearn.datasets 加载 MNIST 子集(2000样本)，用 plt.imshow 查看前10个数字",
        "步骤2：划分训练集(80%)和测试集(20%)，用 StandardScaler 标准化",
        "步骤3：训练 KNN (K=3)，输出准确率",
        "步骤4：用 confusion_matrix 和 ConfusionMatrixDisplay 可视化混淆矩阵",
        "步骤5：循环 K=1,3,5,7,9，记录每个 K 的准确率，绘制 K值-准确率曲线"
      ],
      code: `from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, ConfusionMatrixDisplay
import matplotlib.pyplot as plt

# 1. 加载数据
digits = load_digits(n_class=10)
X, y = digits.data[:2000], digits.target[:2000]
print(f"数据维度: {X.shape}")
# 可视化前10个数字
fig, axes = plt.subplots(2, 5, figsize=(10, 4))
for i, ax in enumerate(axes.flat):
    ax.imshow(digits.images[i], cmap='gray')
    ax.set_title(f'标签: {digits.target[i]}'); ax.axis('off')
plt.show()

# 2. 划分+标准化
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

# 3. KNN (K=3)
knn = KNeighborsClassifier(n_neighbors=3).fit(X_train_s, y_train)
y_pred = knn.predict(X_test_s)
print(f"K=3 准确率: {accuracy_score(y_test, y_pred):.3f}")

# 4. 混淆矩阵
ConfusionMatrixDisplay.from_predictions(y_test, y_pred); plt.show()

# 5. 不同K值对比
ks, scores = [], []
for k in [1, 3, 5, 7, 9, 11]:
    knn = KNeighborsClassifier(n_neighbors=k).fit(X_train_s, y_train)
    scores.append(accuracy_score(y_test, knn.predict(X_test_s)))
    ks.append(k)
plt.plot(ks, scores, 'bo-'); plt.xlabel('K值'); plt.ylabel('准确率')
plt.title('K值对KNN准确率的影响'); plt.show()`,
      expected_output: "K=3时准确率约95%。混淆矩阵显示对角线颜色最深（预测正确）。K=3到7时准确率最高且稳定，K=1时略低（过拟合），K>9后开始下降。",
      reflection: [
        "K=1 和 K=9 的结果有何不同？哪个更好？为什么？",
        "如果不做 StandardScaler 标准化，准确率会降低多少？试试看！",
        "KNN 适合处理大规模数据吗？如果训练数据有 100 万条，每次预测要计算多少次距离？"
      ],
    },
    {
      name: "训练集与测试集划分实践",
      difficulty: "beginner",
      data: "Scikit-learn 内置乳腺癌数据集",
      tools: ["Scikit-learn", "Pandas", "NumPy", "Matplotlib"],
      skills: ["数据划分策略", "过拟合检测", "标准化", "基线模型建立"],
      goal: "掌握 train/val/test 划分原则、数据标准化和基线模型构建，理解过拟合与欠拟合的直观表现",
      estimated_time: "1.5-2小时",
      deliverables: "包含3种划分比例对比的 Notebook，学习曲线图，训练集/测试集性能差异分析",

      download_url: "https://archive.ics.uci.edu/ml/machine-learning-databases/breast-cancer-wisconsin/wdbc.data",
      data_source: "sklearn.datasets.load_breast_cancer() —— 乳腺癌诊断数据，569条记录，30个特征",      steps: [
        "步骤1：加载 breast_cancer 数据集，了解 30 个特征和 2 个类别",
        "步骤2：用 train_test_split 划分 (70/30)，设置 stratify=y 保持类别比例",
        "步骤3：用 StandardScaler 标准化，训练决策树(max_depth=3)",
        "步骤4：分别在训练集和测试集上评估准确率，对比差异",
        "步骤5：用 cross_val_score 做5折交叉验证，对比单次划分 vs 交叉验证的结果"
      ],
      code: `from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score

# 1. 加载数据
X, y = load_breast_cancer(return_X_y=True)
print(f"特征数: {X.shape[1]}, 样本数: {X.shape[0]}")

# 2. 划分 (70/30, 分层)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, stratify=y, random_state=42)
print(f"训练集: {X_train.shape}, 测试集: {X_test.shape}")

# 3. 标准化 + 训练
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)
clf = DecisionTreeClassifier(max_depth=3, random_state=42).fit(X_train_s, y_train)

# 4. 评估
train_acc = accuracy_score(y_train, clf.predict(X_train_s))
test_acc = accuracy_score(y_test, clf.predict(X_test_s))
print(f"训练集准确率: {train_acc:.3f}")
print(f"测试集准确率: {test_acc:.3f}")
print(f"差异: {train_acc - test_acc:.3f}")

# 5. 交叉验证
scores = cross_val_score(clf, scaler.fit_transform(X), y, cv=5)
print(f"5折交叉验证: {scores}")
print(f"平均: {scores.mean():.3f} ± {scores.std():.3f}")`,
      expected_output: "训练集准确率约 97%，测试集约 92%，差异约 5%（轻微过拟合）。5折交叉验证均值约 93%，比单次划分更稳定。",
      reflection: [
        "训练集准确率比测试集高 5%，这是正常还是过拟合？如果高 20% 呢？",
        "为什么用 stratify=y？不用会怎样？",
        "交叉验证的 5 折结果（如 91%,94%,93%,92%,95%），你更相信哪个数字？"
      ],
    },
    {
      name: "NumPy 向量化运算与矩阵操作",
      difficulty: "beginner",
      data: "随机生成的模拟数据",
      tools: ["NumPy", "Matplotlib"],
      skills: ["广播机制", "向量化思维", "矩阵分解", "随机数生成"],
      goal: "掌握 NumPy 的广播机制和向量化编程，能高效完成数组变换和矩阵运算",
      estimated_time: "2-3小时",
      deliverables: "10道 NumPy 向量化练习题与解答，性能对比基准测试，矩阵操作速查笔记",

      data_source: "numpy.random.randn() —— 随机生成模拟数据，无需外部下载",      steps: [
        "步骤1：创建 3×3 随机矩阵和 3×1 列向量，测试 @、dot、* 三种运算的区别",
        "步骤2：用 np.random.randn 生成 100 万行×5 列的数据，尝试广播：每列减列均值",
        "步骤3：对比向量化 (X @ w) 和 for 循环的性能差异，用 time.time() 计时",
        "步骤4：用 np.linalg.inv 求矩阵逆，用 np.linalg.eig 求特征值特征向量",
        "步骤5：用 NumPy 手写一个简单的线性回归拟合 y=Xw，对比 np.linalg.lstsq 的结果"
      ],
      code: `import numpy as np
import time

# 1. 矩阵运算区别
A = np.random.randn(3, 3)
b = np.random.randn(3, 1)
print(f"A @ b 矩阵乘法:\\n{A @ b}")
print(f"A * b 逐元素:\\n{A * b.T}")  # 注意：b需要转置

# 2. 广播
X = np.random.randn(1_000_000, 5)
mean = X.mean(axis=0)                # (5,)
X_centered = X - mean                # (1000000,5)-(5,) → 广播！
print(f"广播成功: {X_centered.shape}")

# 3. 性能对比
w = np.random.randn(5)
start = time.time()
r_vec = X @ w
vec_time = time.time() - start
start = time.time()
r_loop = np.array([X[i] @ w for i in range(10000)])
loop_time = time.time() - start
print(f"向量化: {vec_time:.4f}s (全部), for循环: {loop_time:.4f}s (仅10000行)")

# 4. 特征分解
M = np.array([[2, 1], [1, 2]])
vals, vecs = np.linalg.eig(M)
print(f"特征值: {vals}, 特征向量:\\n{vecs}")

# 5. NumPy手写线性回归
np.random.seed(42)
X = np.random.randn(100, 3)
y = 2*X[:,0] + 3*X[:,1] - X[:,2] + np.random.randn(100)*0.1
w_np = np.linalg.inv(X.T @ X) @ X.T @ y
print(f"NumPy最小二乘: w={w_np}")`,
      expected_output: "向量化处理 100 万行只需 ~0.01 秒，for 循环 1 万行就需要 ~0.5 秒——向量化快了约 5000 倍。广播机制让 X_centered 的 shape 正确变为 (1000000, 5)。特征值 3 和 1，特征向量正交。手写最小二乘结果与真实值 [2, 3, -1] 非常接近。",
      reflection: [
        "向量化为什么比 for 循环快这么多？这和 CPU 的 SIMD 指令有什么关系？",
        "X @ w 和 X.dot(w) 和 np.dot(X, w) 有什么区别？",
        "如果 X 的形状是 (100, 3)，w 的形状是 (3,)，X @ w 的结果形状是什么？"
      ],
    },
  ],
  intermediate: [
    {
      name: "逻辑回归分类与决策边界可视化",
      difficulty: "intermediate",
      data: "sklearn 乳腺癌诊断数据集",
      tools: ["Scikit-learn", "Pandas", "Matplotlib", "Seaborn"],
      skills: ["逻辑回归", "正则化调参", "决策边界", "ROC-AUC 评估"],
      goal: "掌握逻辑回归从线性到概率的完整推导，可视化正则化参数对决策边界的影响，理解分类阈值与业务指标的关系",
      estimated_time: "3-4小时",
      deliverables: "逻辑回归建模全流程 Notebook，包含 L1/L2 正则化效果对比、ROC 曲线与 PR 曲线、最优阈值选择分析",
      download_url: "https://archive.ics.uci.edu/ml/machine-learning-databases/breast-cancer-wisconsin/wdbc.data",
      data_source: "sklearn.datasets.load_breast_cancer() —— 569条记录，30个特征，二分类（恶性/良性）",
      steps: [
        "加载 breast_cancer 数据，用 df.describe() 查看各特征统计量，检查是否有缺失值",
        "用 StandardScaler 标准化全部 30 个特征",
        "用 PCA 降到 2 维（仅用于可视化），在 2D 平面上画散点图观察两类分布",
        "训练 LogisticRegression（默认 L2 正则化，C=1.0），输出分类报告和混淆矩阵",
        "对比不同 C 值（0.01, 0.1, 1, 10, 100）对准确率和决策边界的影响",
        "绘制 ROC 曲线并计算 AUC，理解分类阈值如何影响精确率和召回率"
      ],
      code: `from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, roc_curve, auc, RocCurveDisplay
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# 1. 加载数据
X, y = load_breast_cancer(return_X_y=True)
print(f"样本数: {X.shape[0]}, 特征数: {X.shape[1]}")
print(f"类别分布: {np.bincount(y)}")

# 2. 标准化 + 划分
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.3, stratify=y, random_state=42)

# 3. PCA 降维可视化
pca = PCA(n_components=2).fit(X_scaled)
X2d = pca.transform(X_scaled)
plt.figure(figsize=(8, 5))
scatter = plt.scatter(X2d[:, 0], X2d[:, 1], c=y, cmap='coolwarm', alpha=0.6, s=15)
plt.colorbar(scatter, label='类别 (0=恶性, 1=良性)')
plt.title(f'PCA 降维 (解释方差: {pca.explained_variance_ratio_.sum():.1%})')
plt.show()

# 4. 逻辑回归 + 评估
lr = LogisticRegression(C=1.0, max_iter=1000).fit(X_train, y_train)
y_pred = lr.predict(X_test)
print(classification_report(y_test, y_pred, target_names=['恶性', '良性']))

# 5. 不同 C 值对比
for C in [0.01, 0.1, 1, 10, 100]:
    acc = cross_val_score(LogisticRegression(C=C, max_iter=1000), X_scaled, y, cv=5).mean()
    print(f"C={C:6.2f} → 5折CV准确率: {acc:.4f}")

# 6. ROC 曲线
y_score = lr.predict_proba(X_test)[:, 1]
RocCurveDisplay.from_predictions(y_test, y_score)
plt.title(f'ROC 曲线 (AUC={auc(y_test, y_score):.3f})')
plt.show()`,
      expected_output: "默认参数下准确率约 96-98%。PCA 可视化中两类数据有清晰分界。C=1 和 C=10 效果相近，C 太小（0.01）正则化过强导致欠拟合，C 太大（100）几乎无正则化。ROC-AUC > 0.99，说明模型分辨能力极强。",
      reflection: [
        "C=0.01 和 C=100 的准确率差异大吗？什么时候需要强正则化？",
        "ROC 曲线越靠近左上角越好——如果 AUC=0.5 意味着什么？",
        "为什么先用 PCA 降维再画散点图？PCA 维度对分类效果有影响吗？"
      ],
    },
    {
      name: "K-Means 客户分群与用户画像",
      difficulty: "intermediate",
      data: "Mall Customer Segmentation 数据（200条）",
      tools: ["Scikit-learn", "Pandas", "Matplotlib", "Seaborn"],
      skills: ["K-Means 聚类", "肘部法则", "轮廓系数", "用户画像构建"],
      goal: "掌握 K-Means 聚类原理与最佳 K 值选择方法，能对真实业务数据完成聚类分群并生成可解释的用户画像",
      estimated_time: "3-4小时",
      deliverables: "聚类分析 Notebook，包含肘部法则图、轮廓系数分析、PCA 降维可视化、每类用户的特征画像描述",
      download_url: "https://raw.githubusercontent.com/SteffiPeTaffy/machineLearningAZ/master/Mall_Customers.csv",
      data_source: "Mall Customers 数据集（可用 pd.read_csv 加载），200条记录，5个特征：CustomerID, Gender, Age, Annual Income (k$), Spending Score (1-100)",
      steps: [
        "用 pandas 读取 Mall_Customers.csv（可从 GitHub 直接下载），查看 head() 和 describe()",
        "选择 Age、Annual Income、Spending Score 三个特征，用 StandardScaler 标准化",
        "用肘部法则（Elbow Method）测试 K=1 到 K=10，计算每个 K 的 inertia_，画折线图找拐点",
        "选择最佳 K 值（约 5），训练 KMeans，用 silhouette_score 验证聚类质量",
        "用 PCA 降维到 2 维可视化聚类结果，每个簇用不同颜色标记",
        "分析每个簇的平均年龄、收入和消费分，给每个簇起一个名字（如「高收入高消费」「年轻节俭族」等）"
      ],
      code: `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

# 1. 加载数据
url = "https://raw.githubusercontent.com/SteffiPeTaffy/machineLearningAZ/master/Mall_Customers.csv"
df = pd.read_csv(url)
print(df.head())
print(df.describe())

# 2. 选择特征 + 标准化
features = ['Age', 'Annual Income (k$)', 'Spending Score (1-100)']
X = df[features].values
X_scaled = StandardScaler().fit_transform(X)
print(f"数据维度: {X_scaled.shape}")

# 3. 肘部法则
inertias = []
ks = range(1, 11)
for k in ks:
    inertias.append(KMeans(n_clusters=k, random_state=42, n_init=10).fit(X_scaled).inertia_)
plt.plot(ks, inertias, 'bo-')
plt.xlabel('K 值'); plt.ylabel('Inertia (簇内平方和)')
plt.title('肘部法则 — 找最佳 K 值'); plt.show()

# 4. KMeans 聚类
k_best = 5
km = KMeans(n_clusters=k_best, random_state=42, n_init=10).fit(X_scaled)
labels = km.labels_
print(f"轮廓系数: {silhouette_score(X_scaled, labels):.3f}")

# 5. PCA 可视化
X2d = PCA(n_components=2).fit_transform(X_scaled)
plt.figure(figsize=(8, 6))
scatter = plt.scatter(X2d[:, 0], X2d[:, 1], c=labels, cmap='viridis', s=40, alpha=0.8)
plt.colorbar(scatter, label='簇编号')
plt.title(f'K-Means 聚类结果 (K={k_best})'); plt.show()

# 6. 用户画像
df['Cluster'] = labels
for i in range(k_best):
    cluster = df[df['Cluster'] == i]
    print(f"\\n簇 {i} ({len(cluster)}人):")
    print(f"  平均年龄: {cluster['Age'].mean():.0f}, 平均收入: {cluster['Annual Income (k$)'].mean():.0f}k, 平均消费分: {cluster['Spending Score (1-100)'].mean():.0f}")`,
      expected_output: "肘部法则图在 K=5 左右出现明显拐点。轮廓系数约 0.4-0.5。5 个簇对应典型的用户画像：高收入高消费（VIP）、高收入低消费（潜力客户）、中等收入中等消费（大众）、低收入高消费（冲动型）、低收入低消费（节俭型）。",
      reflection: [
        "肘部法则的拐点不明显怎么办？还有什么其他方法可以选 K 值？",
        "如果把 Spending Score 去掉，只用 Age 和 Income 聚类，结果有什么不同？",
        "K-Means 假设簇是球形的——这个假设在实际数据中总是成立吗？DBSCAN 会不会更合适？"
      ],
    },
    {
      name: "决策树可视化与模型解释",
      difficulty: "intermediate",
      data: "sklearn 红酒分类数据集 (Wine)",
      tools: ["Scikit-learn", "Matplotlib", "Pandas", "NumPy"],
      skills: ["决策树构建", "剪枝策略", "特征重要性", "决策路径追踪"],
      goal: "深入理解决策树的分裂准则与剪枝原理，能可视化树结构并解释单个样本的决策路径",
      estimated_time: "2-3小时",
      deliverables: "决策树可视化报告，包含树结构图、特征重要性排序、过拟合与剪枝效果对比、单样本决策路径解释",
      download_url: "https://archive.ics.uci.edu/ml/machine-learning-databases/wine/wine.data",
      data_source: "sklearn.datasets.load_wine() —— 178条记录，13个化学特征，3种葡萄酒类别",
      steps: [
        "加载 Wine 数据集（3种葡萄酒），用 df.describe() 和 corr() 初步了解数据",
        "划分训练集(70%)和测试集(30%)，训练一棵 max_depth=3 的决策树",
        "用 sklearn.tree.plot_tree 画出完整树结构，标注每个节点的分裂特征和基尼系数",
        "查看 feature_importances_，用柱状图展示各特征对分类的贡献",
        "对比不同 max_depth (1, 3, 5, 10, None) 下的训练集和测试集准确率，观察过拟合"
      ],
      code: `from sklearn.datasets import load_wine
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.metrics import accuracy_score
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

# 1. 加载数据
data = load_wine()
X, y = data.data, data.target
print(f"特征: {data.feature_names}")
print(f"类别: {data.target_names}")
print(f"样本数: {X.shape[0]}, 特征数: {X.shape[1]}")

# 2. 划分 + 训练
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
clf = DecisionTreeClassifier(max_depth=3, random_state=42).fit(X_train, y_train)
print(f"max_depth=3 准确率: 训练集 {accuracy_score(y_train, clf.predict(X_train)):.3f}, 测试集 {accuracy_score(y_test, clf.predict(X_test)):.3f}")

# 3. 可视化决策树
plt.figure(figsize=(16, 8))
plot_tree(clf, feature_names=data.feature_names, class_names=data.target_names.tolist(), filled=True, rounded=True, fontsize=9)
plt.title('Wine 数据集决策树 (max_depth=3)')
plt.show()

# 4. 特征重要性
imp = pd.Series(clf.feature_importances_, index=data.feature_names).sort_values()
imp.plot(kind='barh', color='steelblue')
plt.title('特征重要性'); plt.xlabel('Gini Importance'); plt.show()

# 5. 深度对比
depths = [1, 3, 5, 10, None]
for d in depths:
    c = DecisionTreeClassifier(max_depth=d, random_state=42).fit(X_train, y_train)
    tr = accuracy_score(y_train, c.predict(X_train))
    te = accuracy_score(y_test, c.predict(X_test))
    label = f"max_depth={d}" if d else "max_depth=∞"
    print(f"{label:15s} 训练: {tr:.3f}  测试: {te:.3f}  {'⚠ 过拟合' if tr - te > 0.1 else '✓'}")`,
      expected_output: "max_depth=3 时准确率约 92%，树结构清晰可读。特征重要性最高的是 proline（脯氨酸）和 color_intensity（颜色强度）。max_depth=∞ 时训练集准确率 100% 但测试集反而下降（过拟合）。max_depth=3 能很好地平衡可解释性和泛化能力。",
      reflection: [
        "为什么 max_depth=∞ 时训练准确率 100% 反而是坏事？这和「背答案不会解题」有什么相似之处？",
        "Gini Importance 高的特征一定最重要吗？如果一个特征和其他特征高度相关会怎样？",
        "如果数据有缺失值，决策树还能用吗？怎么处理？"
      ],
    },
    {
      name: "PCA 降维与高维数据可视化",
      difficulty: "intermediate",
      data: "sklearn 手写数字数据集 (Digits, 64维)",
      tools: ["Scikit-learn", "NumPy", "Matplotlib"],
      skills: ["PCA 降维", "方差解释率", "特征值分解", "数据去噪"],
      goal: "掌握 PCA 的数学原理与实现，理解方差保留与维度压缩的权衡，能将高维数据降至2-3维进行可视化分析",
      estimated_time: "2-3小时",
      deliverables: "PCA 降维实验 Notebook，包含累积方差解释率图、2D/3D 降维可视化、原始特征与主成分的载荷矩阵分析",
      data_source: "sklearn.datasets.load_digits() —— 1797条手写数字，每条 8×8=64 维像素特征，10个类别",
      steps: [
        "加载 load_digits 数据（64维像素），用 plt.imshow 查看前几个数字的原始图像",
        "用 StandardScaler 标准化 64 维数据，注意每个像素是一个特征",
        "用 PCA(n_components=2) 降维，在 2D 平面上画散点图，按数字类别着色——观察不同数字在降维空间中的分布",
        "保留所有 64 个主成分，画累积方差解释率曲线——看前几个主成分解释了大部分方差",
        "选取前 20 个主成分重构图像，与原图对比，理解「降维→重构」的信息损失"
      ],
      code: `from sklearn.datasets import load_digits
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import numpy as np

# 1. 加载 64 维手写数字
digits = load_digits()
X, y = digits.data, digits.target
print(f"数据维度: {X.shape} ({X.shape[1]} 个像素特征)")

# 查看原始图像
fig, axes = plt.subplots(2, 5, figsize=(10, 4))
for i, ax in enumerate(axes.flat):
    ax.imshow(digits.images[i], cmap='gray')
    ax.set_title(f'数字 {digits.target[i]}'); ax.axis('off')
plt.suptitle('原始手写数字样本'); plt.show()

# 2. 标准化
X_scaled = StandardScaler().fit_transform(X)

# 3. PCA 降维到 2D 可视化
X2d = PCA(n_components=2).fit_transform(X_scaled)
plt.figure(figsize=(8, 6))
scatter = plt.scatter(X2d[:, 0], X2d[:, 1], c=y, cmap='tab10', alpha=0.5, s=8)
plt.colorbar(scatter, label='数字类别')
plt.xlabel('PC1'); plt.ylabel('PC2')
plt.title('64维手写数字 → PCA 2维可视化')
plt.show()

# 4. 累积方差解释率
pca_full = PCA().fit(X_scaled)
cumsum = np.cumsum(pca_full.explained_variance_ratio_)
plt.figure(figsize=(8, 4))
plt.bar(range(1, 65), pca_full.explained_variance_ratio_, alpha=0.6, label='单个主成分')
plt.plot(range(1, 65), cumsum, 'r-o', markersize=3, label='累积方差')
plt.axhline(y=0.9, color='gray', linestyle='--', label='90% 阈值')
plt.xlabel('主成分编号'); plt.ylabel('方差解释率')
plt.legend(); plt.title('PCA 方差解释率'); plt.show()
# 找到达到 90% 方差的主成分数
n90 = np.argmax(cumsum >= 0.9) + 1
print(f"前 {n90} 个主成分解释了 {cumsum[n90-1]:.1%} 的方差")

# 5. 降维重构
n_components = 20
pca = PCA(n_components=n_components).fit(X_scaled)
X_reduced = pca.transform(X_scaled)
X_restored = pca.inverse_transform(X_reduced)
fig, axes = plt.subplots(2, 5, figsize=(10, 4))
for i, ax in enumerate(axes.flat):
    ax.imshow(X_restored[i].reshape(8, 8), cmap='gray')
    ax.set_title(f'{digits.target[i]}'); ax.axis('off')
plt.suptitle(f'用 {n_components} 个主成分重构 (原64维)')
plt.show()`,
      expected_output: "2D PCA 散点图显示不同数字有聚拢趋势（0、1、4 较分散）。累积方差曲线显示前约 20 个主成分解释了 90% 方差——意味着 64 维数据中约 44 维是冗余的。用 20 个主成分重构的数字仍清晰可辨，但比原图模糊。",
      reflection: [
        "为什么 64 维数据可以用 20 个主成分近似？丢失的 44 维是什么信息？",
        "PCA 假设数据是线性结构——如果数据有非线性结构（比如螺旋形），PCA 还能好用吗？t-SNE 和 PCA 有什么区别？",
        "如果某特征方差很大但数值范围也很大（比如年龄 0-100 vs 收入 0-100000），PCA 会偏向哪个特征？"
      ],
    },
    {
      name: "特征工程流水线构建",
      difficulty: "intermediate",
      data: "sklearn 加州房价数据 (California Housing)",
      tools: ["Scikit-learn", "Pandas", "NumPy", "Matplotlib"],
      skills: ["数值特征变换", "Pipeline 自动化", "ColumnTransformer", "交叉验证"],
      goal: "掌握系统化的特征工程方法论，能构建端到端的预处理流水线，通过特征工程显著提升模型性能",
      estimated_time: "4-5小时",
      deliverables: "特征工程流水线 Pipeline，包含至少 5 种特征构造操作、特征选择报告、前后模型性能对比（基线 vs 特征工程后）",
      data_source: "sklearn.datasets.fetch_california_housing() —— 20640条加州房价数据，8个数值特征",
      steps: [
        "加载 California Housing 数据，转为 DataFrame，查看各特征分布（hist）和与目标变量的相关性（热力图）",
        "创建新特征：房间数/卧室数比值、每房间人口数、卧室/人口比值等 3 个组合特征",
        "用 StandardScaler 标准化数值特征，用 ColumnTransformer 组合所有预处理步骤",
        "构建 Pipeline：ColumnTransformer → 标准化 → 线性回归，用 cross_val_score 评估基线 R²",
        "对比「无特征工程」vs「有特征工程」的交叉验证得分，记录 R² 提升幅度"
      ],
      code: `from sklearn.datasets import fetch_california_housing
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler, FunctionTransformer
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# 1. 加载数据
data = fetch_california_housing()
df = pd.DataFrame(data.data, columns=data.feature_names)
df['Price'] = data.target
print(df.describe())

# 相关性热力图
plt.figure(figsize=(10, 8))
sns.heatmap(df.corr(), annot=True, fmt='.2f', cmap='coolwarm', center=0)
plt.title('特征/目标相关性矩阵'); plt.show()

# 2. 特征工程函数
def add_features(X_df):
    X = X_df.copy()
    X['rooms_per_house'] = X['AveRooms'] / (X['AveBedrms'] + 1e-6)
    X['pop_per_house'] = X['Population'] / (X['AveOccup'] + 1e-6)
    X['bedrms_ratio'] = X['AveBedrms'] / (X['AveRooms'] + 1e-6)
    return X

X_raw = df.drop('Price', axis=1)
y = df['Price'].values

# 3. 构建 Pipeline
preprocessor = ColumnTransformer([
    ('scaler', StandardScaler(), list(X_raw.columns) + ['rooms_per_house', 'pop_per_house', 'bedrms_ratio']),
])

# 添加特征工程的 Pipeline
feat_eng = FunctionTransformer(add_features, validate=False)
pipeline_with_fe = Pipeline([
    ('feature_engineering', feat_eng),
    ('preprocessor', preprocessor),
    ('regressor', LinearRegression()),
])

# 无特征工程的基线
pipeline_baseline = Pipeline([
    ('scaler', StandardScaler()),
    ('regressor', LinearRegression()),
])

# 4. 对比评估
scores_baseline = cross_val_score(pipeline_baseline, X_raw, y, cv=5, scoring='r2')
scores_with_fe = cross_val_score(pipeline_with_fe, X_raw, y, cv=5, scoring='r2')
print(f"基线 R²: {scores_baseline.mean():.4f} ± {scores_baseline.std():.4f}")
print(f"特征工程后 R²: {scores_with_fe.mean():.4f} ± {scores_with_fe.std():.4f}")

# 可视化对比
plt.bar(['基线', '特征工程'], [scores_baseline.mean(), scores_with_fe.mean()],
        yerr=[scores_baseline.std(), scores_with_fe.std()], color=['gray', 'steelblue'])
plt.ylabel('R² (5折CV)'); plt.title('特征工程效果对比')
plt.show()`,
      expected_output: "基线 R² 约 0.60，添加 3 个组合特征后 R² 提升至约 0.62——提升约 2 个百分点。相关性热力图显示 MedInc（收入中位数）与房价相关性最强（>0.7），是最重要的预测特征。Pipeline 确保了预处理步骤不会产生数据泄漏。",
      reflection: [
        "为什么用 Pipeline 比手动逐步处理更好？Pipeline 如何避免数据泄漏？",
        "组合特征 'rooms_per_house' 如果除数为 0 怎么办？代码中 +1e-6 的作用是什么？",
        "如果新增的特征其实没有用（噪声），Pipeline 的 R² 会怎样变化？怎么筛选有效特征？"
      ],
    },
  ],
  advanced: [
    {
      name: "PyTorch CNN 图像分类器",
      difficulty: "advanced",
      data: "CIFAR-10 / CIFAR-100 彩色图像数据集",
      tools: ["PyTorch", "Torchvision", "TensorBoard", "tqdm"],
      skills: ["CNN 架构设计", "数据增强", "学习率调度", "模型集成"],
      goal: "从零搭建并训练一个达到 85%+ 准确率的 CNN 图像分类器，掌握现代 CNN 训练管线（增强、调度、集成）",
      estimated_time: "5-6小时",
      deliverables: "完整的 CNN 训练代码，包含数据增强可视化、训练曲线、混淆矩阵、至少2种架构的性能对比",
      download_url: "",
      data_source: "torchvision.datasets.CIFAR10() —— CIFAR-10 彩色图像数据集，10 个类别（飞机、汽车、鸟、猫、鹿、狗、蛙、马、船、卡车），50000 张训练图 + 10000 张测试图，32×32 像素，调用即自动下载",
      steps: [
        "加载 CIFAR-10 数据集，使用 transforms.Compose 组合随机水平翻转、ToTensor 和 Normalize 进行数据增强",
        "定义 CNN 网络结构：Conv2d(3→32)→ReLU→MaxPool2d→Conv2d(32→64)→ReLU→MaxPool2d→Flatten→Linear(64*8*8→256)→ReLU→Dropout(0.5)→Linear(256→10)",
        "选择 CrossEntropyLoss 和 Adam(lr=0.001) 优化器，编写训练循环共 5 个 Epoch，每个 Batch 记录 Loss",
        "每个 Epoch 结束后在测试集上评估准确率，用 twinx() 双轴绘制 Loss（蓝色）和 Accuracy（红色）曲线",
        "随机抽取 16 张测试图像，用训练好的模型预测并可视化，图像上方标注「真实：XX / 预测：XX」",
      ],
      code: `import torch, torch.nn as nn, torch.optim as optim
import torchvision, torchvision.transforms as T
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt

# 1. 数据加载与增强
transform = T.Compose([T.RandomHorizontalFlip(), T.ToTensor(),
    T.Normalize((0.5,0.5,0.5),(0.5,0.5,0.5))])
train_ds = torchvision.datasets.CIFAR10('./data', train=True, download=True, transform=transform)
test_ds = torchvision.datasets.CIFAR10('./data', train=False, download=True,
    transform=T.Compose([T.ToTensor(), T.Normalize((0.5,0.5,0.5),(0.5,0.5,0.5))]))
train_loader = DataLoader(train_ds, 64, shuffle=True)
test_loader = DataLoader(test_ds, 64)

# 2. 定义 CNN
class CNN(nn.Module):
    def __init__(self, nc=10):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(3,32,3,padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32,64,3,padding=1), nn.ReLU(), nn.MaxPool2d(2))
        self.fc = nn.Sequential(nn.Flatten(), nn.Linear(64*8*8,256),
            nn.ReLU(), nn.Dropout(0.5), nn.Linear(256, nc))
    def forward(self, x): return self.fc(self.conv(x))

device = torch.device('cuda' if torch.cuda.is_available() else
    'mps' if torch.backends.mps.is_available() else 'cpu')
model = CNN().to(device)
criterion, opt = nn.CrossEntropyLoss(), optim.Adam(model.parameters(), lr=0.001)

# 3. 训练
train_losses, test_accs = [], []
for epoch in range(5):
    model.train(); running_loss = 0
    for imgs, labels in train_loader:
        imgs, labels = imgs.to(device), labels.to(device)
        opt.zero_grad(); loss = criterion(model(imgs), labels)
        loss.backward(); opt.step(); running_loss += loss.item()
    train_losses.append(running_loss/len(train_loader))
    # 评估
    model.eval(); correct = 0
    with torch.no_grad():
        for imgs, labels in test_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            correct += (model(imgs).argmax(1)==labels).sum().item()
    test_accs.append(correct/len(test_ds))
    print(f"Epoch {epoch+1}: Loss={train_losses[-1]:.4f}, Acc={test_accs[-1]:.3f}")

# 4. 绘制训练曲线
fig, ax1 = plt.subplots()
ax2 = ax1.twinx()
ax1.plot(range(1,6), train_losses, 'b-o', label='Loss')
ax2.plot(range(1,6), test_accs, 'r-s', label='Accuracy')
ax1.set_xlabel('Epoch'); ax1.set_ylabel('Loss', color='b')
ax2.set_ylabel('Accuracy', color='r'); plt.title('CIFAR-10 CNN 训练曲线')
plt.show()

# 5. 可视化预测
classes = ['plane','car','bird','cat','deer','dog','frog','horse','ship','truck']
imgs, labels = next(iter(test_loader))
with torch.no_grad():
    preds = model(imgs.to(device)).argmax(1).cpu()
fig, axes = plt.subplots(4,4,figsize=(8,8))
for i, ax in enumerate(axes.flat):
    ax.imshow(imgs[i].permute(1,2,0)*0.5+0.5)
    ax.set_title(f'真:{classes[labels[i]]} 预:{classes[preds[i]]}', fontsize=9)
    ax.axis('off')
plt.tight_layout(); plt.show()`,
      expected_output: "训练 5 个 Epoch 后，测试准确率约 65%-75%。Loss 曲线从 ~2.3 持续下降至 ~0.8，准确率曲线从 ~35% 稳步上升。16 张预测图像中大多数分类正确（如飞机、青蛙、卡车等判别性强的类别），部分在猫/狗、鸟/鹿等相似类别上可能混淆。整个训练过程在 CPU 上约需 10-15 分钟。",
      reflection: [
        "如果去掉 Dropout(0.5) 和 RandomHorizontalFlip，准确率会如何变化？分别去掉其中一个，哪个影响更大？为什么？",
        "模型在哪些类别上最容易出错？如何通过计算混淆矩阵来系统性地定位模型弱点？",
        "当前 CNN 约 15 万参数。如果换成 ResNet-18（约 1100 万参数），准确率能提升多少？代价是什么？你有没有必要在 CIFAR-10 上用 ResNet？",
      ],
    },
    {
      name: "BERT 中文文本分类",
      difficulty: "advanced",
      data: "THUCNews 或中文情感分析数据集",
      tools: ["Hugging Face Transformers", "PyTorch", "Datasets", "W&B"],
      skills: ["预训练模型微调", "Tokenizer 处理", "Attention 可视化", "多分类评估"],
      goal: "掌握 BERT 预训练模型的微调流程，理解 Tokenizer 和 Attention 机制，完成高质量中文文本分类任务",
      estimated_time: "4-5小时",
      deliverables: "BERT 微调完整代码，包含 Attention 权重可视化热力图、训练/验证/测试集详细评估报告、错误案例分析",
      data_source: "HuggingFace bert-base-chinese 预训练模型（https://huggingface.co/google-bert/bert-base-chinese）+ 自定义中文情感数据集 —— 使用 transformers 库加载，模型约 110M 参数，首次运行自动下载",
      steps: [
        "安装依赖 transformers、datasets、torch，构造中文情感数据集（正面/负面各半，至少 200 条），转换为 HuggingFace Dataset 格式",
        "加载 bert-base-chinese 的 AutoTokenizer，编写 tokenize_fn 对文本进行分词、截断（max_length=128）和填充，用 map 批处理",
        "加载 AutoModelForSequenceClassification（num_labels=2），自动检测 mps/cuda/cpu 设备并迁移模型",
        "配置 TrainingArguments（3 个 Epoch、batch_size=8、evaluation_strategy='epoch'），自定义 compute_metrics 计算 accuracy",
        "使用 Trainer API 启动训练，观察每个 Epoch 的 eval_loss 和 eval_accuracy 变化",
        "在测试集上运行 trainer.predict()，打印 sklearn classification_report（precision、recall、f1-score），随机展示 5 条预测结果",
      ],
      code: `import torch, numpy as np
from transformers import (AutoTokenizer, AutoModelForSequenceClassification,
    Trainer, TrainingArguments)
from datasets import Dataset
from sklearn.metrics import accuracy_score, classification_report

# 1. 准备中文情感数据
texts = (["太好了，非常满意！","推荐，质量很好。","物流快，好评。","性价比高，值得买。","超预期，赞！"] +
         ["太差了，很失望。","不推荐，质量差。","慢死了，差评。","不值这个价。","垃圾，退货。"]) * 30
labels = [1]*150 + [0]*150  # 1=正面, 0=负面
dataset = Dataset.from_dict({'text': texts, 'label': labels})
split = dataset.train_test_split(test_size=0.2, seed=42)

# 2. Tokenizer
model_name = 'bert-base-chinese'
tokenizer = AutoTokenizer.from_pretrained(model_name)
def tokenize(batch):
    return tokenizer(batch['text'], truncation=True, padding='max_length', max_length=64)
train_ds = split['train'].map(tokenize, batched=True)
test_ds  = split['test'].map(tokenize, batched=True)

# 3. 模型与设备
device = torch.device('cuda' if torch.cuda.is_available() else
    'mps' if torch.backends.mps.is_available() else 'cpu')
model = AutoModelForSequenceClassification.from_pretrained(
    model_name, num_labels=2).to(device)

# 4. 训练配置
args = TrainingArguments(output_dir='./bert_out', num_train_epochs=3,
    per_device_train_batch_size=8, per_device_eval_batch_size=8,
    evaluation_strategy='epoch', logging_steps=10, save_strategy='no',
    no_cuda=(str(device)=='cpu'))

def compute_metrics(pred):
    preds = np.argmax(pred.predictions, axis=1)
    return {'accuracy': accuracy_score(pred.label_ids, preds)}

trainer = Trainer(model=model, args=args, train_dataset=train_ds,
    eval_dataset=test_ds, compute_metrics=compute_metrics)
trainer.train()

# 5. 评估
result = trainer.evaluate()
print(f"\\n测试准确率: {result['eval_accuracy']:.3f}")

preds_out = trainer.predict(test_ds)
pred_labels = np.argmax(preds_out.predictions, axis=1)
print(classification_report(preds_out.label_ids, pred_labels,
    target_names=['负面','正面']))

# 随机展示预测
indices = np.random.choice(len(test_ds), 5, replace=False)
for i in indices:
    print(f"文本: {test_ds[i]['text'][:40]}...")
    print(f"  真实: {preds_out.label_ids[i]}, 预测: {pred_labels[i]}")`,
      expected_output: "训练 3 个 Epoch 后，eval_loss 从 ~0.69 降至 ~0.05，准确率接近 100%（小数据集模式简单）。classification_report 显示 precision、recall、f1-score 均接近 1.0。随机 5 条测试文本全部正确分类。如果使用更大的真实数据集（如 THUCNews），准确率通常在 85%-93% 之间。首次下载模型约需 400MB 空间。",
      reflection: [
        "BERT 在仅 300 条数据上就能取得很好的效果，而传统的 TextCNN/LSTM 可能需要上万条。这种‘少样本学习能力’的来源是什么？",
        "bert-base-chinese 约 110M 参数。如果使用 albert-chinese-tiny（约 4M 参数）或冻结 BERT 前 10 层只训练分类头，效果会如何变化？为什么？",
        "max_length=64 意味着什么？如果中文文本超过 64 个 token（约 32 个汉字），会被怎样处理？这对长文本分类任务有什么影响？",
      ],
    },
    {
      name: "XGBoost 超参数自动调优",
      difficulty: "advanced",
      data: "Kaggle Tabular Playground 或结构化比赛数据集",
      tools: ["XGBoost", "Optuna", "Scikit-learn", "SHAP"],
      skills: ["贝叶斯超参搜索", "特征重要性", "模型校准", "Stacking 集成"],
      goal: "掌握使用 Optuna 对 XGBoost 进行贝叶斯超参数优化的完整流程，理解各参数对模型性能的影响机制",
      estimated_time: "3-4小时",
      deliverables: "超参数调优 Pipeline，包含参数重要性分析、优化历史可视化、SHAP 特征归因报告、最优模型与基线模型的对比",
      data_source: "sklearn.datasets.fetch_california_housing() —— 加州房价数据集，20640 条记录，8 个特征（MedInc、HouseAge、AveRooms 等），回归任务，目标为房价中位数（单位：10万美元），无需外部下载",
      steps: [
        "加载 California Housing 数据集，按 80/20 划分训练集和测试集（random_state=42）",
        "使用 XGBRegressor 默认参数训练基线模型，计算测试集 RMSE 和 R² 作为优化起点",
        "定义超参数搜索空间（n_estimators、max_depth、learning_rate、subsample、colsample_bytree），使用 RandomizedSearchCV(cv=5, n_iter=30) 进行随机搜索",
        "用 search.best_params_ 重新训练最优模型，对比优化前后的 RMSE 和 R² 提升幅度",
        "输出 feature_importances_ 并用横向条形图可视化，分析哪些特征对房价影响最大",
        "随机查看搜索过程中前 5 组最佳参数组合及其 CV 分数的变化规律",
      ],
      code: `import numpy as np, pandas as pd, matplotlib.pyplot as plt
from sklearn.datasets import fetch_california_housing
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.metrics import mean_squared_error, r2_score
import xgboost as xgb

# 1. 加载数据
data = fetch_california_housing()
X_train, X_test, y_train, y_test = train_test_split(
    data.data, data.target, test_size=0.2, random_state=42)
print(f"特征: {data.feature_names}")

# 2. 基线模型
baseline = xgb.XGBRegressor(objective='reg:squarederror', random_state=42)
baseline.fit(X_train, y_train)
y_pred = baseline.predict(X_test)
rmse_b = np.sqrt(mean_squared_error(y_test, y_pred))
r2_b = r2_score(y_test, y_pred)
print(f"基线 RMSE: {rmse_b:.4f}, R²: {r2_b:.4f}")

# 3. 超参数搜索
param_grid = {
    'n_estimators': [100, 200, 300, 500],
    'max_depth': [3, 5, 7, 9],
    'learning_rate': [0.01, 0.05, 0.1, 0.2],
    'subsample': [0.6, 0.8, 1.0],
    'colsample_bytree': [0.6, 0.8, 1.0],
}
search = RandomizedSearchCV(
    xgb.XGBRegressor(objective='reg:squarederror', random_state=42),
    param_grid, n_iter=30, cv=5, scoring='neg_mean_squared_error',
    random_state=42, n_jobs=-1, verbose=1)
search.fit(X_train, y_train)
print(f"最优参数: {search.best_params_}")

# 4. 最优模型评估
best = search.best_estimator_
y_pred_b = best.predict(X_test)
rmse_o = np.sqrt(mean_squared_error(y_test, y_pred_b))
r2_o = r2_score(y_test, y_pred_b)
print(f"优化后 RMSE: {rmse_o:.4f} (提升 {(rmse_b-rmse_o)/rmse_b*100:.1f}%)")
print(f"优化后 R²:   {r2_o:.4f} (提升 +{r2_o-r2_b:.4f})")

# 5. 特征重要性
plt.figure(figsize=(8,5))
idx = np.argsort(best.feature_importances_)
plt.barh(range(len(idx)), best.feature_importances_[idx])
plt.yticks(range(len(idx)), [data.feature_names[i] for i in idx])
plt.xlabel('Feature Importance'); plt.title('XGBoost 特征重要性')
plt.tight_layout(); plt.savefig('xgb_importance.png'); plt.show()

# 6. Top-5 搜索结果
results = pd.DataFrame(search.cv_results_)
top5 = results.nlargest(5, 'mean_test_score')[['params','mean_test_score','std_test_score']]
top5['mean_test_score'] = np.sqrt(-top5['mean_test_score'])  # 转回 RMSE
print("\\nTop-5 参数组合 (RMSE):")
print(top5.to_string(index=False))`,
      expected_output: "基线模型 RMSE 约 0.48-0.52，R² 约 0.60-0.65。RandomizedSearchCV 耗时约 30-60 秒（30 组 × 5 折 = 150 次训练），最优参数通常为 max_depth=7-9、learning_rate=0.05-0.1、n_estimators=300-500。优化后 RMSE 降低 5%-10%（约 0.43-0.48），R² 提升至 0.66-0.73。特征重要性显示 MedInc（收入中位数）和 Latitude/Longitude（地理位置）是最关键的特征。",
      reflection: [
        "RandomizedSearchCV 只尝试了 30 种参数组合，而网格中总可能组合是 4×4×4×3×3 = 576 种。为什么不全搜索？随机搜索会不会错过最优解？它背后的概率保证是什么？",
        "学习率（learning_rate）和 n_estimators 之间存在什么关系？如果 learning_rate 减半，n_estimators 应该怎么调？为什么？",
        "如果把 RandomizedSearchCV 换成 Optuna 的贝叶斯优化（TPESampler），搜索效率和最终效果会有什么不同？贝叶斯优化的核心思想是什么？",
      ],
    },
    {
      name: "DCGAN 图像生成",
      difficulty: "advanced",
      data: "CelebA 人脸或 Anime Face 动漫头像数据集",
      tools: ["PyTorch", "Torchvision", "TensorBoard", "W&B"],
      skills: ["生成对抗网络", "对抗训练技巧", "模式坍塌诊断", "潜在空间插值"],
      goal: "理解 GAN 的博弈训练原理，掌握训练稳定性技巧（如梯度惩罚、Wasserstein 距离），能生成高质量图像",
      estimated_time: "4-5小时",
      deliverables: "DCGAN 训练代码，包含生成器/判别器损失曲线、各epoch生成图像对比图、潜在空间插值动画、训练稳定性分析报告",
      data_source: "torchvision.datasets.MNIST() —— 手写数字数据集，60000 张训练图 + 10000 张测试图，28×28 灰度图像，10 个数字类别（0-9），调用即自动下载",
      steps: [
        "加载 MNIST 数据集，使用 transforms 将图像归一化到 [-1, 1]（匹配 Tanh 激活），创建 DataLoader(batch_size=128)",
        "定义 Generator：100 维噪声 → Linear(100→256)→ReLU→Linear(256→512)→ReLU→Linear(512→1024)→ReLU→Linear(1024→784)→Tanh → Reshape 为 1×28×28",
        "定义 Discriminator：Flatten(784) → Linear(784→512)→LeakyReLU(0.2)→Linear(512→256)→LeakyReLU(0.2)→Linear(256→1)→Sigmoid，输出真假概率",
        "编写对抗训练循环（20 个 Epoch）：每个 Batch 先训练判别器（真图→1，假图→0），再训练生成器（假图→1 欺骗判别器），使用 BCELoss",
        "每 5 个 Epoch，用一组固定的 64 维噪声生成图像，用 make_grid 拼成 8×8 网格并保存为 PNG，观察生成质量如何从噪声逐步变为清晰数字",
        "训练完成后，用 matplotlib 绘制 Generator Loss 和 Discriminator Loss 双曲线，分析训练是否稳定",
      ],
      code: `import torch, torch.nn as nn, torchvision
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt

# 1. 数据
transform = torchvision.transforms.Compose([
    torchvision.transforms.ToTensor(),
    torchvision.transforms.Normalize([0.5], [0.5])])
dataloader = DataLoader(torchvision.datasets.MNIST(
    './data', train=True, download=True, transform=transform),
    batch_size=128, shuffle=True)

# 2. Generator: 噪声 → 图像
class Generator(nn.Module):
    def __init__(self, zdim=100):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(zdim, 256), nn.ReLU(),
            nn.Linear(256, 512), nn.ReLU(),
            nn.Linear(512, 1024), nn.ReLU(),
            nn.Linear(1024, 784), nn.Tanh())
    def forward(self, z): return self.net(z).view(-1, 1, 28, 28)

# 3. Discriminator: 图像 → 概率
class Discriminator(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(784, 512), nn.LeakyReLU(0.2),
            nn.Linear(512, 256), nn.LeakyReLU(0.2),
            nn.Linear(256, 1), nn.Sigmoid())
    def forward(self, x): return self.net(x.view(-1, 784))

# 4. 训练准备
device = torch.device('cuda' if torch.cuda.is_available() else
    'mps' if torch.backends.mps.is_available() else 'cpu')
G, D = Generator().to(device), Discriminator().to(device)
criterion = nn.BCELoss()
g_opt = torch.optim.Adam(G.parameters(), lr=0.0002)
d_opt = torch.optim.Adam(D.parameters(), lr=0.0002)
fixed_z = torch.randn(64, 100, device=device)

# 5. 对抗训练
g_losses, d_losses = [], []
for epoch in range(20):
    g_loss_sum, d_loss_sum = 0, 0
    for real, _ in dataloader:
        real, bs = real.to(device), real.size(0)
        # 训练判别器：真→1, 假→0
        d_opt.zero_grad()
        loss_d = criterion(D(real), torch.ones(bs,1,device=device)) + \\
                 criterion(D(G(torch.randn(bs,100,device=device)).detach()),
                           torch.zeros(bs,1,device=device))
        loss_d.backward(); d_opt.step()
        # 训练生成器：假→1 (欺骗判别器)
        g_opt.zero_grad()
        loss_g = criterion(D(G(torch.randn(bs,100,device=device))),
                           torch.ones(bs,1,device=device))
        loss_g.backward(); g_opt.step()
        g_loss_sum += loss_g.item(); d_loss_sum += loss_d.item()
    g_losses.append(g_loss_sum/len(dataloader))
    d_losses.append(d_loss_sum/len(dataloader))
    print(f"Epoch {epoch+1:2d}: G={g_losses[-1]:.4f}, D={d_losses[-1]:.4f}")
    # 每 5 epoch 保存生成图
    if (epoch+1) % 5 == 0:
        with torch.no_grad():
            fake = G(fixed_z).cpu()
            grid = torchvision.utils.make_grid(fake, nrow=8, normalize=True)
            plt.imshow(grid.permute(1,2,0), cmap='gray')
            plt.title(f'DCGAN - Epoch {epoch+1}')
            plt.axis('off'); plt.savefig(f'dcgan_e{epoch+1}.png'); plt.show()

# 6. 损失曲线
plt.figure(); plt.plot(g_losses, label='Generator')
plt.plot(d_losses, label='Discriminator')
plt.xlabel('Epoch'); plt.ylabel('Loss')
plt.title('DCGAN 训练损失'); plt.legend(); plt.show()`,
      expected_output: "训练初期（Epoch 1-5），生成图像为随机噪声，完全看不出数字形状。Epoch 5-10 开始出现模糊的笔划轮廓。Epoch 10-15 数字形状逐渐清晰可辨。Epoch 15-20 生成的手写数字质量较好，大部分数字可识别。Loss 曲线中 Generator Loss 呈上升趋势（判别器越来越严格），Discriminator Loss 在 0.5-1.0 之间波动。整个训练在 CPU 上约需 30-60 分钟。如果没有看到清晰的数字生成，尝试调整学习率或增加 Epoch 数。",
      reflection: [
        "训练过程中 Generator 和 Discriminator 的 Loss 变化趋势相反——一个下降另一个上升。这和 GAN 的博弈论框架有什么关系？什么样的 Loss 变化才算是'健康'的训练？",
        "什么是模式坍塌（Mode Collapse）？如果你发现 Generator 只能生成数字'1'和'7'而忽略了其他数字，这说明了什么问题？如何诊断和缓解？",
        "当前的 DCGAN 在 MNIST（28×28 灰度）上效果不错，但换成 CelebA（64×64 彩色人脸）效果会如何？从结构上需要做哪些改动？",
      ],
    },
    {
      name: "从零实现迷你 Transformer",
      difficulty: "advanced",
      data: "WikiText-2 或自定义中文语料",
      tools: ["PyTorch", "NumPy", "einops", "Matplotlib"],
      skills: ["自注意力机制", "位置编码", "多头注意力", "Layer Normalization"],
      goal: "不借助 Transformers 库，从零实现 Transformer 的核心组件（Self-Attention、Multi-Head Attention、FFN），深入理解架构细节",
      estimated_time: "5-6小时",
      deliverables: "纯 PyTorch 实现的 Transformer 模型代码，包含注意力权重可视化、不同位置编码方案的对比、在小数据集上的训练与生成效果",
      data_source: "torch.randint() 随机生成整数序列 —— 无需外部数据集，纯 PyTorch 实现，适合在没有任何外部依赖的情况下学习和调试",
      steps: [
        "实现 PositionalEncoding：使用正弦/余弦函数生成位置编码矩阵 (max_len, d_model)，验证不同位置的编码向量之间的点积关系",
        "实现 MultiHeadAttention：将 Q/K/V 线性投影到 h 个头上，计算 scaled dot-product attention（softmax(QK^T/sqrt(d_k))V），拼接多头输出并通过 W_o 映射",
        "实现 TransformerEncoderLayer：组合 MultiHeadAttention + LayerNorm（残差连接）+ FeedForward（Linear→ReLU→Linear）+ LayerNorm（残差连接）",
        "堆叠 2-3 层 EncoderLayer 组成 MiniTransformer，添加 Embedding 和分类头，构建完整的端到端模型",
        "设计一个玩具任务（如根据第一个 token 的值进行二分类）：创建随机整数序列数据，训练 30 个 Epoch 验证模型能正常拟合训练数据",
      ],
      code: `import torch, torch.nn as nn, math

# 1. 位置编码
class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=200):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(0, max_len).float().unsqueeze(1)
        div = torch.exp(torch.arange(0, d_model, 2).float() *
                        -(math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        self.register_buffer('pe', pe.unsqueeze(0))
    def forward(self, x): return x + self.pe[:, :x.size(1)]

# 2. 多头自注意力
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        assert d_model % n_heads == 0
        self.d_k = d_model // n_heads; self.n_heads = n_heads
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

    def forward(self, x):
        B, L, D = x.shape
        Q = self.W_q(x).view(B, L, self.n_heads, self.d_k).transpose(1,2)
        K = self.W_k(x).view(B, L, self.n_heads, self.d_k).transpose(1,2)
        V = self.W_v(x).view(B, L, self.n_heads, self.d_k).transpose(1,2)
        attn = torch.softmax(Q @ K.transpose(-2,-1) / math.sqrt(self.d_k), dim=-1)
        out = (attn @ V).transpose(1,2).contiguous().view(B, L, D)
        return self.W_o(out)

# 3. Encoder 层
class TransformerEncoderLayer(nn.Module):
    def __init__(self, d_model, n_heads, d_ff):
        super().__init__()
        self.attn = MultiHeadAttention(d_model, n_heads)
        self.norm1 = nn.LayerNorm(d_model)
        self.ff = nn.Sequential(nn.Linear(d_model, d_ff), nn.ReLU(),
                                nn.Linear(d_ff, d_model))
        self.norm2 = nn.LayerNorm(d_model)
    def forward(self, x):
        x = self.norm1(x + self.attn(x))
        x = self.norm2(x + self.ff(x))
        return x

# 4. 迷你 Transformer
class MiniTransformer(nn.Module):
    def __init__(self, vocab_size=100, d_model=64, n_heads=4, d_ff=128, n_layers=2, n_classes=2):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, d_model)
        self.pe = PositionalEncoding(d_model)
        self.layers = nn.ModuleList([
            TransformerEncoderLayer(d_model, n_heads, d_ff) for _ in range(n_layers)])
        self.cls = nn.Linear(d_model, n_classes)
    def forward(self, x):
        x = self.pe(self.embed(x))
        for layer in self.layers: x = layer(x)
        return self.cls(x.mean(dim=1))

# 5. 玩具任务训练
model = MiniTransformer()
opt = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.CrossEntropyLoss()
print(f"参数量: {sum(p.numel() for p in model.parameters()):,}")

for epoch in range(30):
    x = torch.randint(0, 100, (64, 20))          # (batch=64, seq_len=20)
    y = (x[:, 0] > 50).long()                     # 第一个token决定类别
    loss = criterion(model(x), y)
    opt.zero_grad(); loss.backward(); opt.step()
    if (epoch+1) % 5 == 0:
        print(f"Epoch {epoch+1:2d}: Loss={loss.item():.4f}")

# 验证
with torch.no_grad():
    x_test = torch.randint(0, 100, (100, 20))
    y_test = (x_test[:, 0] > 50).long()
    acc = (model(x_test).argmax(1) == y_test).float().mean()
    print(f"\\n测试准确率: {acc:.3f}")`,
      expected_output: "模型参数量约 30K-80K（取决于 d_model 和层数）。训练 30 个 Epoch 后 Loss 从 ~0.7 降至 ~0.002，测试准确率接近 100%（玩具任务简单，仅依赖第一个 token）。这说明手写的 MultiHeadAttention 和 TransformerEncoderLayer 逻辑正确——模型确实学会了关注第一个 token 来做分类。如果测试准确率很低（~50%），可能是注意力机制实现有 bug，需要逐层调试。",
      reflection: [
        "在 MultiHeadAttention 中，Q @ K.transpose 的结果除以 sqrt(d_k) 的作用是什么？如果不除这个因子，训练会出什么问题？这和 softmax 的梯度性质有什么关系？",
        "残差连接（x + self.attn(x)）在 Transformer 中为什么如此重要？如果去掉残差连接，堆叠 6 层 EncoderLayer 会发生什么？这和梯度消失有什么关系？",
        "你现在实现的 Transformer 只用了一个简单的玩具任务。如果要在真实的中文文本分类任务上使用它，还需要添加哪些组件？（提示：Masking、更大的词表、预训练 Embedding）",
      ],
    },
  ],
  expert: [
    {
      name: "RAG 知识库问答系统",
      difficulty: "expert",
      data: "内存中的中文 ML 概念文档集合",
      tools: ["LangChain", "ChromaDB", "Sentence-Transformers", "NumPy"],
      skills: ["文档切分策略", "Embedding 向量化", "向量检索", "RAG 问答链路"],
      goal: "从零搭建一个完整的 RAG 系统，掌握文档切分、向量嵌入、ChromaDB 存储检索和语义问答的全流程",
      estimated_time: "4-5小时",
      deliverables: "完整的 RAG 实验脚本，包含文档切分对比、检索效果分析、不同问题类型的召回质量评估",

      data_source: "内存中硬编码的 10 条中文机器学习知识点文档，无需外部下载",      steps: [
        "加载中文 ML 知识文档列表（10条），用 RecursiveCharacterTextSplitter 按 chunk_size=80 和 overlap=20 进行语义切分",
        "使用 paraphrase-multilingual-MiniLM-L12-v2 模型将文本块编码为向量，打印向量维度和 chunk 数量",
        "用 ChromaDB 内存模式创建 collection，将 chunk 文本和向量批量写入",
        "编写 ask() 检索函数：查询词向量化后 collection.query 检索，打印 top_k 结果与距离分数",
        "测试不同类型问题（定义类、对比类、细节类），分析语义检索和关键词匹配的差异"
      ],
      code: `# RAG 知识库问答系统
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import chromadb

# 1. 内存知识库：中文 ML 知识点
documents = [
    "机器学习是人工智能的一个分支，它使计算机能够从数据中学习并做出决策。特征工程是提升模型性能的关键步骤。",
    "深度学习使用多层神经网络来学习数据的层次化表示。卷积神经网络(CNN)擅长处理图像数据。",
    "监督学习需要标注数据，模型学习从输入到输出的映射关系。常见算法包括线性回归、决策树和支持向量机。",
    "无监督学习不需要标签，算法自行发现数据中的模式和结构。聚类和降维是两大核心任务。",
    "强化学习中，智能体通过与环境交互获得奖励信号来学习最优策略。Q-learning是经典的强化学习算法。",
    "Transformer架构通过自注意力机制并行处理序列，是现代大语言模型如GPT和BERT的基础。",
    "过拟合指模型在训练数据上表现好但在测试数据上表现差。正则化和交叉验证是常用的防止过拟合的手段。",
    "梯度下降是最常用的优化算法，通过计算损失函数的梯度来迭代更新模型参数。学习率是关键超参数。",
    "集成学习通过组合多个弱学习器来构建强学习器。Bagging和Boosting是两大集成范式。",
    "BERT使用掩码语言模型和下一句预测进行预训练，在下游任务上微调即可获得卓越性能。",
]

# 2. 文档切分
splitter = RecursiveCharacterTextSplitter(chunk_size=80, chunk_overlap=20)
chunks = splitter.create_documents(documents)
print(f"原始文档 {len(documents)} 条 → 切分为 {len(chunks)} 个文本块")
for i, c in enumerate(chunks):
    print(f"  Chunk{i}: {c.page_content[:50]}...")

# 3. 向量化
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
chunk_texts = [c.page_content for c in chunks]
embeddings = model.encode(chunk_texts)
print(f"向量维度: {embeddings.shape}")

# 4. ChromaDB 存储
client = chromadb.Client()
collection = client.create_collection(name="ml_kb")
for i, (text, emb) in enumerate(zip(chunk_texts, embeddings)):
    collection.add(ids=[str(i)], embeddings=[emb.tolist()], documents=[text])

# 5. 检索问答
def ask(question, top_k=3):
    q_emb = model.encode([question])
    results = collection.query(query_embeddings=q_emb.tolist(), n_results=top_k)
    print(f"\n问题: {question}")
    for i, (doc, dist) in enumerate(zip(results['documents'][0], results['distances'][0])):
        print(f"  #{i+1} 距离={dist:.3f} | {doc[:80]}")

ask("什么是监督学习？")
ask("Transformer和CNN有什么区别？")
ask("如何防止过拟合？")`,
      expected_output: "原始 10 条文档切分为约 15-25 个文本块。每个向量 384 维。“什么是监督学习”检索到“标注数据”和“常见算法”相关内容。“Transformer和CNN有什么区别”能同时召回 Transformer 和 CNN 各自的描述。“如何防止过拟合”准确返回正则化和交叉验证相关 chunk。距离分数在 0.6-1.2 之间。",
      reflection: [
        "如果把 chunk_size 从 80 改到 200，对检索精度有什么影响？chunk 越大信息越完整还是噪声越多？",
        "用关键词检索（如 TF-IDF）和语义向量检索相比，在“什么是监督学习”这类问题上哪种效果更好？为什么？",
        "如果知识库中有两条矛盾的信息，问对应问题时模型会返回什么？这反映了 RAG 的什么局限性？"
      ],
    },
    {
      name: "FastAPI 模型部署与服务化",
      difficulty: "expert",
      data: "Scikit-learn 内置 Iris 数据集",
      tools: ["Scikit-learn", "FastAPI", "Joblib", "Pydantic", "Uvicorn"],
      skills: ["REST API 设计", "模型序列化", "Pydantic 数据校验", "API 测试"],
      goal: "将训练好的 ML 模型封装为生产可用的 REST API，掌握模型保存与加载、请求数据校验和推理服务部署的完整流程",
      estimated_time: "3-4小时",
      deliverables: "FastAPI 推理服务代码与训练脚本，包含 Swagger 自动文档、curl 测试命令和完整 API 说明",

      data_source: "sklearn.datasets.load_iris() —— 鸢尾花分类数据集，150条记录，4个特征，3个类别",      steps: [
        "加载 Iris 数据集，训练 LogisticRegression 多分类模型，打印测试集准确率",
        "用 joblib.dump 将训练好的模型序列化保存到 iris_model.joblib",
        "构建 FastAPI 应用：定义 IrisInput Pydantic 模型校验输入、/health 健康检查端点、/predict 推理端点",
        "在 /predict 中加载模型、接收 JSON 特征、调用 model.predict 和 predict_proba、返回类别名和置信度",
        "启动 uvicorn 服务，用 curl 发送 POST 请求测试实际推理效果，访问 /docs 查看 Swagger 文档"
      ],
      code: `# ===== 第一步：训练并保存模型 =====
from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
import joblib

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target, test_size=0.2, random_state=42, stratify=iris.target)

clf = LogisticRegression(max_iter=200).fit(X_train, y_train)
print(f"模型准确率: {clf.score(X_test, y_test):.3f}")
joblib.dump(clf, "iris_model.joblib")
print("模型已保存: iris_model.joblib")

# ===== 第二步：将以下代码另存为 app.py，运行 uvicorn =====
# from fastapi import FastAPI
# from pydantic import BaseModel
# import joblib, numpy as np
# from sklearn.datasets import load_iris
#
# app = FastAPI(title="Iris 分类推理服务")
# model = joblib.load("iris_model.joblib")
# iris = load_iris()
#
# class IrisInput(BaseModel):
#     sepal_length: float
#     sepal_width: float
#     petal_length: float
#     petal_width: float
#
# @app.get("/health")
# def health():
#     return {"status": "healthy", "model": "LogisticRegression_iris"}
#
# @app.post("/predict")
# def predict(data: IrisInput):
#     feats = np.array([[data.sepal_length, data.sepal_width,
#                        data.petal_length, data.petal_width]])
#     pred = model.predict(feats)[0]
#     prob = model.predict_proba(feats)[0].max()
#     return {"class": int(pred),
#             "class_name": iris.target_names[pred],
#             "confidence": round(float(prob), 4)}

print("\n启动服务: uvicorn app:app --reload")
print("API 文档: http://localhost:8000/docs")
print("健康检查: curl http://localhost:8000/health")
print("推理测试: curl -X POST http://localhost:8000/predict \\")
print("  -H 'Content-Type: application/json' \\")
print("  -d '{\"sepal_length\":5.1,\"sepal_width\":3.5,\"petal_length\":1.4,\"petal_width\":0.2}'")`,
      expected_output: "训练后准确率约 95-97%。模型序列化为 iris_model.joblib（约1KB）。启动 FastAPI 后访问 http://localhost:8000/docs 可见 Swagger 交互文档并可在线测试。curl 发送 setosa 特征 [5.1,3.5,1.4,0.2] 返回 {“class”:0,“class_name”:“setosa”,“confidence”:0.98}。/health 端点返回 {“status”:“healthy”}。",
      reflection: [
        "如果发送的特征值超出训练数据范围（如 sepal_length=100），模型仍会给出预测——这在生产环境中有什么风险？如何增加输入校验？",
        "当前 API 每次请求都从磁盘加载模型效率很低。把模型加载到全局变量后，如果模型更新了，如何实现不关停服务的热更新？",
        "如果有 1000 个并发请求同时调用 /predict，FastAPI 能处理吗？瓶颈在哪里（CPU/IO/模型推理速度）？"
      ],
    },
    {
      name: "MLflow 实验追踪与模型管理",
      difficulty: "expert",
      data: "Scikit-learn 内置 Diabetes 数据集",
      tools: ["MLflow", "Scikit-learn", "NumPy", "Pandas"],
      skills: ["实验版本管理", "参数与指标记录", "模型注册", "实验对比分析"],
      goal: "掌握 MLflow 实验追踪的完整工作流，能记录超参数、指标、模型并可视化对比多次实验结果",
      estimated_time: "3-4小时",
      deliverables: "7 个 MLflow 实验 Run 的完整记录，包含参数-指标对比表、模型 artifacts 和 MLflow UI 分析截图",

      data_source: "sklearn.datasets.load_diabetes() —— 糖尿病病程进展数据，442条记录，10个特征",      steps: [
        "初始化 MLflow，设置实验名称为 Ridge_Hyperparameter_Search，准备 7 个 alpha 值（0.001 到 10.0）",
        "循环每个 alpha：用 mlflow.start_run 创建 Run，mlflow.log_param 记录 alpha，训练 Ridge 回归模型",
        "用 5 折 cross_val_score（scoring='neg_mean_squared_error' 和 'r2'）评估模型，mlflow.log_metric 同时记录 MSE 和 R²",
        "用 mlflow.sklearn.log_model 保存每个 alpha 对应的模型 artifact",
        "用 mlflow.search_runs 检索所有 Run 构建 DataFrame 对比，启动 mlflow ui 在浏览器中查看平行坐标图和散点图"
      ],
      code: `# MLflow 实验追踪与模型管理
import mlflow
import mlflow.sklearn
from sklearn.datasets import load_diabetes
from sklearn.linear_model import Ridge
from sklearn.model_selection import cross_val_score
import numpy as np

# 1. 数据 + 实验初始化
X, y = load_diabetes(return_X_y=True)
experiment_name = "Ridge_Hyperparameter_Search"
mlflow.set_experiment(experiment_name)
print(f"实验: {experiment_name} | 数据维度: {X.shape}")

# 2. 多轮超参数实验
alphas = [0.001, 0.01, 0.1, 0.5, 1.0, 5.0, 10.0]
for alpha in alphas:
    with mlflow.start_run(run_name=f"alpha={alpha}"):
        mlflow.log_param("alpha", alpha)
        mlflow.log_param("model_type", "Ridge")

        model = Ridge(alpha=alpha)
        neg_mse = cross_val_score(model, X, y, cv=5,
                                  scoring='neg_mean_squared_error')
        r2 = cross_val_score(model, X, y, cv=5, scoring='r2')
        mse = -neg_mse.mean()

        mlflow.log_metric("mse", mse)
        mlflow.log_metric("mse_std", neg_mse.std())
        mlflow.log_metric("r2", r2.mean())

        model.fit(X, y)
        mlflow.sklearn.log_model(model, f"ridge_alpha_{alpha}")
        print(f"alpha={alpha:<6}  MSE={mse:.1f} ± {neg_mse.std():.1f}  "
              f"R²={r2.mean():.4f}")

# 3. 检索最佳实验
runs = mlflow.search_runs(
    experiment_ids=[mlflow.get_experiment_by_name(experiment_name).experiment_id])
best = runs.loc[runs["metrics.mse"].idxmin()]
print(f"\n最佳参数: alpha={best['params.alpha']}, MSE={best['metrics.mse']:.1f}")
print("\n启动可视化: mlflow ui")
print("打开浏览器访问 http://localhost:5000 查看实验对比图表")`,
      expected_output: "7 个 Run 依次打印 alpha 和对应 MSE、R²。alpha 极小时 MSE 较高（欠拟合），alpha≈0.1-0.5 时 MSE 最优约 2900，alpha 继续增大 MSE 回升（过正则化）。R² 在 alpha≈0.1 时最高约 0.49。mlflow ui 启动后可在 http://localhost:5000 看到平行坐标图和散点图，直观展示 alpha 和 MSE 的 U 型关系。",
      reflection: [
        "如果不使用交叉验证而只在训练集上评估 MSE，alpha=0.001 可能看起来最好——这说明了什么？交叉验证在超参数搜索中为什么不可或缺？",
        "MLflow 和 W&B 的核心区别是什么？各自的优劣势和适用场景是怎样的？",
        "如果团队中 3 个人同时跑实验，如何用 MLflow 的模型注册中心（Model Registry）管理模型版本和部署审批流程？"
      ],
    },
    {
      name: "LoRA/QLoRA 大模型指令微调",
      difficulty: "expert",
      data: "3 条硬编码的中文指令-回答对",
      tools: ["Hugging Face PEFT", "Transformers", "PyTorch"],
      skills: ["低秩适配 (LoRA)", "高效参数微调", "可训练参数分析", "指令数据格式化"],
      goal: "理解 LoRA 低秩微调的核心原理，掌握 LoRA 配置、参数效率分析和指令微调的基本工作流",
      estimated_time: "4-5小时",
      deliverables: "LoRA 微调配置脚本，包含参数效率分析、微调前后模型生成效果对比、LoRA 层权重分析",

      data_source: "3 条硬编码的中文机器学习指令-回答对，用于微调演示",      steps: [
        "加载基座模型 GPT-2 和分词器，设置 pad_token=eos_token，打印总参数量",
        "定义 LoraConfig：r=8, lora_alpha=16, target_modules=['c_attn']（GPT-2注意力层），用 get_peft_model 包装基座模型",
        "统计可训练参数 vs 总参数，计算参数效率比（应 < 1%），验证 LoRA 的轻量化优势",
        "准备 3 条中文指令微调数据，格式化为 '问：...\n答：...'，用 tokenizer 完成编码并打印 Token 数",
        "演示 TrainingArguments 配置（output_dir, num_train_epochs=3, per_device_train_batch_size=1），说明完整训练命令"
      ],
      code: `# LoRA 大模型指令微调演示
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, TaskType
import torch

# 1. 加载基座模型
model_name = "gpt2"
tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token = tokenizer.eos_token
base_model = AutoModelForCausalLM.from_pretrained(model_name)
total_base = sum(p.numel() for p in base_model.parameters())
print(f"基座模型: {model_name} | 总参数: {total_base:,}")

# 2. LoRA 配置
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=8,                  # 低秩矩阵的秩——秩越小参数越少
    lora_alpha=16,        # 缩放因子——alpha/r 决定更新幅度
    lora_dropout=0.1,     # LoRA 层的 Dropout 比例
    target_modules=["c_attn"],  # GPT-2 的注意力投影矩阵
)
peft_model = get_peft_model(base_model, lora_config)

# 3. 参数效率分析
trainable = sum(p.numel() for p in peft_model.parameters() if p.requires_grad)
total = sum(p.numel() for p in peft_model.parameters())
print(f"\nLoRA 参数统计:")
print(f"  可训练参数: {trainable:,}  ({100*trainable/total:.2f}%)")
print(f"  冻结参数:   {total - trainable:,}  ({100*(total-trainable)/total:.2f}%)")
print(f"  全量微调需要更新 {total:,} 个参数")
print(f"  LoRA 仅需更新  {trainable:,} 个参数 —— 减少 {100*(1-trainable/total):.2f}%!")

# 4. 中文指令微调数据
instructions = [
    {"input": "什么是机器学习？",
     "output": "机器学习是一种人工智能技术，它使计算机能够从数据中自动学习规律和模式，无需明确编程。"},
    {"input": "如何防止过拟合？",
     "output": "防止过拟合的常见方法包括：正则化(L1/L2)、交叉验证、早停法、数据增强和Dropout技术。"},
    {"input": "Transformer的核心机制是什么？",
     "output": "Transformer的核心是自注意力机制，让模型在处理每个词时都能关注序列中所有其他词，实现并行计算和长距离依赖建模。"},
]

def format_instruction(example):
    return f"问：{example['input']}\n答：{example['output']}"

for inst in instructions:
    text = format_instruction(inst)
    tokens = tokenizer(text, return_tensors="pt")
    print(f"\n指令: {inst['input']}")
    print(f"  Token数: {tokens['input_ids'].shape[1]}")

print(f"\n\n=== LoRA 配置已就绪！===")
print(f"数据: {len(instructions)} 条中文指令样本")
print(f"关键结论: 仅 {100*trainable/total:.2f}% 参数参与训练，"
      f"显存需求从全量微调的 ~4GB 降至 ~500MB，消费级 GPU 即可微调大模型。")
print(f"\n完整训练命令:")
print(f"  from transformers import Trainer, TrainingArguments")
print(f"  trainer = Trainer(model=peft_model, args=TrainingArguments(")
print(f"      output_dir='./lora_output', num_train_epochs=3,")
print(f"      per_device_train_batch_size=1, logging_steps=1),")
print(f"      train_dataset=train_dataset)")
print(f"  trainer.train()")
print(f"  peft_model.save_pretrained('./lora_adapter')")`,
      expected_output: "GPT-2 总参数约 1.24 亿。LoRA(r=8) 仅引入约 29.4 万可训练参数，仅占 0.24%。也就是说，99.76% 的参数被冻结。3 条指令样本的 Token 数在 15-40 之间（中文 tokenize 后比英文长）。打印信息清楚展示：全量微调需更新 1.24 亿参数并占用约 4GB 显存，而 LoRA 只需更新 29 万参数、约 500MB 显存。",
      reflection: [
        "r=4 和 r=16 对可训练参数数量和微调效果分别有什么影响？r 是不是越大越好？alpha/r 的比值决定了 LoRA 权重的缩放大小——这个比值越大意味着什么？",
        "target_modules 选择 ['c_attn'] 和 ['c_attn', 'c_fc', 'c_proj'] 有什么区别？什么时候应该扩大 target 范围？",
        "如果只有这 3 条训练数据，模型真的能学会指令跟随吗？还是只会死记硬背？LoRA 需要多少数据才能产生有意义的泛化？"
      ],
    },
    {
      name: "端到端ML项目实战",
      difficulty: "expert",
      data: "Scikit-learn 内置 California Housing 数据集",
      tools: ["Scikit-learn", "XGBoost", "Pandas", "Matplotlib", "Seaborn", "Joblib"],
      skills: ["探索性数据分析", "特征工程", "多模型对比", "交叉验证", "模型部署准备"],
      goal: "从零完成一个完整的 ML 项目，覆盖数据探索、特征工程、多模型训练评估到最优模型导出的全流程",
      estimated_time: "4-5小时",
      deliverables: "端到端 ML 项目 Notebook，包含 EDA 报告、特征工程策略、三模型详细对比表和已保存的生产就绪模型文件",

      data_source: "sklearn.datasets.fetch_california_housing() —— 加州房价数据，20640条记录，8个特征",      steps: [
        "加载 California Housing 数据，用 df.describe() 和 df.info() 完成基础 EDA，绘制特征分布直方图和相关性热力图",
        "分析相关性矩阵：找出与房价最相关的 top3 特征，创建新特征 rooms_per_household = AveRooms / (AveOccup + 1)",
        "用 train_test_split(80/20) 划分数据，StandardScaler 标准化，确保训练和测试集分布一致",
        "对比 3 个模型——LinearRegression（基线）、RandomForestRegressor（集成）、XGBRegressor（提升）——用 5 折 cross_val_score 评估 R² 和 MSE",
        "选取 Test R² 最高的模型，用 joblib 同时保存模型和 scaler，验证加载后推理结果一致性"
      ],
      code: `# 端到端ML项目实战：加州房价预测
from sklearn.datasets import fetch_california_housing
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import joblib

# 1. 数据加载 + EDA
data = fetch_california_housing()
df = pd.DataFrame(data.data, columns=data.feature_names)
df['Price'] = data.target
print(f"数据: {df.shape[0]} 条, {df.shape[1]} 列")
print("\n描述性统计:")
print(df.describe().round(2))

# 2. 相关性分析
corr = df.corr()
top3 = corr['Price'].abs().sort_values(ascending=False)[1:4]
print(f"\n与房价最相关的 Top3 特征:")
for feat, val in top3.items():
    print(f"  {feat}: r = {val:.3f}")

plt.figure(figsize=(10, 7))
sns.heatmap(corr, annot=True, fmt='.2f', cmap='RdBu_r', center=0,
            square=True, linewidths=0.5)
plt.title('特征相关性矩阵热力图'); plt.tight_layout(); plt.show()

# 3. 特征工程 + 划分
df['rooms_per_household'] = df['AveRooms'] / (df['AveOccup'] + 1)
X = df.drop('Price', axis=1)
y = df['Price']
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42)
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)
print(f"\n训练集: {X_train_s.shape}, 测试集: {X_test_s.shape}")

# 4. 三模型对比
models = {
    'LinearRegression': LinearRegression(),
    'RandomForest': RandomForestRegressor(
        n_estimators=100, max_depth=15, random_state=42),
    'XGBoost': XGBRegressor(
        n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42),
}

print("\n模型对比:")
for name, model in models.items():
    cv_r2 = cross_val_score(model, X_train_s, y_train, cv=5, scoring='r2')
    cv_mse = -cross_val_score(model, X_train_s, y_train, cv=5,
                               scoring='neg_mean_squared_error')
    model.fit(X_train_s, y_train)
    test_r2 = model.score(X_test_s, y_test)
    print(f"{name:<20} CV R²={cv_r2.mean():.4f}±{cv_r2.std():.4f}  "
          f"MSE={cv_mse.mean():.4f}  Test R²={test_r2:.4f}")

# 5. 最佳模型保存
best_name = max(models, key=lambda k: models[k].score(X_test_s, y_test))
best_model = models[best_name]
joblib.dump(best_model, 'best_model.joblib')
joblib.dump(scaler, 'scaler.joblib')
print(f"\n最佳模型: {best_name} | Test R²={best_model.score(X_test_s, y_test):.4f}")
print("已保存 best_model.joblib + scaler.joblib")

# 验证加载一致性
loaded_model = joblib.load('best_model.joblib')
sample = X_test_s[:3]
orig_pred = best_model.predict(sample)
load_pred = loaded_model.predict(sample)
print(f"保存前预测: {np.round(orig_pred, 3)}")
print(f"加载后预测: {np.round(load_pred, 3)}")
assert np.allclose(orig_pred, load_pred), "加载不一致！"
print("验证通过: 加载后预测与保存前完全一致")`,
      expected_output: "数据 20640 条 9 列（含 Price）。MedInc（收入中位数）与房价相关度最高（r=0.69），其次是 AveRooms（r=0.15）。LinearRegression 基线 R²≈0.60，RandomForest R²≈0.80，XGBoost 通常最优 R²≈0.82。三者中 XGBoost 默认胜出。模型文件和 scaler 都已保存到磁盘，加载后预测结果与保存前完全一致（assert 通过）。",
      reflection: [
        "RandomForest 和 XGBoost 的 R² 都远超线性回归——说明房价数据中存在明显的非线性关系。你能联想生活中什么例子说明了房价和收入之间的非线性关系吗？",
        "如果这个模型要部署到生产环境，你还缺哪些步骤？数据漂移检测、模型监控、A/B 测试——缺一不可的三个环节分别做什么？",
        "当前只用 R² 评估模型。对于房价预测这种回归任务，MAE 或 RMSE 是否更合适？为什么？MAE 的单位是什么？它告诉我们什么信息？"
      ],
    },
  ],

};

export const TOOLS_DATA: ToolItem[] = [
  // ── Python 核心库 ──────────────────────────────
  { name: "NumPy", description: "几乎所有 ML 实验的第一步——用 ndarray 代替 Python 列表，向量化计算比 for 循环快 100 倍。实验「从零实现线性回归」的核心依赖。", category: "python-libs", url: "https://numpy.org", difficulty: "beginner", pip_install: "pip install numpy", best_for: "数值计算、矩阵运算、随机数生成", related_experiments: ["从零实现线性回归", "NumPy 向量化运算与矩阵操作", "KNN 手写数字分类器"] },
  { name: "Pandas", description: "用 df.head() 一眼看数据，df.describe() 秒出统计量。实验「Pandas 数据探索」里 80% 的代码都是 Pandas。", category: "python-libs", url: "https://pandas.pydata.org", difficulty: "beginner", pip_install: "pip install pandas", best_for: "表格数据读写、清洗、分组统计", related_experiments: ["Pandas 数据探索与可视化实战", "特征工程流水线构建"] },
  { name: "Matplotlib", description: "一图胜千言。从简单的折线图到复杂的子图布局，plt.plot() 和 plt.scatter() 是每个实验的标配。", category: "visualization", url: "https://matplotlib.org", difficulty: "beginner", pip_install: "pip install matplotlib", best_for: "数据可视化、损失曲线、决策边界", related_experiments: ["从零实现线性回归", "K-Means 客户分群与用户画像", "PCA 降维与高维数据可视化"] },
  { name: "Seaborn", description: "Matplotlib 的美颜版——一行 sns.heatmap() 画相关性矩阵，sns.countplot() 画分类分布。Titanic 实验用它省了至少 20 行代码。", category: "visualization", url: "https://seaborn.pydata.org", difficulty: "beginner", pip_install: "pip install seaborn", best_for: "统计图表、热力图、箱线图", related_experiments: ["Pandas 数据探索与可视化实战"] },
  { name: "Scikit-learn", description: "经典 ML 的「瑞士军刀」——从数据划分到模型训练再到评估，统一 fit/predict/score 三件套。入门到进阶实验用它最多。", category: "python-libs", url: "https://scikit-learn.org", difficulty: "beginner", pip_install: "pip install scikit-learn", best_for: "经典 ML 全流程：分类、回归、聚类、降维", related_experiments: ["KNN 手写数字分类器", "逻辑回归分类与决策边界可视化", "K-Means 客户分群与用户画像", "决策树可视化与模型解释", "PCA 降维与高维数据可视化", "特征工程流水线构建", "训练集与测试集划分实践"] },
  // ── ML 框架 ────────────────────────────────────
  { name: "PyTorch", description: "深度学习的第一选择——动态计算图让调试像普通 Python 一样自然。从 CNN 到 Transformer，实验 11-15 的引擎。", category: "ml-frameworks", url: "https://pytorch.org", difficulty: "intermediate", pip_install: "pip install torch torchvision", best_for: "深度学习：CNN、RNN、Transformer、GAN", related_experiments: ["PyTorch CNN 图像分类器", "DCGAN 图像生成", "从零实现迷你 Transformer"] },
  { name: "XGBoost", description: "表格数据比赛的冠军算法——几乎不需要调参就能拿到不错的 baseline。实验 13 用它跑超参搜索。", category: "ml-frameworks", url: "https://xgboost.readthedocs.io", difficulty: "intermediate", pip_install: "pip install xgboost", best_for: "结构化数据分类/回归，Kaggle 竞赛", related_experiments: ["XGBoost 超参数自动调优", "端到端机器学习项目实战"] },
  { name: "LightGBM", description: "微软出品的梯度提升——比 XGBoost 更快，内存更省，自带类别特征处理。百万行数据也能秒出结果。", category: "ml-frameworks", url: "https://lightgbm.readthedocs.io", difficulty: "intermediate", pip_install: "pip install lightgbm", best_for: "大规模表格数据，特征维度高", related_experiments: ["端到端机器学习项目实战"] },
  // ── 数据工具 ──────────────────────────────────
  { name: "Jupyter Notebook", description: "ML 实验的「实验室笔记本」——代码、图表、笔记写在一个文件里。所有实验都用 .ipynb 格式交付。", category: "data-tools", url: "https://jupyter.org", difficulty: "beginner", pip_install: "pip install notebook", best_for: "交互式编程、实验记录、教学演示", related_experiments: [] },
  { name: "Google Colab", description: "免费 GPU 的 Jupyter——不需要装任何东西，浏览器打开就能跑 PyTorch。共享链接别人就能复现你的实验。", category: "data-tools", url: "https://colab.research.google.com", difficulty: "beginner", pip_install: "无需安装，浏览器访问", best_for: "零环境配置、免费 GPU、协作分享", related_experiments: [] },
  // ── 部署 ──────────────────────────────────────
  { name: "FastAPI", description: "3 行代码启动一个 API 服务，自动生成 Swagger 文档。实验 17 把训练好的模型包装成 REST API 就是用它。", category: "deployment", url: "https://fastapi.tiangolo.com", difficulty: "advanced", pip_install: "pip install fastapi uvicorn", best_for: "模型部署为 REST API、微服务", related_experiments: ["FastAPI 模型部署与服务化", "RAG 知识库问答系统"] },
  { name: "Docker", description: "「在我机器上能跑」的终极解决方案——把代码和环境打包成镜像，一键部署到任何服务器。", category: "deployment", url: "https://docker.com", difficulty: "advanced", pip_install: "需安装 Docker Desktop", best_for: "环境一致性、一键部署、微服务编排", related_experiments: ["FastAPI 模型部署与服务化"] },
  // ── 实验追踪 ──────────────────────────────────
  { name: "MLflow", description: "记录每一次实验的参数和结果，再也不怕「上周那个参数是啥来着」。实验 18 用它对比 7 组超参数。", category: "experiment-tracking", url: "https://mlflow.org", difficulty: "intermediate", pip_install: "pip install mlflow", best_for: "实验管理、参数追踪、模型版本对比", related_experiments: ["MLflow 实验追踪与模型管理"] },
  { name: "Weights & Biases", description: "把训练曲线、模型结构、系统资源全部可视化到一个 Dashboard 上，团队协作神器。", category: "experiment-tracking", url: "https://wandb.ai", difficulty: "intermediate", pip_install: "pip install wandb", best_for: "深度学习训练监控、团队协作", related_experiments: ["PyTorch CNN 图像分类器", "DCGAN 图像生成"] },
  { name: "Optuna", description: "别再手动试参数了——告诉它要优化的指标，它会自动找到最佳超参数组合。实验 13 的核心工具。", category: "experiment-tracking", url: "https://optuna.org", difficulty: "intermediate", pip_install: "pip install optuna", best_for: "超参数自动优化、贝叶斯搜索", related_experiments: ["XGBoost 超参数自动调优"] },
  // ── LLM 工具 ──────────────────────────────────
  { name: "Hugging Face", description: "AI 界的 GitHub——数万个预训练模型一键下载，从 BERT 到 GPT 到 Stable Diffusion。实验 12 和 19 的核心。", category: "llm-tools", url: "https://huggingface.co", difficulty: "intermediate", pip_install: "pip install transformers", best_for: "预训练模型下载、模型分享、Demo 部署", related_experiments: ["BERT 中文文本分类", "LoRA/QLoRA 大模型指令微调"] },
  { name: "LangChain", description: "LLM 应用开发框架——把模型、数据库、搜索串成一条链。实验 16 的 RAG 系统就是用它搭的。", category: "llm-tools", url: "https://langchain.com", difficulty: "advanced", pip_install: "pip install langchain langchain-community", best_for: "RAG 系统、Agent、工具调用", related_experiments: ["RAG 知识库问答系统"] },
  { name: "ChromaDB", description: "开源的向量数据库——把文本变成向量存起来，用语义搜索而不是关键词匹配。RAG 系统的「记忆」。", category: "llm-tools", url: "https://www.trychroma.com", difficulty: "intermediate", pip_install: "pip install chromadb", best_for: "向量存储与检索、语义搜索", related_experiments: ["RAG 知识库问答系统"] },
  { name: "Ollama", description: "一行命令本地跑大模型——ollama run qwen2.5 就能在自己的电脑上和 AI 对话，不需要联网。", category: "llm-tools", url: "https://ollama.com", difficulty: "intermediate", pip_install: "需安装 Ollama Desktop，然后 pip install ollama", best_for: "本地运行开源 LLM、隐私敏感场景", related_experiments: [] },
  // ── 云平台 ────────────────────────────────────
  { name: "Hugging Face Spaces", description: "免费的 ML Demo 托管——把你的模型做成网页应用，别人打开链接就能用。实验 17 的 API 可以部署到这里。", category: "cloud-platforms", url: "https://huggingface.co/spaces", difficulty: "intermediate", pip_install: "无需安装，Web 端操作", best_for: "免费部署 ML Demo、作品展示", related_experiments: ["FastAPI 模型部署与服务化"] },
  { name: "Modal", description: "按秒计费的 GPU 云——需要跑实验但没有显卡？花几毛钱就能租一张 A100 用一小时。", category: "cloud-platforms", url: "https://modal.com", difficulty: "advanced", pip_install: "pip install modal", best_for: "按需 GPU 训练、成本敏感型项目", related_experiments: ["LoRA/QLoRA 大模型指令微调"] },
];

export const RESOURCES_DATA: ResourceItem[] = [
  // ── 书籍 ───────────────────────────────────────
  { title: "机器学习（西瓜书）", type: "book", description: "周志华著，国内最经典的 ML 教材，理论体系完整，涵盖监督学习、集成学习、聚类等核心主题", url: "https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm", rating: 5, difficulty_level: "beginner", best_for: "ML 零基础入门者，希望建立完整理论框架的学习者" },
  { title: "统计学习方法（第2版）", type: "book", description: "李航著，10 种核心算法的严谨数学推导，每章配有习题，适合打牢理论基础", url: "https://github.com/fengdu78/lihang-code", rating: 5, difficulty_level: "intermediate", best_for: "希望深入理解算法数学原理的进阶学习者" },
  { title: "动手学深度学习 (d2l.ai)", type: "book", description: "李沐等著，理论 + PyTorch/MXNet 代码实现双轨并行，交互式 Jupyter 练习", url: "https://d2l.ai", rating: 5, difficulty_level: "intermediate", best_for: "偏好理论结合实践的深度学习入门者" },
  { title: "Deep Learning（花书）", type: "book", description: "Goodfellow、Bengio、Courville 合著，深度学习领域圣经级参考，数学密集", url: "https://www.deeplearningbook.org", rating: 5, difficulty_level: "advanced", best_for: "有数学基础、希望系统理解深度学习理论的进阶者" },
  { title: "Pattern Recognition and Machine Learning (PRML)", type: "book", description: "Christopher Bishop 著，贝叶斯视角的机器学习经典，概率图模型与推断方法论", url: "https://www.microsoft.com/en-us/research/publication/pattern-recognition-machine-learning/", rating: 5, difficulty_level: "expert", best_for: "研究生水平、追求贝叶斯方法深度的研究者" },
  // ── 课程 ───────────────────────────────────────
  { title: "吴恩达 Machine Learning Specialization", type: "course", description: "Coursera 金牌课程，覆盖回归、分类、神经网络、推荐系统，零基础友好", url: "https://www.coursera.org/specializations/machine-learning-introduction", rating: 5, difficulty_level: "beginner", best_for: "完全的 ML 新手，希望通过英文视频系统入门者" },
  { title: "李宏毅 机器学习 2024", type: "course", description: "台湾大学公开课，中文授课，讲解生动，覆盖 Transformer、生成模型等前沿主题", url: "https://speech.ee.ntu.edu.tw/~hylee/ml/2024-spring.php", rating: 5, difficulty_level: "intermediate", best_for: "中文母语学习者，希望了解深度学习和前沿技术" },
  { title: "Stanford CS224N: NLP with Deep Learning", type: "course", description: "斯坦福 NLP 王牌课程，从 word2vec 到 GPT，覆盖 NLP 完整技术栈", url: "https://web.stanford.edu/class/cs224n/", rating: 5, difficulty_level: "advanced", best_for: "有一定 DL 基础、专注 NLP 方向的学习者" },
  { title: "Fast.ai Practical Deep Learning", type: "course", description: "自上而下教学法，先实践后理论，用 fastai 库快速取得成果", url: "https://course.fast.ai", rating: 4, difficulty_level: "beginner", best_for: "喜欢动手实践、快速看到成果的编程爱好者" },
  { title: "Stanford CS231N: CNNs for Visual Recognition", type: "course", description: "计算机视觉经典课程，从图像分类到生成与检测，作业扎实", url: "https://cs231n.stanford.edu", rating: 5, difficulty_level: "advanced", best_for: "专注计算机视觉方向、有一定 DL 基础的学习者" },
  // ── 论文 ───────────────────────────────────────
  { title: "Attention Is All You Need (2017)", type: "paper", description: "Transformer 架构开山之作，提出自注意力机制替代 RNN，彻底改变 NLP 与 DL 格局", url: "https://arxiv.org/abs/1706.03762", rating: 5, difficulty_level: "advanced", best_for: "所有希望深入理解 Transformer 和现代 LLM 基础的人" },
  { title: "BERT: Pre-training of Deep Bidirectional Transformers (2019)", type: "paper", description: "提出掩码语言模型预训练范式，开启 NLP 的预训练+微调时代", url: "https://arxiv.org/abs/1810.04805", rating: 5, difficulty_level: "advanced", best_for: "NLP 方向研究者与工程师" },
  { title: "LoRA: Low-Rank Adaptation of Large Language Models (2021)", type: "paper", description: "低秩矩阵分解实现高效 LLM 微调，大幅降低训练参数量与显存需求", url: "https://arxiv.org/abs/2106.09685", rating: 5, difficulty_level: "expert", best_for: "从事 LLM 微调与高效训练的从业者" },
  { title: "Denoising Diffusion Probabilistic Models (2020)", type: "paper", description: "DDPM 提出简洁的扩散生成框架，为 DALL-E 2 和 Stable Diffusion 奠定基础", url: "https://arxiv.org/abs/2006.11239", rating: 5, difficulty_level: "advanced", best_for: "对生成模型感兴趣的深度学习研究者" },
  { title: "Deep Residual Learning for Image Recognition (2016)", type: "paper", description: "ResNet 残差网络论文，引入跳连解决深层网络退化问题，CV 领域里程碑", url: "https://arxiv.org/abs/1512.03385", rating: 5, difficulty_level: "intermediate", best_for: "所有 CNN/DL 学习者必读的经典论文" },
  // ── 网站 ───────────────────────────────────────
  { title: "Papers With Code", type: "website", description: "论文与代码关联平台，追踪最新 ML 论文排行榜与 SOTA 实现", url: "https://paperswithcode.com", rating: 5, difficulty_level: "advanced", best_for: "追踪 SOTA 进展的研究者和工程师" },
  { title: "Hugging Face 模型中心", type: "website", description: "全球最大预训练模型共享平台，提供推理 Widget、模型卡片与社区讨论", url: "https://huggingface.co/models", rating: 5, difficulty_level: "intermediate", best_for: "需要快速找到和使用预训练模型的开发者" },
  { title: "Distill.pub", type: "website", description: "交互式 ML 研究期刊，以精美可视化讲解复杂概念，如注意力机制、特征可视化", url: "https://distill.pub", rating: 5, difficulty_level: "intermediate", best_for: "偏好可视化直觉理解的 ML 学习者" },
  { title: "动手学深度学习 (d2l.ai) 网站", type: "website", description: "李沐团队维护的交互式 DL 教科书网站，代码可直接运行，内容持续更新", url: "https://zh.d2l.ai", rating: 5, difficulty_level: "intermediate", best_for: "所有等级的 PyTorch 学习者" },
  { title: "MLOps Community", type: "website", description: "MLOps 实践者社区，提供生产级 ML 最佳实践、案例研究与工具评测", url: "https://mlops.community", rating: 4, difficulty_level: "advanced", best_for: "ML 工程师和部署方向的从业者" },
  // ── 竞赛平台 ──────────────────────────────────
  { title: "Kaggle", type: "competition", description: "全球最大数据科学竞赛平台，海量公开数据集、Notebook 环境与竞赛奖金", url: "https://kaggle.com", rating: 5, difficulty_level: "intermediate", best_for: "希望通过实战项目提升技能的各级别学习者" },
  { title: "天池 (Tianchi)", type: "competition", description: "阿里云数据竞赛平台，企业真实场景数据，涵盖 CV/NLP/推荐系统等方向", url: "https://tianchi.aliyun.com", rating: 5, difficulty_level: "intermediate", best_for: "希望接触中国企业级 ML 场景的学习者" },
  { title: "和鲸社区 (Heywhale)", type: "competition", description: "国内数据科学社区，竞赛 + 在线 Notebook + 课程 + 算力一体化平台", url: "https://www.heywhale.com", rating: 4, difficulty_level: "beginner", best_for: "中文母语、希望在国内生态中学习实践的数据科学爱好者" },
  // ── 社区 ───────────────────────────────────────
  { title: "Datawhale 开源社区", type: "community", description: "国内最大的 AI 开源学习社区，组织组队学习、开源教程翻译与项目实践", url: "https://datawhale.club", rating: 5, difficulty_level: "beginner", best_for: "希望参与组队学习和开源贡献的中文学习者" },
  { title: "r/MachineLearning (Reddit)", type: "community", description: "全球最大的 ML 社区讨论版，汇集论文讨论、行业新闻与技术问答", url: "https://reddit.com/r/MachineLearning", rating: 4, difficulty_level: "intermediate", best_for: "希望追踪国际 ML 前沿讨论和社区动态的学习者" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  "python-libs": "Python 核心库",
  "ml-frameworks": "ML 框架",
  "data-tools": "数据工具",
  visualization: "可视化",
  deployment: "模型部署",
  "experiment-tracking": "实验追踪",
  "llm-tools": "LLM 工具",
  "cloud-platforms": "云平台",
  // 保留旧兼容键
  "dev-env": "开发环境",
  "data-processing": "数据处理",
  "ml-lib": "经典 ML 库",
  "dl-framework": "深度学习框架",
  "llm-ecosystem": "大模型生态",
  inference: "推理与部署",
  "vector-db": "向量数据库",
  mlops: "MLOps",
};

export const DIFFICULTY_LABELS: Record<string, { label: string; variant: string }> = {
  beginner: { label: "入门", variant: "success" },
  intermediate: { label: "中级", variant: "warning" },
  advanced: { label: "高级", variant: "danger" },
  expert: { label: "专家", variant: "info" },
};

export const RESOURCE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  book: { label: "书籍", color: "var(--ws-color-primary)" },
  course: { label: "课程", color: "var(--ws-color-success)" },
  paper: { label: "论文", color: "var(--ws-color-purple, #8B5CF6)" },
  website: { label: "网站", color: "var(--ws-color-info, #3B82F6)" },
  competition: { label: "竞赛", color: "var(--ws-color-warning)" },
  community: { label: "社区", color: "var(--ws-color-orange, #F97316)" },
  github: { label: "GitHub", color: "var(--ws-color-purple, #8B5CF6)" },
};

// 学习地图 - Markdown mind map
export const MINDMAP_MARKDOWN = `# 机器学习
## 监督学习
### 分类
#### K近邻 (KNN)
##### 核心思想：近朱者赤
##### 距离度量：欧氏距离
##### K值选择：奇数避免平局
##### 优点：简单直观无需训练
##### 缺点：预测慢占内存
#### 朴素贝叶斯
##### 核心思想：用概率公式算类别
##### 贝叶斯定理：P(A|B)=P(B|A)P(A)/P(B)
##### 朴素假设：特征独立
##### 应用：垃圾邮件过滤
##### 拉普拉斯平滑
#### 决策树
##### 核心思想：像做选择题一样分类
##### 分裂标准：信息增益·基尼系数
##### 熵：衡量混乱程度
##### 过拟合→剪枝
##### 优点：可解释性强
#### 随机森林
##### 核心思想：多棵树投票
##### Bagging：Bootstrap采样
##### 特征重要性
##### 优点：稳健抗噪
##### 缺点：模型较大
#### 支持向量机 (SVM)
##### 核心思想：找最宽分界线
##### 支持向量：边界上的点
##### 核函数：低维→高维
##### 软间隔：允许少量错误
#### 逻辑回归
##### 核心思想：Sigmoid→概率
##### 决策边界：P=0.5的线
##### 最大似然估计
##### 应用：二分类问题
### 回归
#### 线性回归
##### 核心思想：最小二乘法
##### 公式：y=wx+b
##### R²决定系数
##### 多元回归
##### 正则化：Ridge·Lasso
### 模型评估
#### 混淆矩阵
##### TP·FP·FN·TN
#### 精确率与召回率
##### P=TP/(TP+FP)
##### R=TP/(TP+FN)
##### F1=2PR/(P+R)
#### ROC与AUC
##### 真正率vs假正率
##### AUC越大越好
#### 交叉验证
##### K折交叉验证
##### 为什么需要验证集
## 无监督学习
### 聚类
#### K-Means
##### 核心思想：自动分组
##### 三步循环：分配→更新→重复
##### 肘部法则选K
##### K-Means++初始化
#### DBSCAN
##### 基于密度的聚类
##### 不需要指定K
##### 能发现任意形状
### 降维
#### PCA
##### 核心思想：找方差最大方向
##### 协方差矩阵→特征分解
##### 主成分=新坐标系
##### 解释方差比
## 强化学习
### Q-Learning
##### 核心思想：试错学习
##### Agent·Env·Reward
##### Bellman方程
##### 探索vs利用
##### AlphaGo案例
## 深度学习
### 神经网络基础
##### 感知机：单神经元
##### 多层网络
##### 激活函数：ReLU·Sigmoid
##### 反向传播
##### 梯度下降：SGD·Adam
### 卷积神经网络 (CNN)
##### 卷积核=特征检测器
##### 池化=缩小保留
##### LeNet→ResNet
##### 应用：图像分类
### Transformer
##### 自注意力机制
##### Q·K·V三个矩阵
##### BERT vs GPT
##### 大语言模型基础
## 核心工具
### 特征工程
##### 归一化：x→(x-μ)/σ
##### One-Hot编码
##### 特征选择
##### 特征构造
### 损失函数
##### MSE：均方误差
##### 交叉熵：分类用
##### 为什么分类不用MSE
`;
