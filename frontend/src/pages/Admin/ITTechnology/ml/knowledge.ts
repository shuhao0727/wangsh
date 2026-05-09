/** 机器学习知识图谱 — 完整三级知识树 */
import type { KnowledgeNode } from "./data";

export const KNOWLEDGE_TREE: KnowledgeNode[] = [
  {
    id: "math",
    label: "数学基础",
    description: "机器学习背后的数学理论基石，决定了你对模型行为的理解深度和调优直觉",
    children: [
      {
        id: "linear-algebra",
        label: "线性代数",
        description: "向量空间、矩阵分解、特征值与奇异值分解 (SVD) 是数据变换和降维的核心工具",
      },
      {
        id: "probability",
        label: "概率论与统计",
        description: "贝叶斯定理、概率分布族 (高斯/伯努利/多项)、最大似然估计和假设检验构成了模型推断的逻辑骨架",
      },
      {
        id: "calculus",
        label: "微积分",
        description: "导数、偏导与链式法则支撑了反向传播算法，梯度和雅可比矩阵是优化器运转的必要语言",
      },
      {
        id: "optimization",
        label: "最优化方法",
        description: "梯度下降家族 (SGD/Adam/Adagrad)、凸优化理论、拉格朗日对偶性决定了模型能否高效收敛到理想解",
      },
      {
        id: "information-theory",
        label: "信息论",
        description: "熵、交叉熵、KL 散度和互信息量化为损失函数设计、特征选择及变分推断提供了数学依据",
      },
    ],
  },
  {
    id: "programming",
    label: "编程工具",
    description: "从实验原型到生产部署的全流程工程工具栈，直接影响研发效率和代码可复现性",
    children: [
      {
        id: "python",
        label: "Python",
        description: "机器学习领域事实标准语言，掌握列表推导、装饰器、上下文管理器等特性可大幅提升代码表达力",
      },
      {
        id: "numpy",
        label: "NumPy",
        description: "多维数组操作的底层基石，广播机制和向量化运算是避免 Python 循环性能瓶颈的关键",
      },
      {
        id: "pandas",
        label: "Pandas",
        description: "结构化数据处理的核心库，DataFrame 的 groupby、merge、pivot 等操作覆盖了特征工程 80% 的工作流",
      },
      {
        id: "matplotlib",
        label: "Matplotlib",
        description: "最灵活的低层绑图库，拥有 Figure/Axes 精细控制能力，适合论文级图表定制与批量出图",
      },
      {
        id: "seaborn",
        label: "Seaborn",
        description: "基于 Matplotlib 的统计可视化封装，一行代码即可生成分组箱线图、热力图与成对关系图，适合探索性分析",
      },
      {
        id: "plotly",
        label: "Plotly",
        description: "交互式可视化库，支持缩放、悬停提示和 3D 旋转，常用于构建数据看板和分析型 Web 应用",
      },
      {
        id: "jupyter",
        label: "Jupyter",
        description: "交互式笔记本环境，支持图文混排、Magic 命令和内联可视化，是数据探索和教学分享的标准载体",
      },
      {
        id: "git",
        label: "Git",
        description: "分布式版本控制工具，结合 DVC 可同时管理代码和数据集版本，保障实验可追溯和团队协作",
      },
    ],
  },
  {
    id: "classic-ml",
    label: "经典机器学习",
    description: "深度学习时代前的核心算法体系，在表格数据、风控、推荐等场景仍然是工业界首选方案",
    children: [
      {
        id: "supervised",
        label: "监督学习",
        description: "从带标签数据中学习映射关系，覆盖回归与分类两大预测任务",
        children: [
          {
            id: "linear-regression",
            label: "线性回归",
            description: "拟合自变量与因变量间线性关系的基础模型，正则化变体 (Ridge/Lasso/ElasticNet) 能有效抑制过拟合",
          },
          {
            id: "logistic-regression",
            label: "逻辑回归",
            description: "通过 sigmoid 将线性输出映射为概率，配合对数损失是二分类问题最常用的基准模型",
          },
          {
            id: "decision-tree",
            label: "决策树",
            description: "基于信息增益或 Gini 系数递归划分特征空间，可解释性强但容易过拟合，常作为集成模型的基学习器",
          },
          {
            id: "svm",
            label: "支持向量机 (SVM)",
            description: "寻找最大化分类间隔的超平面，借助核函数 (RBF/多项式) 隐式映射到高维空间处理非线性可分问题",
          },
          {
            id: "knn",
            label: "K 近邻 (KNN)",
            description: "基于距离度量的懒惰学习方法，无显式训练过程，但预测时需遍历全体样本，适合低维小数据场景",
          },
          {
            id: "naive-bayes",
            label: "朴素贝叶斯",
            description: "假设特征条件独立且应用贝叶斯公式推断，在文本分类和垃圾邮件过滤中计算高效且效果稳健",
          },
        ],
      },
      {
        id: "unsupervised",
        label: "无监督学习",
        description: "从无标签数据中挖掘内在结构和分布模式，是探索性分析的关键手段",
        children: [
          {
            id: "kmeans",
            label: "K-Means",
            description: "迭代最小化簇内平方误差的经典聚类算法，收敛快速但对初始质心敏感且需预设簇数 K",
          },
          {
            id: "dbscan",
            label: "DBSCAN",
            description: "基于密度的空间聚类，通过邻域半径和最小样本数自动发现任意形状簇并识别噪声点",
          },
          {
            id: "hierarchical",
            label: "层次聚类",
            description: "自底向上聚合或自顶向下分裂构建簇树状图 (Dendrogram)，无需预设簇数且结果可直观解读",
          },
          {
            id: "pca",
            label: "主成分分析 (PCA)",
            description: "通过方差最大化的正交线性变换将高维数据投影到低维子空间，是最常用的线性降维手段",
          },
          {
            id: "tsne",
            label: "t-SNE",
            description: "在低维空间保持高维近邻概率分布的流形降维方法，擅长生成可视化效果出众的二维嵌入图",
          },
        ],
      },
      {
        id: "ensemble",
        label: "集成学习",
        description: "组合多个弱学习器降低偏差或方差，是 Kaggle 竞赛和工业级模型的标配策略",
        children: [
          {
            id: "bagging",
            label: "Bagging",
            description: "并行训练多个基学习器后投票或平均，通过自助采样引入多样性以降低方差，典型代表为随机森林",
          },
          {
            id: "randomforest",
            label: "随机森林 (RF)",
            description: "Bagging + 随机子空间方法，同时采样样本和特征，抗噪能力强且天然提供特征重要性排序",
          },
          {
            id: "boosting",
            label: "Boosting",
            description: "串行训练基学习器，每一轮聚焦上一轮误分样本，逐步降低偏差，代表有 AdaBoost 和 GBDT",
          },
          {
            id: "xgboost",
            label: "XGBoost",
            description: "对 GBDT 进行了二阶泰勒展开、行列分块和正则化改进，在结构数据竞赛中长期占据统治地位",
          },
          {
            id: "lightgbm",
            label: "LightGBM",
            description: "基于直方图的梯度提升框架，采用单边梯度采样和互斥特征捆绑，训练速度极快且内存占用低",
          },
          {
            id: "stacking",
            label: "Stacking",
            description: "用多个异构基模型生成元特征，再训练次级元学习器融合预测，用模型多样性挖掘正交信号",
          },
        ],
      },
      {
        id: "feature-eng",
        label: "特征工程与模型评估",
        description: "数据质量决定模型上限，特征构造、选择、编码及科学的评估方法论贯穿 ML 项目全生命周期",
        children: [
          {
            id: "feature-construction",
            label: "特征构造",
            description: "对原始字段加、乘、分箱、交叉组合生成新特征，领域知识驱动的特征设计往往比调参收益更大",
          },
          {
            id: "feature-selection",
            label: "特征选择",
            description: "通过 Filter (方差/卡方)、Wrapper (递归消除) 或 Embedded (L1 正则/树重要性) 方法剔除冗余和噪声特征",
          },
          {
            id: "evaluation",
            label: "模型评估",
            description: "交叉验证、混淆矩阵、ROC-AUC、F1 与 PR 曲线等指标多维度衡量模型在不同业务侧重下的真实表现",
          },
        ],
      },
    ],
  },
  {
    id: "deep-learning",
    label: "深度学习",
    description: "通过多层非线性变换自动学习层次化特征表征，在图像、语音、文本等非结构化数据上颠覆了传统方法",
    children: [
      {
        id: "dl-basics",
        label: "基础组件",
        description: "构成任何深度网络的原子模块，理解其原理是设计和诊断模型的前提",
        children: [
          {
            id: "mlp",
            label: "多层感知机 (MLP)",
            description: "全连接层堆叠配合非线性激活构成最朴素的深度网络，是理解前向传播和参数量计算的入门模型",
          },
          {
            id: "activation",
            label: "激活函数",
            description: "ReLU 解决梯度消失、GeLU 平滑激活更适合 Transformer、Sigmoid/Tanh 用于门控机制",
          },
          {
            id: "backprop",
            label: "反向传播",
            description: "通过计算图自动微分将损失梯度逐层回传，配合链式法则高效更新所有参数，是训练神经网络的引擎",
          },
          {
            id: "optimizers",
            label: "优化器",
            description: "SGD+Momentum 提供基础加速，Adam 自适应调节学习率成默认首选，AdamW 纠正了权重衰减实现细节",
          },
        ],
      },
      {
        id: "cnn",
        label: "卷积神经网络 (CNN)",
        description: "利用卷积核的局部感受野和参数共享提取空间层次特征，是计算机视觉长达十年的核心架构",
        children: [
          {
            id: "conv-pool",
            label: "卷积与池化",
            description: "卷积层通过滑动滤波器提取边缘和纹理，池化层下采样降低计算量并引入平移不变性",
          },
          {
            id: "resnet",
            label: "ResNet",
            description: "引入残差跳跃连接使得 100+ 层网络仍可有效训练，解决了深层网络的退化问题，是里程碑式架构",
          },
          {
            id: "vgg",
            label: "VGG",
            description: "用连续小卷积核 (3×3) 堆叠替代大卷积核，结构规整简洁但参数冗余，常作为特征提取骨干",
          },
          {
            id: "efficientnet",
            label: "EfficientNet",
            description: "用神经结构搜索联合缩放深度、宽度和分辨率三个维度，在同等计算量下取得显著更高的精度",
          },
        ],
      },
      {
        id: "rnn",
        label: "循环神经网络 (RNN)",
        description: "在时间轴上共享参数处理序列数据，天然适配时序预测和自然语言建模任务",
        children: [
          {
            id: "lstm",
            label: "长短期记忆 (LSTM)",
            description: "通过遗忘门、输入门和输出门三控机制缓解长序列梯度消失，可捕捉数百步的长期依赖",
          },
          {
            id: "gru",
            label: "门控循环单元 (GRU)",
            description: "LSTM 的精简变体，合并隐状态与细胞状态并用重置门和更新门控制信息流，参数更少收敛更快",
          },
          {
            id: "seq2seq",
            label: "Seq2Seq",
            description: "编码器-解码器框架将变长输入编码为上下文向量再逐步解码，是机器翻译和文本摘要的经典范式",
          },
        ],
      },
      {
        id: "transformer",
        label: "Transformer",
        description: "完全基于自注意力并行处理序列，突破 RNN 串行瓶颈，成为当今 NLP、CV 和多模态的主流架构",
        children: [
          {
            id: "self-attention",
            label: "自注意力机制",
            description: "Q-K-V 三重投影计算序列内任意位置间的关联权重，一步捕获全局依赖，计算复杂度 O(n²)",
          },
          {
            id: "multi-head",
            label: "多头注意力",
            description: "并行运行多组独立的 Q-K-V 投影让模型同时关注不同子空间的信息，增强表征多样性",
          },
          {
            id: "positional-encoding",
            label: "位置编码",
            description: "Transformer 本身无序列顺序感知，通过正弦位置编码或可学习嵌入为每个 token 注入位置信息",
          },
          {
            id: "pretrained",
            label: "预训练模型",
            description: "在大规模无标注语料上自监督预训练再下游微调，BERT 和 GPT 分别开创了编码器和解码器预训练范式",
          },
        ],
      },
      {
        id: "training-skills",
        label: "训练技巧",
        description: "这些技巧不是可选增强而是现代深度网络能够稳定收敛的必要配置",
        children: [
          {
            id: "batchnorm",
            label: "批归一化 (BatchNorm)",
            description: "对每个 mini-batch 做标准化使各层输入分布稳定，允许使用更大的学习率并加速收敛",
          },
          {
            id: "dropout",
            label: "Dropout",
            description: "训练时随机丢弃一定比例神经元输出，等效于隐式集成大量子网络以增强泛化能力",
          },
          {
            id: "lr-schedule",
            label: "学习率调度",
            description: "Cosine Annealing 平滑衰减、Warmup 逐步升温配合线性衰减，精细的学习率轨迹对收敛质量影响显著",
          },
          {
            id: "transfer-learning",
            label: "迁移学习",
            description: "在大规模通用数据集预训练后在下游小样本任务微调，极大降低数据需求和训练成本",
          },
        ],
      },
    ],
  },
  {
    id: "nlp",
    label: "自然语言处理",
    description: "让计算机理解、生成和推理人类语言，从规则系统演进到基于 Transformer 的大模型范式",
    children: [
      {
        id: "text-preprocessing",
        label: "文本预处理",
        description: "分词 (Jieba/BPE)、去停用词、词形还原与向量化 (TF-IDF) 将原始文本转化为模型可计算输入",
      },
      {
        id: "word-embedding",
        label: "词嵌入",
        description: "Word2Vec 通过 CBOW/Skip-gram 学习分布式语义向量，GloVe 利用全局共现矩阵，奠定了稠密表示基础",
      },
      {
        id: "text-classification",
        label: "文本分类",
        description: "情感分析、主题分类和垃圾检测的核心任务，从 FastText 到基于 BERT 微调均以此为基础应用",
      },
      {
        id: "sequence-labeling",
        label: "序列标注",
        description: "命名实体识别 (NER)、词性标注 (POS) 和中文分词可建模为逐 token 分类，CRF 层提供标签转移约束",
      },
      {
        id: "machine-translation",
        label: "机器翻译",
        description: "从统计机器翻译到 Seq2Seq+Attention 再到 Transformer，BLEU 分数在主要语言对上持续刷新",
      },
      {
        id: "bert",
        label: "BERT",
        description: "双向 Transformer 编码器配合 MLM+NSP 预训练任务，在下游分类和抽取任务上实现了范式级突破",
      },
      {
        id: "gpt",
        label: "GPT 系列",
        description: "自回归语言模型通过预测下一个 token 进行生成式预训练，随着规模扩大涌现出上下文学习和推理能力",
      },
      {
        id: "llm-apps",
        label: "LLM 应用",
        description: "RAG 检索增强生成、Agent 工具调用、思维链推理和上下文学习将大模型从对话推向复杂任务自动化",
      },
    ],
  },
  {
    id: "cv",
    label: "计算机视觉",
    description: "让计算机从图像和视频中提取、分析和理解视觉信息，是自动驾驶和医疗影像等领域的核心技术",
    children: [
      {
        id: "image-classification-cv",
        label: "图像分类",
        description: "给定单张图片输出类别标签，ImageNet 竞赛推动了从 AlexNet 到 ConvNeXt 的架构演进史",
      },
      {
        id: "object-detection",
        label: "目标检测",
        description: "同时定位和分类图中多个物体，YOLO 单阶段和 Faster R-CNN 两阶段系列在速度与精度之间各有取舍",
      },
      {
        id: "semantic-segmentation",
        label: "语义分割",
        description: "对图像每个像素分配类别标签，U-Net 的编码-解码+跳跃连接结构在医学影像分割中表现卓越",
      },
      {
        id: "image-generation-cv",
        label: "图像生成",
        description: "从随机噪声或文本生成逼真图像，GAN 开创对抗训练先河，扩散模型后来居上实现更高质量生成",
      },
      {
        id: "vit",
        label: "视觉 Transformer (ViT)",
        description: "将图像切分为 Patch 序列送入标准 Transformer 编码器，打破 CNN 在视觉领域的长期垄断",
      },
      {
        id: "multimodal-cv",
        label: "多模态",
        description: "CLIP 通过对比学习对齐图文表示，BLIP/LlaVA 实现视觉问答，打通了视觉与语言的语义桥梁",
      },
    ],
  },
  {
    id: "generative",
    label: "生成模型",
    description: "学习数据分布并产生新样本，从图像生成到 AIGC 内容创作，正重新定义人机交互范式",
    children: [
      {
        id: "gan",
        label: "生成对抗网络 (GAN)",
        description: "生成器与判别器博弈训练，生成器学习伪造逼真样本，DCGAN、StyleGAN 在人脸生成上效果惊人",
      },
      {
        id: "vae",
        label: "变分自编码器 (VAE)",
        description: "编码器将输入映射到隐空间分布，解码器从分布采样重建，学习到的平滑隐空间支持插值和属性编辑",
      },
      {
        id: "diffusion",
        label: "扩散模型",
        description: "前向逐步加噪破坏数据，逆向逐步去噪恢复，DDPM、DDIM 和 LDM 形成了当前图像生成的主流范式",
      },
      {
        id: "autoregressive-gen",
        label: "自回归生成模型",
        description: "将图像、音频建模为离散 token 序列逐位预测，PixelCNN 和 VQ-VAE 是该方向早期代表",
      },
      {
        id: "text-to-image",
        label: "文生图",
        description: "Stable Diffusion 在隐空间扩散配合文本条件注入，Midjourney 通过 CLIP 引导实现高质量创意图像合成",
      },
      {
        id: "controllable-gen",
        label: "可控生成",
        description: "ControlNet 用边缘/深度/姿态图精确约束生成结果，Inpainting 和 IP-Adapter 实现局部编辑与风格迁移",
      },
    ],
  },
  {
    id: "rl",
    label: "强化学习",
    description: "智能体通过与环境交互试错学习最优策略，是游戏 AI、机器人控制和 LLM 对齐的关键技术",
    children: [
      {
        id: "mdp",
        label: "马尔可夫决策过程 (MDP)",
        description: "状态、动作、转移概率和奖励四元组形式化描述序贯决策问题，是几乎所有 RL 算法的数学框架",
      },
      {
        id: "q-learning",
        label: "Q-Learning",
        description: "学习状态-动作价值函数 Q(s,a) 并以 ε-greedy 平衡探索与利用，贝尔曼最优方程保证收敛性",
      },
      {
        id: "dqn",
        label: "深度 Q 网络 (DQN)",
        description: "用神经网络近似 Q 函数并结合经验回放和固定目标网络打破样本相关性，在 Atari 游戏中超越人类",
      },
      {
        id: "policy-gradient",
        label: "策略梯度",
        description: "直接参数化策略网络并沿期望回报梯度方向更新，REINFORCE 算法奠定了策略搜索方法的基础",
      },
      {
        id: "actor-critic",
        label: "Actor-Critic",
        description: "Actor 维持策略输出动作，Critic 估计价值函数评判动作好坏，两者协同训练缓解了纯策略梯度的高方差",
      },
      {
        id: "ppo",
        label: "PPO",
        description: "通过裁剪重要性采样比率约束策略更新幅度，兼顾样本效率与训练稳定性，是 RLHF 中的主力优化算法",
      },
      {
        id: "marl",
        label: "多智能体强化学习",
        description: "多个智能体在共享或竞争环境中协同决策，MADDPG 和 QMIX 解决非平稳性和信用分配挑战",
      },
    ],
  },
  {
    id: "mlops",
    label: "MLOps 与部署",
    description: "将 ML 模型从实验笔记本可靠地交付到生产环境并持续运维，覆盖模型生命全周期",
    children: [
      {
        id: "experiment-tracking",
        label: "实验追踪",
        description: "MLflow 和 W&B 记录超参、指标和产出的完整血统，确保每次实验可复现、可对比、可回溯",
      },
      {
        id: "model-registry",
        label: "模型注册",
        description: "将训练好的模型版本化存入中央仓库，标注阶段 (Staging/Production) 并关联评估报告，实现模型血缘管理",
      },
      {
        id: "feature-store",
        label: "特征存储",
        description: "统一管理在线和离线特征的一致性，Feast 等系统避免训练-推理特征偏移并提升特征复用率",
      },
      {
        id: "model-serving",
        label: "模型服务",
        description: "通过 FastAPI/Triton/vLLM 将模型封装为 API，支持批处理、动态批量和 GPU 推理加速",
      },
      {
        id: "ci-cd",
        label: "CI/CD 流水线",
        description: "自动化模型测试、打包、部署和回滚，确保每次模型更新都经过一致的验证流程再推送到生产",
      },
      {
        id: "monitoring",
        label: "监控告警",
        description: "持续监控请求延迟、推理吞吐、数据漂移和预测分布偏移，在模型退化时触发自动告警或回滚",
      },
    ],
  },
  {
    id: "ethics",
    label: "AI 伦理与安全",
    description: "在追求模型精度之外，确保 AI 系统公平、透明、隐私安全且与人类价值观对齐",
    children: [
      {
        id: "fairness",
        label: "公平性",
        description: "识别并消除模型在性别、种族等敏感属性上的预测偏差，通过人口统计均等和机会均等指标量化评估",
      },
      {
        id: "explainability",
        label: "可解释性",
        description: "SHAP 基于 Shapley 值分配特征贡献度，LIME 在局部训练可解释代理模型，让模型决策不再黑箱",
      },
      {
        id: "privacy",
        label: "隐私保护",
        description: "联邦学习让数据不出本地完成协同训练，差分隐私通过梯度加噪保护个体样本无法从模型中反向推断",
      },
      {
        id: "robustness",
        label: "鲁棒性",
        description: "对抗样本通过微小扰动即可欺骗模型，对抗训练和梯度掩蔽等防御手段提升模型在攻击下的稳定性",
      },
      {
        id: "alignment",
        label: "对齐",
        description: "RLHF 用人类偏好排序 reward 模型引导策略、DPO 直接优化偏好，确保大模型行为符合人类意图和价值观",
      },
      {
        id: "compliance",
        label: "合规与治理",
        description: "GDPR 赋予用户算法解释权和被遗忘权，中国人工智能法草案和欧盟 AI Act 正在重塑模型开发的监管边界",
      },
    ],
  },
];
