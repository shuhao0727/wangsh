#!/bin/bash
# 数据库回滚脚本
# 用途：回滚 Alembic 数据库迁移

set -euo pipefail

cmd="${1:-}"
env_file="${ENV_FILE:-.env}"
compose_file="${COMPOSE_FILE:-docker-compose.yml}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

compose() {
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

check_database_container() {
  if ! compose ps postgres 2>/dev/null | grep -q "Up"; then
    echo "Error: postgres container is not running" >&2
    exit 1
  fi
}

confirm_rollback() {
  read -r -p "⚠️  Confirm rollback? This will modify the database. (yes/no): " answer
  [[ "$answer" == "yes" ]]
}

backup_db() {
  echo "Creating backup before rollback..."
  ENV_FILE="$env_file" COMPOSE_FILE="$compose_file" \
    bash "${repo_root}/scripts/deploy.sh" backup-db
}

stop_application_services() {
  echo "Stopping application services before database rollback..."
  compose stop gateway frontend backend typst-worker pythonlab-worker
}

case "$cmd" in
  rollback)
    # Parse arguments: skip flags to find the revision
    do_backup=true
    revision=""
    shift  # consume "rollback"
    for arg in "$@"; do
      case "$arg" in
        --backup) do_backup=true ;;
        --no-backup) do_backup=false ;;
        --*)
          echo "unknown rollback option: $arg" >&2
          exit 2
          ;;
        *)
          if [ -n "$revision" ]; then
            echo "rollback accepts only one revision" >&2
            exit 2
          fi
          revision="$arg"
          ;;
      esac
    done
    revision="${revision:--1}"
    check_database_container

    if ! confirm_rollback; then
      echo "Rollback cancelled"
      exit 0
    fi

    stop_application_services

    if $do_backup; then
      backup_db
    fi

    echo "Rolling back to: $revision"
    compose run --rm --no-deps backend alembic downgrade "$revision"
    echo "✓ Rollback completed"
    echo "Application services remain stopped. Deploy the verified previous release-set before reopening traffic."
    ;;

  *)
    cat <<EOF
Usage: $0 rollback [revision] [--backup|--no-backup]

Commands:
  rollback [-1]       Backup, then rollback one version
  rollback <rev>      Rollback to specific revision
  rollback --no-backup  Skip the backup only when it is intentionally unnecessary

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
