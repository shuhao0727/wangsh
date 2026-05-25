import asyncio, json
from app.db.database import AsyncSessionLocal
from app.models.learning.content import LearningContentItem
from sqlalchemy import select

mm = """# 机器学习
## 监督学习
### 分类
#### K近邻 (KNN)
##### 核心思想：近朱者赤
##### 距离度量：欧氏距离
##### K值选择：奇数避免平局
#### 朴素贝叶斯
##### 核心思想：用概率公式算类别
##### 贝叶斯定理
##### 朴素假设：特征独立
##### 拉普拉斯平滑
#### 决策树
##### 核心思想：像做选择题
##### 信息增益·基尼系数
##### 熵：衡量混乱程度
##### 过拟合→剪枝
#### 随机森林
##### 核心思想：多棵树投票
##### Bagging采样
##### 特征重要性
#### 支持向量机 (SVM)
##### 核心思想：找最宽分界线
##### 支持向量
##### 核函数：低维→高维
##### 软间隔
#### 逻辑回归
##### 核心思想：Sigmoid→概率
##### 决策边界
##### 最大似然估计
### 回归
#### 线性回归
##### 核心思想：最小二乘法
##### 公式：y=wx+b
##### R²决定系数
##### 正则化：Ridge·Lasso
### 模型评估
#### 混淆矩阵
##### TP·FP·FN·TN
#### 精确率与召回率
##### P=TP/(TP+FP)
##### F1=2PR/(P+R)
#### ROC与AUC
##### 真正率vs假正率
#### 交叉验证
##### K折交叉验证
## 无监督学习
### 聚类
#### K-Means
##### 三步循环
##### 肘部法则选K
### 降维
#### PCA
##### 方差最大方向
##### 协方差矩阵→特征分解
##### 主成分
## 强化学习
### Q-Learning
##### 核心思想：试错学习
##### Agent·Env·Reward
##### Bellman方程
##### 探索vs利用
## 深度学习
### 神经网络基础
##### 感知机：单神经元
##### 激活函数：ReLU·Sigmoid
##### 反向传播
##### 梯度下降
### 卷积神经网络 (CNN)
##### 卷积核=特征检测器
##### 池化=缩小保留
##### LeNet→ResNet
### Transformer
##### 自注意力机制
##### Q·K·V
##### BERT vs GPT
## 核心工具
### 特征工程
##### 归一化
##### One-Hot编码
##### 特征选择
### 损失函数
##### MSE：均方误差
##### 交叉熵：分类用
##### 为什么分类不用MSE
"""

async def seed():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(LearningContentItem).where(
                LearningContentItem.module_key=='ml',
                LearningContentItem.section_key=='mindmap',
                LearningContentItem.item_key=='overview'
            )
        )
        item = result.scalar_one_or_none()
        if item:
            item.content = json.dumps({'markdown': mm}, ensure_ascii=False)
            print('Updated existing')
        else:
            db.add(LearningContentItem(
                module_key='ml', section_key='mindmap', item_key='overview',
                title='机器学习知识地图', summary='学习地图思维导图',
                content=json.dumps({'markdown': mm}, ensure_ascii=False),
                sort_order=0, source_type='seed',
            ))
            print('Inserted new')
        await db.commit()
        print('Mindmap seeded!')

asyncio.run(seed())
