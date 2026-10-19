/** AI 安全与伦理主题 */
export const ETHICS_TOPICS = [
  {
    title: "AI 对齐 (Alignment)",
    desc: "确保 AI 系统的目标、行为和价值观与人类的真实意图相一致，防止目标误配 (Misspecification) 和奖励黑客 (Reward Hacking)",
    icon: "target",
    details: [
      "RLHF (人类反馈强化学习) 是对齐的核心工程方法：从人类偏好数据训练奖励模型，再通过 PPO 优化策略",
      "Constitutional AI (CAI) 让模型基于宪法原则进行自我批评和修正，减少对人类标注的依赖",
      "DPO (Direct Preference Optimization) 简化对齐流程，直接从偏好数据优化策略而无需训练独立奖励模型",
      "可扩展监督 (Scalable Oversight)：当 AI 能力超越人类评估者时，如何保持有效监督是核心挑战",
    ],
    case_studies: [
      { title: "ChatGPT 早期对齐挑战", desc: "2022 年末 ChatGPT 发布初期，模型可能生成有害内容、提供危险建议，OpenAI 通过多轮 RLHF 迭代显著改善" },
      { title: "Claude Constitutional AI 实践", desc: "Anthropic 使用宪法 AI 训练 Claude，内置来自 UN 人权宣言等来源的原则约束，形成独特的安全对齐方法论" },
    ],
    mitigation: [
      "建立多层次对齐体系：预训练过滤 + SFT + RLHF/DPO + 安全分类器 + 运行时监控",
      "定期红队测试和对抗评估，覆盖政治/宗教/种族/性别/暴力等敏感维度",
      "建立可解释性工具 (稀疏自编码器 SAE 等) 理解模型内部表征与潜在风险",
    ],
    regulations: ["美国 AI 行政令 (2023, 2025)", "英国 AI 安全峰会布莱切利宣言 (2023)"],
  },
  {
    title: "偏见与公平性 (Bias & Fairness)",
    desc: "识别、度量和缓解 AI 系统中的社会偏见，确保模型公平对待所有群体，避免历史偏见的算法化放大",
    icon: "check",
    details: [
      "数据偏见：训练语料中的人口分布不均导致模型对少数群体表现显著下降",
      "标注偏见：人工标注者的主观偏见可能通过 RLHF 注入模型价值观",
      "聚合偏见：整体指标良好但分群体表现差异巨大 (如方言识别在标准普通话 vs 地方口音上的差距)",
      "公平性指标：Demographic Parity (人口平等)、Equalized Odds (均等化赔率)、Equal Opportunity (均等机会)",
    ],
    case_studies: [
      { title: "COMPAS 再犯风险评估争议 (2016)", desc: "ProPublica 调查发现 COMPAS 算法对黑人被告的假阳性率是白人被告的近两倍，引发算法公平性广泛讨论" },
      { title: "LLM 职业刻板印象研究 (2023-2024)", desc: "多项研究发现 LLM 在生成内容时存在性别-职业关联偏见：护士默认为女性，CEO 默认为男性，需要主动纠偏" },
    ],
    mitigation: [
      "数据层面：平衡采样、数据增强、反事实数据增强",
      "模型层面：对抗去偏 (Adversarial Debiasing)、公平性约束正则化、对比学习去偏",
      "评估层面：分群体指标监控、偏见审计数据集 (BBQ/Winogender/WinoBias) 自动化测试",
      "流程层面：建立多样性审核团队、引入社区反馈机制",
    ],
    regulations: ["欧盟 AI Act 高风险系统公平性要求", "纽约市 Local Law 144 (自动化雇佣决策审计法)"],
  },
  {
    title: "可解释性 (Explainability)",
    desc: "让 AI 决策过程透明、可理解和可审计，是建立 AI 信任、合规和调试的基础",
    icon: "lightbulb",
    details: [
      "事后解释 (Post-hoc)：SHAP (Shapley Additive Explanations) 量化每个特征对预测的贡献；LIME 用局部代理模型解释单次预测",
      "内在可解释 (Intrinsic)：决策树、逻辑回归、广义加性模型 (GAM) 本身具备可解释性，但在复杂场景中性能有限",
      "机制可解释性 (Mechanistic Interpretability)：通过稀疏自编码器 (Sparse Autoencoders, SAE) 识别大模型内部的单义性特征 (Monosemantic Features)",
      "概念可解释性：识别模型内部是否存在可被人类理解的概念表征 (如颜色、形状、情感)",
    ],
    case_studies: [
      { title: "Anthropic Golden Gate Claude 实验 (2024)", desc: "通过激活放大技术操纵 Claude 内部的金门大桥相关特征，展示大模型可解释性研究的突破性进展" },
      { title: "医疗 AI 可解释性需求", desc: "FDA/CE 对医疗 AI 设备要求提供决策依据，SHAP 热力图成为胸部 X 光诊断模型的标准解释方式" },
    ],
    mitigation: [
      "根据场景选择适当的可解释性层次：高风险场景需全局+局部可解释，低风险可接受黑箱",
      "建立透明的模型卡 (Model Card) 和系统卡 (System Card) 制度记录模型能力与局限",
      "采用 Chain-of-Thought 等可解释推理方法作为用户界面而非内部优化",
    ],
    regulations: ["欧盟 AI Act 第 13 条 (透明度与信息披露)", "GDPR 第 22 条 (自动化决策解释权)"],
  },
  {
    title: "隐私保护 (Privacy)",
    desc: "保护个人数据在 AI 训练和推理全生命周期中的隐私安全，防止数据泄露、成员推理和模型反演攻击",
    icon: "shield",
    details: [
      "联邦学习 (Federated Learning)：在用户设备本地训练模型，只上传加密梯度更新，原始数据不出设备 (Google Gboard 键盘为典型应用)",
      "差分隐私 (Differential Privacy, DP)：在训练或推理时注入受控噪声，提供数学可证明的隐私保证 (Apple/Google 的数据采集使用)",
      "成员推理攻击 (Membership Inference)：攻击者判断某个个体的数据是否在模型训练集中，隐私审计的重要手段",
      "模型反演 (Model Inversion)：从模型参数或输出中逆向推断训练数据特征，是人脸识别模型的主要隐私风险",
      "机器遗忘 (Machine Unlearning)：高效从已训练模型中删除特定个体数据的影响，满足 GDPR 删除权要求",
    ],
    case_studies: [
      { title: "Clearview AI 人脸识别争议", desc: "Clearview AI 从社交媒体抓取数十亿人脸图片构建识别数据库，被多个国家判定违反隐私法、处以巨额罚款" },
      { title: "GPT-2 训练数据记忆研究 (2019)", desc: "研究者发现 GPT-2 可以逐字输出训练集中的个人身份信息，促使后续模型加强训练数据清洗和输出过滤" },
    ],
    mitigation: [
      "训练前：数据脱敏 (去标识化/假名化)、数据最小化、合成数据替代真实数据",
      "训练中：差分隐私 SGD (DP-SGD)、联邦学习、安全多方计算 (SMPC)",
      "推理时：输出过滤 (检测并遮蔽 PII)、差分隐私推理、本地推理减少数据传输",
      "合规流程：数据保护影响评估 (DPIA)、用户同意管理、定期安全审计",
    ],
    regulations: ["GDPR (欧盟通用数据保护条例)", "CCPA/CPRA (加州消费者隐私法)", "中国《个人信息保护法》(PIPL)", "中国《数据安全法》"],
  },
  {
    title: "安全性 (Safety & Robustness)",
    desc: "防范 AI 系统被恶意利用、对抗攻击、越狱 (Jailbreak) 和灾难性风险，构建多层级安全防御体系",
    icon: "alert",
    details: [
      "越狱 (Jailbreak)：通过精心构造的 Prompt 绕过模型安全限制 (如角色扮演、编码/解码、多语言组合、Base64 编码攻击)",
      "提示注入 (Prompt Injection)：攻击者注入指令劫持模型行为 (间接注入 — 从外部文档注入；直接注入 — 从用户输入注入)",
      "对抗样本 (Adversarial Examples)：对人类几乎不可见的输入扰动导致模型输出剧烈变化 (如让自动驾驶错误识别停止标志)",
      "数据投毒 (Data Poisoning)：在训练数据中植入恶意样本，使模型在特定触发器下产生预定行为 (后门攻击)",
      "越权与权限升级：Agent 系统中工具调用权限被滥用，可能执行危险操作 (如删除文件、发送邮件、执行代码)",
    ],
    case_studies: [
      { title: "微软 Tay 聊天机器人事件 (2016)", desc: "Tay 上线不到 24 小时被网民通过恶意输入训练成发表种族歧视言论，揭示了开放学习系统的脆弱性" },
      { title: "Skeleton Key 越狱攻击 (2024)", desc: "Microsoft 披露的通用越狱技术，通过请求模型'增强'其安全行为而非绕过，影响多个主流模型" },
      { title: "AI Agent 间接提示注入 (2024)", desc: "研究发现向 Agent 访问的网页或邮件中嵌入隐藏指令，可操纵 Agent 执行恶意操作" },
    ],
    mitigation: [
      "模型层：安全训练 (Safety Training/RLHF)、输入/输出过滤分类器、PPL 异常检测",
      "系统层：输入净化 (Sanitization)、沙箱隔离、权限最小化、操作前人工确认 (Human-in-the-loop)",
      "流程层：常态化红队测试、Bug Bounty 计划、安全事件响应 SOP、供应链安全审查",
      "评估层：自动化安全基准 (HarmBench/StrongREJECT/ALERT)、对抗鲁棒性测试",
    ],
    regulations: ["欧盟 AI Act 高风险系统合规要求", "美国 AI 安全研究所 (AISI) 测试标准", "NIST AI Risk Management Framework 1.0"],
  },
  {
    title: "深度伪造与信息完整性 (Deepfakes & Information Integrity)",
    desc: "应对 AI 生成虚假内容对社会信任、民主制度和公共安全的冲击，维护信息生态的真实性",
    icon: "eye-off",
    details: [
      "深度伪造技术已从面部替换发展到全身动作生成、声音克隆和实时视频伪造，制作门槛急剧降低",
      "生成式 AI 使虚假信息生产规模化和个性化：根据目标受众的政治倾向、兴趣定制定向虚假信息",
      "检测技术军备竞赛：被动检测 (视觉伪影/生物信号异常) vs 主动溯源 (C2PA 内容凭证/SynID 水印) vs AI 生成对抗 AI 检测",
      "'说谎者红利 (Liar's Dividend)'：真实内容也可被诬称为 AI 生成，深度伪造的存在本身削弱了所有信息证据的可信度",
    ],
    case_studies: [
      { title: "Deepfake 冒充 CFO 诈骗 (2024)", desc: "香港某跨国公司员工被深度伪造视频会议中的'CFO'指示转账 2 亿港元，所有人均为 AI 生成" },
      { title: "2024 全球选举年 AI 滥用", desc: "印度、印尼、美国等选举中出现 AI 生成的候选人虚假音视频、AI 自动呼叫 (Robocall) 冒充拜登等事件" },
      { title: "AI 生成色情内容泛滥", desc: "多国出现未经同意的 AI 深度伪造色情内容传播，韩国'第 N 个房间'数字化事件引发全球立法加速" },
    ],
    mitigation: [
      "技术手段：C2PA 内容来源与真实性联盟标准、Google SynthID 不可见水印、Microsoft 视频认证器",
      "平台责任：主要社交平台建立 AI 生成内容标注机制 (Meta/Google/TikTok 等)",
      "法律手段：多国立法将未经同意的深度伪造定为犯罪，平台需 24 小时内删除",
      "公众素养：媒体素养教育、AI 内容识别培训、多源交叉验证习惯",
    ],
    regulations: ["中国《深度合成管理规定》(2023)", "欧盟 AI Act 深度伪造标注义务", "美国 NO FAKES Act (提案)"],
  },
  {
    title: "版权与知识产权 (Copyright & IP)",
    desc: "明确 AI 训练数据的版权边界、AI 生成内容的著作权归属、以及训练数据权利人的合理补偿机制",
    icon: "file-text",
    details: [
      "训练数据版权是全球性法律前沿问题：AI 公司主张'合理使用 (Fair Use)'，版权方主张需获得授权和补偿",
      "AI 生成内容的可版权性：美国版权局当前立场是纯 AI 生成内容不受版权保护，但人类创作性参与部分可受保护",
      "模型输出与训练数据相似性问题：'记忆 (Memorization)'现象使模型可能输出与训练数据高度相似的内容，构成衍生作品风险",
      "开源模型许可证的复杂性：训练数据版权不清导致开源模型的商用合规风险 (如 LLaMA 初始泄露的连锁反应)",
    ],
    case_studies: [
      { title: "New York Times 诉 OpenAI/Microsoft (2023)", desc: "NYT 指控 ChatGPT 逐字输出其付费文章，要求销毁使用其内容训练的模型，成为最具标志性的 AI 版权案件" },
      { title: "Getty Images 诉 Stability AI (2023)", desc: "Getty 指控 Stable Diffusion 未经授权使用其图库训练，且生成图像中出现变形的 Getty 水印" },
      { title: "GitHub Copilot 集体诉讼 (2022)", desc: "开发者指控 Copilot 训练数据包含开源代码但未遵守开源许可证的署名要求" },
    ],
    mitigation: [
      "合规训练数据获取：使用明确许可的数据集 (如 Common Corpus/Public Domain)、与版权方签署授权协议 (如 OpenAI 与新闻集团)",
      "技术防护：训练数据去重与过滤、输出与训练数据相似性检测、提供 Opt-out 机制 (如 robots.txt 爬虫排除协议扩展)",
      "商业模型：建立版权方补偿机制 (如 Google 与新闻出版商的许可协议)、内容创作者的收入分成模式",
    ],
    regulations: ["欧盟 AI Act 训练数据透明度要求 (通用 AI 系统需公开训练数据摘要)", "美国版权局 AI 版权政策研究 (2023-2025)", "日本/英国/新加坡的 AI 训练数据版权例外立法探索"],
  },
  {
    title: "AI 治理与全球监管 (AI Governance)",
    desc: "建立多层次的 AI 治理框架，平衡创新与安全，推动国际合作与标准协调",
    icon: "globe",
    details: [
      "风险分级监管：欧盟 AI Act 将 AI 应用分为不可接受风险/高风险/有限风险/最低风险四级，对应不同合规要求",
      "模型评估与审计：前沿模型需通过第三方安全评估 (如 METR/UK AISI 的评估框架) 方可发布",
      "AI 治理多中心化：除政府监管外，行业标准 (ISO 42001)、企业自律 (Anthropic RSP/OpenAI Preparedness Framework)、学术监督、公民社会共同构成治理生态",
      "国际合作机制：AI 安全峰会系列 (布莱切利/首尔/巴黎)、联合国 AI 高级咨询机构、G7 广岛 AI 进程",
    ],
    case_studies: [
      { title: "OpenAI 治理危机 (2023)", desc: "Sam Altman 被董事会解职又复职，暴露出前沿 AI 公司治理结构在商业利益与安全使命之间的张力" },
      { title: "欧盟 AI Act 正式生效 (2024)", desc: "全球首部综合性 AI 法规，分阶段实施 (2025-2027)，设立通用 AI 和高风险 AI 的义务体系" },
      { title: "DeepSeek 引发开源与安全辩论 (2025)", desc: "DeepSeek 开源高性能推理模型引发全球关于'开源是否提升还是削弱 AI 安全'的激烈讨论" },
    ],
    mitigation: [
      "组织层面：建立 AI 伦理委员会、定期 AI 影响评估 (AIIA)、举报人保护制度",
      "技术层面：负责任扩展策略 (RSP)、自动化对齐研究、模型评估与红队测试制度化",
      "行业层面：AI 安全承诺 (前沿模型论坛 Frontier Model Forum)、MLCommons AI 安全基准",
      "个人层面：AI 从业者伦理培训、责任意识和举报途径",
    ],
    regulations: ["欧盟 AI Act (2024 生效, 分阶段实施至 2027)", "中国《生成式人工智能服务管理暂行办法》(2023)", "美国 AI 行政令 14110 (2023) 及后续", "G7 广岛 AI 进程国际指导原则 (2023)", "首尔 AI 安全峰会前沿 AI 安全承诺 (2024)"],
  },
];

export const ETHICS_CASES = [
  {
    title: "微软 Tay 聊天机器人",
    lesson: "上线仅 24 小时即被恶意操控生成极端言论，暴露 AI 开放学习系统被恶意利用的风险，促使行业将安全设计前移至系统架构阶段",
    source: "2016",
  },
  {
    title: "COMPAS 再犯风险评估",
    lesson: "算法对不同种族群体的预测偏差引发公平性争议：黑人被告假阳性率约为白人两倍，推动算法公平性成为 AI 治理核心议题",
    source: "2016",
  },
  {
    title: "Deepfakes 滥用",
    lesson: "深度伪造技术从名人色情扩散至政治操纵、金融诈骗和企业间谍，推动多国出台专门的深度伪造禁令和平台审核义务",
    source: "2017-至今",
  },
  {
    title: "ChatGPT 幻觉与不实信息",
    lesson: "模型生成虚假信息但表现得确信无疑，律师引用 ChatGPT 虚构判例提交法庭文件被处罚，推动法律行业对 AI 使用的审慎规范",
    source: "2023",
  },
  {
    title: "AI 操纵选举争议",
    lesson: "2024 全球大选年，AI 生成虚假音视频、自动呼叫冒充候选人、定向虚假信息泛滥，促使社交平台紧急建立 AI 内容标注机制",
    source: "2024",
  },
  {
    title: "AI 版权诉讼浪潮",
    lesson: "NYT 诉 OpenAI、Getty 诉 Stability AI、GitHub Copilot 集体诉讼等案件重塑全球 AI 训练数据的版权边界和合理使用讨论",
    source: "2023-至今",
  },
  {
    title: "AI 深度伪造视频会议诈骗",
    lesson: "香港公司员工被 AI 生成的虚假 CFO 和同事在视频会议中联合欺骗，转账 2 亿港元，成为迄今为止最大的深度伪造诈骗案之一",
    source: "2024",
  },
  {
    title: "OpenAI 治理危机",
    lesson: "CEO 被董事会解职又复职，暴露 AI 公司治理结构在安全使命与商业利益之间的深层矛盾，引发全球 AI 治理讨论",
    source: "2023",
  },
];

export const RESPONSIBLE_AI_PRINCIPLES = [
  "透明度：向用户明确说明 AI 的功能、局限、训练数据来源和潜在偏差",
  "问责制：明确 AI 决策的责任归属、申诉渠道和补救机制",
  "公平性：定期审计模型在不同群体上的表现差异，主动纠正显著偏差",
  "隐私优先：最小化数据收集，实施数据保护，尊重用户数据权利",
  "安全性：通过红队测试、边界测试和持续监控确保 AI 系统安全可靠",
  "人类控制：关键决策保留人类判断权，AI 输出需经过适当的人类审核",
  "持续监控：部署后持续监测模型漂移、数据分布变化和新型安全威胁",
  "包容性设计：在 AI 系统设计阶段纳入多样化用户群体的需求和反馈",
  "可竞争性：用户有权对 AI 决策提出质疑并获得人工复核",
  "可持续性：关注 AI 训练的能源消耗和环境影响，推动绿色 AI 发展",
];
