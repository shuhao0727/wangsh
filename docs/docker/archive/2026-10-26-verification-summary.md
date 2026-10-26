# 全量验证总结报告

> 状态：archived
> Owner：project-governance
> 最近复核：2026-10-26

> 日期：2026-10-26
> 范围：审计工作树 `beautiful-satoshi-b71479`（分支 `claude/affectionate-shirley-640fd1`）+ 主仓 `main`
> 方式：真实 Docker 服务、真实 PostgreSQL、真实 HTTP API、真实浏览器（Playwright chromium channel）+ 逐张人工看图
> 状态：**全部改动未提交**

## 一、结论速览

| 维度 | 结果 |
|---|---|
| 后端全量测试 | **3646 passed / 123 skipped / 0 failed** |
| 前端测试 | **103 文件 / 774 用例 全部通过** |
| TypeScript | `tsc --noEmit` 通过 |
| 前端构建 | 成功，echarts 分包 **584,082 B / 570.39 KiB**（全量版 1,035,150 B / 1010.89 KiB，省 **43.6%**） |
| Markdown 契约 | **10/10 通过**，142 文件 / 666 链接 / 0 缺失 |
| CI 测试变量 | 复现 **260 passed / 61 skipped**，真实点亮 **118** 个用例 |
| 验证截图 | **100+ 张**，全部落在 `/tmp/wangsh-ui/verify/` |

**共发现并修复 4 类真实缺陷，其中 2 个是本轮改动自己引入的回归。**

## 二、修复清单（本轮实际改动 6 个文件）

| 文件 | 改动 | 性质 |
|---|---|---|
| `frontend/src/lib/echarts.ts` | 补注册 `RadarChart` + `RadarComponent` + **`SVGRenderer`** | 修复自己引入的回归 +43 −1 |
| `frontend/src/pages/Informatics/Reader.tsx` | 截断提示移出 Tabs，固定到面板底部 | 修复自己引入的缺陷 +11 −0 |
| `backend/app/services/agents/llm_agent_base.py` | 删除 2 个无调用方死函数 | 遗留清理 +15 −104 |
| `backend/app/models/classroom/plan.py` | `activity_id` 补 `index=True` | 消除 metadata drift +1 −1 |
| `backend/alembic/versions/20261026_0001_*.py` | 修正 docstring 依据（新增文件） | 文档准确性 36 行 |
| `docs/docker/archive/2026-10-26-code-audit-report.md` | 审计报告（新增文件） | 交付物 220 行 |

## 三、两个自己引入又修复的回归

### 3.1 雷达图静默失效（两轮）

按需引入 ECharts 导致的**两次独立、均不报错**的失败：

| 轮次 | 缺失项 | 现象 | 检测方式 |
|---|---|---|---|
| 第一轮 | `RadarChart` / `RadarComponent` | 画布**完全空白**（SSR 输出 233 字节） | 隔离渲染对比 |
| 第二轮 | `SVGRenderer` | 图能画，但**整图全黑**（彩色像素 0%） | 真实组件 + 看图 |

**第二轮根因**：`RadarChart.tsx` 指定 `renderer:"svg"` 并把 `var(--ws-color-*)` 直接作为 fill/stroke 传入。SVG 的 CSS 属性由浏览器原生解析，能取到主题色；缺 `SVGRenderer` 时静默回落 Canvas，而 `ctx.fillStyle = "var(...)"` **不认 CSS 变量**，赋值失败一律变黑。

关键对照（同一真实组件，仅切换 `lib/echarts.ts` 版本，保留页面 CSS 变量）：

| 版本 | 实际渲染器 | 图形颜色 |
|---|---|---|
| HEAD 全量 echarts | `<svg>` | 青色 #0D9488 正常 |
| 按需（仅 CanvasRenderer） | `<canvas>` | **全黑**（彩色 0% / 暗色 12.86%） |
| 按需（+ SVGRenderer） | `<svg>` | 青色恢复正常 |

### 3.2 Reader 截断提示挂在错误的 Tab

提示被写进 `renderOutline()`（「目录大纲」Tab 内部），而 Reader 默认打开「文档列表」Tab，**用户永远看不到**。

修复后实测：默认 Tab 下 `notice=true`（修复前 `false`），两个 Tab 均可见。

## 四、验证方法论：三次「假通过」

本轮最有价值的产出不是修复，而是暴露了**验证方法本身的缺陷**。三个独立案例：

1. **雷达图误判**：只断言「非白像素 25.73%」就判定通过，没检查颜色值，漏掉了「图全黑」。
2. **索引基准误判**：基准表用 `LIKE ... INCLUDING ALL` 建，把真实索引一起继承过来，「无索引」组其实是假的无索引，对照结论完全无效。已重建纯结构表复测。
3. **StatisticsPage 误判**：只凭「19 处 var()、没指定 renderer」的代码推断，就声称它「可能是全黑」。实际截图确认**完全正常**。

> **规律：凡是静默失败的改动，必须实际渲染看效果；「元素存在」不等于「结果正确」。**

## 五、三个必须区分清楚的环境假象

验证过程中出现过 3 次大规模「失败」，全部是环境问题，不是代码缺陷：

| 现象 | 真实原因 |
|---|---|
| 8 个测试 FAIL | `TEST_DATABASE_URL` 指向 5433，触发测试内置的「拒绝受保护端口」守卫 |
| 132 个测试 FAIL | 55433 端口无监听、测试库不存在 |
| 多个页面 401 | 多 agent 并发用同一超管账号登录，互相踢下线 |

**合计 140 项，如果图省事就会被误报成代码缺陷。**

## 六、主仓复杂度修复的实测收益

| 项 | 修复前 | 修复后 | 倍数 |
|---|---|---|---|
| E1 工作簿逐格 O(n²) → 快照 | 305.32 s | 63.67 ms | **4,795×**（结果 sha256 完全一致） |
| E2 逐桶 COUNT → 单次 GROUP BY | 805 次查询 / 420.3 ms | 1 次 / 2.7 ms | **153×**（0 处不一致） |
| E4 逐行 guard → prefetch | 400 次查询 / 133 ms | 1 次 / 7 ms | **400×**（0 处不一致） |
| E5 导入上限 | 无上限 | >10MB 或 >5000 行 → 413 | 防护生效 |
| E6 批量 ID 上限 | 无限制 | 51 个 → 拒绝 | 防护生效 |

## 七、未验证 / 已知风险

| 项 | 状态 |
|---|---|
| 索引迁移已应用到线上库 | **否**。线上 `wangsh_db` 仍为 `alembic_version=20261020_0001`，部署时须执行 `alembic upgrade head` |
| 热点归类语义准确度 | **未验证**。LLM 上游是本地 mock，只验证了链路/投票/聚合/落库/缓存机制 |
| 生产数据支持教师提问假设 | **不成立**。生产库 271 条问题中教师提问为 0 条，归类体系缺少锚点 |
| 其余 6 个环境变量门控的 61 个用例 | **未在 CI 验证**。与本次改动无关，但同样从未执行过 |
| 其他懒加载模块（Monaco/Graphviz/Typst/PDF/Xterm） | **未排查**。与 ECharts 同属「按需注册静默降级」风险面 |

## 八、建议

1. **优先提交**，按阶段拆成独立提交；死代码删除与复杂度重构分开，便于回退。
2. CI 注释里「约 230 个用例」应改为 **118**（实测该变量真实点亮的数量）。
3. `StatisticsPage` 无缺陷，此前「可能全黑」的判断是错的，不要按缺陷处理。
4. 建议补一条前端检查：**渲染后断言 SVG/Canvas 的 fill/stroke 不含未解析的 `var(`**，可覆盖本轮两次雷达图失效。
5. 迁移部署前必须执行 `alembic upgrade head`，并确认索引 `ix_znt_classroom_plan_items_activity_id` 已建立。
