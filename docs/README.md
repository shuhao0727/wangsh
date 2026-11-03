# 项目文档索引

按任务选择入口。文档归属和整理规则见 [DOCUMENTATION_RULES.md](DOCUMENTATION_RULES.md)；
历史记录只证明对应日期与环境，不代表当前版本已验收。

## 目录框架

| 目录 | 保存内容 |
|---|---|
| `features/` | 功能、权限与业务约定 |
| `development/` | API、工程质量、数据库性能 |
| [operations/](operations/README.md) | 部署、CI、监控与近期发布 |
| [testing/](testing/README.md) | 验证方法、当前测试摘要 |
| [ui/](ui/README.md) | 界面规范、页面清单与进度 |
| [plans/](plans/README.md) | 当前计划和统一未结台账 |
| `security/` | 安全与隐私功能边界 |
| [archive/](archive/README.md) | 归档入口；正文已于 2026-11-01 清理 |

根 `README.md` 负责上手，`CLAUDE.md` 负责协作规则，本页负责导航。
模块测试、脚本与样式说明留在源码旁；开发先看下方工作入口，仅在追溯时进入归档。

## 工作入口

| 要做的事 | 文档 |
|---|---|
| 启动与项目结构 | [根 README](../README.md) |
| Agent 协作 | [CLAUDE.md](../CLAUDE.md) |
| 工程质量与性能 | [工程治理](development/ENGINEERING_GOVERNANCE.md)、[数据库性能](development/DATABASE_PERFORMANCE_GUIDE.md) |
| API 开发 | [API 合同](development/API.md) |
| 部署、配置、回滚 | [DEPLOY.md](operations/DEPLOY.md) |
| CI/CD | [CICD.md](operations/CICD.md) |
| 整理与待办 | [统一整理台账](plans/project-consolidation.md)、[计划索引](plans/README.md) |
| 验证结果 | [TEST_STATUS.md](testing/TEST_STATUS.md) |
| 发布与历史追溯 | [发布记录](operations/RELEASE_NOTES.md)、[归档索引](archive/README.md) |
| 本次累计变更 | [修改总表与逐文件索引](reviews/2026-11-02-change-inventory.md) |

## 功能合同

| 模块 | 文档 |
|---|---|
| 认证与权限 | [AUTH.md](features/AUTH.md) |
| AI 智能体与分析 | [AI_AGENTS.md](features/AI_AGENTS.md) |
| 课堂互动 | [CLASSROOM.md](features/CLASSROOM.md) |
| 测评与画像 | [ASSESSMENT.md](features/ASSESSMENT.md) |
| PythonLab | [PYTHONLAB.md](features/PYTHONLAB.md) |
| 信息学笔记 | [INFORMATICS.md](features/INFORMATICS.md) |
| 学习平台与书籍 | [LEARNING.md](features/LEARNING.md)、[ML_BOOK.md](features/ML_BOOK.md) |
| 校本课选课 | [XBK.md](features/XBK.md) |
| KNN 采集 | [KNN_SURVEY.md](features/KNN_SURVEY.md) |
| 点名 | [DIANMING.md](features/DIANMING.md) |
| 文章与游戏 | [ARTICLES.md](features/ARTICLES.md)、[IT_GAMES.md](features/IT_GAMES.md) |
| 实时刷新 | [AUTO_REFRESH.md](features/AUTO_REFRESH.md) |
| 数据归档 | [DATA_ARCHIVING.md](features/DATA_ARCHIVING.md) |

测评分析提示词：[热点归类](features/assessment/hot_agent.md)、[问题链诊断](features/assessment/chain_agent.md)。

## 前端与安全

- 视觉：[嵌入式规范](ui/EMBEDDED_UI_STYLE_GUIDE.md)、[页面进度](ui/UI_REDESIGN_ROADMAP.md)、[无障碍](ui/ACCESSIBILITY_GUIDE.md)。
- 样式与角色：[颜色规范](../frontend/src/styles/COLORS.md)、[角色矩阵](../frontend/src/styles/ROLES.md)。
- 安全与隐私：[XSS 防护](security/XSS_PROTECTION.md)、[隐私功能边界](security/GDPR.md)。

## 测试与脚本

| 范围 | 入口 |
|---|---|
| 后端测试 | [backend/tests/README.md](../backend/tests/README.md) |
| 后端维护 | [backend/scripts/README.md](../backend/scripts/README.md) |
| 前端检查 | [frontend/scripts/README.md](../frontend/scripts/README.md) |
| 根层运维 | [scripts/README.md](../scripts/README.md) |
| XBK 专项 | [scripts/xbk/README.md](../scripts/xbk/README.md) |
| 历史脚本 | 退出记录（正文已清理） |

验证方法见[测试入口](testing/README.md)；监控见[运维入口](operations/README.md)。
