from __future__ import annotations

from sqlalchemy import select

from app.models import User
from app.models.articles.article import Article


ARTICLE_EXAMPLES: list[dict] = [
    {
        "slug": "demo-style-terminal",
        "title": "示例：终端风格 Markdown（terminal）",
        "style_key": "terminal",
        "summary": "面向工程笔记：突出代码块、命令行、表格与引用。",
        "content": """
# 终端风格示例：命令行笔记

> 目标：用最少的文字把命令写清楚，并让代码块一眼可读。

## 1. 环境信息

- 系统：macOS / Linux
- Shell：zsh / bash
- 版本：`python --version`、`node --version`、`git --version`

## 2. 常用命令

### 2.1 Git

```bash
git status
git add -A
git commit -m "feat: add markdown style demo"
git log -n 5 --oneline
```

### 2.2 运行服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 3. 配置片段

```ini
API_V1_STR=/api/v1
DEBUG=false
LOG_LEVEL=INFO
```

## 4. 小结表格

| 场景 | 命令 | 备注 |
| --- | --- | --- |
| 查看状态 | `git status` | 先确认变更 |
| 运行后端 | `uvicorn ...` | 开发热重载 |
| 查看端口 | `lsof -i :8000` | 诊断占用 |

---

最后：当你看到一屏命令时，最重要的是“可复制、可执行、可复现”。""".strip(),
        "published": True,
    },
    {
        "slug": "demo-style-paper",
        "title": "示例：论文排版 Markdown（paper）",
        "style_key": "paper",
        "summary": "偏阅读体验：段落、引用、链接与结构层级。",
        "content": """
# 论文风格示例：一段短文

## 摘要

本文用 Markdown 展示“论文排版”样式的重点：清晰层级、段落节奏、引用块与链接。

## 1. 引言

写作的核心不是“堆信息”，而是让读者在 **第一次阅读** 时就能理解结构。
一个好习惯是：每一节开头先给出一句话的意图。

## 2. 方法

1. 先定标题层级：`h1 → h2 → h3`
2. 每段只表达一个观点
3. 用引用块放置强调信息

> 经验法则：如果一个段落超过 6 行，考虑拆成两段。

## 3. 结果

下表展示“结构化表达”的收益：

| 指标 | 结构化前 | 结构化后 |
| --- | --- | --- |
| 阅读完成率 | 低 | 高 |
| 复述准确率 | 低 | 高 |
| 修改成本 | 高 | 低 |

## 4. 讨论

参考链接示例：[Markdown Guide](https://www.markdownguide.org/basic-syntax/)

## 5. 结论

当内容有了结构，样式才有意义；否则再漂亮的 CSS 也只是“装饰”。""".strip(),
        "published": True,
    },
    {
        "slug": "demo-style-minimal",
        "title": "示例：极简清爽 Markdown（minimal）",
        "style_key": "minimal",
        "summary": "偏产品/项目笔记：任务列表、清单与少量代码。",
        "content": """
# 极简风格示例：项目备忘

## 今日目标

- [ ] 把页面样式真正应用到渲染内容
- [ ] 新建一个样式方案并保存
- [ ] 写一篇示例文章验证视觉效果

## 关键结论

1. 规则要能命中容器元素及其子元素
2. 样式方案要能被创建、读取、切换

## 小代码

```ts
export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
```

## 备忘

> 极简风格适合长期维护：少装饰、少噪音、强调可读性。

---

下一步：把常用的“标题/引用/代码/表格/列表”都覆盖到你的默认样式里。""".strip(),
        "published": True,
    },
]


async def ensure_article_examples(db) -> None:
    res = await db.execute(select(User).where(User.role_code == "super_admin").order_by(User.id.asc()))
    u = res.scalars().first()
    if not u:
        res = await db.execute(select(User).order_by(User.id.asc()))
        u = res.scalars().first()
    if not u:
        return

    for item in ARTICLE_EXAMPLES:
        slug = item["slug"]
        existing = await db.execute(select(Article).where(Article.slug == slug))
        if existing.scalar_one_or_none():
            continue
        obj = Article(
            title=item["title"],
            slug=slug,
            content=item["content"],
            summary=item.get("summary") or None,
            custom_css=None,
            style_key=item.get("style_key") or None,
            author_id=int(u.id),
            category_id=None,
            published=bool(item.get("published", True)),
        )
        db.add(obj)
    await db.commit()
