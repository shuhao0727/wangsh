import type { ResourceItem } from "./types";

export const RESOURCES_DATA: ResourceItem[] = [
  // ── 书籍 ───────────────────────────────────────
  { title: "人工智能：一种现代方法 (AIMA)", type: "book", description: "Russell & Norvig 合著，AI 领域最权威的教科书，覆盖搜索、推理、规划、学习、NLP、感知、机器人等全景主题", url: "http://aima.cs.berkeley.edu", rating: 5, difficulty_level: "intermediate", best_for: "希望建立系统 AI 知识体系的所有学习者" },
  { title: "深度学习（花书）", type: "book", description: "Goodfellow、Bengio、Courville 合著，深度学习领域圣经级参考，数学密集，适合有基础后深读", url: "https://www.deeplearningbook.org", rating: 5, difficulty_level: "advanced", best_for: "有数学基础、希望深入理解 DL 理论的研究者" },
  { title: "动手学深度学习 (d2l.ai)", type: "book", description: "李沐等著，理论 + PyTorch 代码实现双轨并行，交互式 Jupyter 练习，内容持续更新", url: "https://d2l.ai", rating: 5, difficulty_level: "intermediate", best_for: "偏好理论结合代码实践的深度学习入门者" },
  { title: "Pattern Recognition and Machine Learning (PRML)", type: "book", description: "Christopher Bishop 著，贝叶斯视角的机器学习经典，概率图模型与推断方法论", url: "https://www.microsoft.com/en-us/research/publication/pattern-recognition-machine-learning/", rating: 5, difficulty_level: "expert", best_for: "追求贝叶斯方法深度和数学严谨性的研究者" },
  { title: "《这就是 ChatGPT》", type: "book", description: "Stephen Wolfram 著，用通俗语言解释 ChatGPT 的工作原理，从神经网络到 Transformer 到强化学习", url: "https://writings.stephenwolfram.com/2023/02/what-is-chatgpt-doing-and-why-does-it-work/", rating: 5, difficulty_level: "beginner", best_for: "想理解大模型底层原理的零基础入门者" },
  // ── 课程 ───────────────────────────────────────
  { title: "吴恩达 AI for Everyone", type: "course", description: "Coursera 非技术入门课，面向所有人的 AI 通识：AI 能做什么、不能做什么、如何用 AI 构建项目", url: "https://www.coursera.org/learn/ai-for-everyone", rating: 5, difficulty_level: "beginner", best_for: "完全的 AI 新手、业务决策者、非技术岗位" },
  { title: "吴恩达 Deep Learning Specialization", type: "course", description: "5 门课的深度学习专项课程：神经网络、超参数调优、结构化 ML 项目、CNN、序列模型", url: "https://www.coursera.org/specializations/deep-learning", rating: 5, difficulty_level: "intermediate", best_for: "有 ML 基础、希望系统学习深度学习的工程师" },
  { title: "Stanford CS224N: NLP with Deep Learning", type: "course", description: "斯坦福 NLP 王牌课程，从 word2vec 到 GPT-4，覆盖 NLP 完整技术栈与前沿论文", url: "https://web.stanford.edu/class/cs224n/", rating: 5, difficulty_level: "advanced", best_for: "有 DL 基础、专注 NLP 方向的学习者" },
  { title: "李宏毅 机器学习 2024", type: "course", description: "台湾大学公开课，中文授课，讲解生动，覆盖 Transformer、生成模型、LLM 等前沿主题", url: "https://speech.ee.ntu.edu.tw/~hylee/ml/2024-spring.php", rating: 5, difficulty_level: "intermediate", best_for: "中文母语、希望以生动方式了解 DL 前沿的学习者" },
  { title: "Andrej Karpathy: Neural Networks: Zero to Hero", type: "course", description: "从零手写神经网络系列，从反向传播到 GPT，深入浅出，YouTube 免费", url: "https://www.youtube.com/playlist?list=PLAqhIrjkxBUWIuGzyzEa3MiEzYOvJSL-K", rating: 5, difficulty_level: "intermediate", best_for: "喜欢从零实现、深入理解底层机制的学习者" },
  // ── 论文 ───────────────────────────────────────
  { title: "Attention Is All You Need (2017)", type: "paper", description: "Transformer 架构开山之作，提出自注意力机制替代 RNN，彻底改变了 NLP 和 DL 格局", url: "https://arxiv.org/abs/1706.03762", rating: 5, difficulty_level: "advanced", best_for: "所有希望深入理解 Transformer 和现代 LLM 基础的人" },
  { title: "BERT: Pre-training of Deep Bidirectional Transformers (2019)", type: "paper", description: "提出掩码语言模型预训练范式，开启 NLP 的预训练+微调时代", url: "https://arxiv.org/abs/1810.04805", rating: 5, difficulty_level: "advanced", best_for: "NLP 方向研究者与工程师" },
  { title: "Training language models to follow instructions (InstructGPT, 2022)", type: "paper", description: "OpenAI 提出 RLHF 方法，用人类反馈训练模型遵循指令，ChatGPT 的核心理念来源", url: "https://arxiv.org/abs/2203.02155", rating: 5, difficulty_level: "advanced", best_for: "想深入理解 LLM 对齐和安全训练的研究者" },
  { title: "LoRA: Low-Rank Adaptation of Large Language Models (2021)", type: "paper", description: "低秩矩阵分解实现高效 LLM 微调，大幅降低训练参数量与显存需求", url: "https://arxiv.org/abs/2106.09685", rating: 5, difficulty_level: "expert", best_for: "从事 LLM 微调与高效训练的从业者" },
  { title: "Deep Residual Learning for Image Recognition (2016)", type: "paper", description: "ResNet 残差网络论文，引入跳连解决深层网络退化问题，CV 领域里程碑", url: "https://arxiv.org/abs/1512.03385", rating: 5, difficulty_level: "intermediate", best_for: "所有 CNN/DL 学习者必读的经典论文" },
  // ── 网站 ───────────────────────────────────────
  { title: "Papers With Code", type: "website", description: "论文与代码关联平台，追踪最新 AI 论文排行榜与 SOTA 实现，发现数据集和基准", url: "https://paperswithcode.com", rating: 5, difficulty_level: "advanced", best_for: "追踪 SOTA 进展的研究者和工程师" },
  { title: "Hugging Face 模型中心", type: "website", description: "全球最大预训练模型共享平台，提供推理 Widget、模型卡片与社区讨论", url: "https://huggingface.co/models", rating: 5, difficulty_level: "intermediate", best_for: "需要快速找到和使用预训练模型的开发者" },
  { title: "The Batch (吴恩达周报)", type: "website", description: "Andrew Ng 团队的 AI 周报，精选每周最重要的 AI 新闻、论文和技术突破", url: "https://www.deeplearning.ai/the-batch/", rating: 5, difficulty_level: "beginner", best_for: "希望持续追踪 AI 前沿动态的所有学习者" },
  { title: "Distill.pub", type: "website", description: "交互式 ML 研究期刊，以精美可视化讲解复杂概念，如注意力机制、特征可视化", url: "https://distill.pub", rating: 5, difficulty_level: "intermediate", best_for: "偏好可视化直觉理解的 AI 学习者" },
  { title: "OpenAI Cookbook", type: "website", description: "OpenAI 官方示例代码集，覆盖 Prompt 工程、函数调用、嵌入、微调等实战技巧", url: "https://cookbook.openai.com", rating: 5, difficulty_level: "intermediate", best_for: "使用 OpenAI API 进行实际开发的工程师" },
  // ── 竞赛平台 ──────────────────────────────────
  { title: "Kaggle", type: "competition", description: "全球最大数据科学竞赛平台，海量公开数据集、Notebook 环境、GPU 和竞赛奖金", url: "https://kaggle.com", rating: 5, difficulty_level: "intermediate", best_for: "希望通过实战项目提升技能的各级别学习者" },
  { title: "天池 (Tianchi)", type: "competition", description: "阿里云数据竞赛平台，企业真实场景数据，涵盖 CV/NLP/推荐系统等方向", url: "https://tianchi.aliyun.com", rating: 5, difficulty_level: "intermediate", best_for: "希望接触中国企业级 AI 场景的学习者" },
  // ── 社区 ───────────────────────────────────────
  { title: "Datawhale 开源社区", type: "community", description: "国内最大的 AI 开源学习社区，组织组队学习、开源教程翻译与项目实践", url: "https://datawhale.club", rating: 5, difficulty_level: "beginner", best_for: "希望参与组队学习和开源贡献的中文学习者" },
  { title: "r/MachineLearning (Reddit)", type: "community", description: "全球最大的 ML 社区讨论版，汇集论文讨论、行业新闻与技术问答", url: "https://reddit.com/r/MachineLearning", rating: 4, difficulty_level: "intermediate", best_for: "希望追踪国际 ML 前沿讨论和社区动态的学习者" },
  { title: "WaytoAGI 通往 AGI 之路", type: "community", description: "中文 AI 学习社区，提供 AI 知识库、工具导航和学习路线图，面向 AI 爱好者和从业者", url: "https://waytoagi.com", rating: 4, difficulty_level: "beginner", best_for: "中文母语 AI 爱好者、希望建立学习路线的初学者" },
];
