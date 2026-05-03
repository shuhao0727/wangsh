# Claude Code Instructions for WangSh

Claude Code 在本仓库工作时，默认遵守根目录 `AGENTS.md`。`AGENTS.md` 是当前项目的权威 Agent 操作指南。

## 必须遵守

- 先阅读并遵守 `AGENTS.md`。
- 不要对仓库根目录运行递归 `directory_tree` 或等价的大范围目录树扫描。
- 不要读取或遍历 `node_modules/`、`frontend/node_modules/`、`frontend/build/`、`backend/venv/`、`data/`、`.git/`、`dist/`、`coverage/`。
- 搜索代码优先使用 `rg`，并显式排除大目录。
- 如果必须列目录，只列目标子目录的第一层，不要对项目根目录做深层遍历。
- 不要主动 commit 或 push，除非用户明确要求。
- 不要回滚、覆盖或整理用户或其他 agent 的改动。

## Claude 专属参考

需要 Claude 历史上下文或协作说明时，再按需阅读：

- `docs/development/CLAUDE_GUIDE.md`
- `docs/development/CLAUDE_MEMORY.md`

如果 `CLAUDE.md` 与 `AGENTS.md` 有冲突，以 `AGENTS.md` 为准。
