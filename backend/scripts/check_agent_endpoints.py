#!/usr/bin/env python3
"""部署前核对：所有智能体的出站端点是否会被安全策略拒绝。

只读脚本，不修改任何数据、不发外部请求。判定规则与
``app.services.agents.endpoint_security.assert_agent_outbound_endpoint`` 完全一致：
命中 ``AGENT_TRUSTED_INTERNAL_ENDPOINTS`` 白名单或本机 Ollama 的放行，其余按 IP 策略。

用法（在 backend 容器或本机 backend/ 目录下）：

    python scripts/check_agent_endpoints.py
    python scripts/check_agent_endpoints.py --all      # 含已停用智能体
    python scripts/check_agent_endpoints.py --json

退出码：存在 blocked/invalid 的启用智能体时为 1，否则为 0。
DNS 解析失败按 blocked 处理，与运行时一致。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.database import AsyncSessionLocal  # noqa: E402
from app.models.agents.ai_agent import AIAgent  # noqa: E402
from app.services.agents.endpoint_security import classify_agent_endpoint  # noqa: E402


async def collect(include_inactive: bool) -> list[dict]:
    query = select(
        AIAgent.id,
        AIAgent.name,
        AIAgent.agent_type,
        AIAgent.api_endpoint,
        AIAgent.is_active,
    ).order_by(AIAgent.id)
    if not include_inactive:
        query = query.where(AIAgent.is_active.is_(True))

    async with AsyncSessionLocal() as session:
        rows = (await session.execute(query)).all()

    results = []
    for row in rows:
        if not row.api_endpoint:
            results.append(
                {
                    "id": row.id,
                    "name": row.name,
                    "agent_type": row.agent_type,
                    "endpoint": "",
                    "active": bool(row.is_active),
                    "verdict": "skipped",
                    "reason": "未配置端点",
                }
            )
            continue
        verdict, reason = await classify_agent_endpoint(str(row.api_endpoint))
        results.append(
            {
                "id": row.id,
                "name": row.name,
                "agent_type": row.agent_type,
                "endpoint": str(row.api_endpoint),
                "active": bool(row.is_active),
                "verdict": verdict,
                "reason": reason,
            }
        )
    return results


def render(results: list[dict]) -> None:
    header = f"{'ID':>4}  {'状态':<4}  {'判定':<11}  端点 / 说明"
    print(header)
    print("-" * len(header))
    for item in results:
        flag = "启用" if item["active"] else "停用"
        print(
            f"{item['id']:>4}  {flag:<4}  {item['verdict']:<11}"
            f"  {item['endpoint'] or '—'}  （{item['reason']}）"
        )

    counts: dict[str, int] = {}
    for item in results:
        counts[item["verdict"]] = counts.get(item["verdict"], 0) + 1
    summary = "  ".join(f"{key}={value}" for key, value in sorted(counts.items()))
    print("-" * len(header))
    print(f"合计 {len(results)} 条：{summary}" if results else "没有可核对的智能体")
    risky = [item for item in results if item["verdict"] in {"blocked", "invalid"}]
    if risky:
        print("\n以下启用智能体在出站时会被拒绝，发版前需补白名单或调整地址：")
        for item in risky:
            print(f"  - id={item['id']} {item['name']} → {item['endpoint']}（{item['reason']}）")


async def main() -> int:
    parser = argparse.ArgumentParser(description="核对智能体出站端点是否会被安全策略拒绝")
    parser.add_argument("--all", action="store_true", help="包含已停用的智能体")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出")
    args = parser.parse_args()

    results = await collect(include_inactive=args.all)
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        render(results)

    return 1 if any(
        item["verdict"] in {"blocked", "invalid"} and item["active"] for item in results
    ) else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
