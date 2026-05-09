import asyncio, os, sys
sys.path.insert(0, ".")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

SLUGS = ["introduction", "math-foundations", "model-evaluation", "linear-models"]

ENRICHED = {
    "introduction": """# 绪论：什么是机器学习

## 学习定位

本章是全书地图。在深入任何算法前先建立大画面：机器学习解决什么问题、怎么解决、如何判断解决得好不好。

## 什么是机器学习

Tom Mitchell (1997) 经典定义：

> 对于某类任务 T 和性能度量 P，如果一个计算机程序在 T 上以 P 衡量的性能随着经验 E 而自我完善，那么称这个程序从经验 E 中学习。

形式化表述为：

$$\\text{Learn}(D, \\mathcal{H}, \\mathcal{L}) = \\arg\\min_{h \\in \\mathcal{H}} \\; \\mathcal{L}(h, D)$$

其中 $\\mathcal{H}$ 是假设空间、$\\mathcal{L}$ 是损失函数、$D$ 是训练数据。

### 一个具体例子

预测学生是否需要课外辅导：

| 要素 | 符号 | 示例 |
|------|------|------|
| 任务 T | — | 预测需要/不需要辅导 (二分类) |
| 经验 E | — | 500名学生的作业成绩、出勤率、练习完成率 |
| 性能 P | — | 预测准确率 |

### 传统编程 vs 机器学习

机器学习与传统编程的本质区别在于"知识从何而来"：

| 维度 | 传统编程 | 机器学习 |
|------|---------|---------|
| 知识来源 | 人工编写规则 | 从数据中自动学习 |
| 输入 | 数据 + 规则 | 数据 + 标签 |
| 输出 | 计算结果 | 模型（规则） |
| 规则数量 | 少量显式规则 | 百万级隐式参数 |
| 适应性 | 固定，规则变更需重写代码 | 自适应，新数据可微调模型 |
| 典型场景 | 税务计算、工资系统 | 图像识别、自然语言、推荐 |
| 代码量 | 规则驱动，与业务复杂度成正比 | 数据驱动，代码量相对稳定 |
| 调试方式 | 单步调试规则逻辑 | 分析损失曲线、特征重要性、混淆矩阵 |

从数学角度看，传统编程是直接实现函数 $f: X \\to Y$，而机器学习是从假设空间 $\\mathcal{H}$ 中搜索最优近似 $\\hat{f} \\approx f$：

$$\\hat{f} = \\arg\\min_{h \\in \\mathcal{H}} \\frac{1}{n}\\sum_{i=1}^{n} L(y_i, h(x_i)) + \\lambda R(h)$$

### ML 基础流程代码示例

```python
# 完整的 ML 流程示例：预测学生是否需要辅导
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

# 1. 模拟数据：500 学生的 3 个特征
np.random.seed(42)
X = np.random.randn(500, 3)  # [出勤率归一化, 作业均分归一化, 练习完成率归一化]
y = (X[:, 0] * 0.6 + X[:, 1] * 0.3 + X[:, 2] * 0.1 > 0).astype(int)

# 2. 划分训练集/测试集
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
print(f"训练集: {X_train.shape}, 测试集: {X_test.shape}")

# 3. 训练模型
model = RandomForestClassifier(n_estimators=50, random_state=42)
model.fit(X_train, y_train)

# 4. 预测与评估
y_pred = model.predict(X_test)
print(f"准确率: {accuracy_score(y_test, y_pred):.3f}")
print(classification_report(y_test, y_pred, target_names=['不需要', '需要']))

# 5. 查看特征重要性
for i, imp in enumerate(model.feature_importances_):
    print(f"  特征 {i} 重要性: {imp:.3f}")
```

## 机器学习三大范式

### 监督学习

训练数据有标签。数学形式：给定训练集 $D = \\{(x_1, y_1), (x_2, y_2), \\dots, (x_n, y_n)\\}$，学习一个映射 $f: X \\to Y$。

| 任务类型 | 输出 Y | 算法示例 | 应用 |
|---------|--------|---------|------|
| 分类 | 离散类别 | 逻辑回归、SVM、随机森林 | 垃圾邮件检测、医学诊断 |
| 回归 | 连续值 | 线性回归、GBDT、神经网络 | 房价预测、股票趋势 |

### 无监督学习

只有输入数据，没有标签。目标是发现数据的内在结构：$D = \\{x_1, x_2, \\dots, x_n\\}$。

| 任务类型 | 目标 | 算法示例 | 应用 |
|---------|------|---------|------|
| 聚类 | 将相似数据归为一组 | K-means、DBSCAN | 客户分群、图像分割 |
| 降维 | 减少特征维度保留结构 | PCA、t-SNE | 可视化、特征压缩 |
| 密度估计 | 估计数据分布 $P(x)$ | GMM、核密度估计 | 异常检测 |

### 强化学习

智能体通过与环境交互、接收奖励信号来学习策略 $\\pi(a|s)$。

马尔可夫决策过程核心公式（Bellman 方程）：

$$Q^\\pi(s, a) = \\mathbb{E}\\left[r + \\gamma \\max_{a'} Q^\\pi(s', a') \\mid s, a\\right]$$

其中 $\\gamma \\in [0,1]$ 是折扣因子，平衡即时奖励与长期回报。

### 半监督学习

结合少量标注数据和大量未标注数据。核心思想：利用未标注数据改善决策边界。

## 归纳偏好与"没有免费午餐"定理

### 奥卡姆剃刀

若无必要，勿增实体——在多个假设都能解释数据时，选择最简单的。

### 没有免费午餐定理 (NFL)

**NFL 定理**：在所有可能的问题上，所有学习算法的平均性能是相同的。形式化表述为：

$$\\sum_{f} E_{ote}(\\mathcal{L}_a | X, f) = \\sum_{f} E_{ote}(\\mathcal{L}_b | X, f)$$

**推论**：脱离具体问题谈算法优劣没有意义。一个好算法必须匹配具体问题的特性（归纳偏好）。

## 机器学习的发展简史

| 时期 | 里程碑 | 意义 |
|------|-------|------|
| 1950s | Turing 提出"学习机器"概念 | 思想萌芽 |
| 1959 | Samuel 编写跳棋学习程序 | 首次实践"机器学习" |
| 1980s | 决策树、BP 算法 | 连接主义与符号主义并进 |
| 1995 | Vapnik 提出 SVM | 统计学习理论成熟 |
| 2006 | Hinton 提出深度信念网络 | 深度学习复兴 |
| 2012 | AlexNet 赢得 ImageNet | 深度学习爆发 |
| 2017 | Transformer 架构提出 | 大模型时代开启 |

## 参考资源

- 周志华《机器学习》(西瓜书): https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm
- scikit-learn 用户指南: https://scikit-learn.org/stable/user_guide.html
- Andrew Ng Coursera 专项课程: https://www.coursera.org/specializations/machine-learning-introduction
- Deep Learning Book: https://www.deeplearningbook.org/
- d2l.ai (动手学深度学习): https://d2l.ai/
- PyTorch 教程: https://pytorch.org/tutorials/
""",

    "math-foundations": """# 数学基础：线性代数、概率与优化

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
import numpy as np
# 模拟：10 个样本，3 个特征，输出 2 个值
X = np.random.randn(10, 3)   # (10, 3)
W = np.random.randn(3, 2)    # (3, 2)
b = np.random.randn(2)       # (2,)
y = X @ W + b                # (10, 2)
print(f"输入: {X.shape}, 权重: {W.shape}, 输出: {y.shape}")
# 输出: 输入: (10, 3), 权重: (3, 2), 输出: (10, 2)
```

### 常用矩阵运算速查

| 运算 | 公式 | NumPy | 用途 |
|------|------|-------|------|
| 转置 | $\\mathbf{A}^\\top$ | `A.T` | 维度对齐 |
| 逆 | $\\mathbf{A}^{-1}$ | `np.linalg.inv(A)` | 正规方程 |
| 迹 | $\\text{tr}(\\mathbf{A})$ | `np.trace(A)` | 矩阵导数 |
| Frobenius 范数 | $\\|\\mathbf{A}\\|_F$ | `np.linalg.norm(A, 'fro')` | 正则化 |
| 特征分解 | $\\mathbf{A} = \\mathbf{Q}\\mathbf{\\Lambda}\\mathbf{Q}^{-1}$ | `np.linalg.eig(A)` | PCA |
| SVD | $\\mathbf{A} = \\mathbf{U}\\mathbf{\\Sigma}\\mathbf{V}^\\top$ | `np.linalg.svd(A)` | 降维、推荐系统 |

## 概率论：不确定性建模

### 核心概念速查

| 概念 | 符号 | 公式 | 示例 |
|------|------|------|------|
| 联合概率 | $P(A, B)$ | $P(A)P(B \\mid A)$ | 下雨且迟到 |
| 条件概率 | $P(A \\mid B)$ | $\\frac{P(A,B)}{P(B)}$ | 迟到时下雨的概率 |
| 边缘概率 | $P(A)$ | $\\sum_B P(A, B)$ | 下雨概率 |
| 贝叶斯定理 | $P(A \\mid B)$ | $\\frac{P(B \\mid A)P(A)}{P(B)}$ | 垃圾邮件分类的基础 |
| 独立性 | $A \\perp B$ | $P(A,B) = P(A)P(B)$ | Naive Bayes 假设 |

### 贝叶斯定理在ML中的应用

朴素贝叶斯分类器利用条件独立性假设：

$$P(y \\mid x_1, \\dots, x_n) \\propto P(y) \\prod_{i=1}^n P(x_i \\mid y)$$

训练时只需统计每类下各特征的条件概率；推断时对数空间计算避免下溢：

$$\\log P(y \\mid x) \\propto \\log P(y) + \\sum_{i=1}^n \\log P(x_i \\mid y)$$

### 常见概率分布

| 分布 | 公式 | 参数 | ML中用途 |
|------|------|------|---------|
| Gaussian | $\\mathcal{N}(x \\mid \\mu, \\sigma^2) = \\frac{1}{\\sqrt{2\\pi}\\sigma}e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}$ | $\\mu, \\sigma^2$ | 噪声假设、VAE 先验 |
| Bernoulli | $P(x) = p^x(1-p)^{1-x}$ | $p$ | 二分类标签分布 |
| Categorical | $P(x=i) = p_i$ | $\\mathbf{p}$ | 多分类 softmax 输出 |
| 多项分布 | $P(\\mathbf{x}) = \\frac{n!}{\\prod x_i!}\\prod p_i^{x_i}$ | $n, \\mathbf{p}$ | NLP 词频建模 |
| Beta | $f(x;\\alpha,\\beta) \\propto x^{\\alpha-1}(1-x)^{\\beta-1}$ | $\\alpha, \\beta$ | Thompson 采样、A/B 测试 |

## 优化：让模型"学好"的引擎

### 损失函数全景

| 损失函数 | 公式 | 适用任务 | 特点 |
|---------|------|---------|------|
| MSE | $\\frac{1}{n}\\sum (y_i - \\hat{y}_i)^2$ | 回归 | 对大误差惩罚重 (L2 loss) |
| MAE | $\\frac{1}{n}\\sum |y_i - \\hat{y}_i|$ | 回归 | 对异常值更鲁棒 (L1 loss) |
| Huber | 分段：中心 L2，边缘 L1 | 回归 | 兼具 MSE/MAE 优点 |
| Cross-Entropy | $-\\sum y_i \\log \\hat{y}_i$ | 分类 | 与 softmax 配合梯度漂亮 |
| Hinge | $\\max(0, 1 - y_i \\hat{y}_i)$ | SVM 分类 | 追求最大间隔 |
| KL 散度 | $\\sum P(x) \\log\\frac{P(x)}{Q(x)}$ | 分布拟合 | VAE、知识蒸馏 |

### 梯度下降：ML的"学习"如何发生

梯度指向函数增长最快的方向，因此沿**负梯度**方向更新参数可以让损失下降：

$$\\theta_{t+1} = \\theta_t - \\eta \\nabla_\\theta J(\\theta_t)$$

其中 $\\eta$ 为学习率，$\\nabla_\\theta J(\\theta_t)$ 是损失函数对参数的梯度。

**用 NumPy 计算梯度示例：**

```python
import numpy as np

def loss(w, X, y):
    \"\"\"MSE 损失\"\"\"
    return np.mean((y - X @ w) ** 2)

def gradient(w, X, y):
    \"\"\"MSE 对 w 的梯度 = -(2/n) X^T (y - Xw)\"\"\"
    n = len(y)
    return -(2 / n) * X.T @ (y - X @ w)

# 模拟数据
np.random.seed(42)
X = np.random.randn(100, 3)
w_true = np.array([1.5, -2.0, 0.5])
y = X @ w_true + np.random.randn(100) * 0.1

# 梯度下降
w = np.zeros(3)
lr = 0.01
for epoch in range(1000):
    grad = gradient(w, X, y)
    w -= lr * grad
    if epoch % 200 == 0:
        print(f"Epoch {epoch:4d}: loss={loss(w, X, y):.6f}, w={w}")

print(f"\\n真实权重: {w_true}")
print(f"学得权重: {w.round(4)}")
```

### 梯度下降变体对比

| 变体 | 更新规则 | 每次使用 | 优点 | 缺点 |
|------|---------|---------|------|------|
| BGD (批量) | $\\theta \\leftarrow \\theta - \\eta \\nabla_\\theta J(\\theta)$ | 全量数据 | 稳定收敛 | 大数据集慢 |
| SGD (随机) | $\\theta \\leftarrow \\theta - \\eta \\nabla_\\theta J(\\theta; x_i, y_i)$ | 单个样本 | 快，可逃离局部最优 | 震荡大 |
| Mini-batch | $\\theta \\leftarrow \\theta - \\eta \\frac{1}{m}\\sum_{i=1}^{m} \\nabla_\\theta J(\\theta; x_i, y_i)$ | m 个样本 | BGD 和 SGD 的折中 | 需调 batch size |
| Momentum | $v_t = \\beta v_{t-1} + \\eta \\nabla_\\theta J; \\; \\theta \\leftarrow \\theta - v_t$ | — | 加速收敛，减轻震荡 | 多了超参 $\\beta$ |
| NAG | $v_t = \\beta v_{t-1} + \\eta \\nabla_\\theta J(\\theta - \\beta v_{t-1})$ | — | 前瞻性更新 | 实现稍复杂 |
| Adam | $m_t = \\beta_1 m_{t-1} + (1-\\beta_1)g_t; \\; v_t = \\beta_2 v_{t-1} + (1-\\beta_2)g_t^2$ | — | 自适应学习率，最通用 | 可能不收敛 |

Adam 的完整更新公式（含偏差修正）：

$$\\hat{m}_t = \\frac{m_t}{1-\\beta_1^t}, \\quad \\hat{v}_t = \\frac{v_t}{1-\\beta_2^t}, \\quad \\theta_{t+1} = \\theta_t - \\frac{\\eta}{\\sqrt{\\hat{v}_t} + \\epsilon} \\hat{m}_t$$

其中 $\\beta_1=0.9, \\beta_2=0.999, \\epsilon=10^{-8}$ 为常用默认值。

## 链式法则与反向传播

神经网络的梯度计算依赖于**链式法则**。对于复合函数 $z = f(g(x))$：

$$\\frac{dz}{dx} = \\frac{dz}{dg} \\cdot \\frac{dg}{dx}$$

在多层网络中，损失 $L$ 对第 $l$ 层权重 $W^{(l)}$ 的梯度为：

$$\\frac{\\partial L}{\\partial W^{(l)}} = \\frac{\\partial L}{\\partial a^{(L)}} \\cdot \\frac{\\partial a^{(L)}}{\\partial z^{(L)}} \\cdot \\frac{\\partial z^{(L)}}{\\partial a^{(L-1)}} \\cdots \\frac{\\partial z^{(l+1)}}{\\partial a^{(l)}} \\cdot \\frac{\\partial a^{(l)}}{\\partial z^{(l)}} \\cdot \\frac{\\partial z^{(l)}}{\\partial W^{(l)}}$$

实际计算中，从输出层向输入层逐层传播误差信号 $\\delta^{(l)}$：

$$\\delta^{(l)} = (W^{(l+1)})^\\top \\delta^{(l+1)} \\odot \\sigma'(z^{(l)})$$

```python
def relu_derivative(z):
    return (z > 0).astype(float)

def backward_pass(X, W_list, activations, y_true):
    \"\"\"简化的反向传播：计算每层梯度\"\"\"
    grads = {}
    m = len(y_true)
    # 输出层误差 (MSE)
    delta = 2 * (activations[-1] - y_true) / m
    for l in reversed(range(len(W_list))):
        grads[f'W{l}'] = activations[l].T @ delta
        if l > 0:
            delta = (delta @ W_list[l].T) * relu_derivative(activations[l])
    return grads
```

## 参考资源

- 周志华《机器学习》(西瓜书): https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm
- scikit-learn 用户指南: https://scikit-learn.org/stable/user_guide.html
- Deep Learning Book: https://www.deeplearningbook.org/
- d2l.ai (动手学深度学习): https://d2l.ai/
- Andrew Ng Coursera 专项课程: https://www.coursera.org/specializations/machine-learning-introduction
- PyTorch 教程: https://pytorch.org/tutorials/
""",

    "model-evaluation": """# 模型评估与选择

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
    X, y, test_size=0.2, random_state=42, stratify=y  # 分层抽样保分布
)
```

### 交叉验证 (Cross Validation)

**K 折交叉验证**：将数据分成 K 份，轮流用 K-1 份训练、1 份验证，取 K 次平均。

$$\\text{CV score} = \\frac{1}{K}\\sum_{k=1}^{K} \\text{score}(\\text{model}_k, D_k^{\\text{val}})$$

```python
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import make_scorer, f1_score, accuracy_score

model = RandomForestClassifier(n_estimators=100, random_state=42)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

# 单一指标
acc_scores = cross_val_score(model, X, y, cv=cv, scoring='accuracy')
print(f"Accuracy: {acc_scores.mean():.3f} ± {acc_scores.std():.3f}")

# 多指标评估
from sklearn.model_selection import cross_validate
metrics = ['accuracy', 'precision_macro', 'recall_macro', 'f1_macro']
cv_results = cross_validate(model, X, y, cv=cv, scoring=metrics)
for m in metrics:
    scores = cv_results[f'test_{m}']
    print(f"{m}: {scores.mean():.3f} ± {scores.std():.3f}")
```

### 自助法 (Bootstrap)

从 n 个样本中有放回地随机抽 n 次（约 36.8% 的样本未被抽中，可作为验证集）：

$$P(\\text{某样本未被抽中}) = \\left(1 - \\frac{1}{n}\\right)^n \\approx e^{-1} \\approx 0.368$$

## 分类评估指标详解

### 混淆矩阵

|  | 预测正类 | 预测负类 |
|------|---------|---------|
| 真实正类 | TP | FN |
| 真实负类 | FP | TN |

### 核心指标公式

$$\\text{Accuracy} = \\frac{TP+TN}{TP+TN+FP+FN}$$

$$\\text{Precision} = \\frac{TP}{TP+FP}$$

$$\\text{Recall} = \\frac{TP}{TP+FN}$$

$$F_1 = \\frac{2 \\cdot \\text{Precision} \\cdot \\text{Recall}}{\\text{Precision} + \\text{Recall}}$$

$F_\\beta$ 的一般形式（调整 Precision 和 Recall 的权重）：

$$F_\\beta = (1+\\beta^2) \\cdot \\frac{\\text{Precision} \\cdot \\text{Recall}}{\\beta^2 \\cdot \\text{Precision} + \\text{Recall}}$$

$\\beta > 1$ 时 Recall 权重更大，$\\beta < 1$ 时 Precision 权重更大。

### Precision-Recall 权衡

分类器输出通常是一个概率分数，调整阈值可以改变 Precision 和 Recall 的平衡：

| 阈值 | Precision | Recall | 适用场景 |
|------|-----------|--------|---------|
| 高 (如 0.9) | 高 | 低 | 垃圾邮件检测（宁可漏过也不误删） |
| 中 (如 0.5) | 中 | 中 | 通用分类 |
| 低 (如 0.1) | 低 | 高 | 疾病筛查（宁可多检也不漏诊） |

PR 曲线下的面积（Average Precision）是精确率-召回率综合指标：

$$AP = \\sum_{n} (R_n - R_{n-1}) P_n$$

```python
from sklearn.metrics import precision_recall_curve, average_precision_score

# 获取预测概率（非类别）
y_scores = model.predict_proba(X_test)[:, 1]
precisions, recalls, thresholds = precision_recall_curve(y_test, y_scores)
ap = average_precision_score(y_test, y_scores)
print(f"Average Precision: {ap:.3f}")

# 找到满足最低召回率的最大精确率
min_recall = 0.90
idx = np.where(recalls >= min_recall)[0][0]
print(f"Recall≥{min_recall} 时 Precision={precisions[idx]:.3f} "
      f"(阈值={thresholds[idx-1]:.3f})")
```

### ROC 曲线与 AUC

**ROC 曲线**：以 FPR（假阳率）为横轴，TPR（真阳率/Recall）为纵轴。

$$TPR = \\frac{TP}{TP+FN}, \\quad FPR = \\frac{FP}{FP+TN}$$

**AUC (Area Under Curve)** 的统计学含义：随机抽取一个正样本和一个负样本，正样本得分高于负样本的概率。

$$AUC = P(\\text{score}(x_+) > \\text{score}(x_-))$$

**AUC 值解读指南：**

| AUC 范围 | 模型质量 | 说明 |
|---------|---------|------|
| 0.90 - 1.00 | 优秀 | 可用于高风险决策（医疗、金融） |
| 0.80 - 0.90 | 良好 | 大多数生产系统的目标范围 |
| 0.70 - 0.80 | 一般 | 可能需特征工程或更多数据 |
| 0.60 - 0.70 | 较差 | 勉强优于随机猜测 |
| 0.50 - 0.60 | 无效 | 几乎等于随机猜测 |
| < 0.50 | 异常 | 模型方向反了（或标签颠倒） |

```python
from sklearn.metrics import roc_auc_score, roc_curve

auc = roc_auc_score(y_test, y_scores)
fpr, tpr, _ = roc_curve(y_test, y_scores)
print(f"AUC: {auc:.4f}")
print(f"KS 值: {max(tpr - fpr):.4f}")  # KS = max(TPR - FPR)
```

### 如何选择分类指标：业务场景对照

| 业务场景 | 主指标 | 原因 | 次指标 |
|---------|--------|------|--------|
| 搜索引擎/推荐排序 | Precision@K | 用户只看前几条结果 | NDCG, MAP |
| 医学癌症筛查 | Recall | 漏诊代价远大于误诊 | Specificity |
| 垃圾邮件过滤 | Precision | 误删正常邮件比漏过垃圾更严重 | Recall |
| 欺诈检测 | Recall | 漏掉欺诈损失远大于误报核查成本 | Precision, AUC |
| 信息检索 | F1 / F2 | 需要平衡查全率和查准率 | AP |
| 广告点击率预估 | AUC + Log Loss | 需要好的排序能力和概率校准 | Precision@K |
| 类别不均衡分类 | AUC / F1-macro | Accuracy 会误导 | Precision-Recall AUC |
| A/B 测试效果评估 | 实际业务指标 | 离线指标不能替代真实线上指标 | — |

### 回归评估指标

| 指标 | 公式 | 特点 |
|------|------|------|
| MSE | $\\frac{1}{n}\\sum (y_i - \\hat{y}_i)^2$ | 受异常值影响大 |
| RMSE | $\\sqrt{MSE}$ | 与 y 同单位，直观 |
| MAE | $\\frac{1}{n}\\sum |y_i - \\hat{y}_i|$ | 对异常值鲁棒 |
| MAPE | $\\frac{1}{n}\\sum |\\frac{y_i-\\hat{y}_i}{y_i}| \\times 100\\%$ | 相对误差，y→0 不稳定 |
| R² | $1 - \\frac{\\sum (y_i-\\hat{y}_i)^2}{\\sum (y_i-\\bar{y})^2}$ | 解释方差比例 |

## 模型选择策略

### 验证集调参与嵌套交叉验证

```python
from sklearn.model_selection import GridSearchCV, cross_val_score

# 常规调参
from sklearn.svm import SVC
param_grid = {'C': [0.1, 1, 10], 'gamma': [0.01, 0.1, 1]}
grid = GridSearchCV(SVC(kernel='rbf'), param_grid, cv=5, scoring='accuracy')
grid.fit(X_train, y_train)
print(f"Best params: {grid.best_params_}, CV score: {grid.best_score_:.3f}")

# 嵌套交叉验证（外循环评估泛化性能，内循环调参）
inner_cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
outer_cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=1)
clf = GridSearchCV(SVC(), param_grid, cv=inner_cv)
nested_scores = cross_val_score(clf, X, y, cv=outer_cv)
print(f"Nested CV accuracy: {nested_scores.mean():.3f} ± {nested_scores.std():.3f}")
```

### McNemar 检验（比较两个模型）

用于判断两个分类器的性能差异是否统计显著：

$$\\chi^2 = \\frac{(|n_{01} - n_{10}| - 1)^2}{n_{01} + n_{10}}$$

其中 $n_{01}$ 是 A 错 B 对的数量，$n_{10}$ 是 A 对 B 错的数量。

## 参考资源

- 周志华《机器学习》(西瓜书): https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm
- scikit-learn 模型评估文档: https://scikit-learn.org/stable/modules/model_evaluation.html
- scikit-learn 交叉验证: https://scikit-learn.org/stable/modules/cross_validation.html
- Deep Learning Book: https://www.deeplearningbook.org/
- d2l.ai (动手学深度学习): https://d2l.ai/
- Andrew Ng Coursera 专项课程: https://www.coursera.org/specializations/machine-learning-introduction
- PyTorch 教程: https://pytorch.org/tutorials/
""",

    "linear-models": """# 线性模型：回归与分类

## 线性回归

线性回归假设输出是输入的线性组合：

$$\\hat{y} = \\mathbf{w}^\\top\\mathbf{x} + b$$

最小化均方误差：

$$L(\\mathbf{w}) = \\frac{1}{n}\\sum_{i=1}^n (y_i - \\mathbf{w}^\\top\\mathbf{x}_i)^2$$

```python
from sklearn.linear_model import LinearRegression
model = LinearRegression().fit(X_train, y_train)
print(f"R^2: {model.score(X_test, y_test):.3f}")
print(f"权重: {model.coef_}")
```

### 正规方程：闭式解

当 $\\mathbf{X}^\\top\\mathbf{X}$ 可逆时，线性回归的权重有解析解：

$$\\mathbf{w}^* = (\\mathbf{X}^\\top\\mathbf{X})^{-1}\\mathbf{X}^\\top\\mathbf{y}$$

推导：令 $\\nabla_\\mathbf{w} L = -\\frac{2}{n}\\mathbf{X}^\\top(\\mathbf{y} - \\mathbf{X}\\mathbf{w}) = 0$，解得上述结果。

```python
import numpy as np

# 闭式解（正规方程）
X_b = np.c_[np.ones((len(X_train), 1)), X_train]  # 加偏置列
w_closed = np.linalg.inv(X_b.T @ X_b) @ X_b.T @ y_train
print(f"闭式解权重: {w_closed}")

# 验证与 sklearn 一致
from sklearn.linear_model import LinearRegression
lr = LinearRegression(fit_intercept=True).fit(X_train, y_train)
print(f"sklearn 权重: intercept={lr.intercept_:.4f}, coef={lr.coef_}")
```

**正规方程 vs 梯度下降：**

| 维度 | 正规方程 | 梯度下降 |
|------|---------|---------|
| 计算复杂度 | $O(d^3)$ (求逆) | $O(k \\cdot n \\cdot d)$ (k 轮迭代) |
| $d$ 很大时 | 慢或不可行 | 可行 |
| 需调学习率 | 否 | 是 |
| 需特征缩放 | 否 | 强烈建议 |
| 精确解 | 是（可逆时） | 近似解 |
| 支持在线学习 | 否 | 是 |

### 多项式特征 + 线性回归

数据非线性时，先做特征变换再套线性模型：

```python
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline

# 生成非线性数据
np.random.seed(42)
X = np.sort(np.random.rand(80, 1) * 6, axis=0)
y = np.sin(X).ravel() + np.random.randn(80) * 0.1

# 比较不同阶数的多项式回归
for degree in [1, 3, 10]:
    model = Pipeline([
        ('poly', PolynomialFeatures(degree=degree)),
        ('linear', LinearRegression())
    ])
    model.fit(X, y)
    score = model.score(X, y)
    print(f"Degree {degree:2d}: R²={score:.4f}")
    if degree == 3:
        print(f"  权重 (含截距+多项式项): {model.named_steps['linear'].coef_.round(4)}")
```

Degree=1 拟合不足（欠拟合），Degree=3 适中，Degree=10 会过拟合——高次项系数极大但仍能完美穿过训练点。

## 逻辑回归

在线性组合外套Sigmoid函数，将输出压缩到(0,1)表示概率：

$$P(y=1|\\mathbf{x}) = \\sigma(\\mathbf{w}^\\top\\mathbf{x}) = \\frac{1}{1+e^{-\\mathbf{w}^\\top\\mathbf{x}}}$$

Sigmoid 函数的导数形式优美：

$$\\sigma'(z) = \\sigma(z)(1 - \\sigma(z))$$

### 决策边界

$$\\mathbf{w}^\\top\\mathbf{x} = 0$$

当 $\\mathbf{w}^\\top\\mathbf{x} > 0$ 时预测正类，反之为负类。在高维空间中，这是一个超平面。

### 损失函数：交叉熵

逻辑回归通过极大似然估计推导出交叉熵损失：

$$L(\\mathbf{w}) = -\\frac{1}{n}\\sum_{i=1}^n \\left[ y_i \\log \\hat{y}_i + (1-y_i) \\log (1-\\hat{y}_i) \\right]$$

交叉熵损失的梯度形式与线性回归出奇相似：

$$\\nabla_\\mathbf{w} L = \\frac{1}{n}\\mathbf{X}^\\top(\\hat{\\mathbf{y}} - \\mathbf{y})$$

## 正则化：对抗过拟合

### 三种范式的统一形式

$$L_{\\text{reg}}(\\mathbf{w}) = L(\\mathbf{w}) + \\lambda R(\\mathbf{w})$$

| 正则化 | $R(\\mathbf{w})$ | 效果 | 梯度下的行为 |
|--------|-----------------|------|-------------|
| L1 (Lasso) | $\\sum_j |w_j|$ | 稀疏解，特征选择 | 将小权重推向 0 |
| L2 (Ridge) | $\\frac{1}{2}\\sum_j w_j^2$ | 收缩权值，防共线性 | 等比缩放所有权重 |
| ElasticNet | $\\alpha r L_1 + (1-\\alpha)\\frac{r}{2} L_2$ | 二者折中 | 先 L1 选特征再 L2 收缩 |

### L1 vs L2 的几何直觉

约束区域：

- **L1 约束** $\\|\\mathbf{w}\\|_1 \\leq t$ 是一个菱形（轴对齐），最优解容易落在坐标轴上 → 产生稀疏解。
- **L2 约束** $\\|\\mathbf{w}\\|_2^2 \\leq t$ 是一个圆（各向同性），最优解通常不在坐标轴上。

从贝叶斯视角理解：

- **L2** 等价于 $\\mathbf{w}$ 的高斯先验：$P(\\mathbf{w}) \\propto e^{-\\frac{\\lambda}{2}\\|\\mathbf{w}\\|_2^2}$
- **L1** 等价于 $\\mathbf{w}$ 的 Laplace 先验：$P(\\mathbf{w}) \\propto e^{-\\lambda\\|\\mathbf{w}\\|_1}$

```python
from sklearn.linear_model import Ridge, Lasso, ElasticNet

# 对比三种正则化
for name, model in [
    ('Ridge (L2)', Ridge(alpha=1.0)),
    ('Lasso (L1)', Lasso(alpha=0.1)),
    ('ElasticNet', ElasticNet(alpha=0.1, l1_ratio=0.5)),
]:
    model.fit(X_train, y_train)
    nz = (model.coef_ != 0).sum()
    print(f"{name:18s} R²={model.score(X_test, y_test):.3f}, "
          f"非零系数={nz}, coef={model.coef_.round(3)}")
```

### 正则化路径可视化概念

将 $\\lambda$ 从很大逐渐减小到 0，观察每个特征的系数如何变化：

- 当 $\\lambda$ 很大时所有系数接近 0（强正则化）
- 随着 $\\lambda$ 减小，系数逐渐"激活"——重要的先激活
- 在 Lasso 路径上，各系数从 0 逐个变为非零

```python
from sklearn.linear_model import lars_path
import numpy as np

# Lasso 正则化路径 (使用 LARS)
from sklearn.linear_model import Lars

# 模拟特征量多于样本量的场景
np.random.seed(42)
X = np.random.randn(50, 20)
w_true = np.zeros(20)
w_true[[0, 3, 7]] = [1.5, -2.0, 0.8]  # 只有 3 个有效特征
y = X @ w_true + np.random.randn(50) * 0.5

alphas, _, coefs = lars_path(X, y, method='lasso')
print(f"Lasso 路径: {len(alphas)} 个 $\\lambda$ 值")
print(f"最终非零系数数量: {(coefs[:, -1] != 0).sum()}")

# 看看哪些特征第一、第二、第三个进入模型
entry_order = np.argmax(coefs != 0, axis=1)
order = np.argsort(entry_order)
for rank, idx in enumerate(order[:5], 1):
    print(f"  第 {rank} 个激活: 特征 {idx} "
          f"(真实权重={w_true[idx] if w_true[idx] != 0 else 0:.1f})")
```

## 线性判别分析 (LDA)

与逻辑回归从概率建模不同，LDA 从**几何**角度出发：找一个投影方向，使同类样本尽可能近、异类样本尽可能远。

最大化目标：

$$J(\\mathbf{w}) = \\frac{\\mathbf{w}^\\top \\mathbf{S}_B \\mathbf{w}}{\\mathbf{w}^\\top \\mathbf{S}_W \\mathbf{w}}$$

其中 $\\mathbf{S}_B$ 是类间散度矩阵、$\\mathbf{S}_W$ 是类内散度矩阵。

## 多分类策略

### 一对多 (One-vs-Rest / OvR)

训练 K 个二分类器，第 k 个分类器将第 k 类作为正类、其余作为负类。预测时选概率最高的：

$$\\hat{y} = \\arg\\max_{k \\in \\{1,\\dots,K\\}} P(y=k \\mid \\mathbf{x})$$

### 一对一 (One-vs-One / OvO)

训练 $\\binom{K}{2}$ 个二分类器，每对类别之间一个。预测时投票。对于类别多但每类数据少的场景，OvO 的单个分类器训练更快。

### Softmax 回归（多分类逻辑回归）

直接输出 K 类的概率分布：

$$P(y=k \\mid \\mathbf{x}) = \\frac{e^{\\mathbf{w}_k^\\top \\mathbf{x}}}{\\sum_{j=1}^{K} e^{\\mathbf{w}_j^\\top \\mathbf{x}}}$$

Softmax 的交叉熵损失（含导数）：

$$L = -\\frac{1}{n}\\sum_{i=1}^n \\sum_{k=1}^K y_{ik} \\log \\hat{y}_{ik}, \\quad \\frac{\\partial L}{\\partial z_k} = \\hat{y}_k - y_k$$

这个简洁的梯度形式是 softmax + cross-entropy 组合在深度学习中如此流行的关键原因。

## 参考资源

- 周志华《机器学习》(西瓜书): https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm
- scikit-learn 线性模型: https://scikit-learn.org/stable/modules/linear_model.html
- scikit-learn 用户指南: https://scikit-learn.org/stable/user_guide.html
- Deep Learning Book: https://www.deeplearningbook.org/
- d2l.ai (动手学深度学习): https://d2l.ai/
- Andrew Ng Coursera 专项课程: https://www.coursera.org/specializations/machine-learning-introduction
- PyTorch 教程: https://pytorch.org/tutorials/
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
            if slug in ENRICHED:
                old_len = len(ch.markdown or "")
                ch.markdown = ENRICHED[slug]
                print(f"  Updated {slug}: {old_len} → {len(ch.markdown)} chars (+{len(ch.markdown) - old_len})")
        await db.commit()
        print(f"Done: {len(SLUGS)} chapters enriched")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(enrich())
