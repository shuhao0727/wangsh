# 当前测试状态

> 状态：active
> Owner：testing
> 最近更新：2026-11-03

本页只维护最近验证；早期整理批次见[归档](../archive/README.md)，未结事项见[唯一台账](../plans/project-consolidation.md)。

## 基线与边界

- 当前源码：`/Users/wsh/wangsh`，修复分支 `fix/release-gates`，基线为远端 `main` 的 `aafbf3f`；PR首轮5项通过，后端仅1项旧测试替身签名失败，本次已本地修复，待修后CI验证。tag `2.2.5` 仍为 `189205c`，不覆盖已发镜像；2.2.5 尚未部署。
- 2026-11-03 发布前只读核对：局域网 SSH `192.168.5.3:22` 可用；生产 `/api/health` 为 200 / healthy / 2.2.2，DB/Redis healthy，worker 为 uid 1000。六个 2.2.5 候选镜像已在服务器，不等于源码身份、发布准入或部署验收通过；本次未重启服务。
- 下表原有合成/开发栈结果为各批历史验证，不代表远端 CI 已通过。2026-11-02 的“未连接生产、未提交”仅适用于当时批次；本轮修复方法与隔离边界见[批次复验](../archive/testing/2026-11-02-maintenance-batches.md#release-01-门禁修复复验2026-11-03)。

## 本轮结果

| 检查 | 命令 / 范围 | 结果 |
|---|---|---|
| 根层合同 | `node --test scripts/*.test.mjs`；临时仓库与 fake Docker/进程 | 本轮152 passed / 0 failed（原151项加自含用例分离合同）；workflow单独60 passed |
| 自含用例收集冲突 | 普通pytest重现19个初始化错误；独立 `-I -B -S` 仍19 passed | 仅在CI普通pytest中精确排除该模块，repo-config独立执行保留；新增workflow合同同时守住两处，未删除断言或扩大排除 |
| 前端干净安装复验 | Node20.20.2/npm10.8.2；原lock普通 `npm ci` 先红、补全后再跑 | 旧800→803条目，仅新增三个 `@emnapi/*`，已有依赖/版本0变化；干净安装736包，exit0；当前lock与已验候选SHA-256一致 |
| 前端修后门禁 | 同一干净依赖、无真实env、断网执行八项命令 | 脚本34、主应用836、ai-partner55 passed；token0 undefined、type-check通过；lint0 errors/479 warnings、UI gate通过、build:check exit0/WARN；Linux arm64 Alpine，非远端Ubuntu amd64 |
| 发布提交远端 CI | [ci-quality run 41592108696](https://github.com/shuhao0727/wangsh/actions/runs/41592108696)；`189205c` | **历史失败/阻断**：治理2 errors与前端lock缺项；不以修复候选结果覆盖原构建失败 |
| PR首轮远端CI及续修 | [ci-quality run 41634049631](https://github.com/shuhao0727/wangsh/actions/runs/41634049631)；`1dc0260` | 5项通过，后端3749 passed/123 skipped/1 failed：原子登录测试替身未接受 `include_inactive`；本地先复现同一TypeError，再补显式参数并断言为True，相关4文件36 passed/隔离违规0，待修后远端重跑 |
| 相对基线复核 | `python3 -I -B backend/scripts/check_python_governance.py check --base-ref 3d05b08` | 修前退出 1：阻塞对话复杂度 18→20、auth.py 612→620；本轮修复后普通、`--base-ref 3d05b08`、`--base-ref aafbf3f` 均退出 0 / errors=0 / warnings=41；复杂度回到18、auth.py 为606行，baseline 字节未变 |
| 本轮后端隔离回归 | 临时隔离运行器；认证/登录、运行时替换、阻塞/流式、SSRF、Dify、端点分类 | 8文件121 passed；相邻健康/运行时替换/分类/OpenRouter另26 passed（有重叠，不合并计数）；禁真实env/外连/非内存SQLite，隔离违规0；仅合成数据，不证明真实PG或供应商 |
| 阶段A代码复核 | 本批修复差异及直接调用方 | 无未解决 P1/P2；修复停止入口 Compose 选择器与 bash 3.2 空数组；2 项 P3 延迟记录 |
| 阶段C台账核验 | 24 行未结事项；当前源码/文档 | 完成分类：D 6、B 12、C 5；DIFY-02 核验为非缺陷关闭；A 类无待改代码项 |
| D类修复 | 后端定向 pytest + 前端 Vitest + type-check | 后端24 passed；前端相关10 passed；type-check通过；PRIV导出流式边界未实现 |
| ai-partner 入 CI | `frontend/` 下 `npm run -s test:ai-partner`；`node --test scripts/workflow-contracts.test.mjs` | 55 passed；CI 新增该步骤并由合同断言锁定；此前该套件不在 `npm test` 收集范围 |
| 共享进程守卫 | `python3 -I -B scripts/test_dev_processes.py -q` | 35 passed；所有查询、信号与等待为替身 |
| 本机真实验收 | `bash start-dev.sh` / `stop-dev.sh`；真实 dev 栈 | 通过：health 200 healthy、6608 200、DATABASE_URL→127.0.0.1:5433、浏览器登录页 0 error、停止/二次启动成功、容器 ID 未变 |
| 保存端点软校验 | `backend/` 下自含 `env -i`、`venv/bin/python -I -B -S tests/ai_agents/test_agent_endpoint_warning.py -q` | 19 passed；未导入正常 app/Settings |
| 出站端点硬校验 | `pytest tests/ai_agents/test_agent_chat_contract.py test_chat_stream.py ...` | 流式/阻塞/测试连接调用前统一硬校验；定向 61 + 32 passed；未连接真实上游，白名单外的私网端点会被拒绝 |
| 健康检查脱敏 | `pytest tests/test_health.py`；`check_python_governance.py check` | 9 passed；DEBUG=False 时 detail 只回固定文案，异常原文仅进日志；治理 errors=0 |
| 端点核对脚本 | `pytest tests/ai_agents/test_agent_endpoint_audit.py` | 5 passed；白名单/本机 Ollama/内网/元数据/非法协议分类与出站判定同源，未连数据库 |
| 网关字节合同 | `python3 -I -B gateway/tests/test_caddy_contract.py -q` | 38 passed；526385152B 覆盖后端502MiB；普通16MB、read_body30s保留 |
| Compose 真解析 | 5.6.0，临时 HOME/合成 env/复制的两份 Compose；checker local、docker 与实际 setup 函数 | 通过；只执行 config，无 daemon 操作 |
| Python 治理 | `python3 -I -B backend/scripts/check_python_governance.py check`，本轮含两份 Git 基线对比 | errors=0 / warnings=41；365文件、2158函数（修前2156）；未放宽 baseline |
| 迁移守卫 | `python3 -I -B backend/scripts/check_migration_guard.py` | 50文件通过，未运行迁移 |
| 版本一致性 | `node scripts/check-version-consistency.mjs` | 2.2.5 通过 |
| 文档门禁 | `node scripts/check-markdown-contracts.mjs` | 109 files / 702 links / 0 missing（新增PR首轮CI证据链接后；历史统计保留于原批次） |
| 脚本语法 / 差异 | 已改 shell 的 `bash -n`、Node `--check`、`git diff --check` | 通过 |

根合同首轮为133/134：仅文档派生链接数过期；更新当前统计后全量复验通过。后续增加容器CLI等合同后为151项，未删除失败断言刷绿。
真实 Compose 合成验证首轮因临时 HOME 缺插件发现失败；定向挂入本机既有插件后，同一合成输入的local/docker均通过，未更改用户Docker设置。
本机真实验收首轮被进程守卫拦下：macOS `LC_ALL=C` 解码中文 cwd 失败且无关桌面进程读取失败会整体中止。修复后真实桌面只读扫描通过，再启动/停止/二次启动均成功。

## 未验证与保留项

- **发布阻断仍保留**：PR首轮治理、前端及两项PythonLab门禁已通过，但后端1项测试替身签名续修仍待远端重跑；修订候选打包源码/前端产物、release-set及配对备份/隔离恢复未齐，不据此合并或部署。
- 干净安装另报告34项audit vulnerabilities（5 low/11 moderate/18 high）；尚未逐条复核影响或做自动升级。lint与bundle告警原样保留，不把门禁exit0表述为无安全问题。
- 历史未覆盖：Caddy 2.8.4 真适配/代理上传、WebKit/窄屏/登录后业务页、完整生产镜像及真实上游；生产只读健康核对不能替代业务验收。
- 原生显式上传目录保留；旧文件未搬迁、未证明自动恢复。进程身份核验非原子，PID复用竞态仍有边界；reload父消失且子残留时保守报错。
- D 类已完成代码与定向回归；PRIV 导出仍为内存组装，未实现游标/临时文件/64KiB 流式发送。B/C 类仍未实施，继续保留在台账。

发布行为与配置合同分别见[发布记录](../operations/RELEASE_NOTES.md)、[部署指南](../operations/DEPLOY.md)；本地通过不代表生产生效。
