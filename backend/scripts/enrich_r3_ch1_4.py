import asyncio, os, sys
sys.path.insert(0, ".")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

SLUGS = ["introduction", "math-foundations", "model-evaluation", "linear-models"]

DIAGRAMS = {
    "introduction": r"""

## 可视化理解

### 机器学习项目八阶段工作流

```
+-----------+    +------------+    +-------------+    +--------------+
| 1.问题定义 |--->| 2.数据采集 |--->| 3.数据预处理|--->| 4.特征工程    |
| Problem   |    | Data       |    | Cleaning &  |    | Feature      |
| Definition |    | Collection |    | Preprocess  |    | Engineering  |
+-----------+    +------------+    +-------------+    +--------------+
      ^                                                      |
      |                                                      v
+-----------+    +------------+    +-------------+    +--------------+
| 8.部署监控 |<---| 7.模型评估 |<---| 6.模型训练   |<---| 5.模型选择   |
| Deploy &  |    | Evaluation |    | Training &  |    | Model        |
| Monitor   |    | & Select   |    | Tuning      |    | Selection    |
+-----------+    +------------+    +-------------+    +--------------+
```

核心问题速查：
- **问题定义**：这是分类、回归还是聚类？业务目标是什么？
- **数据采集**：数据从哪来？是否合法合规？样本量够吗？
- **数据预处理**：缺失值怎么处理？异常值怎么检测？
- **特征工程**：哪些特征有用？是否需要构造新特征？
- **模型选择**：线性模型还是树模型？是否需要深度学习？
- **模型训练**：损失函数选什么？超参数怎么调？
- **模型评估**：用什么指标？交叉验证怎么分？
- **部署监控**：模型如何上线？性能衰退如何监控？

![机器学习三大范式关系图](https://placehold.co/800x400/6366f1/white?text=ML+Paradigms+Diagram)

*图：监督学习、无监督学习、强化学习三大范式的对比与关系。监督学习利用标注数据做预测，无监督学习从无标注数据中发现结构，强化学习通过环境交互学习策略。*

```mermaid
graph TD
    A[机器学习] --> B[监督学习]
    A --> C[无监督学习]
    A --> D[强化学习]
    A --> E[半监督学习]

    B --> B1[分类: 预测离散标签]
    B --> B2[回归: 预测连续数值]

    C --> C1[聚类: 发现数据分组]
    C --> C2[降维: 减少特征维度]
    C --> C3[密度估计: 估计数据分布]

    D --> D1[智能体与环境交互]
    D --> D2[奖励信号驱动学习]
    D --> D3[策略优化 π⁡a|s]

    E --> E1[少量标注 + 大量未标注]
    E --> E2[自训练 / 协同训练]

    B1 --> F[应用: 垃圾邮件检测、医学诊断]
    B2 --> G[应用: 房价预测、股票趋势]
    C1 --> H[应用: 客户分群、图像分割]
    C2 --> I[应用: 数据可视化、特征压缩]
    D1 --> J[应用: AlphaGo、机器人控制]
```

### 归纳偏好与 NFL 定理

没有免费午餐定理 (No Free Lunch Theorem) 的核心洞见：

```
                    算法 A 在某些问题上表现好
                          ▲
                         / \
                        /   \
   ───────────────────/─────\────────────────────
                      /       \
                     /         \
    所有可能问题    ◉───算法A优势───◉
    的分布空间     /               \
                  /    ◉───算法B优势───◉
                 /    /               /
                ─────/───────────────/
```

**关键推论**：脱离具体问题谈算法优劣没有意义。算法的"好"必须建立在"匹配问题特性"的基础上——这就是归纳偏好的意义。
""",

    "math-foundations": r"""

## 可视化理解

### 梯度下降可视化

梯度下降沿着损失函数的负梯度方向逐步逼近最小值：

```
损失 L(w)
  ↑
  │                              ●  step 0 (w₀)
  │                             /|
  │                            / |
  │                           /  |
  │                          /   |
  │                         /    |   ← 梯度方向: ∇L(w₀)
  │                        /     |
  │                       /      ▼
  │                      /     ● step 1 (w₁)
  │                     /     /|
  │                    /     / |
  │                   /     /  |
  │                  /     /   ▼
  │                 /     /  ● step 2 (w₂)
  │                /     /  /|
  │               /     /  / |
  │              /     /  /  ▼
  │             /     /  /  ● step 3 (w₃)
  │            /     /  /  /
  │           /     /  /  /
  │          /     /  /  /
  │         /     /  /  /
  │        /     /  /  /
  │       /     /  /  /
  │      /     /  /  /
  │     └─────┴──┴──┴──  ● ● ● ●  (接近最小值)
  │               w*    w₄w₅w₆w₇
  └─────────────────────────────────────────→ 参数 w

  更新公式: w_{t+1} = w_t - η · ∇L(w_t)
             学习率 η 控制每次更新的步长
```

**学习率的影响：**
- η 太小 → 收敛慢，陷入局部极小值
- η 太大 → 震荡甚至发散，跳过最小值
- η 适中 → 快速稳定收敛

### 线性代数核心：矩阵乘法

![矩阵乘法可视化](https://placehold.co/800x300/8b5cf6/white?text=Matrix+Multiplication+Viz)

*图：矩阵乘法是 ML 的核心运算。从线性回归的 X·W 到神经网络的全连接层，再到卷积运算，本质上都是矩阵乘法及其变体。理解维度对齐 (m×n)·(n×p) = (m×p) 是理解模型结构的基础。*

```mermaid
graph TD
    A[数学基础三大支柱] --> B[线性代数]
    A --> C[概率论]
    A --> D[优化理论]

    B --> B1[标量 / 向量 / 矩阵]
    B --> B2[矩阵乘法 X·W + b]
    B --> B3[特征分解 & SVD]
    B --> B4[范数与正则化]

    C --> C1[条件概率 & 贝叶斯定理]
    C --> C2[常见分布: Gaussian, Bernoulli]
    C --> C3[最大似然估计 MLE]
    C --> C4[KL 散度 & 交叉熵]

    D --> D1[损失函数: MSE, Cross-Entropy]
    D --> D2[梯度下降 & 变体]
    D --> D3[链式法则 & 反向传播]
    D --> D4[凸优化 & 非凸优化]

    B2 --> E[神经网络全连接层]
    C1 --> F[朴素贝叶斯分类器]
    D2 --> G[所有深度学习训练]
```

### 链式法则与反向传播

反向传播的本质：将损失从输出层逐层"分配"给各级权重。

```
正向传播 (Forward Pass):
  x ──→ z¹ = W¹x ──→ a¹ = σ(z¹) ──→ z² = W²a¹ ──→ ŷ = σ(z²) ──→ L(ŷ, y)

反向传播 (Backward Pass):
  L ──→ ∂L/∂z² = (ŷ - y) ⊙ σ'(z²)
            ↓
      ∂L/∂W² = ∂L/∂z² · (a¹)ᵀ
            ↓
      ∂L/∂a¹ = (W²)ᵀ · ∂L/∂z²
            ↓
      ∂L/∂z¹ = ∂L/∂a¹ ⊙ σ'(z¹)
            ↓
      ∂L/∂W¹ = ∂L/∂z¹ · xᵀ
```
""",

    "model-evaluation": r"""

## 可视化理解

### 混淆矩阵 (Confusion Matrix)

混淆矩阵是分类模型评估的基础工具，直观展示预测结果与真实标签的对应关系：

```
                        预测结果
                  ┌─────────┬─────────┐
                  │  Positive│  Negative│
          ┌───────┼─────────┼─────────┤
   真     │Positive│   TP    │   FN    │  TP (True Positive):  预测正 ∝ 真实正
   实     │       │  (真阳)  │  (假阴)  │  FN (False Negative): 预测负 ∝ 真实正 ✗漏诊
   标     ├───────┼─────────┼─────────┤
   签     │Negative│   FP    │   TN    │  FP (False Positive): 预测正 ∝ 真实负 ✗误报
          │       │  (假阳)  │  (真阴)  │  TN (True Negative):  预测负 ∝ 真实负
          └───────┴─────────┴─────────┘
           Precision          NPV
           = TP/(TP+FP)       = TN/(TN+FN)

              Recall (TPR) = TP/(TP+FN)    ←─ 横排求和
              Specificity  = TN/(TN+FP)

  Accuracy = (TP+TN) / (TP+TN+FP+FN)  ←─ 对角线 ÷ 总数
  F1 = 2·Precision·Recall / (Precision+Recall)  ←─ P 与 R 的调和平均
```

### 阈值对分类结果的影响

```
  概率输出:  0.92  0.87  0.73  0.61  0.44  0.31  0.18  0.05
  真实标签:  +     +     -     +     -     -     +     -

  阈值=0.8:  +     +     -     -     -     -     -     -   ← 高精确率、低召回率
  阈值=0.5:  +     +     +     +     -     -     -     -   ← 平衡
  阈值=0.2:  +     +     +     +     +     +     -     -   ← 高召回率、低精确率
```

![ROC曲线与AUC](https://placehold.co/600x400/06b6d4/white?text=ROC+Curve+and+AUC)

*图：ROC 曲线以 FPR（假阳率）为横轴、TPR（真阳率）为纵轴。曲线越靠近左上角，模型性能越好。AUC 值在 0.5-1.0 之间，越接近 1.0 表示模型区分正负样本的能力越强。*

![偏差-方差权衡示意](https://placehold.co/700x350/10b981/white?text=Bias-Variance+Tradeoff)

*图：偏差（Bias）反映模型预测均值和真实值的差距，方差（Variance）反映模型对训练数据微小变化的敏感度。模型复杂度增加时，偏差下降但方差上升，最优复杂度在两者之和（总误差）最低处。*

```mermaid
graph TD
    A[模型评估流程] --> B[数据划分]
    A --> C[模型训练与调参]
    A --> D[性能评估]
    A --> E[模型比较与选择]

    B --> B1[留出法 Hold-out]
    B --> B2[K折交叉验证 CV]
    B --> B3[自助法 Bootstrap]
    B --> B4[分层抽样 Stratified]

    C --> C1[网格搜索 GridSearchCV]
    C --> C2[随机搜索 RandomizedSearchCV]
    C --> C3[贝叶斯优化 Bayesian Opt]

    D --> D1[分类指标]
    D --> D2[回归指标]
    D --> D3[统计检验]

    D1 --> D1a[Accuracy / Precision / Recall / F1]
    D1 --> D1b[ROC-AUC / PR-AUC]
    D1 --> D1c[混淆矩阵 & KS 值]

    D2 --> D2a[MSE / RMSE / MAE]
    D2 --> D2b[R² / Adjusted R²]
    D2 --> D2c[MAPE / SMAPE]

    E --> E1[偏差-方差分解]
    E --> E2[嵌套交叉验证]
    E --> E3[McNemar 检验]
    E --> E4[学习曲线分析]
```

### 过拟合 vs 欠拟合判断

```
  模型容量 (复杂度)
  ├──── 欠拟合 ────┼──── 理想 ────┼──── 过拟合 ────┤

  训练误差:  ████████████░░░░░░░░░░░░░░░░░░░░░░░░  (训练误差持续下降)
  验证误差:  ████████████░░░░██████████████████████  (验证误差先降后升)

  特征表现:
  - 欠拟合: 训练误差高 & 验证误差高 → 增加模型复杂度
  - 过拟合: 训练误差低 & 验证误差高 → 正则化 / 增加数据 / Dropout
  - 数据天花板: 验证误差 >> 训练误差且不随复杂度变化 → 数据质量问题
```
""",

    "linear-models": r"""

## 可视化理解

### Sigmoid 函数可视化

逻辑回归使用 Sigmoid 函数将线性组合映射到 (0,1) 区间：

```
  σ(z)
  1.0 ┤                                    ╭──────
      │                                  ╭──╯
      │                               ╭──╯
  0.9 ┤                            ╭──╯     ← σ(2.2) ≈ 0.90
      │                          ╭─╯
      │                        ╭─╯
  0.7 ┤                      ╭─╯            ← σ(0.85) ≈ 0.70
      │                    ╭─╯
      │                  ╭─╯
  0.5 ┤══════════════╦══╯                  ← σ(0)    = 0.50  (决策边界)
      │            ╭─╯
      │          ╭─╯
  0.3 ┤        ╭─╯                          ← σ(-0.85) ≈ 0.30
      │      ╭─╯
      │    ╭─╯
  0.1 ┤  ╭─╯                                ← σ(-2.2) ≈ 0.10
      │╭─╯
  0.0 ┼───┴────┴────┴────┴────┴────┴───→ z = wᵀx
       -4   -3   -2   -1    0    1    2    3    4
       ←──── 预测负类 ────┼──── 预测正类 ────→

  关键性质:
  • σ(0) = 0.5          (决策边界通过原点)
  • σ'(z) = σ(z)(1-σ(z)) (导数形式优美，梯度的值最大在 z=0 处)
  • σ(-∞)→0, σ(+∞)→1   (输出天然是概率)
  • σ(-z) = 1 - σ(z)    (对称性)
```

### 线性决策边界 vs 非线性决策边界

![线性vs非线性决策边界](https://placehold.co/700x350/f59e0b/white?text=Linear+vs+Nonlinear+Boundary)

*图：线性模型（如逻辑回归、线性 SVM）只能产生直线/平面/超平面的决策边界。对于非线性可分的数据，需要通过特征变换（多项式特征、核方法）引入非线性决策边界。*

### L1 vs L2 正则化的几何直觉

![L1 vs L2正则化几何解释](https://placehold.co/700x350/ef4444/white?text=L1+vs+L2+Geometry)

*图：L1 约束区域是菱形（轴对齐），等高线与其相交的最优解容易落在坐标轴上，产生稀疏权重（特征选择）。L2 约束区域是圆形，最优解通常不在坐标轴上，权重被均匀收缩但很少变成零。*

```
        L1 正则化 (Lasso)                    L2 正则化 (Ridge)

         w₂                                   w₂
         ↑                                    ↑
         │    ◉ loss 等高线                    │     ◉ loss 等高线
         │   ╱                                 │    ╱
         │  ╱                                  │   ╱
         │ ╱                                   │  ╱
         │╱    ╱                               │ ╱    ╱
    ─────╋────╱─────→ w₁                   ────╋────╱────→ w₁
        ╱│   ╱                                ╱ │   ╱
       ╱ │  ╱                                ╱  │  ╱
      ╱  │ ╱                                ╱   │ ╱
         │ ◆ 最优解 (在轴上)                    │  ◆ 最优解 (不在轴上)
         │  (菱形约束)                          │   (圆形约束)

  特点: 产生稀疏解, w₁=0 自动特征选择   特点: 权重均匀收缩, 无稀疏性
```

```mermaid
graph TD
    A[线性模型] --> B[线性回归]
    A --> C[逻辑回归]
    A --> D[正则化]
    A --> E[多分类扩展]

    B --> B1[最小二乘法: min Σ ⁡y-ŷ ²]
    B --> B2[正规方程: w* = XᵀX ⁻¹Xᵀy]
    B --> B3[梯度下降求解]
    B --> B4[多项式特征 + 线性回归]

    C --> C1[Sigmoid: P=1/1+e⁻ᶻ]
    C --> C2[交叉熵损失]
    C --> C3[决策边界: wᵀx = 0]
    C --> C4[极大似然估计推导]

    D --> D1[L1 Lasso: 稀疏解]
    D --> D2[L2 Ridge: 权值收缩]
    D --> D3[ElasticNet: L1+L2 折中]
    D --> D4[贝叶斯视角: 先验分布]
    D --> D5[正则化路径: λ 从大到小]

    E --> E1[OvR: 一对多]
    E --> E2[OvO: 一对一]
    E --> E3[Softmax: 多分类逻辑回归]

    D1 --> F[特征选择]
    D2 --> G[共线性处理]
    E3 --> H[深度学习输出层基础]
```

### 正规方程 vs 梯度下降决策指南

```
                    ┌──────────────┐
                    │ 求解线性回归  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ 特征数 d 多大?│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │ d < 10⁴    │ 10⁴ ≤ d ≤10⁵│  d > 10⁵
              ▼            ▼             ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │ 正规方程  │  │ 均可，   │  │ 梯度下降  │
       │ 闭式解   │  │ 视情况定  │  │ 或 SGD   │
       └──────────┘  └──────────┘  └──────────┘
       O(d³) 求逆    折中方案      O(k·n·d) 迭代
       精确解         考虑内存      近似解
       无需调参       和数据量      需调学习率
       小数据首选                   需特征缩放
```
""",
}

async def enrich():
    engine = create_async_engine(os.environ["DATABASE_URL"])
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one()
        for slug in SLUGS:
            r2 = await db.execute(select(MLBookChapter).where(
                MLBookChapter.book_id == book.id, MLBookChapter.slug == slug
            ))
            ch = r2.scalar_one()
            if slug in DIAGRAMS:
                old_len = len(ch.markdown or "")
                ch.markdown = ch.markdown + DIAGRAMS[slug]
                added = len(ch.markdown) - old_len
                print(f"  {slug}: +{added} chars visual content (total: {len(ch.markdown)})")
        await db.commit()
        print(f"Done: {len(SLUGS)} chapters enriched")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(enrich())
