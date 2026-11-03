# 当前测试状态

> 状态：active
> Owner：testing
> 最近更新：2026-11-03

本页只维护最近验证；早期整理批次见[归档](../archive/README.md)，未结事项见[唯一台账](../plans/project-consolidation.md)。

## 基线与边界

- 目录 `/Users/wsh/wangsh`，分支 `codex/review-priority-fixes`，`3d05b08` 加原有整理及本轮修复；未提交、未发布，原 12 项暂存删除未变。
- 本轮含隔离合成回归与本机开发栈真实验收（2026-11-02）；未连接生产、未读取真实 env 明文、未迁移既有上传文件；验收后已停止本地进程，开发容器按默认保留。
- 历史 main 的后端全套、CRUD、HTTP 200、前端828例等不作为本分支的新验证；详细口径保留在原日期批次。

## 本轮结果

| 检查 | 命令 / 范围 | 结果 |
|---|---|---|
| 根层合同 | `node --test scripts/*.test.mjs`；临时仓库与 fake Docker/进程 | 151 passed / 0 failed |
| 阶段A代码复核 | 本批修复差异及直接调用方 | 无未解决 P1/P2；修复停止入口 Compose 选择器与 bash 3.2 空数组；2 项 P3 延迟记录 |
| 阶段C台账核验 | 24 行未结事项；当前源码/文档 | 完成分类：D 6、B 12、C 5；DIFY-02 核验为非缺陷关闭；A 类无待改代码项 |
| D类修复 | 后端定向 pytest + 前端 Vitest + type-check | 后端24 passed；前端相关10 passed；type-check通过；PRIV导出流式边界未实现 |
| 共享进程守卫 | `python3 -I -B scripts/test_dev_processes.py -q` | 35 passed；所有查询、信号与等待为替身 |
| 本机真实验收 | `bash start-dev.sh` / `stop-dev.sh`；真实 dev 栈 | 通过：health 200 healthy、6608 200、DATABASE_URL→127.0.0.1:5433、浏览器登录页 0 error、停止/二次启动成功、容器 ID 未变 |
| 保存端点软校验 | `backend/` 下自含 `env -i`、`venv/bin/python -I -B -S tests/ai_agents/test_agent_endpoint_warning.py -q` | 19 passed；未导入正常 app/Settings |
| 网关字节合同 | `python3 -I -B gateway/tests/test_caddy_contract.py -q` | 38 passed；526385152B 覆盖后端502MiB；普通16MB、read_body30s保留 |
| Compose 真解析 | 5.6.0，临时 HOME/合成 env/复制的两份 Compose；checker local、docker 与实际 setup 函数 | 通过；只执行 config，无 daemon 操作 |
| Python 治理 | `python3 -I -B backend/scripts/check_python_governance.py check` | errors=0 / warnings=41；365文件、2147函数；未放宽 baseline |
| 迁移守卫 | `python3 -I -B backend/scripts/check_migration_guard.py` | 50文件通过，未运行迁移 |
| 版本一致性 | `node scripts/check-version-consistency.mjs` | 2.2.4 通过 |
| 文档门禁 | `node scripts/check-markdown-contracts.mjs` | 109 files / 697 links / 0 missing（新增现行计划后） |
| 脚本语法 / 差异 | 已改 shell 的 `bash -n`、Node `--check`、`git diff --check` | 通过 |

根合同首轮为133/134：仅文档派生链接数过期；更新当前统计后全量复验通过。后续增加容器CLI等合同后为151项，未删除失败断言刷绿。
真实 Compose 合成验证首轮因临时 HOME 缺插件发现失败；定向挂入本机既有插件后，同一合成输入的local/docker均通过，未更改用户Docker设置。
本机真实验收首轮被进程守卫拦下：macOS `LC_ALL=C` 解码中文 cwd 失败且无关桌面进程读取失败会整体中止。修复后真实桌面只读扫描通过，再启动/停止/二次启动均成功。

## 未验证与保留项

- 未执行：Caddy 2.8.4 真适配/代理上传（按选择未拉取镜像）、WebKit/窄屏/登录后业务页、完整生产镜像、生产与远端 CI；真实 dev 启动/健康/停止见上表。
- 原生显式上传目录保留；旧文件未搬迁、未证明自动恢复。进程身份核验非原子，PID复用竞态仍有边界；reload父消失且子残留时保守报错。
- D 类已完成代码与定向回归；PRIV 导出仍为内存组装，未实现游标/临时文件/64KiB 流式发送。B/C 类仍未实施，继续保留在台账。

发布行为与配置合同分别见[发布记录](../operations/RELEASE_NOTES.md)、[部署指南](../operations/DEPLOY.md)；本地通过不代表生产生效。
