import type { Experiment } from "../types";

export const advancedExperiments: Experiment[] = [
    {
      name: "PyTorch CNN 图像分类器",
      difficulty: "advanced",
      data: "CIFAR-10 / CIFAR-100 彩色图像数据集",
      tools: ["PyTorch", "Torchvision", "TensorBoard", "tqdm"],
      skills: ["CNN 架构设计", "数据增强", "学习率调度", "模型集成"],
      goal: "从零搭建并训练一个达到 85%+ 准确率的 CNN 图像分类器，掌握现代 CNN 训练管线（增强、调度、集成）",
      estimated_time: "5-6小时",
      deliverables: "完整的 CNN 训练代码，包含数据增强可视化、训练曲线、混淆矩阵、至少2种架构的性能对比",
      download_url: "",
      data_source: "torchvision.datasets.CIFAR10() —— CIFAR-10 彩色图像数据集，10 个类别（飞机、汽车、鸟、猫、鹿、狗、蛙、马、船、卡车），50000 张训练图 + 10000 张测试图，32×32 像素，调用即自动下载",
      steps: [
        "加载 CIFAR-10 数据集，使用 transforms.Compose 组合随机水平翻转、ToTensor 和 Normalize 进行数据增强",
        "定义 CNN 网络结构：Conv2d(3→32)→ReLU→MaxPool2d→Conv2d(32→64)→ReLU→MaxPool2d→Flatten→Linear(64*8*8→256)→ReLU→Dropout(0.5)→Linear(256→10)",
        "选择 CrossEntropyLoss 和 Adam(lr=0.001) 优化器，编写训练循环共 5 个 Epoch，每个 Batch 记录 Loss",
        "每个 Epoch 结束后在测试集上评估准确率，用 twinx() 双轴绘制 Loss（蓝色）和 Accuracy（红色）曲线",
        "随机抽取 16 张测试图像，用训练好的模型预测并可视化，图像上方标注「真实：XX / 预测：XX」",
      ],
      code: `import torch, torch.nn as nn, torch.optim as optim
import torchvision, torchvision.transforms as T
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt

# 1. 数据加载与增强
transform = T.Compose([T.RandomHorizontalFlip(), T.ToTensor(),
    T.Normalize((0.5,0.5,0.5),(0.5,0.5,0.5))])
train_ds = torchvision.datasets.CIFAR10('./data', train=True, download=True, transform=transform)
test_ds = torchvision.datasets.CIFAR10('./data', train=False, download=True,
    transform=T.Compose([T.ToTensor(), T.Normalize((0.5,0.5,0.5),(0.5,0.5,0.5))]))
train_loader = DataLoader(train_ds, 64, shuffle=True)
test_loader = DataLoader(test_ds, 64)

# 2. 定义 CNN
class CNN(nn.Module):
    def __init__(self, nc=10):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(3,32,3,padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32,64,3,padding=1), nn.ReLU(), nn.MaxPool2d(2))
        self.fc = nn.Sequential(nn.Flatten(), nn.Linear(64*8*8,256),
            nn.ReLU(), nn.Dropout(0.5), nn.Linear(256, nc))
    def forward(self, x): return self.fc(self.conv(x))

device = torch.device('cuda' if torch.cuda.is_available() else
    'mps' if torch.backends.mps.is_available() else 'cpu')
model = CNN().to(device)
criterion, opt = nn.CrossEntropyLoss(), optim.Adam(model.parameters(), lr=0.001)

# 3. 训练
train_losses, test_accs = [], []
for epoch in range(5):
    model.train(); running_loss = 0
    for imgs, labels in train_loader:
        imgs, labels = imgs.to(device), labels.to(device)
        opt.zero_grad(); loss = criterion(model(imgs), labels)
        loss.backward(); opt.step(); running_loss += loss.item()
    train_losses.append(running_loss/len(train_loader))
    # 评估
    model.eval(); correct = 0
    with torch.no_grad():
        for imgs, labels in test_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            correct += (model(imgs).argmax(1)==labels).sum().item()
    test_accs.append(correct/len(test_ds))
    print(f"Epoch {epoch+1}: Loss={train_losses[-1]:.4f}, Acc={test_accs[-1]:.3f}")

# 4. 绘制训练曲线
fig, ax1 = plt.subplots()
ax2 = ax1.twinx()
ax1.plot(range(1,6), train_losses, 'b-o', label='Loss')
ax2.plot(range(1,6), test_accs, 'r-s', label='Accuracy')
ax1.set_xlabel('Epoch'); ax1.set_ylabel('Loss', color='b')
ax2.set_ylabel('Accuracy', color='r'); plt.title('CIFAR-10 CNN 训练曲线')
plt.show()

# 5. 可视化预测
classes = ['plane','car','bird','cat','deer','dog','frog','horse','ship','truck']
imgs, labels = next(iter(test_loader))
with torch.no_grad():
    preds = model(imgs.to(device)).argmax(1).cpu()
fig, axes = plt.subplots(4,4,figsize=(8,8))
for i, ax in enumerate(axes.flat):
    ax.imshow(imgs[i].permute(1,2,0)*0.5+0.5)
    ax.set_title(f'真:{classes[labels[i]]} 预:{classes[preds[i]]}', fontsize=9)
    ax.axis('off')
plt.tight_layout(); plt.show()`,
      expected_output: "训练 5 个 Epoch 后，测试准确率约 65%-75%。Loss 曲线从 ~2.3 持续下降至 ~0.8，准确率曲线从 ~35% 稳步上升。16 张预测图像中大多数分类正确（如飞机、青蛙、卡车等判别性强的类别），部分在猫/狗、鸟/鹿等相似类别上可能混淆。整个训练过程在 CPU 上约需 10-15 分钟。",
      reflection: [
        "如果去掉 Dropout(0.5) 和 RandomHorizontalFlip，准确率会如何变化？分别去掉其中一个，哪个影响更大？为什么？",
        "模型在哪些类别上最容易出错？如何通过计算混淆矩阵来系统性地定位模型弱点？",
        "当前 CNN 约 15 万参数。如果换成 ResNet-18（约 1100 万参数），准确率能提升多少？代价是什么？你有没有必要在 CIFAR-10 上用 ResNet？",
      ],
    },
    {
      name: "BERT 中文文本分类",
      difficulty: "advanced",
      data: "THUCNews 或中文情感分析数据集",
      tools: ["Hugging Face Transformers", "PyTorch", "Datasets", "W&B"],
      skills: ["预训练模型微调", "Tokenizer 处理", "Attention 可视化", "多分类评估"],
      goal: "掌握 BERT 预训练模型的微调流程，理解 Tokenizer 和 Attention 机制，完成高质量中文文本分类任务",
      estimated_time: "4-5小时",
      deliverables: "BERT 微调完整代码，包含 Attention 权重可视化热力图、训练/验证/测试集详细评估报告、错误案例分析",
      data_source: "HuggingFace bert-base-chinese 预训练模型（https://huggingface.co/google-bert/bert-base-chinese）+ 自定义中文情感数据集 —— 使用 transformers 库加载，模型约 110M 参数，首次运行自动下载",
      steps: [
        "安装依赖 transformers、datasets、torch，构造中文情感数据集（正面/负面各半，至少 200 条），转换为 HuggingFace Dataset 格式",
        "加载 bert-base-chinese 的 AutoTokenizer，编写 tokenize_fn 对文本进行分词、截断（max_length=128）和填充，用 map 批处理",
        "加载 AutoModelForSequenceClassification（num_labels=2），自动检测 mps/cuda/cpu 设备并迁移模型",
        "配置 TrainingArguments（3 个 Epoch、batch_size=8、evaluation_strategy='epoch'），自定义 compute_metrics 计算 accuracy",
        "使用 Trainer API 启动训练，观察每个 Epoch 的 eval_loss 和 eval_accuracy 变化",
        "在测试集上运行 trainer.predict()，打印 sklearn classification_report（precision、recall、f1-score），随机展示 5 条预测结果",
      ],
      code: `import torch, numpy as np
from transformers import (AutoTokenizer, AutoModelForSequenceClassification,
    Trainer, TrainingArguments)
from datasets import Dataset
from sklearn.metrics import accuracy_score, classification_report

# 1. 准备中文情感数据
texts = (["太好了，非常满意！","推荐，质量很好。","物流快，好评。","性价比高，值得买。","超预期，赞！"] +
         ["太差了，很失望。","不推荐，质量差。","慢死了，差评。","不值这个价。","垃圾，退货。"]) * 30
labels = [1]*150 + [0]*150  # 1=正面, 0=负面
dataset = Dataset.from_dict({'text': texts, 'label': labels})
split = dataset.train_test_split(test_size=0.2, seed=42)

# 2. Tokenizer
model_name = 'bert-base-chinese'
tokenizer = AutoTokenizer.from_pretrained(model_name)
def tokenize(batch):
    return tokenizer(batch['text'], truncation=True, padding='max_length', max_length=64)
train_ds = split['train'].map(tokenize, batched=True)
test_ds  = split['test'].map(tokenize, batched=True)

# 3. 模型与设备
device = torch.device('cuda' if torch.cuda.is_available() else
    'mps' if torch.backends.mps.is_available() else 'cpu')
model = AutoModelForSequenceClassification.from_pretrained(
    model_name, num_labels=2).to(device)

# 4. 训练配置
args = TrainingArguments(output_dir='./bert_out', num_train_epochs=3,
    per_device_train_batch_size=8, per_device_eval_batch_size=8,
    evaluation_strategy='epoch', logging_steps=10, save_strategy='no',
    no_cuda=(str(device)=='cpu'))

def compute_metrics(pred):
    preds = np.argmax(pred.predictions, axis=1)
    return {'accuracy': accuracy_score(pred.label_ids, preds)}

trainer = Trainer(model=model, args=args, train_dataset=train_ds,
    eval_dataset=test_ds, compute_metrics=compute_metrics)
trainer.train()

# 5. 评估
result = trainer.evaluate()
print(f"\\n测试准确率: {result['eval_accuracy']:.3f}")

preds_out = trainer.predict(test_ds)
pred_labels = np.argmax(preds_out.predictions, axis=1)
print(classification_report(preds_out.label_ids, pred_labels,
    target_names=['负面','正面']))

# 随机展示预测
indices = np.random.choice(len(test_ds), 5, replace=False)
for i in indices:
    print(f"文本: {test_ds[i]['text'][:40]}...")
    print(f"  真实: {preds_out.label_ids[i]}, 预测: {pred_labels[i]}")`,
      expected_output: "训练 3 个 Epoch 后，eval_loss 从 ~0.69 降至 ~0.05，准确率接近 100%（小数据集模式简单）。classification_report 显示 precision、recall、f1-score 均接近 1.0。随机 5 条测试文本全部正确分类。如果使用更大的真实数据集（如 THUCNews），准确率通常在 85%-93% 之间。首次下载模型约需 400MB 空间。",
      reflection: [
        "BERT 在仅 300 条数据上就能取得很好的效果，而传统的 TextCNN/LSTM 可能需要上万条。这种‘少样本学习能力’的来源是什么？",
        "bert-base-chinese 约 110M 参数。如果使用 albert-chinese-tiny（约 4M 参数）或冻结 BERT 前 10 层只训练分类头，效果会如何变化？为什么？",
        "max_length=64 意味着什么？如果中文文本超过 64 个 token（约 32 个汉字），会被怎样处理？这对长文本分类任务有什么影响？",
      ],
    },
    {
      name: "XGBoost 超参数自动调优",
      difficulty: "advanced",
      data: "Kaggle Tabular Playground 或结构化比赛数据集",
      tools: ["XGBoost", "Optuna", "Scikit-learn", "SHAP"],
      skills: ["贝叶斯超参搜索", "特征重要性", "模型校准", "Stacking 集成"],
      goal: "掌握使用 Optuna 对 XGBoost 进行贝叶斯超参数优化的完整流程，理解各参数对模型性能的影响机制",
      estimated_time: "3-4小时",
      deliverables: "超参数调优 Pipeline，包含参数重要性分析、优化历史可视化、SHAP 特征归因报告、最优模型与基线模型的对比",
      data_source: "sklearn.datasets.fetch_california_housing() —— 加州房价数据集，20640 条记录，8 个特征（MedInc、HouseAge、AveRooms 等），回归任务，目标为房价中位数（单位：10万美元），无需外部下载",
      steps: [
        "加载 California Housing 数据集，按 80/20 划分训练集和测试集（random_state=42）",
        "使用 XGBRegressor 默认参数训练基线模型，计算测试集 RMSE 和 R² 作为优化起点",
        "定义超参数搜索空间（n_estimators、max_depth、learning_rate、subsample、colsample_bytree），使用 RandomizedSearchCV(cv=5, n_iter=30) 进行随机搜索",
        "用 search.best_params_ 重新训练最优模型，对比优化前后的 RMSE 和 R² 提升幅度",
        "输出 feature_importances_ 并用横向条形图可视化，分析哪些特征对房价影响最大",
        "随机查看搜索过程中前 5 组最佳参数组合及其 CV 分数的变化规律",
      ],
      code: `import numpy as np, pandas as pd, matplotlib.pyplot as plt
from sklearn.datasets import fetch_california_housing
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.metrics import mean_squared_error, r2_score
import xgboost as xgb

# 1. 加载数据
data = fetch_california_housing()
X_train, X_test, y_train, y_test = train_test_split(
    data.data, data.target, test_size=0.2, random_state=42)
print(f"特征: {data.feature_names}")

# 2. 基线模型
baseline = xgb.XGBRegressor(objective='reg:squarederror', random_state=42)
baseline.fit(X_train, y_train)
y_pred = baseline.predict(X_test)
rmse_b = np.sqrt(mean_squared_error(y_test, y_pred))
r2_b = r2_score(y_test, y_pred)
print(f"基线 RMSE: {rmse_b:.4f}, R²: {r2_b:.4f}")

# 3. 超参数搜索
param_grid = {
    'n_estimators': [100, 200, 300, 500],
    'max_depth': [3, 5, 7, 9],
    'learning_rate': [0.01, 0.05, 0.1, 0.2],
    'subsample': [0.6, 0.8, 1.0],
    'colsample_bytree': [0.6, 0.8, 1.0],
}
search = RandomizedSearchCV(
    xgb.XGBRegressor(objective='reg:squarederror', random_state=42),
    param_grid, n_iter=30, cv=5, scoring='neg_mean_squared_error',
    random_state=42, n_jobs=-1, verbose=1)
search.fit(X_train, y_train)
print(f"最优参数: {search.best_params_}")

# 4. 最优模型评估
best = search.best_estimator_
y_pred_b = best.predict(X_test)
rmse_o = np.sqrt(mean_squared_error(y_test, y_pred_b))
r2_o = r2_score(y_test, y_pred_b)
print(f"优化后 RMSE: {rmse_o:.4f} (提升 {(rmse_b-rmse_o)/rmse_b*100:.1f}%)")
print(f"优化后 R²:   {r2_o:.4f} (提升 +{r2_o-r2_b:.4f})")

# 5. 特征重要性
plt.figure(figsize=(8,5))
idx = np.argsort(best.feature_importances_)
plt.barh(range(len(idx)), best.feature_importances_[idx])
plt.yticks(range(len(idx)), [data.feature_names[i] for i in idx])
plt.xlabel('Feature Importance'); plt.title('XGBoost 特征重要性')
plt.tight_layout(); plt.savefig('xgb_importance.png'); plt.show()

# 6. Top-5 搜索结果
results = pd.DataFrame(search.cv_results_)
top5 = results.nlargest(5, 'mean_test_score')[['params','mean_test_score','std_test_score']]
top5['mean_test_score'] = np.sqrt(-top5['mean_test_score'])  # 转回 RMSE
print("\\nTop-5 参数组合 (RMSE):")
print(top5.to_string(index=False))`,
      expected_output: "基线模型 RMSE 约 0.48-0.52，R² 约 0.60-0.65。RandomizedSearchCV 耗时约 30-60 秒（30 组 × 5 折 = 150 次训练），最优参数通常为 max_depth=7-9、learning_rate=0.05-0.1、n_estimators=300-500。优化后 RMSE 降低 5%-10%（约 0.43-0.48），R² 提升至 0.66-0.73。特征重要性显示 MedInc（收入中位数）和 Latitude/Longitude（地理位置）是最关键的特征。",
      reflection: [
        "RandomizedSearchCV 只尝试了 30 种参数组合，而网格中总可能组合是 4×4×4×3×3 = 576 种。为什么不全搜索？随机搜索会不会错过最优解？它背后的概率保证是什么？",
        "学习率（learning_rate）和 n_estimators 之间存在什么关系？如果 learning_rate 减半，n_estimators 应该怎么调？为什么？",
        "如果把 RandomizedSearchCV 换成 Optuna 的贝叶斯优化（TPESampler），搜索效率和最终效果会有什么不同？贝叶斯优化的核心思想是什么？",
      ],
    },
    {
      name: "DCGAN 图像生成",
      difficulty: "advanced",
      data: "CelebA 人脸或 Anime Face 动漫头像数据集",
      tools: ["PyTorch", "Torchvision", "TensorBoard", "W&B"],
      skills: ["生成对抗网络", "对抗训练技巧", "模式坍塌诊断", "潜在空间插值"],
      goal: "理解 GAN 的博弈训练原理，掌握训练稳定性技巧（如梯度惩罚、Wasserstein 距离），能生成高质量图像",
      estimated_time: "4-5小时",
      deliverables: "DCGAN 训练代码，包含生成器/判别器损失曲线、各epoch生成图像对比图、潜在空间插值动画、训练稳定性分析报告",
      data_source: "torchvision.datasets.MNIST() —— 手写数字数据集，60000 张训练图 + 10000 张测试图，28×28 灰度图像，10 个数字类别（0-9），调用即自动下载",
      steps: [
        "加载 MNIST 数据集，使用 transforms 将图像归一化到 [-1, 1]（匹配 Tanh 激活），创建 DataLoader(batch_size=128)",
        "定义 Generator：100 维噪声 → Linear(100→256)→ReLU→Linear(256→512)→ReLU→Linear(512→1024)→ReLU→Linear(1024→784)→Tanh → Reshape 为 1×28×28",
        "定义 Discriminator：Flatten(784) → Linear(784→512)→LeakyReLU(0.2)→Linear(512→256)→LeakyReLU(0.2)→Linear(256→1)→Sigmoid，输出真假概率",
        "编写对抗训练循环（20 个 Epoch）：每个 Batch 先训练判别器（真图→1，假图→0），再训练生成器（假图→1 欺骗判别器），使用 BCELoss",
        "每 5 个 Epoch，用一组固定的 64 维噪声生成图像，用 make_grid 拼成 8×8 网格并保存为 PNG，观察生成质量如何从噪声逐步变为清晰数字",
        "训练完成后，用 matplotlib 绘制 Generator Loss 和 Discriminator Loss 双曲线，分析训练是否稳定",
      ],
      code: `import torch, torch.nn as nn, torchvision
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt

# 1. 数据
transform = torchvision.transforms.Compose([
    torchvision.transforms.ToTensor(),
    torchvision.transforms.Normalize([0.5], [0.5])])
dataloader = DataLoader(torchvision.datasets.MNIST(
    './data', train=True, download=True, transform=transform),
    batch_size=128, shuffle=True)

# 2. Generator: 噪声 → 图像
class Generator(nn.Module):
    def __init__(self, zdim=100):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(zdim, 256), nn.ReLU(),
            nn.Linear(256, 512), nn.ReLU(),
            nn.Linear(512, 1024), nn.ReLU(),
            nn.Linear(1024, 784), nn.Tanh())
    def forward(self, z): return self.net(z).view(-1, 1, 28, 28)

# 3. Discriminator: 图像 → 概率
class Discriminator(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(784, 512), nn.LeakyReLU(0.2),
            nn.Linear(512, 256), nn.LeakyReLU(0.2),
            nn.Linear(256, 1), nn.Sigmoid())
    def forward(self, x): return self.net(x.view(-1, 784))

# 4. 训练准备
device = torch.device('cuda' if torch.cuda.is_available() else
    'mps' if torch.backends.mps.is_available() else 'cpu')
G, D = Generator().to(device), Discriminator().to(device)
criterion = nn.BCELoss()
g_opt = torch.optim.Adam(G.parameters(), lr=0.0002)
d_opt = torch.optim.Adam(D.parameters(), lr=0.0002)
fixed_z = torch.randn(64, 100, device=device)

# 5. 对抗训练
g_losses, d_losses = [], []
for epoch in range(20):
    g_loss_sum, d_loss_sum = 0, 0
    for real, _ in dataloader:
        real, bs = real.to(device), real.size(0)
        # 训练判别器：真→1, 假→0
        d_opt.zero_grad()
        loss_d = criterion(D(real), torch.ones(bs,1,device=device)) + \\
                 criterion(D(G(torch.randn(bs,100,device=device)).detach()),
                           torch.zeros(bs,1,device=device))
        loss_d.backward(); d_opt.step()
        # 训练生成器：假→1 (欺骗判别器)
        g_opt.zero_grad()
        loss_g = criterion(D(G(torch.randn(bs,100,device=device))),
                           torch.ones(bs,1,device=device))
        loss_g.backward(); g_opt.step()
        g_loss_sum += loss_g.item(); d_loss_sum += loss_d.item()
    g_losses.append(g_loss_sum/len(dataloader))
    d_losses.append(d_loss_sum/len(dataloader))
    print(f"Epoch {epoch+1:2d}: G={g_losses[-1]:.4f}, D={d_losses[-1]:.4f}")
    # 每 5 epoch 保存生成图
    if (epoch+1) % 5 == 0:
        with torch.no_grad():
            fake = G(fixed_z).cpu()
            grid = torchvision.utils.make_grid(fake, nrow=8, normalize=True)
            plt.imshow(grid.permute(1,2,0), cmap='gray')
            plt.title(f'DCGAN - Epoch {epoch+1}')
            plt.axis('off'); plt.savefig(f'dcgan_e{epoch+1}.png'); plt.show()

# 6. 损失曲线
plt.figure(); plt.plot(g_losses, label='Generator')
plt.plot(d_losses, label='Discriminator')
plt.xlabel('Epoch'); plt.ylabel('Loss')
plt.title('DCGAN 训练损失'); plt.legend(); plt.show()`,
      expected_output: "训练初期（Epoch 1-5），生成图像为随机噪声，完全看不出数字形状。Epoch 5-10 开始出现模糊的笔划轮廓。Epoch 10-15 数字形状逐渐清晰可辨。Epoch 15-20 生成的手写数字质量较好，大部分数字可识别。Loss 曲线中 Generator Loss 呈上升趋势（判别器越来越严格），Discriminator Loss 在 0.5-1.0 之间波动。整个训练在 CPU 上约需 30-60 分钟。如果没有看到清晰的数字生成，尝试调整学习率或增加 Epoch 数。",
      reflection: [
        "训练过程中 Generator 和 Discriminator 的 Loss 变化趋势相反——一个下降另一个上升。这和 GAN 的博弈论框架有什么关系？什么样的 Loss 变化才算是'健康'的训练？",
        "什么是模式坍塌（Mode Collapse）？如果你发现 Generator 只能生成数字'1'和'7'而忽略了其他数字，这说明了什么问题？如何诊断和缓解？",
        "当前的 DCGAN 在 MNIST（28×28 灰度）上效果不错，但换成 CelebA（64×64 彩色人脸）效果会如何？从结构上需要做哪些改动？",
      ],
    },
    {
      name: "从零实现迷你 Transformer",
      difficulty: "advanced",
      data: "WikiText-2 或自定义中文语料",
      tools: ["PyTorch", "NumPy", "einops", "Matplotlib"],
      skills: ["自注意力机制", "位置编码", "多头注意力", "Layer Normalization"],
      goal: "不借助 Transformers 库，从零实现 Transformer 的核心组件（Self-Attention、Multi-Head Attention、FFN），深入理解架构细节",
      estimated_time: "5-6小时",
      deliverables: "纯 PyTorch 实现的 Transformer 模型代码，包含注意力权重可视化、不同位置编码方案的对比、在小数据集上的训练与生成效果",
      data_source: "torch.randint() 随机生成整数序列 —— 无需外部数据集，纯 PyTorch 实现，适合在没有任何外部依赖的情况下学习和调试",
      steps: [
        "实现 PositionalEncoding：使用正弦/余弦函数生成位置编码矩阵 (max_len, d_model)，验证不同位置的编码向量之间的点积关系",
        "实现 MultiHeadAttention：将 Q/K/V 线性投影到 h 个头上，计算 scaled dot-product attention（softmax(QK^T/sqrt(d_k))V），拼接多头输出并通过 W_o 映射",
        "实现 TransformerEncoderLayer：组合 MultiHeadAttention + LayerNorm（残差连接）+ FeedForward（Linear→ReLU→Linear）+ LayerNorm（残差连接）",
        "堆叠 2-3 层 EncoderLayer 组成 MiniTransformer，添加 Embedding 和分类头，构建完整的端到端模型",
        "设计一个玩具任务（如根据第一个 token 的值进行二分类）：创建随机整数序列数据，训练 30 个 Epoch 验证模型能正常拟合训练数据",
      ],
      code: `import torch, torch.nn as nn, math

# 1. 位置编码
class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=200):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(0, max_len).float().unsqueeze(1)
        div = torch.exp(torch.arange(0, d_model, 2).float() *
                        -(math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        self.register_buffer('pe', pe.unsqueeze(0))
    def forward(self, x): return x + self.pe[:, :x.size(1)]

# 2. 多头自注意力
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        assert d_model % n_heads == 0
        self.d_k = d_model // n_heads; self.n_heads = n_heads
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

    def forward(self, x):
        B, L, D = x.shape
        Q = self.W_q(x).view(B, L, self.n_heads, self.d_k).transpose(1,2)
        K = self.W_k(x).view(B, L, self.n_heads, self.d_k).transpose(1,2)
        V = self.W_v(x).view(B, L, self.n_heads, self.d_k).transpose(1,2)
        attn = torch.softmax(Q @ K.transpose(-2,-1) / math.sqrt(self.d_k), dim=-1)
        out = (attn @ V).transpose(1,2).contiguous().view(B, L, D)
        return self.W_o(out)

# 3. Encoder 层
class TransformerEncoderLayer(nn.Module):
    def __init__(self, d_model, n_heads, d_ff):
        super().__init__()
        self.attn = MultiHeadAttention(d_model, n_heads)
        self.norm1 = nn.LayerNorm(d_model)
        self.ff = nn.Sequential(nn.Linear(d_model, d_ff), nn.ReLU(),
                                nn.Linear(d_ff, d_model))
        self.norm2 = nn.LayerNorm(d_model)
    def forward(self, x):
        x = self.norm1(x + self.attn(x))
        x = self.norm2(x + self.ff(x))
        return x

# 4. 迷你 Transformer
class MiniTransformer(nn.Module):
    def __init__(self, vocab_size=100, d_model=64, n_heads=4, d_ff=128, n_layers=2, n_classes=2):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, d_model)
        self.pe = PositionalEncoding(d_model)
        self.layers = nn.ModuleList([
            TransformerEncoderLayer(d_model, n_heads, d_ff) for _ in range(n_layers)])
        self.cls = nn.Linear(d_model, n_classes)
    def forward(self, x):
        x = self.pe(self.embed(x))
        for layer in self.layers: x = layer(x)
        return self.cls(x.mean(dim=1))

# 5. 玩具任务训练
model = MiniTransformer()
opt = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.CrossEntropyLoss()
print(f"参数量: {sum(p.numel() for p in model.parameters()):,}")

for epoch in range(30):
    x = torch.randint(0, 100, (64, 20))          # (batch=64, seq_len=20)
    y = (x[:, 0] > 50).long()                     # 第一个token决定类别
    loss = criterion(model(x), y)
    opt.zero_grad(); loss.backward(); opt.step()
    if (epoch+1) % 5 == 0:
        print(f"Epoch {epoch+1:2d}: Loss={loss.item():.4f}")

# 验证
with torch.no_grad():
    x_test = torch.randint(0, 100, (100, 20))
    y_test = (x_test[:, 0] > 50).long()
    acc = (model(x_test).argmax(1) == y_test).float().mean()
    print(f"\\n测试准确率: {acc:.3f}")`,
      expected_output: "模型参数量约 30K-80K（取决于 d_model 和层数）。训练 30 个 Epoch 后 Loss 从 ~0.7 降至 ~0.002，测试准确率接近 100%（玩具任务简单，仅依赖第一个 token）。这说明手写的 MultiHeadAttention 和 TransformerEncoderLayer 逻辑正确——模型确实学会了关注第一个 token 来做分类。如果测试准确率很低（~50%），可能是注意力机制实现有 bug，需要逐层调试。",
      reflection: [
        "在 MultiHeadAttention 中，Q @ K.transpose 的结果除以 sqrt(d_k) 的作用是什么？如果不除这个因子，训练会出什么问题？这和 softmax 的梯度性质有什么关系？",
        "残差连接（x + self.attn(x)）在 Transformer 中为什么如此重要？如果去掉残差连接，堆叠 6 层 EncoderLayer 会发生什么？这和梯度消失有什么关系？",
        "你现在实现的 Transformer 只用了一个简单的玩具任务。如果要在真实的中文文本分类任务上使用它，还需要添加哪些组件？（提示：Masking、更大的词表、预训练 Embedding）",
      ],
    },
  ];
