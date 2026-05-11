"""Enrich ML book chapters 9-12 with LaTeX, tables, code, and real URLs.

Run: cd backend && python3 scripts/enrich_r2_ch9_12.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, ".")
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

db_url = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db",
)


def j(v):
    return json.dumps(v, ensure_ascii=False)


CH = []

# ═══════════════════════════════════════════════════════════════
# Ch9: 神经网络基础
# ═══════════════════════════════════════════════════════════════
CH.append(
    dict(
        slug="neural-networks",
        chapter_number=9,
        title="神经网络基础",
        summary=(
            "从感知机到多层神经网络，掌握前向传播、反向传播、激活函数、"
            "梯度下降变体与参数初始化策略。"
        ),
        difficulty="intermediate",
        estimated_minutes=60,
        markdown=r"""# 神经网络基础

## 学习定位

本章从感知机出发建立多层神经网络的完整图景：前向传播计算、反向传播求梯度、
激活函数的选择依据、梯度下降变体对比以及参数初始化策略。

## 感知机模型

感知机是最简单的神经网络单元，1957年由 Frank Rosenblatt 提出。

给定输入 $\mathbf{x} \in \mathbb{R}^d$，权重 $\mathbf{w}$，偏置 $b$：

$$
\hat{y} = \sigma\left(\sum_{i=1}^{d} w_i x_i + b\right) = \sigma(\mathbf{w}^T \mathbf{x} + b)
$$

其中 $\sigma(z) = \text{sign}(z)$ 是阶跃函数。感知机只能解决线性可分问题，
无法处理 XOR，这一局限直接催生了多层网络。

## 多层感知机 (MLP)

MLP 引入**隐藏层**，每层使用非线性激活函数，使得网络可以表示任意复杂函数。

### 前向传播

对于一个 $L$ 层网络，第 $l$ 层的计算：

$$
\mathbf{z}^{(l)} = W^{(l)} \mathbf{a}^{(l-1)} + \mathbf{b}^{(l)}
$$

$$
\mathbf{a}^{(l)} = f^{(l)}(\mathbf{z}^{(l)})
$$

其中 $\mathbf{a}^{(0)} = \mathbf{x}$ 为输入，$\mathbf{a}^{(L)} = \hat{\mathbf{y}}$ 为输出。

### 反向传播

损失函数 $J$ 关于第 $l$ 层参数的梯度通过链式法则逐层传播：

$$
\delta^{(l)} = \frac{\partial J}{\partial \mathbf{z}^{(l)}} =
\begin{cases}
\hat{\mathbf{y}} - \mathbf{y}, & l = L \\[6pt]
(W^{(l+1)})^T \delta^{(l+1)} \odot f'(\mathbf{z}^{(l)}), & l < L
\end{cases}
$$

参数梯度：

$$
\frac{\partial J}{\partial W^{(l)}} = \delta^{(l)} (\mathbf{a}^{(l-1)})^T, \quad
\frac{\partial J}{\partial \mathbf{b}^{(l)}} = \delta^{(l)}
$$

## 激活函数

| 激活函数 | 公式 | 值域 | 导数 | 优点 | 缺点 |
|----------|------|------|------|------|------|
| Sigmoid | $\sigma(z)=\frac{1}{1+e^{-z}}$ | $(0,1)$ | $\sigma(z)(1-\sigma(z))$ | 平滑、可解释为概率 | 梯度消失、非零中心 |
| Tanh | $\tanh(z)=\frac{e^z-e^{-z}}{e^z+e^{-z}}$ | $(-1,1)$ | $1-\tanh^2(z)$ | 零中心 | 仍存在梯度消失 |
| ReLU | $\max(0,z)$ | $[0,\infty)$ | $0$ (z<0), $1$ (z>0) | 计算快、缓解梯度消失 | 神经元死亡 (Dying ReLU) |
| Leaky ReLU | $\max(0.01z, z)$ | $(-\infty,\infty)$ | $0.01$ (z<0), $1$ (z>0) | 解决 Dying ReLU | 负区间参数需手动设定 |
| ELU | $\begin{cases}z,&z>0\\\alpha(e^z-1),&z\le0\end{cases}$ | $(-\alpha,\infty)$ | $1$ (z>0), $\text{ELU}+\alpha$ | 零均值输出 | 计算指数开销大 |
| GELU | $z\Phi(z)$ | $(-\infty,\infty)$ | 近似 | Transformer 标配 | 计算略复杂 |
| Swish | $z\sigma(\beta z)$ | $(-\infty,\infty)$ | 平滑 | EfficientNet 使用 | 多一个参数 $\beta$ |

### 激活函数图示

```python
import numpy as np
import matplotlib.pyplot as plt

def sigmoid(x):    return 1 / (1 + np.exp(-x))
def tanh(x):       return np.tanh(x)
def relu(x):       return np.maximum(0, x)
def leaky_relu(x): return np.maximum(0.01 * x, x)
def gelu(x):       return 0.5*x*(1+np.tanh(np.sqrt(2/np.pi)*(x+0.044715*x**3)))

x = np.linspace(-4, 4, 500)
for name, fn in [("ReLU",relu),("Tanh",tanh),("Sigmoid",sigmoid),
                  ("Leaky ReLU",leaky_relu),("GELU",gelu)]:
    plt.plot(x, fn(x), label=name)
plt.axhline(0, c="gray", ls=":")
plt.legend(); plt.grid(alpha=0.3); plt.title("Activation Functions")
plt.show()
```

## 常用损失函数

| 任务 | 损失函数 | 公式 |
|------|----------|------|
| 二分类 | Binary Cross-Entropy | $J = -\frac{1}{n}\sum [y\log\hat{y}+(1-y)\log(1-\hat{y})]$ |
| 多分类 | Categorical Cross-Entropy | $J = -\frac{1}{n}\sum\sum y_{ik}\log\hat{y}_{ik}$ |
| 回归 | MSE | $J = \frac{1}{n}\sum (\hat{y}_i - y_i)^2$ |
| 回归(稳健) | Huber | $J = \begin{cases}\frac{1}{2}(y-\hat{y})^2,&|y-\hat{y}|\le\delta\\\delta|y-\hat{y}|-\frac{1}{2}\delta^2,&\text{else}\end{cases}$ |

## 梯度下降变体对比

| 变体 | 更新规则 | 优点 | 缺点 | 适用场景 |
|------|----------|------|------|----------|
| SGD (批量) | $\theta \leftarrow \theta - \eta\nabla_\theta J$ | 简单、理论保证 | 易振荡、对学习率敏感 | 凸优化 |
| SGD + Momentum | $v\leftarrow\gamma v+\eta\nabla_\theta J$; $\theta\leftarrow\theta-v$ | 加速、平滑震荡 | 超参数 $\gamma$ 需调 | 深度网络首选 |
| NAG | 先按动量走半程再算梯度 | 更精确地看前方 | 实现略复杂 | — |
| AdaGrad | $s\leftarrow s+(\nabla J)^2$; $\theta\leftarrow\theta-\frac{\eta}{\sqrt{s+\epsilon}}\nabla J$ | 自适应学习率 | 学习率单调递减至0 | 稀疏数据 |
| RMSprop | $s\leftarrow\beta s+(1-\beta)(\nabla J)^2$ | 缓解 AdaGrad 衰减 | 需要 $\beta$ 参数 | RNN/Deep |
| Adam | $m\leftarrow\beta_1 m+(1-\beta_1)\nabla J$; $v\leftarrow\beta_2 v+(1-\beta_2)(\nabla J)^2$; 修正后更新 | 结合 Momentum + RMSprop；De facto 标准 | 偶尔泛化不如 SGD | 绝大多数场景 |

Adam 的完整更新公式：

$$
m_t = \beta_1 m_{t-1} + (1-\beta_1) g_t, \quad v_t = \beta_2 v_{t-1} + (1-\beta_2) g_t^2
$$

$$
\hat{m}_t = \frac{m_t}{1-\beta_1^t}, \quad \hat{v}_t = \frac{v_t}{1-\beta_2^t}
$$

$$
\theta_t = \theta_{t-1} - \eta \frac{\hat{m}_t}{\sqrt{\hat{v}_t} + \epsilon}
$$

其中 $g_t = \nabla_\theta J(\theta_{t-1})$，典型配置：$\beta_1=0.9,\beta_2=0.999,\epsilon=10^{-8}$。

## 参数初始化

### Xavier (Glorot) 初始化

适用于 Sigmoid/Tanh 网络。权重采样自均匀或正态分布，使得前向和反向传播的方差保持一致：

$$
W \sim U\left[-\frac{\sqrt{6}}{\sqrt{n_{\text{in}}+n_{\text{out}}}},\;
\frac{\sqrt{6}}{\sqrt{n_{\text{in}}+n_{\text{out}}}}\right]
$$

或正态版本：

$$
W \sim \mathcal{N}\left(0,\;\frac{2}{n_{\text{in}}+n_{\text{out}}}\right)
$$

### He 初始化

专为 ReLU 及变体设计，因 ReLU 负半区为 0，方差需扩大 2 倍：

$$
W \sim \mathcal{N}\left(0,\;\frac{2}{n_{\text{in}}}\right)
$$

### 初始化策略对比

| 策略 | 适用激活 | 方差保持 | 训练稳定性 | 默认框架 |
|------|----------|----------|------------|----------|
| Xavier Uniform | Sigmoid, Tanh | 输入+输出平均 | 中等 | PyTorch Linear 默认(old) |
| He Normal | ReLU, LeakyReLU | 仅输入维度 | 好 | PyTorch Linear 默认(new), Keras 默认 |
| He Uniform | ReLU, GELU | 仅输入维度 | 好 | torch.nn.init.kaiming_uniform_ |
| 常零初始化 | — | — | **不可用** | 导致对称失效 |

**核心结论**：现代 CNN 和 Transformer 几乎统一使用 He 初始化或在小范围内上下调整。Xavier 仅用于激活函数为 Sigmoid/Tanh 的古老网络。实际开发中直接使用框架默认即可（PyTorch 默认 kaiming_uniform_）。

## 完整 PyTorch 训练循环

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms
from sklearn.metrics import classification_report
import numpy as np
from tqdm import tqdm

# ── 1. 超参数 ──
BATCH_SIZE  = 128
LR          = 1e-3
EPOCHS      = 20
DEVICE      = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SEED        = 42
torch.manual_seed(SEED)

# ── 2. 数据加载与增强 ──
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,))
])
full_train = datasets.FashionMNIST(root="./data", train=True,
                                    download=True, transform=transform)
train_ds, val_ds = random_split(full_train, [50000, 10000])
test_ds  = datasets.FashionMNIST(root="./data", train=False,
                                  transform=transform)
train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE)
test_loader  = DataLoader(test_ds,  batch_size=BATCH_SIZE)

# ── 3. 模型定义 ──
class MLP(nn.Module):
    def __init__(self, in_dim=784, h1=256, h2=128, num_classes=10,
                 dropout=0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(in_dim, h1), nn.ReLU(), nn.BatchNorm1d(h1),
            nn.Dropout(dropout),
            nn.Linear(h1, h2),    nn.ReLU(), nn.BatchNorm1d(h2),
            nn.Dropout(dropout),
            nn.Linear(h2, num_classes)
        )
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.kaiming_uniform_(m.weight, nonlinearity="relu")
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def forward(self, x):
        return self.net(x)

model = MLP().to(DEVICE)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=LR)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

# ── 4. 训练+验证 ──
def train_epoch():
    model.train()
    total_loss, correct = 0, 0
    for x, y in train_loader:
        x, y = x.to(DEVICE), y.to(DEVICE)
        optimizer.zero_grad()
        loss = criterion(model(x), y)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * len(y)
        correct   += (model(x).argmax(1) == y).sum().item()
    n = len(train_loader.dataset)
    return total_loss / n, correct / n

@torch.no_grad()
def eval_epoch(loader, name):
    model.eval()
    total_loss, correct, all_preds, all_labels = 0, 0, [], []
    for x, y in loader:
        x, y = x.to(DEVICE), y.to(DEVICE)
        logits = model(x)
        loss   = criterion(logits, y)
        total_loss += loss.item() * len(y)
        preds = logits.argmax(1)
        correct += (preds == y).sum().item()
        all_preds.extend(preds.cpu().tolist())
        all_labels.extend(y.cpu().tolist())
    n = len(loader.dataset)
    acc = correct / n
    print(f"{name}: loss={total_loss/n:.4f}, acc={acc:.4f}")
    return total_loss / n, acc, all_preds, all_labels

best_val_acc = 0.0
for epoch in range(1, EPOCHS + 1):
    tr_loss, tr_acc = train_epoch()
    val_loss, val_acc, _, _ = eval_epoch(val_loader, "Val")
    scheduler.step()
    print(f"Epoch {epoch:2d}: train_loss={tr_loss:.4f}, "
          f"train_acc={tr_acc:.4f}, val_loss={val_loss:.4f}, "
          f"val_acc={val_acc:.4f}, lr={scheduler.get_last_lr()[0]:.6f}")
    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save(model.state_dict(), "best_mlp_model.pt")

# ── 5. 测试 ──
model.load_state_dict(torch.load("best_mlp_model.pt"))
test_loss, test_acc, preds, labels = eval_epoch(test_loader, "Test")
print(f"\\nFinal Test Accuracy: {test_acc:.4f}")
print(classification_report(labels, preds,
      target_names=[f"cls_{i}" for i in range(10)]))
```

## 深度网络训练技巧

- **Batch Normalization**：对每个 mini-batch 归一化激活值，加速训练、允许更大学习率
- **Dropout**：训练时随机丢弃神经元，防止过拟合（rate 通常 0.2~0.5）
- **学习率调度**：Cosine Annealing、ReduceLROnPlateau、Warmup
- **Early Stopping**：验证 loss 不再下降时停止训练
- **梯度裁剪**：防止梯度爆炸，尤其是在 RNN 中

## 延伸参考

- d2l.ai — 《动手学深度学习》第 4 章 多层感知机：https://d2l.ai/chapter_multilayer-perceptrons/index.html
- PyTorch torch.nn 文档：https://pytorch.org/docs/stable/nn.html
- PyTorch 激活函数文档：https://pytorch.org/docs/stable/nn.html#non-linear-activations-weighted-sum-nonlinearity
- PyTorch 初始化文档：https://pytorch.org/docs/stable/nn.init.html
- Deep Learning Book 第 6 章：https://www.deeplearningbook.org/contents/mlp.html""",
        goals=[
            "手推前向传播和反向传播的矩阵形式",
            "能比较并选择合适的激活函数",
            "理解不同梯度下降变体的差异",
            "能用 PyTorch 编写完整的训练+验证循环",
        ],
        checklist=[
            "能写出三层 MLP 的前向和反向传播伪代码",
            "能解释为什么 sigmoid 在深层网络中表现差",
            "能说出 Adam 相对于 SGD 的三个改进点",
            "能在 FashionMNIST 上完成一次训练流程",
        ],
        experiments=[
            {
                "title": "激活函数对比实验",
                "goal": "在相同 MLP 上分别使用 ReLU/Tanh/Sigmoid/LeakyReLU 训练，比较收敛速度和最终准确率",
                "steps": [
                    "复制训练代码，将激活函数改为变量",
                    "分别训练 20 epochs，记录验证曲线",
                    "绘制四种激活函数的 loss/acc 曲线对比",
                ],
                "output": "激活函数对比图",
                "difficulty": "intermediate",
            }
        ],
        glossary=[
            {"term": "感知机", "definition": "单层线性分类器，是神经网络的雏形"},
            {"term": "反向传播", "definition": "利用链式法则从输出层向输入层逐层计算梯度的算法"},
            {"term": "梯度消失", "definition": "深层网络中靠近输入层的梯度趋近于零，导致参数几乎不更新"},
            {"term": "Batch Normalization", "definition": "对每个 mini-batch 的激活值做标准化，使训练更稳定"},
            {"term": "Dropout", "definition": "训练时以概率 p 随机丢弃神经元，缓解过拟合"},
            {"term": "Momentum", "definition": "动量法，用历史梯度的指数移动平均来加速 SGD"},
        ],
        references=[
            {
                "title": "Deep Learning Book 第 6 章 — Deep Feedforward Networks",
                "source": "Ian Goodfellow, Yoshua Bengio, Aaron Courville",
                "url": "https://www.deeplearningbook.org/contents/mlp.html",
            },
            {
                "title": "d2l.ai — 多层感知机",
                "source": "Aston Zhang et al.",
                "url": "https://d2l.ai/chapter_multilayer-perceptrons/index.html",
            },
            {
                "title": "PyTorch nn 模块文档",
                "source": "PyTorch",
                "url": "https://pytorch.org/docs/stable/nn.html",
            },
            {
                "title": "He 初始化论文 (2015)",
                "source": "Kaiming He et al.",
                "url": "https://arxiv.org/abs/1502.01852",
            },
        ],
        prerequisites=["introduction", "math-foundations", "model-evaluation"],
        keywords=[
            "感知机",
            "多层感知机",
            "反向传播",
            "激活函数",
            "ReLU",
            "GELU",
            "SGD",
            "Adam",
            "Xavier初始化",
            "He初始化",
            "Batch Normalization",
            "Dropout",
            "梯度消失",
        ],
        quiz=[
            {
                "question": "ReLU 的主要缺点是什么？",
                "options": ["计算太慢", "梯度消失", "Dying ReLU", "输出不是零中心"],
                "correctIndex": 2,
                "explanation": "当输入恒为负时 ReLU 梯度为零，该神经元可能永久失活（Dying ReLU）。",
            },
            {
                "question": "He 初始化的方差缩放因子是多少？",
                "options": ["1/n_in", "2/n_in", "2/(n_in+n_out)", "1/sqrt(n_in)"],
                "correctIndex": 1,
                "explanation": "He 初始化使用 $2/n_{\\text{in}}$ 来补偿 ReLU 在负半区输出的方差损失。",
            },
        ],
        sort_order=9,
        enabled=True,
    )
)

# ═══════════════════════════════════════════════════════════════
# Ch10: CNN与RNN
# ═══════════════════════════════════════════════════════════════
CH.append(
    dict(
        slug="cnn-rnn",
        chapter_number=10,
        title="CNN与RNN",
        summary=(
            "掌握卷积神经网络的核心操作（卷积、池化、通道），了解经典架构演进，"
            "同时深入 RNN/LSTM/GRU 及其双向变体。"
        ),
        difficulty="intermediate",
        estimated_minutes=75,
        markdown=r"""# CNN与RNN

## 学习定位

本章涵盖深度学习中两大基础架构：CNN 处理网格化数据（图像），RNN 处理序列数据
（文本/时序）。理解两者的核心操作和经典变体，为 Transformer 打下基础。

---

## Part A: 卷积神经网络 (CNN)

### 核心操作

#### 卷积层

给定输入张量 $X \in \mathbb{R}^{H \times W \times C_{in}}$ 和卷积核
$K \in \mathbb{R}^{k_h \times k_w \times C_{in} \times C_{out}}$，输出特征图的计算：

$$
Y_{i,j,o} = \sum_{c=0}^{C_{in}-1} \sum_{u=0}^{k_h-1} \sum_{v=0}^{k_w-1}
X_{i+u,\;j+v,\;c} \cdot K_{u,v,c,o} + b_o
$$

输出尺寸公式（valid padding）：

$$
H_{out} = \left\lfloor \frac{H_{in} - k_h + 2P}{S} \right\rfloor + 1
$$

其中 $P$ 为 padding，$S$ 为 stride。

#### 池化层

| 池化类型 | 操作 | 作用 |
|----------|------|------|
| Max Pooling | $\max$ 局部窗口 | 保留纹理信息、提供平移不变性 |
| Average Pooling | 局部窗口取均值 | 平滑特征、减少方差 |
| Global Average Pooling | 对整张特征图取均值 | 替代 Flatten+FC，减少参数量 |
| Adaptive Pooling | 指定输出尺寸自动算窗口 | 接受任意尺寸输入 |

### CNN 三大特性

1. **局部连接（稀疏交互）**：每个神经元只连接输入的一个局部区域，参数量从
   $O(n^2)$ 降到 $O(k^2)$。
2. **参数共享**：同一个卷积核在整个输入上滑动，极大地减少参数量。
3. **平移等变性**：输入平移 $\Rightarrow$ 输出同等平移（池化引入平移不变性）。

### 感受野计算

$$
RF_k = RF_{k-1} + (kernel_k - 1) \times \prod_{i=1}^{k-1} stride_i
$$

深层神经元的感受野层层累加，高层可覆盖整个输入图像。

### 经典架构对比

| 架构 | 年份 | 层数 | 参数量 | Top-5 错误率 | 关键创新 |
|------|------|------|--------|-------------|----------|
| LeNet-5 | 1998 | 7 | 60K | — | CNN 鼻祖，手写数字识别 |
| AlexNet | 2012 | 8 | 60M | 15.3% | ReLU、Dropout、GPU 训练 |
| VGG-16 | 2014 | 16 | 138M | 7.3% | 全用 3×3 卷积，深且规整 |
| GoogLeNet (Inception v1) | 2014 | 22 | 5M | 6.7% | Inception 模块、1×1 卷积降维 |
| ResNet-50 | 2015 | 50 | 25M | 3.6% | 残差连接，解决深层退化 |
| ResNet-152 | 2015 | 152 | 60M | 3.0% | 首次超越人类 Top-5 水平 |
| DenseNet-121 | 2017 | 121 | 8M | — | 密集连接，特征复用 |
| EfficientNet-B7 | 2019 | — | 66M | — | 复合缩放 (深度+宽度+分辨率) |

### ResNet 残差连接

$$
\mathbf{y} = \mathcal{F}(\mathbf{x}, \{W_i\}) + \mathbf{x}
$$

残差连接让网络学习恒等映射的扰动，解决了深层网络的退化问题。当维度不匹配时，
使用 $1\times1$ 卷积做投影：

$$
\mathbf{y} = \mathcal{F}(\mathbf{x}, \{W_i\}) + W_s \mathbf{x}
$$

### 完整 PyTorch CNN for CIFAR-10

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import torch.nn.functional as F

# ── 数据增强 ──
train_transform = transforms.Compose([
    transforms.RandomCrop(32, padding=4),          # 先 pad 再随机裁剪
    transforms.RandomHorizontalFlip(p=0.5),        # 水平翻转
    transforms.ColorJitter(0.1, 0.1, 0.1, 0.05),   # 颜色抖动
    transforms.ToTensor(),
    transforms.Normalize((0.4914, 0.4822, 0.4465),
                         (0.2023, 0.1994, 0.2010))
])
test_transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.4914, 0.4822, 0.4465),
                         (0.2023, 0.1994, 0.2010))
])

train_ds = datasets.CIFAR10("./data", train=True, download=True,
                            transform=train_transform)
test_ds  = datasets.CIFAR10("./data", train=False, download=True,
                            transform=test_transform)
train_loader = DataLoader(train_ds, batch_size=128, shuffle=True,
                          num_workers=2)
test_loader  = DataLoader(test_ds,  batch_size=128, shuffle=False,
                          num_workers=2)

# ── 模型：ResNet-18 风格 ──
class ResidualBlock(nn.Module):
    expansion = 1
    def __init__(self, in_c, out_c, stride=1):
        super().__init__()
        self.conv1 = nn.Conv2d(in_c, out_c, 3, stride, 1, bias=False)
        self.bn1   = nn.BatchNorm2d(out_c)
        self.conv2 = nn.Conv2d(out_c, out_c, 3, 1, 1, bias=False)
        self.bn2   = nn.BatchNorm2d(out_c)
        self.shortcut = nn.Sequential()
        if stride != 1 or in_c != out_c:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_c, out_c, 1, stride, bias=False),
                nn.BatchNorm2d(out_c)
            )

    def forward(self, x):
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += self.shortcut(x)
        return F.relu(out)

class ResNet18(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.in_planes = 64
        self.conv1 = nn.Conv2d(3, 64, 3, 1, 1, bias=False)
        self.bn1   = nn.BatchNorm2d(64)
        self.layer1 = self._make_layer(64, 2, stride=1)
        self.layer2 = self._make_layer(128, 2, stride=2)
        self.layer3 = self._make_layer(256, 2, stride=2)
        self.layer4 = self._make_layer(512, 2, stride=2)
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(512, num_classes)

    def _make_layer(self, planes, blocks, stride):
        strides = [stride] + [1] * (blocks - 1)
        layers = []
        for s in strides:
            layers.append(ResidualBlock(self.in_planes, planes, s))
            self.in_planes = planes
        return nn.Sequential(*layers)

    def forward(self, x):
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.layer1(out)
        out = self.layer2(out)
        out = self.layer3(out)
        out = self.layer4(out)
        out = self.avgpool(out)
        out = out.view(out.size(0), -1)
        return self.fc(out)

# ── 训练 ──
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = ResNet18().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = optim.SGD(model.parameters(), lr=0.1, momentum=0.9,
                      weight_decay=5e-4)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=200)

for epoch in range(200):
    model.train()
    train_loss, correct = 0, 0
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)
        optimizer.zero_grad()
        loss = criterion(model(x), y)
        loss.backward()
        optimizer.step()
        train_loss += loss.item() * len(y)
        correct   += (model(x).argmax(1) == y).sum().item()
    scheduler.step()

    if epoch % 10 == 0:
        print(f"Epoch {epoch}: loss={train_loss/50000:.4f}, "
              f"acc={correct/50000:.4f}")

# Final test
model.eval()
correct = 0
with torch.no_grad():
    for x, y in test_loader:
        x, y = x.to(device), y.to(device)
        correct += (model(x).argmax(1) == y).sum().item()
print(f"Test Accuracy: {correct / 10000:.4f}")
```

---

## Part B: 循环神经网络 (RNN)

### 基本 RNN

给定输入序列 $\{x_1, x_2, \dots, x_T\}$，RNN 在每个时间步更新隐藏状态：

$$
h_t = \tanh(W_{hh} h_{t-1} + W_{xh} x_t + b_h)
$$

$$
\hat{y}_t = \text{softmax}(W_{hy} h_t + b_y)
$$

RNN 的梯度通过时间反向传播 (BPTT) 计算。对于长序列，
连乘的 Jacobian 矩阵易导致**梯度消失**或**梯度爆炸**。

### RNN 的问题

深层 RNN 的梯度在反向传播时会经历多次连乘，当递归权重矩阵 $W_{hh}$ 的谱半径
小于 1 时梯度指数衰减，大于 1 时指数爆炸：

$$
\frac{\partial h_T}{\partial h_1} = \prod_{t=2}^{T} \frac{\partial h_t}{\partial h_{t-1}}
\approx \prod_{t=2}^{T} \operatorname{diag}(\tanh'( \cdot )) W_{hh}^T
$$

### LSTM (长短期记忆网络)

LSTM 通过门控机制解决了长程依赖问题：

$$
\begin{aligned}
f_t &= \sigma(W_f [h_{t-1}, x_t] + b_f) \quad &\text{遗忘门} \\
i_t &= \sigma(W_i [h_{t-1}, x_t] + b_i) \quad &\text{输入门} \\
\tilde{c}_t &= \tanh(W_c [h_{t-1}, x_t] + b_c) \quad &\text{候选记忆} \\
c_t &= f_t \odot c_{t-1} + i_t \odot \tilde{c}_t \quad &\text{细胞状态更新} \\
o_t &= \sigma(W_o [h_{t-1}, x_t] + b_o) \quad &\text{输出门} \\
h_t &= o_t \odot \tanh(c_t) \quad &\text{隐藏状态}
\end{aligned}
$$

**关键设计**：$c_t$ 的梯度通过加法门 + 逐元素乘法形成高速通道，避免了
Sigmoid/Tanh 导致的梯度消失。遗忘门 $f_t$ 可以自主决定保留多少旧记忆。

### GRU (门控循环单元)

GRU 是 LSTM 的简化版，将遗忘门和输入门合并为更新门：

$$
\begin{aligned}
z_t &= \sigma(W_z [h_{t-1}, x_t]) \quad &\text{更新门} \\
r_t &= \sigma(W_r [h_{t-1}, x_t]) \quad &\text{重置门} \\
\tilde{h}_t &= \tanh(W [r_t \odot h_{t-1}, x_t]) \quad &\text{候选隐藏状态} \\
h_t &= (1 - z_t) \odot h_{t-1} + z_t \odot \tilde{h}_t
\end{aligned}
$$

### LSTM 展开示意图

时间维度上，LSTM 每个时间步接收输入 $x_t$ 和上一时刻的 $(h_{t-1}, c_{t-1})$，
输出 $(h_t, c_t)$。可以理解为"两种状态在时间轴上移动"：

```
        y_1        y_2        y_3        y_T
         ^          ^          ^          ^
         |          |          |          |
    h_0 →[LSTM]→h_1→[LSTM]→h_2→[LSTM]→h_3 ... →h_T
    c_0 →     →c_1→      →c_2→      →c_3 ... →c_T
         ^          ^          ^          ^
         |          |          |          |
        x_1        x_2        x_3        x_T
```

### 双向 LSTM (BiLSTM)

标准 LSTM 只能利用过去的信息。BiLSTM 同时运行前向和后向两个 LSTM，
在每个时间步拼接两个方向的隐藏状态：

$$
\overrightarrow{h_t} = \text{LSTM}_{fw}(x_t, \overrightarrow{h_{t-1}})
$$

$$
\overleftarrow{h_t} = \text{LSTM}_{bw}(x_t, \overleftarrow{h_{t+1}})
$$

$$
h_t^{\text{bi}} = [\overrightarrow{h_t}; \overleftarrow{h_t}]
$$

BiLSTM 在序列标注（NER、POS tagging）和文本分类中效果显著。

### RNN 变体对比

| 模型 | 参数量 | 长程依赖 | 训练速度 | 适用场景 |
|------|--------|----------|----------|----------|
| Simple RNN | 最少 | 差 (≈10步) | 最快 | 短序列、教科书 |
| LSTM | 多 (4门) | 好 | 中等 | 文本生成、翻译 |
| GRU | 中 (3门) | 较好 | 较快 | 中小型序列任务 |
| BiLSTM | LSTM ×2 | 好 | LSTM ×2 | 序列标注、分类 |
| Stacked LSTM | LSTM ×层数 | 更好 | 更慢 | 复杂序列建模 |

## PyTorch RNN 示例

```python
import torch
import torch.nn as nn

class SentimentLSTM(nn.Module):
    def __init__(self, vocab_size, embed_dim=128, hidden_dim=256,
                 num_layers=2, num_classes=2, dropout=0.3,
                 bidirectional=True):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, num_layers,
                            batch_first=True, dropout=dropout,
                            bidirectional=bidirectional)
        D = hidden_dim * (2 if bidirectional else 1)
        self.fc = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(D, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, num_classes)
        )

    def forward(self, x):
        # x: [batch, seq_len]
        emb   = self.embedding(x)         # [B, L, E]
        out, (h, c) = self.lstm(emb)      # out: [B, L, D]
        # 取最后时间步的输出（或拼接前向/后向）
        last = out[:, -1, :]              # [B, D]
        return self.fc(last)

model = SentimentLSTM(vocab_size=10000, bidirectional=True)
print(model(torch.randint(0, 10000, (32, 50))).shape)  # [32, 2]
```

## 延伸参考

- d2l.ai 第 7 章 CNN：https://d2l.ai/chapter_convolutional-neural-networks/index.html
- d2l.ai 第 9 章 RNN：https://d2l.ai/chapter_recurrent-neural-networks/index.html
- PyTorch Conv2d 文档：https://pytorch.org/docs/stable/generated/torch.nn.Conv2d.html
- PyTorch LSTM 文档：https://pytorch.org/docs/stable/generated/torch.nn.LSTM.html
- ResNet 论文：https://arxiv.org/abs/1512.03385
- Deep Learning Book 第 9-10 章：https://www.deeplearningbook.org/""",
        goals=[
            "理解卷积、池化的计算过程和三大特性",
            "能对比分析经典 CNN 架构的演进",
            "理解 RNN 梯度消失的原因及 LSTM 的解决方案",
            "能用 PyTorch 搭建 CNN 和 BiLSTM 模型",
        ],
        checklist=[
            "能写出卷积输出尺寸计算公式",
            "能解释 ResNet 残差连接为什么有效",
            "能画出 LSTM 的门控结构图",
            "能区分单向 LSTM 和双向 LSTM 的适用场景",
        ],
        experiments=[
            {
                "title": "CNN 架构对比",
                "goal": "在 CIFAR-10 上对比自定义 CNN vs ResNet-18 vs 预训练 ResNet-18",
                "steps": [
                    "实现或加载三种模型",
                    "统一训练配置，各训练 50 epochs",
                    "输出 Top-1 准确率、参数量、推理时间对比表",
                ],
                "output": "架构对比表格",
                "difficulty": "intermediate",
            }
        ],
        glossary=[
            {"term": "卷积核", "definition": "一个小矩阵，在输入上滑动进行局部加权求和"},
            {"term": "感受野", "definition": "CNN 某层特征图上一点对应的原始输入区域大小"},
            {"term": "残差连接", "definition": "将层的输入直接加回到输出，形成恒等快捷路径"},
            {"term": "BPTT", "definition": "Backpropagation Through Time，沿时间展开的链式梯度计算"},
            {"term": "LSTM", "definition": "长短期记忆网络，通过门控机制控制信息流动"},
            {"term": "门控单元", "definition": "使用 sigmoid 输出 0-1 之间的值来控制信息通过的多少"},
        ],
        references=[
            {
                "title": "d2l.ai — 卷积神经网络",
                "source": "Aston Zhang et al.",
                "url": "https://d2l.ai/chapter_convolutional-neural-networks/index.html",
            },
            {
                "title": "d2l.ai — 现代卷积神经网络",
                "source": "Aston Zhang et al.",
                "url": "https://d2l.ai/chapter_convolutional-modern/index.html",
            },
            {
                "title": "Deep Residual Learning for Image Recognition (ResNet)",
                "source": "K. He, X. Zhang, S. Ren, J. Sun",
                "url": "https://arxiv.org/abs/1512.03385",
            },
            {
                "title": "LSTM 论文 (1997)",
                "source": "Hochreiter & Schmidhuber",
                "url": "https://www.bioinf.jku.at/publications/older/2604.pdf",
            },
            {
                "title": "PyTorch LSTM 文档",
                "source": "PyTorch",
                "url": "https://pytorch.org/docs/stable/generated/torch.nn.LSTM.html",
            },
        ],
        prerequisites=["neural-networks"],
        keywords=[
            "CNN",
            "卷积",
            "池化",
            "ResNet",
            "残差连接",
            "RNN",
            "LSTM",
            "GRU",
            "BiLSTM",
            "BPTT",
            "梯度消失",
            "门控机制",
        ],
        quiz=[
            {
                "question": "为什么深层网络使用 3×3 小卷积核而不是 11×11 大核？",
                "options": [
                    "大卷积核太慢",
                    "两层 3×3 的感受野等于一层 5×5，且参数量更少、非线性更强",
                    "3×3 的 GPU 优化更好",
                    "以上全部",
                ],
                "correctIndex": 3,
                "explanation": "以上都是原因：两层 3×3 有 5×5 感受野但参数量为 $2\\times9=18$ vs $25$，且多了一层 ReLU。同时 cuDNN 对 3×3 优化极好。",
            },
            {
                "question": "LSTM 中哪个组件控制遗忘旧记忆？",
                "options": ["输入门", "遗忘门", "输出门", "候选记忆"],
                "correctIndex": 1,
                "explanation": "遗忘门 $f_t$ 对 $c_{t-1}$ 进行逐元素乘法，决定保留多少旧记忆。",
            },
        ],
        sort_order=10,
        enabled=True,
    )
)

# ═══════════════════════════════════════════════════════════════
# Ch11: Transformer与注意力机制
# ═══════════════════════════════════════════════════════════════
CH.append(
    dict(
        slug="transformers",
        chapter_number=11,
        title="Transformer与注意力机制",
        summary=(
            "深入 Self-Attention 的矩阵运算、Multi-Head Attention 设计、"
            "BERT/GPT/T5 架构对比，以及 HuggingFace 实战。"
        ),
        difficulty="advanced",
        estimated_minutes=75,
        markdown=r"""# Transformer与注意力机制

## 学习定位

Transformer (Vaswani et al., 2017) 彻底改变了 NLP 和 CV。本章从
Self-Attention 的矩阵运算出发，逐步剖析完整架构，最后实践 HuggingFace。

## 为什么需要 Attention

RNN 的局限：序列计算不可并行，长程依赖受限。Attention 直接建模任意位置
之间的依赖，且完全可并行化。

## Scaled Dot-Product Attention

$$
\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right) V
$$

除以 $\sqrt{d_k}$ 是为了防止点积过大导致 softmax 梯度消失。

### 矩阵维度推导

假设批量大小 $B$，序列长度 $S$，隐藏维度 $d_{model}=512$，
头数 $h=8$，每头维度 $d_k = d_{model}/h = 64$。

| Step | 计算 | 输入形状 | 输出形状 |
|------|------|----------|----------|
| 线性投影 (Q) | $XW^Q$ | $X: [B, S, 512]$ | $Q: [B, S, 512]$ |
| 分头 | reshape | $[B, S, 512]$ | $[B, h, S, 64]$ |
| 注意力分数 | $QK^T / \sqrt{d_k}$ | $Q,K: [B,h,S,64]$ | $[B, h, S, S]$ |
| Softmax | 沿最后维度 | $[B, h, S, S]$ | $[B, h, S, S]$ |
| 加权求和 | $\times V$ | $V: [B,h,S,64]$ | $[B, h, S, 64]$ |
| 合并头 | reshape | $[B, h, S, 64]$ | $[B, S, 512]$ |
| 输出投影 | $\times W^O$ | $[B, S, 512]$ | $[B, S, 512]$ |

### 完整 Self-Attention 矩阵计算（手动 NumPy 版）

```python
import numpy as np

def scaled_dot_product_attention(Q, K, V, mask=None):
    # Q, K, V: [batch, heads, seq, d_k]
    d_k = Q.shape[-1]
    scores = np.matmul(Q, K.transpose(0, 1, 3, 2)) / np.sqrt(d_k)

    if mask is not None:
        scores = scores + mask  # 掩码位置设为 -inf

    attn_weights = softmax(scores, axis=-1)  # [B, h, S, S]
    output = np.matmul(attn_weights, V)       # [B, h, S, d_k]
    return output, attn_weights

def softmax(x, axis=-1):
    e_x = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e_x / np.sum(e_x, axis=axis, keepdims=True)

# 示例
B, h, S, d = 2, 2, 5, 4
Q = np.random.randn(B, h, S, d)
K = np.random.randn(B, h, S, d)
V = np.random.randn(B, h, S, d)
out, w = scaled_dot_product_attention(Q, K, V)
print(f"Output: {out.shape}, Attention Weights: {w.shape}")
# Output: (2, 2, 5, 4), Attention Weights: (2, 2, 5, 5)
```

### 注意力可视化概念

Attention weights 矩阵 $\mathbf{A} \in \mathbb{R}^{S \times S}$ 中，
$A_{ij}$ 表示位置 $i$ 对位置 $j$ 的"关注程度"。

- **Self-Attention 热力图**：每行显示一个 token 对全序列的注意力分布
- **Encoder-Decoder Attention**：解码器对编码器输出的关注
- **多头模式**：不同头捕获不同的语法/语义关系（局部短语 vs 长距离依赖）

```python
import matplotlib.pyplot as plt
import seaborn as sns

# 假设 attn 是最后一个头的注意力权重 [S, S]
plt.figure(figsize=(8, 6))
sns.heatmap(attn, cmap="YlOrRd", xticklabels=False, yticklabels=False)
plt.title("Self-Attention Heatmap")
plt.xlabel("Key Position"); plt.ylabel("Query Position")
plt.show()
```

## Multi-Head Attention

$$
\begin{aligned}
\text{MultiHead}(Q, K, V) &= \text{Concat}(\text{head}_1, \dots, \text{head}_h) W^O \\
\text{head}_i &= \text{Attention}(Q W_i^Q,\; K W_i^K,\; V W_i^V)
\end{aligned}
$$

多头允许模型在不同子空间联合关注不同位置的信息。

## Positional Encoding

Transformer 没有递归也不卷积，需要显式注入位置信息：

$$
\begin{aligned}
PE_{(pos, 2i)} &= \sin\left(\frac{pos}{10000^{2i/d_{model}}}\right) \\
PE_{(pos, 2i+1)} &= \cos\left(\frac{pos}{10000^{2i/d_{model}}}\right)
\end{aligned}
$$

正弦/余弦编码使得模型可以外推到训练时未见过的序列长度。

## Transformer 完整架构

```
Input → Input Embedding + Positional Encoding
     → [Encoder × N]
         → Multi-Head Self-Attention → Add & Norm
         → FFN (Linear → ReLU → Linear) → Add & Norm
     → [Decoder × N]
         → Masked Multi-Head Self-Attention → Add & Norm
         → Cross-Attention (Encoder-Decoder) → Add & Norm
         → FFN → Add & Norm
     → Linear + Softmax → Output
```

## 三大预训练模型对比

| 特性 | BERT | GPT | T5 |
|------|------|-----|-----|
| 架构 | Encoder-only | Decoder-only | Encoder-Decoder |
| 预训练目标 | MLM + NSP | Autoregressive LM | Span Corruption (Text-to-Text) |
| 方向性 | 双向 | 单向（左→右） | Encoder 双向, Decoder 自回归 |
| 年份 | 2018 (Google) | 2018→GPT-4 (OpenAI) | 2019 (Google) |
| 典型参数 | 110M~340M | 117M→1.8T | 60M~11B |
| 最佳场景 | 分类、NER、QA | 生成、对话、代码 | 翻译、摘要、所有 NLP 统一 |
| 注意力掩码 | 无（全可见） | Causal（左下三角） | Encoder 无，Decoder Causal |
| Tokenizer | WordPiece | BPE | SentencePiece |
| CLS Token | ✅ 句子表示 | ❌ 无 | ❌ 无（Encoder 最后一层 mean） |
| HuggingFace | `BertModel` | `GPT2LMHeadModel` | `T5ForConditionalGeneration` |

## HuggingFace 实战

### Pipeline 快速上手

```python
from transformers import pipeline

# ── 情感分析 ──
classifier = pipeline("sentiment-analysis",
                       model="distilbert-base-uncased-finetuned-sst-2-english")
print(classifier("This course is fantastic!"))
# [{'label': 'POSITIVE', 'score': 0.9998}]

# ── 文本生成 ──
generator = pipeline("text-generation", model="gpt2")
print(generator("Machine learning is", max_length=30, num_return_sequences=1))
# [{'generated_text': 'Machine learning is ...'}]

# ── 命名实体识别 ──
ner = pipeline("ner", model="dbmdz/bert-large-cased-finetuned-conll03-english")
print(ner("Elon Musk founded SpaceX in Hawthorne, California."))
# [{'entity': 'I-PER', 'word': 'Elon'}, ...]

# ── 翻译 ──
translator = pipeline("translation_en_to_de",
                       model="t5-base")
print(translator("The transformer architecture revolutionized NLP.",
                  max_length=40))

# ── 摘要 ──
summarizer = pipeline("summarization",
                       model="facebook/bart-large-cnn")
# text = "... long article text ..."  # placeholder
print(summarizer(text, max_length=130, min_length=30))
```

### 微调 BERT 做文本分类

```python
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    TrainingArguments, Trainer
)
from datasets import load_dataset

model_name = "bert-base-uncased"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(
    model_name, num_labels=2
)

# 数据准备
dataset = load_dataset("imdb")
def tokenize_fn(examples):
    return tokenizer(examples["text"], truncation=True,
                     padding="max_length", max_length=512)
dataset = dataset.map(tokenize_fn, batched=True)
dataset.set_format(type="torch", columns=["input_ids", "attention_mask",
                                           "label"])

# 训练
training_args = TrainingArguments(
    output_dir="./results", evaluation_strategy="epoch",
    save_strategy="epoch", learning_rate=2e-5,
    per_device_train_batch_size=16, num_train_epochs=3,
    weight_decay=0.01, logging_steps=100,
)
trainer = Trainer(
    model=model, args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
)
trainer.train()
```

## Self-Attention vs Cross-Attention

| 特性 | Self-Attention | Cross-Attention |
|------|---------------|-----------------|
| Q, K, V 来源 | 同一序列 | Q 来自 Decoder，K,V 来自 Encoder |
| 用途 | 建立序列内依赖 | 对齐两个序列 |
| 矩阵形状 | $S \times S$ (方阵) | $S_{dec} \times S_{enc}$ (矩形) |
| 例子 | BERT 编码一句话 | 翻译中 Decoder 关注源句子 |

## 延伸参考

- Attention Is All You Need 论文：https://arxiv.org/abs/1706.03762
- The Illustrated Transformer (Jay Alammar)：https://jalammar.github.io/illustrated-transformer/
- HuggingFace Transformers 文档：https://huggingface.co/docs/transformers/index
- d2l.ai 第 11 章 Attention：https://d2l.ai/chapter_attention-mechanisms-and-transformers/index.html
- BERT 论文：https://arxiv.org/abs/1810.04805
- GPT-2 论文：https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf""",
        goals=[
            "手推 Scaled Dot-Product Attention 的矩阵形状变化",
            "理解 Multi-Head Attention 的设计动机",
            "能对比 BERT / GPT / T5 的架构差异",
            "能用 HuggingFace pipeline 和 Trainer 完成推理与微调",
        ],
        checklist=[
            "能写出 Attention 的完整矩阵公式并标注每步形状",
            "能解释为什么需要除以 $\\sqrt{d_k}$",
            "能说清 Encoder-only、Decoder-only、Encoder-Decoder 各适合什么任务",
            "能独立完成 HuggingFace 文本分类微调",
        ],
        experiments=[
            {
                "title": "Attention 可视化实验",
                "goal": "加载 BERT 模型，对一句话提取所有层的 attention weights 并可视化",
                "steps": [
                    "用 transformers 加载 bert-base-uncased",
                    "输入一个中英文句子，设置 output_attentions=True",
                    "用 matplotlib 绘制各头各层的注意力热力图",
                    "比较不同层-头的注意力模式差异",
                ],
                "output": "注意力热力图矩阵",
                "difficulty": "advanced",
            }
        ],
        glossary=[
            {"term": "Self-Attention", "definition": "序列中每个位置都与其他所有位置计算注意力"},
            {"term": "Multi-Head Attention", "definition": "并行运行多组注意力，各自关注不同子空间"},
            {"term": "Causal Mask", "definition": "左下三角掩码，确保 Decoder 只看当前位置及之前的位置"},
            {"term": "Positional Encoding", "definition": "为 Transformer 注入 token 位置信息的正弦/余弦向量"},
            {"term": "Layer Normalization", "definition": "对每个样本的特征维度做归一化（Transformer 使用 Post-LN 或 Pre-LN）"},
            {"term": "Cross-Attention", "definition": "Decoder 用自身 Q 去查询 Encoder 输出的 K、V"},
        ],
        references=[
            {
                "title": "Attention Is All You Need",
                "source": "Vaswani et al., 2017",
                "url": "https://arxiv.org/abs/1706.03762",
            },
            {
                "title": "The Illustrated Transformer",
                "source": "Jay Alammar",
                "url": "https://jalammar.github.io/illustrated-transformer/",
            },
            {
                "title": "HuggingFace Transformers 文档",
                "source": "HuggingFace",
                "url": "https://huggingface.co/docs/transformers/index",
            },
            {
                "title": "BERT: Pre-training of Deep Bidirectional Transformers",
                "source": "Devlin et al., 2018",
                "url": "https://arxiv.org/abs/1810.04805",
            },
            {
                "title": "d2l.ai — Attention Mechanisms and Transformers",
                "source": "Aston Zhang et al.",
                "url": "https://d2l.ai/chapter_attention-mechanisms-and-transformers/index.html",
            },
        ],
        prerequisites=["neural-networks", "cnn-rnn"],
        keywords=[
            "Transformer",
            "Self-Attention",
            "Multi-Head Attention",
            "BERT",
            "GPT",
            "T5",
            "Positional Encoding",
            "Layer Norm",
            "HuggingFace",
            "Cross-Attention",
            "Causal Mask",
            "Scaled Dot-Product",
        ],
        quiz=[
            {
                "question": "Scaled Dot-Product Attention 中为什么除以 $\\sqrt{d_k}$？",
                "options": [
                    "为了数值稳定（归一化）",
                    "防止点积值过大导致 softmax 梯度消失",
                    "这是历史遗留，实际上可以不除",
                    "为了让输出方差为 1",
                ],
                "correctIndex": 1,
                "explanation": "当 $d_k$ 很大时点积值方差为 $d_k$，softmax 会趋向 one-hot 使得梯度趋近于零。除以 $\\sqrt{d_k}$ 将方差控制为 1。",
            },
            {
                "question": "BERT 和 GPT 在架构上最本质的区别是什么？",
                "options": [
                    "BERT 用 Layer Norm，GPT 用 Batch Norm",
                    "BERT 是 Encoder-only（双向），GPT 是 Decoder-only（单向因果）",
                    "BERT 用 WordPiece，GPT 用 BPE",
                    "BERT 有 12 层，GPT 有 12 层",
                ],
                "correctIndex": 1,
                "explanation": "BERT 使用 Transformer Encoder（双向注意力），GPT 使用 Transformer Decoder（因果掩码注意力）。其余是工程细节。",
            },
        ],
        sort_order=11,
        enabled=True,
    )
)

# ═══════════════════════════════════════════════════════════════
# Ch12: 聚类分析
# ═══════════════════════════════════════════════════════════════
CH.append(
    dict(
        slug="clustering",
        chapter_number=12,
        title="聚类分析",
        summary=(
            "掌握 K-Means、DBSCAN 和层次聚类 (Agglomerative) 的原理、"
            "评估指标与实操对比，理解 K-Means++ 初始化。"
        ),
        difficulty="intermediate",
        estimated_minutes=55,
        markdown=r"""# 聚类分析

## 学习定位

聚类是无监督学习的核心任务之一。本章从 K-Means 出发，引入密度聚类 DBSCAN
和层次聚类，并系统对比评估指标。

## K-Means

### 目标函数

给定 $n$ 个样本 $\{x_i\}$ 和 $K$ 个聚类中心 $\{\mu_k\}$：

$$
J = \sum_{k=1}^{K} \sum_{x_i \in C_k} \| x_i - \mu_k \|_2^2
$$

最小化 $J$ 等价于最小化簇内样本到中心的平方距离之和 (Inertia)。

### 算法步骤

1. 随机初始化 $K$ 个中心
2. 将每个样本分配到最近的中心
3. 用簇内样本的均值更新中心：

$$
\mu_k = \frac{1}{|C_k|} \sum_{x_i \in C_k} x_i
$$

4. 重复 2-3 直到中心稳定或达到最大迭代次数

### K-Means++ 初始化

标准 K-Means 对初始化敏感。K-Means++ 通过**概率加权采样**提升初始中心质量：

1. 从数据中均匀随机选择第一个中心 $\mu_1$
2. 对每个样本 $x_i$，计算 $D(x_i) = \min_{k} \|x_i - \mu_k\|^2$
3. 以概率 $\frac{D(x_i)}{\sum_j D(x_j)}$ 选择新中心
4. 重复 2-3 直到选出 $K$ 个中心

**效果**：K-Means++ 是 $\Theta(\log K)$ 近似于最优解，而随机初始化的近似比可能退化到超多项式。实际使用中，scikit-learn 默认启用 `init='k-means++'`。

### 如何选择 K

- **肘部法则 (Elbow Method)**：画出 $J(K)$ 曲线，寻找拐点
- **轮廓系数 (Silhouette Score)**：选择使平均轮廓系数最大的 $K$
- **Gap Statistic**：比较聚类后 inertia 与 null reference distribution

## DBSCAN

DBSCAN (Density-Based Spatial Clustering of Applications with Noise) 基于密度定义簇。

### 核心概念

| 概念 | 定义 |
|------|------|
| $\epsilon$-邻域 | 与点 $p$ 距离 $\le \epsilon$ 的所有点 |
| 核心点 (Core) | $\epsilon$-邻域内至少包含 `min_samples` 个点 |
| 边界点 (Border) | 非核心点但在某核心点的 $\epsilon$-邻域内 |
| 噪声点 (Noise) | 既非核心点也非边界点 |
| 密度直达 | $q$ 是核心点且 $p$ 在 $q$ 的 $\epsilon$-邻域内 |
| 密度可达 | 存在核心点链 $p_1 \to p_2 \to \dots \to p$ |
| 密度相连 | 存在核心点 $o$ 使得 $p$ 和 $q$ 都从 $o$ 密度可达 |

### 算法流程

1. 遍历所有未访问点
2. 若该点为核心点，扩展新簇：找出所有密度可达点
3. 若不是核心点，暂时标记为噪声（可能后续被其他核心点吸收）

### 优点与局限

- **优势**：可以发现任意形状的簇、自动检测噪声、无需预设 K
- **局限**：对参数 $\epsilon$ 和 `min_samples` 敏感、高维数据中密度概念退化、
  不同密度簇难以同时检测

## 层次聚类 (Agglomerative)

### 自底向上聚合

1. 每个样本初始作为一个簇
2. 重复合并距离最近的两个簇，直到只剩一个簇
3. 生成**树状图 (Dendrogram)**

### 簇间距离（链接准则）

| 链接方式 | 定义 | 特点 |
|----------|------|------|
| Single Link | $\min_{a\in A,b\in B} d(a,b)$ | 易产生链式效应，对噪声敏感 |
| Complete Link | $\max_{a\in A,b\in B} d(a,b)$ | 产生紧凑簇，对异常值敏感 |
| Average Link | $\frac{1}{|A||B|}\sum_{a,b} d(a,b)$ | 平衡，常用 |
| Ward | $\frac{2|A||B|}{|A|+|B|}\|\bar{A}-\bar{B}\|^2$ | 最小化簇内方差增加量，最常用 |

### 树状图示例

```python
from scipy.cluster.hierarchy import dendrogram, linkage
from matplotlib import pyplot as plt

Z = linkage(X, method='ward')
plt.figure(figsize=(10, 5))
dendrogram(Z, truncate_mode='level', p=5,
           color_threshold=0.7*max(Z[:,2]))
plt.title("Hierarchical Clustering Dendrogram (Ward)")
plt.xlabel("Sample Index"); plt.ylabel("Distance")
plt.show()
```

## 聚类算法对比

| 特性 | K-Means | DBSCAN | Agglomerative |
|------|---------|--------|---------------|
| 簇形状 | 凸 (球形) | 任意 | 取决于链接方式 |
| 需预设簇数 K | ✅ 必须 | ❌ 自动发现 | ✅ 需要指定阈值 |
| 噪声点处理 | 强制分配 | ✅ 标记为噪声(-1) | 强制分配（阈值断开前） |
| 复杂度 | $O(nKd\cdot iter)$ | $O(n\log n)$ (KD-Tree) | $O(n^3)$ 朴素 / $O(n^2)$ |
| 大数据适用性 | ✅ 好 | ⚠️ 中（参数敏感） | ❌ 差 |
| 高维适用性 | ⚠️ 中 | ❌ 差（维度灾难） | ⚠️ 中 |
| 可解释性 | 高 | 中 | 高（树状图） |
| scikit-learn | `KMeans` | `DBSCAN` | `AgglomerativeClustering` |

## 聚类评估指标

| 指标 | 公式/定义 | 取值范围 | 最优方向 | 说明 |
|------|----------|----------|----------|------|
| Silhouette Score | $\frac{b-a}{\max(a,b)}$ | $[-1, 1]$ | 越高越好 | $a$=簇内平均距离, $b$=与最近簇平均距离 |
| Davies-Bouldin Index | $\frac{1}{K}\sum_{k}\max_{j\neq k}\frac{s_k+s_j}{d(c_k,c_j)}$ | $[0,\infty)$ | 越低越好 | 簇内散度/簇间分离度 的均值 |
| Calinski-Harabasz Index | $\frac{\text{tr}(B_K)}{\text{tr}(W_K)}\times\frac{n-K}{K-1}$ | $[0,\infty)$ | 越高越好 | 簇间方差/簇内方差 的比值 |
| Inertia (WCSS) | $\sum_k\sum_{x_i\in C_k}\|x_i-\mu_k\|^2$ | $[0,\infty)$ | 越低越好 | K-Means 自身目标，不适合跨 K 比较 |
| Adjusted Rand Index | $\frac{\text{RI}-E[\text{RI}]}{\max(\text{RI})-E[\text{RI}]}$ | $[-1,1]$ | 越高越好 | 需真实标签 |
| Adjusted Mutual Info | $\frac{I(U;V)-E[I]}{\max(H(U),H(V))-E[I]}$ | $[0,1]$ | 越高越好 | 需真实标签 |
| Homogeneity / Completeness / V-Measure | 信息论三件套 | $[0,1]$ | 越高越好 | 需真实标签 |

### 公式详解

**轮廓系数** (每个样本)：

$$
s(i) = \frac{b(i) - a(i)}{\max\{a(i), b(i)\}}
$$

其中 $a(i)$ 是样本 $i$ 与同簇内其他样本的平均距离，$b(i)$ 是样本 $i$ 与最近的其他簇中所有样本的平均距离。

## 完整聚类对比代码

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import make_blobs, make_moons
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
import time

# ── 生成多形状数据 ──
n_samples = 1500
# Blobs：各向同性高斯簇
X_blobs, y_blobs = make_blobs(n_samples=500, centers=3,
                               cluster_std=1.2, random_state=42)
# Moons：月牙形 / 非凸
X_moons, y_moons = make_moons(n_samples=500, noise=0.08, random_state=42)
# Aniso：各向异性分布
rng = np.random.RandomState(42)
X_aniso = np.dot(rng.randn(500, 2),
                  rng.randn(2, 2)) + rng.randn(500, 2)

datasets = {
    "Blobs": X_blobs,
    "Moons": X_moons,
    "Aniso": X_aniso
}

# ── 聚类器配置 ──
clusterers = {
    "KMeans (k=3)": KMeans(n_clusters=3, n_init=10, random_state=42),
    "KMeans (k=2 moons)": KMeans(n_clusters=2, n_init=10, random_state=42),
    "DBSCAN": DBSCAN(eps=0.3, min_samples=10),
    "Agglomerative (ward, k=3)": AgglomerativeClustering(
        n_clusters=3, linkage="ward"),
}

# ── 运行对比 ──
def eval_clustering(labels, X):
    '''评估聚类质量。忽略噪声点 (label=-1)。'''
    mask = labels != -1
    if mask.sum() <= 1 or len(set(labels[mask])) <= 1:
        return {"Silhouette": np.nan, "Davies-Bouldin": np.nan,
                "Calinski-Harabasz": np.nan}
    return {
        "Silhouette": silhouette_score(X[mask], labels[mask]),
        "Davies-Bouldin": davies_bouldin_score(X[mask], labels[mask]),
        "Calinski-Harabasz": calinski_harabasz_score(X[mask], labels[mask]),
    }

fig, axes = plt.subplots(len(datasets), len(clusterers),
                         figsize=(4*len(clusterers), 3*len(datasets)))
results = {}

for i, (ds_name, X) in enumerate(datasets.items()):
    X = StandardScaler().fit_transform(X)
    for j, (clf_name, clf) in enumerate(clusterers.items()):
        t0 = time.time()
        labels = clf.fit_predict(X)
        elapsed = time.time() - t0
        metrics = eval_clustering(labels, X)
        key = f"{ds_name} | {clf_name}"
        results[key] = {"n_clusters": len(set(labels)) - (1 if -1 in labels else 0),
                        "noise": (labels==-1).sum(),
                        "time": elapsed, **metrics}

        ax = axes[i][j]
        colors = np.array(["#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd",
                           "#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf"])
        for label in set(labels):
            mask = labels == label
            c = "gray" if label == -1 else colors[label % 10]
            ax.scatter(X[mask, 0], X[mask, 1], c=c, s=8, alpha=0.6)
        ax.set_title(f"{clf_name}\nSil={metrics['Silhouette']:.3f}", fontsize=9)
        ax.set_xticks([]); ax.set_yticks([])
        if j == 0: ax.set_ylabel(ds_name, fontsize=10)
plt.tight_layout()
plt.savefig("clustering_comparison.png", dpi=150)
plt.show()

# ── 结果表格 ──
print(f"{'Dataset & Method':<38} {'K':>3} {'Noise':>5} "
      f"{'Silhouette':>10} {'DB':>8} {'CH':>10} {'Time':>7}")
print("-" * 90)
for k, v in results.items():
    print(f"{k:<38} {v['n_clusters']:>3} {v['noise']:>5} "
          f"{v['Silhouette']:>10.4f} {v['Davies-Bouldin']:>8.4f} "
          f"{v['Calinski-Harabasz']:>10.2f} {v['time']:>6.4f}s")
```

## K-Means vs GMM vs Spectral Clustering

| 特性 | K-Means | GMM | Spectral Clustering |
|------|---------|-----|---------------------|
| 簇分配 | 硬分配 | 软分配 (概率) | 硬分配 |
| 簇形状 | 球形 | 椭球形 | 任意 |
| 数学基础 | 距离最小化 | 概率（EM 算法） | 图拉普拉斯谱分解 |
| 对缩放敏感 | ✅ | ✅ | ❌ (归一化切) |
| 时间复杂度 | $O(nkdi)$ | $O(nkdi)$ | $O(n^3)$ |
| 适用规模 | 大 | 中 | 小-中 |

## 延伸参考

- scikit-learn Clustering 文档：https://scikit-learn.org/stable/modules/clustering.html
- scikit-learn KMeans 文档：https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html
- scikit-learn DBSCAN 文档：https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html
- scikit-learn 聚类评估指标文档：https://scikit-learn.org/stable/modules/clustering.html#clustering-evaluation
- k-Means++ 论文 (Arthur & Vassilvitskii, 2007)：https://theory.stanford.edu/~sergei/papers/kMeansPP-soda.pdf
- 《机器学习》(西瓜书) 第 9 章 聚类：https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm""",
        goals=[
            "手推 K-Means 目标函数和更新步骤",
            "理解 K-Means++ 的采样策略及其理论保证",
            "能解释 DBSCAN 中密度直达/可达/相连的区别",
            "能绘制并解读树状图",
            "能选择合适的聚类评估指标",
        ],
        checklist=[
            "能写出 K-Means 的完整算法伪代码",
            "能解释为什么 DBSCAN 可以发现非凸簇而 K-Means 不行",
            "能画出不同链接准则的树状图差异",
            "能在同一份数据上用多种聚类算法做对比实验",
        ],
        experiments=[
            {
                "title": "全聚类算法对比实验",
                "goal": "在 4 种不同分布数据上对比 K-Means / DBSCAN / Agglomerative / SpectralClustering",
                "steps": [
                    "生成 Blobs, Moons, Circles, Aniso 四组数据",
                    "各自运行 4 种聚类算法",
                    "计算并对比 Silhouette / DB / CH 分数",
                    "画 4×4 子图对比聚类结果",
                ],
                "output": "多算法对比可视化和评估表格",
                "difficulty": "intermediate",
            }
        ],
        glossary=[
            {"term": "K-Means", "definition": "迭代地将样本分配到 K 个中心，更新中心为簇内均值"},
            {"term": "Inertia", "definition": "簇内平方和 (WCSS)，K-Means 最小化的目标函数"},
            {"term": "K-Means++", "definition": "一种改进的中心初始化方法，通过概率加权采样选择初始中心"},
            {"term": "DBSCAN", "definition": "基于密度的聚类算法，通过核心点扩展任意形状簇并自动检测噪声"},
            {"term": "Dendrogram", "definition": "树状图，展示层次聚类中逐步合并的过程"},
            {"term": "轮廓系数", "definition": "综合衡量簇内紧密度和簇间分离度的指标，取值 [-1, 1]"},
            {"term": "密度可达", "definition": "存在核心点链将两点连接起来"},
        ],
        references=[
            {
                "title": "scikit-learn Clustering 文档",
                "source": "scikit-learn",
                "url": "https://scikit-learn.org/stable/modules/clustering.html",
            },
            {
                "title": "k-Means++ 论文 (2007)",
                "source": "Arthur & Vassilvitskii",
                "url": "https://theory.stanford.edu/~sergei/papers/kMeansPP-soda.pdf",
            },
            {
                "title": "DBSCAN 论文 (1996)",
                "source": "Ester, Kriegel, Sander, Xu",
                "url": "https://www.aaai.org/Papers/KDD/1996/KDD96-037.pdf",
            },
            {
                "title": "《机器学习》(西瓜书) 第 9 章 — 聚类",
                "source": "周志华",
                "url": "https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm",
            },
            {
                "title": "scikit-learn 聚类评估指标",
                "source": "scikit-learn",
                "url": "https://scikit-learn.org/stable/modules/clustering.html#clustering-performance-evaluation",
            },
        ],
        prerequisites=["introduction", "math-foundations"],
        keywords=[
            "K-Means",
            "K-Means++",
            "DBSCAN",
            "层次聚类",
            "树状图",
            "轮廓系数",
            "Davies-Bouldin",
            "Calinski-Harabasz",
            "Ward链接",
            "密度聚类",
            "肘部法则",
        ],
        quiz=[
            {
                "question": "DBSCAN 相比 K-Means 的最大优势是什么？",
                "options": [
                    "速度更快",
                    "不需要预设簇数 K 且能发现任意形状簇",
                    "在高维数据上表现更好",
                    "对参数不敏感",
                ],
                "correctIndex": 1,
                "explanation": "DBSCAN 无需预设 K，可发现任意形状簇，并能自动标记噪声点。缺点是仍需要调节 $\\epsilon$ 和 min_samples。",
            },
            {
                "question": "轮廓系数为 -0.5 意味着什么？",
                "options": [
                    "簇非常紧凑",
                    "样本可能被分配到了错误的簇",
                    "聚类数 K 太小",
                    "数据不适合聚类",
                ],
                "correctIndex": 1,
                "explanation": "轮廓系数 $s(i)=\\frac{b-a}{\\max(a,b)}$，负值意味着 $b<a$，即样本与最近邻居簇的距离小于与自身簇的距离，说明该样本可能被分配错了簇。",
            },
        ],
        sort_order=12,
        enabled=True,
    )
)

# ═══════════════════════════════════════════════════════════════
# Async seed / upsert
# ═══════════════════════════════════════════════════════════════


async def enrich():
    engine = create_async_engine(db_url)
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one_or_none()
        if not book:
            print("ERROR: Book not found. Run seed_ml_book.py first.")
            return
        book_id = book.id

        for ch in CH:
            r2 = await db.execute(
                select(MLBookChapter).where(
                    MLBookChapter.book_id == book_id,
                    MLBookChapter.slug == ch["slug"],
                )
            )
            existing = r2.scalar_one_or_none()
            payload = {k: v for k, v in ch.items() if k != "slug"}
            for jf in (
                "goals",
                "checklist",
                "experiments",
                "glossary",
                "references",
                "prerequisites",
                "keywords",
                "quiz",
            ):
                if jf in payload:
                    payload[jf] = j(payload[jf])
            if existing:
                for k, v in payload.items():
                    setattr(existing, k, v)
                print(f"  Updated: {ch['slug']}")
            else:
                db.add(
                    MLBookChapter(book_id=book_id, slug=ch["slug"], **payload)
                )
                print(f"  Created: {ch['slug']}")

        await db.commit()
        print(f"\nOK: {len(CH)} chapters enriched (upserted)")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(enrich())
