#!/bin/bash
# 详细健康检查脚本
# 用途：全面检查系统健康状态

set -euo pipefail

compose_file="${COMPOSE_FILE:-docker-compose.yml}"
api_url="${API_URL:-http://localhost:${WEB_PORT:-6608}}"
format="${1:-json}"
compose_args=(-f "$compose_file")

if [[ -n "${ENV_FILE:-}" ]]; then
  compose_args=(--env-file "$ENV_FILE" "${compose_args[@]}")
fi

required_commands=(awk cat curl date df docker sed)
if [[ "$OSTYPE" == "darwin"* ]]; then
  required_commands+=(vm_stat)
else
  required_commands+=(free)
fi
for required_command in "${required_commands[@]}"; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Error: required command not found: $required_command" >&2
    exit 2
  fi
done

timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
status="healthy"

check_api() {
  local response response_body http_status
  if ! response=$(
    curl --silent --show-error --connect-timeout 2 --max-time 5 \
      --write-out $'\n%{http_code}' "$api_url/api/health" 2>/dev/null
  ); then
    echo "failed"
    return
  fi

  http_status="${response##*$'\n'}"
  response_body="${response%$'\n'*}"
  if [[ ! "$http_status" =~ ^2[0-9][0-9]$ ]]; then
    echo "failed"
    return
  fi

  if printf '%s' "$response_body" |
    docker compose "${compose_args[@]}" exec -T backend python -c '
import json
import sys


class JSONObject(dict):
    def __init__(self, pairs):
        self.pairs = pairs
        super().__init__(pairs)


try:
    payload = json.load(sys.stdin, object_pairs_hook=JSONObject)
except (json.JSONDecodeError, UnicodeError):
    raise SystemExit(1)

status_count = sum(key == "status" for key, _ in payload.pairs) if isinstance(payload, JSONObject) else 0
raise SystemExit(
    0
    if isinstance(payload, JSONObject)
    and status_count == 1
    and payload.get("status") == "healthy"
    else 1
)
' >/dev/null 2>&1; then
    echo "ok"
  else
    echo "failed"
  fi
}

check_container() {
  local name="$1"
  local container_id state health
  container_id=$(docker compose "${compose_args[@]}" ps -q "$name" 2>/dev/null)
  if [[ -z "$container_id" ]]; then
    echo "failed"
    return
  fi

  state=$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)
  if [[ "$state" == "running" ]] && [[ "$health" == "healthy" ]]; then
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
frontend_status=$(check_container "frontend")
gateway_status=$(check_container "gateway")
typst_status=$(check_container "typst-worker")
pythonlab_status=$(check_container "pythonlab-worker")
disk_usage=$(check_disk)
memory_usage=$(check_memory)

if [[ "$api_status" != "ok" ]] ||
  [[ "$db_status" != "ok" ]] ||
  [[ "$redis_status" != "ok" ]] ||
  [[ "$frontend_status" != "ok" ]] ||
  [[ "$gateway_status" != "ok" ]] ||
  [[ "$typst_status" != "ok" ]] ||
  [[ "$pythonlab_status" != "ok" ]]; then
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
    "frontend": "$frontend_status",
    "gateway": "$gateway_status",
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
  Frontend: $frontend_status
  Gateway: $gateway_status
  Typst Worker: $typst_status
  PythonLab Worker: $pythonlab_status

Resources:
  Disk Usage: ${disk_usage}%
  Memory Usage: ${memory_usage}%
EOF
fi

[[ "$status" == "healthy" ]] && exit 0 || exit 1
