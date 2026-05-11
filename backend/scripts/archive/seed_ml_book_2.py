"""Seed ML book chapters 4-16 in batch.
Run: cd backend && python3 scripts/seed_ml_book_2.py
"""
import asyncio, json, os, sys
sys.path.insert(0, ".")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

def j(v): return json.dumps(v, ensure_ascii=False)

CH = [
    dict(slug="linear-models", chapter_number=4, title="线性模型：回归与分类",
        summary="从最简单的线性回归开始理解模型三组件：假设函数、损失函数、优化算法。延伸到逻辑回归和多分类。",
        difficulty="beginner", estimated_minutes=40,
        markdown="""# 线性模型：回归与分类

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

## 逻辑回归

在线性组合外套Sigmoid函数，将输出压缩到(0,1)表示概率：

$$P(y=1|\\mathbf{x}) = \\sigma(\\mathbf{w}^\\top\\mathbf{x}) = \\frac{1}{1+e^{-\\mathbf{w}^\\top\\mathbf{x}}}$$

损失函数用**交叉熵**（不用MSE，因Sigmoid+MSE会导致梯度消失）：

$$L = -\\frac{1}{n}\\sum [y_i\\log\\hat{y}_i + (1-y_i)\\log(1-\\hat{y}_i)]$$

### 正则化

| 类型 | 效果 | 场景 |
|------|------|------|
| L1 (Lasso) | 部分权重->0，自动特征选择 | 特征很多但大部分没用 |
| L2 (Ridge) | 所有权重变小但不为0 | 所有特征都有作用 |

```python
from sklearn.linear_model import LogisticRegression
model = LogisticRegression(penalty='l2', C=1.0, max_iter=1000)
model.fit(X_train, y_train)
# 调整决策阈值
y_prob = model.predict_proba(X_test)[:, 1]
y_pred = (y_prob >= 0.5).astype(int)
```

## 线性模型 vs 非线性模型

| 维度 | 线性模型 | 非线性模型 |
|------|----------|------------|
| 表达能力 | 线性边界 | 任意复杂函数 |
| 可解释性 | 高(权重=重要性) | 低(黑盒) |
| 训练速度 | 快 | 慢 |
| 数据需求 | 少 | 多 |

> 始终先跑一个线性模型作为基线！""",
        goals=["手写MSE梯度更新公式","解释为什么逻辑回归用Sigmoid+交叉熵","理解正则化作用"],
        checklist=["能用NumPy实现线性回归梯度下降","能用scikit-learn训练两种模型","能解释权重含义"],
        experiments=[{"title":"线性模型对比","goal":"比较L1/L2正则化下的模型表现","steps":["加载California Housing","对比LinearRegression/Ridge/Lasso","分析特征权重"],"output":"正则化对比报告","difficulty":"beginner"}],
        glossary=[{"term":"线性回归","definition":"假设输出是输入线性组合的回归模型"},{"term":"Sigmoid","definition":"sigma(z)=1/(1+e^-z)，将实数映射到概率"},{"term":"交叉熵","definition":"衡量两个概率分布差异的损失"}],
        references=[{"title":"西瓜书第3章","source":"周志华","url":"https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"},{"title":"scikit-learn线性模型","source":"scikit-learn.org","url":"https://scikit-learn.org/stable/modules/linear_model.html"}],
        prerequisites=["introduction","math-foundations"], keywords=["线性回归","逻辑回归","Sigmoid","正则化","L1","L2"],
        quiz=[{"question":"为什么逻辑回归不用MSE？","options":["MSE太慢","Sigmoid+MSE导致梯度消失","只适用于回归","需要更多数据"],"correctIndex":1,"explanation":"Sigmoid在0/1附近梯度趋近于0，配合MSE导致梯度消失。"}],
        sort_order=4, enabled=True),

    dict(slug="decision-trees", chapter_number=5, title="决策树与K近邻",
        summary="决策树的分裂准则与剪枝策略，KNN的惰性学习思想。两种完全不同的学习哲学对比。",
        difficulty="intermediate", estimated_minutes=35,
        markdown="""# 决策树与K近邻

## 决策树

### 核心思想

通过反复选择最优特征分裂数据，直到子节点纯度足够高。

### 分裂准则

| 准则 | 公式 | 特点 |
|------|------|------|
| 信息增益 | Gain=H(D)-sum(H(D_v))| 偏好取值多的特征 |
| 增益率 | Gain/IV | C4.5使用，修正偏好 |
| 基尼指数 | 1-sum(p_k^2) | CART使用，scikit-learn默认 |

```python
from sklearn.tree import DecisionTreeClassifier, plot_tree
tree = DecisionTreeClassifier(max_depth=3, min_samples_split=10)
tree.fit(X_train, y_train)
plot_tree(tree, feature_names=names, filled=True)
```

### 剪枝

- **预剪枝**：限制max_depth, min_samples_split等
- **后剪枝**：先充分生长再自下而上剪枝

## K近邻 (KNN)

> 告诉我你的K个邻居是谁，我就能预测你是什么。

KNN不做训练，预测时找最近的K个邻居投票。

### 距离度量

| 距离 | 公式 | 适用 |
|------|------|------|
| 欧氏 | sqrt(sum((x_i-y_i)^2)) | 连续特征默认 |
| 曼哈顿 | sum(|x_i-y_i|) | 高维空间更鲁棒 |
| 余弦 | x.y/(||x|| ||y||) | 文本/稀疏向量 |

```python
from sklearn.neighbors import KNeighborsClassifier
knn = KNeighborsClassifier(n_neighbors=5, weights='distance')
knn.fit(X_train, y_train)
```

### 决策树 vs KNN vs 线性模型

| 维度 | 决策树 | KNN | 线性模型 |
|------|--------|-----|----------|
| 可解释性 | 高 | 低 | 高 |
| 需标准化 | 否 | **是** | 是 |
| 非线性 | 是 | 是 | 否 |
| 训练速度 | 快 | 无训练 | 快 |""",
        goals=["理解决策树分裂准则","掌握剪枝策略","理解KNN距离和K值选择"],
        checklist=["能画出简单决策树结构","能解释KNN为什么必须先标准化","能说出CART默认用哪个分裂准则"],
        experiments=[{"title":"决策树可视化","goal":"训练决策树并可视化其结构","steps":["Iris数据训练","画出完整树结构","分析特征重要性"],"output":"决策树结构图","difficulty":"beginner"}],
        glossary=[{"term":"信息熵","definition":"H=-sum(p_k*log p_k)，度量集合纯度"},{"term":"剪枝","definition":"主动减少分支防止过拟合"},{"term":"KNN","definition":"K近邻，惰性学习，预测时找最近邻居投票"}],
        references=[{"title":"西瓜书第4章","source":"周志华","url":"https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"}],
        prerequisites=["introduction","model-evaluation"], keywords=["决策树","KNN","信息增益","基尼指数","剪枝"],
        sort_order=5, enabled=True),

    dict(slug="svm", chapter_number=6, title="支持向量机",
        summary="最大化间隔的核心思想、软间隔与惩罚系数C、核技巧与高维映射。",
        difficulty="intermediate", estimated_minutes=40,
        markdown="""# 支持向量机

## 核心思想

SVM找一个超平面将不同类别点分开，并使**间隔最大化**。

$$\\min_{\\mathbf{w},b}\\frac{1}{2}||\\mathbf{w}||^2 \\quad s.t.\\ y_i(\\mathbf{w}^\\top\\mathbf{x}_i+b)\\ge 1$$

### 核技巧

当数据线性不可分时，用核函数映射到高维空间：

| 核 | 公式 | 场景 |
|----|------|------|
| 线性 | $K(x,z)=x^\\top z$ | 线性可分 |
| 多项式 | $(x^\\top z+c)^d$ | 有交互特征 |
| RBF | $\\exp(-\\gamma||x-z||^2)$ | 大部分非线性任务 |

### 软间隔

允许少量样本在间隔内或错分。

- C大：不允许犯错，容易过拟合
- C小：允许犯错，间隔更大，更鲁棒

```python
from sklearn.svm import SVC
svm = SVC(kernel='rbf', C=1.0, gamma='scale')
svm.fit(X_train, y_train)
```

### 核心参数

| 参数 | 含义 | 调参方向 |
|------|------|----------|
| C | 惩罚系数 | 大->更拟合训练集，小->更泛化 |
| gamma | RBF核宽度 | 大->每个点影响范围小，容易过拟合 |
| kernel | 核函数类型 | 先试RBF，再试linear |

## 优缺点

| 优点 | 缺点 |
|------|------|
| 在高维空间有效 | 大数据集训练慢 O(n^2) |
| 核技巧灵活 | 参数和核选择敏感 |
| 间隔最大化->泛化好 | 不直接输出概率 |""",
        goals=["理解最大间隔原理","掌握核技巧","区分硬间隔和软间隔"],
        checklist=["能解释SVC三个关键参数","能判断何时用线性核vs RBF核","能说出gamma的含义"],
        experiments=[{"title":"SVM核函数对比","goal":"比较不同核在非线性数据上的决策边界","steps":["生成moons/circles数据","对比linear/rbf/poly核","画决策边界"],"output":"核函数决策边界对比图","difficulty":"intermediate"}],
        glossary=[{"term":"支持向量","definition":"最靠近决策边界的训练样本"},{"term":"核技巧","definition":"通过核函数隐式计算高维内积"},{"term":"软间隔","definition":"允许少量样本在间隔内或错分"}],
        references=[{"title":"西瓜书第6章","source":"周志华","url":"https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"}],
        prerequisites=["linear-models","math-foundations"], keywords=["SVM","核技巧","RBF","软间隔"],
        sort_order=6, enabled=True),

    dict(slug="bayesian", chapter_number=7, title="贝叶斯分类器",
        summary="贝叶斯决策论、朴素贝叶斯的条件独立假设、三种变体(Gaussian/Multinomial/Bernoulli)与文本分类实战。",
        difficulty="intermediate", estimated_minutes=40,
        markdown="""# 贝叶斯分类器

## 贝叶斯决策论

$$P(c|\\mathbf{x}) = \\frac{P(\\mathbf{x}|c)P(c)}{P(\\mathbf{x})}$$

- $P(c)$: 先验——看到证据前对类别c的信念
- $P(\\mathbf{x}|c)$: 似然——如果属于c，观察到x的概率
- $P(c|\\mathbf{x})$: 后验——看到x后更新信念

## 朴素贝叶斯

核心假设：给定类别，所有特征条件独立。

$$P(c|\\mathbf{x}) \\propto P(c)\\prod_{i=1}^d P(x_i|c)$$

这个假设现实中几乎永远不成立，但朴素贝叶斯在很多任务上依然表现良好！

### 三种变体

| 变体 | 假设 | 适用特征 |
|------|------|----------|
| GaussianNB | 高斯分布 | 连续特征 |
| MultinomialNB | 多项式分布 | 词频/计数 |
| BernoulliNB | 伯努利分布 | 二元特征 |

```python
from sklearn.naive_bayes import GaussianNB, MultinomialNB
# 连续特征
gnb = GaussianNB().fit(X_train, y_train)
# 文本分类（经典场景）
mnb = MultinomialNB().fit(X_train_tfidf, y_train)
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 训练极快 | 条件独立假设太强 |
| 高维数据表现好 | 概率估计不一定校准 |
| 增量学习友好 | 特征相关性敏感 |

> 朴素贝叶斯是**文本分类**（垃圾邮件过滤、新闻分类）的经典起点。""",
        goals=["理解贝叶斯定理在分类中的应用","区分三种朴素贝叶斯变体"],
        checklist=["能推导朴素贝叶斯决策公式","能解释条件独立假设","能说出三种变体的适用场景"],
        glossary=[{"term":"先验","definition":"看到特征前的初始信念P(c)"},{"term":"后验","definition":"观察特征后更新的信念P(c|x)"}],
        references=[{"title":"西瓜书第7章","source":"周志华","url":"https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"}],
        prerequisites=["linear-models","math-foundations"], keywords=["贝叶斯","朴素贝叶斯","先验","后验","文本分类"],
        sort_order=7, enabled=True),

    dict(slug="ensemble", chapter_number=8, title="集成学习",
        summary="Bagging/Boosting/Stacking三大范式。理解为什么随机森林不易过拟合，XGBoost为何是竞赛利器。",
        difficulty="intermediate", estimated_minutes=45,
        markdown="""# 集成学习

## 核心哲学

> 三个臭皮匠，顶个诸葛亮。

### 三大范式

| 范式 | 训练方式 | 降低 | 代表 |
|------|----------|------|------|
| Bagging | 并行训练 | 方差 | 随机森林 |
| Boosting | 顺序训练 | 偏差 | XGBoost, LightGBM |
| Stacking | 分层组合 | 两者 | 竞赛集成 |

## Bagging: 随机森林

并行训练多棵树，每棵树用不同Bootstrap样本。为什么不过拟合？

1. **方差降低**: 平均操作减小方差
2. **特征随机子集**: 每分裂只看部分特征，增加多样性
3. **增加树不导致过拟合**: 但深度会

## Boosting: XGBoost

顺序训练，每个后续模型关注前面犯错的样本：

$$F_m(x) = F_{m-1}(x) + \\nu \\cdot h_m(x)$$

```python
import xgboost as xgb
model = xgb.XGBClassifier(n_estimators=100, max_depth=5, learning_rate=0.1)
model.fit(X_train, y_train)
print(f"特征重要性: {model.feature_importances_}")
```

### Boosting三剑客

| 框架 | 核心优化 | 特点 |
|------|----------|------|
| XGBoost | 二阶Taylor + 正则化 | 竞赛标配 |
| LightGBM | 直方图 + GOSS | 比XGBoost更快 |
| CatBoost | 有序Boosting | 类别特征最强 |

## 集成方法选择

| 场景 | 推荐 |
|------|------|
| 通用表格数据 | XGBoost/LightGBM |
| 需要可解释性 | 随机森林(特征重要性清晰) |
| 顶级竞赛 | Stacking多模型组合 |
| 有大量类别特征 | CatBoost |

> 经验法则：表格数据先跑XGBoost/LightGBM作为基线。""",
        goals=["区分Bagging/Boosting/Stacking","理解随机森林为何不易过拟合","掌握XGBoost关键超参数"],
        checklist=["能说出自助采样法原理","能解释Boosting为什么顺序训练","能列出三种Boosting框架区别"],
        experiments=[{"title":"集成方法大比拼","goal":"在多个数据集比较RF/GBDT/XGBoost","steps":["选择2-3个分类数据集","比较train/test表现差异","调参优化最佳模型"],"output":"集成方法对比报告","difficulty":"intermediate"}],
        glossary=[{"term":"Bagging","definition":"Bootstrap抽样并行训练，投票/平均"},{"term":"Boosting","definition":"顺序训练，关注前面犯错样本"},{"term":"Stacking","definition":"用元模型组合异构基模型"}],
        references=[{"title":"西瓜书第8章","source":"周志华","url":"https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"},{"title":"XGBoost论文","source":"Chen & Guestrin 2016","url":"https://arxiv.org/abs/1603.02754"}],
        prerequisites=["decision-trees","model-evaluation"], keywords=["集成学习","Bagging","Boosting","随机森林","XGBoost"],
        sort_order=8, enabled=True),

    dict(slug="neural-networks", chapter_number=9, title="神经网络基础",
        summary="从感知机到MLP，理解前向传播、反向传播、激活函数(ReLU/GELU/Sigmoid)和训练策略。",
        difficulty="intermediate", estimated_minutes=45,
        markdown="""# 神经网络基础

## 从感知机到多层网络

感知机能解决AND/OR，但无法解决XOR——这直接推动了多层网络的发展。

$$\\mathbf{h} = \\sigma(\\mathbf{W}^{(1)}\\mathbf{x}+\\mathbf{b}^{(1)})$$
$$\\hat{\\mathbf{y}} = \\text{softmax}(\\mathbf{W}^{(2)}\\mathbf{h}+\\mathbf{b}^{(2)})$$

## 激活函数

| 函数 | 公式 | 特点 |
|------|------|------|
| Sigmoid | $1/(1+e^{-z})$ | 历史遗留，梯度消失 |
| Tanh | $(e^z-e^{-z})/(e^z+e^{-z})$ | 零中心，比Sigmoid好 |
| ReLU | $\\max(0,z)$ | **默认选择**，计算快 |
| GELU | $z\\cdot\\Phi(z)$ | Transformer标配 |

> 必须用非线性激活，否则多层线性=单层线性。

## PyTorch训练循环

```python
import torch, torch.nn as nn
model = nn.Sequential(
    nn.Linear(784, 256), nn.ReLU(), nn.Dropout(0.2),
    nn.Linear(256, 128), nn.ReLU(), nn.Dropout(0.2),
    nn.Linear(128, 10)
)
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.CrossEntropyLoss()

for epoch in range(10):
    for Xb, yb in train_loader:
        loss = criterion(model(Xb), yb)
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
```

## 训练策略

| 技巧 | 作用 |
|------|------|
| BatchNorm | 加速训练，减少初始化敏感度 |
| Dropout | 随机丢弃神经元防过拟合 |
| 学习率调度 | 训练过程中逐渐减小lr |
| Early Stopping | 验证loss不再下降时停止 |""",
        goals=["理解MLP前向/反向传播","区分激活函数","掌握PyTorch训练循环"],
        checklist=["能手写MLP前向传播公式","能解释ReLU优于Sigmoid的原因","能写出PyTorch训练循环"],
        experiments=[{"title":"MNIST手写数字识别","goal":"用PyTorch实现MNIST分类器","steps":["定义MLP网络","实现训练循环","对比激活函数效果"],"output":"MNIST分类器(准确率~98%)","difficulty":"intermediate"}],
        glossary=[{"term":"前向传播","definition":"输入逐层计算得到输出"},{"term":"反向传播","definition":"链式法则计算损失对每层参数梯度"},{"term":"ReLU","definition":"max(0,z)，最常用的激活函数"}],
        references=[{"title":"《深度学习》第6章","source":"Goodfellow","url":"https://www.deeplearningbook.org/"},{"title":"d2l.ai MLP章节","source":"李沐","url":"https://d2l.ai/chapter_multilayer-perceptrons/index.html"}],
        prerequisites=["math-foundations","linear-models"], keywords=["神经网络","MLP","ReLU","反向传播","PyTorch"],
        sort_order=9, enabled=True),

    dict(slug="cnn-rnn", chapter_number=10, title="CNN与RNN",
        summary="CNN的空间特征提取（卷积/池化/残差连接）和RNN的序列建模（隐藏状态/LSTM门控）。",
        difficulty="advanced", estimated_minutes=50,
        markdown="""# CNN与RNN

## CNN: 卷积神经网络

### 为什么需要CNN

全连接处理224x224x3图像 -> 第一层就有38.5M参数！

CNN的两大法宝：
1. **局部连接**: 每个神经元只看一小块
2. **权重共享**: 同一卷积核在整个图像滑动

### 核心组件

| 组件 | 作用 |
|------|------|
| Conv2d | 提取局部特征 |
| MaxPool2d | 降分辨率，增加平移不变性 |
| BatchNorm2d | 稳定训练 |

### 经典架构

| 架构 | 年份 | 关键创新 |
|------|------|----------|
| LeNet-5 | 1998 | 首次实用CNN |
| AlexNet | 2012 | ReLU+Dropout+GPU |
| VGG | 2014 | 全部3x3小卷积 |
| ResNet | 2015 | 残差连接 -> 可堆100+层 |

## RNN: 循环神经网络

$$\\mathbf{h}_t = \\tanh(\\mathbf{W}_{xh}\\mathbf{x}_t + \\mathbf{W}_{hh}\\mathbf{h}_{t-1})$$

### LSTM门控机制

| 门 | 作用 |
|----|------|
| 遗忘门 | 决定丢弃哪些旧信息 |
| 输入门 | 决定存储哪些新信息 |
| 输出门 | 决定输出哪些信息 |

### CNN vs RNN vs Transformer

| 维度 | CNN | RNN | Transformer |
|------|-----|-----|-------------|
| 计算 | 并行 | 顺序 | 并行(但O(n^2)) |
| 长距离依赖 | 有限 | 弱 | 强 |
| 主要应用 | 图像 | 被Transformer替代 | NLP/多模态 |""",
        goals=["理解CNN局部连接和权重共享","理解LSTM门控机制","说明CNN/RNN/Transformer适用场景"],
        checklist=["能画出卷积运算示意图","能解释LSTM三个门各自作用","能说明ResNet为什么可堆100+层"],
        experiments=[{"title":"CIFAR-10图像分类","goal":"用PyTorch CNN分类CIFAR-10","steps":["实现基本CNN","添加数据增强","添加残差连接"],"output":"准确率>85%的CNN","difficulty":"advanced"}],
        glossary=[{"term":"卷积核","definition":"滑动权重矩阵，检测特定模式"},{"term":"LSTM","definition":"长短期记忆，通过门控处理长序列"},{"term":"残差连接","definition":"输入直接加到输出，解决深层退化"}],
        references=[{"title":"d2l.ai CNN","source":"李沐","url":"https://d2l.ai/chapter_convolutional-neural-networks/index.html"},{"title":"ResNet论文","source":"He et al.2015","url":"https://arxiv.org/abs/1512.03385"}],
        prerequisites=["neural-networks"], keywords=["CNN","RNN","LSTM","卷积","ResNet"],
        sort_order=10, enabled=True),

    dict(slug="transformers", chapter_number=11, title="Transformer与注意力机制",
        summary="理解自注意力如何取代RNN成为序列建模标准。Scaled Dot-Product Attention、多头注意力、位置编码。",
        difficulty="advanced", estimated_minutes=50,
        markdown="""# Transformer与注意力机制

## 自注意力 (Self-Attention)

Transformer核心创新：序列中每个位置都能**直接**关注所有其他位置。

$$\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V$$

### 计算步骤

1. 输入生成Q(Query)、K(Key)、V(Value)
2. 计算注意力分数: $QK^\\top/\\sqrt{d_k}$（除$\\sqrt{d_k}$防点积过大）
3. Softmax归一化
4. 加权求和: Attn x V

### 多头注意力

并行学习h种不同注意力模式：

$$\\text{MultiHead} = \\text{Concat}(\\text{head}_1,\\dots,\\text{head}_h)\\mathbf{W}^O$$

```python
import torch.nn as nn
attn = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)
output, weights = attn(query, key, value)
```

### Transformer架构

| 组件 | 编码器 | 解码器 |
|------|--------|--------|
| 自注意力 | 双向 | 因果掩码 |
| 交叉注意力 | — | 关注编码器输出 |
| 前馈网络 | 两层MLP | 同 |
| 残差+LayerNorm | 每个子层后 | 同 |

### 从BERT到GPT

| 模型 | 年份 | 关键创新 |
|------|------|----------|
| BERT | 2018 | 双向编码器，MLM预训练 |
| GPT-3 | 2020 | 175B参数，上下文学习emergent |
| GPT-4 | 2023 | 多模态，高级推理 |""",
        goals=["理解Scaled Dot-Product Attention","解释多头注意力的作用","说出BERT与GPT核心区别"],
        checklist=["能手写Attention公式","能解释/√d_k的作用","能区分编码器和解码器注意力"],
        glossary=[{"term":"自注意力","definition":"序列每个位置关注所有其他位置"},{"term":"多头注意力","definition":"并行学习多种注意力模式"},{"term":"位置编码","definition":"注入位置信息使Transformer感知序列顺序"}],
        references=[{"title":"Attention Is All You Need","source":"Vaswani et al.2017","url":"https://arxiv.org/abs/1706.03762"},{"title":"The Illustrated Transformer","source":"Jay Alammar","url":"https://jalammar.github.io/illustrated-transformer/"}],
        prerequisites=["neural-networks","cnn-rnn"], keywords=["Transformer","自注意力","多头注意力","BERT","GPT"],
        sort_order=11, enabled=True),

    dict(slug="clustering", chapter_number=12, title="聚类分析",
        summary="K-Means迭代优化、肘部法则与轮廓系数、DBSCAN密度聚类、层次聚类。",
        difficulty="advanced", estimated_minutes=40,
        markdown="""# 聚类分析

## K-Means

最小化簇内平方和：

$$\\arg\\min_S \\sum_{i=1}^k \\sum_{\\mathbf{x}\\in S_i} ||\\mathbf{x}-\\boldsymbol{\\mu}_i||^2$$

算法流程: 初始化中心 -> 分配样本 -> 更新中心 -> 重复。

```python
from sklearn.cluster import KMeans
kmeans = KMeans(n_clusters=3, n_init=10, random_state=42)
labels = kmeans.fit_predict(X)
```

### 如何选K

| 方法 | 思路 |
|------|------|
| 肘部法则 | 画inertia vs k，找拐点 |
| 轮廓系数 | $s = (b-a)/\\max(a,b)$，越接近1越好 |

## DBSCAN

基于密度，无需预设簇数：

- 核心点: 邻域足够多样本
- 边界点/噪声点: 自动识别

| K-Means | DBSCAN |
|---------|--------|
| 需指定k | 自动发现簇数 |
| 球形簇 | 任意形状簇 |
| 对异常值敏感 | 鲁棒 |
| 大规模快 | 高维慢 |""",
        goals=["掌握K-Means算法流程","理解肘部法则和轮廓系数","区分K-Means和DBSCAN场景"],
        checklist=["能手写K-Means简单实现","能用肘部法则选K","能解释DBSCAN的eps和min_samples"],
        glossary=[{"term":"K-Means","definition":"迭代最小化簇内平方和的聚类算法"},{"term":"轮廓系数","definition":"衡量聚类质量=簇内紧密度/簇间分离度"},{"term":"DBSCAN","definition":"基于密度的聚类，自动发现任意形状簇"}],
        references=[{"title":"西瓜书第9章","source":"周志华","url":"https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"}],
        prerequisites=["math-foundations","model-evaluation"], keywords=["聚类","K-Means","DBSCAN","轮廓系数"],
        sort_order=12, enabled=True),

    dict(slug="dimensionality-reduction", chapter_number=13, title="降维与特征选择",
        summary="PCA主成分分析、t-SNE可视化、特征选择的过滤法/包裹法/嵌入法。",
        difficulty="advanced", estimated_minutes=40,
        markdown="""# 降维与特征选择

## PCA主成分分析

通过线性投影将数据映射到低维空间，使投影后方差最大化。

步骤: 中心化 -> 协方差矩阵 -> 特征分解 -> 取前k特征向量。

```python
from sklearn.decomposition import PCA
pca = PCA(n_components=2)
X_pca = pca.fit_transform(X)
print(f"保留方差: {pca.explained_variance_ratio_.sum():.2%}")
```

## t-SNE vs PCA

| 维度 | PCA | t-SNE |
|------|-----|-------|
| 目标 | 保留全局方差 | 保留局部相似性 |
| 线性 | 是 | 否 |
| 预处理 | 可 | 不可(不能应用到新数据) |
| 用途 | 降维/去噪 | **可视化** |

## 特征选择

| 方法 | 代表 |
|------|------|
| 过滤法 | 方差阈值、互信息、卡方 |
| 包裹法 | RFE递归消除 |
| 嵌入法 | L1正则、树模型特征重要性 |

> 先跑带L1的逻辑回归或XGBoost看特征重要性，去掉完全不重要的特征。""",
        goals=["理解PCA方差最大化原理","区分PCA和t-SNE用途","掌握三种特征选择策略"],
        checklist=["能手写PCA的NumPy实现","能解释t-SNE不能用于预处理的原因","能说出过滤/包裹/嵌入的区别"],
        glossary=[{"term":"PCA","definition":"主成分分析，线性投影保留方差最大"},{"term":"t-SNE","definition":"非线性降维，保持局部结构，适合可视化"},{"term":"特征选择","definition":"去除不相关或冗余特征降低复杂度"}],
        references=[{"title":"西瓜书第10-11章","source":"周志华","url":"https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"}],
        prerequisites=["math-foundations","clustering"], keywords=["PCA","t-SNE","降维","特征选择"],
        sort_order=13, enabled=True),

    dict(slug="generative-models", chapter_number=14, title="生成模型：GAN、VAE与扩散模型",
        summary="三大生成范式：GAN的对抗博弈、VAE的变分推断、扩散模型的逐步去噪。",
        difficulty="advanced", estimated_minutes=50,
        markdown="""# 生成模型

## 判别 vs 生成

| 维度 | 判别模型 | 生成模型 |
|------|----------|----------|
| 学习 | P(y|x)，决策边界 | P(x) 或 P(x,y)，数据分布 |
| 典型方法 | 逻辑回归,CNN | GAN,VAE,Diffusion |

## GAN

生成器和判别器互相博弈：
- G: 随机噪声 -> 伪造样本
- D: 判断样本真/假

$$\\min_G\\max_D \\mathbb{E}[\\log D(x)]+\\mathbb{E}[\\log(1-D(G(z)))]$$

## VAE

编码器学习 $q(z|x)$，解码器学习 $p(x|z)$。
损失 = 重建损失 + KL散度正则化。

## 扩散模型

前向: 逐步加噪至纯噪声
反向: 神经网络学习从噪声恢复数据

| 维度 | GAN | VAE | 扩散 |
|------|-----|-----|------|
| 训练难度 | 高 | 低 | 中 |
| 生成质量 | 高 | 中 | **最高** |
| 生成速度 | **极快** | 快 | 慢(多步) |
| 多样性 | 低(模式崩塌) | 高 | 高 |""",
        goals=["区分判别与生成模型","理解GAN对抗训练","解释扩散模型前向/反向过程"],
        checklist=["能画出GAN架构图","能解释VAE为什么用KL散度","能说为什么扩散质量最高但生成最慢"],
        glossary=[{"term":"GAN","definition":"生成对抗网络，生成器判别器博弈"},{"term":"VAE","definition":"变分自编码器，编码为概率分布再解码"},{"term":"扩散模型","definition":"学习从噪声逐步恢复数据"}],
        references=[{"title":"GAN论文","source":"Goodfellow 2014","url":"https://arxiv.org/abs/1406.2661"},{"title":"DDPM","source":"Ho et al.2020","url":"https://arxiv.org/abs/2006.11239"}],
        prerequisites=["neural-networks"], keywords=["GAN","VAE","扩散模型","StableDiffusion"],
        sort_order=14, enabled=True),

    dict(slug="reinforcement-learning", chapter_number=15, title="强化学习入门",
        summary="MDP五元组、Q-Learning更新公式、策略梯度、Actor-Critic与PPO。",
        difficulty="expert", estimated_minutes=50,
        markdown="""# 强化学习入门

## MDP马尔可夫决策过程

五元组$(S,A,P,R,\\gamma)$：
- S: 状态空间, A: 动作空间
- P: 状态转移概率, R: 即时奖励
- gamma: 折扣因子

## Q-Learning

$$Q(s,a) \\leftarrow Q(s,a) + \\alpha[r + \\gamma\\max_{a'}Q(s',a') - Q(s,a)]$$

## 策略梯度

直接学习策略$\\pi_\\theta(a|s)$：

$$\\nabla_\\theta J = \\mathbb{E}[\\sum_t \\nabla_\\theta\\log\\pi_\\theta(a_t|s_t)R(\\tau)]$$

## RL方法对比

| 方法 | 类型 | 代表 |
|------|------|------|
| Q-Learning | 基于价值 | DQN |
| Policy Gradient | 基于策略 | REINFORCE |
| Actor-Critic | 两者结合 | A2C, PPO |

> PPO是目前最广泛使用的RL算法(OpenAI提出)。""",
        goals=["理解MDP五元组","掌握Q-Learning更新公式","区分基于价值和基于策略方法"],
        checklist=["能说明马尔可夫性质","能手写Q-Learning公式","能解释PPO为什么限制策略更新"],
        glossary=[{"term":"MDP","definition":"马尔可夫决策过程，RL数框架"},{"term":"Q-Learning","definition":"学习状态-动作价值函数的无模型RL"},{"term":"PPO","definition":"近端策略优化，最广泛使用的RL算法"}],
        references=[{"title":"西瓜书第16章","source":"周志华","url":"https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"}],
        prerequisites=["math-foundations","neural-networks"], keywords=["强化学习","MDP","Q-Learning","策略梯度","PPO"],
        sort_order=15, enabled=True),

    dict(slug="ml-in-practice", chapter_number=16, title="实战：MLOps、部署与作品集",
        summary="将ML从Notebook推进到可维护系统。MLOps流程、模型部署策略、FastAPI服务、项目作品集结构。",
        difficulty="expert", estimated_minutes=50,
        markdown="""# 实战：MLOps、部署与作品集

## MLOps核心流程

```
数据收集 -> 数据验证 -> 特征工程 -> 模型训练 ->
模型验证 -> 模型部署 -> 模型监控 -> 回到数据收集
```

### 关键组件

| 阶段 | 工具 | 实践 |
|------|------|------|
| 实验管理 | MLflow, W&B | 记录超参、指标、artifact |
| 数据版本 | DVC | 数据可追溯可复现 |
| 模型注册 | MLflow Registry | 版本和stage管理 |
| 模型服务 | FastAPI, BentoML | REST/gRPC接口 |
| 监控 | Evidently | 数据漂移、模型漂移 |

## 模型部署策略

| 策略 | 风险 |
|------|------|
| 一次性切换 | 高 |
| 影子部署 | 无 |
| 金丝雀部署 | 低 |
| A/B测试 | 低 |

## FastAPI最小部署

```python
from fastapi import FastAPI
import joblib

app = FastAPI()
model = joblib.load("model.pkl")

@app.post("/predict")
def predict(features: list[float]):
    pred = model.predict([features])
    return {"prediction": pred.tolist()}

# uvicorn main:app --host 0.0.0.0 --port 8000
```

## 作品集结构

一个优秀ML项目应包含：
1. README.md — 问题定义、数据说明、技术栈、结果摘要
2. EDA Notebook — 数据探索可视化
3. 实验记录 — 不同方案和指标对比
4. 最终方案 — 清晰代码，可复现pipeline
5. 限制与反思 — 痛点、改进方向

> 优秀的ML工程师不只是会调参，而是能有条理地说服别人这个方案值得信任。

## 学习路径终点

完成16章后，你应能：
- 独立完成端到端ML项目
- 为有/无标签数据选择合适算法
- 评估模型可靠性
- 将模型部署为可调用服务

下一步：选一个感兴趣的真实问题，1-2周走完从数据到部署的完整流程。""",
        goals=["理解MLOps核心流程","掌握模型部署基本策略","知道如何构建ML作品集"],
        checklist=["能画出完整MLOps流程图","能写FastAPI模型服务最小代码","能列出项目README的6个部分"],
        glossary=[{"term":"MLOps","definition":"机器学习运维，将模型工程化部署和监控"},{"term":"A/B测试","definition":"流量分配给不同模型版本比较效果"},{"term":"数据漂移","definition":"线上数据分布变化导致模型效果下降"}],
        references=[{"title":"MLflow","source":"mlflow.org","url":"https://mlflow.org"},{"title":"FastAPI","source":"fastapi.tiangolo.com","url":"https://fastapi.tiangolo.com"}],
        prerequisites=["model-evaluation","neural-networks"], keywords=["MLOps","部署","FastAPI","Docker","A/B测试"],
        sort_order=16, enabled=True),
]

async def seed():
    engine = create_async_engine(os.environ["DATABASE_URL"])
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one_or_none()
        if not book:
            print("ERROR: Run seed_ml_book.py first to create the book!")
            return
        book_id = book.id

        for ch in CH:
            r2 = await db.execute(select(MLBookChapter).where(
                MLBookChapter.book_id == book_id, MLBookChapter.slug == ch["slug"]
            ))
            existing = r2.scalar_one_or_none()
            payload = {k:v for k,v in ch.items() if k!="slug"}
            for jf in ("goals","checklist","experiments","glossary","references","prerequisites","keywords","quiz"):
                if jf in payload: payload[jf] = j(payload[jf])
            if existing:
                for k,v in payload.items(): setattr(existing, k, v)
            else:
                db.add(MLBookChapter(book_id=book_id, slug=ch["slug"], **payload))

        await db.commit()
        print(f"OK: {len(CH)} chapters seeded")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
