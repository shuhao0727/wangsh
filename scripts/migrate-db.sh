#!/bin/bash
# 数据库迁移脚本
# 用途：管理 Alembic 数据库迁移

set -euo pipefail

cmd="${1:-}"
env_file="${ENV_FILE:-.env}"
compose_file="${COMPOSE_FILE:-docker-compose.yml}"

check_backend_container() {
  if ! docker compose -f "$compose_file" ps backend 2>/dev/null | grep -q "Up"; then
    echo "Error: backend container is not running" >&2
    exit 1
  fi
}

case "$cmd" in
  upgrade)
    check_backend_container
    revision="${2:-head}"
    echo "Upgrading database to: $revision"
    docker compose -f "$compose_file" exec backend alembic upgrade "$revision"
    echo "✓ Migration completed"
    ;;

  current)
    check_backend_container
    docker compose -f "$compose_file" exec backend alembic current
    ;;

  history)
    check_backend_container
    docker compose -f "$compose_file" exec backend alembic history
    ;;

  heads)
    check_backend_container
    docker compose -f "$compose_file" exec backend alembic heads
    ;;

  *)
    cat <<EOF
Usage: $0 <command> [options]

Commands:
  upgrade [revision]  Upgrade to revision (default: head)
  current             Show current revision
  history             Show migration history
  heads               Show head revisions

Examples:
  $0 upgrade          # Upgrade to latest
  $0 upgrade abc123   # Upgrade to specific revision
  $0 current          # Show current version
  $0 history          # Show all migrations

Environment:
  ENV_FILE            Path to .env file (default: .env)
  COMPOSE_FILE        Path to docker-compose file (default: docker-compose.yml)
EOF
    exit 1
    ;;
esac
