## 符号主义 AI
### 搜索与规划
#### 状态空间搜索
##### BFS/DFS
##### A* 算法
##### 启发式函数设计
#### 约束满足问题
##### 回溯搜索
##### 前向检查
##### 弧相容 (AC-3)
#### 博弈论
##### Minimax 算法
##### Alpha-Beta 剪枝
##### 蒙特卡洛树搜索
### 知识表示与推理
#### 一阶逻辑
##### 语法与语义
##### 合一算法
##### 归结原理
#### 语义网络与框架
##### 继承推理
##### 默认推理
#### 描述逻辑
##### OWL 本体语言
##### 知识图谱
### 专家系统
#### 规则引擎
##### 前向链推理
##### 后向链推理
##### Rete 算法
#### 不确定性推理
##### 贝叶斯网络
##### 证据理论 (Dempster-Shafer)
##### 模糊逻辑

## 机器学习
### 监督学习
#### 回归
##### 线性回归
##### 岭回归/Lasso
##### 多项式回归
#### 分类
##### 逻辑回归
##### 支持向量机 (SVM)
##### 决策树与随机森林
##### K 近邻 (KNN)
##### 朴素贝叶斯
### 无监督学习
#### 聚类
##### K-Means
##### DBSCAN
##### 层次聚类
##### 高斯混合模型 (GMM)
#### 降维
##### 主成分分析 (PCA)
##### t-SNE
##### UMAP
##### 自编码器 (AutoEncoder)
### 强化学习
#### 基于价值
##### Q-Learning
##### DQN
##### Double DQN
#### 基于策略
##### Policy Gradient
##### Actor-Critic
##### PPO
#### 模型驱动
##### AlphaZero
##### MuZero

## 深度学习
### 基础架构
#### 多层感知机 (MLP)
##### 反向传播
##### 激活函数 (ReLU/GELU/Swish)
##### 权重初始化 (Xavier/He)
#### 优化器
##### SGD + Momentum
##### Adam/AdamW
##### 学习率调度
### 卷积神经网络 (CNN)
#### 经典架构
##### LeNet-5 / AlexNet
##### VGG / GoogLeNet
##### ResNet / DenseNet
##### EfficientNet
#### 应用
##### 图像分类
##### 目标检测 (YOLO/RCNN)
##### 语义分割 (U-Net)
### 序列模型
#### 循环神经网络 (RNN)
##### LSTM
##### GRU
##### 双向 RNN
#### 注意力机制
##### Bahdanau 注意力
##### Luong 注意力
##### 自注意力 (Self-Attention)
#### Transformer
##### Multi-Head Attention
##### 位置编码 (Positional Encoding)
##### 前馈网络 (FFN)
##### Layer Normalization
### 生成模型
#### 变分自编码器 (VAE)
#### 生成对抗网络 (GAN)
##### DCGAN
##### CycleGAN
##### StyleGAN
#### 扩散模型
##### DDPM
##### Stable Diffusion
##### 通义万相 / DALL-E
#### 自回归模型
##### PixelCNN
##### WaveNet

## 大语言模型 (LLM)
### 预训练
#### GPT 系列
##### GPT-1/2/3/4
##### 自回归语言建模
#### BERT 系列
##### 掩码语言模型 (MLM)
##### 下一句预测 (NSP)
#### 混合架构
##### T5 (Text-to-Text)
##### PaLM / Gemini
### 对齐与微调
#### 指令微调
##### SFT (Supervised Fine-Tuning)
#### RLHF
##### 奖励模型
##### PPO 优化
##### DPO (Direct Preference Optimization)
#### 参数高效微调
##### LoRA / QLoRA
##### Adapter
##### Prefix Tuning
### 推理与部署
#### 推理优化
##### 量化 (INT8/INT4)
##### 剪枝
##### 知识蒸馏
##### Flash Attention
#### 部署框架
##### vLLM
##### TensorRT-LLM
##### Ollama
#### 提示工程
##### Few-shot Prompting
##### Chain-of-Thought
##### ReAct

## AI 应用领域
### 自然语言处理 (NLP)
#### 文本分类
##### 情感分析
##### 垃圾邮件检测
##### 主题分类
#### 信息抽取
##### 命名实体识别 (NER)
##### 关系抽取
##### 事件抽取
#### 文本生成
##### 机器翻译
##### 摘要生成
##### 对话系统
#### RAG (检索增强生成)
##### 文档切分
##### 嵌入向量
##### 向量检索
##### 上下文整合
### 计算机视觉 (CV)
#### 图像理解
##### 图像分类
##### 目标检测
##### 图像分割
#### 多模态模型
##### CLIP
##### 通义千问 VL / GPT-4V
##### Gemini Vision
#### 视频理解
##### 动作识别
##### 视频问答
### 语音与音频
#### 语音识别 (ASR)
##### Whisper
#### 语音合成 (TTS)
##### VALL-E
##### ElevenLabs
#### 音乐生成
##### MusicLM

## AI 安全与伦理
### 安全对齐
#### 有害内容过滤
#### 越狱防御
#### Red Teaming
### 公平性
#### 偏见检测
#### 公平性指标
#### 去偏技术
### 可解释性
#### 特征归因
##### LIME / SHAP
#### 注意力可视化
#### 探测任务 (Probing)
### 隐私
#### 差分隐私
#### 联邦学习
#### 数据最小化
### 治理
#### AI 伦理准则
#### 法规合规
##### EU AI Act
#### 负责任 AI 原则
