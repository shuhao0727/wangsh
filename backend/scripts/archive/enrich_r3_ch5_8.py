"""Enrich ML book chapters 5-8 with visual content (ASCII diagrams, images, mermaid).

APPENDS visual sections to existing markdown — does NOT replace.
Run: cd backend && python3 scripts/enrich_r3_ch5_8.py
"""
import asyncio, os, sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")

SLUGS = ["decision-trees", "svm", "bayesian", "ensemble"]

# ── Visual content blocks to APPEND ──────────────

VISUAL = {
    "decision-trees": """

---

## 可视化：决策树结构

### ASCII 决策树示意图

```
                     [根节点: 花瓣长度 ≤ 2.45?]
                           /            \\
                         是              否
                        /                  \\
              [山鸢尾 ← 叶节点]    [花瓣宽度 ≤ 1.75?]
                                     /           \\
                                   是             否
                                  /                \\
                        [杂色鸢尾 ← 叶节点]  [维吉尼亚鸢尾 ← 叶节点]
```

```
树形结构说明:
  ┌──── 内部节点 (Internal Node): 对某个特征进行测试
  ├──── 分支 (Branch): 测试结果导向下一个节点
  └──── 叶节点 (Leaf Node): 最终的分类决策

典型超参数控制树的生长:
  • max_depth     — 限制树的最大深度 (防过拟合)
  • min_samples_split — 内部节点最少样本数
  • min_samples_leaf   — 叶节点最少样本数
```

![决策树结构示例](https://placehold.co/800x400/10b981/white?text=Decision+Tree+Structure)

### KNN 决策边界

```
KNN 的 Voronoi 图示意 (k=1):

    •A类  •B类  ⋆新样本
      ┌───────┬───────┐
      │  A A  │  B B  │
      │   A ⋆ │ B B   │  ← 新样本被 B 类包围, 预测为 B
      │  A A  │  B    │
      └───────┴───────┘

    k=3 → 最近的3个: A,A,B → 多数投票 → 预测A
    k=5 → 最近的5个: A,A,B,B,B → 多数投票 → 预测B
    结论: k 值直接影响决策边界的平滑度
```

![KNN Voronoi图](https://placehold.co/600x400/6366f1/white?text=KNN+Voronoi)

### Mermaid: 决策树分类流程

```mermaid
flowchart TD
    A[输入样本 x] --> B{特征1 ≤ 阈值?}
    B -->|是| C{特征2 ≤ 阈值?}
    B -->|否| D{特征3 ≤ 阈值?}
    C -->|是| E[叶节点: 类别A]
    C -->|否| F[叶节点: 类别B]
    D -->|是| G[叶节点: 类别B]
    D -->|否| H[叶节点: 类别A]
    
    style A fill:#10b981,stroke:#fff,color:#fff
    style B fill:#6366f1,stroke:#fff,color:#fff
    style C fill:#6366f1,stroke:#fff,color:#fff
    style D fill:#6366f1,stroke:#fff,color:#fff
    style E fill:#f59e0b,stroke:#fff,color:#fff
    style F fill:#f59e0b,stroke:#fff,color:#fff
    style G fill:#f59e0b,stroke:#fff,color:#fff
    style H fill:#f59e0b,stroke:#fff,color:#fff
```

### Mermaid: 决策树训练流程

```mermaid
flowchart TD
    A[全部训练数据] --> B[选择最佳特征 & 阈值划分]
    B --> C{是否满足停止条件?}
    C -->|否, 左子集| D[递归构建左子树]
    C -->|否, 右子集| E[递归构建右子树]
    C -->|是| F[生成叶节点]
    D --> G[返回子树根节点]
    E --> G
    F --> G
    G --> H[完整决策树]
    
    style A fill:#10b981,stroke:#fff,color:#fff
    style B fill:#6366f1,stroke:#fff,color:#fff
    style C fill:#8b5cf6,stroke:#fff,color:#fff
    style F fill:#f59e0b,stroke:#fff,color:#fff
    style H fill:#ef4444,stroke:#fff,color:#fff
```
""",

    "svm": """

---

## 可视化：支持向量机

### ASCII 最大间隔示意

```
         ↑ 特征2
         │
         │     ○          ○  ← 正类 (y=+1)
         │   ○   ○    ○
         │  ○  □  ○      □ ← 支持向量 (Support Vectors)
         │    ○   ○
  ─ ─ ─ ─ ┼─ ─ ─ ─ ─ ─ ─ ─   ← 决策边界 w^T x + b = 0
         │  ●   ●
         │    ●  ■  ●       ■ ← 支持向量 (Support Vectors)
         │   ●    ●  ●
         │      ●     ●     ← 负类 (y=-1)
         │
         └───────────────────→ 特征1

  ═══ 最大间隔超平面 (Maximum Margin Hyperplane)
  ─ ─ 间隔边界 (Margin Boundary): w^T x + b = ±1
  □/■ 支持向量 — 离超平面最近的点, 决定超平面位置
```

```
关键概念:
  • 仅支持向量决定超平面 — 其他点可丢弃而不影响模型
  • 间隔 (Margin) = 2 / ||w||
  • 最大化间隔 ⇔ 最小化 ||w||   (正则化效果)
  • C 参数控制"软间隔"容错程度:
      C 大 → 更少容错 → 更贴合训练数据
      C 小 → 更多容错 → 更宽间隔, 泛化更好
```

![SVM最大间隔与支持向量](https://placehold.co/700x400/8b5cf6/white?text=SVM+Max+Margin)

### 核函数映射示意

```
原始空间 (线性不可分)         高维特征空间 (线性可分)

    ●   ○                     φ(x₂)↑
    ● ○ ○                         │  ●  ●  ●
  ●   ○   ●              φ:       │    ●  ●  ●
    ○   ●                   x ↦   │  ○  ○  ○
  ○   ●   ○                       │    ○  ○  ○
                                   └──────────→ φ(x₁)

核技巧: 无需显式计算 φ(x), 直接用 K(x,z) = ⟨φ(x),φ(z)⟩
常用核: 线性 → 多项式 → RBF (高斯) → Sigmoid
     简单                         复杂
     ───────────────────────────────→
      表达能力增强, 过拟合风险也增大
```

![核函数映射示意](https://placehold.co/700x400/06b6d4/white?text=Kernel+Mapping)

### Mermaid: SVM 分类决策流程

```mermaid
flowchart TD
    A[输入样本 x] --> B[核函数 K&#40;x, x_i&#41; 计算与支持向量的相似度]
    B --> C[计算决策函数 f&#40;x&#41; = Σ α_i y_i K&#40;x, x_i&#41; + b]
    C --> D{f&#40;x&#41; ≥ 0 ?}
    D -->|是| E[预测: 正类 &#40;+1&#41;]
    D -->|否| F[预测: 负类 &#40;-1&#41;]
    
    style A fill:#10b981,stroke:#fff,color:#fff
    style B fill:#8b5cf6,stroke:#fff,color:#fff
    style C fill:#6366f1,stroke:#fff,color:#fff
    style D fill:#f59e0b,stroke:#fff,color:#fff
    style E fill:#10b981,stroke:#fff,color:#fff
    style F fill:#ef4444,stroke:#fff,color:#fff
```

### Mermaid: SVM 训练流程

```mermaid
flowchart TD
    A[训练数据] --> B[选择核函数 & 参数 C]
    B --> C[求解对偶问题: max Σ α_i - ½ Σ α_i α_j y_i y_j K&#40;x_i,x_j&#41;]
    C --> D[得到支持向量 &#40;α_i > 0 的样本&#41;]
    D --> E[计算偏置 b]
    E --> F[存储支持向量 & 模型参数]
    F --> G[SVM 模型就绪]
    
    style A fill:#10b981,stroke:#fff,color:#fff
    style B fill:#8b5cf6,stroke:#fff,color:#fff
    style D fill:#f59e0b,stroke:#fff,color:#fff
    style G fill:#ef4444,stroke:#fff,color:#fff
```
""",

    "bayesian": """

---

## 可视化：贝叶斯网络与分类

### ASCII 贝叶斯网络示意

```
朴素贝叶斯图结构:

                    ┌───────────┐
                    │  类别 Y   │  ← 父节点 (类别标签)
                    └─────┬─────┘
               ┌──────────┼──────────┐
               │          │          │
               ▼          ▼          ▼
          ┌────────┐ ┌────────┐ ┌────────┐
          │ 特征 X₁│ │ 特征 X₂│ │ 特征 X₃│  ← 子节点 (特征)
          └────────┘ └────────┘ └────────┘

  条件独立性假设: P(X₁,X₂,X₃ | Y) = P(X₁|Y) · P(X₂|Y) · P(X₃|Y)
  尽管"朴素"假设在现实中不成立, 但分类效果仍然出色

通用贝叶斯网络 (非朴素):

                    ┌───────────────┐
                    │  天气 Weather │
                    └───┬───────┬───┘
                        │       │
               ┌────────▼──┐  ┌─▼──────────┐
               │ 草坪湿润  │  │ 洒水器开启  │
               │  Grass Wet│  │ Sprinkler   │
               └───────────┘  └─────────────┘

  允许特征间存在依赖关系, 更真实但计算复杂
```

![朴素贝叶斯分类流程](https://placehold.co/700x350/f59e0b/white?text=Naive+Bayes+Flow)

### 先验 vs 后验更新

```
先验 → 观测 → 后验 的更新过程:

概率 ↑
1.0 ┤                              ┌──── 后验 (Posterior)
    │                          ／
0.5 ┤              ┌──── 先验 (Prior: Beta&#40;2,2&#41;)
    │          ／                            │
    │      ／                    ← 观测到 8 次成功, 2 次失败后
    │  ／                      后验 = Beta&#40;10,4&#41; 更集中在 0.7 附近
0.0 ┼──┬────┬────┬────┬────┬────┬────┬────┬───→ θ
    0.0 0.1  0.2  0.3  0.4  0.5  0.6  0.7  0.8

直觉: 数据越多, 后验越尖锐 (确定性越高)
      先验 = 初始信念, 后验 = 更新后的信念
```

![先验与后验更新](https://placehold.co/600x400/ef4444/white?text=Prior+vs+Posterior)

### Mermaid: 贝叶斯分类流程

```mermaid
flowchart TD
    A[训练数据] --> B[计算先验概率 P&#40;Y=c_k&#41;]
    A --> C[计算条件概率 P&#40;X_j|Y=c_k&#41;]
    B --> D[新样本 x 到来]
    C --> D
    D --> E[计算后验 P&#40;Y=c_k|X=x&#41; ∝ P&#40;Y=c_k&#41; · Π P&#40;x_j|Y=c_k&#41;]
    E --> F[选择后验最大的类别 ŷ = argmax P&#40;Y=c_k|X=x&#41;]
    F --> G[输出预测类别]
    
    style A fill:#10b981,stroke:#fff,color:#fff
    style B fill:#8b5cf6,stroke:#fff,color:#fff
    style C fill:#8b5cf6,stroke:#fff,color:#fff
    style E fill:#f59e0b,stroke:#fff,color:#fff
    style G fill:#ef4444,stroke:#fff,color:#fff
```

### Mermaid: 三种 NB 变体对比

```mermaid
flowchart LR
    subgraph GN[高斯朴素贝叶斯]
        G1[特征: 连续数值] --> G2[P&#40;x|Y&#41; ~ N&#40;μ,σ²&#41;]
        G2 --> G3[适用: 身高/体重/温度]
    end
    
    subgraph MN[多项式朴素贝叶斯]
        M1[特征: 离散计数] --> M2[P&#40;x|Y&#41; ∝ 词频]
        M2 --> M3[适用: 文本分类/词频统计]
    end
    
    subgraph BN[伯努利朴素贝叶斯]
        B1[特征: 0/1 二值] --> B2[P&#40;x|Y&#41; ∝ 出现/不出现]
        B2 --> B3[适用: 词是否出现/布尔特征]
    end
    
    style G1 fill:#10b981,stroke:#fff,color:#fff
    style M1 fill:#6366f1,stroke:#fff,color:#fff
    style B1 fill:#8b5cf6,stroke:#fff,color:#fff
```
""",

    "ensemble": """

---

## 可视化：集成学习

### ASCII Bagging vs Boosting 流程

```
Bagging (并行训练):
  原始数据 D (n个样本)
      │
      ├── Bootstrap 采样 ──→ D₁ (63.2%) ──→ 训练 ──→ 模型 M₁
      ├── Bootstrap 采样 ──→ D₂ (63.2%) ──→ 训练 ──→ 模型 M₂
      ├── Bootstrap 采样 ──→ D₃ (63.2%) ──→ 训练 ──→ 模型 M₃
      │      ⋮                     ⋮                   ⋮
      └── Bootstrap 采样 ──→ Dₘ (63.2%) ──→ 训练 ──→ 模型 Mₘ
                                                      │
                                    ┌─ 分类: 多数投票 ─┤
                                    └─ 回归: 平均 ────┘
                                                      ↓
                                                 最终预测

Boosting (串行训练):
  原始数据 D ──→ 训练 ──→ 模型 M₁ (关注错误)
                              │
                   更新样本权重 (错误样本 ↑)
                              │
                              ▼
                          训练 ──→ 模型 M₂ (纠正 M₁ 的错误)
                              │
                   更新样本权重 (错误样本 ↑)
                              │
                              ▼
                          训练 ──→ 模型 M₃ (纠正 M₂ 的错误)
                              │      ⋮
                              ▼
                   最终模型 = ν · Σ Mᵢ  (加权组合, ν 为学习率)

对比:
  Bagging:  并行, 降方差, 对噪声鲁棒 (代表: 随机森林)
  Boosting: 串行, 降偏差, 可能过拟合噪声 (代表: XGBoost)
```

![Bagging vs Boosting对比](https://placehold.co/800x400/10b981/white?text=Bagging+vs+Boosting)

### 随机森林示意

```
随机森林 = Bagging + 特征随机:

                    原始数据
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      样本采样      样本采样      样本采样
      (63.2%)      (63.2%)      (63.2%)
          │            │            │
          ▼            ▼            ▼
      决策树1      决策树2      决策树3
      (深度大)     (深度大)     (深度大)
   特征随机:    特征随机:    特征随机:
   选 √d 个     选 √d 个     选 √d 个
   特征分裂    特征分裂    特征分裂
          │            │            │
          └────────────┼────────────┘
                       │
                 多数投票 / 平均
                       │
                       ▼
                   最终预测

双重随机性来源:
  ① 样本随机: Bootstrap 采样 (~63.2% 每棵树)
  ② 特征随机: 每次分裂只考虑随机子集 (默认 √d 个特征)

这保证了树之间的多样性, 是随机森林效果好的根本原因
```

![随机森林示意](https://placehold.co/700x350/6366f1/white?text=Random+Forest)

### Mermaid: Bagging vs Boosting 训练流程

```mermaid
flowchart TD
    subgraph BG[Bagging 并行]
        B1[D₁ 采样] --> BM1[模型 M₁]
        B2[D₂ 采样] --> BM2[模型 M₂]
        B3[D₃ 采样] --> BM3[模型 M₃]
        BM1 --> BV[投票/平均]
        BM2 --> BV
        BM3 --> BV
        BV --> BR[最终预测]
    end
    
    subgraph BT[Boosting 串行]
        T1[全量数据] --> TM1[模型 M₁]
        TM1 --> TW1[更新权重]
        TW1 --> TM2[模型 M₂]
        TM2 --> TW2[更新权重]
        TW2 --> TM3[模型 M₃]
        TM1 --> TW[加权组合]
        TM2 --> TW
        TM3 --> TW
        TW --> TR[最终预测]
    end
    
    style BG fill:#e0f2fe,stroke:#0284c7
    style BT fill:#fef3c7,stroke:#d97706
    style BR fill:#10b981,stroke:#fff,color:#fff
    style TR fill:#ef4444,stroke:#fff,color:#fff
```

### Mermaid: 集成学习算法族谱

```mermaid
flowchart TD
    ENS[集成学习 Ensemble] --> BAG[Bagging<br/>并行, 降方差]
    ENS --> BST[Boosting<br/>串行, 降偏差]
    ENS --> STK[Stacking<br/>元学习器组合]
    
    BAG --> RF[随机森林<br/>Random Forest]
    BAG --> ET[极端随机树<br/>Extra Trees]
    
    BST --> XGB[XGBoost<br/>正则化梯度提升]
    BST --> LGB[LightGBM<br/>Leaf-wise, GOSS]
    BST --> CB[CatBoost<br/>原生类别特征]
    BST --> ADA[AdaBoost<br/>自适应提升]
    
    STK --> BL[Blending<br/>留出法元特征]
    STK --> ST[Stacking CV<br/>交叉验证元特征]
    
    style ENS fill:#8b5cf6,stroke:#fff,color:#fff
    style BAG fill:#10b981,stroke:#fff,color:#fff
    style BST fill:#f59e0b,stroke:#fff,color:#fff
    style STK fill:#6366f1,stroke:#fff,color:#fff
    style RF fill:#6ee7b7,stroke:#000,color:#000
    style ET fill:#6ee7b7,stroke:#000,color:#000
    style XGB fill:#fcd34d,stroke:#000,color:#000
    style LGB fill:#fcd34d,stroke:#000,color:#000
    style CB fill:#fcd34d,stroke:#000,color:#000
    style ADA fill:#fcd34d,stroke:#000,color:#000
    style BL fill:#a5b4fc,stroke:#000,color:#000
    style ST fill:#a5b4fc,stroke:#000,color:#000
```
""",
}

# ── Append function ───────────────────────────────

async def enrich():
    engine = create_async_engine(db_url)
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one_or_none()
        if not book:
            print("ERROR: MLBook not found for module_key='ml'")
            return
        book_id = book.id

        for slug in SLUGS:
            if slug not in VISUAL:
                print(f"WARN: No visual content for slug='{slug}'")
                continue

            r2 = await db.execute(
                select(MLBookChapter).where(
                    MLBookChapter.book_id == book_id,
                    MLBookChapter.slug == slug
                )
            )
            chapter = r2.scalar_one_or_none()
            if not chapter:
                print(f"WARN: Chapter not found for slug='{slug}'")
                continue

            current = chapter.markdown or ""
            chapter.markdown = current + VISUAL[slug]
            print(f"Appended visuals to: {chapter.chapter_number}. {chapter.title} ({slug})")

        await db.commit()
        print(f"\nOK: {len(SLUGS)} chapters enriched with visual content")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(enrich())
