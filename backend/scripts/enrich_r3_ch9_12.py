"""Append visual content (ASCII diagrams + image placeholders) to ML book ch9-12.

Run: cd backend && python3 scripts/enrich_r3_ch9_12.py
"""
import asyncio
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

# ── Visual append content per chapter slug ──

APPENDS = {
    "neural-networks": r"""

---

## 可视化补充

### MLP 网络结构

```
  输入层         隐藏层1        隐藏层2         输出层
 (特征向量)    (ReLU 激活)    (ReLU 激活)    (Softmax)

    x₁ ────┐
           │      h₁(1)          h₁(2)
    x₂ ────┤        │              │
           ├─────── h₂(1) ──────── h₂(2)
    x₃ ────┤        │    \       /   │           ŷ₁
           │        │     \     /    │          /
    ... ───┤       ...  ── h₃(2) ── ... ───── ŷ₂
           │        │     /     \    │          \
    xₙ ────┘        │    /       \   │           ŷₖ
                   hₘ(1)          hₗ(2)

    d 维输入  ──→  W^(1): (m,d)  ──→  W^(2): (l,m)  ──→  W^(3): (k,l)

    z^(l) = W^(l) a^(l-1) + b^(l)
    a^(l) = f(z^(l))
```

![MLP网络结构](https://placehold.co/700x400/8b5cf6/white?text=MLP+Architecture)

![激活函数对比图](https://placehold.co/700x350/06b6d4/white?text=Activation+Functions)

### 反向传播示意

```
  Forward Pass (green)                    Backward Pass (red)

   x ──→ z¹ ──→ a¹ ──→ z² ──→ a² ──→ z³ ──→ ŷ
                                        ↓
  ∂L/∂x ←── ∂L/∂z¹ ←── ∂L/∂a¹ ←── ∂L/∂z² ←── ∂L/∂a² ←── ∂L/∂z³ ← ∂L/∂ŷ

  链式法则: δ^(l) = ∂L/∂z^(l) = (W^(l+1))^T δ^(l+1) ⊙ f'(z^(l))
```

![反向传播示意](https://placehold.co/700x400/10b981/white?text=Backpropagation)
""",
    "cnn-rnn": r"""

---

## 可视化补充

### CNN 卷积运算（滑动窗口）

```
  输入 5×5              3×3 卷积核            输出 3×3 特征图

  ┌─────────────────┐    ┌──────────┐     ┌──────────────┐
  │ 1  2  3  0  1   │    │ 1  0 -1  │     │  ?  ?  ?     │
  │ 0  1  2  3  0   │    │ 1  0 -1  │     │  ?  ?  ?     │
  │ 3  0  1  2  1   │    │ 1  0 -1  │     │  ?  ?  ?     │
  │ 2  3  0  1  2   │    └──────────┘     └──────────────┘
  │ 1  2  1  0  3   │
  └─────────────────┘    步1: 1×1+2×0+3×(-1)
                               +0×1+1×0+2×(-1)
    H_out = └(5-3+2×0)/1 + 1 = 3     +3×1+0×0+1×(-1) = -2

  每个 3×3 窗口与卷积核逐元素相乘再求和
```

![CNN卷积运算](https://placehold.co/700x350/6366f1/white?text=CNN+Convolution)

### LSTM 门控结构（单个时间步）

```
  ┌─────────────────────────────────────────────────────┐
  │                   LSTM Cell (t)                     │
  │                                                     │
  │   c_{t-1} ─────────────────────────────×────→ c_t   │
  │                    ┌─────┐        +──/              │
  │                    │  f  │        │                 │
  │   h_{t-1} ──┬──┤ 遗忘门 ├────────┘                 │
  │             │     └─────┘                           │
  │             │     ┌─────┐     ┌──────┐              │
  │             ├──┤  i  ├──×──┤ c̃    ├──┐             │
  │             │     └─────┘     └──────┘  │            │
  │    x_t  ────┤               (tanh)      │            │
  │             │     ┌─────┐               │            │
  │             └──┤  o  ├─×────────────────┤            │
  │                   └─────┘               │            │
  │                     │                   │            │
  │                     └──→ h_t ←─────────┘            │
  │                          (tanh ○ c_t)               │
  └─────────────────────────────────────────────────────┘

  门控公式:
    f_t = σ(W_f·[h_{t-1}, x_t] + b_f)    遗忘门
    i_t = σ(W_i·[h_{t-1}, x_t] + b_i)    输入门
    c̃_t = tanh(W_c·[h_{t-1}, x_t] + b_c)  候选记忆
    c_t = f_t ⊙ c_{t-1} + i_t ⊙ c̃_t      细胞状态
    o_t = σ(W_o·[h_{t-1}, x_t] + b_o)    输出门
    h_t = o_t ⊙ tanh(c_t)                 隐藏状态
```

![LSTM门控结构](https://placehold.co/700x400/f59e0b/white?text=LSTM+Gates)
""",
    "transformers": r"""

---

## 可视化补充

### Self-Attention 计算流程

```
  Sequence:  "The  cat  sat  on  the  mat"
               x₁   x₂   x₃   x₄   x₅   x₆

  ┌─────────────────────────────────────────────┐
  │  1. Linear Projections (W^Q, W^K, W^V)      │
  │     Q = X·W^Q    K = X·W^K    V = X·W^V    │
  │                                             │
  │  2. Attention Scores                        │
  │     scores = Q·K^T / √d_k                   │
  │                                             │
  │        K₁  K₂  K₃  K₄  K₅  K₆              │
  │     ┌─────────────────────────┐              │
  │  Q₁ │ s₁₁ s₁₂ s₁₃ s₁₄ s₁₅ s₁₆│              │
  │  Q₂ │ s₂₁ s₂₂ s₂₃ s₂₄ s₂₅ s₂₆│              │
  │  Q₃ │ s₃₁ s₃₂ s₃₃ s₃₄ s₃₅ s₃₆│  ← 每个 token │
  │  Q₄ │ s₄₁ s₄₂ s₄₃ s₄₄ s₄₅ s₄₆│     关注所有  │
  │  Q₅ │ s₅₁ s₅₂ s₅₃ s₅₄ s₅₅ s₅₆│     token     │
  │  Q₆ │ s₆₁ s₆₂ s₆₃ s₆₄ s₆₅ s₆₆│              │
  │     └─────────────────────────┘              │
  │                                             │
  │  3. Softmax (per row) → attention weights    │
  │  4. Output = softmax(scores) · V            │
  │                                             │
  │  5. Multi-Head: concat(head₁,...,head_h)·W^O │
  └─────────────────────────────────────────────┘

  关键维度:
    Q, K, V: [B, S, d_model] ─分头─→ [B, h, S, d_k]
    scores:  [B, h, S, S]
    output:  [B, S, d_model]
```

![Transformer架构](https://placehold.co/800x500/8b5cf6/white?text=Transformer+Architecture)

![Self-Attention计算](https://placehold.co/700x400/ef4444/white?text=Self+Attention)
""",
    "clustering": r"""

---

## 可视化补充

### K-Means 迭代过程

```
  Iteration 0 (随机初始化)          Iteration 1
  ┌──────────────────────┐    ┌──────────────────────┐
  │  •  •   •            │    │  ★─→•  •   •         │
  │      ★₁  •  •        │    │      ★₁─→•  •        │
  │    •     •  ★₂ •     │    │    •     •  ★₂─→•    │
  │  •  ★₃   •     •     │    │  •─→★₃   •     •    │
  │        •  •   •      │    │        •  •   •      │
  └──────────────────────┘    └──────────────────────┘
       ★ = 初始中心                  ★ = 新中心 (均值)

  Iteration 2 (收敛)              最终聚类结果
  ┌──────────────────────┐    ┌──────────────────────┐
  │  ●  ●   ●            │    │  ●  ●   ●            │
  │      ★₁  ●  ●        │    │      ★₁  ●  ●        │
  │    ●     ●  ★₂ ●     │    │    ●     ●  ★₂ ▲     │
  │  ▲  ★₃   ▲     ▲     │    │  ▲  ★₃   ▲     ▲     │
  │        ●  ▲   ▲      │    │        ●  ▲   ▲      │
  └──────────────────────┘    └──────────────────────┘
       ★ 中心不再移动            ● Cluster 1   ▲ Cluster 2

  算法:
    1. 随机选 K 个初始中心
    2. 分配: 每个点归入最近中心所在的簇
    3. 更新: 用簇内点的均值作为新中心
    4. 重复 2-3 直到中心不再变化
```

![K-Means迭代过程](https://placehold.co/700x400/6366f1/white?text=KMeans+Iterations)

### DBSCAN 密度聚类示意

```
  核心点 ● (min_samples=3, ε 如虚线圆半径)
  边界点 ○ (在某核心点 ε 邻域内但自身不足 min_samples)
  噪声点 × (不在任何核心点 ε 邻域内)

  ┌──────────────────────────────────────┐
  │                                      │
  │    ●────●                            │
  │   /  ●──┼──●      ×                 │
  │  ●──●   │   ●                        │
  │   \  ●──┘  /                         │
  │    ●────●─●         ●────●           │
  │                    /      \          │
  │         ×         ●   ●    ●         │
  │                    \      /          │
  │                     ●────●           │
  │                           ×          │
  │                ×                     │
  └──────────────────────────────────────┘
        Cluster A       Cluster B    Noise

  DBSCAN 特点:
    - 无需预设簇数 K
    - 可发现任意形状的簇
    - 自动识别噪声点
    - 依赖参数 ε (邻域半径) 和 min_samples (密度阈值)
```

![DBSCAN密度聚类](https://placehold.co/700x400/10b981/white?text=DBSCAN+Density)
""",
}


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

        for slug, append_md in APPENDS.items():
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

            existing_md = chapter.markdown or ""
            if append_md in existing_md:
                print(f"  SKIP: '{slug}' already has visual content")
                continue

            chapter.markdown = existing_md + append_md
            print(f"  Enriched: {slug} ({len(append_md)} chars appended)")

        await db.commit()
        print(f"\nOK: {len(APPENDS)} chapters processed")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(enrich())
