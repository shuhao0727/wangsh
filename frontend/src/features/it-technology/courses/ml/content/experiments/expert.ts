import type { Experiment } from "../types";

export const expertExperiments: Experiment[] = [
    {
      name: "RAG 知识库问答系统",
      difficulty: "expert",
      data: "内存中的中文 ML 概念文档集合",
      tools: ["LangChain", "ChromaDB", "Sentence-Transformers", "NumPy"],
      skills: ["文档切分策略", "Embedding 向量化", "向量检索", "RAG 问答链路"],
      goal: "从零搭建一个完整的 RAG 系统，掌握文档切分、向量嵌入、ChromaDB 存储检索和语义问答的全流程",
      estimated_time: "4-5小时",
      deliverables: "完整的 RAG 实验脚本，包含文档切分对比、检索效果分析、不同问题类型的召回质量评估",

      data_source: "内存中硬编码的 10 条中文机器学习知识点文档，无需外部下载",      steps: [
        "加载中文 ML 知识文档列表（10条），用 RecursiveCharacterTextSplitter 按 chunk_size=80 和 overlap=20 进行语义切分",
        "使用 paraphrase-multilingual-MiniLM-L12-v2 模型将文本块编码为向量，打印向量维度和 chunk 数量",
        "用 ChromaDB 内存模式创建 collection，将 chunk 文本和向量批量写入",
        "编写 ask() 检索函数：查询词向量化后 collection.query 检索，打印 top_k 结果与距离分数",
        "测试不同类型问题（定义类、对比类、细节类），分析语义检索和关键词匹配的差异"
      ],
      code: `# RAG 知识库问答系统
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import chromadb

# 1. 内存知识库：中文 ML 知识点
documents = [
    "机器学习是人工智能的一个分支，它使计算机能够从数据中学习并做出决策。特征工程是提升模型性能的关键步骤。",
    "深度学习使用多层神经网络来学习数据的层次化表示。卷积神经网络(CNN)擅长处理图像数据。",
    "监督学习需要标注数据，模型学习从输入到输出的映射关系。常见算法包括线性回归、决策树和支持向量机。",
    "无监督学习不需要标签，算法自行发现数据中的模式和结构。聚类和降维是两大核心任务。",
    "强化学习中，智能体通过与环境交互获得奖励信号来学习最优策略。Q-learning是经典的强化学习算法。",
    "Transformer架构通过自注意力机制并行处理序列，是现代大语言模型如GPT和BERT的基础。",
    "过拟合指模型在训练数据上表现好但在测试数据上表现差。正则化和交叉验证是常用的防止过拟合的手段。",
    "梯度下降是最常用的优化算法，通过计算损失函数的梯度来迭代更新模型参数。学习率是关键超参数。",
    "集成学习通过组合多个弱学习器来构建强学习器。Bagging和Boosting是两大集成范式。",
    "BERT使用掩码语言模型和下一句预测进行预训练，在下游任务上微调即可获得卓越性能。",
]

# 2. 文档切分
splitter = RecursiveCharacterTextSplitter(chunk_size=80, chunk_overlap=20)
chunks = splitter.create_documents(documents)
print(f"原始文档 {len(documents)} 条 → 切分为 {len(chunks)} 个文本块")
for i, c in enumerate(chunks):
    print(f"  Chunk{i}: {c.page_content[:50]}...")

# 3. 向量化
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
chunk_texts = [c.page_content for c in chunks]
embeddings = model.encode(chunk_texts)
print(f"向量维度: {embeddings.shape}")

# 4. ChromaDB 存储
client = chromadb.Client()
collection = client.create_collection(name="ml_kb")
for i, (text, emb) in enumerate(zip(chunk_texts, embeddings)):
    collection.add(ids=[str(i)], embeddings=[emb.tolist()], documents=[text])

# 5. 检索问答
def ask(question, top_k=3):
    q_emb = model.encode([question])
    results = collection.query(query_embeddings=q_emb.tolist(), n_results=top_k)
    print(f"\n问题: {question}")
    for i, (doc, dist) in enumerate(zip(results['documents'][0], results['distances'][0])):
        print(f"  #{i+1} 距离={dist:.3f} | {doc[:80]}")

ask("什么是监督学习？")
ask("Transformer和CNN有什么区别？")
ask("如何防止过拟合？")`,
      expected_output: "原始 10 条文档切分为约 15-25 个文本块。每个向量 384 维。“什么是监督学习”检索到“标注数据”和“常见算法”相关内容。“Transformer和CNN有什么区别”能同时召回 Transformer 和 CNN 各自的描述。“如何防止过拟合”准确返回正则化和交叉验证相关 chunk。距离分数在 0.6-1.2 之间。",
      reflection: [
        "如果把 chunk_size 从 80 改到 200，对检索精度有什么影响？chunk 越大信息越完整还是噪声越多？",
        "用关键词检索（如 TF-IDF）和语义向量检索相比，在“什么是监督学习”这类问题上哪种效果更好？为什么？",
        "如果知识库中有两条矛盾的信息，问对应问题时模型会返回什么？这反映了 RAG 的什么局限性？"
      ],
    },
    {
      name: "FastAPI 模型部署与服务化",
      difficulty: "expert",
      data: "Scikit-learn 内置 Iris 数据集",
      tools: ["Scikit-learn", "FastAPI", "Joblib", "Pydantic", "Uvicorn"],
      skills: ["REST API 设计", "模型序列化", "Pydantic 数据校验", "API 测试"],
      goal: "将训练好的 ML 模型封装为生产可用的 REST API，掌握模型保存与加载、请求数据校验和推理服务部署的完整流程",
      estimated_time: "3-4小时",
      deliverables: "FastAPI 推理服务代码与训练脚本，包含 Swagger 自动文档、curl 测试命令和完整 API 说明",

      data_source: "sklearn.datasets.load_iris() —— 鸢尾花分类数据集，150条记录，4个特征，3个类别",      steps: [
        "加载 Iris 数据集，训练 LogisticRegression 多分类模型，打印测试集准确率",
        "用 joblib.dump 将训练好的模型序列化保存到 iris_model.joblib",
        "构建 FastAPI 应用：定义 IrisInput Pydantic 模型校验输入、/health 健康检查端点、/predict 推理端点",
        "在 /predict 中加载模型、接收 JSON 特征、调用 model.predict 和 predict_proba、返回类别名和置信度",
        "启动 uvicorn 服务，用 curl 发送 POST 请求测试实际推理效果，访问 /docs 查看 Swagger 文档"
      ],
      code: `# ===== 第一步：训练并保存模型 =====
from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
import joblib

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target, test_size=0.2, random_state=42, stratify=iris.target)

clf = LogisticRegression(max_iter=200).fit(X_train, y_train)
print(f"模型准确率: {clf.score(X_test, y_test):.3f}")
joblib.dump(clf, "iris_model.joblib")
print("模型已保存: iris_model.joblib")

# ===== 第二步：将以下代码另存为 app.py，运行 uvicorn =====
# from fastapi import FastAPI
# from pydantic import BaseModel
# import joblib, numpy as np
# from sklearn.datasets import load_iris
#
# app = FastAPI(title="Iris 分类推理服务")
# model = joblib.load("iris_model.joblib")
# iris = load_iris()
#
# class IrisInput(BaseModel):
#     sepal_length: float
#     sepal_width: float
#     petal_length: float
#     petal_width: float
#
# @app.get("/health")
# def health():
#     return {"status": "healthy", "model": "LogisticRegression_iris"}
#
# @app.post("/predict")
# def predict(data: IrisInput):
#     feats = np.array([[data.sepal_length, data.sepal_width,
#                        data.petal_length, data.petal_width]])
#     pred = model.predict(feats)[0]
#     prob = model.predict_proba(feats)[0].max()
#     return {"class": int(pred),
#             "class_name": iris.target_names[pred],
#             "confidence": round(float(prob), 4)}

print("\n启动服务: uvicorn app:app --reload")
print("API 文档: http://localhost:8000/docs")
print("健康检查: curl http://localhost:8000/health")
print("推理测试: curl -X POST http://localhost:8000/predict \\")
print("  -H 'Content-Type: application/json' \\")
print("  -d '{\"sepal_length\":5.1,\"sepal_width\":3.5,\"petal_length\":1.4,\"petal_width\":0.2}'")`,
      expected_output: "训练后准确率约 95-97%。模型序列化为 iris_model.joblib（约1KB）。启动 FastAPI 后访问 http://localhost:8000/docs 可见 Swagger 交互文档并可在线测试。curl 发送 setosa 特征 [5.1,3.5,1.4,0.2] 返回 {“class”:0,“class_name”:“setosa”,“confidence”:0.98}。/health 端点返回 {“status”:“healthy”}。",
      reflection: [
        "如果发送的特征值超出训练数据范围（如 sepal_length=100），模型仍会给出预测——这在生产环境中有什么风险？如何增加输入校验？",
        "当前 API 每次请求都从磁盘加载模型效率很低。把模型加载到全局变量后，如果模型更新了，如何实现不关停服务的热更新？",
        "如果有 1000 个并发请求同时调用 /predict，FastAPI 能处理吗？瓶颈在哪里（CPU/IO/模型推理速度）？"
      ],
    },
    {
      name: "MLflow 实验追踪与模型管理",
      difficulty: "expert",
      data: "Scikit-learn 内置 Diabetes 数据集",
      tools: ["MLflow", "Scikit-learn", "NumPy", "Pandas"],
      skills: ["实验版本管理", "参数与指标记录", "模型注册", "实验对比分析"],
      goal: "掌握 MLflow 实验追踪的完整工作流，能记录超参数、指标、模型并可视化对比多次实验结果",
      estimated_time: "3-4小时",
      deliverables: "7 个 MLflow 实验 Run 的完整记录，包含参数-指标对比表、模型 artifacts 和 MLflow UI 分析截图",

      data_source: "sklearn.datasets.load_diabetes() —— 糖尿病病程进展数据，442条记录，10个特征",      steps: [
        "初始化 MLflow，设置实验名称为 Ridge_Hyperparameter_Search，准备 7 个 alpha 值（0.001 到 10.0）",
        "循环每个 alpha：用 mlflow.start_run 创建 Run，mlflow.log_param 记录 alpha，训练 Ridge 回归模型",
        "用 5 折 cross_val_score（scoring='neg_mean_squared_error' 和 'r2'）评估模型，mlflow.log_metric 同时记录 MSE 和 R²",
        "用 mlflow.sklearn.log_model 保存每个 alpha 对应的模型 artifact",
        "用 mlflow.search_runs 检索所有 Run 构建 DataFrame 对比，启动 mlflow ui 在浏览器中查看平行坐标图和散点图"
      ],
      code: `# MLflow 实验追踪与模型管理
import mlflow
import mlflow.sklearn
from sklearn.datasets import load_diabetes
from sklearn.linear_model import Ridge
from sklearn.model_selection import cross_val_score
import numpy as np

# 1. 数据 + 实验初始化
X, y = load_diabetes(return_X_y=True)
experiment_name = "Ridge_Hyperparameter_Search"
mlflow.set_experiment(experiment_name)
print(f"实验: {experiment_name} | 数据维度: {X.shape}")

# 2. 多轮超参数实验
alphas = [0.001, 0.01, 0.1, 0.5, 1.0, 5.0, 10.0]
for alpha in alphas:
    with mlflow.start_run(run_name=f"alpha={alpha}"):
        mlflow.log_param("alpha", alpha)
        mlflow.log_param("model_type", "Ridge")

        model = Ridge(alpha=alpha)
        neg_mse = cross_val_score(model, X, y, cv=5,
                                  scoring='neg_mean_squared_error')
        r2 = cross_val_score(model, X, y, cv=5, scoring='r2')
        mse = -neg_mse.mean()

        mlflow.log_metric("mse", mse)
        mlflow.log_metric("mse_std", neg_mse.std())
        mlflow.log_metric("r2", r2.mean())

        model.fit(X, y)
        mlflow.sklearn.log_model(model, f"ridge_alpha_{alpha}")
        print(f"alpha={alpha:<6}  MSE={mse:.1f} ± {neg_mse.std():.1f}  "
              f"R²={r2.mean():.4f}")

# 3. 检索最佳实验
runs = mlflow.search_runs(
    experiment_ids=[mlflow.get_experiment_by_name(experiment_name).experiment_id])
best = runs.loc[runs["metrics.mse"].idxmin()]
print(f"\n最佳参数: alpha={best['params.alpha']}, MSE={best['metrics.mse']:.1f}")
print("\n启动可视化: mlflow ui")
print("打开浏览器访问 http://localhost:5000 查看实验对比图表")`,
      expected_output: "7 个 Run 依次打印 alpha 和对应 MSE、R²。alpha 极小时 MSE 较高（欠拟合），alpha≈0.1-0.5 时 MSE 最优约 2900，alpha 继续增大 MSE 回升（过正则化）。R² 在 alpha≈0.1 时最高约 0.49。mlflow ui 启动后可在 http://localhost:5000 看到平行坐标图和散点图，直观展示 alpha 和 MSE 的 U 型关系。",
      reflection: [
        "如果不使用交叉验证而只在训练集上评估 MSE，alpha=0.001 可能看起来最好——这说明了什么？交叉验证在超参数搜索中为什么不可或缺？",
        "MLflow 和 W&B 的核心区别是什么？各自的优劣势和适用场景是怎样的？",
        "如果团队中 3 个人同时跑实验，如何用 MLflow 的模型注册中心（Model Registry）管理模型版本和部署审批流程？"
      ],
    },
    {
      name: "LoRA/QLoRA 大模型指令微调",
      difficulty: "expert",
      data: "3 条硬编码的中文指令-回答对",
      tools: ["Hugging Face PEFT", "Transformers", "PyTorch"],
      skills: ["低秩适配 (LoRA)", "高效参数微调", "可训练参数分析", "指令数据格式化"],
      goal: "理解 LoRA 低秩微调的核心原理，掌握 LoRA 配置、参数效率分析和指令微调的基本工作流",
      estimated_time: "4-5小时",
      deliverables: "LoRA 微调配置脚本，包含参数效率分析、微调前后模型生成效果对比、LoRA 层权重分析",

      data_source: "3 条硬编码的中文机器学习指令-回答对，用于微调演示",      steps: [
        "加载基座模型 GPT-2 和分词器，设置 pad_token=eos_token，打印总参数量",
        "定义 LoraConfig：r=8, lora_alpha=16, target_modules=['c_attn']（GPT-2注意力层），用 get_peft_model 包装基座模型",
        "统计可训练参数 vs 总参数，计算参数效率比（应 < 1%），验证 LoRA 的轻量化优势",
        "准备 3 条中文指令微调数据，格式化为 '问：...\n答：...'，用 tokenizer 完成编码并打印 Token 数",
        "演示 TrainingArguments 配置（output_dir, num_train_epochs=3, per_device_train_batch_size=1），说明完整训练命令"
      ],
      code: `# LoRA 大模型指令微调演示
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, TaskType
import torch

# 1. 加载基座模型
model_name = "gpt2"
tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token = tokenizer.eos_token
base_model = AutoModelForCausalLM.from_pretrained(model_name)
total_base = sum(p.numel() for p in base_model.parameters())
print(f"基座模型: {model_name} | 总参数: {total_base:,}")

# 2. LoRA 配置
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=8,                  # 低秩矩阵的秩——秩越小参数越少
    lora_alpha=16,        # 缩放因子——alpha/r 决定更新幅度
    lora_dropout=0.1,     # LoRA 层的 Dropout 比例
    target_modules=["c_attn"],  # GPT-2 的注意力投影矩阵
)
peft_model = get_peft_model(base_model, lora_config)

# 3. 参数效率分析
trainable = sum(p.numel() for p in peft_model.parameters() if p.requires_grad)
total = sum(p.numel() for p in peft_model.parameters())
print(f"\nLoRA 参数统计:")
print(f"  可训练参数: {trainable:,}  ({100*trainable/total:.2f}%)")
print(f"  冻结参数:   {total - trainable:,}  ({100*(total-trainable)/total:.2f}%)")
print(f"  全量微调需要更新 {total:,} 个参数")
print(f"  LoRA 仅需更新  {trainable:,} 个参数 —— 减少 {100*(1-trainable/total):.2f}%!")

# 4. 中文指令微调数据
instructions = [
    {"input": "什么是机器学习？",
     "output": "机器学习是一种人工智能技术，它使计算机能够从数据中自动学习规律和模式，无需明确编程。"},
    {"input": "如何防止过拟合？",
     "output": "防止过拟合的常见方法包括：正则化(L1/L2)、交叉验证、早停法、数据增强和Dropout技术。"},
    {"input": "Transformer的核心机制是什么？",
     "output": "Transformer的核心是自注意力机制，让模型在处理每个词时都能关注序列中所有其他词，实现并行计算和长距离依赖建模。"},
]

def format_instruction(example):
    return f"问：{example['input']}\n答：{example['output']}"

for inst in instructions:
    text = format_instruction(inst)
    tokens = tokenizer(text, return_tensors="pt")
    print(f"\n指令: {inst['input']}")
    print(f"  Token数: {tokens['input_ids'].shape[1]}")

print(f"\n\n=== LoRA 配置已就绪！===")
print(f"数据: {len(instructions)} 条中文指令样本")
print(f"关键结论: 仅 {100*trainable/total:.2f}% 参数参与训练，"
      f"显存需求从全量微调的 ~4GB 降至 ~500MB，消费级 GPU 即可微调大模型。")
print(f"\n完整训练命令:")
print(f"  from transformers import Trainer, TrainingArguments")
print(f"  trainer = Trainer(model=peft_model, args=TrainingArguments(")
print(f"      output_dir='./lora_output', num_train_epochs=3,")
print(f"      per_device_train_batch_size=1, logging_steps=1),")
print(f"      train_dataset=train_dataset)")
print(f"  trainer.train()")
print(f"  peft_model.save_pretrained('./lora_adapter')")`,
      expected_output: "GPT-2 总参数约 1.24 亿。LoRA(r=8) 仅引入约 29.4 万可训练参数，仅占 0.24%。也就是说，99.76% 的参数被冻结。3 条指令样本的 Token 数在 15-40 之间（中文 tokenize 后比英文长）。打印信息清楚展示：全量微调需更新 1.24 亿参数并占用约 4GB 显存，而 LoRA 只需更新 29 万参数、约 500MB 显存。",
      reflection: [
        "r=4 和 r=16 对可训练参数数量和微调效果分别有什么影响？r 是不是越大越好？alpha/r 的比值决定了 LoRA 权重的缩放大小——这个比值越大意味着什么？",
        "target_modules 选择 ['c_attn'] 和 ['c_attn', 'c_fc', 'c_proj'] 有什么区别？什么时候应该扩大 target 范围？",
        "如果只有这 3 条训练数据，模型真的能学会指令跟随吗？还是只会死记硬背？LoRA 需要多少数据才能产生有意义的泛化？"
      ],
    },
    {
      name: "端到端ML项目实战",
      difficulty: "expert",
      data: "Scikit-learn 内置 California Housing 数据集",
      tools: ["Scikit-learn", "XGBoost", "Pandas", "Matplotlib", "Seaborn", "Joblib"],
      skills: ["探索性数据分析", "特征工程", "多模型对比", "交叉验证", "模型部署准备"],
      goal: "从零完成一个完整的 ML 项目，覆盖数据探索、特征工程、多模型训练评估到最优模型导出的全流程",
      estimated_time: "4-5小时",
      deliverables: "端到端 ML 项目 Notebook，包含 EDA 报告、特征工程策略、三模型详细对比表和已保存的生产就绪模型文件",

      data_source: "sklearn.datasets.fetch_california_housing() —— 加州房价数据，20640条记录，8个特征",      steps: [
        "加载 California Housing 数据，用 df.describe() 和 df.info() 完成基础 EDA，绘制特征分布直方图和相关性热力图",
        "分析相关性矩阵：找出与房价最相关的 top3 特征，创建新特征 rooms_per_household = AveRooms / (AveOccup + 1)",
        "用 train_test_split(80/20) 划分数据，StandardScaler 标准化，确保训练和测试集分布一致",
        "对比 3 个模型——LinearRegression（基线）、RandomForestRegressor（集成）、XGBRegressor（提升）——用 5 折 cross_val_score 评估 R² 和 MSE",
        "选取 Test R² 最高的模型，用 joblib 同时保存模型和 scaler，验证加载后推理结果一致性"
      ],
      code: `# 端到端ML项目实战：加州房价预测
from sklearn.datasets import fetch_california_housing
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import joblib

# 1. 数据加载 + EDA
data = fetch_california_housing()
df = pd.DataFrame(data.data, columns=data.feature_names)
df['Price'] = data.target
print(f"数据: {df.shape[0]} 条, {df.shape[1]} 列")
print("\n描述性统计:")
print(df.describe().round(2))

# 2. 相关性分析
corr = df.corr()
top3 = corr['Price'].abs().sort_values(ascending=False)[1:4]
print(f"\n与房价最相关的 Top3 特征:")
for feat, val in top3.items():
    print(f"  {feat}: r = {val:.3f}")

plt.figure(figsize=(10, 7))
sns.heatmap(corr, annot=True, fmt='.2f', cmap='RdBu_r', center=0,
            square=True, linewidths=0.5)
plt.title('特征相关性矩阵热力图'); plt.tight_layout(); plt.show()

# 3. 特征工程 + 划分
df['rooms_per_household'] = df['AveRooms'] / (df['AveOccup'] + 1)
X = df.drop('Price', axis=1)
y = df['Price']
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42)
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)
print(f"\n训练集: {X_train_s.shape}, 测试集: {X_test_s.shape}")

# 4. 三模型对比
models = {
    'LinearRegression': LinearRegression(),
    'RandomForest': RandomForestRegressor(
        n_estimators=100, max_depth=15, random_state=42),
    'XGBoost': XGBRegressor(
        n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42),
}

print("\n模型对比:")
for name, model in models.items():
    cv_r2 = cross_val_score(model, X_train_s, y_train, cv=5, scoring='r2')
    cv_mse = -cross_val_score(model, X_train_s, y_train, cv=5,
                               scoring='neg_mean_squared_error')
    model.fit(X_train_s, y_train)
    test_r2 = model.score(X_test_s, y_test)
    print(f"{name:<20} CV R²={cv_r2.mean():.4f}±{cv_r2.std():.4f}  "
          f"MSE={cv_mse.mean():.4f}  Test R²={test_r2:.4f}")

# 5. 最佳模型保存
best_name = max(models, key=lambda k: models[k].score(X_test_s, y_test))
best_model = models[best_name]
joblib.dump(best_model, 'best_model.joblib')
joblib.dump(scaler, 'scaler.joblib')
print(f"\n最佳模型: {best_name} | Test R²={best_model.score(X_test_s, y_test):.4f}")
print("已保存 best_model.joblib + scaler.joblib")

# 验证加载一致性
loaded_model = joblib.load('best_model.joblib')
sample = X_test_s[:3]
orig_pred = best_model.predict(sample)
load_pred = loaded_model.predict(sample)
print(f"保存前预测: {np.round(orig_pred, 3)}")
print(f"加载后预测: {np.round(load_pred, 3)}")
assert np.allclose(orig_pred, load_pred), "加载不一致！"
print("验证通过: 加载后预测与保存前完全一致")`,
      expected_output: "数据 20640 条 9 列（含 Price）。MedInc（收入中位数）与房价相关度最高（r=0.69），其次是 AveRooms（r=0.15）。LinearRegression 基线 R²≈0.60，RandomForest R²≈0.80，XGBoost 通常最优 R²≈0.82。三者中 XGBoost 默认胜出。模型文件和 scaler 都已保存到磁盘，加载后预测结果与保存前完全一致（assert 通过）。",
      reflection: [
        "RandomForest 和 XGBoost 的 R² 都远超线性回归——说明房价数据中存在明显的非线性关系。你能联想生活中什么例子说明了房价和收入之间的非线性关系吗？",
        "如果这个模型要部署到生产环境，你还缺哪些步骤？数据漂移检测、模型监控、A/B 测试——缺一不可的三个环节分别做什么？",
        "当前只用 R² 评估模型。对于房价预测这种回归任务，MAE 或 RMSE 是否更合适？为什么？MAE 的单位是什么？它告诉我们什么信息？"
      ],
    },
  ];
