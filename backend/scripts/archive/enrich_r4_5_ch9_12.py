"""Enrich ML book ch9-12: glossary, quiz, checklist, keywords + cross-refs.
MERGE approach — adds missing entries, does NOT remove existing ones.
Run: cd backend && python3 scripts/enrich_r4_5_ch9_12.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, ".")
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

db_url = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db",
)

CH_SLUGS = ["neural-networks", "cnn-rnn", "transformers", "clustering"]

# ── Glossary terms to ensure (keyed by slug → list of {term, definition}) ──
GLOSSARY = {
    "neural-networks": [
        {"term": "MLP", "definition": "多层感知机，包含输入层、隐藏层、输出层的前馈神经网络"},
        {"term": "前向传播", "definition": "输入数据从输入层逐层计算到输出层的前馈过程"},
        {"term": "激活函数", "definition": "为神经网络引入非线性的函数，如ReLU、Sigmoid、Tanh等"},
        {"term": "ReLU", "definition": "Rectified Linear Unit，f(x)=max(0,x)，计算简单且缓解梯度消失"},
    ],
    "cnn-rnn": [
        {"term": "池化", "definition": "对特征图进行下采样，保留重要信息的同时减少空间尺寸"},
        {"term": "RNN", "definition": "循环神经网络，通过隐藏状态在时间步之间传递序列信息"},
        {"term": "隐藏状态", "definition": "RNN在每个时间步维护的内部状态向量，承载序列历史信息"},
        {"term": "梯度消失", "definition": "在深层网络或长序列中，梯度在反向传播时指数衰减至零，导致参数几乎不更新"},
    ],
    "transformers": [
        {"term": "Query/Key/Value", "definition": "注意力机制的核心三元组，Q与K计算注意力权重，V为被加权聚合的值向量"},
        {"term": "残差连接", "definition": "将层的输入直接加到输出上，形成恒等快捷路径，缓解深层网络退化"},
        {"term": "编码器-解码器", "definition": "Transformer的Encoder-Encoder架构，编码器压缩输入为上下文，解码器生成输出序列"},
    ],
    "clustering": [
        {"term": "肘部法则", "definition": "画出K值与Inertia的关系曲线，寻找拐点作为最优K值"},
        {"term": "层次聚类", "definition": "自底向上不断合并最相似的簇，生成树状图的聚类方法"},
        {"term": "核心点", "definition": "在DBSCAN中，ε邻域内至少包含min_samples个点的样本点，用于扩展簇"},
        {"term": "噪声点", "definition": "在DBSCAN中，既不是核心点也不是边界点的样本，标记为异常值"},
    ],
}

# ── Quiz items to ensure (total 3 per chapter — add if < 3) ──
QUIZ = {
    "neural-networks": [
        {
            "question": "如果神经网络所有层都使用线性激活函数（或无激活函数），多层网络会退化为什么？",
            "options": [
                "比单层更强大的非线性模型",
                "等价于单层线性模型",
                "自动变成深度网络",
                "无法训练",
            ],
            "correctIndex": 1,
            "explanation": "多层线性变换的复合仍是线性变换：W₂(W₁x) = (W₂W₁)x，所以多层无激活的神经网络等价于单层线性模型，失去深度学习的意义。",
        },
    ],
    "cnn-rnn": [
        {
            "question": "CNN中参数共享指的是什么？",
            "options": [
                "每层共享相同的偏置",
                "同一个卷积核在整个输入上滑动使用",
                "不同通道共享同一个卷积核",
                "训练和测试时共享参数",
            ],
            "correctIndex": 1,
            "explanation": "参数共享指同一个卷积核（滤波器）在输入的所有空间位置上复用，大幅减少了参数量，同时赋予了平移等变性。",
        },
    ],
    "transformers": [
        {
            "question": "Multi-Head Attention 设置多个头的核心目的是什么？",
            "options": [
                "加快计算速度",
                "让模型在不同的表示子空间中联合关注不同位置的信息",
                "减少显存占用",
                "增加模型参数量以提高过拟合能力",
            ],
            "correctIndex": 1,
            "explanation": "多头注意力将Q、K、V投影到h个不同的子空间，各自独立计算注意力，使模型能同时关注不同位置、不同语义关系的信息。",
        },
    ],
    "clustering": [
        {
            "question": "K-Means算法一定收敛到全局最优解吗？",
            "options": [
                "是，因为目标函数是凸函数",
                "否，K-Means容易陷入局部最优，对初始中心敏感",
                "是，因为每次都重新计算均值",
                "否，K-Means可能发散",
            ],
            "correctIndex": 1,
            "explanation": "K-Means目标函数非凸，算法保证收敛到局部最优（每次迭代Inertia单调不增），但对初始中心敏感。K-Means++通过更好的初始化缓解此问题。",
        },
    ],
}

# ── Checklist items to add ──
CHECKLIST = {
    "neural-networks": [
        "能写出MLP的PyTorch训练循环",
        "能解释为什么需要非线性激活",
    ],
    "cnn-rnn": [
        "能计算卷积输出尺寸",
        "能解释LSTM如何缓解梯度消失",
    ],
    "transformers": [
        "能手写Scaled Dot-Product Attention公式",
        "能画出Transformer Encoder结构",
    ],
    "clustering": [
        "能实现K-Means的肘部法则选K",
        "能解释DBSCAN的两个关键参数",
    ],
}

# ── Keywords to add ──
KEYWORDS = {
    "neural-networks": [
        "学习率衰减",
        "Early Stopping",
    ],
    "cnn-rnn": [
        "MaxPool",
        "AvgPool",
        "双向RNN",
        "序列到序列",
    ],
    "transformers": [
        "预训练",
        "微调",
    ],
    "clustering": [
        "Agglomerative",
        "BIRCH",
        "GMM",
        "内部评估",
    ],
}

# ── Cross-reference append to markdown ──
XREFS = {
    "neural-networks": """

---

## 继续学习

- [第10章 CNN&RNN](/ml-book/cnn-rnn) 学习特殊网络结构
- [第11章 Transformer](/ml-book/transformers) 理解注意力机制
""",
    "cnn-rnn": """

---

## 继续学习

- [第11章 Transformer](/ml-book/transformers) 看注意力如何取代RNN
- [第14章 生成模型](/ml-book/generative-models) 用CNN做图像生成
""",
    "transformers": """

---

## 继续学习

- [第9章 神经网络](/ml-book/neural-networks) 回顾基础训练技巧
- [第8章 集成学习](/ml-book/ensemble) 对比两种提升模型性能的范式
""",
    "clustering": """

---

## 继续学习

- [第13章 降维](/ml-book/dimensionality-reduction) 用PCA可视化聚类结果
- [第1章 绪论](/ml-book/introduction) 回顾无监督学习的整体定位
""",
}


def merge_glossary(existing_text, new_terms):
    """Ensure all new_terms are in the glossary. Returns updated JSON text."""
    existing = json.loads(existing_text or "[]")
    existing_terms = {t["term"] for t in existing}
    added = 0
    for nt in new_terms:
        if nt["term"] not in existing_terms:
            existing.append(nt)
            existing_terms.add(nt["term"])
            added += 1
    return json.dumps(existing, ensure_ascii=False), added


def merge_quiz(existing_text, new_items, target_count=3):
    """Add new quiz items until reaching target_count. Returns updated JSON text."""
    existing = json.loads(existing_text or "[]")
    added = 0
    for qi in new_items:
        if len(existing) >= target_count:
            break
        existing.append(qi)
        added += 1
    return json.dumps(existing, ensure_ascii=False), added


def merge_list(existing_text, new_items):
    """Add new items to list, deduping. Returns updated JSON text."""
    existing = set(json.loads(existing_text or "[]"))
    added = 0
    for item in new_items:
        if item not in existing:
            existing.add(item)
            added += 1
    return json.dumps(sorted(existing), ensure_ascii=False), added


async def enrich():
    engine = create_async_engine(db_url)
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one_or_none()
        if not book:
            print("ERROR: ML book not found. Run seed_ml_book.py first.")
            return
        book_id = book.id

        for slug in CH_SLUGS:
            r2 = await db.execute(
                select(MLBookChapter).where(
                    MLBookChapter.book_id == book_id,
                    MLBookChapter.slug == slug,
                )
            )
            chapter = r2.scalar_one_or_none()
            if not chapter:
                print(f"  SKIP: chapter '{slug}' not found")
                continue

            updated = []

            # 1) Glossary
            if slug in GLOSSARY:
                new_json, n = merge_glossary(chapter.glossary, GLOSSARY[slug])
                chapter.glossary = new_json
                if n:
                    updated.append(f"glossary +{n}")

            # 2) Quiz
            if slug in QUIZ:
                new_json, n = merge_quiz(chapter.quiz, QUIZ[slug], target_count=3)
                chapter.quiz = new_json
                if n:
                    updated.append(f"quiz +{n}")

            # 3) Checklist
            if slug in CHECKLIST:
                new_json, n = merge_list(chapter.checklist, CHECKLIST[slug])
                chapter.checklist = new_json
                if n:
                    updated.append(f"checklist +{n}")

            # 4) Keywords
            if slug in KEYWORDS:
                new_json, n = merge_list(chapter.keywords, KEYWORDS[slug])
                chapter.keywords = new_json
                if n:
                    updated.append(f"keywords +{n}")

            # 5) Cross-reference append to markdown
            if slug in XREFS:
                xref = XREFS[slug]
                existing_md = chapter.markdown or ""
                if xref not in existing_md:
                    chapter.markdown = existing_md + xref
                    updated.append("cross-refs appended")

            if updated:
                print(f"  {slug}: {', '.join(updated)}")
            else:
                print(f"  {slug}: (no changes)")

        await db.commit()
        print(f"\nOK: {len(CH_SLUGS)} chapters processed")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(enrich())
