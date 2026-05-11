# 后端脚本归档说明

本目录保存已经不再作为当前入口使用的后端一次性脚本、种子数据和历史迁移辅助文件。

## 归档内容

- `enrich_r*.py` - ML/AI/Agents 章节批量富化脚本
- `agents_experiments_*.json` / `ai_experiments_*.json` - 旧的实验种子数据分片
- `experiments_seed.json` - ML 实验种子数据
- `ml_book_seed.json` - 旧的 ML book 种子数据
- `seed_ml_book_2.py` - ML book 补充种子脚本

## 使用原则

- 不把新的日常脚本继续堆到这个目录
- 如归档脚本仍被引用，优先检查是否有更清晰的活跃替代路径
- 若需要恢复旧数据，可优先查看该目录和 `docs/scripts/ARCHIVE_INDEX.md`
