"""Enrich ML book chapters 13-16 with visual content (ASCII diagrams + images).
APPENDS to existing markdown — does not replace.

Run: cd backend && python3 scripts/enrich_r3_ch13_16.py
"""
import asyncio, os, sys
sys.path.insert(0, ".")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

# ── Visual content to APPEND per chapter ───────────────────────────────────

VISUALS = {}

VISUALS["dimensionality-reduction"] = r"""

---

## 📐 可视化补充

### PCA 投影几何示意（2D → 1D）

```
        x₂
        ↑
        │    ·  ··
        │  ·  · ···  ◄── 原始 2D 数据点
        │   ··  ·
        │ ·   · ·
        └────────────→ x₁

        投影方向 v₁（第一主成分）

        x₂              ·╱
        ↑              ·╱
        │    ·  ··    ·╱
        │  ·  · ··· ·╱   ◄── 数据点投影到 v₁ 上
        │   ··  ·  ·╱
        │ ·   · · ·╱
        └────────╱───→ x₁
                v₁

        投影后 1D 数据:
        ────●────●──●─●─●──●──────→ z (沿 v₁ 的坐标)
```

**PCA 几何意义**：找数据方差最大的方向（第一主成分 v₁），将每个点垂直投影到该方向上，得到 1D 表示。

![PCA降维示意](https://placehold.co/700x400/8b5cf6/white?text=PCA+Projection)

### t-SNE 可视化示例

```
高维簇结构                t-SNE 2D 嵌入

  × × ×   ○ ○ ○          ××  ×   ○ ○ ○
  × × ×   ○ ○ ○    →     ×× ×    ○○ ○
  × × ×   ○ ○ ○           × ×    ○ ○ ○
  (3类混合)                (局部邻域保持，全局距离不保持)
```

t-SNE 保持局部相似性，但不能保持全局结构，也不能用于新数据 transform。

![t-SNE可视化示例](https://placehold.co/700x400/06b6d4/white?text=t-SNE+Visualization)

### 特征选择方法对比

```
方法类型        │ 原理                        │ 速度   │ 考虑模型交互
────────────────┼─────────────────────────────┼────────┼────────────
Filter          │ 统计指标筛选（方差/互信息）  │ ★★★   │ ✗
Wrapper (RFE)   │ 递归训练-删除特征           │ ★☆☆   │ ✓
Embedded (Lasso)│ 训练中自动特征选择           │ ★★☆   │ ✓
```

![特征选择方法对比](https://placehold.co/700x350/10b981/white?text=Feature+Selection)
"""

VISUALS["generative-models"] = r"""

---

## 🎨 模型架构可视化

### GAN — 生成对抗网络

```
    ┌─────────────────┐         ┌─────────────────┐
    │   z ~ N(0,1)    │         │   真实图像 x     │
    │   随机噪声向量   │         │   来自数据集     │
    └───────┬─────────┘         └────────┬────────┘
            │                            │
            ▼                            │
    ┌───────────────┐                    │
    │  Generator G  │                    │
    │  反卷积/上采样 │                    │
    └───────┬───────┘                    │
            │                            │
            ▼                            ▼
    ┌───────────────┐         ┌─────────────────┐
    │  G(z) 假图像   │         │   真实图像 x     │
    │  "I want to   │         │                 │
    │   fool D"     │         │                 │
    └───────┬───────┘         └────────┬────────┘
            │                          │
            └──────────┬───────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Discriminator D │
              │   卷积/下采样    │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  D(·) ∈ [0,1]  │
              │  真/假 二分类   │
              └─────────────────┘

Loss: min_G max_D  E[log D(x)] + E[log(1 - D(G(z)))]
      └─ Generator ─┘       └── Discriminator ──┘
```

![GAN架构](https://placehold.co/700x400/f59e0b/white?text=GAN+Architecture)

### VAE — 变分自编码器

```
    x (输入)                              x̂ (重建)
       │                                    ▲
       ▼                                    │
┌──────────────┐                    ┌──────────────┐
│   Encoder    │      z ~ q(z|x)    │   Decoder    │
│  ┌────┬────┐ │     ┌────────┐     │  反卷积/FC    │
│  │ μ  │ σ  │─┼──►  │  z = μ │     │              │
│  │    │    │ │     │  +σ·ε  │     │              │
│  └────┴────┘ │     │ ε~N(0,I)│    │              │
└──────────────┘     └────────┘     └──────────────┘
                            ▲
                            │
                    Reparameterization
                    Trick: 使采样可微

Loss = Reconstruction Loss + β · KL(q(z|x) || p(z))
       └── 重建项 ──────┘    └─── 正则项 ────────┘
```

![VAE结构](https://placehold.co/700x400/6366f1/white?text=VAE+Architecture)

### 扩散模型 — 前向加噪 & 反向去噪

```
前向过程 q（加噪，固定）：
x₀ ──→ x₁ ──→ x₂ ──→ ... ──→ x_T
清晰    加少量  加更多          纯噪声
图像    高斯噪声 高斯噪声      ~N(0,I)

反向过程 p_θ（去噪，学习）：
x_T ──→ ... ──→ x₂ ──→ x₁ ──→ x₀
纯噪声  预测并            预测并  清晰
       去除噪声          去除噪声 图像

每一步: x_{t-1} = 1/√α_t · (x_t - (1-α_t)/√(1-ᾱ_t) · ε_θ(x_t, t)) + σ_t·z
        └────── 缩放 ──────┘  └─────── 预测噪声并去除 ─────────┘  └──随机项──┘
```

![扩散模型过程](https://placehold.co/800x350/ef4444/white?text=Diffusion+Process)
"""

VISUALS["reinforcement-learning"] = r"""

---

## 🎯 强化学习可视化

### MDP 网格世界模型

```
        0       1       2       3
      ┌───────┬───────┬───────┬───────┐
    0 │ START │       │       │  💀    │  ← 陷阱 (-10)
      │  S    │       │       │  T     │
      ├───────┼───────┼───────┼───────┤
    1 │       │  💀   │       │       │
      │       │  T    │       │       │
      ├───────┼───────┼───────┼───────┤
    2 │       │       │       │       │
      │       │       │       │       │
      ├───────┼───────┼───────┼───────┤
    3 │       │       │       │  🏁    │  ← 目标 (+10)
      │       │       │       │  G     │
      └───────┴───────┴───────┴───────┘

动作空间 A = {↑, ↓, ←, →}
转移概率: P(s'|s,a) = 0.8 正确方向 + 0.1×2 侧滑
折扣因子 γ = 0.9
每步奖励 = -1（鼓励最短路径）
```

**MDP 五元组 (S, A, P, R, γ)**：
- S — 状态集（16 个格子）
- A — 动作集（4 个方向）
- P — 转移概率矩阵
- R — 奖励函数
- γ — 折扣因子（0.9）

![MDP框架示意](https://placehold.co/700x400/8b5cf6/white?text=MDP+Framework)

### Q-Learning 算法流程

```
        ┌─────────────────────┐
        │  初始化 Q(s,a) = 0  │
        │  初始化 ε = 1.0     │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │  Episode 开始        │◄──────────────────────────────┐
        │  s = 初始状态        │                               │
        └──────────┬──────────┘                               │
                   │                                           │
        ┌──────────▼──────────┐                               │
        │  选择动作 a:         │                               │
        │  p=ε: 随机探索       │                               │
        │  p=1-ε: argmax Q(s,·)│                              │
        └──────────┬──────────┘                               │
                   │                                           │
        ┌──────────▼──────────┐                               │
        │  执行 a, 观察 r, s'  │                               │
        └──────────┬──────────┘                               │
                   │                                           │
        ┌──────────▼──────────┐                               │
        │  Q 值更新:          │                               │
        │  Q(s,a) ← Q(s,a) +  │                               │
        │  α[r + γ·max Q(s',·)│                               │
        │     - Q(s,a)]        │                              │
        └──────────┬──────────┘                               │
                   │                                           │
        ┌──────────▼──────────┐                               │
        │  s ← s'             │                               │
        └──────────┬──────────┘                               │
                   │                                           │
        ┌──────────▼──────────┐      yes    ┌─────────────────┐
        │  s' 是终止状态?      │────────────►│  ε ← ε × 0.995  │
        └──────────┬──────────┘             │  Episode 结束    │
                   │ no                     └────────┬─────────┘
                   └─────────────────────────────────┘
```

**Q-Learning 核心公式**：

$$ Q(s,a) \leftarrow Q(s,a) + \alpha \left[ r(s,a) + \gamma \max_{a'} Q(s',a') - Q(s,a) \right] $$

其中：
- α — 学习率（0.1）
- γ — 折扣因子（0.9）
- TD 误差 = r + γ·max Q(s',·) - Q(s,a)

![Q-Learning算法流程](https://placehold.co/600x500/10b981/white?text=Q-Learning+Flow)
"""

VISUALS["ml-in-practice"] = r"""

---

## 🔧 MLOps 与部署可视化

### MLOps 完整流水线

```
┌──────────────────────────────────────────────────────────────────────┐
│                        MLOps Pipeline (Level 2)                       │
│                                                                       │
│  ┌─────────┐   ┌─────────┐   ┌───────────┐   ┌──────────┐           │
│  │ 数据源   │──►│ 特征工程 │──►│ 实验追踪   │──►│ 模型注册  │           │
│  │ DVC/S3  │   │ Feast/   │   │ MLflow    │   │ MLflow   │           │
│  │         │   │  Pandas  │   │           │   │ Registry │           │
│  └─────────┘   └─────────┘   └───────────┘   └─────┬────┘           │
│                                                     │                │
│                                                     ▼                │
│  ┌─────────┐   ┌─────────┐   ┌───────────┐   ┌──────────┐           │
│  │ 监控告警│◄──│ 线上服务 │◄──│ CI/CD     │◄──│ 模型打包  │           │
│  │Evidently│   │ FastAPI │   │ GitHub    │   │ Docker   │           │
│  │Prometheus│   │ Docker  │   │ Actions   │   │ Image    │           │
│  └─────────┘   └─────────┘   └───────────┘   └──────────┘           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**MLOps 三级成熟度**：
- **Level 0（手动）**：每次手动训练、评估、部署
- **Level 1（自动化训练）**：CT 持续训练 + 自动触发部署
- **Level 2（CI/CD）**：完整 CI/CD 流水线，自动构建-测试-部署

![MLOps流水线](https://placehold.co/800x350/6366f1/white?text=MLOps+Pipeline)

### 模型部署策略对比

```
策略          流量分配              回滚速度   风险     适用场景
─────────────────────────────────────────────────────────────────
Shadow        新模型看流量但不响应     -        零      验证性能
Canary        新模型 5% → 50% → 100%  快      低      渐进发布
A/B           新旧各50%对比业务指标   中      中      在线实验
Blue/Green    瞬时切换              瞬时     中      紧急回滚

    时间 ──────────────────────────────────────────────►

    Canary:
    旧模型  ████████████████████░░░░░░░░░░░░░░████
    新模型  ░░░░░░░░░░░░░░░░░░████████████████████
             5%          50%          100%

    A/B 测试:
    用户群A  ████████████████████████████████████  → 旧模型
    用户群B  ████████████████████████████████████  → 新模型
                                             │
                                        对比指标：CTR/转化率
```

![模型部署策略](https://placehold.co/700x400/06b6d4/white?text=Deployment+Strategies)

### A/B 测试统计决策

```
    对照组 (旧模型)              实验组 (新模型)
    ┌──────────────┐            ┌──────────────┐
    │  CTR = 5.2%  │            │  CTR = 5.8%  │
    │  n₁ = 10000  │            │  n₂ = 10000  │
    └──────────────┘            └──────────────┘

    H₀: CTR_new = CTR_old  (原假设: 无差异)
    H₁: CTR_new ≠ CTR_old  (备择假设: 有差异)

    统计检验: 双比例 Z 检验
    Z = (p̂₂ - p̂₁) / √(p̂(1-p̂)(1/n₁ + 1/n₂))
    
    p-value < 0.05 → 拒绝 H₀ → 新模型显著更优 ✅
    p-value ≥ 0.05 → 不能拒绝 H₀ → 证据不足，继续实验 ⏳
```

![A-B测试示意](https://placehold.co/600x350/10b981/white?text=A-B+Testing)
"""

# ── Enrich function (APPEND only) ─────────────────────────────────────────

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

            visual = VISUALS.get(slug)
            if not visual:
                print(f"WARN: No visual content for '{slug}', skipping.")
                continue

            # APPEND visual content to existing markdown
            old_len = len(chapter.markdown or "")
            chapter.markdown = (chapter.markdown or "") + visual
            new_len = len(chapter.markdown)
            print(f"  ✓ {slug}: appended {new_len - old_len} chars ({old_len} → {new_len})")

        await db.commit()
        print(f"\nOK: {len(CH_SLUGS)} chapters enriched with visual content")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(enrich())
