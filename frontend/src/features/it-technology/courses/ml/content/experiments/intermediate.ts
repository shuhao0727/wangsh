import type { Experiment } from "../types";

export const intermediateExperiments: Experiment[] = [
    {
      name: "逻辑回归分类与决策边界可视化",
      difficulty: "intermediate",
      data: "sklearn 乳腺癌诊断数据集",
      tools: ["Scikit-learn", "Pandas", "Matplotlib", "Seaborn"],
      skills: ["逻辑回归", "正则化调参", "决策边界", "ROC-AUC 评估"],
      goal: "掌握逻辑回归从线性到概率的完整推导，可视化正则化参数对决策边界的影响，理解分类阈值与业务指标的关系",
      estimated_time: "3-4小时",
      deliverables: "逻辑回归建模全流程 Notebook，包含 L1/L2 正则化效果对比、ROC 曲线与 PR 曲线、最优阈值选择分析",
      download_url: "https://archive.ics.uci.edu/ml/machine-learning-databases/breast-cancer-wisconsin/wdbc.data",
      data_source: "sklearn.datasets.load_breast_cancer() —— 569条记录，30个特征，二分类（恶性/良性）",
      steps: [
        "加载 breast_cancer 数据，用 df.describe() 查看各特征统计量，检查是否有缺失值",
        "用 StandardScaler 标准化全部 30 个特征",
        "用 PCA 降到 2 维（仅用于可视化），在 2D 平面上画散点图观察两类分布",
        "训练 LogisticRegression（默认 L2 正则化，C=1.0），输出分类报告和混淆矩阵",
        "对比不同 C 值（0.01, 0.1, 1, 10, 100）对准确率和决策边界的影响",
        "绘制 ROC 曲线并计算 AUC，理解分类阈值如何影响精确率和召回率"
      ],
      code: `from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, roc_curve, auc, RocCurveDisplay
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# 1. 加载数据
X, y = load_breast_cancer(return_X_y=True)
print(f"样本数: {X.shape[0]}, 特征数: {X.shape[1]}")
print(f"类别分布: {np.bincount(y)}")

# 2. 标准化 + 划分
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.3, stratify=y, random_state=42)

# 3. PCA 降维可视化
pca = PCA(n_components=2).fit(X_scaled)
X2d = pca.transform(X_scaled)
plt.figure(figsize=(8, 5))
scatter = plt.scatter(X2d[:, 0], X2d[:, 1], c=y, cmap='coolwarm', alpha=0.6, s=15)
plt.colorbar(scatter, label='类别 (0=恶性, 1=良性)')
plt.title(f'PCA 降维 (解释方差: {pca.explained_variance_ratio_.sum():.1%})')
plt.show()

# 4. 逻辑回归 + 评估
lr = LogisticRegression(C=1.0, max_iter=1000).fit(X_train, y_train)
y_pred = lr.predict(X_test)
print(classification_report(y_test, y_pred, target_names=['恶性', '良性']))

# 5. 不同 C 值对比
for C in [0.01, 0.1, 1, 10, 100]:
    acc = cross_val_score(LogisticRegression(C=C, max_iter=1000), X_scaled, y, cv=5).mean()
    print(f"C={C:6.2f} → 5折CV准确率: {acc:.4f}")

# 6. ROC 曲线
y_score = lr.predict_proba(X_test)[:, 1]
RocCurveDisplay.from_predictions(y_test, y_score)
plt.title(f'ROC 曲线 (AUC={auc(y_test, y_score):.3f})')
plt.show()`,
      expected_output: "默认参数下准确率约 96-98%。PCA 可视化中两类数据有清晰分界。C=1 和 C=10 效果相近，C 太小（0.01）正则化过强导致欠拟合，C 太大（100）几乎无正则化。ROC-AUC > 0.99，说明模型分辨能力极强。",
      reflection: [
        "C=0.01 和 C=100 的准确率差异大吗？什么时候需要强正则化？",
        "ROC 曲线越靠近左上角越好——如果 AUC=0.5 意味着什么？",
        "为什么先用 PCA 降维再画散点图？PCA 维度对分类效果有影响吗？"
      ],
    },
    {
      name: "K-Means 客户分群与用户画像",
      difficulty: "intermediate",
      data: "Mall Customer Segmentation 数据（200条）",
      tools: ["Scikit-learn", "Pandas", "Matplotlib", "Seaborn"],
      skills: ["K-Means 聚类", "肘部法则", "轮廓系数", "用户画像构建"],
      goal: "掌握 K-Means 聚类原理与最佳 K 值选择方法，能对真实业务数据完成聚类分群并生成可解释的用户画像",
      estimated_time: "3-4小时",
      deliverables: "聚类分析 Notebook，包含肘部法则图、轮廓系数分析、PCA 降维可视化、每类用户的特征画像描述",
      download_url: "https://raw.githubusercontent.com/SteffiPeTaffy/machineLearningAZ/master/Mall_Customers.csv",
      data_source: "Mall Customers 数据集（可用 pd.read_csv 加载），200条记录，5个特征：CustomerID, Gender, Age, Annual Income (k$), Spending Score (1-100)",
      steps: [
        "用 pandas 读取 Mall_Customers.csv（可从 GitHub 直接下载），查看 head() 和 describe()",
        "选择 Age、Annual Income、Spending Score 三个特征，用 StandardScaler 标准化",
        "用肘部法则（Elbow Method）测试 K=1 到 K=10，计算每个 K 的 inertia_，画折线图找拐点",
        "选择最佳 K 值（约 5），训练 KMeans，用 silhouette_score 验证聚类质量",
        "用 PCA 降维到 2 维可视化聚类结果，每个簇用不同颜色标记",
        "分析每个簇的平均年龄、收入和消费分，给每个簇起一个名字（如「高收入高消费」「年轻节俭族」等）"
      ],
      code: `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

# 1. 加载数据
url = "https://raw.githubusercontent.com/SteffiPeTaffy/machineLearningAZ/master/Mall_Customers.csv"
df = pd.read_csv(url)
print(df.head())
print(df.describe())

# 2. 选择特征 + 标准化
features = ['Age', 'Annual Income (k$)', 'Spending Score (1-100)']
X = df[features].values
X_scaled = StandardScaler().fit_transform(X)
print(f"数据维度: {X_scaled.shape}")

# 3. 肘部法则
inertias = []
ks = range(1, 11)
for k in ks:
    inertias.append(KMeans(n_clusters=k, random_state=42, n_init=10).fit(X_scaled).inertia_)
plt.plot(ks, inertias, 'bo-')
plt.xlabel('K 值'); plt.ylabel('Inertia (簇内平方和)')
plt.title('肘部法则 — 找最佳 K 值'); plt.show()

# 4. KMeans 聚类
k_best = 5
km = KMeans(n_clusters=k_best, random_state=42, n_init=10).fit(X_scaled)
labels = km.labels_
print(f"轮廓系数: {silhouette_score(X_scaled, labels):.3f}")

# 5. PCA 可视化
X2d = PCA(n_components=2).fit_transform(X_scaled)
plt.figure(figsize=(8, 6))
scatter = plt.scatter(X2d[:, 0], X2d[:, 1], c=labels, cmap='viridis', s=40, alpha=0.8)
plt.colorbar(scatter, label='簇编号')
plt.title(f'K-Means 聚类结果 (K={k_best})'); plt.show()

# 6. 用户画像
df['Cluster'] = labels
for i in range(k_best):
    cluster = df[df['Cluster'] == i]
    print(f"\\n簇 {i} ({len(cluster)}人):")
    print(f"  平均年龄: {cluster['Age'].mean():.0f}, 平均收入: {cluster['Annual Income (k$)'].mean():.0f}k, 平均消费分: {cluster['Spending Score (1-100)'].mean():.0f}")`,
      expected_output: "肘部法则图在 K=5 左右出现明显拐点。轮廓系数约 0.4-0.5。5 个簇对应典型的用户画像：高收入高消费（VIP）、高收入低消费（潜力客户）、中等收入中等消费（大众）、低收入高消费（冲动型）、低收入低消费（节俭型）。",
      reflection: [
        "肘部法则的拐点不明显怎么办？还有什么其他方法可以选 K 值？",
        "如果把 Spending Score 去掉，只用 Age 和 Income 聚类，结果有什么不同？",
        "K-Means 假设簇是球形的——这个假设在实际数据中总是成立吗？DBSCAN 会不会更合适？"
      ],
    },
    {
      name: "决策树可视化与模型解释",
      difficulty: "intermediate",
      data: "sklearn 红酒分类数据集 (Wine)",
      tools: ["Scikit-learn", "Matplotlib", "Pandas", "NumPy"],
      skills: ["决策树构建", "剪枝策略", "特征重要性", "决策路径追踪"],
      goal: "深入理解决策树的分裂准则与剪枝原理，能可视化树结构并解释单个样本的决策路径",
      estimated_time: "2-3小时",
      deliverables: "决策树可视化报告，包含树结构图、特征重要性排序、过拟合与剪枝效果对比、单样本决策路径解释",
      download_url: "https://archive.ics.uci.edu/ml/machine-learning-databases/wine/wine.data",
      data_source: "sklearn.datasets.load_wine() —— 178条记录，13个化学特征，3种葡萄酒类别",
      steps: [
        "加载 Wine 数据集（3种葡萄酒），用 df.describe() 和 corr() 初步了解数据",
        "划分训练集(70%)和测试集(30%)，训练一棵 max_depth=3 的决策树",
        "用 sklearn.tree.plot_tree 画出完整树结构，标注每个节点的分裂特征和基尼系数",
        "查看 feature_importances_，用柱状图展示各特征对分类的贡献",
        "对比不同 max_depth (1, 3, 5, 10, None) 下的训练集和测试集准确率，观察过拟合"
      ],
      code: `from sklearn.datasets import load_wine
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.metrics import accuracy_score
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

# 1. 加载数据
data = load_wine()
X, y = data.data, data.target
print(f"特征: {data.feature_names}")
print(f"类别: {data.target_names}")
print(f"样本数: {X.shape[0]}, 特征数: {X.shape[1]}")

# 2. 划分 + 训练
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
clf = DecisionTreeClassifier(max_depth=3, random_state=42).fit(X_train, y_train)
print(f"max_depth=3 准确率: 训练集 {accuracy_score(y_train, clf.predict(X_train)):.3f}, 测试集 {accuracy_score(y_test, clf.predict(X_test)):.3f}")

# 3. 可视化决策树
plt.figure(figsize=(16, 8))
plot_tree(clf, feature_names=data.feature_names, class_names=data.target_names.tolist(), filled=True, rounded=True, fontsize=9)
plt.title('Wine 数据集决策树 (max_depth=3)')
plt.show()

# 4. 特征重要性
imp = pd.Series(clf.feature_importances_, index=data.feature_names).sort_values()
imp.plot(kind='barh', color='steelblue')
plt.title('特征重要性'); plt.xlabel('Gini Importance'); plt.show()

# 5. 深度对比
depths = [1, 3, 5, 10, None]
for d in depths:
    c = DecisionTreeClassifier(max_depth=d, random_state=42).fit(X_train, y_train)
    tr = accuracy_score(y_train, c.predict(X_train))
    te = accuracy_score(y_test, c.predict(X_test))
    label = f"max_depth={d}" if d else "max_depth=∞"
    print(f"{label:15s} 训练: {tr:.3f}  测试: {te:.3f}  {'⚠ 过拟合' if tr - te > 0.1 else '✓'}")`,
      expected_output: "max_depth=3 时准确率约 92%，树结构清晰可读。特征重要性最高的是 proline（脯氨酸）和 color_intensity（颜色强度）。max_depth=∞ 时训练集准确率 100% 但测试集反而下降（过拟合）。max_depth=3 能很好地平衡可解释性和泛化能力。",
      reflection: [
        "为什么 max_depth=∞ 时训练准确率 100% 反而是坏事？这和「背答案不会解题」有什么相似之处？",
        "Gini Importance 高的特征一定最重要吗？如果一个特征和其他特征高度相关会怎样？",
        "如果数据有缺失值，决策树还能用吗？怎么处理？"
      ],
    },
    {
      name: "PCA 降维与高维数据可视化",
      difficulty: "intermediate",
      data: "sklearn 手写数字数据集 (Digits, 64维)",
      tools: ["Scikit-learn", "NumPy", "Matplotlib"],
      skills: ["PCA 降维", "方差解释率", "特征值分解", "数据去噪"],
      goal: "掌握 PCA 的数学原理与实现，理解方差保留与维度压缩的权衡，能将高维数据降至2-3维进行可视化分析",
      estimated_time: "2-3小时",
      deliverables: "PCA 降维实验 Notebook，包含累积方差解释率图、2D/3D 降维可视化、原始特征与主成分的载荷矩阵分析",
      data_source: "sklearn.datasets.load_digits() —— 1797条手写数字，每条 8×8=64 维像素特征，10个类别",
      steps: [
        "加载 load_digits 数据（64维像素），用 plt.imshow 查看前几个数字的原始图像",
        "用 StandardScaler 标准化 64 维数据，注意每个像素是一个特征",
        "用 PCA(n_components=2) 降维，在 2D 平面上画散点图，按数字类别着色——观察不同数字在降维空间中的分布",
        "保留所有 64 个主成分，画累积方差解释率曲线——看前几个主成分解释了大部分方差",
        "选取前 20 个主成分重构图像，与原图对比，理解「降维→重构」的信息损失"
      ],
      code: `from sklearn.datasets import load_digits
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import numpy as np

# 1. 加载 64 维手写数字
digits = load_digits()
X, y = digits.data, digits.target
print(f"数据维度: {X.shape} ({X.shape[1]} 个像素特征)")

# 查看原始图像
fig, axes = plt.subplots(2, 5, figsize=(10, 4))
for i, ax in enumerate(axes.flat):
    ax.imshow(digits.images[i], cmap='gray')
    ax.set_title(f'数字 {digits.target[i]}'); ax.axis('off')
plt.suptitle('原始手写数字样本'); plt.show()

# 2. 标准化
X_scaled = StandardScaler().fit_transform(X)

# 3. PCA 降维到 2D 可视化
X2d = PCA(n_components=2).fit_transform(X_scaled)
plt.figure(figsize=(8, 6))
scatter = plt.scatter(X2d[:, 0], X2d[:, 1], c=y, cmap='tab10', alpha=0.5, s=8)
plt.colorbar(scatter, label='数字类别')
plt.xlabel('PC1'); plt.ylabel('PC2')
plt.title('64维手写数字 → PCA 2维可视化')
plt.show()

# 4. 累积方差解释率
pca_full = PCA().fit(X_scaled)
cumsum = np.cumsum(pca_full.explained_variance_ratio_)
plt.figure(figsize=(8, 4))
plt.bar(range(1, 65), pca_full.explained_variance_ratio_, alpha=0.6, label='单个主成分')
plt.plot(range(1, 65), cumsum, 'r-o', markersize=3, label='累积方差')
plt.axhline(y=0.9, color='gray', linestyle='--', label='90% 阈值')
plt.xlabel('主成分编号'); plt.ylabel('方差解释率')
plt.legend(); plt.title('PCA 方差解释率'); plt.show()
# 找到达到 90% 方差的主成分数
n90 = np.argmax(cumsum >= 0.9) + 1
print(f"前 {n90} 个主成分解释了 {cumsum[n90-1]:.1%} 的方差")

# 5. 降维重构
n_components = 20
pca = PCA(n_components=n_components).fit(X_scaled)
X_reduced = pca.transform(X_scaled)
X_restored = pca.inverse_transform(X_reduced)
fig, axes = plt.subplots(2, 5, figsize=(10, 4))
for i, ax in enumerate(axes.flat):
    ax.imshow(X_restored[i].reshape(8, 8), cmap='gray')
    ax.set_title(f'{digits.target[i]}'); ax.axis('off')
plt.suptitle(f'用 {n_components} 个主成分重构 (原64维)')
plt.show()`,
      expected_output: "2D PCA 散点图显示不同数字有聚拢趋势（0、1、4 较分散）。累积方差曲线显示前约 20 个主成分解释了 90% 方差——意味着 64 维数据中约 44 维是冗余的。用 20 个主成分重构的数字仍清晰可辨，但比原图模糊。",
      reflection: [
        "为什么 64 维数据可以用 20 个主成分近似？丢失的 44 维是什么信息？",
        "PCA 假设数据是线性结构——如果数据有非线性结构（比如螺旋形），PCA 还能好用吗？t-SNE 和 PCA 有什么区别？",
        "如果某特征方差很大但数值范围也很大（比如年龄 0-100 vs 收入 0-100000），PCA 会偏向哪个特征？"
      ],
    },
    {
      name: "特征工程流水线构建",
      difficulty: "intermediate",
      data: "sklearn 加州房价数据 (California Housing)",
      tools: ["Scikit-learn", "Pandas", "NumPy", "Matplotlib"],
      skills: ["数值特征变换", "Pipeline 自动化", "ColumnTransformer", "交叉验证"],
      goal: "掌握系统化的特征工程方法论，能构建端到端的预处理流水线，通过特征工程显著提升模型性能",
      estimated_time: "4-5小时",
      deliverables: "特征工程流水线 Pipeline，包含至少 5 种特征构造操作、特征选择报告、前后模型性能对比（基线 vs 特征工程后）",
      data_source: "sklearn.datasets.fetch_california_housing() —— 20640条加州房价数据，8个数值特征",
      steps: [
        "加载 California Housing 数据，转为 DataFrame，查看各特征分布（hist）和与目标变量的相关性（热力图）",
        "创建新特征：房间数/卧室数比值、每房间人口数、卧室/人口比值等 3 个组合特征",
        "用 StandardScaler 标准化数值特征，用 ColumnTransformer 组合所有预处理步骤",
        "构建 Pipeline：ColumnTransformer → 标准化 → 线性回归，用 cross_val_score 评估基线 R²",
        "对比「无特征工程」vs「有特征工程」的交叉验证得分，记录 R² 提升幅度"
      ],
      code: `from sklearn.datasets import fetch_california_housing
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler, FunctionTransformer
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# 1. 加载数据
data = fetch_california_housing()
df = pd.DataFrame(data.data, columns=data.feature_names)
df['Price'] = data.target
print(df.describe())

# 相关性热力图
plt.figure(figsize=(10, 8))
sns.heatmap(df.corr(), annot=True, fmt='.2f', cmap='coolwarm', center=0)
plt.title('特征/目标相关性矩阵'); plt.show()

# 2. 特征工程函数
def add_features(X_df):
    X = X_df.copy()
    X['rooms_per_house'] = X['AveRooms'] / (X['AveBedrms'] + 1e-6)
    X['pop_per_house'] = X['Population'] / (X['AveOccup'] + 1e-6)
    X['bedrms_ratio'] = X['AveBedrms'] / (X['AveRooms'] + 1e-6)
    return X

X_raw = df.drop('Price', axis=1)
y = df['Price'].values

# 3. 构建 Pipeline
preprocessor = ColumnTransformer([
    ('scaler', StandardScaler(), list(X_raw.columns) + ['rooms_per_house', 'pop_per_house', 'bedrms_ratio']),
])

# 添加特征工程的 Pipeline
feat_eng = FunctionTransformer(add_features, validate=False)
pipeline_with_fe = Pipeline([
    ('feature_engineering', feat_eng),
    ('preprocessor', preprocessor),
    ('regressor', LinearRegression()),
])

# 无特征工程的基线
pipeline_baseline = Pipeline([
    ('scaler', StandardScaler()),
    ('regressor', LinearRegression()),
])

# 4. 对比评估
scores_baseline = cross_val_score(pipeline_baseline, X_raw, y, cv=5, scoring='r2')
scores_with_fe = cross_val_score(pipeline_with_fe, X_raw, y, cv=5, scoring='r2')
print(f"基线 R²: {scores_baseline.mean():.4f} ± {scores_baseline.std():.4f}")
print(f"特征工程后 R²: {scores_with_fe.mean():.4f} ± {scores_with_fe.std():.4f}")

# 可视化对比
plt.bar(['基线', '特征工程'], [scores_baseline.mean(), scores_with_fe.mean()],
        yerr=[scores_baseline.std(), scores_with_fe.std()], color=['gray', 'steelblue'])
plt.ylabel('R² (5折CV)'); plt.title('特征工程效果对比')
plt.show()`,
      expected_output: "基线 R² 约 0.60，添加 3 个组合特征后 R² 提升至约 0.62——提升约 2 个百分点。相关性热力图显示 MedInc（收入中位数）与房价相关性最强（>0.7），是最重要的预测特征。Pipeline 确保了预处理步骤不会产生数据泄漏。",
      reflection: [
        "为什么用 Pipeline 比手动逐步处理更好？Pipeline 如何避免数据泄漏？",
        "组合特征 'rooms_per_house' 如果除数为 0 怎么办？代码中 +1e-6 的作用是什么？",
        "如果新增的特征其实没有用（噪声），Pipeline 的 R² 会怎样变化？怎么筛选有效特征？"
      ],
    },
  ];
