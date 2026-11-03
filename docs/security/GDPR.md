# 隐私数据管理实现与边界

> 状态：reference
> Owner：backend
> 最近复核：2026-10-31
> 范围：2026-10-31 lucid 本地修正后的接口合同，尚未合入主仓库或发布；实例证据另见测试状态，未核准生产。

本文说明 WangSh 已实现的数据导出、删除和摘要能力，供开发者与管理员集成使用。
文件名保留 `GDPR.md` 以兼容现有入口；源码中出现 GDPR 名称、存在审计表或通过接口测试，
均不能单独证明项目已满足某项法规的全部要求。部署位置、处理依据、保留期限、未成年人授权、
通知渠道和责任人需要由实际运营方确认，不能由仓库文档中的占位信息代替。

## 接口与身份边界

默认 API 前缀为 `/api/v1`；如环境配置改变前缀，应以实际挂载和 OpenAPI 为准。
三个接口都使用 `get_current_user`，按当前登录用户 ID 查询或删除数据，不接受请求方指定其他用户。

| 方法 | 完整路径 | 当前行为 |
|---|---|---|
| GET | `/api/v1/users/privacy/me/export` | 返回用户基础信息、本人 AI 对话和本人小组讨论消息的 JSON |
| GET | `/api/v1/users/privacy/me/data-summary` | 返回上述两类消息的数量 |
| DELETE | `/api/v1/users/privacy/me/data` | 校验确认文本后，硬删除本人上述两类消息 |

> 挂载前缀核对：`backend/app/api/endpoints/management/users/__init__.py:13-14` 将
> `privacy_router` 以 `/privacy` 挂到 users router，`backend/app/api/__init__.py:36`
> 再以 `/users` 前缀注册，故完整路径为 `/api/v1/users/privacy/...`。

API 总入口与认证合同见 [API.md](../development/API.md) 和 [AUTH.md](../features/AUTH.md)。
实现位于 `backend/app/api/endpoints/management/users/privacy.py`。

## 导出与摘要范围

导出响应包含：

- `user_info`：当前用户的 ID、用户名、姓名、学号、邮箱、角色、班级、学年和启用状态。
- `conversations`、`conversations_count`：本人 `ZntConversation` 记录，包括已归档记录；每条保留会话、智能体、消息内容、时间与归档标记等字段。
- `discussion_messages`、`discussion_messages_count`：本人 `GroupDiscussionMessage` 记录及数量。
- `export_date` 和 `data_subject`：导出时间及说明。
- `data_scope` 和 `operation_id`：本次覆盖范围与关联审计标识。

摘要接口只统计这两类消息。当前导出不包含课堂互动、学习进度、测评结果、分析记录或其他业务域数据，
不能把导出文件解释为全项目的完整个人数据副本。

当前导出按时间、ID 倒序在内存组装本人两类消息；旧述的每批 100 条游标、1MiB 临时文件、64KiB 流式发送尚未实现，不得宣称具备该边界。摘要使用两条 SQL COUNT；删除以实际 DELETE rowcount 计数。

读取示例使用真实环境的 API 地址与当前用户凭证：

```bash
curl --fail-with-body "$WANGSH_API_BASE/api/v1/users/privacy/me/data-summary" \
  -H "Authorization: Bearer $WANGSH_ACCESS_TOKEN"

curl --fail-with-body "$WANGSH_API_BASE/api/v1/users/privacy/me/export" \
  -H "Authorization: Bearer $WANGSH_ACCESS_TOKEN" \
  -o my-data.json
```

`WANGSH_API_BASE` 是不带尾斜杠和 API 前缀的服务地址。导出文件含个人信息，应按实际数据管理制度保存。

## 删除合同

请求体中的 `confirmation` 必须完全等于 `DELETE MY DATA`，否则返回 `400`：

```json
{
  "confirmation": "DELETE MY DATA"
}
```

确认后，接口先记录删除请求审计，再在后续事务中删除当前用户的 AI 对话和小组讨论消息。
成功响应的 `deleted_items.conversations` 与 `deleted_items.discussion_messages` 对应这两类记录；
删除异常会回滚删除事务并返回 `500`。

此操作只硬删除两类本人消息，明确提示账号、课堂互动、学习进度、测评、分析结果及备份不在范围内。共享小组、成员、其他人的消息、已有分析和小组派生计数/缓存不在本次删除范围；不宣称全域删除或完整关联重算。

在集成删除功能时，应先展示实际两类消息的数量和硬删除含义，让用户明确确认，再发起请求。
本轮仅核对文档与源码，没有执行真实数据删除。

## 审计与同意管理

沿用 `sys_audit_logs`：`EXPORT_DATA_REQUESTED` / `DELETE_DATA_REQUESTED` 先提交，保留请求尝试；同次操作以 `resource_type=privacy_operation` 与相同 `resource_id` 关联。删除与 `DELETE_DATA_COMPLETED` 同事务提交，失败回滚并尽力写 `DELETE_DATA_FAILED`。导出完整文件准备后才写 `EXPORT_DATA_COMPLETED`，准备失败写 `EXPORT_DATA_FAILED`；导出完成只证明服务端文件准备完成，不能证明客户端完整接收。历史 `EXPORT_DATA` / `DELETE_DATA` 仍只代表旧请求尝试。审计故障不伪造完成，日志不记录消息内容或异常原文。

同意管理当前提供 `GET/PUT/DELETE /api/v1/users/privacy/me/consents`，支持 `AI_USAGE`、`DATA_ANALYSIS` 两类；写入/撤回记录 `CONSENT_GRANTED` / `CONSENT_WITHDRAWN` 审计，前端入口为 `/privacy`（登录用户菜单）。接口只记录同意意愿，不删除历史数据；**尚未在所有 AI 调用前强制校验同意，也没有同意版本文本字段**，不能宣称完整合规闭环。告知文本、运营地区、责任人、保留期限和撤回渠道仍由运营方确认（PRIV-04）。

审计记录包含当前用户、时间、真实连接来源和限长 User Agent；代理地址边界见 [AUTH](../features/AUTH.md)。审计保留期限仍由运营方制定。

## 迁移与验证

审计和同意表的迁移文件为
`backend/alembic/versions/2de7995a8f24_add_gdpr_compliance_tables.py`。
本次没有连接实际数据库，未核实该迁移在任一部署环境的应用状态。
迁移前检查、备份和回滚遵循 [部署指南](../operations/DEPLOY.md)，不把任意
`alembic downgrade -1` 作为本功能的通用回滚方案。

维护用例位于 `backend/tests/users/test_gdpr_compliance.py`，在 `backend/` 下运行：

```bash
pytest -q tests/users/test_gdpr_compliance.py
```

这组用例使用测试路由挂载与依赖替换，不足以证明生产挂载路径、真实数据库迁移、全域数据删除、
前端操作流程或法规合规性。实际执行结果和未覆盖场景统一记录到
[TEST_STATUS.md](../testing/TEST_STATUS.md)，本文不复制历史通过数量。

## 后续完善范围

后续工作由 [项目整理台账](../plans/project-consolidation.md#未结事项) 跟踪：

- 明确每个数据域的导出、删除、匿名化和备份保留策略，并核对关联与事务边界。
- 修正范围过宽的接口说明及响应文案，补充真实环境的隔离与失败回归。
- 明确同意记录的写入、撤回、告知内容、版本和前端入口。
- 由运营方确定部署地区、第三方模型数据流、责任人、联系渠道、保留期限与事件响应流程。

2026-10-01 的实施总结保留在 [归档索引](../archive/README.md)，仅用于追溯当时的实施声明。
对话生命周期和输入防护分别见 [DATA_ARCHIVING.md](../features/DATA_ARCHIVING.md) 与
[XSS_PROTECTION.md](XSS_PROTECTION.md)。
