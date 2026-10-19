import type { Experiment } from "../types";

export const beginnerExperiments: Experiment[] = [
    {
      name: "从零实现线性回归",
      difficulty: "beginner",
      data: "California Housing 房价数据",
      tools: ["NumPy", "Pandas", "Matplotlib", "Scikit-learn（仅用于对比）"],
      skills: ["梯度下降", "损失函数设计", "向量化计算", "模型评估"],
      goal: "从零实现线性回归的梯度下降优化过程，理解参数更新与收敛机制，对比自实现与 sklearn 的结果差异",
      estimated_time: "2-3小时",
      deliverables: "一个完整的 Jupyter Notebook，包含自实现线性回归类、损失曲线可视化、与 sklearn 的对比分析报告",

      data_source: "sklearn.datasets.fetch_california_housing() —— 加州房价数据，20640条记录，8个特征",      steps: [
        "步骤1：加载 California Housing 数据集，查看数据维度和特征含义",
        "步骤2：选择 'MedInc'（收入中位数）作为特征 X，房价作为目标 y，用 plt.scatter 画散点图",
        "步骤3：对 X 做标准化（减均值除以标准差），让梯度下降更快收敛",
        "步骤4：手写梯度下降——初始化 w=0, b=0，学习率=0.01，迭代500次，每步计算 MSE 损失和梯度，记录损失值",
        "步骤5：绘制损失曲线（plt.plot），观察损失是否持续下降",
        "步骤6：用 sklearn 的 LinearRegression 训练并对比 w 和 b 的差异"
      ],
      code: `# 从零实现线性回归
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import fetch_california_housing
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

# 1. 加载数据
data = fetch_california_housing()
X = data.data[:, 0:1]  # MedInc 特征
y = data.target         # 房价（单位：10万美元）
print(f"数据维度: {X.shape}, 标签范围: {y.min():.2f} ~ {y.max():.2f}")

# 2. 标准化
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# 3. 手写梯度下降
w, b = 0.0, 0.0
lr, epochs = 0.01, 500
n = len(y)
losses = []
for _ in range(epochs):
    y_pred = w * X_scaled.ravel() + b
    loss = np.mean((y_pred - y) ** 2)  # MSE
    losses.append(loss)
    dw = (2/n) * np.sum((y_pred - y) * X_scaled.ravel())
    db = (2/n) * np.sum(y_pred - y)
    w -= lr * dw
    b -= lr * db

print(f"手写模型: w={w:.4f}, b={b:.4f}, 最终损失={losses[-1]:.4f}")

# 4. 损失曲线
plt.plot(losses)
plt.xlabel('迭代次数'); plt.ylabel('MSE 损失')
plt.title('梯度下降收敛过程'); plt.show()

# 5. 与 sklearn 对比
lr_sk = LinearRegression().fit(X_scaled, y)
print(f"sklearn: w={lr_sk.coef_[0]:.4f}, b={lr_sk.intercept_:.4f}")

# 6. 可视化拟合线
plt.scatter(X_scaled, y, alpha=0.3, s=5)
plt.plot(X_scaled, w * X_scaled.ravel() + b, 'r-', lw=2, label='手写')
plt.legend(); plt.show()`,
      expected_output: "损失曲线从约 1.3 持续下降到约 0.5，手写模型 w≈0.8, b≈2.0，与 sklearn 的 w 和 b 基本一致（误差 < 1%），拟合线穿过散点中心区域。",
      reflection: [
        "学习率 0.001 vs 0.01 vs 0.1 时，损失曲线分别是什么形态？哪个最好？",
        "如果把迭代次数从 500 改成 5000，损失能继续下降多少？为什么？",
        "不使用标准化，直接用原始数据训练，梯度下降会怎样？（试试看！）"
      ],
    },
    {
      name: "Pandas 数据探索与可视化实战",
      difficulty: "beginner",
      data: "Seaborn 内置 Titanic 数据集",
      tools: ["Pandas", "Matplotlib", "Seaborn"],
      skills: ["描述性统计", "缺失值检测", "分组聚合", "可视化叙事"],
      goal: "掌握 Pandas 数据探索完整流程，能独立完成数据清洗、统计描述和可视化报告",
      estimated_time: "2-3小时",
      deliverables: "EDA 分析报告 Notebook，包含数据质量评估、8+图表和初步洞察",

      download_url: "https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv",
      data_source: "seaborn.load_dataset('titanic') —— 泰坦尼克号乘客数据，891条记录",      steps: [
        "步骤1：用 seaborn.load_dataset('titanic') 加载数据，查看 shape 和前10行",
        "步骤2：df.info() 和 df.describe() 快速了解数据类型、缺失情况、数值分布",
        "步骤3：用 df.isnull().sum() 统计缺失值，对年龄用中位数填充，对登船港口用众数填充",
        "步骤4：分组聚合——按性别(pclass)和船舱等级(sex)分组，计算平均生存率",
        "步骤5：可视化——sns.countplot 看生存分布，sns.boxplot 看年龄-生存关系，sns.heatmap 看相关性矩阵"
      ],
      code: `import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# 1. 加载数据
df = sns.load_dataset('titanic')
print(f"数据维度: {df.shape}")
print(df.head())

# 2. 快速检视
print(df.info())
print(df.describe())

# 3. 缺失值处理
print(f"\\n缺失值:\\n{df.isnull().sum()}")
df['age'].fillna(df['age'].median(), inplace=True)
df['embarked'].fillna(df['embarked'].mode()[0], inplace=True)

# 4. 分组聚合: 按性别+船舱看生存率
print(df.groupby(['sex', 'pclass'])['survived'].mean().unstack())

# 5. 可视化
fig, axes = plt.subplots(2, 2, figsize=(12, 9))
sns.countplot(data=df, x='survived', ax=axes[0,0])
sns.countplot(data=df, x='pclass', hue='survived', ax=axes[0,1])
sns.boxplot(data=df, x='survived', y='age', ax=axes[1,0])
sns.heatmap(df.select_dtypes(include='number').corr(), annot=True, cmap='coolwarm', ax=axes[1,1])
plt.tight_layout(); plt.show()`,
      expected_output: "缺失值统计显示年龄缺失177个、船舱缺失687个、登船港缺失2个。女性生存率(74%)远高于男性(19%)，一等舱生存率(63%)高于三等舱(24%)。年龄与生存关系不大。",
      reflection: [
        "一等舱的生存率为什么比三等舱高那么多？这和「女士和儿童优先」的救援规则有关吗？",
        "船舱(Cabin)缺失率高达77%，这个特征还有用吗？你会怎么处理它？",
        "如果让你预测一个20岁、三等舱、女性的生存概率，你估计大概是多少？"
      ],
    },
    {
      name: "KNN 手写数字分类器",
      difficulty: "beginner",
      data: "MNIST 手写数字数据集（取前2000个样本）",
      tools: ["NumPy", "Scikit-learn", "Matplotlib"],
      skills: ["K近邻算法", "距离度量", "交叉验证", "混淆矩阵"],
      goal: "理解 KNN 的非参数分类原理，实验不同 K 值和距离度量对分类效果的影响",
      estimated_time: "1.5-2小时",
      deliverables: "KNN 分类器代码，K值-准确率曲线图，混淆矩阵分析报告",

      data_source: "sklearn.datasets.load_digits() —— MNIST手写数字，1797条记录，8×8像素",      steps: [
        "步骤1：从 sklearn.datasets 加载 MNIST 子集(2000样本)，用 plt.imshow 查看前10个数字",
        "步骤2：划分训练集(80%)和测试集(20%)，用 StandardScaler 标准化",
        "步骤3：训练 KNN (K=3)，输出准确率",
        "步骤4：用 confusion_matrix 和 ConfusionMatrixDisplay 可视化混淆矩阵",
        "步骤5：循环 K=1,3,5,7,9，记录每个 K 的准确率，绘制 K值-准确率曲线"
      ],
      code: `from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, ConfusionMatrixDisplay
import matplotlib.pyplot as plt

# 1. 加载数据
digits = load_digits(n_class=10)
X, y = digits.data[:2000], digits.target[:2000]
print(f"数据维度: {X.shape}")
# 可视化前10个数字
fig, axes = plt.subplots(2, 5, figsize=(10, 4))
for i, ax in enumerate(axes.flat):
    ax.imshow(digits.images[i], cmap='gray')
    ax.set_title(f'标签: {digits.target[i]}'); ax.axis('off')
plt.show()

# 2. 划分+标准化
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

# 3. KNN (K=3)
knn = KNeighborsClassifier(n_neighbors=3).fit(X_train_s, y_train)
y_pred = knn.predict(X_test_s)
print(f"K=3 准确率: {accuracy_score(y_test, y_pred):.3f}")

# 4. 混淆矩阵
ConfusionMatrixDisplay.from_predictions(y_test, y_pred); plt.show()

# 5. 不同K值对比
ks, scores = [], []
for k in [1, 3, 5, 7, 9, 11]:
    knn = KNeighborsClassifier(n_neighbors=k).fit(X_train_s, y_train)
    scores.append(accuracy_score(y_test, knn.predict(X_test_s)))
    ks.append(k)
plt.plot(ks, scores, 'bo-'); plt.xlabel('K值'); plt.ylabel('准确率')
plt.title('K值对KNN准确率的影响'); plt.show()`,
      expected_output: "K=3时准确率约95%。混淆矩阵显示对角线颜色最深（预测正确）。K=3到7时准确率最高且稳定，K=1时略低（过拟合），K>9后开始下降。",
      reflection: [
        "K=1 和 K=9 的结果有何不同？哪个更好？为什么？",
        "如果不做 StandardScaler 标准化，准确率会降低多少？试试看！",
        "KNN 适合处理大规模数据吗？如果训练数据有 100 万条，每次预测要计算多少次距离？"
      ],
    },
    {
      name: "训练集与测试集划分实践",
      difficulty: "beginner",
      data: "Scikit-learn 内置乳腺癌数据集",
      tools: ["Scikit-learn", "Pandas", "NumPy", "Matplotlib"],
      skills: ["数据划分策略", "过拟合检测", "标准化", "基线模型建立"],
      goal: "掌握 train/val/test 划分原则、数据标准化和基线模型构建，理解过拟合与欠拟合的直观表现",
      estimated_time: "1.5-2小时",
      deliverables: "包含3种划分比例对比的 Notebook，学习曲线图，训练集/测试集性能差异分析",

      download_url: "https://archive.ics.uci.edu/ml/machine-learning-databases/breast-cancer-wisconsin/wdbc.data",
      data_source: "sklearn.datasets.load_breast_cancer() —— 乳腺癌诊断数据，569条记录，30个特征",      steps: [
        "步骤1：加载 breast_cancer 数据集，了解 30 个特征和 2 个类别",
        "步骤2：用 train_test_split 划分 (70/30)，设置 stratify=y 保持类别比例",
        "步骤3：用 StandardScaler 标准化，训练决策树(max_depth=3)",
        "步骤4：分别在训练集和测试集上评估准确率，对比差异",
        "步骤5：用 cross_val_score 做5折交叉验证，对比单次划分 vs 交叉验证的结果"
      ],
      code: `from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score

# 1. 加载数据
X, y = load_breast_cancer(return_X_y=True)
print(f"特征数: {X.shape[1]}, 样本数: {X.shape[0]}")

# 2. 划分 (70/30, 分层)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, stratify=y, random_state=42)
print(f"训练集: {X_train.shape}, 测试集: {X_test.shape}")

# 3. 标准化 + 训练
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)
clf = DecisionTreeClassifier(max_depth=3, random_state=42).fit(X_train_s, y_train)

# 4. 评估
train_acc = accuracy_score(y_train, clf.predict(X_train_s))
test_acc = accuracy_score(y_test, clf.predict(X_test_s))
print(f"训练集准确率: {train_acc:.3f}")
print(f"测试集准确率: {test_acc:.3f}")
print(f"差异: {train_acc - test_acc:.3f}")

# 5. 交叉验证
scores = cross_val_score(clf, scaler.fit_transform(X), y, cv=5)
print(f"5折交叉验证: {scores}")
print(f"平均: {scores.mean():.3f} ± {scores.std():.3f}")`,
      expected_output: "训练集准确率约 97%，测试集约 92%，差异约 5%（轻微过拟合）。5折交叉验证均值约 93%，比单次划分更稳定。",
      reflection: [
        "训练集准确率比测试集高 5%，这是正常还是过拟合？如果高 20% 呢？",
        "为什么用 stratify=y？不用会怎样？",
        "交叉验证的 5 折结果（如 91%,94%,93%,92%,95%），你更相信哪个数字？"
      ],
    },
    {
      name: "NumPy 向量化运算与矩阵操作",
      difficulty: "beginner",
      data: "随机生成的模拟数据",
      tools: ["NumPy", "Matplotlib"],
      skills: ["广播机制", "向量化思维", "矩阵分解", "随机数生成"],
      goal: "掌握 NumPy 的广播机制和向量化编程，能高效完成数组变换和矩阵运算",
      estimated_time: "2-3小时",
      deliverables: "10道 NumPy 向量化练习题与解答，性能对比基准测试，矩阵操作速查笔记",

      data_source: "numpy.random.randn() —— 随机生成模拟数据，无需外部下载",      steps: [
        "步骤1：创建 3×3 随机矩阵和 3×1 列向量，测试 @、dot、* 三种运算的区别",
        "步骤2：用 np.random.randn 生成 100 万行×5 列的数据，尝试广播：每列减列均值",
        "步骤3：对比向量化 (X @ w) 和 for 循环的性能差异，用 time.time() 计时",
        "步骤4：用 np.linalg.inv 求矩阵逆，用 np.linalg.eig 求特征值特征向量",
        "步骤5：用 NumPy 手写一个简单的线性回归拟合 y=Xw，对比 np.linalg.lstsq 的结果"
      ],
      code: `import numpy as np
import time

# 1. 矩阵运算区别
A = np.random.randn(3, 3)
b = np.random.randn(3, 1)
print(f"A @ b 矩阵乘法:\\n{A @ b}")
print(f"A * b 逐元素:\\n{A * b.T}")  # 注意：b需要转置

# 2. 广播
X = np.random.randn(1_000_000, 5)
mean = X.mean(axis=0)                # (5,)
X_centered = X - mean                # (1000000,5)-(5,) → 广播！
print(f"广播成功: {X_centered.shape}")

# 3. 性能对比
w = np.random.randn(5)
start = time.time()
r_vec = X @ w
vec_time = time.time() - start
start = time.time()
r_loop = np.array([X[i] @ w for i in range(10000)])
loop_time = time.time() - start
print(f"向量化: {vec_time:.4f}s (全部), for循环: {loop_time:.4f}s (仅10000行)")

# 4. 特征分解
M = np.array([[2, 1], [1, 2]])
vals, vecs = np.linalg.eig(M)
print(f"特征值: {vals}, 特征向量:\\n{vecs}")

# 5. NumPy手写线性回归
np.random.seed(42)
X = np.random.randn(100, 3)
y = 2*X[:,0] + 3*X[:,1] - X[:,2] + np.random.randn(100)*0.1
w_np = np.linalg.inv(X.T @ X) @ X.T @ y
print(f"NumPy最小二乘: w={w_np}")`,
      expected_output: "向量化处理 100 万行只需 ~0.01 秒，for 循环 1 万行就需要 ~0.5 秒——向量化快了约 5000 倍。广播机制让 X_centered 的 shape 正确变为 (1000000, 5)。特征值 3 和 1，特征向量正交。手写最小二乘结果与真实值 [2, 3, -1] 非常接近。",
      reflection: [
        "向量化为什么比 for 循环快这么多？这和 CPU 的 SIMD 指令有什么关系？",
        "X @ w 和 X.dot(w) 和 np.dot(X, w) 有什么区别？",
        "如果 X 的形状是 (100, 3)，w 的形状是 (3,)，X @ w 的结果形状是什么？"
      ],
    },
  ];
