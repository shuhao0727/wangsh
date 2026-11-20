# 2.2.12 Mac Docker 本地验收

> 状态：archived
> Owner：testing
> 记录日期：2026-11-20

在 `/Users/wsh/wangsh` 的 `main` 提交 `59a7992206f783a264f336e6b73f5626305e0765` 上准备独立源码副本。副本同步七个版本配置文件到 `2.2.12`，并带本地 Dockerfile 上传目录修复。主工作区当时已有的 `frontend/package-lock.json` 改动保留在原处。Docker Desktop 在 Apple Silicon 上运行，六张业务镜像均用 Compose 构建为 `linux/amd64`。

## 构建与运行

执行 `docker compose build`、`bash scripts/deploy.sh verify-local-images`。以下为本机 Docker Image ID。

| 镜像 | Image ID |
|---|---|
| `shuhao07/wangsh-backend:2.2.12` | `sha256:2fd57e79deea57465e200b54bee02019362a423b01b8eafcdeffe6a2664a44af` |
| `shuhao07/wangsh-typst-worker:2.2.12` | `sha256:fba4e8b5a942d0d470fd68b104c2887adb2428557374685a3cc5e680bec6aff9` |
| `shuhao07/wangsh-pythonlab-worker:2.2.12` | `sha256:d9e0d809f06943e1e54f8cc9154dd07d41109b5c1b1c3e2956c3c35db9b40fb9` |
| `shuhao07/pythonlab-sandbox:2.2.12` | `sha256:b8cf7f2c86547e29ddf8bf5137a7c781118a7e9e2435ff5c7dafc541a6d417c6` |
| `shuhao07/wangsh-frontend:2.2.12` | `sha256:d17c529b34c9660230cbcf7cf1b831dc351e3a7761e74fa27b01e323e52cfd19` |
| `shuhao07/wangsh-gateway:2.2.12` | `sha256:5c433bde4511815287ae44662a911c05a258dfe91f6f2a89993502ed59a7d47b` |

`wangsh_sim` 以 `docker compose up -d --no-build --pull never` 起七个服务。网关只绑定 `127.0.0.1:17608`，业务数据网为内部网络。实际空库为 `wangsh_2212_test`，Alembic head 为 `20261026_0001`，AUTH 在独立事务初始化后为 ready。健康响应报告 `2.2.12 healthy`，PostgreSQL 和 Redis 健康，两个 worker 健康。PythonLab 工作进程可写本次工作区，Docker socket 核对指向同一台本机 Docker Desktop。

## 行为验证

- 新上传卷初次挂载为 `root:root`，真实游戏 ZIP 上传返回 500，后端记录 `PermissionError`。修复镜像预建 `/app/uploads` 并由 appuser 持有后，重建后端和两个 worker。重新创建临时上传卷，实际所有权为 `1000:1000`。ZIP 上传、全文下载、Range 下载、日志和删除通过。
- 使用本机模型桩、合成账号和学习样例执行 `scripts/prod-smoke/run.sh`，**14/14 组通过**。实际只读扫查 **100/100**，按脚本规则跳过 75 项；管理员页面 **13/13**。覆盖认证、用户、文章、选课、点名、测评、讨论、学习内容/ML Book、Typst、PythonLab worker 与替换登录等。
- 补验 **7/7**，包括课堂同班作答与异班拒绝、测评关窗续答、保存的智能体连接测试和对话 SSE、KNN 四份答卷冻结和 CSV、游戏文件闭环、Pyodide 和独立静态入口、Typst 的异步成功及 PDF 导出。Chrome 另通过密码锁输入、AI 伙伴页面、任务分析访客守卫，以及管理员实际页面的版本标签、模型发现和任务分析保存、回读与渲染。AI 伙伴评分对环回模型桩返回安全拒绝，页面与榜单查询通过。

## PythonLab 浏览器

- 同一合成管理员串跑全站烟测后，Chrome 和 WebKit 首轮各 1/10 通过，其余被两个 `TERMINATING` 会话挡在清理阶段。worker 记录当前归属不匹配、无法确认停止。随后已无这两条会话元数据与运行中的沙箱。失败证据保留，需补同账号连续运行的回收确认。
- 两个独立合成账号复测调试、多断点连续 Continue 和 Reset 后重启。Chrome 与 WebKit 各 **3/3** 通过。两轮实际抽查 9 个动态容器，均使用目标沙箱镜像、`NetworkMode=none`，无宿主发布端口，工作区在本次专用目录。两轮均确认回收后的残留容器为 0。

## Docker 整理

按本轮归属移除 7 个容器、4 个专用卷、2 张网络和 3 个被重建替换的镜像对象。回收后隔离资源为零，六张最终候选镜像仍与上表一致。原有 7 个开发容器的 ID、镜像和启动时间复核一致。2.2.11 镜像为独立发布证据，继续保留。

## 记录与边界

本轮验证只涉及 Mac 的本地候选和合成数据。外部模型的真实评分、真实 GitHub 同步和服务器部署均无本轮实测。PythonLab 同账号连续运行的停止确认仍阻塞发布。

本地证据目录为 `test-results/wangsh-2212.9_7j2zj2/`。包含源版本与镜像记录、隔离配置校验结果、前后两轮烟测摘要和浏览器报告。早期调用烟测入口的 `--help` 时，脚本先重建了根目录下的默认报告目录，随后由目标保护拒绝执行。未取得该目录调用前的内容清单。正式验收使用独立目录并保留前后两轮记录。

## 回收修复复验

2026-11-20 在 `codex/pythonlab-session-cleanup` 的 `59a7992` 基线上修复。现场前两轮 DAP 结束后，自动停止任务已经完成容器核验，随后到达的显式停止更改了 Redis 中的请求编号，导致自动停止写回失败。下一轮启动切换归属记录后，后入队的停止任务无法确认旧记录，浏览器清理持续看到 `TERMINATING`。

- 回写以同一会话、所属账号、启动任务、沙箱令牌和容器 ID 为准，有界重试 CAS，保留最新停止请求编号。老任务的删除授权仍需匹配当前归属。已被后继取代的已发布旧容器按精确 ID 核对；后继资源不参与删除。
- 修复前同一问题 **3 个复现失败**。修复后隔离 coverage pytest **336 通过 / 8 警告**，迁移守卫与两次治理检查均通过。Mac Docker 的专用 PostgreSQL、Redis、Celery 下，两类竞态均通过，后继容器继续可用。同一账号连续三轮 DAP，继而 Chrome 和 WebKit 各 **2/2** 通过，最终会话索引和沙箱均为空。
- 本机 `2.2.12` 的 backend、Typst worker、PythonLab worker 已按同一源码补丁重建并更新。Typst worker 编译器启动检查为 0.14.2。复验证据目录 `test-results/pythonlab-cleanup.BrtFMC/`，最终 Image ID 清单 `final-candidates.json`。整理六个临时服务、四个专用卷、两张网络、三个验收别名和三个被替换的旧镜像对象。隔离资源残留为零。源码修复仍为本地分支改动。
