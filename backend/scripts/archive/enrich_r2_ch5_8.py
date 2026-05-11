"""Enrich ML book chapters 5-8 with formulas, tables, code, and references.

Run: cd backend && python3 scripts/enrich_r2_ch5_8.py
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

ENRICHED = {
    "decision-trees": """# 决策树与K近邻

## 学习定位

决策树和K近邻是两种思想完全不同的算法：前者基于"不断提问"的树形规则，后者基于"近朱者赤"的距离投票。理解它们有助于建立分类算法的直觉。

## 决策树

### 核心思想

决策树通过递归地将数据划分成更纯的子集来构建分类/回归规则。每个内部节点代表一个特征测试，每条分支代表测试结果，每个叶节点代表最终的预测值。

$$\\text{树形决策过程: } f(x) = \\begin{cases} c_1, & \\text{if } x_j \\leq t_1 \\\\ c_2, & \\text{if } x_j > t_1 \\text{ and } x_k \\leq t_2 \\\\ \\vdots \\end{cases}$$

### 划分标准

决策树在每个节点选择一个特征和阈值来划分数据。划分的目标是使子节点尽可能"纯"。

#### 信息熵

$$H(D) = -\\sum_{k=1}^{|\\mathcal{Y}|} p_k \\log_2 p_k$$

熵衡量不确定性：纯度越高，熵越小。当所有样本属于同一类时，$H(D) = 0$。

#### 基尼系数

$$\\text{Gini}(D) = 1 - \\sum_{k=1}^{|\\mathcal{Y}|} p_k^2$$

基尼系数反映随机抽取两个样本类别不一致的概率。值越小纯度越高。

#### 信息增益

$$\\text{Gain}(D, a) = H(D) - \\sum_{v=1}^{V} \\frac{|D^v|}{|D|} H(D^v)$$

选择信息增益最大的特征进行划分。

### 熵 vs 基尼：全面对比

| 维度 | 信息熵 (Entropy) | 基尼系数 (Gini) |
|------|-----------------|----------------|
| 公式 | $-\\sum p_k \\log_2 p_k$ | $1 - \\sum p_k^2$ |
| 计算开销 | 含对数运算，略慢 | 仅平方运算，更快 |
| 取值范围 | $[0, \\log_2|\\mathcal{Y}|]$ | $[0, 0.5]$ (二分类) |
| 对纯度的敏感度 | 对微小不纯更敏感 | 对微小不纯容忍度更高 |
| 分裂偏好 | 倾向于产生更平衡的树 | 倾向于隔离多数类 |
| 实际差异 | 多数数据集上两者最终准确率几乎相同 | — |
| scikit-learn 默认 | — | `DecisionTreeClassifier(criterion='gini')` |
| 何时选择 | 类别数多、需要精细纯度控制 | 二分类、训练速度优先 |

### 剪枝：防止过拟合

决策树如果不加限制，会一直生长直到每个叶节点只包含一个样本——严重过拟合。

$$\\text{剪枝目标: } \\min \\sum_{leaf} \\text{impurity}(leaf) + \\alpha \\cdot |\\text{leaves}|$$

#### 重要剪枝参数

| 参数 | 含义 | 效果 | 推荐范围 |
|------|------|------|----------|
| `max_depth` | 树的最大深度 | 越小越简单 | 3~20 |
| `min_samples_split` | 内部节点再划分所需最小样本数 | 越大越简单 | 2~20 |
| `min_samples_leaf` | 叶节点最少样本数 | 越大越简单 | 1~10 |
| `max_leaf_nodes` | 最大叶节点数 | 直接限制叶子数量 | 10~100 |
| `ccp_alpha` | 代价复杂度剪枝参数 | 越大剪枝越多 | 0~0.05 |
| `min_impurity_decrease` | 划分需满足的最小不纯度下降 | 越大越简单 | 0~0.01 |

**调参策略：**
1. 先用网格搜索确定 `max_depth`（最重要的参数）
2. 再调整 `min_samples_split` / `min_samples_leaf`
3. 最后使用 `ccp_alpha` 做代价复杂度剪枝

### 完整代码示例：可视化决策树

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import load_iris
from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.model_selection import train_test_split, GridSearchCV

# 加载数据
iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target, test_size=0.3, random_state=42
)

# 网格搜索最佳剪枝参数
param_grid = {
    'max_depth': [2, 3, 4, 5, 6],
    'min_samples_split': [2, 5, 10],
    'criterion': ['gini', 'entropy']
}
grid = GridSearchCV(
    DecisionTreeClassifier(random_state=42),
    param_grid, cv=5, scoring='accuracy'
)
grid.fit(X_train, y_train)

print(f"Best params: {grid.best_params_}")
print(f"Train acc: {grid.score(X_train, y_train):.3f}")
print(f"Test acc:  {grid.score(X_test, y_test):.3f}")

# 使用最佳模型
best_model = grid.best_estimator_

# 可视化决策树
plt.figure(figsize=(16, 10))
plot_tree(
    best_model,
    feature_names=iris.feature_names,
    class_names=iris.target_names,
    filled=True,
    rounded=True,
    fontsize=10,
    proportion=True
)
plt.title(f"Decision Tree (depth={best_model.max_depth})", fontsize=14)
plt.tight_layout()
plt.show()

# 特征重要性
for name, imp in zip(iris.feature_names, best_model.feature_importances_):
    print(f"  {name}: {imp:.4f}")
```

### 剪枝参数对树形状的影响实验

```python
from sklearn.tree import DecisionTreeClassifier

# 对比不同 max_depth
for depth in [2, 5, None]:
    tree = DecisionTreeClassifier(max_depth=depth, random_state=42)
    tree.fit(X_train, y_train)
    n_leaves = tree.get_n_leaves()
    n_nodes = tree.tree_.node_count
    print(f"max_depth={depth}: "
          f"nodes={n_nodes}, leaves={n_leaves}, "
          f"train={tree.score(X_train, y_train):.3f}, "
          f"test={tree.score(X_test, y_test):.3f}")

# 对比不同 min_samples_leaf
for leaf in [1, 5, 10, 20]:
    tree = DecisionTreeClassifier(
        max_depth=5, min_samples_leaf=leaf, random_state=42
    )
    tree.fit(X_train, y_train)
    print(f"min_samples_leaf={leaf:2d}: "
          f"leaves={tree.get_n_leaves():2d}, "
          f"test={tree.score(X_test, y_test):.3f}")
```

## K近邻 (KNN)

### 核心思想

KNN是惰性学习：不显式训练，预测时才计算新样本与所有训练样本的距离，投票决定类别。

$$\\hat{y} = \\text{mode}\\{y_i \\mid x_i \\in \\mathcal{N}_k(x)\\}$$

其中 $\\mathcal{N}_k(x)$ 表示离 $x$ 最近的 $k$ 个训练样本。

### 距离度量

| 度量 | 公式 | 适用场景 |
|------|------|----------|
| 欧氏距离 | $d = \\sqrt{\\sum (x_i - y_i)^2}$ | 通用，连续特征 |
| 曼哈顿距离 | $d = \\sum |x_i - y_i|$ | 高维稀疏数据 |
| 闵可夫斯基距离 | $d = (\\sum |x_i - y_i|^p)^{1/p}$ | p=1曼哈顿, p=2欧氏 |
| 余弦相似度 | $\\frac{x \\cdot y}{\\|x\\| \\|y\\|}$ | 文本、高维稀疏 |

### K值选择最佳实践

$$\\text{偏差-方差权衡: } k \\uparrow \\implies \\text{bias} \\uparrow, \\text{var} \\downarrow$$

| K值 | 决策边界 | 偏差 | 方差 | 问题 |
|-----|---------|------|------|------|
| $k=1$ | 极复杂 | 极低 | 极高 | 严重过拟合，对噪声敏感 |
| $k=3$~$5$ | 较复杂 | 低 | 较高 | 二分类常用 |
| $k=\\sqrt{n}$ | 适中 | 适中 | 适中 | 经典经验公式 |
| $k=\\log n$ | 较平滑 | 较高 | 较低 | 保守选择 |
| $k=n$ | 完全平滑 | 极高 | 极低 | 恒预测多数类 |

**K值选择最佳实践：**
1. **从交叉验证入手**：对候选 $k \\in \\{1, 3, 5, 7, 9, 11, 15, 21, 31\\}$ 做5折交叉验证
2. **选奇不选偶**：二分类时选奇数避免平票
3. **经验公式**：$k = \\lfloor\\sqrt{n}\\rfloor$ 是合理的起点
4. **距离加权**：`weights='distance'` 可减轻k值选择的影响，让近邻贡献更大
5. **数据量影响**：样本多时k可以大些；小数据集用较小k

```python
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import cross_val_score
import numpy as np

# K值选择交叉验证
k_range = range(1, 31, 2)
cv_scores = []

for k in k_range:
    knn = KNeighborsClassifier(n_neighbors=k)
    scores = cross_val_score(knn, X_train, y_train, cv=5)
    cv_scores.append(scores.mean())

best_k = list(k_range)[np.argmax(cv_scores)]
print(f"Best k: {best_k}, CV score: {max(cv_scores):.3f}")

# 最终模型
knn = KNeighborsClassifier(
    n_neighbors=best_k,
    weights='distance',  # 距离加权
    metric='euclidean'
)
knn.fit(X_train, y_train)
print(f"Test accuracy: {knn.score(X_test, y_test):.3f}")
```

## 决策树 vs KNN 对比

| 维度 | 决策树 | KNN |
|------|--------|-----|
| 学习方式 | 急切学习 (Eager) | 惰性学习 (Lazy) |
| 训练时间 | $O(n \\log n)$ | $O(1)$ (几乎不训练) |
| 预测时间 | $O(\\log n)$ | $O(nd)$ (需计算所有距离) |
| 可解释性 | 高 (可视化规则) | 低 (黑箱投票) |
| 特征缩放依赖 | 不需要 | 必须标准化 |
| 高维性能 | 尚可 | 差 (维度灾难) |
| 非线性 | 天然支持 | 取决于距离度量 |
| 缺失值 | 可处理 (代理分裂) | 需预处理 |

## 延伸参考

- 《机器学习》(西瓜书) 第4章 4.1-4.2 — 决策树系统论述
- 《统计学习方法》第5章 — 决策树详解
- scikit-learn Decision Trees 文档: https://scikit-learn.org/stable/modules/tree.html
- scikit-learn Nearest Neighbors 文档: https://scikit-learn.org/stable/modules/neighbors.html
- Elements of Statistical Learning 9.2 — CART算法数学推导
- KD-Tree Algorithm: https://en.wikipedia.org/wiki/K-d_tree""",

    "svm": """# 支持向量机

## 学习定位

支持向量机(SVM)曾是深度学习兴起前的"最佳"分类器。理解SVM不仅让你掌握一个强大算法，更能建立"间隔最大化"和"核技巧"的核心ML思想。

## 核心直觉

SVM的目标：找一个超平面，使离它最近的点（支持向量）与超平面的距离最大化。

### 线性可分SVM

$$\\min_{w,b} \\frac{1}{2}\\|w\\|^2 \\quad \\text{s.t.} \\quad y_i(w^T x_i + b) \\geq 1, \\forall i$$

约束条件 $y_i(w^T x_i + b) \\geq 1$ 要求所有样本被正确分类且位于间隔外。

### 软间隔SVM（线性不可分）

$$\\min_{w,b,\\xi} \\frac{1}{2}\\|w\\|^2 + C\\sum_{i=1}^n \\xi_i \\quad \\text{s.t.} \\quad y_i(w^T x_i + b) \\geq 1 - \\xi_i, \\; \\xi_i \\geq 0$$

其中 $\\xi_i$ 是松弛变量，$C$ 控制容错程度。

### 对偶问题与核技巧

通过拉格朗日对偶性，SVM的目标函数转化为仅依赖样本间内积的形式，为核技巧铺路：

$$\\max_{\\alpha} \\sum_{i=1}^n \\alpha_i - \\frac{1}{2}\\sum_{i=1}^n\\sum_{j=1}^n \\alpha_i \\alpha_j y_i y_j \\langle x_i, x_j \\rangle$$

**核技巧**：将内积 $\\langle x_i, x_j \\rangle$ 替换为核函数 $K(x_i, x_j) = \\langle \\phi(x_i), \\phi(x_j) \\rangle$，在更高维空间隐式映射数据。

## 核函数深度解析

### 常见核函数

| 核函数 | 公式 | 参数 | 适用场景 |
|--------|------|------|----------|
| 线性核 | $K(x,z) = x^T z$ | 无 | 线性可分 / 高维稀疏(文本) |
| 多项式核 | $K(x,z) = (\\gamma \\cdot x^T z + r)^d$ | $\\gamma, d, r$ | 已知多项式关系 |
| RBF/高斯核 | $K(x,z) = \\exp(-\\gamma \\|x-z\\|^2)$ | $\\gamma$ | 通用、非线性 |
| Sigmoid核 | $K(x,z) = \\tanh(\\gamma x^T z + r)$ | $\\gamma, r$ | 近似神经网络 |

### RBF 核深入理解

RBF核是最常用的核，其参数 $\\gamma$ 至关重要：

$$K(x, z) = \\exp(-\\gamma \\cdot \\|x - z\\|^2)$$

**$\\gamma$ 参数直觉：**

| $\\gamma$ 值 | 核函数宽度 | 影响范围 | 决策边界 | 模型复杂度 | 风险 |
|-------------|-----------|---------|---------|-----------|------|
| 很小 ($\\leq 0.01$) | 很宽 | 远距离样本仍有高相似度 | 平滑简单 | 低 | 欠拟合 |
| 适中 ($0.1 \\sim 1$) | 适中 | 中等距离样本适度影响 | 合理弯曲 | 适中 | 良好泛化 |
| 很大 ($\\geq 10$) | 很窄 | 仅极近样本有影响 | 极复杂弯曲 | 极高 | 严重过拟合 |

**直觉类比：** $\\gamma$ 控制每个支持向量的"影响力半径"。$\\gamma$ 越小，每个支持向量影响越远，决策边界越平滑（像大光圈模糊）；$\\gamma$ 越大，每个支持向量只影响很近的区域，决策边界贴合数据（像针尖精准但泛化差）。

### 多项式核 vs RBF 核对比

| 维度 | 多项式核 | RBF 核 |
|------|---------|--------|
| 公式 | $(\\gamma x^T z + r)^d$ | $\\exp(-\\gamma \\|x-z\\|^2)$ |
| 映射维度 | 有限：$\\binom{n+d}{d}$ | 无限维 |
| 超参数数量 | 3个 ($\\gamma, d, r$) | 1个 ($\\gamma$) |
| 调参难度 | 较高（d影响巨大） | 中等 |
| 计算效率 | d小时快，d大时慢 | 始终$O(n^2 \\cdot d_{in})$ |
| 决策边界形状 | 多项式曲面 | 光滑闭合曲线 |
| 适用场景 | 已知多项式结构的问题 | 通用、未知结构的问题 |
| 过拟合风险 | d大时极高 | $\\gamma$大时高 |

**经验规则：** 大多数情况下先用RBF核，因为参数少且表达能力强。只有当你确信数据有明确的多项式结构时才尝试多项式核。

### SVC 概率校准

标准SVM输出的是决策函数值（到超平面的带符号距离），而非概率。使用 Platt Scaling 或交叉验证校准可获得概率估计。

```python
import numpy as np
from sklearn.svm import SVC
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import log_loss, brier_score_loss

# 生成数据
X, y = make_classification(
    n_samples=1000, n_features=20, n_informative=10,
    random_state=42
)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42
)

# 方案1: 直接在 SVC 中启用 probability=True (内部5折交叉验证)
svc_prob = SVC(kernel='rbf', C=1.0, gamma='scale', probability=True)
svc_prob.fit(X_train, y_train)
probs_1 = svc_prob.predict_proba(X_test)
print(f"SVC(probability=True) - LogLoss: {log_loss(y_test, probs_1):.4f}, "
      f"Brier: {brier_score_loss(y_test, probs_1[:,1]):.4f}")

# 方案2: 使用 CalibratedClassifierCV 包装（支持 isotonic 和 sigmoid 校准）
svc_base = SVC(kernel='rbf', C=1.0, gamma='scale')
calibrated = CalibratedClassifierCV(
    svc_base, method='isotonic', cv=5
)
calibrated.fit(X_train, y_train)
probs_2 = calibrated.predict_proba(X_test)
print(f"Isotonic校准 - LogLoss: {log_loss(y_test, probs_2):.4f}, "
      f"Brier: {brier_score_loss(y_test, probs_2[:,1]):.4f}")

# 方案3: 对比不同校准方法
for method in ['sigmoid', 'isotonic']:
    cal = CalibratedClassifierCV(
        SVC(kernel='rbf', C=1.0, gamma='scale'), method=method, cv=5
    )
    cal.fit(X_train, y_train)
    prob = cal.predict_proba(X_test)
    ll = log_loss(y_test, prob)
    print(f"{method:8s}: LogLoss={ll:.4f}")

# 比较校准后的概率质量
print(f"\\n概率均值: sigmoid={probs_2[:,1].mean():.3f}")
print(f"概率置信: 5%分位={np.percentile(probs_2[:,1], 5):.3f}, "
      f"95%分位={np.percentile(probs_2[:,1], 95):.3f}")
```

## SVM多分类策略

SVM本质是二分类器，处理多分类需要组合策略。

### OvO vs OvR 全面对比

| 维度 | One-vs-One (OvO) | One-vs-Rest (OvR) |
|------|-----------------|-------------------|
| 分类器数量 | $K(K-1)/2$ | $K$ |
| 每个分类器样本量 | 2类样本 | 全部样本 |
| 总训练时间 | $O(K^2 \\cdot (n/K)^{\\alpha}), \\alpha\\approx2$ | $O(K \\cdot n^{\\alpha})$ |
| 预测时间 | $O(K^2)$ 次分类 | $O(K)$ 次分类 |
| 投票方式 | 每对投票，票多者获胜 | 选得分最高者 |
| K=10时分类器数 | 45 | 10 |
| K=100时分类器数 | 4950 | 100 |
| scikit-learn 默认 | `SVC(decision_function_shape='ovr')` | — |
| 优点 | 每个子问题简单；类别多时训练快 | 分类器少；预测快 |
| 缺点 | 分类器数量二次增长；预测慢 | 类别不平衡时偏差大 |
| 适用 | 类别数中等(K<20) | 类别数多(K>20) |

### SVM 多分类代码对比

```python
from sklearn.svm import SVC
from sklearn.multiclass import OneVsRestClassifier, OneVsOneClassifier
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
import time

digits = load_digits()
X_train, X_test, y_train, y_test = train_test_split(
    digits.data, digits.target, test_size=0.3, random_state=42
)

# 方法1: SVC 内置 OvR (默认)
svc_ovr = SVC(kernel='rbf', decision_function_shape='ovr')
t0 = time.time()
svc_ovr.fit(X_train, y_train)
t1 = time.time()
acc_ovr = svc_ovr.score(X_test, y_test)
print(f"SVC(ovr): acc={acc_ovr:.3f}, train_time={t1-t0:.2f}s")

# 方法2: 显式 OvO
svc_ovo = OneVsOneClassifier(SVC(kernel='rbf', probability=False))
t0 = time.time()
svc_ovo.fit(X_train, y_train)
t1 = time.time()
acc_ovo = svc_ovo.score(X_test, y_test)
print(f"OvO:      acc={acc_ovo:.3f}, train_time={t1-t0:.2f}s")

# 方法3: 显式 OvR
svc_ovr2 = OneVsRestClassifier(SVC(kernel='rbf', probability=False))
t0 = time.time()
svc_ovr2.fit(X_train, y_train)
t1 = time.time()
acc_ovr2 = svc_ovr2.score(X_test, y_test)
print(f"OvR:      acc={acc_ovr2:.3f}, train_time={t1-t0:.2f}s")
```

## 超参数调优

### SVM 核心超参数

| 参数 | 含义 | 效果 | 搜索建议 |
|------|------|------|----------|
| $C$ | 正则化系数 | 越大越拟合数据 | `logspace(-3, 3, 7)` |
| $\\gamma$ | RBF核宽度 | 越大模型越复杂 | `logspace(-3, 3, 7)` |
| `kernel` | 核函数类型 | 控制映射方式 | `['linear','rbf','poly']` |
| $d$ | 多项式次数 | 越大映射越复杂 | `[2, 3, 4]` |
| `class_weight` | 类别权重 | 处理不均衡 | `'balanced'` 或自定义 |

## 延伸参考

- 《统计学习方法》第7章 — SVM数学推导最清晰的中文资料
- SVM Tutorial (MIT): https://web.mit.edu/6.034/wwwbob/svm-notes-long-08.pdf
- scikit-learn SVM Guide: https://scikit-learn.org/stable/modules/svm.html
- A Practical Guide to SVM Classification (Hsu et al.): https://www.csie.ntu.edu.tw/~cjlin/papers/guide/guide.pdf
- Platt Scaling 论文: https://www.cs.colorado.edu/~mozer/Teaching/syllabi/6622/papers/Platt1999.pdf""",

    "bayesian": """# 贝叶斯分类器

## 学习定位

贝叶斯分类器基于概率论，用"先验知识+观测数据 → 后验判断"的框架做决策。理解贝叶斯分类能帮你建立概率思维，这对理解生成模型和不确定量化至关重要。

## 贝叶斯定理回顾

$$P(Y|X) = \\frac{P(X|Y) \\cdot P(Y)}{P(X)}$$

ML语境解读：**后验概率** = (似然 × 先验) / 证据

### 从贝叶斯定理到分类决策

对于分类任务，我们选择使后验概率最大化的类别：

$$\\hat{y} = \\arg\\max_{c_k} P(Y = c_k | X = x) = \\arg\\max_{c_k} P(X = x | Y = c_k) \\cdot P(Y = c_k)$$

最大化后验等价于最大化 $P(X|Y) \\cdot P(Y)$（因为 $P(X)$ 对所有类别相同）。

## 朴素贝叶斯

### 为何"朴素"

计算联合似然 $P(X=x|Y=c_k)$ 太难（维度灾难），于是做**条件独立性假设**：

$$P(X = x | Y = c_k) = P(x_1, x_2, ..., x_d | Y = c_k) \\approx \\prod_{j=1}^d P(x_j | Y = c_k)$$

这个假设在现实中几乎从不成立，但NB仍然工作得很好——**尽管"错"但有"用"**。

### 朴素贝叶斯判决函数

$$\\hat{y} = \\arg\\max_{c_k} P(Y = c_k) \\prod_{j=1}^d P(x_j | Y = c_k)$$

### 三种朴素贝叶斯变体

| 变体 | 特征分布假设 | 适用特征 | scikit-learn |
|------|------------|---------|-------------|
| 高斯NB | $P(x_j|Y) \\sim \\mathcal{N}(\\mu_{jk}, \\sigma^2_{jk})$ | 连续数值 | `GaussianNB` |
| 多项式NB | $P(x_j|Y) \\propto$ 词频 | 离散计数 | `MultinomialNB` |
| 伯努利NB | $P(x_j|Y) \\propto$ 出现/不出现 | 二元特征 | `BernoulliNB` |
| 补集NB | 用互补类别估计 | 不平衡文本 | `ComplementNB` |

## 拉普拉斯平滑

### 为什么需要平滑

如果某特征值在训练集中未出现，则 $P(x_j | Y = c_k) = 0$，连乘积整体为0。一个零概率"杀死"所有其他证据。

### 拉普拉斯平滑原理

$$P(x_j | Y = c_k) = \\frac{N_{jk} + \\alpha}{N_k + \\alpha \\cdot d}$$

其中：
- $N_{jk}$：类别 $c_k$ 中特征 $x_j$ 的出现次数
- $N_k$：类别 $c_k$ 的总样本数
- $d$：特征的不同取值数
- $\\alpha$：平滑参数，$\\alpha=1$ 为经典拉普拉斯平滑

### 拉普拉斯平滑的影响

| $\\alpha$ | 名称 | 效果 | 适用场景 |
|-----------|------|------|----------|
| $\\alpha = 0$ | 无平滑 | 最大似然估计，零概率问题 | 理论上不推荐 |
| $\\alpha = 1$ | 拉普拉斯平滑 | 均匀先验假设 | 通用、经典 |
| $\\alpha < 1$ | Lidstone平滑 | 比拉普拉斯保守 | 数据稀疏但信任样本 |
| $\\alpha \\to \\infty$ | 趋近均匀分布 | 所有概率趋同 | 极不信任数据 |

**直觉：** 每个类别中，$\\alpha$ 是"虚拟计数"——相当于在观测到任何数据之前，假设每个特征值已经出现了 $\\alpha$ 次。

## 垃圾邮件检测完整代码

```python
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_auc_score
)
from sklearn.pipeline import Pipeline

# 模拟邮件数据 (实际使用时替换为真实数据)
emails = [
    ("免费领取万元大奖 点击链接立即参与", "spam"),
    ("给您带来超值优惠 限时抢购 机不可失", "spam"),
    ("关于明天的会议安排 请您准时参加", "ham"),
    ("您的快递已到达 请及时取件", "ham"),
    ("恭喜您获得VIP资格 详情请点击", "spam"),
    ("本周工作汇报已发送 请查收", "ham"),
    ("特价机票 最低1折起 数量有限", "spam"),
    ("项目进度更新 请各位查看邮件", "ham"),
    ("在家轻松赚钱 日入过千 无需经验", "spam"),
    ("请确认下周的培训时间安排", "ham"),
    ("性感荷官在线发牌 注册就送888", "spam"),
    ("财务报表已更新 请登录系统查看", "ham"),
    ("您有一条新的好友申请", "ham"),
    ("不花钱也能变美 神奇产品大揭秘", "spam"),
    ("技术分享会PPT已上传 欢迎大家", "ham"),
] * 50  # 复制50份增加数据量

# 构建DataFrame
df = pd.DataFrame(emails, columns=['text', 'label'])
df['label'] = df['label'].map({'spam': 1, 'ham': 0})

X_train, X_test, y_train, y_test = train_test_split(
    df['text'], df['label'], test_size=0.3, random_state=42, stratify=df['label']
)

# 方案1: CountVectorizer + MultinomialNB
print("=" * 50)
print("方案1: CountVectorizer + MultinomialNB")
print("=" * 50)

pipeline1 = Pipeline([
    ('vectorizer', CountVectorizer(
        max_features=5000,
        ngram_range=(1, 2),      # 使用1-gram和2-gram
        stop_words=None           # 同项目已有的停用词处理
    )),
    ('classifier', MultinomialNB(alpha=1.0))  # alpha=1.0 拉普拉斯平滑
])

# 交叉验证
cv_scores = cross_val_score(pipeline1, X_train, y_train, cv=5, scoring='accuracy')
print(f"5-fold CV accuracy: {cv_scores.mean():.3f} +/- {cv_scores.std():.3f}")

pipeline1.fit(X_train, y_train)
y_pred = pipeline1.predict(X_test)
y_prob = pipeline1.predict_proba(X_test)[:, 1]

print(f"Test accuracy: {pipeline1.score(X_test, y_test):.3f}")
print(f"ROC AUC: {roc_auc_score(y_test, y_prob):.3f}")
print(f"\\n{classification_report(y_test, y_pred, target_names=['ham','spam'])}")

# 方案2: TF-IDF + MultinomialNB (对比)
print("=" * 50)
print("方案2: TfidfVectorizer + MultinomialNB")
print("=" * 50)

pipeline2 = Pipeline([
    ('vectorizer', TfidfVectorizer(
        max_features=5000,
        ngram_range=(1, 2),
        sublinear_tf=True  # 使用 1+log(tf) 抑制高频词
    )),
    ('classifier', MultinomialNB(alpha=1.0))
])

cv_scores2 = cross_val_score(pipeline2, X_train, y_train, cv=5, scoring='accuracy')
print(f"5-fold CV accuracy: {cv_scores2.mean():.3f} +/- {cv_scores2.std():.3f}")

pipeline2.fit(X_train, y_train)
y_pred2 = pipeline2.predict(X_test)
y_prob2 = pipeline2.predict_proba(X_test)[:, 1]

print(f"Test accuracy: {pipeline2.score(X_test, y_test):.3f}")
print(f"ROC AUC: {roc_auc_score(y_test, y_prob2):.3f}")

# 混淆矩阵
cm = confusion_matrix(y_test, y_pred)
print(f"\\n混淆矩阵:")
print(f"         预测ham  预测spam")
print(f"实际ham    {cm[0,0]:5d}    {cm[0,1]:5d}")
print(f"实际spam   {cm[1,0]:5d}    {cm[1,1]:5d}")

# 拉普拉斯平滑参数对比
print("\\n拉普拉斯平滑 alpha 对比:")
for alpha in [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]:
    nb = Pipeline([
        ('vec', CountVectorizer(max_features=5000)),
        ('clf', MultinomialNB(alpha=alpha))
    ])
    scores = cross_val_score(nb, X_train, y_train, cv=5, scoring='accuracy')
    print(f"  alpha={alpha:5.1f}: CV acc={scores.mean():.4f} +/- {scores.std():.4f}")

# 最具区分性的词
vec = pipeline1.named_steps['vectorizer']
clf = pipeline1.named_steps['classifier']
feature_names = vec.get_feature_names_out()
spam_log_prob = clf.feature_log_prob_[1]  # spam类的对数概率
ham_log_prob = clf.feature_log_prob_[0]

# 对spam最有区分力的词 (spam概率 >> ham概率)
diff = spam_log_prob - ham_log_prob
top_spam_idx = np.argsort(diff)[-10:][::-1]
print("\\nTop spams信息词:")
for idx in top_spam_idx:
    print(f"  {feature_names[idx]:15s} (diff={diff[idx]:.2f})")
```

## 生成式 vs 判别式分类器

贝叶斯分类器是典型的**生成式**模型，这与之前学的逻辑回归（**判别式**）有本质区别。

### 核心区别

$$\\text{生成式: } P(X, Y) = P(X|Y)P(Y) \\xrightarrow{\\text{推断}} P(Y|X)$$
$$\\text{判别式: } P(Y|X) \\text{ 直接建模}$$

### 全面对比

| 维度 | 生成式 (Generative) | 判别式 (Discriminative) |
|------|-------------------|------------------------|
| 建模对象 | 联合分布 $P(X,Y)$ | 条件分布 $P(Y|X)$ |
| 学习目标 | 数据如何"生成" | 决策边界在哪里 |
| 代表算法 | 朴素贝叶斯、LDA、HMM、GAN | 逻辑回归、SVM、决策树、NN |
| 样本需求 | 更多样本收敛到真实分布 | 较少样本即可学到决策边界 |
| 收敛速度 | $O(\\log n)$ | $O(1/n)$ |
| 渐近误差 | 较高（模型假设偏差） | 较低 |
| 处理缺失值 | 天然可用边缘化 | 需额外处理 |
| 不确定性量化 | 可以（概率密度） | 有限（仅条件概率） |
| 异常检测 | 可（$P(X)$ 低即为异常） | 不可以 |
| 数据生成 | 可以（采样$P(X,Y)$） | 不可以 |
| 半监督学习 | 适合 | 困难 |
| 分类准确率 | 通常略低 | 通常更高 |

### 何时用生成式模型？

1. **数据量小**：生成式收敛更快，小样本下可能优于判别式
2. **需要异常检测**：只有生成式能直接判断"这个样本是否异常"
3. **有缺失值**：生成式可对缺失特征边缘化
4. **需要数据生成**：数据增强、模拟新样本
5. **有领域知识**：可以整合到 $P(X|Y)$ 的分布假设中

### 朴素贝叶斯为何"朴素但强"

朴素贝叶斯虽假设特征独立（通常是错的），但在许多任务上表现优异，原因：
- 分类只需相对大小，不必精确概率
- 偏差不影响排序（概率失真但排序可能正确）
- 高维空间中方差极低

$$\\text{NB 成功秘诀: } \\text{偏差高, 方差极低} \\implies \\text{需要少数据就能稳定}$$

## 延伸参考

- 《机器学习》(西瓜书) 第7章 — 贝叶斯分类器系统论述
- 《统计学习方法》第4章 — 朴素贝叶斯详解
- Speech and Language Processing Ch4: https://web.stanford.edu/~jurafsky/slp3/4.pdf
- scikit-learn Naive Bayes 文档: https://scikit-learn.org/stable/modules/naive_bayes.html
- Generative vs Discriminative (Ng & Jordan, 2002): https://papers.nips.cc/paper_files/paper/2001/hash/7b7a53e239400a13bd6be6c91c4f6c4e-Abstract.html
- On Discriminative vs Generative Classifiers: https://ai.stanford.edu/~ang/papers/nips01-discriminativegenerative.pdf""",

    "ensemble": """# 集成学习

## 学习定位

集成学习是ML竞赛的"核武器"——通过组合多个弱学习器获得强学习器。从Random Forest到XGBoost，集成方法统治了结构化数据的比赛排行榜。

## 为什么集成有效？

$$\\text{集成误差} = \\text{平均偏差} - \\text{平均方差}$$

### 偏差-方差-协方差分解

$$\\mathbb{E}[(f_{ens} - y)^2] = \\overline{\\text{Bias}}^2 + \\frac{1}{M}\\overline{\\text{Var}} + \\left(1 - \\frac{1}{M}\\right)\\overline{\\text{Cov}}$$

关键洞察：集成通过**平均**降低方差，同时通过**多样性**避免协方差过高。

## Bagging (Bootstrap Aggregating)

### 核心机制

1. 从原始数据Bootstrap采样生成 $M$ 个训练集
2. 在每个训练集上独立训练基学习器
3. 分类投票，回归平均

$$\\hat{f}_{bag}(x) = \\frac{1}{M}\\sum_{m=1}^M \\hat{f}_m(x)$$

### Bootstrap 采样

每次从原始数据集 $D$ 中有放回地抽取 $n$ 个样本：

$$P(\\text{样本被选中}) = 1 - \\left(1 - \\frac{1}{n}\\right)^n \\approx 1 - e^{-1} \\approx 63.2\\%$$

每个基学习器使用约63.2%的样本训练，剩余36.8%留作OOB验证。

## 随机森林

### 双重随机性

1. **样本随机**：每个树用Bootstrap采样训练
2. **特征随机**：每次分裂时从随机子集中选最佳特征

$$\\text{随机森林预测: } \\hat{y} = \\text{mode}\\{\\hat{y}_1, \\hat{y}_2, ..., \\hat{y}_M\\}$$

### OOB (Out-of-Bag) 误差

**OOB误差**是随机森林独有的免费验证机制——无需单独的验证集。

$$\\text{OOB Error} = \\frac{1}{n}\\sum_{i=1}^n L\\left(y_i, \\hat{f}_{OOB}(x_i)\\right)$$

其中 $\\hat{f}_{OOB}(x_i)$ 是仅使用那些**未包含**样本 $i$ 的树的平均预测。

**OOB 误差的优势：**
- **无需划分验证集** — 充分利用全部训练数据
- **无偏估计** — 与交叉验证的估计结果高度一致
- **自动计算** — `RandomForestClassifier(oob_score=True)` 即可
- **特征选择** — 可计算 OOB 的特征重要性

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)

# 启用 OOB 评分
rf = RandomForestClassifier(
    n_estimators=200,
    oob_score=True,        # 开启OOB
    random_state=42,
    n_jobs=-1
)
rf.fit(X, y)

print(f"OOB Score: {rf.oob_score_:.4f}")
print(f"(这个分数近似于测试集准确率，无需划分验证集)")
```

## Boosting

### 核心思想

与Bagging的并行训练不同，Boosting**串行**训练：每个新学习器重点关注前一个学习器的错误。

$$\\hat{F}_m(x) = \\hat{F}_{m-1}(x) + \\nu \\cdot h_m(x)$$

其中 $\\nu$ 是学习率 (shrinkage)，$h_m(x)$ 是第 $m$ 轮的基学习器。

### Bagging vs Boosting 对比

| 维度 | Bagging (如Random Forest) | Boosting (如XGBoost) |
|------|--------------------------|---------------------|
| 训练方式 | 并行 | 串行 |
| 关注点 | 方差（通过平均降低） | 偏差（逐步纠正错误） |
| 基学习器 | 强学习器（深树） | 弱学习器（浅树） |
| 鲁棒性 | 对噪声和异常值鲁棒 | 可能过拟合噪声 |
| 训练速度 | 可并行加速 | 难以并行 |
| 超参数敏感度 | 较低 | 较高 |
| 典型表现 | 基准好，不易翻车 | 调优后通常更优 |

## XGBoost

### 目标函数

XGBoost的目标函数不仅包含损失项，还包含正则化项：

$$\\mathcal{L}(\\phi) = \\sum_i l(\\hat{y}_i, y_i) + \\sum_k \\Omega(f_k)$$

其中正则化项：

$$\\Omega(f) = \\gamma T + \\frac{1}{2}\\lambda \\|w\\|^2$$

- $T$：叶节点数量
- $w$：叶节点权重
- $\\gamma, \\lambda$：正则化系数

### XGBoost 关键超参数调优表

| 参数 | 含义 | 默认值 | 搜索范围 | 效果 |
|------|------|--------|---------|------|
| `n_estimators` | 树的数量(迭代轮数) | 100 | [50, 100, 200, 500, 1000] | 越大模型越复杂，配合早停使用 |
| `learning_rate` | 学习率 / shrinkage | 0.3 | [0.01, 0.05, 0.1, 0.2, 0.3] | 越小需要越多树，但泛化更好 |
| `max_depth` | 树的最大深度 | 6 | [3, 4, 5, 6, 7, 8, 10] | 控制每棵树的复杂度 |
| `subsample` | 每棵树用的样本比例 | 1.0 | [0.6, 0.7, 0.8, 0.9, 1.0] | <1可防过拟合，类似Bagging |
| `colsample_bytree` | 每棵树用的特征比例 | 1.0 | [0.6, 0.7, 0.8, 0.9, 1.0] | <1增加随机性，防过拟合 |
| `colsample_bylevel` | 每层用的特征比例 | 1.0 | [0.6, 0.7, 0.8, 0.9, 1.0] | 进一步增加随机性 |
| `min_child_weight` | 叶节点最小样本权重和 | 1 | [1, 3, 5, 7, 10] | 越大越保守，防过拟合 |
| `gamma` | 分裂所需最小损失下降 | 0 | [0, 0.1, 0.2, 0.5, 1.0] | 越大剪枝越多 |
| `reg_alpha` | L1正则化 | 0 | [0, 0.01, 0.1, 1.0] | 高维稀疏特征时有用 |
| `reg_lambda` | L2正则化 | 1 | [0.1, 1.0, 10, 100] | 防止过拟合 |

### 调参策略（从粗到细）

```python
# 调参顺序建议:
# Step 1: n_estimators + learning_rate (粗调)
# Step 2: max_depth + min_child_weight
# Step 3: subsample + colsample_bytree
# Step 4: gamma + reg_alpha/reg_lambda (细调)
```

### XGBoost 完整代码 + 交叉验证

```python
import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import classification_report, roc_auc_score
from xgboost import XGBClassifier

# 加载数据
data = load_breast_cancer()
X_train, X_test, y_train, y_test = train_test_split(
    data.data, data.target, test_size=0.3, random_state=42
)

# 初始模型
xgb = XGBClassifier(
    n_estimators=100,
    learning_rate=0.1,
    max_depth=5,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    eval_metric='logloss',
    use_label_encoder=False
)

# 交叉验证基线
cv_scores = cross_val_score(xgb, X_train, y_train, cv=5, scoring='accuracy')
print(f"Baseline CV: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

# 带早停的训练 (需要验证集)
X_tr, X_val, y_tr, y_val = train_test_split(
    X_train, y_train, test_size=0.2, random_state=42
)

xgb_es = XGBClassifier(
    n_estimators=1000,  # 设大一些，用早停截断
    learning_rate=0.05,
    max_depth=5,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    eval_metric='logloss',
    early_stopping_rounds=20  # 20轮不提升就停
)
xgb_es.fit(
    X_tr, y_tr,
    eval_set=[(X_val, y_val)],
    verbose=False
)

print(f"Early stopping at n_estimators={xgb_es.best_iteration}")
print(f"Best score: {xgb_es.best_score:.4f}")

# 网格搜索最佳超参数
param_grid = {
    'max_depth': [3, 5, 7],
    'learning_rate': [0.01, 0.05, 0.1],
    'subsample': [0.7, 0.8, 1.0],
    'colsample_bytree': [0.7, 0.8, 1.0],
}
grid = GridSearchCV(
    XGBClassifier(n_estimators=200, random_state=42,
                  eval_metric='logloss', use_label_encoder=False),
    param_grid, cv=5, scoring='accuracy', n_jobs=-1, verbose=1
)
grid.fit(X_train, y_train)

print(f"\\nBest params: {grid.best_params_}")
print(f"Best CV score: {grid.best_score_:.4f}")

# 最终评估
best_model = grid.best_estimator_
y_pred = best_model.predict(X_test)
y_prob = best_model.predict_proba(X_test)[:, 1]

print(f"Test accuracy: {best_model.score(X_test, y_test):.4f}")
print(f"Test ROC AUC: {roc_auc_score(y_test, y_prob):.4f}")
print(f"\\n{classification_report(y_test, y_pred, target_names=data.target_names)}")

# 特征重要性
importances = best_model.feature_importances_
indices = np.argsort(importances)[-10:][::-1]
print("\\nTop 10 特征重要性:")
for i, idx in enumerate(indices):
    print(f"  {i+1:2d}. {data.feature_names[idx]:25s} {importances[idx]:.4f}")
```

## LightGBM vs XGBoost

### 速度对比

LightGBM 相比 XGBoost 的核心优化：

| 优化项 | XGBoost | LightGBM |
|--------|---------|----------|
| 树生长策略 | Level-wise (按层生长) | Leaf-wise (按叶生长) |
| 分裂算法 | Pre-sorted / Approximate | GOSS + EFB |
| 类别特征 | 需手动One-Hot编码 | 原生支持 `categorical_feature` |
| 内存占用 | 较高 (8B×样本×特征) | 较低 (Histogram直方图) |
| 训练速度 | 基准 | 通常快2~10倍 |
| 精度 | 基准 | 多数情况相当 |

### 核心区别

| 维度 | XGBoost | LightGBM |
|------|---------|----------|
| 分裂策略 | 按层 (Level-wise) | 按叶 (Leaf-wise) |
| 数据抽样 | 均匀采样 | GOSS (基于梯度的单边采样) |
| 特征捆绑 | 无 | EFB (互斥特征捆绑) |
| 直方图 | 需显式启用 | 默认 |
| 并行方式 | 特征并行 | 特征 + 数据并行 |
| 适用数据量 | 中小规模 | 大规模数据 |
| 类别特征 | 不支持 | 原生支持 |
| 过拟合风险 | 较低 | Leaf-wise 下较高，需调 `num_leaves` |

### 速度对比代码

```python
import time
import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import cross_val_score

# 生成较大数据集
X, y = make_classification(
    n_samples=20000, n_features=100,
    n_informative=50, random_state=42
)

# XGBoost 计时
try:
    from xgboost import XGBClassifier
    t0 = time.time()
    xgb = XGBClassifier(
        n_estimators=100, max_depth=6, learning_rate=0.1,
        use_label_encoder=False, eval_metric='logloss',
        random_state=42
    )
    xgb_cv = cross_val_score(xgb, X, y, cv=5, n_jobs=-1)
    t_xgb = time.time() - t0
    print(f"XGBoost:  acc={xgb_cv.mean():.4f}, time={t_xgb:.2f}s")
except ImportError:
    print("XGBoost not installed")

# LightGBM 计时
try:
    from lightgbm import LGBMClassifier
    t0 = time.time()
    lgb = LGBMClassifier(
        n_estimators=100, max_depth=6, learning_rate=0.1,
        random_state=42, verbose=-1
    )
    lgb_cv = cross_val_score(lgb, X, y, cv=5, n_jobs=-1)
    t_lgb = time.time() - t0
    print(f"LightGBM: acc={lgb_cv.mean():.4f}, time={t_lgb:.2f}s")
except ImportError:
    print("LightGBM not installed")

# 结果对比
try:
    speedup = t_xgb / t_lgb
    print(f"\\nLightGBM 比 XGBoost 快 {speedup:.1f}x")
    print(f"精度差异: {abs(xgb_cv.mean() - lgb_cv.mean()):.4f}")
except Exception:
    pass
```

## Stacking

### 核心思想

Stacking 用元学习器组合多个基学习器的输出：

$$\\hat{y}_{stack} = g(\\hat{y}_1, \\hat{y}_2, ..., \\hat{y}_M)$$

```python
from sklearn.ensemble import StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

# 多模型Stacking
base_learners = [
    ('rf', RandomForestClassifier(n_estimators=100, random_state=42)),
    ('xgb', XGBClassifier(n_estimators=100, random_state=42,
                          eval_metric='logloss', use_label_encoder=False)),
    ('svc', SVC(kernel='rbf', probability=True, random_state=42)),
]

stack = StackingClassifier(
    estimators=base_learners,
    final_estimator=LogisticRegression(max_iter=1000),
    cv=5,  # 用交叉验证生成元特征
    stack_method='predict_proba'  # 使用概率而非硬标签
)

stack.fit(X_train, y_train)
print(f"Stacking test accuracy: {stack.score(X_test, y_test):.4f}")
```

## 延伸参考

- 《机器学习》(西瓜书) 第8章 — 集成学习系统论述
- 《统计学习方法》第8章 — Boosting 数学推导
- XGBoost 论文 (Chen & Guestrin, 2016): https://arxiv.org/abs/1603.02754
- LightGBM 论文 (Ke et al., 2017): https://papers.nips.cc/paper_files/paper/2017/hash/6449f44a102fde848669bdd9eb6b76fa-Abstract.html
- scikit-learn Ensemble 文档: https://scikit-learn.org/stable/modules/ensemble.html
- XGBoost 官方文档: https://xgboost.readthedocs.io/
- LightGBM 官方文档: https://lightgbm.readthedocs.io/
- CatBoost 官方文档: https://catboost.ai/
- Ensemble Methods: Foundations and Algorithms (Zhou, 2012)""",
}

# ── Enrich function ───────────────────────────────

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
            if slug not in ENRICHED:
                print(f"WARN: No enriched content for slug='{slug}'")
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

            chapter.markdown = ENRICHED[slug]
            print(f"Updated: {chapter.chapter_number}. {chapter.title} ({slug})")

        await db.commit()
        print(f"\\nOK: {len(SLUGS)} chapters enriched")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(enrich())
