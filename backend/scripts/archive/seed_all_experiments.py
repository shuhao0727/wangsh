"""Seed AI and Agents experiments from JSON files into DB."""
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db.database import AsyncSessionLocal
from app.models.learning.content import LearningContentItem
from sqlalchemy import delete

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ARCHIVE_DIR = os.path.join(SCRIPT_DIR, "archive")

async def seed_module(db, module_key: str, json_path: str):
    if not os.path.exists(json_path):
        print(f"  SKIP {json_path} (not found)")
        return 0
    with open(json_path, "r", encoding="utf-8") as f:
        experiments = json.load(f)

    count = 0
    for exp in experiments:
        name = exp.get("name", "")
        if not name:
            continue
        db.add(LearningContentItem(
            module_key=module_key,
            section_key="experiments",
            item_key=name,
            title=name,
            summary=exp.get("goal", "")[:200],
            content=json.dumps(exp, ensure_ascii=False),
            difficulty=exp.get("difficulty", "beginner"),
            sort_order=count,
            source_type="seed",
            enabled=True,
        ))
        count += 1
    await db.commit()
    return count

async def main():
    async with AsyncSessionLocal() as db:
        # Clear old AI + Agents experiments
        await db.execute(delete(LearningContentItem).where(
            LearningContentItem.module_key.in_(["ai", "agents"]),
            LearningContentItem.section_key == "experiments"
        ))
        await db.commit()
        print("Cleared old experiments")

        # Seed AI
        n1 = await seed_module(db, "ai", os.path.join(ARCHIVE_DIR, "ai_experiments_1_9.json"))
        n2 = await seed_module(db, "ai", os.path.join(ARCHIVE_DIR, "ai_experiments_10_18.json"))
        print(f"AI experiments: {n1 + n2} seeded")

        # Seed Agents
        n3 = await seed_module(db, "agents", os.path.join(ARCHIVE_DIR, "agents_experiments_1_12.json"))
        n4 = await seed_module(db, "agents", os.path.join(ARCHIVE_DIR, "agents_experiments_13_23.json"))
        print(f"Agents experiments: {n3 + n4} seeded")

    print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
