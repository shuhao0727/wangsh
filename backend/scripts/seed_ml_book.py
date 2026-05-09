"""Seed ML book chapters directly via SQLAlchemy.

Run: cd backend && python3 scripts/seed_ml_book.py
"""
import asyncio, json, os, sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")

# ── Chapter data ──────────────────────────────

def j(v): return json.dumps(v, ensure_ascii=False)

CH = []

# Ch1
CH.append(dict(slug="introduction", chapter_number=1, title="绪论：什么是机器学习",
    summary="建立机器学习整体地图，理解定义、三大学习范式、核心任务类型和8阶段项目工作流。",
    difficulty="beginner", estimated_minutes=30,
    markdown="""# 绪论：什么是机器学习

## 学习定位

本章是全书地图。在深入任何算法前先建立大画面：机器学习解决什么问题、怎么解决、如何判断解决得好不好。

## 什么是机器学习

Tom Mitchell (1997) 经典定义：

> 对于某类任务 T 和性能度量 P，如果一个计算机程序在 T 上以 P 衡量的性能随着经验 E 而自我完善，那么称这个程序从经验 E 中学习。

### 一个具体例子

预测学生是否需要课外辅导：

| 要素 | 符号 | 示例 |
|------|------|------|
| 任务 T | — | 预测需要/不需要辅导 (二分类) |
| 经验 E | — | 500名学生的作业成绩、出勤率、练习完成率 |
| 性能 P | — | 预测准确率 |

### 传统编程 vs 机器学习

- **传统编程**: 人写规则 → `if attendance < 60 and score < 40: need_help = True`
- **机器学习**: 人提供数据+标签 → 计算机自己归纳规则

## 机器学习三大范式

### 监督学习

训练数据有**标签**，学习从输入到标签的映射。

| 子类型 | 标签类型 | 示例 |
|--------|----------|------|
| 分类 | 离散类别 | 垃圾邮件检测 |
| 回归 | 连续数值 | 房价预测 |
| 排序 | 有序列表 | 搜索结果排名 |

### 无监督学习

数据**无标签**，发现数据内在结构。

| 子类型 | 目标 | 示例 |
|--------|------|------|
| 聚类 | 相似样本分组 | 客户分群 |
| 降维 | 压缩维度保留信息 | 基因数据可视化 |
| 关联规则 | 发现频繁模式 | 购物篮分析 |

### 强化学习

智能体通过与环境交互、接收奖励/惩罚来学习最优策略。

## ML项目8阶段工作流

1. **问题定义** — ML是正确的工具吗？成功的标准是什么？
2. **数据收集** — 数据从哪来？够多吗？质量如何？
3. **探索分析(EDA)** — 数据长什么样？有缺失值/异常值吗？
4. **数据预处理** — 清洗、标准化、编码、划分训练/验证/测试集
5. **特征工程** — 创造更好的特征，筛选有用的特征
6. **模型训练** — 先用简单基线，再尝试复杂模型
7. **评估调优** — 交叉验证、超参数搜索、错误案例分析
8. **部署监控** — 上线、日志、漂移检测、A/B测试

### 动手体验

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target, test_size=0.2, random_state=42
)
model = LogisticRegression(max_iter=200).fit(X_train, y_train)
print(classification_report(y_test, model.predict(X_test)))
```

## 关键术语

| 术语 | 定义 |
|------|------|
| 特征 | 描述样本属性的变量，如出勤率、作业成绩 |
| 标签 | 监督学习中希望预测的目标值 |
| 模型 | 从数据中学习到的输入到输出的映射函数 |
| 训练 | 使用数据调整模型参数的过程 |
| 泛化 | 模型在未见过的数据上保持表现的能力 |
| 过拟合 | 模型死记硬背训练数据，在新数据上表现差 |

## 延伸参考

- 《机器学习》(西瓜书) 第1章 — 中文ML最佳入门
- Andrew Ng Machine Learning Specialization (Coursera) — 零基础友好
- scikit-learn Getting Started — 代码实践最快入门""",
    goals=["解释机器学习核心定义和三大范式", "区分分类、回归、聚类等任务类型", "说出ML项目的8个阶段"],
    checklist=["能用白话解释什么是机器学习", "能举出监督/无监督学习真实场景各2个", "能画出ML项目工作流图"],
    experiments=[{"title":"第一个分类器","goal":"用 scikit-learn 体验分类和聚类的差异","steps":["加载 iris 数据集","训练 LogisticRegression","训练 KMeans","对比输出差异"],"output":"分类vs聚类对比 Notebook","difficulty":"beginner"}],
    glossary=[{"term":"特征","definition":"描述样本属性的变量"},{"term":"标签","definition":"监督学习中预测的目标值"},{"term":"泛化","definition":"模型在新数据上保持表现的能力"},{"term":"过拟合","definition":"模型死记硬背训练数据而泛化变差"}],
    references=[{"title":"《机器学习》第1章","source":"周志华","note":"中文ML最佳入门","url":"https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"},{"title":"scikit-learn Getting Started","source":"scikit-learn.org","note":"代码入门","url":"https://scikit-learn.org/stable/getting_started.html"}],
    prerequisites=[], keywords=["机器学习","ML","监督学习","无监督学习","强化学习","泛化","过拟合"],
    quiz=[{"question":"监督学习的核心特征是什么？","options":["从未标注数据发现结构","从已标注数据学习输入到输出的映射","通过试错学习","压缩数据维度"],"correctIndex":1,"explanation":"监督学习关键是有标签数据，模型学习 f: X->Y 的映射。"}],
    sort_order=1, enabled=True))

# Ch2
CH.append(dict(slug="math-foundations", chapter_number=2, title="数学基础：线性代数、概率与优化",
    summary="用工程直觉理解向量、矩阵、概率分布、损失函数和梯度下降。每学一个数学概念立即联系ML场景。",
    difficulty="beginner", estimated_minutes=45,
    markdown="""# 数学基础：线性代数、概率与优化

## 学习定位

数学不是学完再用的前置课，而是理解ML算法行为的语言。本章目标是让你能**看懂**论文公式、**调试**训练异常、**解释**模型为什么这样设计。

## 线性代数：ML的通用语言

### 标量、向量、矩阵

| 数学对象 | Python表示 | ML含义 | 示例 |
|----------|-----------|---------|------|
| 标量 $x$ | `float` | 单个数值 | 学习率=0.01 |
| 向量 $\\mathbf{x}$ | `np.array([...])` | 一个样本的特征 | [出勤率, 作业均分, 练习完成率] |
| 矩阵 $\\mathbf{X}$ | `np.array([[...]])` | 一批样本 | 500学生 x 3特征 = (500,3) |

### 矩阵乘法：ML核心运算

$$\\mathbf{y} = \\mathbf{X}\\mathbf{W} + \\mathbf{b}$$

神经网络的一层、线性回归的预测，本质上都是矩阵乘法。

```python
# (batch, features) @ (features, outputs) + (outputs,)
output = X @ W + b  # (32, 10) = (32, 784) @ (784, 10) + (10,)
```

**形状追踪**是最有效的调试习惯：在代码注释中标注每个张量的形状。

## 概率论：处理不确定性

### 核心概念速查

| 概念 | 符号 | ML场景 |
|------|------|--------|
| 随机变量 | $X$ | 学生是否及格 |
| 条件概率 | $P(Y|X)$ | 给出勤率80%，及格概率？ |
| 贝叶斯定理 | $P(Y|X) \\propto P(X|Y)P(Y)$ | 朴素贝叶斯理论基础 |
| 期望 | $\\mathbb{E}[X]$ | 预测平均值 |
| 方差 | $\\mathrm{Var}(X)$ | 预测波动程度 |

### 最大似然估计 (MLE)

几乎所有ML训练都可理解为MLE：找到参数使观察到当前数据的概率最大。

对于回归，假设误差服从正态分布，MLE等价于**最小化MSE**：

$$L = \\frac{1}{n}\\sum_{i=1}^n (y_i - \\hat{y}_i)^2$$

## 最优化：如何找到最好的参数

### 损失函数一览

| 损失函数 | 公式 | 适用场景 |
|----------|------|----------|
| MSE | $\\frac{1}{n}\\sum(y_i-\\hat{y}_i)^2$ | 回归 |
| 交叉熵 | $-\\sum y_i\\log\\hat{y}_i$ | 分类 |
| Hinge | $\\max(0,1-y_i\\hat{y}_i)$ | SVM |

### 梯度下降

$$\\theta_{t+1} = \\theta_t - \\eta \\nabla_\\theta L(\\theta_t)$$

- $\\eta$：学习率，最重要的超参数
- $\\nabla_\\theta L$：损失对参数的梯度，指向最陡上升方向

```python
# NumPy实现梯度下降
def gradient_descent(X, y, lr=0.01, epochs=100):
    w = np.zeros(X.shape[1])
    for _ in range(epochs):
        grad = (2/len(y)) * X.T @ (X @ w - y)
        w -= lr * grad
    return w
```

### 学习率的影响

| 学习率 | 效果 |
|--------|------|
| 太小 ($10^{-6}$) | 收敛极慢 |
| 适中 ($10^{-3}$~$10^{-1}$) | 稳定收敛 |
| 太大 ($1.0$) | 震荡或发散 |

## 延伸参考

- 3Blue1Brown 线性代数本质 — 用几何直观理解线性代数
- 《深度学习》(花书) 第2-4章 — 数学基础系统论述
- d2l.ai 预备知识 — 交互式Jupyter数学基础""",
    goals=["用形状追踪分析任意ML运算的矩阵尺寸", "解释MLE和MSE的等价关系", "手写梯度下降的一次更新"],
    checklist=["能用NumPy写出矩阵乘法和梯度下降代码", "能解释为什么不直接用解析解而用梯度下降", "能诊断学习率过大/过小的问题"],
    experiments=[{"title":"梯度下降可视化","goal":"画出梯度下降参数更新轨迹","steps":["定义二次损失 L(w)=(w-3)^2","实现梯度下降循环","记录每一步w值","画w随迭代变化曲线"],"output":"梯度下降轨迹图","difficulty":"beginner"}],
    glossary=[{"term":"向量","definition":"一组有序的数，表示一个样本的特征值"},{"term":"矩阵乘法","definition":"ML核心运算 y=XW"},{"term":"贝叶斯定理","definition":"P(Y|X) = P(X|Y)P(Y)/P(X)"},{"term":"梯度","definition":"损失函数在各参数上的变化率"}],
    references=[{"title":"3Blue1Brown 线性代数","source":"YouTube","note":"几何直观理解","url":"https://www.3blue1brown.com/topics/linear-algebra"},{"title":"《深度学习》第2-4章","source":"Goodfellow","note":"数学基础","url":"https://www.deeplearningbook.org/"}],
    prerequisites=["introduction"], keywords=["线性代数","概率论","梯度下降","MLE","损失函数","学习率"],
    quiz=[{"question":"X.shape=(32,784), W.shape=(784,10), X@W.shape=?","options":["(784,784)","(32,10)","(10,32)","(784,10)"],"correctIndex":1,"explanation":"(m*n)@(n*p)=(m,p): 32x784 @ 784x10 = 32x10"}],
    sort_order=2, enabled=True))

# Ch3
CH.append(dict(slug="model-evaluation", chapter_number=3, title="模型评估与选择",
    summary="过拟合/欠拟合诊断、评估方法（留出法/交叉验证/自助法）、性能度量（准确率/精确率/召回率/F1/AUC）和模型选择。",
    difficulty="beginner", estimated_minutes=40,
    markdown="""# 模型评估与选择

## 过拟合与欠拟合

| 现象 | 训练集 | 测试集 | 原因 | 解法 |
|------|--------|--------|------|------|
| 欠拟合 | 差 | 差 | 模型太简单 | 加特征、换复杂模型 |
| 过拟合 | 极好 | 差 | 模型记住了噪声 | 加数据、正则化、Dropout |
| 理想 | 好 | 好 | 学到了规律 | — |

### 偏差-方差分解

$$\\mathbb{E}[(y-\\hat{f}(x))^2] = \\text{Bias}^2 + \\text{Var} + \\sigma^2$$

| 分量 | 含义 | 高时的表现 |
|------|------|-----------|
| Bias^2 | 预测均值与真实值的差距 | 欠拟合 |
| Var | 对训练数据微小变化的敏感度 | 过拟合 |
| sigma^2 | 问题本身的不可约误差 | 数据天花板 |

## 评估方法

### 留出法 (Hold-out)

```python
from sklearn.model_selection import train_test_split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
```

### 交叉验证

| 类型 | 说明 | 适用 |
|------|------|------|
| k折 | 分k等份，轮替验证 | 通用k=5或10 |
| 留一法 | k=n，每次留1个 | 小数据集 |
| 分层k折 | 保持类别比例 | 分类不平衡 |

```python
from sklearn.model_selection import cross_val_score
scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')
print(f"{scores.mean():.3f} +- {scores.std():.3f}")
```

## 性能度量

### 混淆矩阵

| 真实/预测 | 预测正 | 预测负 |
|-----------|--------|--------|
| 真实正 | TP | FN |
| 真实负 | FP | TN |

| 指标 | 公式 | 关注场景 |
|------|------|----------|
| 准确率 | (TP+TN)/Total | 类别均衡 |
| 精确率 | TP/(TP+FP) | 宁可漏报不能误报 |
| 召回率 | TP/(TP+FN) | 宁可误报不能漏报 |
| F1 | 2PR/(P+R) | 两者都重要 |

### AUC

AUC是ROC曲线下面积：AUC=1.0完美，AUC=0.5随机，AUC<0.5比随机还差。

### 回归度量

| 指标 | 公式 | 特点 |
|------|------|------|
| MAE | $\\frac{1}{n}\\sum|y_i-\\hat{y}_i|$ | 对异常值不敏感 |
| MSE | $\\frac{1}{n}\\sum(y_i-\\hat{y}_i)^2$ | 对大误差惩罚更重 |
| R^2 | $1-\\frac{SS_{res}}{SS_{tot}}$ | 越接近1越好 |

## 模型选择

```python
from sklearn.model_selection import GridSearchCV
param_grid = {'max_depth': [3,5,7], 'min_samples_split': [2,5,10]}
grid = GridSearchCV(DecisionTreeClassifier(), param_grid, cv=5)
grid.fit(X_train, y_train)
print(grid.best_params_, grid.best_score_)
```

## 延伸参考

- 《机器学习》(西瓜书) 第2章 — 模型评估与选择系统论述
- scikit-learn Model Evaluation — 官方评估指标文档""",
    goals=["诊断过拟合和欠拟合", "选择合适的评估指标", "使用交叉验证和网格搜索"], 
    checklist=["能画混淆矩阵并计算P/R/F1", "能解释分类不平衡时准确率不可靠的原因", "能用GridSearchCV做超参数调优"],
    experiments=[{"title":"模型选择实战","goal":"在Titanic数据集上比较模型并调优","steps":["加载Titanic数据","划分训练/测试集","比较3个模型","GridSearchCV调优","输出分类报告"],"output":"模型对比报告","difficulty":"intermediate"}],
    glossary=[{"term":"过拟合","definition":"模型死记硬背训练数据，新数据表现差"},{"term":"交叉验证","definition":"将数据分成k份轮替验证"},{"term":"F1","definition":"精确率和召回率的调和平均"}],
    references=[{"title":"西瓜书第2章","source":"周志华","url":"https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"}],
    prerequisites=["introduction","math-foundations"], keywords=["过拟合","偏差","方差","交叉验证","混淆矩阵","AUC","F1"],
    quiz=[{"question":"训练准确率99%验证准确率70%是什么现象？","options":["欠拟合","过拟合","数据泄露","正常泛化"],"correctIndex":1,"explanation":"训练和验证差距大是典型过拟合。"}],
    sort_order=3, enabled=True))

print(f"Built {len(CH)} chapters")

# ── Seed function ───────────────────────────────

async def seed():
    engine = create_async_engine(db_url)
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one_or_none()
        if not book:
            print("ERROR: Book not found. Run INSERT first.")
            return
        book_id = book.id

        for ch in CH:
            r2 = await db.execute(select(MLBookChapter).where(
                MLBookChapter.book_id == book_id,
                MLBookChapter.slug == ch["slug"]
            ))
            existing = r2.scalar_one_or_none()
            payload = {k:v for k,v in ch.items() if k != "slug"}
            for jf in ("goals","checklist","experiments","glossary","references","prerequisites","keywords","quiz"):
                if jf in payload:
                    payload[jf] = j(payload[jf])
            if existing:
                for k,v in payload.items():
                    setattr(existing, k, v)
            else:
                db.add(MLBookChapter(book_id=book_id, slug=ch["slug"], **payload))

        await db.commit()
        print(f"OK: {len(CH)} chapters seeded (upserted)")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
