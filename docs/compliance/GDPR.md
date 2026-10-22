# 隐私数据管理实现与边界

> 状态：reference
> Owner：backend
> 最近复核：2026-10-19
> 范围：当前源码的隐私数据接口、审计记录和未覆盖事项；未连接生产数据库或重新执行端到端验证。

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

摘要接口只统计这两类消息。当前导出不包含课堂互动、学习进度、测评结果、分析记录或其他业务域数据，
不能把导出文件解释为全项目的完整个人数据副本。

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

此操作对上述消息执行硬删除。当前不会删除账号、课堂互动、学习进度、测评记录、分析结果或备份，
也没有实现这些数据中的个人标识匿名化。源码中的成功文案“所有数据已永久删除”范围过宽，
集成端应按 `deleted_items` 和本文范围理解；响应文案与覆盖范围的后续修正见
[当前整理台账](../docker/plans/project-consolidation.md#未解决与待复核事项)。

在集成删除功能时，应先展示实际两类消息的数量和硬删除含义，让用户明确确认，再发起请求。
本轮仅核对文档与源码，没有执行真实数据删除。

## 审计与同意管理

`sys_audit_logs` 记录 `EXPORT_DATA` 和 `DELETE_DATA`，包含当前用户、资源、时间、
`request.client.host` 提供的地址以及请求中的 User Agent。代理环境下地址的含义以
[认证与代理边界](../features/AUTH.md) 为准。

审计写入与后续读取或删除分开提交。因此，存在审计记录只能说明请求已经到达记录阶段，
不能单独证明导出已交付或删除已完成。保留期限需要运营方制定；当前文档不再把“永久保留”写成已确认的法律要求。

仓库存在 `sys_user_consents` 模型及创建迁移，但本次源码核对未发现同意写入、撤回接口或对应前端自助流程。
不能把表结构存在解释为已完成用户同意管理，也不能宣称 AI 调用前已有完整告知与授权闭环。

## 迁移与验证

审计和同意表的迁移文件为
`backend/alembic/versions/2de7995a8f24_add_gdpr_compliance_tables.py`。
本次没有连接实际数据库，未核实该迁移在任一部署环境的应用状态。
迁移前检查、备份和回滚遵循 [部署指南](../docker/deploy/DEPLOY.md)，不把任意
`alembic downgrade -1` 作为本功能的通用回滚方案。

维护用例位于 `backend/tests/users/test_gdpr_compliance.py`，在 `backend/` 下运行：

```bash
pytest -q tests/users/test_gdpr_compliance.py
```

这组用例使用测试路由挂载与依赖替换，不足以证明生产挂载路径、真实数据库迁移、全域数据删除、
前端操作流程或法规合规性。实际执行结果和未覆盖场景统一记录到
[TEST_STATUS.md](../docker/testing/TEST_STATUS.md)，本文不复制历史通过数量。

## 后续完善范围

后续工作由 [项目整理台账](../docker/plans/project-consolidation.md#未解决与待复核事项) 跟踪：

- 明确每个数据域的导出、删除、匿名化和备份保留策略，并核对关联与事务边界。
- 修正范围过宽的接口说明及响应文案，补充真实环境的隔离与失败回归。
- 明确同意记录的写入、撤回、告知内容、版本和前端入口。
- 由运营方确定部署地区、第三方模型数据流、责任人、联系渠道、保留期限与事件响应流程。

2026-10-01 的实施总结保留在 [归档索引](../docker/archive/README.md)，仅用于追溯当时的实施声明。
对话生命周期和输入防护分别见 [DATA_ARCHIVING.md](../features/DATA_ARCHIVING.md) 与
[XSS_PROTECTION.md](../security/XSS_PROTECTION.md)。
