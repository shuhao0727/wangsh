"""seed markdown styles

Revision ID: 20260225_0010
Revises: 20260225_0009
Create Date: 2026-02-25
"""

import textwrap
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision: str = "20260225_0010"
down_revision: Union[str, None] = "20260225_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = set(inspector.get_table_names())
    if "wz_markdown_styles" not in tables:
        return

    styles = [
        {
            "key": "default",
            "title": "默认（清爽）",
            "content": textwrap.dedent(
                """
                :root { --md-accent: var(--ws-color-primary); }

                h1 { border-left: 6px solid var(--md-accent); padding-left: 12px; }
                h2 { border-left: 4px solid var(--md-accent); padding-left: 10px; }
                h3 { border-left: 3px solid var(--ws-color-border); padding-left: 10px; }

                a { text-decoration: underline; text-underline-offset: 2px; }

                blockquote { border-left-color: var(--md-accent); background: var(--ws-color-info-soft); }

                pre {
                  border-radius: 10px;
                  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
                }

                code {
                  background: var(--ws-color-primary-soft);
                  border-color: var(--ws-color-focus-ring);
                  color: var(--ws-color-primary-active);
                  font-weight: 600;
                }
                """
            ).strip(),
            "sort_order": 0,
        },
        {
            "key": "paper",
            "title": "纸张（阅读）",
            "content": textwrap.dedent(
                """
                :root {
                  font-family: ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, "Noto Serif SC", "Songti SC", serif;
                  font-size: 15px;
                  line-height: 1.95;
                }

                h1 { letter-spacing: 0.01em; border-bottom: 1px solid var(--ws-color-border); padding-bottom: 10px; }
                h2 { border-bottom: 1px dashed var(--ws-color-border); padding-bottom: 8px; }

                p { margin: 0.95em 0; }

                blockquote {
                  background: var(--ws-color-warning-soft);
                  border-left-color: var(--ws-color-warning);
                  color: var(--ws-color-text);
                }

                pre {
                  background: var(--ws-color-surface);
                  border: 1px dashed var(--ws-color-border);
                  border-radius: 10px;
                }

                code {
                  background: var(--ws-color-warning-soft);
                  border-color: var(--ws-color-warning);
                  color: #925400;
                }
                """
            ).strip(),
            "sort_order": 10,
        },
        {
            "key": "terminal",
            "title": "终端（代码）",
            "content": textwrap.dedent(
                """
                h1 { color: var(--ws-color-text); text-shadow: 0 1px 0 rgba(0, 0, 0, 0.04); }
                h2 { color: var(--ws-color-text); }

                pre {
                  background: #0b1021;
                  border: 1px solid rgba(255, 255, 255, 0.12);
                  border-radius: 12px;
                  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
                }

                pre code { color: #c0caf5; }

                code {
                  background: rgba(11, 16, 33, 0.08);
                  border-color: rgba(11, 16, 33, 0.18);
                  color: #1e66f5;
                }
                """
            ).strip(),
            "sort_order": 20,
        },
    ]

    stmt = sa.text(
        """
        INSERT INTO wz_markdown_styles (key, title, content, sort_order)
        VALUES (:key, :title, :content, :sort_order)
        ON CONFLICT (key) DO NOTHING;
        """
    )
    for style in styles:
        bind.execute(stmt, style)


def downgrade() -> None:
    pass
