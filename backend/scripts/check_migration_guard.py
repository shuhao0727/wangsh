#!/usr/bin/env python3
"""迁移守卫静态检查：新增迁移不得使用 IF NOT EXISTS / if_not_exists。

背景
----
``0ceed8e`` 只移除了 ``291268877685`` 一个迁移里的 ``if_not_exists`` 守卫，
其余历史迁移仍带 ``CREATE ... IF NOT EXISTS`` / ``ADD COLUMN IF NOT EXISTS`` /
``if_not_exists=True``。这类守卫会让「手工加过同名列/索引」的 schema 漂移在
upgrade 时被静默跳过，``alembic_version`` 照常推进，schema 与迁移文件永久分叉。

规则
----
采用「新增文件禁止 + 历史按 revision 冻结」的折中方案：

- 历史 revision 在 ``FROZEN_GUARD_COUNTS`` 里登记命中数，命中数只许减少不许增加；
- 未登记的新 revision 一律不得出现守卫，出现即失败；
- 未在冻结名单中、但命中数为 0 的历史文件自然通过。

为什么不在线校验
----------------
本检查只读迁移源码，不连数据库，因此可以在 CI 的任何阶段执行，也不受
「是否已在 head 上」影响。数据库侧的真实漂移仍由
``check_migration_state.py`` 的 ``evaluate_migration_state`` 负责，两者互补。

用法
----
    python scripts/check_migration_guard.py            # 检查 alembic/versions
    python scripts/check_migration_guard.py --dir DIR  # 检查指定目录
    python scripts/check_migration_guard.py --update-baseline  # 重新生成冻结计数
"""

from __future__ import annotations

import argparse
import ast
import re
import sys
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"

# 历史 revision 的守卫命中数基线。只许减少，不许增加。
# 基线以 `--update-baseline` 实测为准写入；新增条目必须说明理由。
FROZEN_GUARD_COUNTS: dict[str, int] = {
    "20260211_0001": 13,
    "20260211_0002": 3,
    "20260211_0003": 6,
    "20260211_0004": 7,
    "20260213_0005": 3,
    "20260223_0006": 2,
    "20260225_0007": 1,
    "20260320_0002": 8,
    "20260320_0003": 1,
    "20260320_0004": 1,
    "20260503_0003_ml_book": 3,
    "20260711_0001_add_assessment_availability": 7,
    "20260726_0001_add_article_search_trgm_indexes": 3,
    "20260807_0001_task_analyses_idxs": 2,
    "20260817_0001_query_filter_indexes": 7,
    "78ef5c1ccb1d": 5,
    # 291268877685 已在 0ceed8e 移除守卫：冻结值为 0，谁加回去谁失败（回归哨兵）。
    "291268877685_add_core_indexes_for_conversations": 0,
}

# 只匹配 upgrade 中用到的守卫写法；downgrade 里的 DROP ... IF EXISTS 属正常用法。
_GUARD_PATTERN = re.compile(r"\bif[\s_]+not[\s_]+exists\b", re.IGNORECASE)


def _revision_name(path: Path) -> str:
    """从迁移文件读取 revision 标识（不执行文件）。"""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "revision":
                    if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                        return node.value.value
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name) and node.target.id == "revision":
                if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                    return node.value.value
    raise ValueError(f"{path}: 找不到 revision 定义")


def _upgrade_body(path: Path) -> tuple[list[str], int]:
    """返回 (upgrade() 函数体按行拆分, 起始行号偏移)。downgrade 里的 IF EXISTS 不算守卫。"""
    source = path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(path))
    lines = source.splitlines()
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "upgrade":
            if not node.body:
                return [], 0
            start = node.body[0].lineno - 1
            end = max(getattr(child, "end_lineno", node.lineno) for child in ast.walk(node))
            return lines[start:end], start
    return [], 0


def count_guards(path: Path) -> tuple[str, list[tuple[int, str]]]:
    """返回 (revision, [(行号, 代码片段)])。"""
    revision = _revision_name(path)
    body, offset = _upgrade_body(path)
    hits: list[tuple[int, str]] = []
    for index, line in enumerate(body, start=offset + 1):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if _GUARD_PATTERN.search(line):
            hits.append((index, stripped[:120]))
    return revision, hits


def _iter_migrations(versions_dir: Path):
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        yield path


def check(versions_dir: Path, frozen: dict[str, int]) -> list[str]:
    """返回违规信息列表；空列表表示通过。"""
    problems: list[str] = []
    for path in _iter_migrations(versions_dir):
        try:
            revision, hits = count_guards(path)
        except (SyntaxError, ValueError) as exc:
            problems.append(f"{path.name}: 无法解析（{exc}）")
            continue
        if not hits:
            continue
        allowed = frozen.get(revision, 0)
        if len(hits) > allowed:
            for lineno, snippet in hits[allowed:]:
                problems.append(
                    f"{path.name}:{lineno}: 迁移不得使用 IF NOT EXISTS / if_not_exists"
                    f"（revision {revision!r}，已冻结 {allowed} 处）；{snippet}"
                )
        elif len(hits) < allowed:
            problems.append(
                f"{path.name}: revision {revision!r} 的守卫数从冻结的 {allowed} "
                f"降到 {len(hits)}，请同步下调 FROZEN_GUARD_COUNTS"
            )
    return problems


def update_baseline(versions_dir: Path) -> dict[str, int]:
    """重新统计所有含守卫的 revision，供人工确认后写回基线。"""
    counts: dict[str, int] = {}
    for path in _iter_migrations(versions_dir):
        try:
            revision, hits = count_guards(path)
        except (SyntaxError, ValueError):
            continue
        if hits:
            counts[revision] = len(hits)
    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dir", type=Path, default=VERSIONS_DIR, help="迁移目录")
    parser.add_argument(
        "--update-baseline",
        action="store_true",
        help="打印当前所有含守卫的 revision 计数，供人工确认后写回 FROZEN_GUARD_COUNTS",
    )
    args = parser.parse_args(argv)

    if args.update_baseline:
        for revision, count in sorted(update_baseline(args.dir).items()):
            print(f'    "{revision}": {count},')
        return 0

    problems = check(args.dir, FROZEN_GUARD_COUNTS)
    for problem in problems:
        print(f"[FAIL] {problem}", file=sys.stderr)
    if problems:
        print(
            "\n修复方式：新迁移去掉 IF NOT EXISTS / if_not_exists，改为无条件创建。"
            "历史迁移的冻结额度见 FROZEN_GUARD_COUNTS 与 docs/ENGINEERING_GOVERNANCE.md §六。",
            file=sys.stderr,
        )
        return 1
    print(f"[OK] 迁移守卫检查通过（{len(list(_iter_migrations(args.dir)))} 个文件）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
