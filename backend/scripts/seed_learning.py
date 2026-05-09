"""Seed ML learning content into database."""
import asyncio, json
from app.db.database import AsyncSessionLocal
from app.models.learning.content import LearningContentItem
from sqlalchemy import select

ML_TOOLS = [
    {"name":"NumPy","description":"Python科学计算基础库","category":"python-libs","url":"https://numpy.org"},
    {"name":"Pandas","description":"数据分析与处理库","category":"python-libs","url":"https://pandas.pydata.org"},
    {"name":"Matplotlib","description":"Python数据可视化库","category":"visualization","url":"https://matplotlib.org"},
    {"name":"Seaborn","description":"统计可视化","category":"visualization","url":"https://seaborn.pydata.org"},
    {"name":"scikit-learn","description":"经典机器学习算法库","category":"ml-frameworks","url":"https://scikit-learn.org"},
    {"name":"XGBoost","description":"梯度提升框架","category":"ml-frameworks","url":"https://xgboost.readthedocs.io"},
    {"name":"LightGBM","description":"微软开源梯度提升框架","category":"ml-frameworks","url":"https://lightgbm.readthedocs.io"},
    {"name":"PyTorch","description":"深度学习框架，动态计算图","category":"ml-frameworks","url":"https://pytorch.org"},
    {"name":"HuggingFace","description":"预训练模型库","category":"llm-tools","url":"https://huggingface.co"},
    {"name":"FastAPI","description":"Python高性能Web框架","category":"deployment","url":"https://fastapi.tiangolo.com"},
    {"name":"Docker","description":"容器化部署平台","category":"deployment","url":"https://www.docker.com"},
    {"name":"MLflow","description":"ML实验追踪和模型管理","category":"experiment-tracking","url":"https://mlflow.org"},
    {"name":"Jupyter","description":"交互式编程笔记本","category":"data-tools","url":"https://jupyter.org"},
    {"name":"LangChain","description":"LLM应用开发框架","category":"llm-tools","url":"https://www.langchain.com"},
    {"name":"ChromaDB","description":"开源向量数据库","category":"data-tools","url":"https://www.trychroma.com"},
]

ML_EXPERIMENTS = [
    {"name":"从零实现线性回归","data":"California Housing","tools":["NumPy","Pandas","Matplotlib"],"skills":["梯度下降","向量化"],"goal":"手写梯度下降实现线性回归","estimated_time":"2-3小时","deliverables":"Notebook+对比报告","difficulty":"beginner","steps":["1.加载California Housing数据","2.选MedInc作特征并画散点图","3.标准化数据","4.手写梯度下降(500轮)","5.画损失曲线","6.sklearn对比"],"code":"import numpy as np; from sklearn.datasets import fetch_california_housing; from sklearn.linear_model import LinearRegression; from sklearn.preprocessing import StandardScaler; import matplotlib.pyplot as plt\ndata = fetch_california_housing(); X = data.data[:,0:1]; y = data.target\nscaler = StandardScaler(); X_s = scaler.fit_transform(X)\nw, b, lr, n = 0.0, 0.0, 0.01, len(y)\nlosses = [];\nfor _ in range(500):\n    yp = w*X_s.ravel()+b; loss = np.mean((yp-y)**2); losses.append(loss)\n    dw = (2/n)*np.sum((yp-y)*X_s.ravel()); db_ = (2/n)*np.sum(yp-y)\n    w -= lr*dw; b -= lr*db_\nprint(f'手写: w={w:.4f} b={b:.4f}')\nlr_sk = LinearRegression().fit(X_s,y)\nprint(f'sklearn: w={lr_sk.coef_[0]:.4f} b={lr_sk.intercept_:.4f}')\nplt.plot(losses); plt.show()","expected_output":"损失从~1.3降至~0.5，w≈0.8 b≈2.0","reflection":["学习率0.01vs0.1vs1.0有何不同？","不用标准化直接训练会怎样？","迭代从500改成5000，损失还能降吗？"]},
    {"name":"Pandas数据探索与可视化实战","data":"Titanic数据集","tools":["Pandas","Seaborn"],"skills":["EDA","缺失值处理","分组聚合"],"goal":"掌握Pandas EDA完整流程","estimated_time":"2-3小时","deliverables":"EDA报告Notebook含8+图表","difficulty":"beginner","steps":["1.sns.load_dataset加载Titanic","2.info()+describe()检视","3.缺失值统计+填充","4.groupby按性别/舱位算生存率","5.可视化countplot+boxplot+heatmap"],"code":"import pandas as pd; import seaborn as sns; import matplotlib.pyplot as plt\ndf = sns.load_dataset('titanic')\nprint(df.info()); print(df.describe())\ndf['age'].fillna(df['age'].median(), inplace=True)\ndf['embarked'].fillna(df['embarked'].mode()[0], inplace=True)\nprint(df.groupby(['sex','pclass'])['survived'].mean().unstack())\nfig,axes=plt.subplots(2,2,figsize=(12,9))\nsns.countplot(data=df,x='survived',ax=axes[0,0])\nsns.countplot(data=df,x='pclass',hue='survived',ax=axes[0,1])\nsns.boxplot(data=df,x='survived',y='age',ax=axes[1,0])\nsns.heatmap(df.select_dtypes('number').corr(),annot=True,cmap='coolwarm',ax=axes[1,1])\nplt.show()","expected_output":"女性生存率74%vs男性19%","reflection":["一等舱生存率为何比三等舱高？","Cabin缺失77%还能用吗？","预测20岁三等舱女性生存概率？"]},
    {"name":"KNN手写数字分类器","data":"MNIST手写数字","tools":["sklearn","Matplotlib"],"skills":["KNN","混淆矩阵","交叉验证"],"goal":"理解KNN非参数分类原理","estimated_time":"1.5-2小时","deliverables":"KNN分类器+K值曲线+混淆矩阵","difficulty":"beginner","steps":["1.load_digits加载2000样本","2.train_test_split+标准化","3.KNN(K=3)训练","4.混淆矩阵可视化","5.循环K=1,3,5,7,9,11画曲线"],"code":"from sklearn.datasets import load_digits; from sklearn.model_selection import train_test_split; from sklearn.preprocessing import StandardScaler; from sklearn.neighbors import KNeighborsClassifier; from sklearn.metrics import accuracy_score, ConfusionMatrixDisplay; import matplotlib.pyplot as plt\nd=load_digits(n_class=10); X,y=d.data[:2000],d.target[:2000]\nX_tr,X_te,y_tr,y_te = train_test_split(X,y,test_size=0.2,random_state=42)\ns=StandardScaler(); X_tr_s=s.fit_transform(X_tr); X_te_s=s.transform(X_te)\nknn=KNeighborsClassifier(n_neighbors=3).fit(X_tr_s,y_tr)\ny_p=knn.predict(X_te_s)\nprint(f'K=3准确率:{accuracy_score(y_te,y_p):.3f}')\nConfusionMatrixDisplay.from_predictions(y_te,y_p); plt.show()\nks,sc=[],[]\nfor k in [1,3,5,7,9,11]:\n    knn=KNeighborsClassifier(n_neighbors=k).fit(X_tr_s,y_tr)\n    sc.append(accuracy_score(y_te,knn.predict(X_te_s))); ks.append(k)\nplt.plot(ks,sc,'bo-'); plt.show()","expected_output":"K=3准确率~95%","reflection":["K=1vsK=9哪个更好？","不标准化会怎样？","KNN适合100万条数据吗？"]},
]

async def seed_experiments():
    async with AsyncSessionLocal() as db:
        for i, exp in enumerate(ML_EXPERIMENTS):
            key = exp['name']
            result = await db.execute(
                select(LearningContentItem).where(
                    LearningContentItem.module_key=='ml',
                    LearningContentItem.section_key=='experiments',
                    LearningContentItem.item_key==key
                )
            )
            item = result.scalar_one_or_none()
            if item:
                item.title = exp['name']
                item.summary = exp.get('data','')
                item.content = json.dumps(exp, ensure_ascii=False)
                item.difficulty = exp.get('difficulty','')
                item.sort_order = i
            else:
                db.add(LearningContentItem(
                    module_key='ml', section_key='experiments', item_key=key,
                    title=exp['name'], summary=exp.get('data',''),
                    content=json.dumps(exp, ensure_ascii=False),
                    difficulty=exp.get('difficulty',''), sort_order=i, source_type='seed',
                ))
        await db.commit()
        print(f'Experiments: {len(ML_EXPERIMENTS)} seeded')

async def seed_tools():
    async with AsyncSessionLocal() as db:
        for i, t in enumerate(ML_TOOLS):
            result = await db.execute(
                select(LearningContentItem).where(
                    LearningContentItem.module_key=='ml',
                    LearningContentItem.section_key=='tools',
                    LearningContentItem.item_key==t['name']
                )
            )
            item = result.scalar_one_or_none()
            if item:
                item.content = json.dumps(t, ensure_ascii=False)
            else:
                db.add(LearningContentItem(
                    module_key='ml', section_key='tools', item_key=t['name'],
                    title=t['name'], summary=t['description'],
                    content=json.dumps(t, ensure_ascii=False),
                    sort_order=i, source_type='seed',
                ))
        await db.commit()
        print(f'Tools: {len(ML_TOOLS)} seeded')

async def main():
    await seed_experiments()
asyncio.run(main())
