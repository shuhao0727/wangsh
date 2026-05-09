"""Enrich ML book chapters 5-8: glossary, quiz, checklist, keywords + cross-references.

Run: cd backend && python3 scripts/enrich_r4_5_ch5_8.py
"""
import asyncio, json, os, sys
sys.path.insert(0, ".")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

def j(v): return json.dumps(v, ensure_ascii=False)

# ── Updates: glossary, quiz, checklist, keywords ──────────────────────────

UPDATES = {
    "decision-trees": {
        "glossary": [
            {"term": "信息熵", "definition": "H=-sum(p_k*log p_k)，度量集合纯度，熵越大越不纯"},
            {"term": "信息增益", "definition": "按某属性划分前后熵的减少量，ID3 使用的分裂准则"},
            {"term": "增益率", "definition": "信息增益除以属性固有熵(IV)，C4.5 使用，解决信息增益偏向多值属性的问题"},
            {"term": "基尼指数", "definition": "Gini=1-sum(p_k^2)，CART 默认分裂准则，计算比熵更快"},
            {"term": "剪枝", "definition": "主动减少分支防止过拟合，分预剪枝(提前停止)和后剪枝(剪去冗余分支)"},
            {"term": "KNN", "definition": "K近邻，惰性学习，预测时找训练集中最近的K个邻居投票/平均"},
            {"term": "维度灾难", "definition": "高维空间中数据变得稀疏，距离度量失效，KNN 等距离方法性能急剧下降"},
        ],
        "quiz": [
            {"question": "决策树中信息熵从 0.8 降至 0.2，意味着什么？", "options": ["划分后集合更纯", "划分后集合更不纯", "划分失败", "需要换一个根节点"], "correctIndex": 0, "explanation": "熵越低集合越纯，熵下降说明划分有效提升了纯度。"},
            {"question": "KNN 中通常使用哪些距离度量？", "options": ["仅欧氏距离", "欧氏距离、曼哈顿距离、闵可夫斯基距离等", "只能用余弦距离", "距离对 KNN 结果没有影响"], "correctIndex": 1, "explanation": "KNN 支持多种距离度量，欧氏距离最常用，曼哈顿、闵可夫斯基等也可选，需根据数据特征选择。"},
            {"question": "决策树剪枝的主要目的是什么？", "options": ["让树长得更深", "减少训练时间", "防止过拟合提升泛化能力", "增加叶子节点数量"], "correctIndex": 2, "explanation": "剪枝通过去除对泛化无益的分支来降低过拟合风险，提升模型在新数据上的表现。"},
        ],
        "checklist": [
            "能画出简单决策树结构",
            "能解释KNN为什么必须先标准化",
            "能说出CART默认用哪个分裂准则",
            "能画出ID3决策树的分裂过程",
            "能解释K近邻中K值的影响",
        ],
        "keywords": ["决策树", "KNN", "信息增益", "基尼指数", "剪枝", "C4.5", "CART", "欧氏距离", "惰性学习"],
    },
    "svm": {
        "glossary": [
            {"term": "支持向量", "definition": "最靠近决策边界的训练样本，决定了间隔的位置和宽度"},
            {"term": "间隔", "definition": "分类超平面到最近样本点的距离，SVM 追求最大化最小间隔"},
            {"term": "核技巧", "definition": "通过核函数隐式计算高维空间内积，避免显式映射，使线性分类器能处理非线性问题"},
            {"term": "软间隔", "definition": "允许少量样本在间隔内或错分，通过松弛变量 ξ 控制，提升鲁棒性"},
            {"term": "C参数", "definition": "权衡间隔大小与错分惩罚的正则化超参：C 大→少犯错(可能过拟合)，C 小→间隔大(更泛化)"},
            {"term": "RBF核", "definition": "K(x,z)=exp(-γ||x-z||^2)，最常用的核函数，通过 γ 控制每个样本的影响半径"},
            {"term": "对偶问题", "definition": "将原问题转化为对 Lagrange 乘子的优化，使得核技巧自然引入且仅依赖内积"},
        ],
        "quiz": [
            {"question": "RBF 核的 gamma 参数变大时会发生什么？", "options": ["每个点影响范围变小，容易过拟合", "每个点影响范围变大，容易欠拟合", "对模型没有影响", "只能用于回归任务"], "correctIndex": 0, "explanation": "gamma 越大，RBF 核的宽度越窄，每个支持向量的影响范围越小，决策边界更复杂，容易过拟合。"},
            {"question": "什么时候应该用线性核而非 RBF 核？", "options": ["数据量非常大时", "特征数远大于样本数或数据近似线性可分时", "总是用 RBF 更好", "只有做回归时"], "correctIndex": 1, "explanation": "当特征维度很高（如文本分类）或数据本身近似线性可分时，线性核更快且不易过拟合；RBF 适合非线性低维数据。"},
            {"question": "C 参数控制 SVM 的什么行为？", "options": ["核函数类型", "训练速度", "间隔大小与错分样本数的权衡", "特征数量"], "correctIndex": 2, "explanation": "C 是正则化/惩罚系数：大 C 严格要求正确分类（间隔窄），小 C 允许更多错分（间隔宽），平衡偏差与方差。"},
        ],
        "checklist": [
            "能解释SVC三个关键参数",
            "能判断何时用线性核vs RBF核",
            "能说出gamma的含义",
            "能画出最大间隔分类器的示意图",
            "能解释gamma参数的双重影响",
        ],
        "keywords": ["SVM", "核技巧", "RBF", "软间隔", "SVR", "多项式核", "一对多", "一对一"],
    },
    "bayesian": {
        "glossary": [
            {"term": "先验概率", "definition": "P(c)，在看到任何特征之前对类别 c 的初始信念"},
            {"term": "后验概率", "definition": "P(c|x)，观察特征 x 之后更新后的信念，是贝叶斯分类的决策依据"},
            {"term": "似然", "definition": "P(x|c)，如果样本属于类别 c，观察到特征 x 的概率"},
            {"term": "条件独立", "definition": "朴素贝叶斯核心假设：给定类别标签，所有特征之间相互独立"},
            {"term": "拉普拉斯平滑", "definition": "在计数中加 1(或 α) 避免零概率问题，P(x_i|c)=(count+α)/(total+α|V|)"},
            {"term": "生成模型", "definition": "先学习联合分布 P(x,c)，再通过贝叶斯公式得到 P(c|x) 的分类方法"},
            {"term": "判别模型", "definition": "直接学习决策边界 P(c|x) 或 f(x) 的分类方法，如逻辑回归、SVM"},
        ],
        "quiz": [
            {"question": "贝叶斯定理 P(c|x) ∝ P(x|c)·P(c) 在分类中如何应用？", "options": ["直接比较 P(c) 的大小", "计算每个类别的后验概率，选最大者作为预测", "只关心 P(x) 的值", "不需要任何训练数据"], "correctIndex": 1, "explanation": "对每个候选类别计算后验概率 P(c|x)，取后验最大的类别作为预测结果，P(x) 对所有类别相同可忽略。"},
            {"question": "朴素贝叶斯的条件独立假设现实中几乎不成立，为什么它仍然有效？", "options": ["因为有大量的训练数据", "虽然概率估计可能不校准，但类别排序(哪个后验最大)常常正确", "模型会自动修正", "因为它比深度学习更先进"], "correctIndex": 1, "explanation": "分类只需后验概率的相对大小排序正确即可，即使绝对概率校准性不佳，排名正确仍能有效分类。"},
            {"question": "GaussianNB 和 MultinomialNB 分别适用于什么场景？", "options": ["都是通用的没区别", "GaussianNB 适合连续特征，MultinomialNB 适合词频/计数特征", "GaussianNB 适合文本，MultinomialNB 适合图像", "只能用 GaussianNB"], "correctIndex": 1, "explanation": "GaussianNB 假设特征服从高斯分布，适合连续数值特征；MultinomialNB 假设特征服从多项式分布，适合离散计数如词频。"},
        ],
        "checklist": [
            "能推导朴素贝叶斯决策公式",
            "能解释条件独立假设",
            "能说出三种变体的适用场景",
            "能用朴素贝叶斯实现垃圾邮件分类",
            "能解释条件独立假设的含义",
        ],
        "keywords": ["贝叶斯", "朴素贝叶斯", "先验", "后验", "文本分类", "拉普拉斯平滑", "生成式", "概率校准"],
    },
    "ensemble": {
        "glossary": [
            {"term": "Bagging", "definition": "Bootstrap Aggregating，并行训练多个基学习器，通过投票/平均降低方差，代表：随机森林"},
            {"term": "Boosting", "definition": "顺序训练基学习器，每个后续模型关注前面犯错的样本，逐步降低偏差"},
            {"term": "Stacking", "definition": "分层集成：用多个异构基模型输出作为元模型输入，学习最优组合方式"},
            {"term": "自助采样", "definition": "Bootstrap：从原始数据有放回抽样生成与原始同大小的训练集，每棵树约 63.2% 样本"},
            {"term": "随机森林", "definition": "Bagging + 特征随机子集：多棵决策树并行训练，每分裂只考虑部分特征，方差极低"},
            {"term": "梯度提升", "definition": "Boosting 的泛化框架，每步用梯度下降拟合残差，代表 GBDT/XGBoost/LightGBM"},
            {"term": "学习率nu", "definition": "shrinkage：每个弱学习器的贡献缩放因子 ν∈(0,1]，ν 小→需要更多树但泛化更好"},
            {"term": "OOB误差", "definition": "Out-of-Bag：用未被 Bootstrap 选中的约 36.8% 样本做验证，随机森林的免费交叉验证"},
        ],
        "quiz": [
            {"question": "Bagging 和 Boosting 最核心的区别是什么？", "options": ["Bagging 提升偏差，Boosting 提升方差", "Bagging 并行训练降低方差，Boosting 顺序训练降低偏差", "两者完全相同", "Bagging 只能用决策树"], "correctIndex": 1, "explanation": "Bagging 并行训练独立模型取平均，主要降低方差；Boosting 顺序训练逐步修正错误，主要降低偏差。"},
            {"question": "为什么随机森林增加树的数量不会过拟合？", "options": ["因为它不做任何分裂", "平均/投票操作降低方差，增加树只平滑不加剧过拟合", "树越多方差越大", "它没有随机性"], "correctIndex": 1, "explanation": "随机森林通过 Bootstrap 和特征随机子集引入多样性，平均操作只会持续降低方差而不会过拟合，但增加单棵树深度仍会过拟合。"},
            {"question": "XGBoost 相比传统 GBDT 的优势是什么？", "options": ["只能做分类", "支持二阶导数 + 正则化 + 并行计算，更快更准", "不需要任何超参数", "只适合小数据集"], "correctIndex": 1, "explanation": "XGBoost 使用二阶泰勒展开逼近损失、加入 L1/L2 正则化、支持列块并行，在速度和精度上都优于传统 GBDT。"},
        ],
        "checklist": [
            "能说出自助采样法原理",
            "能解释Boosting为什么顺序训练",
            "能列出三种Boosting框架区别",
            "能比较随机森林和XGBoost的适用场景",
            "能解释学习率在Boosting中的作用",
        ],
        "keywords": ["集成学习", "Bagging", "Boosting", "随机森林", "XGBoost", "GBDT", "CatBoost", "特征随机子集", "基学习器"],
    },
}

# ── Cross-references to APPEND ────────────────────────────────────────────

CROSSREFS = {
    "decision-trees": """
---
> **继续阅读**: [第8章 集成学习](#) 看决策树如何组队, [第12章 聚类](#) 了解K-Means与KNN的距离度量对比""",
    "svm": """
---
> **继续阅读**: [第4章 线性模型](#) 对比线性分类器的不同思路, [第9章 神经网络](#) 看深度学习如何隐式学习特征映射""",
    "bayesian": """
---
> **继续阅读**: [第14章 生成模型](#) 理解更复杂的生成式模型 GAN/VAE, [第4章 线性模型](#) 对比判别式分类器""",
    "ensemble": """
---
> **继续阅读**: [第16章 实战MLOps](#) 学习如何上线集成模型, [第5章 决策树](#) 回顾基学习器原理""",
}

CH_SLUGS = ["decision-trees", "svm", "bayesian", "ensemble"]


async def enrich():
    engine = create_async_engine(os.environ["DATABASE_URL"])
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one_or_none()
        if not book:
            print("ERROR: Book not found. Run seed_ml_book_2.py first.")
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

            upd = UPDATES.get(slug, {})
            for field in upd:
                if field in ("goals", "checklist", "experiments", "glossary",
                             "references", "prerequisites", "keywords", "quiz"):
                    setattr(chapter, field, j(upd[field]))
            print(f"  ✓ {slug}: metadata updated ({', '.join(upd.keys())})")

            # Append cross-reference to existing markdown (if not already appended)
            xref = CROSSREFS.get(slug, "")
            if xref and xref.strip():
                current = chapter.markdown or ""
                if "继续阅读" not in current:
                    chapter.markdown = current.rstrip() + "\n" + xref
                    print(f"  ✓ {slug}: cross-reference appended")

        await db.commit()
        print(f"\nOK: {len(CH_SLUGS)} chapters enriched successfully")


if __name__ == "__main__":
    asyncio.run(enrich())
