#!/bin/bash
# 本地临时产物清理脚本
# 用途：回收 Playwright 会话转储、测试缓存等未跟踪产物占用的磁盘空间
# 安全约束：
#   1. 只删除已被 .gitignore 忽略、且不含任何跟踪文件的路径；不满足即跳过。
#   2. 不触碰 .codex/（agent 交接与 UI 证据目录，见归档文档的保留决定）。
#   3. 默认只预览，必须显式 --apply 才真正删除。

set -euo pipefail

apply=false
include_browser_artifacts=false
for arg in "$@"; do
  case "$arg" in
    --apply)
      apply=true
      ;;
    --include-browser-artifacts)
      include_browser_artifacts=true
      ;;
    -h|--help)
      cat <<EOF
用法: $0 [--apply] [--include-browser-artifacts]

默认只预览将删除的路径与占用空间，不做任何修改。
  --apply   实际执行删除
  --include-browser-artifacts   同时纳入浏览器转储；使用前先保留验收证据

清理范围（均为未跟踪、可重建产物）：
  根目录及 backend/ 的测试缓存、backend/.coverage
  backend/app、tests、scripts、alembic 和根 scripts/ 内的 Python 缓存
  浏览器转储默认保留；仅加 --include-browser-artifacts 时纳入

不进入：工作树、.codex、data、uploads、依赖、虚拟环境和构建目录；不跟随符号链接
EOF
      exit 0
      ;;
    *)
      echo "未知参数: $arg（用 --help 查看用法）" >&2
      exit 2
      ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

for required_command in awk du find git; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Error: 缺少必需命令: $required_command" >&2
    exit 2
  fi
done

# 固定清理目标（不在 find 覆盖范围内）
static_targets=(
  ".pytest_cache"
  ".ruff_cache"
  "__pycache__"
  "backend/.pytest_cache"
  "backend/.ruff_cache"
  "backend/__pycache__"
  "backend/.coverage"
)
if $include_browser_artifacts; then
  static_targets+=(".playwright-mcp" ".playwright-cli" "output/playwright")
fi

# 仅在明确的源码目录查找缓存；不从仓库根递归扫描。
cache_scopes=("backend/app" "backend/tests" "backend/scripts" "backend/alembic" "scripts")

# 安全校验：路径存在、被 git 忽略、且不含跟踪文件
is_safe_to_delete() {
  local path="$1"
  [ -e "$path" ] || return 1
  [ ! -L "$path" ] || return 1
  if ! git check-ignore -q "$path" 2>/dev/null; then
    echo "  跳过（未被 .gitignore 忽略）: $path" >&2
    return 1
  fi
  if [ -n "$(git ls-files -- "$path")" ]; then
    echo "  跳过（含跟踪文件）: $path" >&2
    return 1
  fi
  return 0
}

# 收集白名单源码目录内的缓存，不跨入依赖、数据或其他工作树。
matched_count=0
matched_kb=0

# 固定目标与缓存目录合并为 NUL 分隔流，兼容含空格路径，并避免 bash 3.2 空数组展开问题
while IFS= read -r -d '' path; do
  [ -e "$path" ] || continue
  if ! is_safe_to_delete "$path"; then
    continue
  fi

  size_kb="$(du -sk "$path" 2>/dev/null | awk '{print $1}')"
  size_kb="${size_kb:-0}"

  if $apply; then
    rm -rf "$path"
    echo "  已删除: $path (${size_kb}K)"
  else
    echo "  将删除: $path (${size_kb}K)"
  fi

  matched_count=$((matched_count + 1))
  matched_kb=$((matched_kb + size_kb))
done < <(
  printf '%s\0' "${static_targets[@]}"
  for scope in "${cache_scopes[@]}"; do
    [ -d "$scope" ] && [ ! -L "$scope" ] || continue
    find "$scope" \( -name node_modules -o -name .git -o -name .claude \
      -o -name .codex -o -name venv -o -name .venv -o -name data \
      -o -name uploads -o -name build -o -name dist -o -name coverage \) -prune -o \
      -type d \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache \) \
      -print0 -prune
  done
)

echo ""
if $apply; then
  echo "完成：删除 ${matched_count} 项，回收约 $((matched_kb / 1024)) MB"
else
  echo "预览：命中 ${matched_count} 项，可回收约 $((matched_kb / 1024)) MB"
  echo "加 --apply 实际执行。"
fi
echo "未处理 .codex/（agent 交接与 UI 证据目录）。"
