#!/bin/bash
# 部署验证脚本
# 用途：验证部署后所有服务是否正常运行

set -euo pipefail

compose_file="${COMPOSE_FILE:-docker-compose.yml}"
api_url="${API_URL:-http://localhost:8000}"
failed=0

check_mark="✓"
cross_mark="✗"

check_container() {
  local name="$1"
  if docker compose -f "$compose_file" ps "$name" 2>/dev/null | grep -q "Up"; then
    echo "$check_mark Container $name: running"
    return 0
  else
    echo "$cross_mark Container $name: not running" >&2
    return 1
  fi
}

check_port() {
  local port="$1"
  if nc -z localhost "$port" 2>/dev/null; then
    echo "$check_mark Port $port: accessible"
    return 0
  else
    echo "$cross_mark Port $port: not accessible" >&2
    return 1
  fi
}

check_api_health() {
  if curl -sf "$api_url/api/health" >/dev/null 2>&1; then
    echo "$check_mark API health: OK"
    return 0
  else
    echo "$cross_mark API health: FAILED" >&2
    return 1
  fi
}

echo "=== Deployment Verification ==="
echo ""

# Check containers
check_container "postgres" || ((failed++))
check_container "redis" || ((failed++))
check_container "backend" || ((failed++))

# Check ports
check_port 8000 || ((failed++))
check_port 5432 || ((failed++))
check_port 6379 || ((failed++))

# Check API health
check_api_health || ((failed++))

echo ""
if [ $failed -eq 0 ]; then
  echo "Deployment verification: PASSED"
  exit 0
else
  echo "Deployment verification: FAILED ($failed checks failed)"
  exit 1
fi
