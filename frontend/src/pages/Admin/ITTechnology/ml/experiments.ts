import type { Experiment } from "./data";

export { type Experiment };

export const EXPERIMENTS: Record<string, Experiment[]> = {
  beginner: [
    {
      name: "鸢尾花多分类 (Iris Classification)",
      difficulty: "beginner",
      data: "scikit-learn 内置 Iris 数据集，150 条样本，3 种鸢尾花，4 个特征（花萼/花瓣长宽）",
      tools: ["scikit-learn", "Pandas", "Matplotlib", "Seaborn"],
      skills: ["多分类", "数据可视化", "train_test_split", "交叉验证", "混淆矩阵"],
      goal: "使用 KNN/决策树完成三分类任务，掌握 ML 项目完整流程：加载数据 → 可视化探索 → 训练评估 → 调参",
      steps: [
        "加载 Iris 数据集并创建 Pandas DataFrame",
        "用 Seaborn pairplot 可视化特征间关系",
        "划分训练集/测试集 (80/20)",
        "训练 KNN (k=3/5) 和决策树两种分类器",
        "输出分类报告和混淆矩阵，比较模型表现",
      ],
      code: `from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import classification_report

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target, test_size=0.2, random_state=42
)
clf = KNeighborsClassifier(n_neighbors=3)
clf.fit(X_train, y_train)
print(classification_report(y_test, clf.predict(X_test), target_names=iris.target_names))`,
      expectedOutput: "准确率 > 95%，混淆矩阵仅对角线上有小量错误",
      datasetUrl: "https://scikit-learn.org/stable/datasets/toy_dataset.html#iris-dataset",
      estimatedMinutes: 30,
    },
    {
      name: "波士顿房价预测 (Boston Housing Regression)",
      difficulty: "beginner",
      data: "Boston Housing 数据集（506 条，13 个特征），目标为房屋中位价（$1000s）；可通过 Kaggle 或 openml 获取 CSV",
      tools: ["scikit-learn", "Pandas", "Matplotlib", "NumPy"],
      skills: ["线性回归", "特征标准化", "MSE/RMSE 评估", "R² 评分", "残差分析"],
      goal: "用线性回归预测房价，理解回归评估指标（MSE/RMSE/R²）和过拟合/欠拟合",
      steps: [
        "加载 Boston Housing 数据并检查缺失值",
        "用 StandardScaler 标准化特征",
        "训练 LinearRegression 模型",
        "计算 MSE/RMSE 和 R²，绘制预测值 vs 真实值散点图",
        "分析残差分布，判断模型是否欠拟合/过拟合",
      ],
      code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

# 从 CSV 加载
df = pd.read_csv("boston_housing.csv")
X = df.drop("MEDV", axis=1)
y = df["MEDV"]
X_scaled = StandardScaler().fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
model = LinearRegression().fit(X_train, y_train)
y_pred = model.predict(X_test)
print(f"RMSE: {mean_squared_error(y_test, y_pred, squared=False):.2f}")
print(f"R²: {r2_score(y_test, y_pred):.3f}")`,
      expectedOutput: "RMSE ≈ 4.5-5.5，R² > 0.70，残差近似正态分布",
      datasetUrl: "https://www.kaggle.com/datasets/altavish/boston-housing-dataset",
      estimatedMinutes: 30,
    },
    {
      name: "泰坦尼克号生存预测 (Titanic Survival)",
      difficulty: "beginner",
      data: "Kaggle Titanic 数据集：train.csv (891 条) + test.csv (418 条)，含年龄、性别、舱位、票价等特征",
      tools: ["Pandas", "scikit-learn", "XGBoost", "Matplotlib", "Seaborn"],
      skills: ["数据清洗", "缺失值填充", "特征编码", "二分类", "AUC-ROC"],
      goal: "完整走一遍数据清洗→特征工程→建模→预测→提交 Kaggle 的比赛流程",
      steps: [
        "加载数据，分析各列缺失值比例",
        "填充 Age/Embarked/Cabin 缺失值，转换 Sex 为数值",
        "构造 FamilySize、Title、AgeBand 等新特征",
        "训练 LogisticRegression、RandomForest、XGBoost 并比较",
        "生成预测文件 submission.csv，提交 Kaggle 查看排名",
      ],
      code: `import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

train = pd.read_csv("titanic/train.csv")
test = pd.read_csv("titanic/test.csv")

# 简化特征工程
train["Age"].fillna(train["Age"].median(), inplace=True)
train["Embarked"].fillna(train["Embarked"].mode()[0], inplace=True)
train["Sex"] = LabelEncoder().fit_transform(train["Sex"])

features = ["Pclass", "Sex", "Age", "SibSp", "Parch", "Fare"]
X = train[features].fillna(0)
y = train["Survived"]

clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X, y)
print(f"Train accuracy: {clf.score(X, y):.3f}")`,
      expectedOutput: "Kaggle Public Leaderboard 准确率 > 77%",
      datasetUrl: "https://www.kaggle.com/competitions/titanic/data",
      estimatedMinutes: 60,
    },
    {
      name: "MNIST 手写数字识别 (First Neural Network)",
      difficulty: "beginner",
      data: "MNIST 手写数字数据集，28×28 灰度图，60000 训练 + 10000 测试，10 个类别 (0-9)",
      tools: ["PyTorch", "Torchvision", "Matplotlib", "NumPy"],
      skills: ["全连接神经网络", "Softmax 分类", "CrossEntropyLoss", "SGD/Adam 优化器", "GPU 训练"],
      goal: "搭建第一个神经网络（两层全连接）识别手写数字，理解正向传播和反向传播",
      steps: [
        "用 torchvision 加载 MNIST 并创建 DataLoader",
        "定义 2 层全连接网络 (784→128→10)",
        "选择 CrossEntropyLoss 和 Adam 优化器",
        "训练 5 个 epoch，记录 loss 和 accuracy 曲线",
        "可视化前 10 个错误预测样本，分析原因",
      ],
      code: `import torch
import torch.nn as nn
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])
train_loader = DataLoader(datasets.MNIST("./data", train=True, download=True, transform=transform), batch_size=64, shuffle=True)

class MNISTNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc = nn.Sequential(nn.Flatten(), nn.Linear(784, 128), nn.ReLU(), nn.Linear(128, 10))

    def forward(self, x):
        return self.fc(x)

model = MNISTNet()
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
print(f"Model ready, params: {sum(p.numel() for p in model.parameters())}")`,
      expectedOutput: "测试准确率 > 97%，loss 曲线平滑下降",
      datasetUrl: "https://pytorch.org/vision/stable/datasets.html#mnist",
      estimatedMinutes: 45,
    },
    {
      name: "葡萄酒质量分类 (Wine Quality Classification)",
      difficulty: "beginner",
      data: "UCI Wine Quality 数据集，红/白葡萄酒各约 1600/4900 条，11 个理化特征，质量评分 0-10",
      tools: ["scikit-learn", "Pandas", "Seaborn", "XGBoost"],
      skills: ["多特征表格数据", "特征重要性分析", "序数分类", "SMOTE 增广"],
      goal: "学习处理多特征表格数据，用随机森林/XGBoost 分类酒质量等级并分析哪些理化指标最关键",
      steps: [
        "加载红酒和白酒数据，合并并添加 wine_type 特征",
        "将 quality 分组合并为 3 类（差/中/优）",
        "用 corr() 热力图分析特征相关性",
        "训练 RandomForest 并输出 feature_importances_",
        "用 XGBoost 对比并调参，输出分类报告",
      ],
      code: `import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

red = pd.read_csv("winequality-red.csv", sep=";")
white = pd.read_csv("winequality-white.csv", sep=";")
red["type"] = 0
white["type"] = 1
df = pd.concat([red, white], ignore_index=True)
df["quality_label"] = pd.cut(df["quality"], bins=[0, 5, 7, 10], labels=[0, 1, 2])

X = df.drop(["quality", "quality_label"], axis=1)
y = df["quality_label"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
rf = RandomForestClassifier(n_estimators=100, random_state=42).fit(X_train, y_train)
print(classification_report(y_test, rf.predict(X_test), target_names=["Poor", "Average", "Excellent"]))`,
      expectedOutput: "F1 macro > 0.75，特征重要性中 alcohol/volatile acidity 排前",
      datasetUrl: "https://archive.ics.uci.edu/ml/datasets/wine+quality",
      estimatedMinutes: 40,
    },
    {
      name: "糖尿病进展预测 (Diabetes Progression Regression)",
      difficulty: "beginner",
      data: "scikit-learn 内置 Diabetes 数据集，442 条，10 个基线特征，目标为一年后疾病进展量化值",
      tools: ["scikit-learn", "Pandas", "Matplotlib", "NumPy"],
      skills: ["回归正则化", "Ridge vs Lasso", "交叉验证", "超参数搜索", "学习曲线"],
      goal: "对比 Ridge/Lasso/ElasticNet 三种正则化回归，理解 L1/L2 正则化对特征选择的影响",
      steps: [
        "加载 Diabetes 数据集，标准化特征",
        "分别训练 LinearRegression、Ridge、Lasso",
        "用 GridSearchCV 搜索最佳 alpha",
        "比较三种模型的系数稀疏性（Lasso 系数为零的比例）",
        "绘制学习曲线，观察训练集大小对性能的影响",
      ],
      code: `from sklearn.datasets import load_diabetes
from sklearn.linear_model import Ridge, Lasso
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler
import numpy as np

X, y = load_diabetes(return_X_y=True)
X = StandardScaler().fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

for model, name in [(Ridge(alpha=1.0), "Ridge"), (Lasso(alpha=0.1), "Lasso")]:
    scores = cross_val_score(model, X_train, y_train, cv=5, scoring="neg_mean_squared_error")
    print(f"{name}: RMSE = {np.sqrt(-scores.mean()):.2f} (+/- {scores.std():.2f})")`,
      expectedOutput: "Ridge RMSE ≈ 54-56，Lasso 将 3-4 个不重要特征系数压缩为零",
      datasetUrl: "https://scikit-learn.org/stable/datasets/toy_dataset.html#diabetes-dataset",
      estimatedMinutes: 35,
    },
  ],

  intermediate: [
    {
      name: "CIFAR-10 图像分类 (CNN + Data Augmentation)",
      difficulty: "intermediate",
      data: "CIFAR-10：32×32 彩色图，10 类（飞机/汽车/鸟/猫/鹿/狗/青蛙/马/船/卡车），50000 训练 + 10000 测试",
      tools: ["PyTorch", "Torchvision", "TensorBoard", "tqdm"],
      skills: ["CNN 搭建", "数据增强", "BatchNorm", "迁移学习", "TensorBoard 可视化"],
      goal: "搭建 CNN 完成 10 类图像分类，用数据增强和 ResNet 迁移学习提升准确率至 90%+",
      steps: [
        "用 torchvision 加载 CIFAR-10，应用 RandomCrop/RandomHorizontalFlip/Normalize",
        "定义 CNN (Conv→BN→ReLU→Pool) × 3 + 全连接",
        "训练 20 epochs，用 TensorBoard 记录 loss/accuracy",
        "换用 ResNet18 预训练模型进行迁移学习对比",
        "可视化混淆矩阵和 Grad-CAM 热力图",
      ],
      code: `import torch
import torch.nn as nn
import torchvision.transforms as transforms
from torchvision import datasets
from torch.utils.data import DataLoader

transform_train = transforms.Compose([
    transforms.RandomCrop(32, padding=4),
    transforms.RandomHorizontalFlip(),
    transforms.ToTensor(),
    transforms.Normalize((0.4914, 0.4822, 0.4465), (0.2470, 0.2435, 0.2616)),
])
train_set = datasets.CIFAR10(root="./data", train=True, download=True, transform=transform_train)
train_loader = DataLoader(train_set, batch_size=128, shuffle=True, num_workers=2)

class SimpleCNN(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(), nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Linear(128, num_classes))

    def forward(self, x):
        return self.classifier(self.conv(x))

print(f"Model ready. GPU: {torch.cuda.is_available()}")`,
      expectedOutput: "CNN from scratch: > 85% | ResNet18 微调: > 92%",
      datasetUrl: "https://www.cs.toronto.edu/~kriz/cifar.html",
      estimatedMinutes: 90,
    },
    {
      name: "IMDB 电影评论情感分析 (RNN/LSTM Sentiment Analysis)",
      difficulty: "intermediate",
      data: "IMDB 影评数据集：50000 条英文影评，正/负面各半，25000 训练 + 25000 测试",
      tools: ["PyTorch", "Torchtext / datasets", "spaCy", "Matplotlib"],
      skills: ["文本预处理", "词嵌入 (Embedding)", "LSTM/GRU", "序列分类", "准确率/F1"],
      goal: "用 LSTM 对电影评论做二分类情感分析，理解词嵌入和 RNN 梯度传播",
      steps: [
        "加载 IMDB 数据集并构建词汇表（保留前 25000 词）",
        "定义 Embedding + 双向 LSTM + 全连接分类头",
        "训练模型并用 validation set 监控过拟合",
        "对比 LSTM vs GRU 的效果",
        "用训练好的模型预测自定义影评",
      ],
      code: `import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchtext.datasets import IMDB
from torchtext.data.utils import get_tokenizer
from torchtext.vocab import build_vocab_from_iterator

tokenizer = get_tokenizer("basic_english")

def yield_tokens(data_iter):
    for label, line in data_iter:
        yield tokenizer(line)

train_iter = IMDB(split="train")
vocab = build_vocab_from_iterator(yield_tokens(train_iter), max_tokens=25000, specials=["<unk>", "<pad>"])
vocab.set_default_index(vocab["<unk>"])

class SentimentLSTM(nn.Module):
    def __init__(self, vocab_size, embed_dim=256, hidden_dim=128):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=1)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=True)
        self.fc = nn.Linear(hidden_dim * 2, 1)

    def forward(self, x):
        x = self.embedding(x)
        _, (hidden, _) = self.lstm(x)
        return torch.sigmoid(self.fc(torch.cat((hidden[-2], hidden[-1]), dim=1)))

print(f"Vocab size: {len(vocab)}, Model ready")`,
      expectedOutput: "验证准确率 > 87%，对自定义影评能正确判断正负面",
      datasetUrl: "https://ai.stanford.edu/~amaas/data/sentiment/",
      estimatedMinutes: 90,
    },
    {
      name: "信用卡欺诈检测 (Imbalanced Classification + SMOTE)",
      difficulty: "intermediate",
      data: "Kaggle Credit Card Fraud Detection 数据集：284807 笔交易，492 笔欺诈（0.172%），28 个 PCA 匿名特征 + Amount + Time",
      tools: ["scikit-learn", "imbalanced-learn", "XGBoost", "Pandas", "Matplotlib", "Seaborn"],
      skills: ["不平衡分类", "SMOTE 过采样", "精确率/召回率权衡", "PR 曲线", "阈值调优"],
      goal: "针对极度不平衡数据（欺诈仅 0.17%），用 SMOTE 重采样 + 集成模型达到召回率 > 85%",
      steps: [
        "加载数据，分析正负样本比例",
        "用 sklearn 的 precision_recall_curve 理解阈值的影响",
        "应用 SMOTE 生成合成少数类样本",
        "训练 XGBoost/RandomForest 并比较 PR-AUC",
        "绘制混淆矩阵，计算 cost-sensitive 下的收益",
      ],
      code: `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, precision_recall_curve, average_precision_score
from imblearn.over_sampling import SMOTE

df = pd.read_csv("creditcard.csv")
X = df.drop(["Time", "Class"], axis=1)
y = df["Class"]
print(f"Fraud rate: {y.mean():.4%}")

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
smote = SMOTE(random_state=42)
X_resampled, y_resampled = smote.fit_resample(X_train, y_train)
print(f"After SMOTE: {len(X_resampled)} samples, fraud ratio: {y_resampled.mean():.1%}")`,
      expectedOutput: "Recall > 85%，Precision > 5%（高 Precision 意味着低误报率），PR-AUC > 0.80",
      datasetUrl: "https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud",
      estimatedMinutes: 75,
    },
    {
      name: "客户分群 (Customer Segmentation: KMeans + PCA)",
      difficulty: "intermediate",
      data: "Kaggle Mall Customer Segmentation 或 UCI Online Retail 数据集，含年龄、收入、消费分数等",
      tools: ["scikit-learn", "Pandas", "Plotly", "Yellowbrick"],
      skills: ["K-Means 聚类", "肘部法则", "轮廓系数", "PCA 降维可视化", "用户画像"],
      goal: "用 KMeans 聚类对客户分群，通过 PCA 降维可视化，为每个群体制定运营策略",
      steps: [
        "加载数据，用 StandardScaler 标准化特征",
        "用肘部法则 (Elbow Method) 和轮廓系数确定最佳 K",
        "训练 KMeans 并为每个客户打上分群标签",
        "用 PCA 降至 2D，Plotly 交互可视化聚类结果",
        "分析每个群的消费特征，给出画像和策略建议",
      ],
      code: `import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import matplotlib.pyplot as plt

df = pd.read_csv("Mall_Customers.csv")
features = ["Age", "Annual Income (k$)", "Spending Score (1-100)"]
X = StandardScaler().fit_transform(df[features])

# 肘部法则
inertias = []
for k in range(1, 11):
    inertias.append(KMeans(k, random_state=42, n_init=10).fit(X).inertia_)

kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
labels = kmeans.fit_predict(X)
print(f"Silhouette: {silhouette_score(X, labels):.3f}")
print(f"Cluster sizes: {pd.Series(labels).value_counts().to_dict()}")`,
      expectedOutput: "轮廓系数 > 0.4，5 个分群可视化清晰分离，各有区分度高的消费画像",
      datasetUrl: "https://www.kaggle.com/datasets/vjchoudhary7/customer-segmentation-tutorial-in-python",
      estimatedMinutes: 60,
    },
    {
      name: "房价预测 Kaggle 竞赛实战 (Feature Engineering + XGBoost)",
      difficulty: "intermediate",
      data: "Kaggle House Prices: Advanced Regression Techniques，79 个解释变量，1460 训练 + 1459 测试",
      tools: ["Pandas", "scikit-learn", "XGBoost", "Optuna", "Feature-engine"],
      skills: ["高级特征工程", "缺失值策略", "类别编码", "模型集成", "对数变换"],
      goal: "在 Kaggle 真实竞赛中通过特征工程 + XGBoost 调参进入 Top 30%",
      steps: [
        "加载数据并合并 train/test，统一做特征工程",
        "数值特征：填充缺失 + 对数变换偏态分布 + 创建组合特征",
        "类别特征：LabelEncoding / OneHotEncoding + 合并罕见类别",
        "用 Optuna 对 XGBoost 做贝叶斯超参搜索",
        "提交 Kaggle 并迭代改进特征",
      ],
      code: `import pandas as pd
import numpy as np
from sklearn.model_selection import KFold, cross_val_score
from xgboost import XGBRegressor

train = pd.read_csv("house-prices/train.csv")
test = pd.read_csv("house-prices/test.csv")
all_data = pd.concat([train.drop("SalePrice", axis=1), test], sort=False)

# 筛选数值特征
num_cols = train.select_dtypes(include=np.number).columns.drop("SalePrice")
for col in num_cols:
    all_data[col] = all_data[col].fillna(all_data[col].median())

train_processed = all_data.iloc[:len(train)][num_cols]
X, y = train_processed, np.log1p(train["SalePrice"])

xgb = XGBRegressor(n_estimators=1000, learning_rate=0.05, max_depth=3, random_state=42)
scores = cross_val_score(xgb, X, y, cv=5, scoring="neg_mean_squared_error")
print(f"CV RMSE: {np.sqrt(-scores.mean()):.4f}")`,
      expectedOutput: "CV RMSE < 0.13，Kaggle Public LB Top 30%",
      datasetUrl: "https://www.kaggle.com/competitions/house-prices-advanced-regression-techniques",
      notebookUrl: "https://www.kaggle.com/code/alexisbcook/xgboost",
      estimatedMinutes: 120,
    },
    {
      name: "新闻文本分类 (TF-IDF + Naive Bayes + Logistic Regression)",
      difficulty: "intermediate",
      data: "scikit-learn 内置 20 Newsgroups 数据集，约 18000 篇新闻，20 个类别",
      tools: ["scikit-learn", "Pandas", "NLTK", "Matplotlib"],
      skills: ["文本预处理", "TF-IDF 向量化", "朴素贝叶斯", "逻辑回归", "多分类评估"],
      goal: "用传统 NLP 方法（TF-IDF + 分类器）完成 20 类新闻分类，理解词袋模型和特征稀疏性",
      steps: [
        "加载 20 Newsgroups，去除 headers/footers/quotes",
        "用 TfidfVectorizer 将文本转为 TF-IDF 矩阵（max_features=5000）",
        "训练 MultinomialNB 和 LogisticRegression 并比较",
        "用 chi2 选择最具判别力的 Top-20 特征词",
        "分析哪些类别容易混淆，输出每个类别的 precision/recall",
      ],
      code: `from sklearn.datasets import fetch_20newsgroups
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

cats = ["alt.atheism", "soc.religion.christian", "comp.graphics", "sci.med"]
train = fetch_20newsgroups(subset="train", categories=cats, remove=("headers", "footers", "quotes"))
test = fetch_20newsgroups(subset="test", categories=cats, remove=("headers", "footers", "quotes"))

for name, model in [("NB", MultinomialNB()), ("LR", LogisticRegression(max_iter=1000))]:
    pipe = Pipeline([("tfidf", TfidfVectorizer(stop_words="english", max_features=5000)), ("clf", model)])
    pipe.fit(train.data, train.target)
    acc = pipe.score(test.data, test.target)
    print(f"{name} Accuracy: {acc:.3f}")`,
      expectedOutput: "LogisticRegression Accuracy > 90%，NB > 85%",
      datasetUrl: "https://scikit-learn.org/stable/datasets/real_world.html#newsgroups-dataset",
      estimatedMinutes: 50,
    },
    {
      name: "时间序列销量预测 (ARIMA vs LSTM)",
      difficulty: "intermediate",
      data: "Kaggle Walmart Sales 或 Store Item Demand 数据集，含 5 年 10 家门店 50 种商品的日销量",
      tools: ["Pandas", "statsmodels", "pmdarima", "PyTorch", "Plotly"],
      skills: ["时间序列分解", "平稳性检验", "ARIMA 建模", "LSTM 序列预测", "RMSE 评估"],
      goal: "用传统 ARIMA 和深度学习 LSTM 分别预测未来 90 天销量，对比两种方法的优劣",
      steps: [
        "加载数据，按日期聚合日销量，检查缺失值",
        "做季节性分解 (trend/seasonal/residual) 和平稳性检验 (ADF test)",
        "用 auto_arima 自动选择 ARIMA 参数并预测",
        "构造滑动窗口数据集训练 LSTM (seq_len=30)",
        "对比 ARIMA 和 LSTM 在测试集上的 RMSE 和趋势捕捉能力",
      ],
      code: `import pandas as pd
import matplotlib.pyplot as plt
from statsmodels.tsa.seasonal import seasonal_decompose
from pmdarima import auto_arima

df = pd.read_csv("walmart-sales/train.csv", parse_dates=["date"])
sales = df.groupby("date")["sales"].sum().asfreq("D").fillna(method="ffill")

# 季节性分解
result = seasonal_decompose(sales, model="additive", period=365)
result.plot()

# ARIMA 自动建模
train = sales.iloc[:-90]
test = sales.iloc[-90:]
model = auto_arima(train, seasonal=True, m=7, trace=False)
forecast = model.predict(n_periods=90)
print(f"ARIMA RMSE: {((forecast - test.values) ** 2).mean() ** 0.5:.2f}")`,
      expectedOutput: "LSTM RMSE < ARIMA RMSE，两者都能捕捉周期性模式，LSTM 对突发峰值更敏感",
      datasetUrl: "https://www.kaggle.com/competitions/walmart-recruiting-store-sales-forecasting",
      estimatedMinutes: 100,
    },
  ],

  advanced: [
    {
      name: "YOLOv8 目标检测 (Real-time Object Detection)",
      difficulty: "advanced",
      data: "COCO 2017 数据集（118K 训练 + 5K 验证，80 类），或用自定义数据标注（LabelImg/LabelStudio）",
      tools: ["Ultralytics YOLOv8", "PyTorch", "OpenCV", "Roboflow", "FiftyOne"],
      skills: ["目标检测", "mAP 评估", "数据标注", "模型导出", "实时推理"],
      goal: "训练 YOLOv8 在自定义数据上检测目标（如安全帽/车辆/商品），导出为 ONNX/TensorRT 实现实时推理",
      steps: [
        "用 Roboflow 准备数据集或下载 COCO 子集",
        "配置 data.yaml 并训练 YOLOv8n/s/m 对比",
        "用 mAP@50/mAP@50-95 评估模型质量",
        "导出为 ONNX/TensorRT 格式",
        "用 OpenCV DNN 或 Ultralytics 实现摄像头实时检测",
      ],
      code: `from ultralytics import YOLO
import cv2

# 训练
model = YOLO("yolov8n.pt")
results = model.train(data="coco128.yaml", epochs=50, imgsz=640, batch=16, device="mps")

# 评估
metrics = model.val()
print(f"mAP50-95: {metrics.box.map:.3f}")

# 推理
results = model("street.jpg")
annotated = results[0].plot()
cv2.imwrite("output.jpg", annotated)`,
      expectedOutput: "mAP50-95 > 0.50 (COCO)，FPS > 30 (GPU 实时推理)",
      datasetUrl: "https://cocodataset.org/#download",
      notebookUrl: "https://colab.research.google.com/github/ultralytics/ultralytics/blob/main/examples/tutorial.ipynb",
      estimatedMinutes: 150,
    },
    {
      name: "RAG 知识库问答系统 (LangChain + Chroma + OpenAI)",
      difficulty: "advanced",
      data: "自定义 PDF/文档集合（企业内部文档、产品手册、学术论文），用 Chroma 做向量存储",
      tools: ["LangChain", "Chroma", "OpenAI API", "FastAPI", "Unstructured"],
      skills: ["文档分割", "Embedding 向量化", "向量检索", "Prompt 工程", "RAG 评估"],
      goal: "搭建一个完整的 RAG 问答系统：文档上传→切片→向量化→检索→LLM 回答，API 化部署",
      steps: [
        "用 Unstructured/PDFPlumber 解析 PDF/Word 文档",
        "用 RecursiveCharacterTextSplitter 分割为语义块",
        "用 OpenAI text-embedding-3-small 生成向量存储到 Chroma",
        "实现检索链：RetrievalQA + 自定义 Prompt 模板",
        "用 FastAPI 封装为 API，支持文件上传和问答",
      ],
      code: `from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain.chains import RetrievalQA

loader = PyPDFLoader("knowledge_base.pdf")
docs = loader.load()
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.split_documents(docs)

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = Chroma.from_documents(chunks, embeddings, persist_directory="./chroma_db")

qa = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(model="gpt-4o-mini"),
    retriever=vectorstore.as_retriever(search_kwargs={"k": 4}),
    chain_type="stuff",
)
print(qa.invoke({"query": "公司年假政策是什么？"}))`,
      expectedOutput: "系统能准确回答基于文档的事实性问题，检索命中率 > 90%",
      datasetUrl: "https://python.langchain.com/docs/integrations/document_loaders/",
      notebookUrl: "https://github.com/langchain-ai/langchain/blob/master/cookbook/rag.ipynb",
      estimatedMinutes: 120,
    },
    {
      name: "LoRA 微调中文大模型 (LLaMA-Factory Fine-tuning)",
      difficulty: "advanced",
      data: "中文指令数据集：alpaca-zh、belle、firefly 等，或自建领域 SFT 数据",
      tools: ["LLaMA-Factory", "Hugging Face Transformers", "PEFT", "BitsAndBytes", "W&B"],
      skills: ["LoRA/QLoRA 微调", "指令数据构造", "4-bit 量化", "模型评估", "vLLM 推理部署"],
      goal: "用 LLaMA-Factory 对 Qwen2.5-7B 做 LoRA 微调，定制中文问答风格并评估效果",
      steps: [
        "准备 SFT 数据集（alpaca 格式 JSON），划分 train/val",
        "安装 LLaMA-Factory，配置 Qwen2.5-7B + LoRA + 4bit 量化",
        "训练 1-3 epochs，用 W&B 监控 loss",
        "用 LLaMA-Factory 的 Chat 界面交互测试",
        "合并 LoRA 权重并导出为 GGUF 格式用于本地推理",
      ],
      code: `# dataset_info.json 配置
# {
#   "my_dataset": {
#     "file_name": "my_sft_data.json",
#     "columns": {"prompt": "instruction", "query": "input", "response": "output"}
#   }
# }

# 训练命令
# llamafactory-cli train \
#   --model_name_or_path Qwen/Qwen2.5-7B-Instruct \
#   --dataset my_dataset \
#   --template qwen \
#   --finetuning_type lora \
#   --lora_rank 8 \
#   --quantization_bit 4 \
#   --output_dir ./output/qwen2.5-lora \
#   --per_device_train_batch_size 2 \
#   --gradient_accumulation_steps 8`,
      expectedOutput: "训练 loss 平稳下降至 < 1.0，微调后模型对领域问题回答更精准，BLEU/ROUGE 提升 10%+",
      datasetUrl: "https://huggingface.co/datasets/silk-road/alpaca-data-gpt4-chinese",
      notebookUrl: "https://colab.research.google.com/drive/1eWAmesrW99p7e1T3D_mY3wqO-3tO6KYZ",
      estimatedMinutes: 180,
    },
    {
      name: "DCGAN 图像生成 (Generative Adversarial Networks)",
      difficulty: "advanced",
      data: "MNIST 或 CelebA 人脸数据集（202599 张裁剪人脸），64×64 RGB",
      tools: ["PyTorch", "Torchvision", "W&B", "Matplotlib"],
      skills: ["GAN 架构设计", "生成器/判别器训练", "反卷积", "训练稳定性", "FID 评估"],
      goal: "从零实现 DCGAN，训练生成逼真的人脸或手写数字，理解生成对抗网络的博弈训练原理",
      steps: [
        "定义 Generator（反卷积上采样）和 Discriminator（卷积下采样）",
        "编写交替训练循环：D 更新→G 更新",
        "监控 D loss / G loss 平衡，观察模式坍塌",
        "每 5 epochs 生成一批样本可视化",
        "用 FID 定量评估生成质量",
      ],
      code: `import torch
import torch.nn as nn

class Generator(nn.Module):
    def __init__(self, z_dim=100, channels=1, feature_g=64):
        super().__init__()
        self.gen = nn.Sequential(
            self._block(z_dim, feature_g * 4, 4, 1, 0),  # 4x4
            self._block(feature_g * 4, feature_g * 2, 4, 2, 1), # 8x8
            self._block(feature_g * 2, feature_g, 4, 2, 1),     # 16x16
            nn.ConvTranspose2d(feature_g, channels, 4, 2, 1),
            nn.Tanh(),
        )

    def _block(self, in_ch, out_ch, kernel, stride, padding):
        return nn.Sequential(
            nn.ConvTranspose2d(in_ch, out_ch, kernel, stride, padding, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(True),
        )

    def forward(self, x):
        return self.gen(x)

print(f"Generator ready. Input: (batch, 100, 1, 1) -> Output: (batch, 1, 64, 64)")`,
      expectedOutput: "生成的 MNIST 数字清晰可辨（肉眼难分真假），FID < 50；CelebA 人脸基本可识别",
      datasetUrl: "https://mmlab.ie.cuhk.edu.hk/projects/CelebA.html",
      notebookUrl: "https://pytorch.org/tutorials/beginner/dcgan_faces_tutorial.html",
      estimatedMinutes: 150,
    },
    {
      name: "BERT 中文文本分类 (HuggingFace Fine-tuning)",
      difficulty: "advanced",
      data: "中文文本分类数据集：THUCNews/TNEWS/IFLYTEK，或自定义标注语料",
      tools: ["Hugging Face Transformers", "Datasets", "PyTorch", "W&B", "Gradio"],
      skills: ["预训练模型微调", "Tokenizer 对齐", "HuggingFace Trainer", "多任务学习", "模型部署"],
      goal: "微调 bert-base-chinese 完成中文新闻分类，掌握 HuggingFace 生态全流程",
      steps: [
        "用 datasets 加载 THUCNews 子集或自定义数据",
        "加载 bert-base-chinese 的 Tokenizer 和模型",
        "用 Trainer API + TrainingArguments 微调全参数",
        "在测试集评估并输出各类别 precision/recall",
        "用 Gradio 搭建交互 Demo 上线",
      ],
      code: `from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
from datasets import load_dataset

model_name = "bert-base-chinese"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=10)

def tokenize(examples):
    return tokenizer(examples["text"], truncation=True, padding="max_length", max_length=128)

dataset = load_dataset("clue", "tnews")
encoded = dataset.map(tokenize, batched=True)

training_args = TrainingArguments(
    output_dir="./results", eval_strategy="epoch",
    per_device_train_batch_size=16, num_train_epochs=3,
    learning_rate=2e-5, logging_dir="./logs",
)
trainer = Trainer(model=model, args=training_args, train_dataset=encoded["train"], eval_dataset=encoded["validation"])
trainer.train()`,
      expectedOutput: "测试集准确率 > 85%（取决于任务难度），Gradio Demo 可正常运行",
      datasetUrl: "https://huggingface.co/datasets/clue",
      notebookUrl: "https://colab.research.google.com/github/huggingface/notebooks/blob/main/examples/text_classification.ipynb",
      estimatedMinutes: 120,
    },
    {
      name: "电影推荐系统 (Collaborative Filtering + Deep Learning)",
      difficulty: "advanced",
      data: "MovieLens 25M 数据集：2500 万评分，62000 部电影，162000 用户",
      tools: ["PyTorch", "Surprise", "FastAPI", "Redis", "Pandas"],
      skills: ["矩阵分解 (SVD)", "协同过滤", "神经协同过滤 (NCF)", "NDCG 评估", "冷启动方案"],
      goal: "实现协同过滤和深度推荐模型，用 NDCG@10 评估排序质量，API 化部署推荐服务",
      steps: [
        "加载 MovieLens，做探索性分析（评分分布、热门电影）",
        "用 Surprise 实现 SVD 矩阵分解 baseline",
        "用 PyTorch 实现 NeuMF (Neural Matrix Factorization)",
        "对比 SVD vs NCF 的 RMSE 和 NDCG@10",
        "用 FastAPI 封装推荐接口，Redis 缓存热门推荐",
      ],
      code: `import pandas as pd
from surprise import SVD, Dataset, Reader, accuracy
from surprise.model_selection import train_test_split

ratings = pd.read_csv("ml-25m/ratings.csv")
reader = Reader(rating_scale=(0.5, 5.0))
data = Dataset.load_from_df(ratings[["userId", "movieId", "rating"]], reader)

trainset, testset = train_test_split(data, test_size=0.2, random_state=42)
model = SVD(n_factors=100, n_epochs=20, biased=True)
model.fit(trainset)
predictions = model.test(testset)
print(f"RMSE: {accuracy.rmse(predictions):.4f}")
print(f"MAE: {accuracy.mae(predictions):.4f}")

# 为指定用户推荐 Top-K
from collections import defaultdict
user_id = "1"
user_ratings = ratings[ratings["userId"] == 1]
rated_movies = set(user_ratings["movieId"])
candidates = set(ratings["movieId"].unique()) - rated_movies
scores = [(mid, model.predict(user_id, mid).est) for mid in list(candidates)[:10000]]
top10 = sorted(scores, key=lambda x: x[1], reverse=True)[:10]
print(f"Top-10 recommendations: {top10}")`,
      expectedOutput: "RMSE < 0.85，NDCG@10 > 0.5，API 响应 < 200ms (with Redis cache)",
      datasetUrl: "https://grouplens.org/datasets/movielens/25m/",
      notebookUrl: "https://github.com/NVIDIA-Merlin/Movielens-Recommendation-Systems",
      estimatedMinutes: 150,
    },
    {
      name: "MLOps 全流程实战 (MLflow + FastAPI + Docker 部署)",
      difficulty: "advanced",
      data: "任意已完成的 ML 模型（实验 6 糖尿病回归或实验 10 客户分群），重点在工程化部署",
      tools: ["MLflow", "FastAPI", "Docker", "Pytest", "GitHub Actions", "Prometheus"],
      skills: ["实验追踪", "模型注册", "CI/CD 流水线", "API 部署", "监控与日志"],
      goal: "将 ML 模型从 Jupyter Notebook 工程化为生产级 API 服务，实现完整的 MLOps 闭环",
      steps: [
        "用 MLflow Tracking 记录实验参数/指标/模型",
        "用 MLflow Model Registry 注册最佳模型并标记 staging/production",
        "编写 FastAPI 推理接口 (/predict, /health)，加载 MLflow 模型",
        "编写 Dockerfile 和 docker-compose.yml 容器化服务",
        "用 pytest 编写 API 测试，配置 GitHub Actions CI",
      ],
      code: `import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error

mlflow.set_tracking_uri("sqlite:///mlflow.db")
mlflow.set_experiment("diabetes-prediction")

with mlflow.start_run(run_name="rf-baseline"):
    params = {"n_estimators": 100, "max_depth": 5}
    mlflow.log_params(params)
    mlflow.sklearn.autolog()

    model = RandomForestRegressor(**params, random_state=42)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    mlflow.log_metric("rmse", mean_squared_error(y_test, y_pred, squared=False))

print(f"Run logged to MLflow: {mlflow.active_run().info.run_id}")

# --- FastAPI 部署示例 ---
# from fastapi import FastAPI
# import mlflow.sklearn
# app = FastAPI()
# model = mlflow.sklearn.load_model("models:/diabetes-model/production")
# @app.post("/predict")
# async def predict(features: list[float]):
#     return {"prediction": float(model.predict([features])[0])}`,
      expectedOutput: "MLflow UI 可查看实验记录，FastAPI /predict 返回正确结果，Docker 容器可一键启动",
      datasetUrl: "https://mlflow.org/docs/latest/tracking.html",
      notebookUrl: "https://github.com/mlflow/mlflow/tree/master/examples",
      estimatedMinutes: 150,
    },
  ],
};
