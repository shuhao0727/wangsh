import asyncio, os, sys, json
sys.path.insert(0, ".")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://admin:wangshuhao0727@127.0.0.1:5432/wangsh_db")
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.ml.book import MLBook, MLBookChapter

SLUGS = ["introduction", "math-foundations", "model-evaluation", "linear-models"]

NEW_GLOSSARY = {
    "introduction": [
        {"term": "训练集", "definition": "用于训练模型的数据子集"},
        {"term": "测试集", "definition": "用于评估模型在整个训练完成后泛化能力的数据子集"},
        {"term": "监督学习", "definition": "从已标注数据中学习输入到输出的映射"},
        {"term": "无监督学习", "definition": "从未标注数据中发现内在结构或模式"},
        {"term": "强化学习", "definition": "智能体通过与环境交互、接收奖励信号来学习最优策略"},
    ],
    "math-foundations": [
        {"term": "链式法则", "definition": "复合函数求导法则: dz/dx = dz/dy · dy/dx"},
        {"term": "随机梯度下降(SGD)", "definition": "每次更新仅使用一个或少量样本计算梯度的优化算法"},
        {"term": "Adam优化器", "definition": "结合动量与自适应学习率的梯度下降变体"},
    ],
    "model-evaluation": [
        {"term": "ROC曲线", "definition": "以假阳率为横轴、真阳率为纵轴，刻画分类模型在不同阈值下表现的曲线"},
        {"term": "网格搜索", "definition": "在指定的超参数值网格中穷举搜索最优组合"},
        {"term": "验证集", "definition": "用于调整模型超参数、而非最终评估的数据子集"},
        {"term": "分层采样", "definition": "保持各类别比例不变的抽样方法"},
    ],
    "linear-models": [
        {"term": "多项式特征", "definition": "通过构造原始特征的高次幂和交叉项来增加特征维度"},
        {"term": "决策边界", "definition": "分类器中区分不同类别的超平面"},
        {"term": "对数几率", "definition": "log(p/(1-p))，逻辑回归中为 w·x"},
        {"term": "解析解", "definition": "通过数学公式直接求得的精确解，如正规方程"},
    ],
}

NEW_QUIZ = {
    "introduction": [
        {"question": "预测房价属于什么任务？", "options": ["分类", "回归", "聚类", "降维"], "correctIndex": 1, "explanation": "房价是连续值，预测连续值属于回归任务。"},
        {"question": "ML项目工作流的第一步是什么？", "options": ["建模", "数据收集", "问题定义", "部署"], "correctIndex": 2, "explanation": "一切ML项目始于明确的问题定义。"},
    ],
    "math-foundations": [
        {"question": "梯度下降中学习率过大导致什么？", "options": ["收敛太慢", "震荡或发散", "自动停止", "梯度为0"], "correctIndex": 1, "explanation": "学习率过大会在最小值附近震荡甚至跳过最小值导致发散。"},
        {"question": "为什么需要非线性激活函数？", "options": ["加速计算", "多层线性=单层线性", "减少参数", "防止过拟合"], "correctIndex": 1, "explanation": "若激活函数为线性，多层神经网络等价于单层线性变换，失去深度网络的意义。"},
    ],
    "model-evaluation": [
        {"question": "AUC=0.5代表什么？", "options": ["完美分类", "等同于随机猜测", "模型错误", "过拟合"], "correctIndex": 1, "explanation": "AUC=0.5表示模型区分正负样本的能力等同于随机猜测。"},
        {"question": "k折交叉验证中k越大有何影响？", "options": ["偏差更大", "偏差更小方差更大", "偏差方差都小", "无影响"], "correctIndex": 1, "explanation": "k越大训练数据越多偏差越小，但各次评估相关性增加导致方差变大。"},
    ],
    "linear-models": [
        {"question": "L1正则化导致什么效果？", "options": ["所有权重变小", "稀疏解(权重为0)", "增加模型容量", "加快训练"], "correctIndex": 1, "explanation": "L1正则化产生稀疏解，部分特征权重被压缩为0，天然实现特征选择。"},
        {"question": "逻辑回归的Sigmoid输出代表什么？", "options": ["类别标签", "概率", "损失值", "特征重要性"], "correctIndex": 1, "explanation": "Sigmoid将线性组合映射到(0,1)，直接表示样本属于正类的概率。"},
    ],
}

NEW_CHECKLIST = {
    "introduction": ["能运行第一个scikit-learn分类器", "能区分训练集和测试集的作用"],
    "math-foundations": ["能写出梯度下降的一步更新公式", "能计算简单矩阵乘法的输出形状"],
    "model-evaluation": ["能画出ROC曲线草图", "能解释为什么分类不平衡时准确率不可靠"],
    "linear-models": ["能用scikit-learn训练带L1和L2正则化的逻辑回归", "能解释权重系数与特征重要性的关系"],
}

NEW_KEYWORDS = {
    "introduction": ["训练集", "测试集", "ML工作流"],
    "math-foundations": ["SGD", "Adam", "学习率调度"],
    "model-evaluation": ["ROC", "网格搜索", "分层采样", "验证集"],
    "linear-models": ["多项式特征", "决策边界", "对数几率"],
}

CROSSREFS = {
    "introduction": "继续阅读: [第2章 数学基础](#) 巩固数学基础, [第4章 线性模型](#) 学习第一个具体算法",
    "math-foundations": "继续阅读: [第3章 模型评估](#) 学习如何判断模型好坏, [第9章 神经网络](#) 理解梯度下降在深度学习中的应用",
    "model-evaluation": "继续阅读: [第4章 线性模型](#) 在真实模型上实践评估, [第8章 集成学习](#) 学习网格搜索在XGBoost中的应用",
    "linear-models": "继续阅读: [第5章 决策树](#) 学习非线性模型, [第6章 SVM](#) 理解间隔最大化",
}

async def enrich():
    engine = create_async_engine(os.environ["DATABASE_URL"])
    sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sess() as db:
        r = await db.execute(select(MLBook).where(MLBook.module_key == "ml"))
        book = r.scalar_one()
        for slug in SLUGS:
            r2 = await db.execute(select(MLBookChapter).where(
                MLBookChapter.book_id == book.id, MLBookChapter.slug == slug
            ))
            ch = r2.scalar_one()

            if slug in NEW_GLOSSARY:
                existing = json.loads(ch.glossary or "[]")
                merged = existing + NEW_GLOSSARY[slug]
                ch.glossary = json.dumps(merged, ensure_ascii=False)
                print(f"  {slug}: glossary {len(existing)} → {len(merged)}")

            if slug in NEW_QUIZ:
                existing = json.loads(ch.quiz or "[]")
                merged = existing + NEW_QUIZ[slug]
                ch.quiz = json.dumps(merged, ensure_ascii=False)
                print(f"  {slug}: quiz {len(existing)} → {len(merged)}")

            if slug in NEW_CHECKLIST:
                existing = json.loads(ch.checklist or "[]")
                merged = existing + NEW_CHECKLIST[slug]
                ch.checklist = json.dumps(merged, ensure_ascii=False)
                print(f"  {slug}: checklist {len(existing)} → {len(merged)}")

            if slug in NEW_KEYWORDS:
                existing = json.loads(ch.keywords or "[]")
                merged = existing + NEW_KEYWORDS[slug]
                ch.keywords = json.dumps(merged, ensure_ascii=False)
                print(f"  {slug}: keywords {len(existing)} → {len(merged)}")

            if slug in CROSSREFS:
                ch.markdown = (ch.markdown or "") + "\n\n## 进阶学习路径\n\n" + CROSSREFS[slug] + "\n"
                print(f"  {slug}: markdown + cross-references")

        await db.commit()
        print(f"\nDone: {len(SLUGS)} chapters enriched")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(enrich())
