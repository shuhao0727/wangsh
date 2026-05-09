# RAG检索增强生成：给AI一本"开卷考试"的参考书

## 🎯 读完本章你能...

理解RAG（检索增强生成）的核心思路——为什么大模型需要"查资料"而不是"全靠背"；掌握RAG的完整流程（检索→重排→增强→生成）；知道向量数据库（如Chromada）和Embedding模型（如bge-large-zh）在其中的角色；能用DeepSeek API搭建一个最简单的RAG问答系统。

## 📖 从一个故事开始

假设你要参加一场考试。考试范围是"公司过去三年的所有内部文档"——合同、技术规范、会议纪要、邮件往来，总共几万页。

你有两个选择：
- **选择A**：把所有文档背下来，考试时凭记忆作答。代价是：你需要一个超级大脑，而且一旦文档更新，你得重背一遍。
- **选择B**：考试时允许翻书。拿到题目后，你先翻目录找到相关页码，精读几段关键内容，然后基于这些内容组织答案。你的大脑只需要"理解问题"和"组织语言"，不需要"记住全部事实"。

选哪个？显然是B。这就是RAG的思路——让大模型做"开卷考试"。

大语言模型（LLM）很聪明，但它有一个致命弱点：**知识截止于训练日期**。你问它"2024年奥运会金牌榜排名"，它不知道——因为训练数据里没有。你问它"我们公司上季度的销售额是多少"，它也不知道——它没见过你公司的内部数据。

更糟糕的是，当LLM不知道答案的时候，它不会说"我不知道"——它会**自信满满地编一个**。这就是"幻觉"问题。

RAG就是来解决这两个问题的：**让LLM在回答之前，先去查资料**。查到了就基于资料回答；查不到就老实说没找到。

## 📖 原理讲解

### RAG的核心流水线

RAG的工作流程可以拆成四个阶段：

**第一步：文档分块与向量化（准备"参考书"）**

首先，把你要"考试"用到的所有文档（PDF、网页、数据库记录、代码仓库等）切成小段（chunk）。每段几百到一千字——太小了语义不完整，太大了检索不精准。

然后，用一个Embedding模型把每个chunk变成一个**向量**（一组数字，比如1024个浮点数）。这个向量就像是该段文字的"语义指纹"——两段意思相近的文字，它们的向量在空间中距离很近。

国内常用的Embedding模型是BGE（BAAI General Embedding），尤其是`bge-large-zh-v1.5`版本，在中文语义理解上表现出色。它的核心思路是：用海量中文语料训练，让模型学会把"意思相近"的句子映射到相近的向量位置。

**第二步：向量存储（建"索引"）**

把所有这些向量存进一个**向量数据库**。与传统数据库不同，向量数据库专门优化了"找最相似的K个向量"这个操作（叫ANN，近似最近邻搜索）。

目前最流行的开源向量数据库是ChromaDB——它轻量、易用，Python几行代码就能跑起来。ChromaDB内置了多种ANN算法，可以在一毫秒内从百万级向量中找到最相关的几十个。

把文档chunk和对应的向量一起存进ChromaDB，你的"参考书"就准备好了。

**第三步：检索（考试时"翻书"）**

当用户提问时，系统做两件事：
1. 用同一个Embedding模型把用户的问题也变成一个向量
2. 在ChromaDB中搜索与问题向量最相似的K个文档chunk

这一步通常在几十毫秒内完成。检索到的chunk就是LLM用来回答问题的"参考资料"。

但这还不够。为了提高检索质量，RAG系统通常会加一个**重排序（Rerank）**环节——用更精确（但更慢）的模型对初筛结果再排一次序，把真正最好的几个chunk挑出来。

**第四步：增强生成（"开卷作答"）**

把检索到的文档chunk拼接成一个"上下文"，和用户的问题一起发给LLM（比如DeepSeek API）。提示词大概是这样的：

```
请根据以下参考资料回答用户的问题。如果参考资料中没有相关信息，请明确说"未找到相关信息"。

参考资料：
[检索到的chunk 1]
[检索到的chunk 2]
[检索到的chunk 3]

用户问题：XXX
```

LLM读了这个提示词后，会基于参考资料来组织答案——而不是凭空编造。如果资料里确实没有相关信息，一个好的提示词会让模型承认"我不知道"。

### 为什么选择DeepSeek API作为后端

在RAG系统中，LLM的选择至关重要。DeepSeek API是当前中文RAG场景下的优秀选择，有以下几个原因：

- **中文能力出色**：DeepSeek-V3在中文理解、中文生成质量上达到了国际一线水平，尤其适合处理中文文档和中文提问。
- **超长上下文**：DeepSeek支持128K token的上下文窗口，意味着你可以在一次请求中塞进几十页的参考资料。
- **高性价比**：相比同类闭源模型，DeepSeek API的价格极具竞争力，做大规模RAG应用时成本可控。
- **开源生态**：DeepSeek的模型权重开源，你甚至可以在自己的服务器上私有化部署，避免数据外泄。

### RAG vs 微调：什么时候用哪个

很多人问：为什么不直接把新知识"微调"进模型里，而要搞RAG这套复杂的检索流程？

答案是：两者各有适用场景。

| 维度 | RAG | 微调 |
|------|-----|------|
| 知识更新 | 即时生效（改文档即可） | 需要重新训练 |
| 可解释性 | 高（能看到引用了哪段资料） | 低（黑盒） |
| 事实准确性 | 基于资料，幻觉少 | 仍可能幻觉 |
| 成本 | 低（只需Embedding+检索） | 高（需要GPU训练） |
| 适用场景 | 知识库问答、客服、文档助手 | 改变风格、学会新格式、领域术语 |

简单原则：**给模型"知识"用RAG，给模型"能力"用微调。** 比如让模型知道"公司最新的退货政策"用RAG，让模型学会"用医疗术语写诊断报告"用微调。

### 进阶技巧：让RAG更好用

**混合检索**：不只靠向量相似度——同时用关键词匹配（BM25算法）找到包含关键术语的chunk，两种结果融合。向量检索擅长"语义相近"（"感冒"能找到"上呼吸道感染"），关键词检索擅长"精确匹配"（"合同编号2024-003"不会找错）。

**父子chunk**：检索用小chunk（精准定位），但喂给LLM时把该chunk所在的更大段落一起附上（保留上下文）。就像你翻书时先看目录找到页码，但真正读的时候会读前后几段。

**查询重写**：当用户问题太简短或模糊时，用LLM先把问题改写得更具体再检索。比如用户问"上次那个bug怎么修的"→LLM改写为"项目X中2024年3月报告的登录模块崩溃bug的修复方案"。

### 动手实践：用DeepSeek+Chromada搭一个RAG

最简代码（伪代码，展示核心逻辑）：

```python
import chromadb
from openai import OpenAI

# Step 1: 准备向量数据库
client = chromadb.Client()
collection = client.create_collection("my_docs")

# 将文档chunk向量化并存储
for i, chunk in enumerate(document_chunks):
    embedding = bge_model.encode(chunk)  # bge-large-zh
    collection.add(
        embeddings=[embedding],
        documents=[chunk],
        ids=[f"doc_{i}"]
    )

# Step 2: 检索
query_embedding = bge_model.encode(user_question)
results = collection.query(query_embeddings=[query_embedding], n_results=5)
retrieved_docs = results['documents'][0]

# Step 3: 生成（使用DeepSeek API）
llm = OpenAI(api_key="your-key", base_url="https://api.deepseek.com")
context = "\n\n".join(retrieved_docs)
response = llm.chat.completions.create(
    model="deepseek-chat",
    messages=[{
        "role": "user",
        "content": f"参考资料：\n{context}\n\n问题：{user_question}\n\n请基于参考资料回答。"
    }]
)
```

整个流程的核心思想就是一句话：**不要让LLM凭空回忆，给它一本翻开的参考书。**

## 🎮 类比理解

把RAG想象成《魔兽世界》里法师打副本：

- **LLM本体**是你的法师——输出爆炸（语言能力强），但血条很脆（容易幻觉），而且技能栏有限（知识截止训练日期）。
- **向量数据库（ChromaDB）**是你的法术书——里面记录了所有你"学过"但装不进技能栏的法术（海量文档知识）。
- **Embedding模型（bge-large-zh）**是你的法术书索引——你说"我想要一个能解控的法术"，它立刻翻到"冰箱（寒冰屏障）"那一页，而不是从头翻到尾。
- **RAG流程**就是战斗中的操作：Boss（用户）放了一个技能（提问），你先翻法术书（检索）找到应对法术（相关文档），然后施法（LLM生成），打出完美应对（准确回答）。
- **没有RAG的LLM**就是不带法术书的法师——只能用技能栏里那几个技能硬刚。问题是，Boss的技能千奇百怪（用户问什么的都有），只靠技能栏迟早翻车（出错/瞎编）。
- **Rerank**相当于法师的"法术强化"天赋——不是每个检索到的法术都适合当前情况，需要再甄选一下，选出最优解。

## 💡 本章彩蛋

RAG这个概念其实早在2020年就由Facebook AI（现在的Meta AI）的研究者在一篇论文中正式提出了。但当时大家觉得"不就多了一步检索吗，有什么了不起的"。

真正让RAG"出圈"的，是2023年后LLM的大规模落地——企业发现，LLM虽然聪明，但私有数据喂不进去（微调太贵），于是RAG成了几乎唯一可行的方案。一夜之间，所有做"企业AI"的公司都在做RAG。

还有一个冷知识：早期的RAG论文中，检索器和生成器是**联合训练**的——检索器学会"找对LLM有帮助的文档"而不只是"语义相似的文档"。后来的工程实践中，大部分人用了更简单的方案：检索和生成各干各的，分开优化。效果差一点，但工程上友好得多——这就是学术和工业的经典分歧。

最有趣的是：有人做过实验，在RAG系统中故意喂给LLM**错误**的参考资料，LLM就会给出**错误但逻辑自洽**的答案——它真的就像一个信任参考书的好学生，书里写错了，它也照着答错了。这反而证明了RAG在"减少幻觉"方面的有效性：不是LLM不编了，而是它改成了"照着编"——而你可以控制参考资料的质量。

## 参考文献

[1] Lewis, P., Perez, E., Piktus, A., et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. *Advances in Neural Information Processing Systems*, 33, 9459-9474.

[2] Xiao, S., Liu, Z., Zhang, P., & Muennighoff, N. (2023). C-Pack: Packaged Resources To Advance General Chinese Embedding. *arXiv preprint*, arXiv:2309.07597.

[3] DeepSeek-AI. (2024). DeepSeek-V3 Technical Report. *arXiv preprint*, arXiv:2412.19437.

[4] ChromaDB Documentation. https://docs.trychroma.com/

[5] Gao, Y., Xiong, Y., Gao, X., et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey. *arXiv preprint*, arXiv:2312.10997.
