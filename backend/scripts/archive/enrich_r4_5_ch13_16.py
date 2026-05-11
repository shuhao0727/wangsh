"""Enrich ML book chapters 13-16 with metadata updates (glossary/quiz/checklist/keywords)
and APPEND cross-references to markdown.  MERGES with existing data — does not replace.

Run: cd backend && python3 scripts/enrich_r4_5_ch13_16.py
"""
import asyncio, json, os, sys
sys.path.insert(0, ".")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter


def j(v):
    return json.dumps(v, ensure_ascii=False)


# ── MERGE helpers ────────────────────────────────────────────────────────────

def merge_glossary(existing_json: str | None, new_terms: list[dict]) -> list[dict]:
    existing = json.loads(existing_json) if existing_json else []
    existing_terms = {e["term"] for e in existing}
    for t in new_terms:
        if t["term"] not in existing_terms:
            existing.append(t)
    return existing


def merge_quiz(existing_json: str | None, new_items: list[dict]) -> list[dict]:
    existing = json.loads(existing_json) if existing_json else []
    existing_qs = {e["question"] for e in existing}
    for q in new_items:
        if q["question"] not in existing_qs:
            existing.append(q)
    return existing


def merge_checklist(existing_json: str | None, new_items: list[str]) -> list[str]:
    existing = json.loads(existing_json) if existing_json else []
    for item in new_items:
        if item not in existing:
            existing.append(item)
    return existing


def merge_keywords(existing_json: str | None, new_items: list[str]) -> list[str]:
    existing = json.loads(existing_json) if existing_json else []
    for item in new_items:
        if item not in existing:
            existing.append(item)
    return existing


# ── Cross-references to APPEND ───────────────────────────────────────────────

CROSSREFS = {
    "dimensionality-reduction": (
        "\n\n---\n\n"
        "## 🔗 继续阅读\n\n"
        "- [第12章 聚类](#) — 用降维结果可视化聚类\n"
        "- [第4章 线性模型](#) — 了解 L1 正则化的特征选择能力\n"
    ),
    "generative-models": (
        "\n\n---\n\n"
        "## 🔗 继续阅读\n\n"
        "- [第9章 神经网络](#) — 回顾网络训练\n"
        "- [第11章 Transformer](#) — 学习当下的多模态生成前沿\n"
    ),
    "reinforcement-learning": (
        "\n\n---\n\n"
        "## 🔗 继续阅读\n\n"
        "- [第2章 数学基础](#) — 巩固 MDP 中的概率期望\n"
        "- [第9章 神经网络](#) — 理解 DQN 的深度 Q 网络\n"
    ),
    "ml-in-practice": (
        "\n\n---\n\n"
        "## 🔗 继续阅读\n\n"
        "- [第3章 模型评估](#) — 理解线上评估指标\n"
        "- [第8章 集成学习](#) — 上线你的 XGBoost 模型\n"
    ),
}

# ── Metadata to MERGE per chapter ────────────────────────────────────────────

METADATA = {
    # ── Ch13: dimensionality-reduction ──────────────────────────────────────
    "dimensionality-reduction": {
        "glossary": [
            {"term": "特征值", "definition": "协方差矩阵分解后衡量各主成分方差大小的标量，λ₁ ≥ λ₂ ≥ ..."},
            {"term": "特征向量", "definition": "协方差矩阵分解后定义各主成分方向的向量，彼此正交"},
            {"term": "协方差矩阵", "definition": "描述多个变量间线性相关关系的对称矩阵，Σ = (1/(n-1)) XcᵀXc"},
            {"term": "解释方差比", "definition": "每个主成分的特征值占总特征值之和的比例，λᵢ / Σλⱼ"},
            {"term": "过滤法", "definition": "Filter 特征选择，用统计指标独立评分筛选特征，与后续模型无关"},
            {"term": "包裹法", "definition": "Wrapper 特征选择，用模型性能评估特征子集，如 RFE 递归消除"},
            {"term": "嵌入法", "definition": "Embedded 特征选择，在模型训练过程中自动完成特征选择，如 L1 正则化"},
        ],
        "quiz": [
            {
                "question": "PCA 的目标是什么？",
                "options": ["最小化重建误差", "最大化投影方差", "最大化类间距离", "最小化特征数"],
                "correctIndex": 1,
                "explanation": "PCA 寻找使数据投影后方差最大化的方向（第一主成分），等价于最小化重建误差。"
            },
            {
                "question": "t-SNE 的主要局限是什么？",
                "options": ["只能处理二分类问题", "无法用于新数据的 transform", "只能降到 2 维", "需要 GPU 加速"],
                "correctIndex": 1,
                "explanation": "t-SNE 是非参数方法，学习训练集的嵌入关系，不能用 fit 后的模型处理新数据。"
            },
            {
                "question": "L1 正则化用于特征选择的原理是什么？",
                "options": ["通过增加模型容量筛选特征", "通过 L1 惩罚使不重要特征的权重趋于零", "通过随机采样选择特征", "通过模型投票选择特征"],
                "correctIndex": 1,
                "explanation": "L1 (Lasso) 正则化在优化中产生稀疏解，自动将不重要特征的系数压为零，实现 Embedded 特征选择。"
            },
        ],
        "checklist": [
            "能实现 PCA 降维并画累积方差图",
            "能区分 PCA 和 t-SNE 的使用场景",
        ],
        "keywords": ["SVD", "UMAP", "LDA", "RFECV", "互信息"],
    },

    # ── Ch14: generative-models ─────────────────────────────────────────────
    "generative-models": {
        "glossary": [
            {"term": "生成器", "definition": "GAN 中将随机噪声映射为伪造样本的网络 G(z)，目标是骗过判别器"},
            {"term": "判别器", "definition": "GAN 中判断输入是真实还是伪造的二分类网络 D(·)，输出 ∈ [0,1]"},
            {"term": "隐变量", "definition": "生成模型的低维潜在表示 z，通常服从标准正态分布，控制生成多样性"},
            {"term": "KL 散度", "definition": "Kullback-Leibler Divergence，衡量两个概率分布差异的不对称度量，VAE 中用于正则化"},
            {"term": "扩散过程", "definition": "在 T 步中逐步向数据添加高斯噪声直到变成纯噪声的马尔可夫链"},
            {"term": "FID 分数", "definition": "Fréchet Inception Distance，用预训练 Inception 网络评估生成图像质量的常用指标"},
        ],
        "quiz": [
            {
                "question": "GAN 训练困难的根本原因是什么？",
                "options": ["模型参数量太少", "minimax 博弈的纳什均衡难以达到", "数据集太大", "需要 GPU"],
                "correctIndex": 1,
                "explanation": "GAN 训练本质是生成器和判别器的非合作博弈，纳什均衡在非凸参数空间中极难达到，导致训练不稳定/模式崩塌。"
            },
            {
                "question": "VAE 的损失函数由哪两部分组成？",
                "options": ["交叉熵 + L2 正则", "重建损失 + KL 散度正则", "对抗损失 + 重建损失", "MSE + Dropout"],
                "correctIndex": 1,
                "explanation": "VAE 优化 ELBO = Reconstruction Loss + KL(q(z|x) || p(z))，重建项使输出接近输入，KL 项使隐分布接近先验。"
            },
            {
                "question": "扩散模型相比 GAN 的核心优势是什么？",
                "options": ["生成速度最快", "不需要训练", "生成质量和多样性更优", "参数量最小"],
                "correctIndex": 2,
                "explanation": "扩散模型通过逐步去噪生成，不易模式崩塌，图像质量和多样性目前最优，但推理速度较慢（需 T 步迭代）。"
            },
        ],
        "checklist": [
            "能画出 GAN 的架构简图",
            "能解释扩散模型为什么生成质量最高",
        ],
        "keywords": ["StyleGAN", "DDPM", "Stable Diffusion", "SDE", "Score-based"],
    },

    # ── Ch15: reinforcement-learning ────────────────────────────────────────
    "reinforcement-learning": {
        "glossary": [
            {"term": "状态", "definition": "环境在某一时刻的完整描述 s ∈ S，智能体据此做决策"},
            {"term": "动作", "definition": "智能体在状态下可执行的操作 a ∈ A(s)，执行后环境转移并产生奖励"},
            {"term": "奖励", "definition": "环境对智能体动作的即时反馈信号 R(s,a,s')，强化学习的优化目标"},
            {"term": "Q-value", "definition": "动作价值函数 Q(s,a)，从状态 s 执行动作 a 后的期望累积折扣奖励"},
            {"term": "策略", "definition": "智能体的行为规则 π(a|s)，给定状态选择动作的概率分布"},
            {"term": "折扣因子", "definition": "γ ∈ [0,1]，控制未来奖励相对于即时奖励的重要程度，γ 越小越短视"},
        ],
        "quiz": [
            {
                "question": "MDP 的核心假设是马尔可夫性质，它的含义是什么？",
                "options": [
                    "奖励只与动作有关",
                    "下一状态仅取决于当前状态和动作，与历史无关",
                    "状态转移概率始终为 1",
                    "所有状态值相同"
                ],
                "correctIndex": 1,
                "explanation": "马尔可夫性质：P(s_{t+1}|s_t,a_t) = P(s_{t+1}|s_t,a_t,...,s_0,a_0)，未来只与现在有关，与过去独立。"
            },
            {
                "question": "强化学习中 exploration 和 exploitation 的矛盾是什么？",
                "options": [
                    "探索多则收敛慢 vs 利用多则可能错过更优解",
                    "探索需要 GPU vs 利用需要 CPU",
                    "两者没有矛盾",
                    "探索是离线操作 vs 利用是在线操作"
                ],
                "correctIndex": 0,
                "explanation": "Exploitation 选当前已知最优动作获得回报，Exploration 尝试未知动作可能发现更优策略。ε-greedy 是平衡两者的经典方法。"
            },
            {
                "question": "Q-Learning 的更新机制中 TD 误差是如何计算的？",
                "options": [
                    "δ = r + γ max Q(s',a') − Q(s,a)",
                    "δ = r − Q(s,a)",
                    "δ = max Q(s,a) − Q(s,a)",
                    "δ = γ max Q(s',a') − Q(s,a)"
                ],
                "correctIndex": 0,
                "explanation": "TD 误差 = (r + γ max_{a'} Q(s', a')) − Q(s,a)，其中 r + γ max Q(s') 是 TD 目标，差值驱动 Q 值更新。"
            },
        ],
        "checklist": [
            "能写出 Q-Learning 的更新公式",
            "能解释 exploration vs exploitation 的矛盾",
        ],
        "keywords": ["DQN", "REINFORCE", "A2C", "Actor-Critic", "贝尔曼方程"],
    },

    # ── Ch16: ml-in-practice ─────────────────────────────────────────────────
    "ml-in-practice": {
        "glossary": [
            {"term": "CI/CD", "definition": "持续集成/持续部署，自动化构建、测试、部署 ML 流水线的工程实践"},
            {"term": "模型注册", "definition": "Model Registry，统一管理模型版本、stage (Staging/Production/Archived) 和元数据的中心"},
            {"term": "影子部署", "definition": "Shadow Deployment，新模型在后台接收线上流量进行预测但不返回结果，零风险验证"},
            {"term": "金丝雀部署", "definition": "Canary Deployment，将少量流量（5-10%）先路由到新模型，验证后逐步提升比例"},
            {"term": "特征存储", "definition": "Feature Store，在线/离线统一的特征工程平台，保证训练和服务特征一致性（如 Feast）"},
        ],
        "quiz": [
            {
                "question": "以下部署策略中，风险最低的是哪个？",
                "options": ["一次性切换", "蓝绿部署", "影子部署", "A/B 测试"],
                "correctIndex": 2,
                "explanation": "影子部署将新模型的预测结果记录下来但不返回给用户，因此零风险——即使模型 crash 也不影响线上。"
            },
            {
                "question": "MLOps 的完整生命周期包含以下哪些核心阶段？",
                "options": [
                    "仅模型训练和部署",
                    "数据收集→验证→特征工程→训练→验证→部署→监控→循环",
                    "仅数据预处理和模型评估",
                    "仅部署和监控"
                ],
                "correctIndex": 1,
                "explanation": "MLOps 覆盖从数据到生产的全链路：数据/特征/训练/评估/部署/监控构成持续循环。"
            },
            {
                "question": "为什么线上模型需要持续监控？",
                "options": [
                    "为了收集更多训练数据",
                    "数据漂移和概念漂移会导致模型性能退化",
                    "为了减少模型参数量",
                    "GPU 需要定期维护"
                ],
                "correctIndex": 1,
                "explanation": "线上数据分布随时间变化（数据漂移），或标签含义变化（概念漂移），会使模型预设失效，需要监控指标及时告警和重训。"
            },
        ],
        "checklist": [
            "能写出 FastAPI 模型服务的最小代码",
            "能列出 ML 项目 README 应包含的 6 个部分",
        ],
        "keywords": ["Docker", "Kubernetes", "Evidently", "MLflow", "Kubeflow"],
    },
}


# ── Enrich function ──────────────────────────────────────────────────────────

CH_SLUGS = [
    "dimensionality-reduction",
    "generative-models",
    "reinforcement-learning",
    "ml-in-practice",
]

JSON_FIELDS = ("glossary", "quiz", "checklist", "keywords")


async def enrich():
    engine = create_async_engine(os.environ["DATABASE_URL"])
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one_or_none()
        if not book:
            print("ERROR: Book not found. Run seed_ml_book.py first.")
            return
        book_id = book.id

        for slug in CH_SLUGS:
            r2 = await db.execute(select(MLBookChapter).where(
                MLBookChapter.book_id == book_id,
                MLBookChapter.slug == slug
            ))
            chapter = r2.scalar_one_or_none()
            if not chapter:
                print(f"WARN: Chapter '{slug}' not found, skipping.")
                continue

            meta = METADATA.get(slug)
            if not meta:
                print(f"WARN: No metadata for '{slug}', skipping.")
                continue

            changes = []

            # Merge glossary
            if "glossary" in meta:
                merged = merge_glossary(getattr(chapter, "glossary", None), meta["glossary"])
                chapter.glossary = j(merged)
                changes.append(f"glossary +{len(meta['glossary'])} (total {len(merged)})")

            # Merge quiz
            if "quiz" in meta:
                merged = merge_quiz(getattr(chapter, "quiz", None), meta["quiz"])
                chapter.quiz = j(merged)
                changes.append(f"quiz +{len(meta['quiz'])} (total {len(merged)})")

            # Merge checklist
            if "checklist" in meta:
                merged = merge_checklist(getattr(chapter, "checklist", None), meta["checklist"])
                chapter.checklist = j(merged)
                changes.append(f"checklist +{len(meta['checklist'])} (total {len(merged)})")

            # Merge keywords
            if "keywords" in meta:
                merged = merge_keywords(getattr(chapter, "keywords", None), meta["keywords"])
                chapter.keywords = j(merged)
                changes.append(f"keywords +{len(meta['keywords'])} (total {len(merged)})")

            # Append cross-references to markdown
            xref = CROSSREFS.get(slug)
            if xref:
                old_len = len(chapter.markdown or "")
                chapter.markdown = (chapter.markdown or "") + xref
                new_len = len(chapter.markdown)
                changes.append(f"markdown +{new_len - old_len} chars ({old_len} → {new_len})")

            print(f"  ✓ {slug}: {', '.join(changes)}")

        await db.commit()
        print(f"\nOK: {len(CH_SLUGS)} chapters enriched successfully")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(enrich())
