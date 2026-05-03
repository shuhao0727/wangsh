/** 机器学习学习板块内置内容。 */

export type StageStatus = "pending" | "in-progress" | "completed";
export interface RoadmapStage {
  id: string;
  name: string;
  duration: string;
  topics: string[];
  milestones: string[];
  status: StageStatus;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  children?: KnowledgeNode[];
  description?: string;
}

export interface Experiment {
  name: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  data: string;
  tools: string[];
  skills: string[];
}

export interface ToolItem {
  name: string;
  description: string;
  category: string;
  url?: string;
}

export interface ResourceItem {
  title: string;
  type: "book" | "course" | "github" | "competition";
  description: string;
  url: string;
  rating?: number;
}

export const ROADMAP_STAGES: RoadmapStage[] = [
  {
    id: "basics",
    name: "入门基础",
    duration: "4-6 周",
    topics: ["数学基础回顾（线性代数、概率论）", "Python 编程基础", "NumPy / Pandas 数据处理", "Matplotlib / Seaborn 数据可视化", "机器学习基本概念与术语"],
    milestones: ["掌握 Python 数据处理全流程", "理解监督学习 vs 无监督学习", "完成第一个 ML 小项目"],
    status: "pending",
  },
  {
    id: "core-algorithms",
    name: "核心算法",
    duration: "10-14 周",
    topics: ["线性回归与逻辑回归", "决策树与随机森林", "支持向量机 (SVM)", "K 近邻与 K-Means 聚类", "主成分分析 (PCA) 与 t-SNE", "集成学习：Bagging / Boosting / XGBoost / LightGBM", "特征工程与模型评估 (交叉验证 / A/B 测试)"],
    milestones: ["掌握 5+ 经典 ML 算法原理", "能够独立完成特征工程与数据清洗", "理解交叉验证与超参数调优", "提交 Kaggle 入门竞赛"],
    status: "pending",
  },
  {
    id: "deep-learning",
    name: "深度学习",
    duration: "10-16 周",
    topics: ["神经网络基础与反向传播", "卷积神经网络 (CNN) 与视觉模型 (ViT)", "循环神经网络 (RNN / LSTM)", "注意力机制与 Transformer 架构", "生成对抗网络 (GAN) 与扩散模型", "自编码器与表征学习", "PyTorch / TensorFlow 框架实战"],
    milestones: ["理解深度学习核心原理", "用 PyTorch 搭建 CNN 图像分类器", "实现 RNN 文本生成模型", "理解 Transformer 与注意力机制原理"],
    status: "pending",
  },
  {
    id: "projects",
    name: "实战项目",
    duration: "8-12 周",
    topics: ["计算机视觉项目：目标检测 / 图像分割", "自然语言处理项目：情感分析 / 机器翻译", "RAG 知识库问答系统：Embedding + 向量检索 + LLM 生成", "推荐系统项目：协同过滤 / 矩阵分解", "端到端 ML 项目：从数据收集到模型部署", "MLOps 实践：实验管理 / CI/CD / 模型监控"],
    milestones: ["完成 3+ 完整 ML 项目（含报告）", "掌握模型部署流程（Flask/FastAPI）", "搭建一个基于 RAG 的智能问答系统", "能用 MLflow 管理实验", "建立个人 GitHub 作品集"],
    status: "pending",
  },
  {
    id: "frontier",
    name: "前沿研究",
    duration: "持续学习",
    topics: ["大语言模型 (LLM) 原理与应用", "RAG 检索增强生成与实践", "LoRA / QLoRA 高效微调技术", "AI Agent 框架与工具调用 (MCP)", "多模态学习 (Vision-Language / VLM)", "强化学习与 RLHF / DPO", "模型压缩、量化与边缘部署"],
    milestones: ["跟踪每周 ML 顶会论文与开源动态", "搭建一个完整 RAG 问答系统", "用 LoRA 微调一个开源 LLM", "参与开源 ML 项目贡献", "形成自己的研究方向"],
    status: "pending",
  },
];

export const KNOWLEDGE_TREE: KnowledgeNode[] = [
  {
    id: "math",
    label: "数学基础",
    description: "机器学习所需的数学理论与工具",
    children: [
      { id: "linear-algebra", label: "线性代数", description: "矩阵运算、特征分解、SVD" },
      { id: "probability", label: "概率论与统计", description: "贝叶斯定理、概率分布、假设检验" },
      { id: "calculus", label: "微积分", description: "导数、梯度、链式法则" },
      { id: "optimization", label: "最优化方法", description: "梯度下降、凸优化、拉格朗日乘子" },
    ],
  },
  {
    id: "programming",
    label: "编程工具",
    description: "机器学习开发必备工具链",
    children: [
      { id: "python", label: "Python", description: "核心编程语言" },
      { id: "numpy", label: "NumPy", description: "数值计算库" },
      { id: "pandas", label: "Pandas", description: "数据处理与分析" },
      { id: "matplotlib", label: "Matplotlib", description: "数据可视化" },
    ],
  },
  {
    id: "classic-ml",
    label: "经典机器学习",
    description: "传统机器学习算法体系",
    children: [
      {
        id: "supervised",
        label: "监督学习",
        children: [
          { id: "regression", label: "回归 (线性/多项式)" },
          { id: "classification", label: "分类 (逻辑回归/SVM/决策树)" },
          { id: "knn", label: "K 近邻 (KNN)" },
        ],
      },
      {
        id: "unsupervised",
        label: "无监督学习",
        children: [
          { id: "clustering", label: "聚类 (K-Means/DBSCAN)" },
          { id: "dim-reduction", label: "降维 (PCA/t-SNE)" },
          { id: "association", label: "关联规则 (Apriori)" },
        ],
      },
      {
        id: "ensemble",
        label: "集成学习",
        children: [
          { id: "bagging", label: "Bagging (随机森林)" },
          { id: "boosting", label: "Boosting (XGBoost/LightGBM)" },
          { id: "stacking", label: "Stacking" },
        ],
      },
      { id: "feature-eng", label: "特征工程", description: "特征选择、提取与构造" },
    ],
  },
  {
    id: "deep-learning-top",
    label: "深度学习",
    description: "深度神经网络技术",
    children: [
      { id: "cnn", label: "CNN / ViT", description: "卷积 / 视觉 Transformer — 图像处理" },
      { id: "rnn", label: "RNN / LSTM", description: "循环神经网络 — 序列建模" },
      { id: "transformer", label: "Transformer", description: "注意力机制 — 现代 NLP 与多模态基础" },
      { id: "gan-diffusion", label: "GAN / 扩散模型", description: "生成对抗网络与扩散模型 — 图像生成" },
      { id: "vae", label: "自编码器 (VAE)", description: "变分自编码器 — 表征学习与生成" },
    ],
  },
  {
    id: "llm-top",
    label: "大语言模型",
    description: "预训练大模型与相关技术",
    children: [
      { id: "llm", label: "LLM 原理", description: "GPT / LLaMA / Qwen / ChatGLM 架构" },
      { id: "rag", label: "RAG 检索增强生成", description: "Embedding + 向量检索 + Prompt 增强" },
      { id: "finetune", label: "高效微调", description: "LoRA / QLoRA / PEFT / Adapter" },
      { id: "prompt", label: "提示工程", description: "Prompt Design / Chain-of-Thought / In-Context Learning" },
      { id: "agent", label: "AI Agent", description: "Function Calling / MCP / 工具使用 / 记忆" },
      { id: "alignment", label: "对齐与安全", description: "RLHF / DPO / 红队测试 / 越狱防御" },
    ],
  },
  {
    id: "multimodal-top",
    label: "多模态与生成",
    description: "跨模态学习与内容生成",
    children: [
      { id: "vision-lang", label: "视觉语言模型", description: "CLIP / BLIP / LLaVA / Qwen-VL" },
      { id: "diffusion", label: "文生图 / 视频", description: "Stable Diffusion / Sora / DiT" },
      { id: "speech", label: "语音与音频", description: "Whisper / TTS / 语音识别" },
    ],
  },
  {
    id: "frontier-top",
    label: "AI 前沿方向",
    description: "AI 最新发展方向",
    children: [
      { id: "rl", label: "强化学习", description: "Q-Learning / PPO / 多智能体强化学习" },
      { id: "federated", label: "联邦学习", description: "隐私保护分布式训练" },
      { id: "automl", label: "AutoML / NAS", description: "自动模型选择与神经架构搜索" },
      { id: "xai", label: "可解释 AI (XAI)", description: "SHAP / LIME / 可解释性分析" },
    ],
  },
  {
    id: "engineering",
    label: "工程部署",
    description: "ML 生产化与运维",
    children: [
      { id: "mlops", label: "MLOps", description: "MLflow / Kubeflow / 实验管理 / 特征存储" },
      { id: "optimization-ml", label: "模型优化", description: "量化 (GPTQ/GGUF) / 剪枝 / 蒸馏" },
      { id: "deploy", label: "模型部署", description: "ONNX / TensorRT / FastAPI / vLLM" },
      { id: "vector-db", label: "向量数据库", description: "Chroma / Qdrant / Milvus / FAISS" },
    ],
  },
  {
    id: "infra",
    label: "基础设施",
    description: "ML 开发与训练基础设施",
    children: [
      { id: "gpu-compute", label: "GPU 计算", description: "CUDA / 分布式训练 / DeepSpeed" },
      { id: "data-eng", label: "数据工程", description: "数据管道 / 特征平台 / 数据版本管理" },
      { id: "experiment", label: "实验管理", description: "W&B / MLflow / 超参搜索" },
    ],
  },
];

export const EXPERIMENTS: Record<string, Experiment[]> = {
  beginner: [
    { name: "房价预测 (House Prices)", difficulty: "beginner", data: "Kaggle House Prices 数据集", tools: ["Scikit-learn", "Pandas", "Matplotlib"], skills: ["线性回归", "特征工程", "RMSE 评估"] },
    { name: "手写数字识别", difficulty: "beginner", data: "MNIST 手写数字数据集", tools: ["Scikit-learn", "NumPy"], skills: ["SVM / KNN 分类", "图像预处理", "混淆矩阵"] },
    { name: "鸢尾花分类", difficulty: "beginner", data: "Iris 鸢尾花数据集", tools: ["Scikit-learn", "Pandas", "Seaborn"], skills: ["多分类", "数据可视化", "模型选择"] },
    { name: "泰坦尼克号生存预测", difficulty: "beginner", data: "Titanic 乘客数据集", tools: ["Pandas", "Scikit-learn", "XGBoost"], skills: ["数据清洗", "缺失值处理", "特征编码"] },
  ],
  intermediate: [
    { name: "情感分析 (Sentiment Analysis)", difficulty: "intermediate", data: "IMDB 电影评论 / 微博情感", tools: ["PyTorch", "Transformers", "Hugging Face"], skills: ["文本分类", "词嵌入", "RNN / LSTM"] },
    { name: "CIFAR-10 图像分类", difficulty: "intermediate", data: "CIFAR-10 彩色图像数据集", tools: ["PyTorch", "Torchvision", "TensorBoard"], skills: ["CNN 搭建", "数据增强", "迁移学习"] },
    { name: "客户分群 (Customer Segmentation)", difficulty: "intermediate", data: "电商用户行为数据", tools: ["Scikit-learn", "Pandas", "Plotly"], skills: ["K-Means 聚类", "轮廓系数", "用户画像"] },
    { name: "信用卡欺诈检测", difficulty: "intermediate", data: "信用卡交易数据 (不平衡)", tools: ["Scikit-learn", "Imbalanced-learn", "XGBoost"], skills: ["不平衡分类", "SMOTE 采样", "召回率优化"] },
  ],
  advanced: [
    { name: "YOLO 目标检测", difficulty: "advanced", data: "COCO / VOC 目标检测数据集", tools: ["PyTorch", "Ultralytics", "OpenCV"], skills: ["目标检测", "Anchor Box", "NMS", "mAP 评估"] },
    { name: "RAG 知识库问答系统", difficulty: "advanced", data: "企业文档 / Wikipedia 文档集合", tools: ["LangChain", "Chroma", "OpenAI API", "FastAPI"], skills: ["文档分割", "Embedding", "向量检索", "Prompt 增强"] },
    { name: "LoRA 高效微调 LLM", difficulty: "advanced", data: "中文指令数据集 (Alpaca / ShareGPT)", tools: ["LLaMA-Factory", "Hugging Face", "W&B"], skills: ["LoRA / QLoRA", "指令微调", "模型评估", "模型合并"] },
    { name: "多 Agent 协作系统", difficulty: "advanced", data: "Multi-Agent 多人协作场景", tools: ["LangChain", "CrewAI", "FastAPI", "MCP"], skills: ["Agent 设计", "工具调用", "记忆管理", "MCP 协议"] },
    { name: "DCGAN 图像生成", difficulty: "advanced", data: "CelebA / Anime Face 数据集", tools: ["PyTorch", "Torchvision", "W&B"], skills: ["生成对抗网络", "反卷积", "训练稳定性"] },
    { name: "协同过滤推荐系统", difficulty: "advanced", data: "MovieLens 电影评分数据集", tools: ["PyTorch", "Surprise", "FastAPI"], skills: ["矩阵分解", "协同过滤", "Top-K 推荐", "AB 测试"] },
  ],
};

export const TOOLS_DATA: ToolItem[] = [
  // 开发环境
  { name: "Jupyter Notebook", description: "交互式编程环境，ML 实验的标准工具", category: "dev-env", url: "https://jupyter.org" },
  { name: "VS Code", description: "轻量级代码编辑器，配合 Python 插件高效开发", category: "dev-env", url: "https://code.visualstudio.com" },
  { name: "Google Colab", description: "免费云端 GPU 笔记本，适合快速实验", category: "dev-env", url: "https://colab.research.google.com" },
  // 数据处理
  { name: "Pandas", description: "Python 数据分析核心库，DataFrame 操作", category: "data-processing", url: "https://pandas.pydata.org" },
  { name: "NumPy", description: "高性能数值计算库，数组与矩阵运算", category: "data-processing", url: "https://numpy.org" },
  { name: "Dask", description: "并行计算库，处理超大数据集", category: "data-processing", url: "https://dask.org" },
  // 经典 ML 库
  { name: "Scikit-learn", description: "最流行的经典 ML 库，统一 API 设计", category: "ml-lib", url: "https://scikit-learn.org" },
  { name: "XGBoost", description: "梯度提升框架，竞赛夺冠利器", category: "ml-lib", url: "https://xgboost.readthedocs.io" },
  { name: "LightGBM", description: "高效梯度提升，速度快、内存少", category: "ml-lib", url: "https://lightgbm.readthedocs.io" },
  // 深度学习框架
  { name: "PyTorch", description: "动态计算图深度学习框架（推荐首选）", category: "dl-framework", url: "https://pytorch.org" },
  { name: "TensorFlow", description: "Google 深度学习框架，生产部署成熟", category: "dl-framework", url: "https://tensorflow.org" },
  { name: "Keras", description: "高等级 API，快速搭建神经网络", category: "dl-framework", url: "https://keras.io" },
  // 大模型生态
  { name: "Hugging Face", description: "Transformers 模型中心，预训练模型市集", category: "llm-ecosystem", url: "https://huggingface.co" },
  { name: "LangChain", description: "LLM 应用开发框架，链式调用与 Agent", category: "llm-ecosystem", url: "https://langchain.com" },
  { name: "LlamaIndex", description: "数据索引框架，LLM 与私有数据连接", category: "llm-ecosystem", url: "https://llamaindex.ai" },
  { name: "Ollama", description: "本地 LLM 运行工具，一键启动开源模型", category: "llm-ecosystem", url: "https://ollama.com" },
  { name: "LLaMA-Factory", description: "高效 LLM 微调框架，支持 LoRA / QLoRA / Full", category: "llm-ecosystem", url: "https://github.com/hiyouga/LLaMA-Factory" },
  { name: "CrewAI", description: "多智能体协作框架，编排 AI Agent 团队", category: "llm-ecosystem", url: "https://crewai.com" },
  // 推理与部署
  { name: "vLLM", description: "高性能 LLM 推理引擎，PagedAttention 优化", category: "inference", url: "https://vllm.readthedocs.io" },
  { name: "Open WebUI", description: "LLM 聊天界面，支持 Ollama / OpenAI 等多种后端", category: "inference", url: "https://openwebui.com" },
  { name: "llama.cpp", description: "C++ 实现的 LLM 推理，支持 CPU/GPU 量化运行", category: "inference", url: "https://github.com/ggerganov/llama.cpp" },
  // 向量数据库
  { name: "Chroma", description: "轻量级向量数据库，适合快速原型开发", category: "vector-db", url: "https://www.trychroma.com" },
  { name: "Qdrant", description: "高性能向量搜索引擎，支持过滤与分布式", category: "vector-db", url: "https://qdrant.tech" },
  { name: "Milvus", description: "云原生向量数据库，适合大规模生产部署", category: "vector-db", url: "https://milvus.io" },
  // MLOps
  { name: "MLflow", description: "实验追踪、模型注册与部署管理", category: "mlops", url: "https://mlflow.org" },
  { name: "Weights & Biases", description: "实验可视化与超参数调优平台", category: "mlops", url: "https://wandb.ai" },
  { name: "Docker", description: "容器化部署，环境一致性与可复现", category: "mlops", url: "https://docker.com" },
];

export const RESOURCES_DATA: ResourceItem[] = [
  // 书籍
  { title: "机器学习（西瓜书）", type: "book", description: "周志华著，国内最经典的 ML 教材，理论体系完整", url: "https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm", rating: 5 },
  { title: "统计学习方法（第 2 版）", type: "book", description: "李航著，算法推导细致，适合打牢理论基础", url: "https://github.com/fengdu78/lihang-code", rating: 5 },
  { title: "Deep Learning（花书）", type: "book", description: "Goodfellow 等著，深度学习领域圣经级参考书", url: "https://www.deeplearningbook.org", rating: 5 },
  { title: "动手学深度学习 (D2L)", type: "book", description: "李沐著，理论 + 代码结合，配套 PyTorch/MXNet 实现", url: "https://d2l.ai", rating: 5 },
  // 课程
  { title: "吴恩达 Machine Learning Specialization", type: "course", description: "Coursera 金牌课程，零基础友好，覆盖完整 ML 体系", url: "https://www.coursera.org/specializations/machine-learning-introduction", rating: 5 },
  { title: "李宏毅 机器学习 2023/2024", type: "course", description: "台湾大学公开课，讲解深入浅出，覆盖前沿话题", url: "https://speech.ee.ntu.edu.tw/~hylee/ml/2023-spring.php", rating: 5 },
  { title: "Fast.ai Practical Deep Learning", type: "course", description: "自上而下的教学方式，快速上手实践", url: "https://course.fast.ai", rating: 4 },
  { title: "李沐动手学深度学习 PyTorch 版", type: "course", description: "B站配套视频课程，理论与代码紧密结合", url: "https://space.bilibili.com/1567748478/channel/seriesdetail?sid=358497", rating: 5 },
  // GitHub 仓库
  { title: "microsoft/ML-For-Beginners", type: "github", description: "微软 12 周 ML 课程，包含完整课时与项目", url: "https://github.com/microsoft/ML-For-Beginners", rating: 5 },
  { title: "d2l-ai/d2l-zh", type: "github", description: "《动手学深度学习》中文版，含 PyTorch 代码实现与交互式 Jupyter", url: "https://github.com/d2l-ai/d2l-zh", rating: 5 },
  { title: "datawhalechina/leedl-tutorial", type: "github", description: "《李宏毅深度学习》中文配套教程，Datawhale 社区整理", url: "https://github.com/datawhalechina/leedl-tutorial", rating: 5 },
  { title: "TheAlgorithms/Python", type: "github", description: "Python 算法实现集合，包含 ML 算法", url: "https://github.com/TheAlgorithms/Python", rating: 5 },
  { title: "huggingface/transformers", type: "github", description: "最流行的 Transformers 库，支持千种预训练模型", url: "https://github.com/huggingface/transformers", rating: 5 },
  // 数据竞赛
  { title: "Kaggle", type: "competition", description: "全球最大数据科学竞赛平台，海量数据集与 Notebook", url: "https://kaggle.com" },
  { title: "天池 (Tianchi)", type: "competition", description: "阿里巴巴数据竞赛平台，企业真实场景数据", url: "https://tianchi.aliyun.com" },
  { title: "和鲸社区 (Heywhale)", type: "competition", description: "国内数据科学社区，竞赛 + 课程 + 算力", url: "https://www.heywhale.com" },
];

export const CATEGORY_LABELS: Record<string, string> = {
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
};

export const RESOURCE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  book: { label: "书籍", color: "var(--ws-color-primary)" },
  course: { label: "课程", color: "var(--ws-color-success)" },
  github: { label: "GitHub", color: "var(--ws-color-purple, #8B5CF6)" },
  competition: { label: "竞赛", color: "var(--ws-color-warning)" },
};
