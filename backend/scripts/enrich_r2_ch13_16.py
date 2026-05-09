"""Enrich ML book chapters 13-16 with additional formulas, tables, code, and references.

Run: cd backend && python3 scripts/enrich_r2_ch13_16.py
"""
import asyncio, json, os, sys
sys.path.insert(0, ".")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

def j(v): return json.dumps(v, ensure_ascii=False)

# ── Enriched markdown per chapter ──────────────────────────────────────────

ENRICHED = {}

ENRICHED["dimensionality-reduction"] = r'''# 降维与特征选择

## PCA主成分分析

### 核心思想

通过线性投影将数据映射到低维空间，使投影后方差最大化。

$$ \mathbf{z}_i = \mathbf{W}^\top (\mathbf{x}_i - \boldsymbol{\mu}) $$

其中 $\mathbf{W}$ 的列是协方差矩阵的前 $k$ 个最大特征值对应的特征向量。

### PCA 完整步骤（2D → 1D 示例）

给定数据集 $\mathbf{X} \in \mathbb{R}^{n \times 2}$：

**Step 1: 中心化**
$$ \mathbf{X}_{\text{centered}} = \mathbf{X} - \mathbf{1}\boldsymbol{\mu}^\top $$

**Step 2: 计算协方差矩阵**
$$ \mathbf{\Sigma} = \frac{1}{n-1} \mathbf{X}_{\text{centered}}^\top \mathbf{X}_{\text{centered}} $$

**Step 3: 特征分解**
$$ \mathbf{\Sigma} = \mathbf{V} \mathbf{\Lambda} \mathbf{V}^\top $$

其中 $\lambda_1 \ge \lambda_2$ 为特征值，$\mathbf{v}_1, \mathbf{v}_2$ 为对应特征向量。

**Step 4: 选取主成分** — 取 $\mathbf{v}_1$ (对应 $\lambda_{\max}$) 作为投影方向。

**Step 5: 投影**
$$ \mathbf{z} = \mathbf{X}_{\text{centered}} \mathbf{v}_1 \quad \in \mathbb{R}^{n \times 1} $$

### NumPy 手写 PCA

```python
import numpy as np

def pca_2d_to_1d(X):
    # Step 1: 中心化
    X_c = X - X.mean(axis=0)

    # Step 2: 协方差矩阵
    cov = np.cov(X_c, rowvar=False)

    # Step 3: 特征分解
    eigenvalues, eigenvectors = np.linalg.eigh(cov)

    # Step 4: 取最大特征值对应的特征向量（eigh返回升序）
    principal = eigenvectors[:, -1]

    # Step 5: 投影
    z = X_c @ principal
    return z, eigenvalues / eigenvalues.sum()

# 示例
np.random.seed(42)
X = np.random.randn(100, 2) @ np.array([[3, 1], [1, 0.5]])
z, ratios = pca_2d_to_1d(X)
print(f"Explained variance ratio: {ratios[-1]:.3f}")  # ~0.95+
```

### 方差解释率与 Scree Plot（碎石图）

主成分的重要性由**方差解释率**衡量：

$$ \text{explained_variance_ratio}_i = \frac{\lambda_i}{\sum_{j=1}^{d} \lambda_j} $$

**Scree Plot** 用途：
- 横轴：主成分编号（降序排列）
- 纵轴：特征值或方差解释率
- 寻找"肘部"(elbow) — 曲线变缓的位置即合适的 $k$
- 常用规则：累计方差解释率 ≥ 90% 或 95%

```python
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt

pca = PCA().fit(X_scaled)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

# Scree plot
ax1.plot(range(1, len(pca.explained_variance_ratio_) + 1),
         pca.explained_variance_ratio_, 'bo-')
ax1.set_xlabel('Principal Component')
ax1.set_ylabel('Explained Variance Ratio')
ax1.set_title('Scree Plot')
ax1.axhline(y=0.05, color='r', linestyle='--', label='5% threshold')
ax1.legend()

# Cumulative
cumsum = np.cumsum(pca.explained_variance_ratio_)
ax2.plot(range(1, len(cumsum) + 1), cumsum, 'go-')
ax2.axhline(y=0.90, color='r', linestyle='--', label='90%')
ax2.axhline(y=0.95, color='orange', linestyle='--', label='95%')
ax2.set_xlabel('Number of Components')
ax2.set_ylabel('Cumulative Explained Variance')
ax2.set_title('Cumulative Explained Variance')
ax2.legend()
plt.tight_layout()
```

### PCA 重建与压缩比

从低维表示重建原始数据：

$$ \hat{\mathbf{x}}_i = \mathbf{W} \mathbf{z}_i + \boldsymbol{\mu} $$

压缩比 $= \frac{nk + kd}{nd}$（$n$ 个样本，$d$ 原始维度，$k$ 主成分数）。

重建误差用 MSE 衡量：
$$ \text{Reconstruction Error} = \frac{1}{n} \sum_{i=1}^{n} ||\mathbf{x}_i - \hat{\mathbf{x}}_i||^2 $$

## t-SNE vs PCA vs UMAP

| 维度 | PCA | t-SNE | UMAP |
|------|-----|-------|------|
| 目标 | 保留全局方差 | 保留局部邻域 | 保留拓扑结构 |
| 线性 | 是 | 否 | 否 |
| 预处理 | 可（transform新数据） | 不可（只能fit_transform） | 部分支持 |
| 全局结构 | 保留 | 扭曲 | 较好保留 |
| 计算复杂度 | $O(d^3)$ 或 $O(\min(n,d)^3)$ | $O(n^2)$ | $O(n^{1.14})$ |
| 用途 | 降维/去噪/特征提取 | **可视化**（2D/3D） | 可视化 + 聚类前处理 |
| perplexity/n_neighbors | — | 关键超参数（5-50） | n_neighbors（5-50） |

> t-SNE 的核心是 t-分布（自由度=1 的 Student-t），使低维空间中的远点排斥力更强，从而分离不同簇。

### PCA + t-SNE 对比实战

```python
import numpy as np
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.datasets import load_digits
import matplotlib.pyplot as plt

digits = load_digits()
X, y = digits.data, digits.target

# PCA: 保留 50 维再降到 2D
pca50 = PCA(n_components=50).fit_transform(X)
pca2 = PCA(n_components=2).fit_transform(X)

# t-SNE
tsne = TSNE(n_components=2, perplexity=30, random_state=42)
tsne2 = tsne.fit_transform(X)

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
scatter_kwargs = dict(c=y, cmap='tab10', alpha=0.7, s=10)

axes[0].scatter(pca2[:, 0], pca2[:, 1], **scatter_kwargs)
axes[0].set_title(f'PCA (2D)\nVar保留: {PCA(n_components=2).fit(X).explained_variance_ratio_.sum():.1%}')
axes[1].scatter(tsne2[:, 0], tsne2[:, 1], **scatter_kwargs)
axes[1].set_title('t-SNE (2D)')
for ax in axes: ax.set_xticks([]); ax.set_yticks([])
plt.tight_layout()
plt.show()
```

## 特征选择方法详解

### 三大策略对比

| 维度 | Filter (过滤法) | Wrapper (包裹法) | Embedded (嵌入法) |
|------|-----------------|-------------------|--------------------|
| **原理** | 统计指标独立评分 | 用模型性能评估子集 | 模型训练中自动选择 |
| **与模型关系** | 无关 | 紧密耦合 | 集成在模型中 |
| **计算成本** | 低 | 高（穷举子集） | 中 |
| **优点** | 速度快，适合高维初步筛选 | 考虑特征交互，效果好 | 兼顾效果和效率 |
| **缺点** | 忽略特征交互，可能选冗余特征 | 计算代价大，可能过拟合 | 仅限特定模型（L1/树） |
| **代表方法** | 方差阈值、卡方检验、互信息、相关系数 | RFE递归消除、Forward/Backward Selection | L1正则(Lasso)、树模型特征重要性、ElasticNet |
| **典型场景** | 基因数据(万维特征) | 特征数<100的精细选择 | 大部分表格数据 |

### 常用 Filter 方法

| 方法 | 适用 | 公式/指标 |
|------|------|-----------|
| 方差阈值 | 通用 | $\text{Var}(x_j) < \tau$ → 删除 |
| 皮尔逊相关系数 | 连续（回归） | $r_{xy} = \frac{\text{Cov}(x,y)}{\sigma_x \sigma_y}$ |
| 互信息 | 连续+离散 | $I(X;Y) = \sum p(x,y) \log \frac{p(x,y)}{p(x)p(y)}$ |
| 卡方检验 | 离散（分类） | $\chi^2 = \sum \frac{(O_i - E_i)^2}{E_i}$ |
| ANOVA F值 | 连续→离散 | $F = \frac{\text{MSB}}{\text{MSW}}$ |

```python
from sklearn.feature_selection import (
    VarianceThreshold, SelectKBest, f_classif, mutual_info_classif, RFE
)
from sklearn.ensemble import RandomForestClassifier

# 1. Filter: 方差筛选
sel_var = VarianceThreshold(threshold=0.01)
X_var = sel_var.fit_transform(X)

# 2. Filter: 互信息选 Top-K
sel_mi = SelectKBest(mutual_info_classif, k=10)
X_mi = sel_mi.fit_transform(X, y)

# 3. Wrapper: RFE 递归消除
rf = RandomForestClassifier(n_estimators=100, random_state=42)
rfe = RFE(rf, n_features_to_select=10)
X_rfe = rfe.fit_transform(X, y)
print("RFE Ranking:", rfe.ranking_)

# 4. Embedded: 树模型特征重要性
rf.fit(X, y)
importances = rf.feature_importances_
top_indices = np.argsort(importances)[-10:]
print("Top features:", top_indices, importances[top_indices])
```

## 延伸参考

- 《机器学习》(西瓜书) 第10-11章 — 降维与特征选择系统论述
- scikit-learn PCA 文档 — https://scikit-learn.org/stable/modules/decomposition.html#pca
- scikit-learn Feature Selection — https://scikit-learn.org/stable/modules/feature_selection.html
- t-SNE 原论文 (van der Maaten & Hinton, 2008) — https://www.jmlr.org/papers/volume9/vandermaaten08a/vandermaaten08a.pdf
- UMAP 论文 — https://arxiv.org/abs/1802.03426
- 3Blue1Brown PCA 可视化 — https://www.youtube.com/watch?v=FgakZw6K1QQ
'''

ENRICHED["generative-models"] = r'''# 生成模型：GAN、VAE与扩散模型

## 判别 vs 生成

| 维度 | 判别模型 | 生成模型 |
|------|----------|----------|
| 学习 | $P(y|\mathbf{x})$，决策边界 | $P(\mathbf{x})$ 或 $P(\mathbf{x},y)$，数据分布 |
| 典型方法 | 逻辑回归, CNN | GAN, VAE, Diffusion |
| 应用 | 分类/回归/检测 | 图像生成/补全/超分辨率/数据增强 |

## GAN：生成对抗网络

### 对抗训练框架

GAN 由两个网络组成——生成器 (G) 和判别器 (D) 进行 minimax 博弈：

$$ \min_G \max_D \; V(D,G) = \mathbb{E}_{\mathbf{x} \sim p_{\text{data}}}[\log D(\mathbf{x})] + \mathbb{E}_{\mathbf{z} \sim p_z}[\log(1 - D(G(\mathbf{z})))] $$

- **G**：接收随机噪声 $\mathbf{z}$，生成伪造样本 $G(\mathbf{z})$
- **D**：判断输入是真实样本还是伪造样本，输出概率 $D(\cdot) \in [0,1]$

训练时交替更新：
$$ \theta_D \leftarrow \theta_D + \eta \nabla_{\theta_D} V $$
$$ \theta_G \leftarrow \theta_G - \eta \nabla_{\theta_G} \mathbb{E}_{\mathbf{z}}[\log(1 - D(G(\mathbf{z})))] $$

> 实践中 G 的损失常改为最大化 $\log D(G(\mathbf{z}))$，避免训练早期的梯度消失。

### GAN 训练不稳定性

GAN 训练极其困难，常见问题：

| 问题 | 描述 | 缓解措施 |
|------|------|----------|
| **模式崩塌 (Mode Collapse)** | G 只生成少数几种样本，忽略数据分布的其他模式 | Minibatch Discrimination, Unrolled GAN, WGAN |
| **梯度消失** | D 太强时 G 得不到有效梯度 | WGAN-GP, LSGAN, 交替训练频率调优 |
| **训练震荡** | D 和 G 不平衡导致指标剧烈波动 | Spectral Normalization, TTUR (Two Time-Scale Update Rule) |
| **不收敛** | 纳什均衡难以达到 | Gradient Penalty, 适当的 G/D 参数量比 |

**Wasserstein GAN (WGAN)** 将 JS 散度替换为 Wasserstein 距离：

$$ W(P_r, P_g) = \inf_{\gamma \in \Pi(P_r,P_g)} \mathbb{E}_{(\mathbf{x},\mathbf{y}) \sim \gamma}[||\mathbf{x} - \mathbf{y}||] $$

配合 Gradient Penalty 使训练稳定得多。

### DCGAN 简易实现

```python
import torch
import torch.nn as nn

class Generator(nn.Module):
    def __init__(self, latent_dim=100, img_channels=1, feature_dim=64):
        super().__init__()
        self.net = nn.Sequential(
            # (latent_dim) -> (feature_dim*8) * 4 * 4
            nn.ConvTranspose2d(latent_dim, feature_dim*8, 4, 1, 0, bias=False),
            nn.BatchNorm2d(feature_dim*8), nn.ReLU(True),
            # 4x4 -> 8x8
            nn.ConvTranspose2d(feature_dim*8, feature_dim*4, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_dim*4), nn.ReLU(True),
            # 8x8 -> 16x16
            nn.ConvTranspose2d(feature_dim*4, feature_dim*2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_dim*2), nn.ReLU(True),
            # 16x16 -> 32x32
            nn.ConvTranspose2d(feature_dim*2, feature_dim, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_dim), nn.ReLU(True),
            # 32x32 -> 64x64
            nn.ConvTranspose2d(feature_dim, img_channels, 4, 2, 1, bias=False),
            nn.Tanh()
        )

    def forward(self, z):
        return self.net(z.view(z.size(0), z.size(1), 1, 1))

class Discriminator(nn.Module):
    def __init__(self, img_channels=1, feature_dim=64):
        super().__init__()
        self.net = nn.Sequential(
            # 64x64 -> 32x32
            nn.Conv2d(img_channels, feature_dim, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True),
            # 32x32 -> 16x16
            nn.Conv2d(feature_dim, feature_dim*2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_dim*2), nn.LeakyReLU(0.2, inplace=True),
            # 16x16 -> 8x8
            nn.Conv2d(feature_dim*2, feature_dim*4, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_dim*4), nn.LeakyReLU(0.2, inplace=True),
            # 8x8 -> 4x4
            nn.Conv2d(feature_dim*4, feature_dim*8, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_dim*8), nn.LeakyReLU(0.2, inplace=True),
            # 4x4 -> 1
            nn.Conv2d(feature_dim*8, 1, 4, 1, 0, bias=False),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.net(x).view(-1, 1)
```

## VAE：变分自编码器

### 核心思想

不同于传统自编码器，VAE 将输入编码为**概率分布参数**（均值 $\boldsymbol{\mu}$ 和对数方差 $\log\boldsymbol{\sigma}^2$），再从分布采样解码。

### 重参数化技巧 (Reparameterization Trick)

VAE 的关键创新——使随机采样可微分：

$$ \mathbf{z} = \boldsymbol{\mu} + \boldsymbol{\sigma} \odot \boldsymbol{\epsilon}, \quad \boldsymbol{\epsilon} \sim \mathcal{N}(0, \mathbf{I}) $$

这样梯度可以通过 $\boldsymbol{\mu}$ 和 $\boldsymbol{\sigma}$ 流动到编码器，而 $\boldsymbol{\epsilon}$ 的随机性不影响反向传播。

### VAE 损失函数

ELBO (Evidence Lower BOund)：

$$ \mathcal{L}(\boldsymbol{\theta}, \boldsymbol{\phi}; \mathbf{x}) = \underbrace{\mathbb{E}_{q_{\boldsymbol{\phi}}(\mathbf{z}|\mathbf{x})}[\log p_{\boldsymbol{\theta}}(\mathbf{x}|\mathbf{z})]}_{\text{重建损失}} - \underbrace{D_{\text{KL}}(q_{\boldsymbol{\phi}}(\mathbf{z}|\mathbf{x}) \| p(\mathbf{z}))}_{\text{KL 正则化}} $$

KL 散度项解析解（当先验为 $\mathcal{N}(0,\mathbf{I})$ 时）：

$$ D_{\text{KL}} = -\frac{1}{2}\sum_{j=1}^{d} \left(1 + \log\sigma_j^2 - \mu_j^2 - \sigma_j^2\right) $$

### $\beta$-VAE

在 KL 项前乘系数 $\beta$ 控制 disentanglement（解耦）：

$$ \mathcal{L}_{\beta} = \mathbb{E}_{q}[\log p(\mathbf{x}|\mathbf{z})] - \beta \cdot D_{\text{KL}}(q \| p) $$

$\beta > 1$：更强的解耦表示（Disentangled Representation Learning）；$\beta < 1$：更好的重建质量。

```python
import torch
import torch.nn as nn

class VAE(nn.Module):
    def __init__(self, input_dim=784, hidden_dim=400, latent_dim=20):
        super().__init__()
        # Encoder
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc_mu = nn.Linear(hidden_dim, latent_dim)
        self.fc_logvar = nn.Linear(hidden_dim, latent_dim)
        # Decoder
        self.fc3 = nn.Linear(latent_dim, hidden_dim)
        self.fc4 = nn.Linear(hidden_dim, input_dim)

    def encode(self, x):
        h = torch.relu(self.fc1(x))
        return self.fc_mu(h), self.fc_logvar(h)

    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std  # 重参数化技巧

    def decode(self, z):
        h = torch.relu(self.fc3(z))
        return torch.sigmoid(self.fc4(h))

    def forward(self, x):
        mu, logvar = self.encode(x.view(-1, 784))
        z = self.reparameterize(mu, logvar)
        recon = self.decode(z)
        return recon, mu, logvar

    def loss_function(self, recon_x, x, mu, logvar):
        # 重建损失 (BCE)
        BCE = nn.functional.binary_cross_entropy(
            recon_x, x.view(-1, 784), reduction='sum'
        )
        # KL 散度
        KLD = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
        return BCE + KLD
```

## 扩散模型 (Diffusion Models)

### 前向扩散过程 (Forward Process)

给定真实数据 $\mathbf{x}_0$，在 $T$ 个时间步中逐步添加高斯噪声，直到成为纯噪声 $\mathbf{x}_T \sim \mathcal{N}(0, \mathbf{I})$：

$$ q(\mathbf{x}_t | \mathbf{x}_{t-1}) = \mathcal{N}(\mathbf{x}_t; \sqrt{1 - \beta_t} \mathbf{x}_{t-1}, \beta_t \mathbf{I}) $$

其中 $\beta_t \in (0,1)$ 是预定义的噪声调度 (noise schedule)。

**关键性质**：可用重参数化从 $\mathbf{x}_0$ 直接跳转到任意时刻 $\mathbf{x}_t$：

$$ \mathbf{x}_t = \sqrt{\bar{\alpha}_t} \mathbf{x}_0 + \sqrt{1 - \bar{\alpha}_t} \boldsymbol{\epsilon} $$

其中 $\alpha_t = 1 - \beta_t$，$\bar{\alpha}_t = \prod_{s=1}^{t} \alpha_s$。

### 反向去噪过程 (Reverse Process)

学习从噪声恢复数据的马尔可夫链：

$$ p_\theta(\mathbf{x}_{t-1} | \mathbf{x}_t) = \mathcal{N}(\mathbf{x}_{t-1}; \boldsymbol{\mu}_\theta(\mathbf{x}_t, t), \sigma_t^2 \mathbf{I}) $$

DDPM 简化目标——只预测添加的噪声：

$$ \mathcal{L}_{\text{simple}} = \mathbb{E}_{t,\mathbf{x}_0,\boldsymbol{\epsilon}} \left[ ||\boldsymbol{\epsilon} - \boldsymbol{\epsilon}_\theta(\mathbf{x}_t, t)||^2 \right] $$

> 这就是 Stable Diffusion 等模型背后的核心原理——训练一个 U-Net 去预测噪声，然后反复应用去噪步骤生成图像。

### 扩散采样

```python
@torch.no_grad()
def sample(model, img_shape, T=1000, device='cuda'):
    model.eval()
    x = torch.randn((1, *img_shape)).to(device)
    for t in reversed(range(T)):
        t_batch = torch.full((1,), t, device=device, dtype=torch.long)
        pred_noise = model(x, t_batch)
        alpha = alphas_cumprod[t]
        beta = betas[t]
        if t > 0:
            noise = torch.randn_like(x)
        else:
            noise = 0
        x = (1 / torch.sqrt(1 - beta)) * (
            x - (beta / torch.sqrt(1 - alpha)) * pred_noise
        ) + torch.sqrt(beta) * noise
    return x
```

## 三大生成模型全面对比

| 维度 | GAN | VAE | 扩散模型 |
|------|-----|-----|----------|
| **数学原理** | Minimax博弈 | 变分推断 + ELBO | 去噪得分匹配 |
| **训练难度** | 高（需要平衡G/D） | 低（稳定优化） | 中（需调噪声调度） |
| **训练稳定性** | 差（模式崩塌/震荡） | 好 | 好 |
| **生成质量** | 高（锐利） | 中（模糊） | **最高**（细节丰富） |
| **生成多样性** | 低（易模式崩塌） | 高 | 高 |
| **生成速度** | **极快**（单次前向） | 快（单次前向） | 慢（需T步迭代，50-1000步） |
| **隐空间** | 无结构隐空间 | 连续/可插值隐空间 | 无显式隐空间 |
| **可解释性** | 低 | 中（可通过z插值探索） | 低 |
| **典型应用** | 图像生成、风格迁移 | 表示学习、异常检测 | 文本到图像(SD)、3D生成 |
| **代表模型** | StyleGAN, BigGAN | VAE, beta-VAE, VQ-VAE | DDPM, Stable Diffusion, DALL-E |
| **计算成本** | 中 | 低 | 高（训练和推理） |

## 延伸参考

- GAN 原论文 — Goodfellow et al. 2014 — https://arxiv.org/abs/1406.2661
- DCGAN — Radford et al. 2016 — https://arxiv.org/abs/1511.06434
- WGAN-GP — Gulrajani et al. 2017 — https://arxiv.org/abs/1704.00028
- VAE 原论文 — Kingma & Welling 2014 — https://arxiv.org/abs/1312.6114
- $\beta$-VAE — Higgins et al. 2017 — https://openreview.net/forum?id=Sy2fzU9gl
- DDPM — Ho et al. 2020 — https://arxiv.org/abs/2006.11239
- Stable Diffusion — Rombach et al. 2022 — https://arxiv.org/abs/2112.10752
- Denoising Diffusion Probabilistic Models 解读 — https://lilianweng.github.io/posts/2021-07-11-diffusion-models/
'''

ENRICHED["reinforcement-learning"] = r'''# 强化学习入门

## MDP 马尔可夫决策过程

强化学习的数学框架——马尔可夫决策过程 $\langle \mathcal{S}, \mathcal{A}, \mathcal{P}, \mathcal{R}, \gamma \rangle$：

| 元素 | 符号 | 含义 | 示例 |
|------|------|------|------|
| 状态空间 | $\mathcal{S}$ | 环境所有可能状态 | 网格中每个格子 |
| 动作空间 | $\mathcal{A}$ | 智能体可选动作 | {上, 下, 左, 右} |
| 状态转移 | $\mathcal{P}(s'|s,a)$ | 执行a后到s'的概率 | 80%按方向走, 20%随机 |
| 奖励函数 | $\mathcal{R}(s,a,s')$ | 即时奖励 | 终点+10, 陷阱-10, 其他-0.1 |
| 折扣因子 | $\gamma \in [0,1]$ | 未来奖励权重 | 0.9 (重视长期) |

**马尔可夫性质**：下一状态仅取决于当前状态和动作，与历史无关。
$$ P(s_{t+1} | s_t, a_t) = P(s_{t+1} | s_t, a_t, s_{t-1}, a_{t-1}, \dots, s_0, a_0) $$

### MDP 网格世界示例

```
┌─────┬─────┬─────┬─────┐
│  S  │     │     │  G  │   S = Start (起点)
├─────┼─────┼─────┼─────┤   G = Goal (+10 奖励)
│     │  X  │     │  X  │   X = Pit (-10 奖励)
├─────┼─────┼─────┼─────┤
│  X  │     │     │     │   每步: -0.1 奖励 (鼓励最短路径)
└─────┴─────┴─────┴─────┘
```

- 动作：{↑, ↓, ←, →}，成功概率 80%，10% 垂直偏移
- 目标：学习从 S 到 G 的最优路径，同时避开 X

### 核心公式

**状态价值函数** $V^\pi(s)$：从状态 $s$ 开始遵循策略 $\pi$ 的期望累积奖励。
$$ V^\pi(s) = \mathbb{E}_\pi \left[ \sum_{k=0}^{\infty} \gamma^k R_{t+k+1} \;\middle|\; S_t = s \right] $$

**动作价值函数** $Q^\pi(s,a)$：在状态 $s$ 执行动作 $a$ 后遵循 $\pi$ 的期望累积奖励。
$$ Q^\pi(s,a) = \mathbb{E}_\pi \left[ \sum_{k=0}^{\infty} \gamma^k R_{t+k+1} \;\middle|\; S_t = s, A_t = a \right] $$

**贝尔曼方程** (Bellman Equation) — RL 核心递推关系：
$$ Q^\pi(s,a) = \sum_{s'} \mathcal{P}(s'|s,a) \left[ \mathcal{R}(s,a,s') + \gamma \sum_{a'} \pi(a'|s') Q^\pi(s',a') \right] $$

最优 Q 函数满足**贝尔曼最优方程**：
$$ Q^*(s,a) = \max_\pi Q^\pi(s,a) = \sum_{s'} \mathcal{P}(s'|s,a) \left[ \mathcal{R} + \gamma \max_{a'} Q^*(s',a') \right] $$

## Q-Learning

### 算法原理

Q-Learning 是一种无模型的时序差分 (TD) 学习方法，直接学习最优 Q 函数而不需要环境模型：

$$ Q(s,a) \leftarrow Q(s,a) + \alpha \left[ r + \gamma \max_{a'} Q(s',a') - Q(s,a) \right] $$

- $\alpha$：学习率
- $r + \gamma \max_{a'} Q(s',a')$：TD 目标
- $\delta = r + \gamma \max Q(s',a') - Q(s,a)$：TD 误差

### 网格世界 Q-Learning 代码

```python
import numpy as np

class GridWorld:
    def __init__(self, size=4):
        self.size = size
        self.start = (0, 0)
        self.goal = (0, 3)
        self.pits = [(1, 1), (1, 3), (2, 0)]
        self.actions = [(-1,0), (1,0), (0,-1), (0,1)]  # 上下左右

    def step(self, state, action):
        r, c = state
        dr, dc = self.actions[action]
        # 80% 成功，10% 左偏，10% 右偏
        p = np.random.random()
        if p < 0.8:
            nr, nc = r+dr, c+dc
        elif p < 0.9:
            nr, nc = r+dc, c+dr
        else:
            nr, nc = r-dc, c-dr
        nr = max(0, min(self.size-1, nr))
        nc = max(0, min(self.size-1, nc))
        next_state = (nr, nc)

        if next_state == self.goal: return next_state, 10, True
        if next_state in self.pits: return next_state, -10, True
        return next_state, -0.1, False

    def reset(self):
        return self.start

env = GridWorld(4)
Q = np.zeros((4, 4, 4))  # 4x4 grid x 4 actions

alpha, gamma, epsilon = 0.1, 0.9, 0.1
episodes = 5000

for ep in range(episodes):
    state = env.reset()
    done = False
    while not done:
        # epsilon-greedy
        if np.random.random() < epsilon:
            action = np.random.randint(4)
        else:
            action = np.argmax(Q[state[0], state[1]])

        next_state, reward, done = env.step(state, action)

        # Q-Learning 更新
        best_next = np.max(Q[next_state[0], next_state[1]])
        td_target = reward + gamma * best_next * (1 - done)
        td_error = td_target - Q[state[0], state[1], action]
        Q[state[0], state[1], action] += alpha * td_error

        state = next_state

# 输出学到的策略
actions_str = ['↑', '↓', '←', '→']
print("Learned Policy:")
for i in range(4):
    row = []
    for j in range(4):
        if (i,j) == env.goal: row.append(' G ')
        elif (i,j) in env.pits: row.append(' X ')
        else: row.append(f' {actions_str[np.argmax(Q[i,j])]} ')
    print(''.join(row))
```

## DQN：深度 Q 网络

当状态空间太大（例如 Atari 游戏，像素级输入）时，无法用表格存储 Q 值。DQN 用神经网络近似 Q 函数。

### 两大核心创新

**1. 经验回放 (Experience Replay)**
$$ \text{存储} (s_t, a_t, r_t, s_{t+1}) \text{到缓冲池} \mathcal{D} \text{，随机采样 minibatch 训练} $$

好处：
- 打破样本时序相关性，满足 SGD 的 i.i.d. 假设
- 复用经验，提高数据效率
- 平滑训练，减少震荡

**2. 目标网络 (Target Network)**
$$ y_t = r_t + \gamma \max_{a'} Q(s_{t+1}, a'; \boldsymbol{\theta}^{-}) $$

维护两个网络：
- **在线网络** $Q(s,a;\boldsymbol{\theta})$：每步更新
- **目标网络** $Q(s,a;\boldsymbol{\theta}^{-})$：每 C 步从在线网络复制参数

> 目标网络固定 TD 目标一段时间，避免"追逐移动目标"的训练不稳定。

DQN 损失函数：
$$ \mathcal{L}(\boldsymbol{\theta}) = \mathbb{E}_{(s,a,r,s') \sim \mathcal{D}} \left[ \left( r + \gamma \max_{a'} Q(s',a'; \boldsymbol{\theta}^{-}) - Q(s,a; \boldsymbol{\theta}) \right)^2 \right] $$

## 策略梯度方法

### REINFORCE

直接参数化策略 $\pi_\theta(a|s)$，沿着使高奖励轨迹更可能的方向更新：

$$ \nabla_\theta J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta} \left[ \sum_{t=0}^{T} \nabla_\theta \log \pi_\theta(a_t|s_t) \cdot G_t \right] $$

其中 $G_t = \sum_{k=t}^{T} \gamma^{k-t} R_{k+1}$ 是从时间 $t$ 开始的累积折扣回报。

REINFORCE 是无偏但高方差的算法——即使同一条轨迹，不同随机种子结果差异巨大。

### Actor-Critic

结合**基于策略** (Actor) 和**基于价值** (Critic) 的方法：

- **Actor** $\pi_\theta(a|s)$：决定做什么（策略）
- **Critic** $V_w(s)$ 或 $Q_w(s,a)$：评估做得好不好（价值函数）

**优势函数 (Advantage Function)**——用 Critic 减少方差：

$$ A(s,a) = Q(s,a) - V(s) $$

$$ \nabla_\theta J(\theta) \approx \mathbb{E} \left[ \nabla_\theta \log \pi_\theta(a|s) \cdot A(s,a) \right] $$

> 优势为正 → 该动作比预期好 → 增加概率；优势为负 → 减少概率。

### PPO：近端策略优化

PPO 是目前最广泛使用的 RL 算法，通过**裁剪**限制策略更新幅度：

$$ \mathcal{L}^{\text{CLIP}}(\theta) = \mathbb{E}_t \left[ \min\left( r_t(\theta) \hat{A}_t, \; \text{clip}(r_t(\theta), 1-\epsilon, 1+\epsilon) \hat{A}_t \right) \right] $$

其中 $r_t(\theta) = \frac{\pi_\theta(a_t|s_t)}{\pi_{\theta_{\text{old}}}(a_t|s_t)}$ 是新旧策略的概率比。

- $\epsilon = 0.2$：每次更新最多允许 20% 概率变化
- 如果 $r_t$ 偏离 1 太多，梯度被裁掉——**Trust Region 思想的简化实现**

## RL 核心方法对比

| 维度 | REINFORCE | Q-Learning/DQN | Actor-Critic (A2C) | PPO |
|------|-----------|-----------------|-------------------|-----|
| **类型** | 纯策略梯度 | 纯价值方法 | Actor-Critic | Actor-Critic (高级) |
| **学习内容** | 策略 $\pi(a|s)$ | Q 值 $Q(s,a)$ | $\pi(a|s)$ + $V(s)$ | $\pi$ + $V$（裁剪更新） |
| **方差** | 高（Monte Carlo） | — | 中 | 低 |
| **偏差** | 无偏 | 有偏（max操作） | 有偏（Bootstrap） | 有偏 |
| **样本效率** | 低 | 中（需 replay buffer） | 中 | 高 |
| **稳定性** | 差（高方差） | 好 | 中 | **最好** |
| **连续动作** | 支持 | 不支持 | 支持 | 支持 |
| **典型场景** | 教学演示 | Atari、离散控制 | 连续控制 | **通用 RL 首选** |
| **代表实现** | 基础算法 | DQN + Experience Replay | OpenAI A2C | ChatGPT (RLHF) |

## 延伸参考

- 《机器学习》(西瓜书) 第16章 — 强化学习中文入门
- Sutton & Barto 《Reinforcement Learning: An Introduction》— RL 圣经— http://incompleteideas.net/book/the-book-2nd.html
- DQN 原论文 — Mnih et al. 2015 (Nature) — https://www.nature.com/articles/nature14236
- PPO 原论文 — Schulman et al. 2017 — https://arxiv.org/abs/1707.06347
- OpenAI Spinning Up — RL 代码教程 — https://spinningup.openai.com/
- Hugging Face Deep RL Course — https://huggingface.co/learn/deep-rl-course/
- Stable-Baselines3 — 工业级 RL 库 — https://stable-baselines3.readthedocs.io/
'''

ENRICHED["ml-in-practice"] = r'''# 实战：MLOps、部署与作品集

## MLOps 核心流程

```
数据收集 → 数据验证 → 特征工程 → 模型训练 →
模型验证 → 模型部署 → 模型监控 → 回到数据收集 ♻️
```

### MLOps 成熟度等级

| 等级 | 描述 | 关键实践 |
|------|------|----------|
| L0: 手动 | Notebook + 手动部署 | 无自动化，全靠人 |
| L1: 自动化训练 | CI/CD for ML pipeline | 数据/模型验证自动化 |
| L2: CI/CD 全流程 | 持续交付和部署 | 自动回滚、金丝雀发布 |

### 关键组件

| 阶段 | 工具 | 实践 |
|------|------|------|
| 实验管理 | MLflow, W&B | 记录超参、指标、artifact |
| 数据版本 | DVC, Quilt | 数据可追溯、可复现 |
| 模型注册 | MLflow Registry | 版本和 stage 管理 (Staging/Production/Archived) |
| 模型服务 | FastAPI, BentoML, Triton | REST/gRPC 接口 |
| 流程编排 | Airflow, Prefect, Dagster | 调度和依赖管理 |
| 监控告警 | Evidently, Grafana | 数据漂移、模型漂移、延迟 |

## 模型部署策略

### 部署模式对比

| 策略 | 描述 | 风险 | 回滚难度 | 流量控制 |
|------|------|------|----------|----------|
| 一次性切换 | 旧模型下线，新模型上线 | 高 | 高（需重启） | 100% 切换 |
| 影子部署 (Shadow) | 新模型在后台预测但不返回 | 无 | 无 | 0% 实际，100% 记录 |
| 金丝雀部署 (Canary) | 5-10% 流量先验证新模型 | 低 | 低 | 逐步提升 |
| A/B 测试 | 按用户分流，比较业务指标 | 低 | 低 | 可控分流比例 |
| 蓝绿部署 (Blue-Green) | 两套环境切换 | 低 | 低（秒级回滚） | 100% 切换 |

### A/B 测试评估代码

```python
import numpy as np
from scipy import stats

def ab_test_evaluate(control_results, treatment_results, alpha=0.05):
    """
    control_results: list[float] — 旧模型指标
    treatment_results: list[float] — 新模型指标
    """
    c = np.array(control_results)
    t = np.array(treatment_results)

    # 描述统计
    print(f"Control:   mean={c.mean():.4f}, std={c.std():.4f}, n={len(c)}")
    print(f"Treatment: mean={t.mean():.4f}, std={t.std():.4f}, n={len(t)}")
    print(f"Lift: {(t.mean()/c.mean() - 1)*100:+.2f}%")

    # Welch's t-test (不假设方差相等)
    t_stat, p_value = stats.ttest_ind(t, c, equal_var=False)

    # Mann-Whitney U (非参数)
    u_stat, u_pvalue = stats.mannwhitneyu(t, c, alternative='two-sided')

    print(f"\nWelch t-test:   t={t_stat:.3f}, p={p_value:.4f}")
    print(f"Mann-Whitney U: U={u_stat:.0f}, p={u_pvalue:.4f}")

    if p_value < alpha:
        print(f"\n✅ Statistically significant (p < {alpha})")
    else:
        print(f"\n❌ Not significant (p >= {alpha})")

    # 效应量 Cohen's d
    pooled_std = np.sqrt((c.var() + t.var()) / 2)
    cohens_d = (t.mean() - c.mean()) / pooled_std
    print(f"Cohen's d: {cohens_d:.3f}")

    return p_value, cohens_d

# 示例
np.random.seed(42)
control = np.random.normal(0.70, 0.05, 1000)    # 旧模型 AUC ~0.70
treatment = np.random.normal(0.72, 0.05, 1000)   # 新模型 AUC ~0.72
ab_test_evaluate(control, treatment)
```

## 模型监控

### 监控指标总览

| 类别 | 指标 | 计算公式 | 告警阈值建议 |
|------|------|----------|-------------|
| **数据漂移** | PSI (Population Stability Index) | $\sum (P_i-Q_i)\ln(P_i/Q_i)$ | > 0.1 告警, > 0.25 严重 |
| **数据漂移** | KS 统计量 | $\max |F_P(x) - F_Q(x)|$ | > 0.1 告警 |
| **特征漂移** | Wasserstein 距离 | $W(P,Q) = \inf_{\gamma}\mathbb{E}[||x-y||]$ | 相对基线 > 2x |
| **模型性能** | 线上 AUC / F1 / Accuracy | 按真实标签计算 | 相对训练下降 > 5% |
| **预测漂移** | 预测分布偏移 | JS 散度 $D_{JS}(P\|Q)$ | > 0.05 |
| **延迟** | p50 / p95 / p99 延迟 | Prometheus histogram | p99 > SLA |
| **吞吐量** | QPS (Queries Per Second) | 请求计数 / 时间 | 低于 E2E 测试 50% |
| **业务指标** | CTR / 转化率 / 留存 | 产品侧计算 | 持续下降 > 3天 |

### 数据漂移检测 (Evidently AI)

```python
import pandas as pd
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset

# 参考数据 (训练时) vs 当前数据 (线上)
reference = pd.read_csv("train_data.csv")
current = pd.read_csv("production_data.csv")

report = Report(metrics=[DataDriftPreset()])
report.run(reference_data=reference, current_data=current)

# 保存报告
report.save_html("drift_report.html")

# 也可以获取 JSON
result = report.as_dict()
for feature, info in result["metrics"][0]["result"]["drift_by_columns"].items():
    if info["drift_detected"]:
        print(f"⚠️  Drift detected: {feature}")
```

## MLflow 实验追踪

### 追踪训练实验

```python
import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score

mlflow.set_tracking_uri("http://localhost:5000")
mlflow.set_experiment("churn-prediction")

with mlflow.start_run(run_name="rf-baseline"):
    # 记录超参数
    params = {"n_estimators": 100, "max_depth": 10, "min_samples_split": 5}
    mlflow.log_params(params)

    # 训练
    model = RandomForestClassifier(**params, random_state=42)
    model.fit(X_train, y_train)

    # 记录指标
    y_pred = model.predict(X_test)
    mlflow.log_metrics({
        "accuracy": accuracy_score(y_test, y_pred),
        "f1": f1_score(y_test, y_pred, average="weighted")
    })

    # 记录模型和特征重要性
    mlflow.sklearn.log_model(model, "model")
    mlflow.log_artifact("feature_importance.png")

    print(f"Run ID: {mlflow.active_run().info.run_id}")
```

### MLflow 模型注册与部署

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()
model_name = "churn-classifier"

# 注册模型版本
run_id = "abc123..."
model_uri = f"runs:/{run_id}/model"
mv = mlflow.register_model(model_uri, model_name)
print(f"Registered model: {model_name} v{mv.version}")

# 转换 stage
client.transition_model_version_stage(
    name=model_name,
    version=mv.version,
    stage="Production",
    archive_existing_versions=True
)

# 加载生产模型
prod_model = mlflow.sklearn.load_model(f"models:/{model_name}/Production")
```

## Docker + FastAPI 完整部署

### 项目结构

```
ml-deploy/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用
│   ├── model.py         # 模型定义
│   └── schemas.py       # Pydantic 模型
├── model/
│   └── model.pkl        # 训练好的模型
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env
```

### FastAPI 服务 (`app/main.py`)

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib
import numpy as np
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ML Prediction API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 加载模型
model = joblib.load("model/model.pkl")
logger.info("Model loaded successfully")

class Features(BaseModel):
    features: list[float] = Field(..., min_length=1)

class BatchFeatures(BaseModel):
    instances: list[list[float]] = Field(..., min_length=1)

class Prediction(BaseModel):
    prediction: float
    probability: list[float] | None = None
    model_version: str = "1.0.0"

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": time.time()}

@app.post("/predict", response_model=Prediction)
def predict(data: Features):
    try:
        X = np.array(data.features).reshape(1, -1)
        pred = model.predict(X)[0]
        proba = None
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X)[0].tolist()
        return Prediction(prediction=float(pred), probability=proba)
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch-predict")
def batch_predict(data: BatchFeatures):
    try:
        X = np.array(data.instances)
        preds = model.predict(X).tolist()
        return {"predictions": preds, "count": len(preds)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
def metrics():
    return {"qps": "check /metrics for Prometheus", "status": "ok"}
```

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码和模型
COPY app/ ./app/
COPY model/ ./model/

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  model-api:
    build: .
    container_name: ml-prediction-api
    ports:
      - "8000:8000"
    environment:
      - MODEL_PATH=/app/model/model.pkl
      - LOG_LEVEL=INFO
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  mlflow:
    image: ghcr.io/mlflow/mlflow:v2.14.0
    container_name: mlflow-server
    ports:
      - "5000:5000"
    command: >
      mlflow server
      --host 0.0.0.0
      --port 5000
      --backend-store-uri sqlite:///mlflow.db
      --default-artifact-root /mlflow-artifacts
    volumes:
      - mlflow_data:/mlflow-artifacts
    restart: unless-stopped

  evidently-monitor:
    image: python:3.11-slim
    container_name: drift-monitor
    volumes:
      - ./monitoring:/app/monitoring
      - ./data:/app/data
    working_dir: /app
    command: >
      sh -c "pip install evidently pandas && python monitoring/drift_check.py"
    restart: "no"

volumes:
  mlflow_data:
```

## 作品集结构

一个优秀 ML 项目应包含：

1. **README.md** — 问题定义、数据说明、技术栈、结果摘要、复现步骤
2. **EDA Notebook** — 数据探索可视化、统计摘要、假设验证
3. **实验记录** — 不同方案和指标对比（可用 MLflow 或 Markdown 表格）
4. **最终方案** — 清晰代码，可复现 pipeline
5. **模型卡片 (Model Card)** — 预期用途、限制、公平性评估、伦理考量
6. **限制与反思** — 痛点、改进方向、已知问题

> 优秀的 ML 工程师不只是会调参，而是能有条理地说服别人这个方案值得信任。

## 延伸参考

- MLflow 官方文档 — https://mlflow.org/docs/latest/index.html
- FastAPI 官方文档 — https://fastapi.tiangolo.com/
- Evidently AI 文档 — https://docs.evidentlyai.com/
- Docker Compose 文档 — https://docs.docker.com/compose/
- Google MLOps 最佳实践 — https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning
- 《Designing Machine Learning Systems》(Chip Huyen) — MLOps 系统设计必读
- DVC 数据版本控制 — https://dvc.org/
- HuggingFace Model Card 模板 — https://huggingface.co/docs/hub/model-cards
'''

# ── Updated fields per chapter ────────────────────────────────────────────

UPDATES = {
    "dimensionality-reduction": {
        "difficulty": "advanced",
        "estimated_minutes": 55,
        "goals": [
            "掌握 PCA 完整五步流程（2D→1D 示例）",
            "理解 Scree Plot 和累计方差解释率选 K",
            "对比 Filter / Wrapper / Embedded 特征选择",
            "区分 PCA、t-SNE、UMAP 的适用场景"
        ],
        "checklist": [
            "能手写 NumPy PCA（中心化→协方差→特征分解→投影）",
            "能解释 t-SNE 不能用于新数据的原因",
            "能说出三种特征选择策略的优劣",
            "能画出 Scree Plot 并选择合适的 k"
        ],
        "experiments": [
            {
                "title": "PCA + t-SNE 对比可视化",
                "goal": "在 Digits/ Fashion-MNIST 上对比 PCA 和 t-SNE 降维效果",
                "steps": [
                    "加载 Digits 数据集",
                    "用 PCA 降维到 50 维再到 2D",
                    "用 t-SNE 降维到 2D",
                    "并排绘制散点图比较簇分离度"
                ],
                "output": "PCA vs t-SNE 可视化对比图",
                "difficulty": "advanced"
            },
            {
                "title": "特征选择实战",
                "goal": "比较 Filter/Wrapper/Embedded 在分类任务上的表现",
                "steps": [
                    "生成/加载高维数据集",
                    "用方差阈值、互信息做 Filter",
                    "用 RFE + RandomForest 做 Wrapper",
                    "用 Lasso / 树重要性做 Embedded",
                    "对比降维后模型准确率和特征数"
                ],
                "output": "特征选择策略对比报告",
                "difficulty": "intermediate"
            }
        ],
        "glossary": [
            {"term": "PCA", "definition": "主成分分析，线性投影使投影方差最大"},
            {"term": "t-SNE", "definition": "t-distributed Stochastic Neighbor Embedding，非线性降维保持局部邻域"},
            {"term": "Scree Plot", "definition": "碎石图，画特征值或方差解释率找肘部选 k"},
            {"term": "特征选择", "definition": "从原始特征中选择子集以降低复杂度、提升泛化"},
            {"term": "RFE", "definition": "递归特征消除，反复训练模型删最不重要特征"}
        ],
        "references": [
            {"title": "《机器学习》(西瓜书) 第10-11章", "source": "周志华", "note": "降维与特征选择系统论述", "url": "https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"},
            {"title": "scikit-learn PCA", "source": "scikit-learn.org", "note": "PCA 使用文档", "url": "https://scikit-learn.org/stable/modules/decomposition.html#pca"},
            {"title": "scikit-learn Feature Selection", "source": "scikit-learn.org", "note": "特征选择 API", "url": "https://scikit-learn.org/stable/modules/feature_selection.html"},
            {"title": "t-SNE 原论文", "source": "van der Maaten & Hinton 2008", "note": "JMLR 经典论文", "url": "https://www.jmlr.org/papers/volume9/vandermaaten08a/vandermaaten08a.pdf"},
            {"title": "3Blue1Brown PCA 可视化", "source": "YouTube", "note": "几何直观理解 PCA", "url": "https://www.youtube.com/watch?v=FgakZw6K1QQ"}
        ],
        "keywords": ["PCA", "t-SNE", "UMAP", "降维", "特征选择", "方差解释率", "Scree Plot", "RFE", "互信息"],
        "quiz": [
            {"question": "t-SNE 可以用于对新数据进行 transform 吗？", "options": ["可以，和 PCA 一样", "可以，但需要先 fit", "不可以，只能 fit_transform", "可以，但结果不稳定"], "correctIndex": 2, "explanation": "t-SNE 是非参数方法，学习的是训练数据的嵌入关系，不能应用到新数据。"},
            {"question": "Scree Plot 的'肘部'用来做什么？", "options": ["判断数据是否线性可分", "选择合适的主成分数量 k", "检测异常值", "评估分类准确率"], "correctIndex": 1, "explanation": "Scree Plot 中曲线由陡变缓的位置是合适的 k 值。"}
        ]
    },

    "generative-models": {
        "difficulty": "advanced",
        "estimated_minutes": 60,
        "goals": [
            "理解 GAN 的 minimax 博弈和训练不稳定性",
            "掌握 VAE 重参数化技巧和 ELBO 损失",
            "理解扩散模型的前向加噪和反向去噪过程",
            "从图像质量、训练难度、生成速度三维度对比三大生成模型"
        ],
        "checklist": [
            "能解释 GAN 模式崩塌的原因和缓解方法",
            "能手写 VAE 的 reparameterization trick",
            "能推导扩散模型前向过程跳步公式",
            "能说出哪种生成模型用于哪种场景"
        ],
        "experiments": [
            {
                "title": "VAE 手写体生成",
                "goal": "用 PyTorch 实现 VAE 在 MNIST 上训练和采样",
                "steps": [
                    "定义 Encoder (FC + mu/logvar head) + Decoder",
                    "实现 reparameterization 和 ELBO 损失",
                    "训练 20 epochs",
                    "可视化重建图像和 latent space 插值"
                ],
                "output": "VAE 生成和插值可视化",
                "difficulty": "advanced"
            },
            {
                "title": "DCGAN 生成实战",
                "goal": "用 DCGAN 在 CIFAR-10 上生成图像",
                "steps": [
                    "实现 DCGAN Generator 和 Discriminator",
                    "设置交替训练循环",
                    "训练并记录 G/D loss 曲线",
                    "保存生成图像并观察模式崩塌迹象"
                ],
                "output": "DCGAN 训练报告和生成样本",
                "difficulty": "expert"
            }
        ],
        "glossary": [
            {"term": "GAN", "definition": "生成对抗网络，生成器和判别器进行 minimax 博弈"},
            {"term": "VAE", "definition": "变分自编码器，将输入编码为概率分布再解码重建"},
            {"term": "扩散模型", "definition": "学习从纯噪声逐步去噪恢复数据的生成模型"},
            {"term": "模式崩塌", "definition": "GAN 的生成器只产生少数几种样本的问题"},
            {"term": "重参数化", "definition": "将随机采样转化为确定性+噪声以通过梯度"}
        ],
        "references": [
            {"title": "GAN 原论文", "source": "Goodfellow et al. 2014", "note": "生成对抗网络开创性工作", "url": "https://arxiv.org/abs/1406.2661"},
            {"title": "WGAN-GP", "source": "Gulrajani et al. 2017", "note": "解决 GAN 训练不稳定的关键工作", "url": "https://arxiv.org/abs/1704.00028"},
            {"title": "VAE 原论文", "source": "Kingma & Welling 2014", "note": "变分自编码器", "url": "https://arxiv.org/abs/1312.6114"},
            {"title": "DDPM", "source": "Ho et al. 2020", "note": "去噪扩散概率模型", "url": "https://arxiv.org/abs/2006.11239"},
            {"title": "Stable Diffusion", "source": "Rombach et al. 2022", "note": "Latent Diffusion Models", "url": "https://arxiv.org/abs/2112.10752"},
            {"title": "扩散模型深入解读", "source": "Lilian Weng's Blog", "note": "从浅入深理解扩散模型", "url": "https://lilianweng.github.io/posts/2021-07-11-diffusion-models/"}
        ],
        "keywords": ["GAN", "VAE", "扩散模型", "模式崩塌", "重参数化", "ELBO", "DDPM", "Stable Diffusion", "生成对抗"],
        "quiz": [
            {"question": "VAE 的 reparameterization trick 解决了什么问题？", "options": ["加速训练", "使随机采样可微分从而能反向传播", "减少参数量", "避免过拟合"], "correctIndex": 1, "explanation": "通过 z = mu + sigma * epsilon 将随机性外置到 epsilon，使梯度可通过 mu 和 sigma 流动。"},
            {"question": "为什么扩散模型生成质量最高但生成最慢？", "options": ["模型参数太多", "需要 T 步（50-1000）迭代去噪", "需要训练两个网络", "需要大量标注数据"], "correctIndex": 1, "explanation": "扩散模型通过逐步去噪生成，每次采样需迭代 T 步（通常 50-1000 步）。"}
        ]
    },

    "reinforcement-learning": {
        "difficulty": "expert",
        "estimated_minutes": 60,
        "goals": [
            "理解 MDP 五元组和网格世界模型",
            "掌握 Q-Learning 更新公式和时间差分学习",
            "理解 DQN 经验回放和目标网络两大创新",
            "区分 REINFORCE / Actor-Critic / PPO 三种策略方法"
        ],
        "checklist": [
            "能设计网格世界并实现 Q-Learning 表格算法",
            "能解释 DQN 为什么需要经验回放和目标网络",
            "能写出策略梯度的基本公式",
            "能解释 PPO 裁剪机制如何限制更新幅度"
        ],
        "experiments": [
            {
                "title": "Q-Learning 网格世界",
                "goal": "手写 Q-Learning 解决 4x4 网格导航问题",
                "steps": [
                    "定义 GridWorld 环境（奖励/陷阱/转移概率）",
                    "实现 epsilon-greedy 策略",
                    "运行 5000 episodes 训练 Q 表",
                    "可视化学到的策略路径和 Q 值热力图"
                ],
                "output": "网格世界最优路径和 Q 值热力图",
                "difficulty": "advanced"
            },
            {
                "title": "Q-Learning 网格世界",
                "goal": "手写 Q-Learning 解决网格导航问题",
                "steps": [
                    "定义 GridWorld 环境（奖励/陷阱/转移概率）",
                    "实现 epsilon-greedy 策略",
                    "运行 5000 episodes 训练 Q 表",
                    "可视化学到的策略路径"
                ],
                "output": "网格世界最优路径图",
                "difficulty": "advanced"
            }
        ],
        "glossary": [
            {"term": "MDP", "definition": "马尔可夫决策过程 (S,A,P,R,gamma)，RL 的数学框架"},
            {"term": "Q-Learning", "definition": "无模型 TD 学习，学习最优 Q(s,a) 值函数"},
            {"term": "Experience Replay", "definition": "存储 (s,a,r,s') 到缓冲池随机采样训练"},
            {"term": "Target Network", "definition": "固定参数的副本网络，稳定 DQN 训练"},
            {"term": "PPO", "definition": "近端策略优化，通过裁剪限制策略更新幅度"},
            {"term": "Actor-Critic", "definition": "结合策略网络(Actor)和价值网络(Critic)"}
        ],
        "references": [
            {"title": "《机器学习》(西瓜书) 第16章", "source": "周志华", "note": "强化学习中文入门", "url": "https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm"},
            {"title": "Sutton & Barto RL 圣经", "source": "Sutton & Barto", "note": "RL 必读教材（免费在线）", "url": "http://incompleteideas.net/book/the-book-2nd.html"},
            {"title": "DQN (Nature 2015)", "source": "Mnih et al.", "note": "Deep Q-Network 里程碑论文", "url": "https://www.nature.com/articles/nature14236"},
            {"title": "PPO 原论文", "source": "Schulman et al. 2017", "note": "Proximal Policy Optimization", "url": "https://arxiv.org/abs/1707.06347"},
            {"title": "OpenAI Spinning Up", "source": "OpenAI", "note": "RL 代码教程", "url": "https://spinningup.openai.com/"},
            {"title": "Hugging Face Deep RL Course", "source": "Hugging Face", "note": "交互式 RL 课程", "url": "https://huggingface.co/learn/deep-rl-course/"}
        ],
        "keywords": ["强化学习", "MDP", "Q-Learning", "DQN", "Policy Gradient", "Actor-Critic", "PPO", "Experience Replay"],
        "quiz": [
            {"question": "DQN 中 Target Network 的作用是什么？", "options": ["加速梯度下降", "减少过拟合", "稳定 TD 目标避免移动目标问题", "节省 GPU 内存"], "correctIndex": 2, "explanation": "Target Network 固定 TD 目标一段时间，避免在线网络更新时目标也在变导致的训练不稳定。"},
            {"question": "PPO 的 clip 操作限制了什么的更新幅度？", "options": ["梯度大小", "新旧策略概率比", "网络权重", "学习率"], "correctIndex": 1, "explanation": "PPO 裁剪 r_t = pi_new / pi_old 在 [1-ε, 1+ε] 范围内，限制策略变化幅度。"}
        ]
    },

    "ml-in-practice": {
        "difficulty": "expert",
        "estimated_minutes": 60,
        "goals": [
            "理解 MLOps 三级成熟度和核心组件",
            "掌握模型部署五种策略（影子/金丝雀/A/B/蓝绿）",
            "会用 MLflow 追踪实验和注册模型",
            "会用 Evidently 检测数据漂移",
            "能编写 Docker + FastAPI 生产级部署方案"
        ],
        "checklist": [
            "能画出完整 MLOps 流程图",
            "能写出 FastAPI 模型服务完整代码",
            "能配置 docker-compose.yml 部署模型",
            "能运行 A/B 测试并做统计显著性检验",
            "能使用 Evidently 检测线上数据漂移"
        ],
        "experiments": [
            {
                "title": "端到端部署实战",
                "goal": "训练模型 → MLflow 追踪 → FastAPI 服务 → Docker 部署",
                "steps": [
                    "训练一个分类/回归模型并保存",
                    "用 MLflow 记录实验参数和指标",
                    "编写 FastAPI predict endpoint",
                    "编写 Dockerfile 和 docker-compose.yml",
                    "docker-compose up 启动服务并测试"
                ],
                "output": "运行中的 ML 预测服务 (http://localhost:8000/docs)",
                "difficulty": "expert"
            },
            {
                "title": "数据漂移检测",
                "goal": "用 Evidently 检测训练和线上数据分布差异",
                "steps": [
                    "准备训练数据和模拟线上数据",
                    "运行 DataDriftPreset 报告",
                    "分析漂移特征和 PSI 值",
                    "编写告警阈值逻辑"
                ],
                "output": "数据漂移检测报告 (HTML + JSON)",
                "difficulty": "advanced"
            }
        ],
        "glossary": [
            {"term": "MLOps", "definition": "机器学习运维，涵盖从实验到生产监控的全生命周期"},
            {"term": "A/B 测试", "definition": "按用户分流对比新旧模型业务指标差异"},
            {"term": "Canary 部署", "definition": "少量流量先验证新模型，逐步提升比例"},
            {"term": "数据漂移", "definition": "线上数据分布变化偏离训练分布，导致模型退化"},
            {"term": "PSI", "definition": "Population Stability Index，衡量两个分布差异的指标"},
            {"term": "MLflow", "definition": "开源 ML 生命周期管理平台：追踪实验、注册模型、部署"}
        ],
        "references": [
            {"title": "MLflow 官方文档", "source": "mlflow.org", "note": "实验追踪和模型管理", "url": "https://mlflow.org/docs/latest/index.html"},
            {"title": "FastAPI 官方文档", "source": "fastapi.tiangolo.com", "note": "高性能 Python API 框架", "url": "https://fastapi.tiangolo.com/"},
            {"title": "Evidently AI", "source": "evidentlyai.com", "note": "开源 ML 监控和漂移检测", "url": "https://docs.evidentlyai.com/"},
            {"title": "Google MLOps 最佳实践", "source": "Google Cloud", "note": "CI/CD for ML 企业级实践", "url": "https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning"},
            {"title": "《Designing Machine Learning Systems》", "source": "Chip Huyen (O'Reilly)", "note": "MLOps 系统设计必读", "url": "https://www.oreilly.com/library/view/designing-machine-learning/9781098107956/"},
            {"title": "Docker Compose 文档", "source": "docker.com", "note": "多容器编排", "url": "https://docs.docker.com/compose/"}
        ],
        "keywords": ["MLOps", "Docker", "FastAPI", "MLflow", "数据漂移", "A/B 测试", "Evidently", "部署", "docker-compose"],
        "quiz": [
            {"question": "金丝雀部署 (Canary Deployment) 是什么？", "options": ["一次性替换所有模型", "同时运行新旧两个模型", "小比例流量先验证新模型", "只在测试环境运行"], "correctIndex": 2, "explanation": "金丝雀部署将 5-10% 流量先路由到新模型，验证无问题后逐步提升比例。"},
            {"question": "PSI > 0.25 通常表示什么？", "options": ["模型性能极好", "数据分布严重漂移需立即处理", "无需关注", "特征选择成功"], "correctIndex": 1, "explanation": "PSI > 0.25 通常表示参考和当前数据分布严重分歧，需要触发告警和调查。"}
        ]
    }
}

# ── Enrich function ───────────────────────────────────────────────────────

CH_SLUGS = [
    "dimensionality-reduction",
    "generative-models",
    "reinforcement-learning",
    "ml-in-practice",
]

async def enrich():
    engine = create_async_engine(os.environ["DATABASE_URL"])
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one_or_none()
        if not book:
            print("ERROR: Book not found. Run seed_ml_book.py first.")
            return
        book_id = book.id

        for slug in CH_SLUGS:
            r2 = await db.execute(select(MLBookChapter).where(
                MLBookChapter.book_id == book_id,
                MLBookChapter.slug == slug
            ))
            chapter = r2.scalar_one_or_none()
            if not chapter:
                print(f"WARN: Chapter '{slug}' not found, skipping.")
                continue

            # Update markdown
            chapter.markdown = ENRICHED[slug]
            print(f"  ✓ {slug}: markdown enriched ({len(ENRICHED[slug])} chars)")

            # Update other fields from UPDATES
            upd = UPDATES.get(slug, {})
            for field in upd:
                if field in ("goals", "checklist", "experiments", "glossary",
                             "references", "prerequisites", "keywords", "quiz"):
                    setattr(chapter, field, j(upd[field]))
                elif field == "difficulty":
                    chapter.difficulty = upd[field]
                elif field == "estimated_minutes":
                    chapter.estimated_minutes = upd[field]
            print(f"  ✓ {slug}: metadata updated ({len(upd)} fields)")

        await db.commit()
        print(f"\nOK: {len(CH_SLUGS)} chapters enriched successfully")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(enrich())
