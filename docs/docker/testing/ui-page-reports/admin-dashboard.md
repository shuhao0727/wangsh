# UI 单页体检报告 - /admin/dashboard

> 状态：active
> Owner：testing

generated_at: 2026-10-05T07:39:58.529Z
evidence_level: L0
route: `/admin/dashboard`

> 本报告由 `scripts/ui-page-workflow.mjs` 自动生成（G3 重写）。
> `generated_at` 取自系统时钟，不接受覆写；`evidence_level` 由脚本实际采集到的证据决定。
> **本报告不包含浏览器证据**，任何视觉/交互/无障碍结论都必须由 L3/L4 报告补充。

## 结论

- **PASS**（静态口径）`ui-audit` 扫描完成，路由命中 0 处。evidence_ref: ui-audit:by_route:/admin/dashboard
- **BLOCKED(no_browser)** 本脚本无浏览器采集能力，**视觉/交互/无障碍结论一律不作数**；须由 L3/L4 报告另行验证。evidence_ref: ui-verify-gate:rule3

## counts

```json
{
  "counts": {
    "scanned_hits": 0,
    "scanned_files": 0,
    "human_confirmed": 0
  }
}
```

`scanned_hits` 为 `ui-audit` 机器扫描命中数；`human_confirmed` 需由复核者逐条确认后填写，
两者口径不同、不可互相替代（`ui-verify-gate` 规则6）。

### 路由热点文件（Top 10，机器扫描）

（暂无命中）

## manual_notes

人工判断一律写在此处，且逐条标注 `manual:true`。**未标注的条目视为未经确认**，
不得作为验收依据（`ui-verify-gate` 规则4）。

```json
{
  "manual_notes": []
}
```

填写示例（人工复核后追加）：

```json
{
  "manual_notes": [
    {
      "manual": true,
      "note": "1366×768 下头部留白偏紧",
      "by": "复核者",
      "at": "<ISO 时间>"
    }
  ]
}
```

## 自动检查明细

- `ui-audit` 路由命中：**0**　evidence_ref: ui-audit:by_route:/admin/dashboard
- `ui-audit` 命中文件数：**0**　evidence_ref: ui-audit:by_route:/admin/dashboard
- `npm run type-check`：**未执行**（如需请加 `--with-type-check`），本项无证据，不构成结论。
