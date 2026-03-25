#!/bin/bash
# 数据库回滚脚本
# 用途：回滚 Alembic 数据库迁移

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

confirm_rollback() {
  read -p "⚠️  Confirm rollback? This will modify the database. (yes/no): " answer
  [[ "$answer" == "yes" ]]
}

backup_db() {
  echo "Creating backup before rollback..."
  if [ -f "./scripts/deploy.sh" ]; then
    ./scripts/deploy.sh backup-db
  else
    echo "Warning: deploy.sh not found, skipping backup"
  fi
}

case "$cmd" in
  rollback)
    check_backend_container
    revision="${2:--1}"

    if ! confirm_rollback; then
      echo "Rollback cancelled"
      exit 0
    fi

    # Check if --backup flag is present
    if [[ "${3:-}" == "--backup" ]] || [[ "${2:-}" == "--backup" ]]; then
      backup_db
    fi

    echo "Rolling back to: $revision"
    docker compose -f "$compose_file" exec backend alembic downgrade "$revision"
    echo "✓ Rollback completed"
    ;;

  *)
    cat <<EOF
Usage: $0 rollback [revision] [--backup]

Commands:
  rollback [-1]       Rollback one version
  rollback <rev>      Rollback to specific revision
  rollback --backup   Backup before rollback

Examples:
  $0 rollback -1              # Rollback one version
  $0 rollback abc123          # Rollback to specific revision
  $0 rollback -1 --backup     # Backup then rollback

Environment:
  ENV_FILE            Path to .env file (default: .env)
  COMPOSE_FILE        Path to docker-compose file (default: docker-compose.yml)
EOF
    exit 1
    ;;
esac
