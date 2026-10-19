import type { ResourceItem } from "./types";

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
