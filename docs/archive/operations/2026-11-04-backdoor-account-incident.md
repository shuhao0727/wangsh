# 服务器后门账号事件处置记录（2026-11-04）

> 状态：archived
> Owner：release-ops + 安全责任人
> 处置日期：2026-11-04
> 范围：`192.168.5.3`（shuhao-Virtual-Machine）宿主系统层；不涉及应用数据

## 一、结论

确认这台服务器在 **2026-05-18** 遭入侵并植入后门，**2026-10-26 有一次成功的远程登录**。
主体 rootkit 曾被更早的会话隔离，但**账号与持久化项遗留未清**。本次六项持久化已全部清除；
服务可用性未受影响，**应用数据保密性与完整性未验证（见第七节）**。

## 二、证据链

### 2.1 植入时间线（2026-05-18 13:57，集中在 23 秒内）

| 时间 | 对象 | 内容 |
|---|---|---|
| 13:57:29 | `/etc/systemd/system/log.service` | `ExecStart=/usr/bin/log -sshd`，`User=root`，`Restart=always` |
| 13:57:44 | `/etc/passwd` `/etc/shadow` `/etc/group` | 创建账号 `systemd`（uid 1001，`/bin/bash`） |
| 13:57:44 | `/etc/sudoers` | 追加 `systemd ALL=(ALL) NOPASSWD:ALL` |
| 13:57:44 | `/var/spool/cron/crontabs/root` | 追加 `@reboot /var/log/log > /dev/null 2>&1 & disown` |
| 13:57:45 | `sshdd.so` | LD_PRELOAD 劫持库，22623 字节 |
| 13:57:52 | `log` | 9438680 字节，ELF stripped |

crontab 文件头部保留安装记录：`# (/tmp/crontab_edit.txt installed on Mon May 18 13:57:44 2026)`。

### 2.2 工具性质

- **`log`**：字符串中包含 `xmrig-cuda`、`libOpenCL.so`、`libnvidia-ml.so`、
  `--cuda-loader=PATH`、`--opencl-loader=PATH`，判定为 **XMRig 门罗币挖矿程序**。
- **`sshdd.so`**：导出 `fopen`、`fread` 等符号，替换 libc 调用，字符串指向
  `/usr/local/lib/sshdd.so`，是典型的 **LD_PRELOAD 隐藏型 rootkit**（隐藏进程/文件/连接）。
- 原 `/etc/ld.so.preload` 内容为单行 `/usr/local/lib/sshdd.so`，即全系统加载该劫持库。

### 2.3 成功入侵记录

```
2026-10-26T07:12:01  sshd[1715816]: Accepted password for systemd from 77.239.124.120 port 35788 ssh2
2026-10-26T07:12:01  pam_unix(sshd:session): session opened for user systemd(uid=1001)
2026-10-26T07:12:05  pam_unix(sshd:session): session closed for user systemd
```

同一 IP 在 07:07–07:12 依次尝试 `root`、`bin`、`user` 均失败，随后以 `systemd` 登录成功。
会话持续约 4 秒。**这是认证通过的记录，不是失败尝试。**

`systemd` 账号在被删除前的状态：密码字段前缀 `$y$`（yescrypt），未被锁定，
未设置过期日期，sshd 无 `AllowUsers`/`DenyUsers` 限制——即**处置前仍可远程登录**。

### 2.4 更早会话的隔离（不完整）

`/root/codex-quarantine-20260522100013/` 由更早会话于 2026-05-22 建立，已隔离：

- `ld.so.preload`、`sshdd.so`、`log`
- `_etc_ld.so.preload.disabled`、`_usr_local_lib_sshdd.so.disabled`、`_var_log_log.disabled`

处置前复核确认系统层已无活跃感染：`/etc/ld.so.preload`、`/var/log/log`、
`/usr/local/lib/sshdd.so` 均不存在，无进程加载 `sshdd.so`。

**但遗漏了四项**：后门账号、sudoers 行、root crontab、log.service。
`log.service` 还被施加了 **immutable 属性**（`lsattr` 显示 `----i----`），
这是攻击者的自我保护——连 root 都无法直接删除，也解释了为何更早的清理没动它。

## 三、处置动作

全部动作限定在上述四项，未触碰业务服务、容器、数据与其他配置。

| 步骤 | 动作 | 结果 |
|---|---|---|
| 1 | 证据归档到 `/root/security-remediation-20261104/`（0700） | 15 项，含 passwd/shadow/group/sudoers/log.service 副本、crontab 原始内容、登录日志、家目录 tar |
| 2 | 从 `/etc/sudoers` 删除 NOPASSWD 行 | `visudo -c` 校验通过 |
| 3 | `usermod -L -s /usr/sbin/nologin` 后 `userdel systemd` | 账号已删除，`id 1001` 报"无此用户" |
| 4 | 清空 root crontab 的 `@reboot` 行 | crontab 现为空 |
| 5 | 通过 ioctl `FS_IOC_SETFLAGS` 清除 immutable 后删除 unit | `systemctl is-enabled` 返回 `not-found` |
| 6 | 移走 `/home/systemd`（252K）到证据目录 | 已移出 `/home` |
| 7 | 归档并移除 `/home/shuhao/桌面/.env` | 见下节 |

**关于 chattr**：宿主上 `chattr` 命令缺失（`lsattr` 存在），因此改用 Python 直接调用
文件标志位 ioctl 完成清除。同一个 e2fsprogs 包中两个工具一有一无，本身值得记录。

### 3.1 桌面 `.env` 的处置（原 SEC-02）

`/home/shuhao/桌面/.env` 是 50558 字节、权限 `664`（同组及其他用户可读）的文件。
经键名与该文件在两份 Dify 配置间的比对确认：**它是旧版 Dify 配置的副本**，
不是 WangSh 配置——73 个含密键中有 72 个与 `/home/shuhao/dify/docker/.env` 完全一致，
与当前运行的 `dify-releases/1.18.0-clean-20261027/docker/.env` 只有 5 个相同。

处置：先确认无进程引用，复制归档到证据目录并收紧为 `600 root:root`，随后移除桌面副本。
桌面目录现已为空。归档文件为 `desktop-dotenv-old-dify-copy.env`，
sha256 前 20 位 `f051cda0ae32ca770b31`。

**注意**：该文件含 Dify 的数据库、Redis、Weaviate、插件等历史凭据。
是否需要轮换这些凭据、以及它们与当前运行配置的差异是否意味着凭据已在环境中扩散，
超出本次处置范围，建议由 Dify 侧责任人评估。

## 四、清除后复验

| 检查项 | 结果 |
|---|---|
| `getent passwd systemd` | 无输出（已删除） |
| `id 1001` | 无此用户 |
| `/etc/sudoers` 中的 NOPASSWD 行 | 已移除，语法校验通过 |
| root crontab 有效行 | 0 条 |
| `/etc/systemd/system/log.service` | 文件不存在，`is-enabled` = `not-found` |
| `/home/systemd` | 已移走 |
| 全路径 immutable 文件扫描（`/etc` `/root` `/var/spool/cron`） | 无 |
| 可登录 shell 账号 | 仅 `root`、`shuhao`（另有 `sync` 属系统标准） |
| uid 0 账号 | 仅 `root` |
| `/root/.ssh/authorized_keys` | 0 条 |
| 挖矿残留（`/var/log/log`、`/usr/local/lib/sshdd.so`、`/usr/bin/log`） | 均不存在 |
| 桌面 `.env` | 已归档并移除，桌面目录为空 |
| 证据目录属主 | 全部 `root:root`，目录 `700` |

## 五、生产影响评估

**服务可用性未受影响**（数据保密性未验证，见第七节）。清除前后逐一核对：

- 八个 `wangsh` 容器全部 healthy，`/api/health` 返回 `2.2.8 / healthy`，DB 与 Redis 均 healthy。
- 三个 compose 项目容器数不变：`wangsh` 8、`docker` 15、`education-policy` 1。
- 监听端口无变化：22、6606、6608、本机 631/8817/53。
- `/var/run/docker.sock` 属主权限正常（`root:docker 660`）。
- 移除宿主 uid 1001 不影响容器：Dify 容器内部有独立的 `dify` 用户（uid 1001），
  使用的是镜像内 `/etc/passwd` 与独立命名空间，与宿主账号无关；实测 `docker exec docker-api-1 id`
  仍正常返回 `uid=1001(dify)`。

## 六、遗留风险与建议

1. **入侵入口未确定**。10-26 的攻击者用**密码**登录成功，说明当时该账号密码已知。
   该密码强度与来源无法从现有日志判定。5-18 的初始植入路径同样未确定
   （可能是 SSH 弱口令、也可能是其他渠道）。
2. **SSH 密码认证当前仍开启**（`passwordauthentication yes`，`permitrootlogin without-password`）。
   日志中有大量来自多个 IP 的爆破尝试。建议评估改为仅密钥登录。
3. **`/root/security-remediation-20261104/` 与 `/root/codex-quarantine-20260522100013/`
   保留为证据**，未删除。其中含恶意样本，权限已收紧（0700/0600）。
   如需彻底清除，建议先确认无进一步取证需求。
4. **建议后续核查**：与这台主机共享过凭据的其他系统是否需要轮换；以及
   是否需要对全盘做一次完整性校验（当前仅核查了常见持久化位置）。
5. 本次未做**主机重装**级处置。若判定需要彻底重建，应另行评估。
6. **2026-11-05 用户决定（风险接受）**：不轮换 root/shuhao 密码与 Dify 历史凭据；
   SSH 密码认证保持开启；不做主机重装级处置。本记录如实保存该决定与上述遗留事实，
   留待后续审计追溯，不表示风险已消除。

## 七、未覆盖

- 未做全盘恶意文件扫描（仅核查了持久化机制、账号、SUID、监听端口、PAM、shell rc 等常见位置）。
- 未回溯 5-18 之前的日志（当前 `/var/log/auth.log` 归档仅保留到 4 个轮转文件）。
- 未分析 `log` 与 `sshdd.so` 的完整行为（仅做字符串与符号层面判断）。
- 未验证攻击者是否已窃取应用数据或数据库内容。

## 八、后续垃圾清理与旧卷删除（同日）

在事件处置之后又做了一轮主机清理，证据保存在同一目录下：

- **清理**：`/tmp` 一次性产物（`cmp-cur`、`main-current.tgz`、`dify-knn-resources`、
  `verify-221`、`ai_partner_evaluation.py.new/.bak`、`weekly-school-plan.json`、
  8 个 `log-redactor` 目录）与孤立的 `~/.vscode-server/bin/6928394f…`，合计约 515MB。
- **删除三个无引用的数据库旧卷**（经用户确认）：`wangsh_postgres_data`(111M)、
  匿名卷 `4a4e943e…`(110M)、`wangsh_redis_data`(45M)。删前记录每个卷的文件数、
  字节数、时间边界、`PG_VERSION` 与文件清单 sha256 到
  `deletion-20261104/deletion-metadata.json`。三者均无容器引用，
  且未被当前 compose 声明（当前仅声明 `typst_pdfs`、`uploads_data`）。
- **`/tmp/weekly-school-archive-before.sqlite`**：只读核对确认其为运维操作前的副本
  （106 条 records），活库 `/home/shuhao/education-policy-archive/data/archive.sqlite`
  由运行中的 `education-policy-archive` 容器使用且记录更多（139 条），
  **活库未受影响**。副本删除前已在证据目录保留一份。
- 结果：磁盘 69G→50G（本日累计释放约 19G），`docker system df` 的
  `Local Volumes` 由 315MB 降至 37.7MB。生产八容器 healthy、`/api/health` 2.2.8、
  十条红线复验 `ALL_PASS`。

**说明**：`~/.vscode-server` 剩余的当前版本、`snap`、`journal` 与
`dify-releases` 均属在用或自动管理，未做处理。
