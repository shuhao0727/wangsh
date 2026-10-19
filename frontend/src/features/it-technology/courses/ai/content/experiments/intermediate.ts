import type { Experiment } from "../types";

export const intermediateExperiments: Experiment[] = [
    {
      name: "情感分析：AI 读懂你的朋友圈",
      difficulty: "intermediate",
      data: "20 条社交媒体文本（朋友圈/微博风格）",
      tools: ["Python", "DeepSeek API", "pandas", "Matplotlib", "sklearn"],
      skills: ["情感分析", "分类评估", "Prompt 设计", "混淆矩阵", "准确率/召回率/F1"],
      goal: "用 AI 分析 20 条社交媒体文本的情感倾向，对比 AI 判断与人工标注，计算准确率、精确率和召回率，理解 AI 情感分析的原理与局限",
      estimated_time: "3-4小时",
      deliverables: "完整的情感分析实验报告 Notebook，包含人工标注结果、AI 预测结果、混淆矩阵、分类报告和错误分析",
      data_source: "预设 20 条社交媒体文本（模拟朋友圈/微博风格），包含正面/负面/中性各若干条，以及含讽刺、反语等难点",
      steps: [
        "阅读 20 条文本，先自己人工标注每条的情感（正面/负面/中性），记录为'真实标签'",
        "设计 Prompt 让 AI 做情感分类，要求输出 JSON 格式 {sentiment: 'positive'|'negative'|'neutral', reason: '...'}",
        "用 Python 批量调用 API，对 20 条文本逐条分析，记录 AI 的判断结果",
        "用 sklearn 的 confusion_matrix 和 classification_report 对比 AI 预测 vs 人工标注",
        "找出 AI 判断错误的案例，分析原因：是讽刺？是中性但含负面词？还是情感模糊？",
        "思考：如果让你标注 1000 条数据来训练自己的情感分析模型，你会怎么设计标注规则？"
      ],
      code: `from openai import OpenAI
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, classification_report
import seaborn as sns
import json

# DeepSeek API 兼容 OpenAI 接口格式
client = OpenAI(
    base_url="https://api.deepseek.com/v1",
    api_key="your-deepseek-api-key"
)

# 20条社交媒体文本（朋友圈/微博风格），你自己先人工标注情感
texts_with_labels = [
    # 格式: (文本, 人工标注情感)
    ("今天和好朋友一起去吃了火锅，开心到飞起！", "正面"),
    ("终于考完了最后一门，感觉自己解放了！", "正面"),
    ("拿到了期待已久的 offer，感恩所有帮助过我的人。", "正面"),
    ("今天的夕阳太美了，生活还是很美好的。", "正面"),
    ("刚跑完 5 公里，大汗淋漓，太爽了！", "正面"),
    ("我家的猫咪今天学会握手了，太聪明了吧！", "正面"),
    ("加班到凌晨两点，地铁都停了，打车排队100位，真的要崩溃了。", "负面"),
    ("手机屏又碎了，这已经是今年第三次了，我真的服了。", "负面"),
    ("期待了一个月的演唱会因为台风取消了，想哭。", "负面"),
    ("考试又没及格，明明复习了很久的，好难受。", "负面"),
    ("早上出门忘带钥匙，中午外卖送错餐，晚上笔记本蓝屏。今天不宜出门。", "负面"),
    ("又长胖了3斤，减肥之路困难重重。", "负面"),
    ("天气预报说明天有雨，气温 18-25 度。", "中性"),
    ("明天下午三点在 302 教室开班会，请大家准时参加。", "中性"),
    ("刚路过学校门口，看到新的操场已经修好了。", "中性"),
    ("今天地铁上人特别多，站了一路。", "中性"),
    # 难点：讽刺/反语/情感模糊
    ("考试只考了 59 分，差一分及格，真是太幸运了呢。", "负面"),
    ("又加班到 12 点，我爱工作，工作使我快乐。", "负面"),
    ("今天考试完全没复习，裸考的感觉真刺激。", "中性"),
    ("终于分手了，祝我重获自由。", "中性"),
]

label_map = {"正面": "positive", "负面": "negative", "中性": "neutral"}
reverse_map = {v: k for k, v in label_map.items()}

results = []
for idx, (text, human_label) in enumerate(texts_with_labels):
    prompt = f'''请分析以下文本的情感倾向，输出 JSON 格式。
文本："{text}"

请输出：{{"sentiment": "positive/negative/neutral", "reason": "一句话解释判断理由"}}'''

    try:
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        ai_reply = resp.choices[0].message.content.strip()
        # 尝试解析 JSON
        ai_json = json.loads(ai_reply)
        ai_sentiment = ai_json.get("sentiment", "unknown")
        ai_reason = ai_json.get("reason", "")
    except:
        ai_sentiment = "unknown"
        ai_reason = "解析失败"

    results.append({
        "序号": idx + 1,
        "文本": text,
        "人工标注": human_label,
        "AI判断": reverse_map.get(ai_sentiment, ai_sentiment),
        "AI理由": ai_reason,
        "是否正确": ai_sentiment == label_map[human_label]
    })
    print(f"{idx+1}/20 完成")

df = pd.DataFrame(results)

# 准确率
accuracy = df["是否正确"].sum() / len(df)
print(f"\\n整体准确率: {accuracy:.1%}")

# 分类报告
y_true = [label_map[x] for x in df["人工标注"]]
y_pred = [label_map.get(x, "unknown") if x in label_map.values() else "unknown" for x in df["AI判断"]]
print("\\n分类报告:")
print(classification_report(y_true, y_pred, labels=["positive","negative","neutral"], target_names=["正面","负面","中性"]))

# 混淆矩阵
cm = confusion_matrix(
    y_true, y_pred,
    labels=["positive", "negative", "neutral"]
)
plt.figure(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
            xticklabels=["正面","负面","中性"],
            yticklabels=["正面","负面","中性"])
plt.xlabel("AI 预测"); plt.ylabel("人工标注")
plt.title(f"情感分析混淆矩阵 (准确率: {accuracy:.1%})")
plt.tight_layout(); plt.show()

# 错误分析
errors = df[~df["是否正确"]]
print(f"\\n错误案例 ({len(errors)}条):")
for _, row in errors.iterrows():
    print(f"  [{row['人工标注']}→AI判定为{row['AI判断']}] {row['文本'][:40]}...")
    print(f"    原因: {row['AI理由']}")`,
      expected_output: "AI 整体准确率约 75-85%。正面情感识别最好（精确率>90%），负面次之（约80%），讽刺/反语几乎全部判断错误（如'太幸运了呢'被判为正面）。混淆矩阵显示负面→中性的误判最多。反语的挑战最难——AI 不理解'反着说'的文化表达方式。",
      reflection: [
        "讽刺类文本（如'真是太幸运了呢'实际是吐槽）AI 为什么判断错了？如果要教会 AI 识别讽刺，你会怎么做？",
        "如果把这 20 条文本发给 3 个不同的同学做人工标注，他们的结果会完全一致吗？对于第 20 条'终于分手了'，人会怎么判断？",
        "情感是'正面/负面/中性'三分法够用吗？除了这三个类别，还有哪些情感维度值得分析？（提示：愤怒、悲伤、惊讶...）"
      ],
    },
    {
      name: "AI 面试官：模拟求职对话",
      difficulty: "intermediate",
      data: "3 种面试官角色设定",
      tools: ["Python", "DeepSeek API"],
      skills: ["System Prompt 设计", "角色扮演 Prompt", "对话系统", "对话风格分析"],
      goal: "用 System Prompt 让 AI 分别扮演严厉、友好、专业三种面试官，测试不同角色设定下的对话风格差异，理解 System Prompt 如何塑造 AI 行为",
      estimated_time: "2-3小时",
      deliverables: "3 段面试对话记录 + 对话风格对比分析表 + System Prompt 设计笔记",
      data_source: "自定义 3 种面试官角色设定 + 1 个岗位描述（如'前端开发实习生'）",
      steps: [
        "设计 1 个具体的岗位描述（如'互联网公司前端开发实习生'），包含职责和要求",
        "设计 3 种面试官 System Prompt：A-严厉压迫型 / B-友好鼓励型 / C-专业技术型",
        "用 Python 写一个交互式对话循环：用户输入回答，AI 面试官追问下一个问题",
        "每种面试官对话 5 轮，记录完整对话日志",
        "对比分析：三种面试官提问方式的差异（开放式 vs 压迫式 vs 技术型）、追问深度、语气词使用",
        "总结：如果你真的要去面试，哪种面试官风格对你最有帮助？为什么？"
      ],
      code: `from openai import OpenAI

# DeepSeek API 兼容 OpenAI 接口格式
client = OpenAI(
    base_url="https://api.deepseek.com/v1",
    api_key="your-deepseek-api-key"
)

# 岗位描述
job_description = "岗位：前端开发实习生\\n职责：\\n1. 参与公司产品 Web 前端页面开发\\n2. 配合设计师完成页面还原和交互实现\\n3. 参与前端技术方案讨论和代码审查\\n要求：\\n- 熟悉 HTML/CSS/JavaScript\\n- 了解 React 或 Vue 框架\\n- 有个人项目或开源贡献者优先\\n- 良好的沟通能力和学习能力"

# 3种面试官 System Prompt
interviewer_styles = {
    "A-严厉压迫型": f'''你是一位极其严厉的面试官，以高压面试著称。
面试规则：
- 每个问题都要追问到底，不给思考时间
- 对回答中的任何漏洞一针见血地指出
- 语气冷峻严肃，常用反问句
- 如果候选人回答模糊，直接要求他给出确切答案
- 不要让候选人感到舒适

岗位信息：{job_description}

现在，面试开始。你的第一句话不要友好寒暄，直接进入正题。''',

    "B-友好鼓励型": f'''你是一位非常友善温暖的面试官，相信每个人都有潜力。
面试规则：
- 提问前先肯定候选人的优点
- 当候选人卡壳时给提示和鼓励
- 语气温暖、面带微笑感
- 关注候选人的思考过程而非仅仅正确答案
- 面试结束时真诚祝福

岗位信息：{job_description}

现在，面试开始。先用轻松的寒暄让候选人放松下来。''',

    "C-专业技术型": f'''你是一位资深前端技术专家，关注候选人的技术深度。
面试规则：
- 提问由浅入深，逐步探测技术边界
- 每个问题都有明确的考察点（如：闭包、事件循环、性能优化）
- 对技术细节追问，但语气客观专业
- 给候选人时间思考，不打断
- 如果候选人答得很好，会问更深入的问题

岗位信息：{job_description}

现在，面试开始。先让候选人做个简短的自我介绍。'''
}

# 模拟面试（预设回答，你也可以改成 input() 交互模式）
candidate_answers = [
    "您好，我是计算机专业的大三学生，学过前端三件套和 React，做过一个个人博客项目。",
    "嗯...闭包是函数内部嵌套函数，内部函数可以访问外部函数的变量。",
    "这个...我也不太确定具体的原理，但我用 React 的时候感觉状态管理挺重要的。",
    "我今天有点紧张，有些东西想不起来了。但我会努力学习的。",
    "谢谢您的面试，希望能有这个实习机会。"
]

for style_name, system_prompt in interviewer_styles.items():
    print(f"\\n{'='*60}")
    print(f"=== {style_name} ===\\n")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "（面试开始）"}
    ]

    for turn in range(5):
        # AI 面试官发问
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            temperature=0.7
        )
        interviewer_question = resp.choices[0].message.content.strip()
        print(f"[面试官] {interviewer_question[:200]}...")

        messages.append({"role": "assistant", "content": interviewer_question})

        # 候选人（模拟）回答
        candidate = candidate_answers[min(turn, len(candidate_answers)-1)]
        print(f"[候选人] {candidate}\\n")
        messages.append({"role": "user", "content": candidate})

print("\\n对话风格对比分析提示：")
print("对比维度：1)提问方式 2)追问深度 3)语气用词 4)压力感受 5)考察真实水平的效果")`,
      expected_output: "三种面试官的对话风格差异显著：严厉型使用反问句和高压追问（如'这么基础的东西都不确定？'），友好型先鼓励再提问（如'没关系，你已经说对了一半...'），专业型客观深入（如'能具体说说你博客项目中怎么处理跨域的吗？'）。压力感：严厉型最高，友好型最低，专业型适中。",
      reflection: [
        "如果你真的去面试，你更喜欢哪一种面试官？为什么？你觉得哪种风格最能考察出你的真实水平？",
        "System Prompt 中一句'不要让候选人感到舒适'就完全改变了 AI 的说话方式——这说明 System Prompt 有多么强大？这对 AI 产品设计有什么启示？",
        "假设你要设计一个'AI 模拟面试练习'App，让学生可以在面试前练习，你会选哪种面试官风格？会把多种风格都做进去吗？"
      ],
    },
    {
      name: "AI 写代码：同一个任务，三种 AI 对比",
      difficulty: "intermediate",
      data: "3 个编程任务描述",
      tools: ["ChatGPT", "Claude", "GitHub Copilot（或 3 款不同 AI）", "评分表"],
      skills: ["代码评估", "对比分析", "AI 工具能力边界认知", "代码审查"],
      goal: "同一编程任务分别交给 ChatGPT、Claude 和另一个 AI（如国产模型），对比代码质量、注释、正确性和可读性，建立对不同 AI 编码能力的客观认知",
      estimated_time: "2-3小时",
      deliverables: "3 个任务的对比表格 + 代码截图 + 评分卡 + AI 能力差异总结报告",
      data_source: "3 个编程任务描述（不同难度和类型），在多个 AI 工具中分别测试",
      steps: [
        "准备 3 个编程任务：A-写一个贪吃蛇游戏(HTML/CSS/JS) / B-写一个爬虫抓取网页标题(Python) / C-写一个函数判断回文字符串(Python)",
        "分别在 ChatGPT、Claude、和另一个国产 AI（如 DeepSeek/通义千问）中输入完全相同的 prompt",
        "对每个 AI 的输出，从 5 个维度打分（1-5分）：代码正确性、注释质量、代码风格、错误处理、额外亮点",
        "实际运行代码，验证是否能正常执行，记录 bug 数量",
        "将评分填入统一对比表格，分析每个 AI 的强项和弱项",
        "总结：在你自己的编程学习中，哪种场景适合用哪个 AI？为什么？"
      ],
      code: `# 本实验的代码部分是评分分析脚本，而非生成代码
# 你需要手动在不同 AI 中测试，然后用此脚本整理结果

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# === 请在以下字典中填入你的评分 ===
# 每个任务-模型：分数 1-5

scores = {
    "贪吃蛇游戏": {
        "ChatGPT":  {"正确性": 4, "注释": 4, "代码风格": 4, "错误处理": 3, "额外亮点": 3},
        "Claude":    {"正确性": 5, "注释": 5, "代码风格": 5, "错误处理": 4, "额外亮点": 4},
        "DeepSeek":  {"正确性": 4, "注释": 3, "代码风格": 4, "错误处理": 3, "额外亮点": 3},
    },
    "网页爬虫": {
        "ChatGPT":  {"正确性": 4, "注释": 4, "代码风格": 4, "错误处理": 4, "额外亮点": 3},
        "Claude":    {"正确性": 5, "注释": 4, "代码风格": 5, "错误处理": 5, "额外亮点": 4},
        "DeepSeek":  {"正确性": 3, "注释": 3, "代码风格": 3, "错误处理": 2, "额外亮点": 2},
    },
    "回文判断": {
        "ChatGPT":  {"正确性": 5, "注释": 4, "代码风格": 4, "错误处理": 3, "额外亮点": 3},
        "Claude":    {"正确性": 5, "注释": 5, "代码风格": 5, "错误处理": 4, "额外亮点": 5},
        "DeepSeek":  {"正确性": 5, "注释": 3, "代码风格": 4, "错误处理": 3, "额外亮点": 3},
    },
}

# 转换为 DataFrame
rows = []
for task, models in scores.items():
    for model, dimensions in models.items():
        for dim, val in dimensions.items():
            rows.append({"任务": task, "模型": model, "维度": dim, "分数": val})

df = pd.DataFrame(rows)

# 各模型总分
print("=" * 60)
print("各 AI 模型总分排名")
print("=" * 60)
total = df.groupby("模型")["分数"].sum().sort_values(ascending=False)
print(total)
print(f"\\n满分: {3 * 5 * 5} 分 (3任务 × 5维度 × 5分)")

# 可视化 1: 各模型各维度平均分
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# 柱状图数据
dimensions = list(scores["贪吃蛇游戏"]["ChatGPT"].keys())
models_list = list(scores["贪吃蛇游戏"].keys())

ax1 = axes[0]
x = np.arange(len(models_list))
width = 0.25
for i, dim in enumerate(dimensions):
    vals = [np.mean([scores[task][model][dim] for task in scores]) for model in models_list]
    ax1.bar(x + i*width - width, vals, width, label=dim)

ax1.set_xticks(x)
ax1.set_xticklabels(models_list)
ax1.set_ylabel("平均分 (1-5)")
ax1.set_title("各 AI 在各维度的平均得分")
ax1.legend(fontsize=8, ncol=3)
ax1.set_ylim(0, 6)

# 可视化 2: 总分柱状图
ax2 = axes[1]
colors = ["#10B981", "#8B5CF6", "#F59E0B"]
ax2.bar(total.index, total.values, color=colors)
for i, v in enumerate(total.values):
    ax2.text(i, v + 0.5, str(v), ha="center", fontweight="bold")
ax2.set_ylabel("总分")
ax2.set_title("各 AI 模型总分对比")
ax2.set_ylim(0, total.max() + 5)

plt.tight_layout()
plt.show()

# 各任务维度分析
print("\\n" + "=" * 60)
print("各任务评分明细")
print("=" * 60)
pivot = df.groupby(["任务","模型"])["分数"].sum().unstack()
print(pivot)
print(f"\\n每个任务满分: {5 * 5} 分 (5维度 × 5分)")`,
      expected_output: "Claude 的总分通常最高（约 65-70 分），ChatGPT 约 55-62 分，DeepSeek（或其他国产模型）约 45-55 分。Claude 在注释质量和错误处理上得分突出，ChatGPT 在简单任务上各项均衡，国产模型在复杂任务（爬虫）上差距明显。回文判断（最简单任务）三模型差异最小。",
      reflection: [
        "不同的任务难度下，各 AI 的表现差距变大还是变小？为什么简单的回文判断三模型差不多，而爬虫任务差距大？",
        "Claude 的代码注释普遍更好——这是模型能力的差异，还是 Anthropic 在训练时有意为之？这提示了我们选择 AI 工具时应该注意什么？",
        "如果你要给一个完全不会编程的朋友推荐 AI 写代码工具，你会推荐哪一个？如果给你自己做大型项目，你会选哪个？（这两个答案可能不同！）"
      ],
    },
  ];
