import type { Experiment } from "../types";

export const beginnerExperiments: Experiment[] = [
    {
      name: "Prompt 对决：谁能让 AI 算对数学题",
      difficulty: "beginner",
      data: "10 道不同难度的数学题（自定义）",
      tools: ["Python", "DeepSeek API (OpenAI 兼容接口)", "pandas"],
      skills: ["Prompt 工程", "实验设计", "数据记录与分析", "API 调用"],
      goal: "同一个数学问题用 5 种不同的 prompt 发给 AI，对比准确率，直观理解 prompt 工程对 AI 输出质量的巨大影响",
      estimated_time: "2-3小时",
      deliverables: "一份包含完整实验记录、对比表格和分析结论的 Jupyter Notebook",
      data_source: "自定义 10 道数学题：涵盖算术/方程/几何/概率/推理各2题，难度从小学到高中不等",
      steps: [
        "编写 10 道数学题，覆盖加减乘除、一元一次方程、几何面积、概率计算、逻辑推理五类",
        "设计 5 种 Prompt 模板：A-直接问 / B-加角色 / C-加步骤引导 / D-加示例 / E-加约束（如'请仔细检查'）",
        "用 Python 循环调用 DeepSeek API，每种 prompt 对每道题各问一次，记录所有回答",
        "人工判断每道题 AI 答案是否正确，在表格中标记正确/错误/部分正确",
        "计算每种 prompt 的准确率，用 pandas 生成对比表格，绘制柱状图",
        "选 2-3 个典型的错误案例，分析 Prompt 表述如何影响了 AI 的推理过程"
      ],
      code: `import pandas as pd
import matplotlib.pyplot as plt
from openai import OpenAI

# 初始化 DeepSeek 客户端（DeepSeek 兼容 OpenAI 接口格式）
client = OpenAI(
    base_url="https://api.deepseek.com/v1",
    api_key="your-deepseek-api-key"  # 替换为你的 DeepSeek API Key
)

# 10道数学题
questions = [
    "计算 15 × 27 + 38 - 126 = ?",
    "解方程：3x + 7 = 34",
    "一个圆的半径是5cm，它的面积是多少平方厘米？（π取3.14）",
    "抛一枚硬币5次，恰好出现3次正面的概率是多少？",
    "小明用40元买了若干支笔，如果每支笔降价1元，他能多买2支。原来每支笔多少元？",
    "计算：(2 + 3) × 4 ÷ 2 - 1 = ?",
    "一个两位数，十位数字是个位数字的2倍，且这个数大于50。这个数可能是多少？",
    "三角形的三个内角之比为 2:3:5，这个三角形是什么三角形？",
    "一个箱子里有3个红球和2个蓝球，随机抽取2个球，求抽到一红一蓝的概率。",
    "1, 3, 7, 15, 31, ? 问号处应该是哪个数？请说出规律。"
]

# 5种 Prompt 模板
prompt_types = {
    "A-直接问": "请回答以下数学题：{question}",
    "B-加角色": "你是一位资深数学老师。请回答以下题目：{question}",
    "C-加步骤": "请一步步思考，写出完整解题过程，然后给出答案。题目：{question}",
    "D-加示例": "例如，问'2+3=?'则回答'2+3=5'。现在请回答：{question}",
    "E-加约束": "请仔细计算并检查答案，如果确定再回答。题目：{question}"
}

# 期望答案（用于自动判断）
answers = [
    "317",  # 15*27+38-126
    "x=9",  # 3x+7=34
    "78.5平方厘米",  # π*5²
    "5/16或31.25%",  # C(5,3)*(1/2)^5
    "4元",  # 设原价x: 40/x + 2 = 40/(x-1)
    "9",  # (5)*4/2-1
    "84",  # 十位是个位2倍且>50 → ab: 2b*10+b>50 → b=2时84
    "直角三角形",  # 2:3:5 → 36°:54°:90°
    "3/5或60%",  # C(3,1)*C(2,1)/C(5,2)
    "63，规律是每次加 2^n（分别加2,4,8,16,32）"
]

# 实验循环
results = []
for pt_name, pt_template in prompt_types.items():
    for i, q in enumerate(questions):
        prompt = pt_template.format(question=q)
        try:
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=500
            )
            answer = resp.choices[0].message.content.strip()
        except Exception as e:
            answer = f"API错误: {e}"
        results.append({
            "Prompt类型": pt_name,
            "题号": i + 1,
            "题目": q[:30] + "...",
            "AI回答": answer[:100],
            "期望答案": answers[i],
            "是否正确": "待判断"  # 需要人工或更智能的方式判断
        })
        print(f"完成: {pt_name} | 题{i+1}")

# 保存结果
df = pd.DataFrame(results)
df.to_csv("prompt_实验记录.csv", index=False, encoding="utf-8-sig")

# 简单统计（按包含关键词判定）
import re
for idx, row in df.iterrows():
    expected = row["期望答案"]
    ai_reply = row["AI回答"]
    # 模糊匹配：答案是否包含期望的关键数字
    nums = re.findall(r'\\d+', expected)
    if nums:
        df.at[idx, "是否正确"] = nums[0] in ai_reply.replace(" ", "")
    else:
        df.at[idx, "是否正确"] = expected[:4] in ai_reply

# 准确率统计
acc = df.groupby("Prompt类型")["是否正确"].apply(lambda x: (x == True).sum() / len(x))
print("\\n各 Prompt 准确率：")
print(acc)

# 可视化
acc.plot(kind="bar", color=["#3498db","#e74c3c","#2ecc71","#f39c12","#9b59b6"])
plt.ylabel("准确率"); plt.title("Prompt 类型 vs 数学题准确率")
plt.xticks(rotation=15); plt.tight_layout(); plt.show()`,
      expected_output: "C-加步骤 和 D-加示例 的准确率最高（约 70-80%），A-直接问 最低（约 40-50%）。推理类题目（第5、9、10题）各 prompt 差异最大。柱状图直观展示了 prompt 工程对 AI 表现的显著影响。",
      reflection: [
        "为什么加了'一步步思考'的 prompt 比直接问准确率高那么多？这和人类的思考方式有什么相似之处？",
        "在哪些类型的题目上 AI 始终做不对？这些题目有什么共同特征？（提示：是不是需要更复杂的推理？）",
        "如果你要让 AI 在你的期末考试中拿满分，你会设计什么样的 prompt？试试看！"
      ],
    },
    {
      name: "AI 画画：提示词调优实验室",
      difficulty: "beginner",
      data: "1 个主题 × 10 种 prompt 变体",
      tools: ["Python", "通义万相 API 或 Stable Diffusion API", "PIL/Pillow"],
      skills: ["提示词工程", "参数控制", "对比分析", "图像评估"],
      goal: "对同一主题用 10 种不同 prompt 生成图片，分析风格、构图、光影等关键词对生成结果的影响，掌握 AI 生图的提示词技巧",
      estimated_time: "2-3小时",
      deliverables: "10 张生成图片 + 对比分析表格 + 提示词关键词效果总结笔记",
      data_source: "自定义 Prompt，通过通义万相 API 或 Stable Diffusion (Replicate) API 生成",
      steps: [
        "确定主题（如'未来城市'），设计 10 种变体 prompt，每次只改变 1-2 个关键词",
        "变体方向：写实/卡通/赛博朋克/水彩风格；白天/黄昏/夜晚；俯视/平视/仰视；加光影关键词 vs 不加",
        "用 Python 循环调用图像生成 API，每张图保存为 {编号}_{描述}.png",
        "将 10 张图排列成 2×5 的网格，方便对比",
        "分析每个关键词的影响：'cinematic lighting' 让画面多了什么？'watercolor style' 改变了什么？",
        "总结写一份'AI 绘画提示词速查表'：按风格/光影/构图/细节分类，每个类别列出 3-5 个最有用的关键词"
      ],
      code: `from dashscope import ImageSynthesis
import dashscope
from PIL import Image
import requests
import matplotlib.pyplot as plt
import os

os.makedirs("ai_images", exist_ok=True)

# 初始化通义万相 API（阿里云 DashScope）
dashscope.api_key = "your-dashscope-api-key"  # 替换为你的 API Key
# 也可使用 CogView (智谱 API) 作为替代方案

# 10种 Prompt 变体 —— 主题: 未来城市
prompts = [
    # 风格变化
    "A futuristic city in the year 2150",
    "A futuristic city in the year 2150, photorealistic style",
    "A futuristic city in the year 2150, cartoon illustration style",
    "A futuristic city in the year 2150, cyberpunk style, neon lights",
    "A futuristic city in the year 2150, watercolor painting style",
    # 时间/光影变化
    "A futuristic city at sunrise, warm golden sunlight, photorealistic",
    "A futuristic city at night, neon reflections on wet streets, photorealistic",
    "A futuristic city in foggy morning, atmospheric lighting, photorealistic",
    # 构图变化
    "Bird's eye view of a futuristic city, seen from above, photorealistic",
    "Street-level view of a futuristic city, looking up at towering skyscrapers, photorealistic"
]

images = []

for i, prompt in enumerate(prompts):
    print(f"正在生成第 {i+1}/10 张: {prompt[:50]}...")
    try:
        response = ImageSynthesis.call(
            model="wanx2.0-t2i-turbo",  # 通义万相 2.0
            prompt=prompt,
            n=1,
            size="1024*1024"
        )
        img_url = response.output.results[0].url
        img_data = requests.get(img_url).content
        filename = f"ai_images/{(i+1):02d}_{prompt[:30].replace(' ', '_')}.png"
        with open(filename, "wb") as f:
            f.write(img_data)
        images.append(Image.open(filename))
        print(f"  -> 已保存: {filename}")
    except Exception as e:
        print(f"  -> 生成失败: {e}")

# 排列成 2行×5列 的网格
if len(images) == 10:
    fig, axes = plt.subplots(2, 5, figsize=(16, 7))
    for idx, (ax, img) in enumerate(zip(axes.flat, images)):
        ax.imshow(img)
        ax.set_title(f"{idx+1}", fontsize=10)
        ax.axis("off")
    plt.suptitle("AI 绘画：10种 Prompt 变体对比", fontsize=14)
    plt.tight_layout()
    plt.savefig("prompt_comparison_grid.png", dpi=150)
    plt.show()

print("\\n完成！共生成图片:", len(images))`,
      expected_output: "10 张未来城市图片，风格差异明显：写实风格建筑细节丰富，赛博朋克有霓虹灯和暗色调，水彩风格呈现笔触感，俯视视角展示全貌而街景视角有纵深感。夜景色调偏蓝紫，黄昏有暖金色光。网格对比图直观明了。",
      reflection: [
        "'photorealistic' 和 'cartoon' 生成的图片，除了风格不同，画面中的元素数量有变化吗？哪个更丰富？",
        "如果你想要一张'宫崎骏风格的未来城市'，你会怎么修改 prompt？试试加 'Studio Ghibli style' 或 'Miyazaki'。",
        "多次用同一个 prompt 生成图片，结果一样吗？这说明了 AI 生图的什么特点？（提示：seed 的作用）"
      ],
    },
    {
      name: "AI 翻译大赛：人 vs 机",
      difficulty: "beginner",
      data: "3 篇中文文章（新闻/诗歌/对话）",
      tools: ["Python", "DeepSeek API 或 通义千问 API"],
      skills: ["翻译质量评估", "回译方法", "对比分析", "语言敏感度"],
      goal: "将中文文章 AI 翻译英文再回译中文，对比原文找出 AI 翻译的优缺点，理解机器翻译的边界与人类语言的艺术性",
      estimated_time: "2-3小时",
      deliverables: "3 组原文-AI翻译-回译对比报告 + AI 翻译优缺点总结表 + 人工修正建议",
      data_source: "自选或预设 3 段中文文本：1篇新闻(200字)、1首现代诗、1段日常对话(10轮)",
      steps: [
        "准备 3 段中文文本：A-新闻短讯（客观事实）、B-现代诗歌（意象和节奏）、C-朋友微信对话（口语化）",
        "用 AI 将中文翻译成英文，记录英文译文",
        "再用 AI 将英文回译成中文（back-translation），记录回译结果",
        "将 原文 vs 回译文 逐句对比，用不同颜色高亮差异：意思改变/细节丢失/语气变化",
        "分析 3 段文本的翻译质量差异：新闻翻译为什么最好？诗歌翻译丢了什么？口语翻译的语气对吗？",
        "总结 AI 翻译的 5 大优势和 5 大弱点，并思考：什么时候可以用 AI 翻译，什么时候必须人工翻译？"
      ],
      code: `from openai import OpenAI

# DeepSeek API 兼容 OpenAI 接口格式
client = OpenAI(
    base_url="https://api.deepseek.com/v1",
    api_key="your-deepseek-api-key"
)

# 3段中文原文
texts = [
    {
        "类型": "新闻短讯",
        "原文": "今天下午14时，我国在西昌卫星发射中心成功发射一颗遥感卫星。该卫星将用于国土资源调查、城市规划、防灾减灾等领域。本次发射是长征系列运载火箭的第500次飞行。"
    },
    {
        "类型": "现代诗歌",
        "原文": "秋天深了，神的家中鹰在集合\\n神的故乡鹰在言语\\n秋天深了，王在写诗\\n在这个世界上秋天深了\\n该得到的尚未得到\\n该丧失的早已丧失"
    },
    {
        "类型": "日常对话",
        "原文": "A: 你吃饭了吗？\\nB: 还没呢，刚下班，累死了。\\nA: 那一起去吃火锅吧，我请客！\\nB: 真的假的？那我不客气了哈哈。\\nA: 走走走，我知道有家新开的特别好吃。\\nB: 好嘞，等我换个衣服，五分钟。"
    }
]

results = []

for item in texts:
    print(f"\\n{'='*50}")
    print(f"类型: {item['类型']}")
    print(f"\\n原文:\\n{item['原文'][:100]}...")

    # Step 1: 中译英
    resp_en = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{
            "role": "system",
            "content": "You are a professional translator. Translate the Chinese text below into natural, fluent English. Preserve the original style and tone."
        }, {
            "role": "user",
            "content": item["原文"]
        }],
        temperature=0.3
    )
    english = resp_en.choices[0].message.content.strip()
    print(f"\\n英译:\\n{english[:200]}...")

    # Step 2: 英译中（回译）
    resp_cn = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{
            "role": "system",
            "content": "你是一位专业翻译。将以下英文翻译成自然流畅的中文，尽量贴近原文风格。"
        }, {
            "role": "user",
            "content": english
        }],
        temperature=0.3
    )
    back_cn = resp_cn.choices[0].message.content.strip()
    print(f"\\n回译:\\n{back_cn[:200]}...")

    results.append({
        "类型": item["类型"],
        "原文": item["原文"].strip(),
        "英文翻译": english,
        "回译中文": back_cn
    })

# 简单对比分析
print("\\n" + "="*60)
print("对比分析摘要")
print("="*60)
for r in results:
    original_words = set(r["原文"].replace("\\n", "").replace(" ", ""))
    back_words = set(r["回译中文"].replace("\\n", "").replace(" ", ""))
    # 粗糙的重叠率
    overlap = len(original_words & back_words)
    total = len(original_words | back_words)
    similarity = overlap / total * 100 if total > 0 else 0
    print(f"\\n【{r['类型']}】")
    print(f"  原文长度: {len(r['原文'])}字 | 回译长度: {len(r['回译中文'])}字")
    print(f"  字符重叠率: {similarity:.1f}%")
    print(f"  回译前80字: {r['回译中文'][:80]}...")

print("\\n\\n完成！请对照原文逐句分析翻译质量，完成翻译优缺点总结表。")`,
      expected_output: "新闻翻译的重叠率最高（>60%），事实信息基本保留。诗歌翻译重叠率最低（<30%），意象和韵律几乎丢失，回译文变成了散文。口语翻译的语义大致正确，但语气改变——'累死了'可能变成'很累'，失去了口语的生动感。",
      reflection: [
        "诗歌翻译为什么最难？'秋天深了，王在写诗'中的'王'被翻译成了什么？这丢失了什么文化内涵？",
        "口语'真的假的？那我不客气了哈哈'被翻译成英文再回译后，语气还像好朋友聊天吗？你感觉少了什么？",
        "如果让你在'用 AI 快速翻译 100 篇新闻'和'用 AI 翻译一首诗给外国朋友'之间选择，你会怎么选？为什么？"
      ],
    },
  ];
