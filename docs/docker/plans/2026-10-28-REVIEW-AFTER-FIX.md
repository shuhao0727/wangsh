# 2.2.1 修复后审查结论

> 状态：active
> Owner：project-governance
> 审查日期：2026-10-28
> 审查方式：主控逐条核实，不采信 Agent 转述

---

## 一、Agent 发现的三个问题 —— 全部核实成立

| # | 问题 | 核实结果 | 是否影响 2.2.1 |
|---|---|---|---|
| 1 | **路径穿越可绕过白名单** | ✅ 成立。`/v1/../../admin` 字符串前缀匹配成功，但 httpx 归一化后会逃出前缀。实测六种变体（点段/`%2e`/大写`%2E`/反斜杠/单点/正常）全部正确处理 | 否，已修 |
| 2 | **`alignSelf: start` 必需** | ✅ 成立。CSS Grid 默认 `align-items: stretch` 会把子项拉满行高，`maxHeight` 只夹住盒子、内部列表仍被压缩不产生滚动 | 否，已修 |
| 3 | **xlsx `read_only` 惰性读取** | ✅ 成立。但实测**所有截断程度都在 `load_workbook` 阶段抛 `BadZipFile`**，迭代中途报错的场景很难触发 | 否，已加防御 |

**结论：三条都是真问题，Agent 的加固都正确。**

---

## 二、主控审查新发现的问题

### P1：`ParseError` 未被捕获，仍会返回 500

**位置**：`backend/app/api/endpoints/management/users/import_service.py`

```python
XLSX_PARSE_ERRORS = (zipfile.BadZipFile, InvalidFileException, OSError, KeyError, ValueError)
```

**问题**：zip 结构完整但内部 XML 损坏的 xlsx，`load_workbook` 抛的是 `xml.etree.ElementTree.ParseError`，**不在捕获列表里**。

**实测证据**：

```
坏 XML 大小: 4527
load_workbook 抛: ParseError unclosed token: line 1, column 11

ParseError 是 ValueError 子类: False
ParseError 是 OSError 子类: False
ParseError 是否被捕获: False
```

**影响**：构造一个 zip 容器正常、但 `xl/worksheets/sheet1.xml` 是坏 XML 的文件，仍会返回 **500** 而非 400。比截断文件更隐蔽（截断在 `BadZipFile` 阶段就拦住了）。

**修复**：把 `ParseError` 加入 `XLSX_PARSE_ERRORS`。

**是否影响 2.2.1**：是。本版目标就是「畸形文件返回 400」，这条漏了等于修复不完整。

---

### P2：`row_generator` 里的 400 会被降级成行级 error

**位置**：`_process_import_rows` 的 `except Exception as exc`

**问题**：`HTTPException` 是 `Exception` 子类（已实测 `issubclass(HTTPException, Exception)` 为 `True`），所以 `row_generator` 抛的 400 会被这里捕获，变成**行级 error**，返回 200 + `error_count`。

**实际影响**：**很小**。因为实测所有截断都在 `load_workbook` 阶段就失败了，走不到迭代中途。这属于「防御性代码的行为与意图不完全一致」，不是现实缺陷。

**是否影响 2.2.1**：否。记录待办即可。

---

### P3：`fakeredis` / `lupa` 不在 `requirements-dev.txt`

**核实结果**：确实不在。但——

```python
if os.environ.get("AI_PARTNER_ISOLATED_TESTS") != "1":
    pytest.skip("Requires pre-collection isolated bootstrap", allow_module_level=True)

import fakeredis.aioredis   # ← 在 skip 之后
```

`pytest.skip(allow_module_level=True)` 在导入前执行，**CI 里这个模块整体跳过，不会真的 import fakeredis**。

**结论**：**不影响 CI**，只影响本地想跑这个测试的人。

**建议**：补进 `requirements-dev.txt`（低成本改进），标注「仅 AI_PARTNER_ISOLATED_TESTS=1 时需要」。

---

### P4：`docs/features/ASSESSMENT.md:74` 的 head 过期

**核实结果**：

```
文档写的：当前 head 为 20261020_0001（全仓唯一 head）
实际是：  20261026_0001 (head)
```

**影响**：文档错误，会误导排查迁移问题的人。

**是否影响 2.2.1**：建议在本版一并订正（1 行改动）。

---

### P5：GitHub Release v2.2.0 不存在

**核实结果**：

```
$ gh release list
v2.1.8 — KNN HTTP 提交修复  Latest  2026-10-22
v2.1.7                      2026-10-22
v2.1.6                      2026-10-20
```

**v2.2.0 只有 git tag，没有 Release 页。** 从 1.5.x 到 2.1.8 都有，2.2.0 断了。

**影响**：发版记录断代。2.2.1 发布时会连 2.2.0 一起补，还是只发 2.2.1？

**需要用户决定。**

---

## 三、修复建议

### 必须在 2.2.1 补的

| # | 项 | 改动量 |
|---|---|---|
| 1 | `ParseError` 加入 `XLSX_PARSE_ERRORS` | 1 行 |
| 2 | `ASSESSMENT.md:74` head 订正 | 1 行 |

### 建议补但不阻断

| # | 项 | 理由 |
|---|---|---|
| 3 | `fakeredis` / `lupa` 补进 `requirements-dev.txt` | 本地跑测试的便利性 |
| 4 | `row_generator` 的异常语义（区分 400 与行级 error） | 防御代码与意图不一致 |

### 需要用户决定

| # | 项 |
|---|---|
| 5 | GitHub Release v2.2.0 是否补建？还是 2.2.1 发布时一并说明？ |

---

## 四、审查方法说明

本次审查不采信 Agent 的报告结论，全部独立验证：

- 路径穿越：实测 6 种变体
- `alignSelf`：读代码 + CSS Grid 规范推理
- `read_only` 惰性：构造 3 种截断（70%/95%/99%）+ 1 种坏 XML，逐一测试失败时机
- `ParseError`：`issubclass` 实测
- 依赖缺失：读 `requirements-dev.txt` + 检查 skip 机制的实际执行顺序
- head 过期：`alembic heads` 实测
- Release 缺失：`gh release list` 实测
