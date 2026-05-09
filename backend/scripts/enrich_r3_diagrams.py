"""Append Mermaid architecture diagrams to ML book chapters 1-8.

Run: cd backend && python3 scripts/enrich_r3_diagrams.py
"""
import asyncio, os, sys
sys.path.insert(0, ".")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

# Chapters 1-8 slugs in order
SLUGS = [
    "introduction",
    "math-foundations",
    "model-evaluation",
    "linear-models",
    "decision-trees",
    "svm",
    "bayesian",
    "ensemble",
]

DIAGRAMS = {
    "introduction": """
## 架构图解

机器学习项目完整工作流程：

```mermaid
graph LR
  A["数据采集"] --> B["数据清洗"]
  B --> C["特征工程"]
  C --> D["模型选择"]
  D --> E["模型训练"]
  E --> F["模型评估"]
  F --> G["超参数调优"]
  G --> H["部署监控"]
```
""",

    "math-foundations": """
## 架构图解

梯度下降收敛过程——从初始参数迭代逼近最优解：

```mermaid
graph TD
  A["初始化参数 θ"] --> B["计算梯度 ∇J(θ)"]
  B --> C{"梯度 &lt; 阈值?"}
  C -->|否| D["θ = θ - α·∇J(θ)"]
  D --> B
  C -->|是| E["收敛到最优解 θ*"]
```
""",

    "model-evaluation": """
## 架构图解

训练/验证/测试数据划分与模型迭代流程：

```mermaid
graph TB
  A["原始数据集"] --> B{"数据划分"}
  B -->|"70%"| C["训练集 Train"]
  B -->|"15%"| D["验证集 Val"]
  B -->|"15%"| E["测试集 Test"]
  C --> F["模型训练"]
  F --> G["在Val上验证"]
  G --> H{"满足要求?"}
  H -->|是| I["最终测试评估"]
  H -->|否| J["调整超参数"]
  J --> F
  E --> I
```
""",

    "linear-models": """
## 架构图解

逻辑回归决策流程——从线性组合到概率输出：

```mermaid
graph LR
  A["输入特征 x"] --> B["线性组合 wᵀx+b"]
  B --> C["σ(z) = 1/(1+e⁻ᶻ)"]
  C --> D{"Sigmoid(z) ≥ 0.5?"}
  D -->|是| E["预测: 正类 1"]
  D -->|否| F["预测: 负类 0"]
```
""",

    "decision-trees": """
## 架构图解

决策树以递归分裂的方式构建分类规则，每个内部节点对特征进行测试，根据结果走向不同分支，最终到达叶节点输出预测：

```mermaid
graph TD
  A["根节点: 全量数据"] --> B{"特征1 ≤ 阈值?"}
  B -->|是| C{"特征2 ≤ 阈值?"}
  B -->|否| D{"特征3 ≤ 阈值?"}
  C -->|是| E["叶: 类别A"]
  C -->|否| F["叶: 类别B"]
  D -->|是| G["叶: 类别B"]
  D -->|否| H["叶: 类别A"]
```
""",

    "svm": """
## 架构图解

SVM通过最大化分类间隔寻找最优超平面——根据数据线性可分程度选择合适的策略：

```mermaid
graph TD
  A["线性可分SVM"] --> B["最大化分类间隔"]
  B --> C["支持向量支撑边界"]
  C --> D{"数据是否线性可分?"}
  D -->|是| E["硬间隔SVM"]
  D -->|否| F["引入松弛变量 ξ"]
  F --> G["软间隔SVM"]
  G --> H["参数C控制容错程度"]
  D -->|高度非线性| I["核技巧映射高维"]
  I --> J["RBF核 / 多项式核"]
```
""",

    "bayesian": """
## 架构图解

贝叶斯定理推导流程——从先验概率与似然出发，融合观测数据后计算后验概率来做分类决策：

```mermaid
graph LR
  A["先验概率 P(Y)"] --> C["后验概率 P(Y|X)"]
  B["似然 P(X|Y)"] --> C
  C --> D["贝叶斯决策"]
  D --> E["选择后验最大类别"]
  E --> F["朴素条件独立假设"]
  F --> G["∏P(xᵢ|Y)·P(Y)"]
```
""",

    "ensemble": """
## 架构图解

Bagging（并行）与Boosting（串行）两种核心集成策略对比：

```mermaid
graph TB
  subgraph Bagging["Bagging 并行训练"]
    A1["Bootstrap采样1"] --> B1["基学习器1"]
    A2["Bootstrap采样2"] --> B2["基学习器2"]
    A3["Bootstrap采样3"] --> B3["基学习器3"]
    B1 --> C1["投票 / 平均"]
    B2 --> C1
    B3 --> C1
  end
  subgraph Boosting["Boosting 串行训练"]
    D1["基学习器1"] --> E1["错误样本权重↑"]
    E1 --> D2["基学习器2"]
    D2 --> E2["错误样本权重↑"]
    E2 --> D3["基学习器3"]
    D1 --> F1["加权组合"]
    D2 --> F1
    D3 --> F1
  end
```
""",
}

async def enrich():
    engine = create_async_engine(os.environ["DATABASE_URL"])
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one_or_none()
        if not book:
            print("ERROR: MLBook not found for module_key='ml'")
            return
        book_id = book.id

        for slug in SLUGS:
            if slug not in DIAGRAMS:
                print(f"WARN: No diagram content for slug='{slug}'")
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

            if chapter.markdown and "## 架构图解" in chapter.markdown:
                print(f"SKIP: {chapter.chapter_number}. {chapter.title} ({slug}) - already has diagram section")
                continue

            chapter.markdown = (chapter.markdown or "") + DIAGRAMS[slug]
            print(f"APPEND: {chapter.chapter_number}. {chapter.title} ({slug})")

        await db.commit()
        print(f"\nOK: {len(SLUGS)} chapters processed")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(enrich())
