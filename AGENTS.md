# Codex 使用约束

这个仓库体积较大，Codex 处理项目时必须优先避免全量递归扫描。

- 不要对仓库根目录运行递归 `directory_tree` 或等价的大范围目录树扫描。
- 不要读取或遍历 `node_modules/`、`frontend/node_modules/`、`frontend/build/`、`backend/venv/`、`data/`、`.git/`、`dist/`、`coverage/`。
- 需要了解结构时，先读取 `README.md`、`frontend/package.json`、`backend/requirements.txt`，再按需查看具体子目录。
- 搜索代码优先使用 `rg`，并排除大目录，例如：
  `rg "关键词" --glob '!node_modules/**' --glob '!frontend/build/**' --glob '!backend/venv/**' --glob '!data/**'`.
- 如果必须列目录，只列目标子目录的第一层，不要对项目根目录做深层遍历。
