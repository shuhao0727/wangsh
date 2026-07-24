#!/bin/bash
# 数据库回滚脚本
# 用途：回滚 Alembic 数据库迁移

set -euo pipefail

cmd="${1:-}"
env_file="${ENV_FILE:-.env}"
compose_file="${COMPOSE_FILE:-docker-compose.yml}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
application_write_services=(backend typst-worker pythonlab-worker)
original_running_write_services=()

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
  echo "Creating backup inside the no-write window..."
  ENV_FILE="$env_file" COMPOSE_FILE="$compose_file" \
    bash "${repo_root}/scripts/deploy.sh" backup-db
}

capture_running_application_write_services() {
  local running_services=""
  local service=""

  if running_services="$(
    compose ps --status running --services "${application_write_services[@]}"
  )"; then
    :
  else
    local status=$?
    echo "Error: failed to determine running application write services" >&2
    return "$status"
  fi

  original_running_write_services=()
  for service in "${application_write_services[@]}"; do
    if printf '%s\n' "$running_services" | grep -Fxq "$service"; then
      original_running_write_services+=("$service")
    fi
  done
}

stop_application_write_services() {
  echo "Stopping application write services to establish a no-write window..."
  compose stop "${application_write_services[@]}"
}

handle_pre_downgrade_failure() {
  local operation="$1"
  local operation_status="$2"

  echo "Error: ${operation} failed with status ${operation_status}; no database downgrade was attempted." >&2
  if restart_original_application_write_services; then
    return "$operation_status"
  else
    local restart_status=$?
    echo "Error: ${operation} failed with status ${operation_status} and failed to restart original application write services (status ${restart_status}); manual recovery required. No database downgrade was attempted." >&2
    return "$restart_status"
  fi
}

restart_original_application_write_services() {
  if [[ "${#original_running_write_services[@]}" -eq 0 ]]; then
    echo "No originally running application write services need to be restarted."
    return 0
  fi

  echo "Restarting originally running application write services..."
  if compose start "${original_running_write_services[@]}"; then
    echo "Application write services restored."
    return 0
  else
    local status=$?
    return "$status"
  fi
}

case "$cmd" in
  rollback)
    # Parse arguments: skip flags to find the revision
    do_backup=true
    backup_mode=""
    revision=""
    shift  # consume "rollback"
    for arg in "$@"; do
      case "$arg" in
        --backup)
          if [[ "$backup_mode" == "no-backup" ]]; then
            echo "rollback options --backup and --no-backup cannot be used together" >&2
            exit 2
          fi
          backup_mode="backup"
          do_backup=true
          ;;
        --no-backup)
          if [[ "$backup_mode" == "backup" ]]; then
            echo "rollback options --backup and --no-backup cannot be used together" >&2
            exit 2
          fi
          backup_mode="no-backup"
          do_backup=false
          ;;
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

    capture_running_application_write_services
    if stop_application_write_services; then
      :
    else
      stop_status=$?
      handle_pre_downgrade_failure "stopping application write services" "$stop_status"
      exit $?
    fi

    if $do_backup; then
      if backup_db; then
        :
      else
        backup_status=$?
        handle_pre_downgrade_failure "backup" "$backup_status"
        exit $?
      fi
    else
      echo "DANGER: --no-backup skips the rollback backup by explicit operator request."
    fi

    echo "Rolling back to: $revision"
    compose run --rm --no-deps backend alembic downgrade "$revision"
    echo "✓ Rollback completed"
    echo "Application write services remain stopped. Deploy the verified previous release-set before reopening traffic."
    ;;

  *)
    cat <<EOF
Usage: $0 rollback [revision] [--backup|--no-backup]

Commands:
  rollback [-1]         Stop writes, backup, then rollback one version
  rollback <rev>        Stop writes, backup, then rollback to a specific revision
  rollback --no-backup  DANGEROUS: stop writes and rollback without creating a backup

Examples:
  $0 rollback -1              # Rollback one version
  $0 rollback abc123          # Rollback to specific revision
  $0 rollback -1 --backup     # Backup then rollback
  $0 rollback -1 --no-backup  # Explicitly skip backup, then stop and rollback

Environment:
  ENV_FILE            Path to .env file (default: .env)
  COMPOSE_FILE        Path to docker-compose file (default: docker-compose.yml)
EOF
    exit 1
    ;;
esac
