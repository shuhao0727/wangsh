#!/bin/bash
# 详细健康检查脚本
# 用途：全面检查系统健康状态

set -euo pipefail

compose_file="${COMPOSE_FILE:-docker-compose.yml}"
api_url="${API_URL:-http://localhost:8000}"
format="${1:-json}"

timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
status="healthy"

check_api() {
  if curl -sf "$api_url/api/health" >/dev/null 2>&1; then
    echo "ok"
  else
    echo "failed"
  fi
}

check_container() {
  local name="$1"
  if docker compose -f "$compose_file" ps "$name" 2>/dev/null | grep -q "Up"; then
    echo "ok"
  else
    echo "failed"
  fi
}

check_disk() {
  df -h / | awk 'NR==2 {print $5}' | sed 's/%//'
}

check_memory() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    vm_stat | awk '/Pages active/ {active=$3} /Pages free/ {free=$3} END {printf "%.0f", (active/(active+free))*100}'
  else
    free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}'
  fi
}

api_status=$(check_api)
db_status=$(check_container "postgres")
redis_status=$(check_container "redis")
typst_status=$(check_container "typst-worker")
pythonlab_status=$(check_container "pythonlab-worker")
disk_usage=$(check_disk)
memory_usage=$(check_memory)

if [[ "$api_status" != "ok" ]] || [[ "$db_status" != "ok" ]] || [[ "$redis_status" != "ok" ]]; then
  status="unhealthy"
fi

if [[ "$format" == "json" ]]; then
  cat <<EOF
{
  "status": "$status",
  "timestamp": "$timestamp",
  "checks": {
    "api": "$api_status",
    "database": "$db_status",
    "redis": "$redis_status",
    "typst_worker": "$typst_status",
    "pythonlab_worker": "$pythonlab_status",
    "disk_usage": "${disk_usage}%",
    "memory_usage": "${memory_usage}%"
  }
}
EOF
else
  cat <<EOF
=== Health Check Report ===
Status: $status
Timestamp: $timestamp

Services:
  API: $api_status
  Database: $db_status
  Redis: $redis_status
  Typst Worker: $typst_status
  PythonLab Worker: $pythonlab_status

Resources:
  Disk Usage: ${disk_usage}%
  Memory Usage: ${memory_usage}%
EOF
fi

[[ "$status" == "healthy" ]] && exit 0 || exit 1
