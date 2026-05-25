"""Seed all 20 ML experiments from experiments_seed.json into sys_learning_content_items."""
import asyncio, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import AsyncSessionLocal
from app.models.learning.content import LearningContentItem
from sqlalchemy import select

SEED_FILE = os.path.join(os.path.dirname(__file__), "archive", "experiments_seed.json")


async def seed():
    if not os.path.exists(SEED_FILE):
        print(f"ERROR: {SEED_FILE} not found. Run: npx tsx backend/scripts/export_experiments.ts")
        return

    with open(SEED_FILE, "r", encoding="utf-8") as f:
        all_experiments: dict = json.load(f)

    total = 0
    async with AsyncSessionLocal() as db:
        for difficulty, exp_list in all_experiments.items():
            for i, exp in enumerate(exp_list):
                name = exp.get("name", "")
                if not name:
                    continue

                result = await db.execute(
                    select(LearningContentItem).where(
                        LearningContentItem.module_key == "ml",
                        LearningContentItem.section_key == "experiments",
                        LearningContentItem.item_key == name,
                    )
                )
                existing = result.scalar_one_or_none()

                if existing:
                    existing.title = name
                    existing.summary = exp.get("goal", "")[:200]
                    existing.content = json.dumps(exp, ensure_ascii=False)
                    existing.difficulty = difficulty
                    existing.sort_order = i
                    existing.enabled = True
                else:
                    db.add(LearningContentItem(
                        module_key="ml",
                        section_key="experiments",
                        item_key=name,
                        title=name,
                        summary=exp.get("goal", "")[:200],
                        content=json.dumps(exp, ensure_ascii=False),
                        difficulty=difficulty,
                        sort_order=i,
                        source_type="seed",
                        enabled=True,
                    ))
                total += 1

        await db.commit()

    print(f"Seeded {total} experiments ({', '.join(f'{k}:{len(v)}' for k,v in all_experiments.items())})")


if __name__ == "__main__":
    asyncio.run(seed())
