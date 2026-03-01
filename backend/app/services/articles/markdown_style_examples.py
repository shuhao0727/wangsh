from __future__ import annotations

from app.services.articles.markdown_styles import upsert_style


STYLE_EXAMPLES: list[dict] = [
    {
        "key": "terminal",
        "title": "终端（代码）",
        "sort_order": 10,
        "content": """
.ws-markdown {
  color: var(--ws-color-text);
  line-height: 1.75;
  font-size: 15px;
}

.ws-markdown h1 {
  font-size: 28px;
  margin: 0.2em 0 0.6em;
  padding-bottom: 0.35em;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.ws-markdown h2 {
  font-size: 22px;
  margin: 1.2em 0 0.6em;
}

.ws-markdown blockquote {
  margin: 1em 0;
  padding: 0.75em 1em;
  border-left: 4px solid var(--ws-color-primary);
  background: rgba(24, 144, 255, 0.06);
  color: rgba(0, 0, 0, 0.75);
}

.ws-markdown pre {
  background: #0b1021;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 14px 16px;
  overflow: auto;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
}

.ws-markdown pre code {
  color: #c0caf5;
}

.ws-markdown code {
  background: rgba(11, 16, 33, 0.08);
  border: 1px solid rgba(11, 16, 33, 0.18);
  border-radius: 6px;
  padding: 0.1em 0.35em;
  color: #1e66f5;
}

.ws-markdown table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}
.ws-markdown th,
.ws-markdown td {
  border: 1px solid rgba(0, 0, 0, 0.08);
  padding: 10px 12px;
}
.ws-markdown th {
  background: rgba(0, 0, 0, 0.03);
}
""".strip(),
    },
    {
        "key": "paper",
        "title": "论文（排版）",
        "sort_order": 20,
        "content": """
.ws-markdown {
  color: rgba(0, 0, 0, 0.88);
  line-height: 1.95;
  font-size: 16px;
}

.ws-markdown h1,
.ws-markdown h2,
.ws-markdown h3 {
  font-family: ui-serif, "Times New Roman", Times, serif;
  letter-spacing: 0.2px;
}

.ws-markdown h1 {
  font-size: 30px;
  text-align: center;
  margin: 0.4em 0 0.9em;
}

.ws-markdown p {
  text-align: justify;
  text-justify: inter-ideograph;
}

.ws-markdown a {
  color: #1677ff;
  text-decoration: none;
  border-bottom: 1px dashed rgba(22, 119, 255, 0.45);
}
.ws-markdown a:hover {
  border-bottom-style: solid;
}

.ws-markdown blockquote {
  margin: 1em 0;
  padding: 0.6em 1em;
  border-left: 3px solid rgba(0, 0, 0, 0.2);
  color: rgba(0, 0, 0, 0.72);
  background: rgba(0, 0, 0, 0.03);
}

.ws-markdown hr {
  border: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  margin: 1.6em 0;
}
""".strip(),
    },
    {
        "key": "minimal",
        "title": "极简（清爽）",
        "sort_order": 30,
        "content": """
.ws-markdown {
  color: rgba(0, 0, 0, 0.88);
  line-height: 1.8;
  font-size: 15px;
}

.ws-markdown h1 {
  font-size: 26px;
  margin: 0.2em 0 0.8em;
}

.ws-markdown h2 {
  font-size: 20px;
  margin: 1.1em 0 0.6em;
}

.ws-markdown code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.95em;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  padding: 0.1em 0.35em;
}

.ws-markdown pre {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  padding: 14px 16px;
  overflow: auto;
}
""".strip(),
    },
]


async def ensure_style_examples(db) -> None:
    for item in STYLE_EXAMPLES:
        await upsert_style(
            db=db,
            key=item["key"],
            title=item["title"],
            content=item["content"],
            sort_order=int(item.get("sort_order") or 0),
        )
