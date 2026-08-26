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
rollback_image_tag=""   # --image-tag <tag> 指定执行 downgrade 的旧版本镜像 tag
backend_image=""        # 解析后的 backend 镜像（旧版本）
revision_target=""      # 实际回退到的 Alembic revision（相对值已解析为具体 revision）

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

# 解析执行 downgrade 所用的 backend 镜像：
# - 指定 --image-tag 时用 IMAGE_TAG 覆盖 compose 插值，得到旧版本镜像；
# - 未指定时沿用 compose 当前解析值（与既有行为一致）。
resolve_backend_image() {
  if [[ -n "$rollback_image_tag" ]]; then
    IMAGE_TAG="$rollback_image_tag" compose config --images 2>/dev/null | grep "wangsh-backend:" | head -n1
  else
    compose config --images 2>/dev/null | grep "wangsh-backend:" | head -n1
  fi
}

# 执行前断言旧镜像包含目标 revision，并把相对回退值（-1/-N）解析为具体 revision。
# 缺失时立即报错并提示 restore-db，绝不继续 downgrade。
assert_revision_in_old_image() {
  local history_output target current_rev steps i
  backend_image="$(resolve_backend_image)"
  if [[ -z "$backend_image" ]]; then
    echo "Error: cannot resolve backend image from compose config; check COMPOSE_FILE/ENV_FILE." >&2
    exit 1
  fi

  history_output="$(docker run --rm "$backend_image" alembic history 2>&1)" || {
    echo "Error: cannot read 'alembic history' from old image ${backend_image} (image missing locally? pull it first)." >&2
    echo "Recovery: restore from backup with: bash scripts/deploy.sh restore-db ./backups/<dump> --yes" >&2
    exit 1
  }

  if [[ "$revision" == "base" ]]; then
    revision_target="base"
    return 0
  fi

  if [[ "$revision" =~ ^-[0-9]+$ ]]; then
    # 相对回退：从数据库当前 revision 沿旧镜像 history 回退 N 步得到具体目标
    current_rev="$(compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT version_num FROM alembic_version"' 2>/dev/null | tr -d ' \r\n')"
    if [[ -z "$current_rev" ]]; then
      echo "Error: cannot resolve current Alembic revision from postgres; cannot compute downgrade target ${revision}." >&2
      exit 1
    fi
    target="$current_rev"
    steps="${revision#-}"
    for ((i=0; i<steps; i++)); do
      target="$(printf '%s\n' "$history_output" | awk -v cur="$target" '
        $2 == "->" { gsub(/,/, "", $3); if ($3 == cur) { print $1; exit } }')"
      if [[ -z "$target" ]]; then
        echo "Error: cannot step back ${steps} revision(s) from ${current_rev} using ${backend_image} history; target revision missing." >&2
        echo "Recovery: restore from backup with: bash scripts/deploy.sh restore-db ./backups/<dump> --yes" >&2
        exit 1
      fi
      if [[ "$target" == "<base>" ]]; then
        target="base"
        break
      fi
    done
    revision_target="$target"
  else
    revision_target="$revision"
    if ! printf '%s\n' "$history_output" | grep -qF "$revision"; then
      echo "Error: revision ${revision} not present in old image ${backend_image} (alembic history); the image tag is wrong or too old/new for this target." >&2
      echo "Recovery: restore from backup with: bash scripts/deploy.sh restore-db ./backups/<dump> --yes" >&2
      exit 1
    fi
  fi
}

case "$cmd" in
  rollback)
    # Parse arguments: skip flags to find the revision
    do_backup=true
    backup_mode=""
    revision=""
    shift  # consume "rollback"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --backup)
          if [[ "$backup_mode" == "no-backup" ]]; then
            echo "rollback options --backup and --no-backup cannot be used together" >&2
            exit 2
          fi
          backup_mode="backup"
          do_backup=true
          shift
          ;;
        --no-backup)
          if [[ "$backup_mode" == "backup" ]]; then
            echo "rollback options --backup and --no-backup cannot be used together" >&2
            exit 2
          fi
          backup_mode="no-backup"
          do_backup=false
          shift
          ;;
        --image-tag)
          if [[ $# -lt 2 ]]; then
            echo "rollback option --image-tag requires a tag value" >&2
            exit 2
          fi
          rollback_image_tag="$2"
          shift 2
          ;;
        --*)
          echo "unknown rollback option: $1" >&2
          exit 2
          ;;
        *)
          if [ -n "$revision" ]; then
            echo "rollback accepts only one revision" >&2
            exit 2
          fi
          revision="$1"
          shift
          ;;
      esac
    done
    revision="${revision:--1}"
    check_database_container

    # 用旧版本镜像预检目标 revision 存在性（只读），失败立即退出并提示 restore-db
    assert_revision_in_old_image

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

    echo "Rolling back to: ${revision_target} (via image ${backend_image})"
    if [[ -n "$rollback_image_tag" ]]; then
      IMAGE_TAG="$rollback_image_tag" compose run --rm --no-deps backend alembic downgrade "$revision_target"
    else
      compose run --rm --no-deps backend alembic downgrade "$revision_target"
    fi
    echo "✓ Rollback completed"
    echo "Application write services remain stopped. Deploy the verified previous release-set before reopening traffic."
    echo "⚠️  Until the old version is deployed, do NOT run 'docker compose up/restart': the backend startup"
    echo "   command runs 'alembic upgrade head' and would immediately re-apply the rolled-back migrations."
    ;;

  *)
    cat <<EOF
Usage: $0 rollback [revision] [--backup|--no-backup] [--image-tag <tag>]

Commands:
  rollback [-1]         Stop writes, backup, then rollback one version
  rollback <rev>        Stop writes, backup, then rollback to a specific revision
  rollback --no-backup  DANGEROUS: stop writes and rollback without creating a backup
  rollback --image-tag <tag>  Run the downgrade from the OLD version image
                        <IMAGE_REPOSITORY_PREFIX>/wangsh-backend:<tag>; the old image
                        must contain the target revision (asserted before downgrade).
                        Default: image resolved from compose/IMAGE_TAG.

Examples:
  $0 rollback -1                    # Rollback one version (current image)
  $0 rollback -1 --image-tag 1.5.10 # Rollback one version using the OLD 1.5.10 image
  $0 rollback abc123                # Rollback to specific revision
  $0 rollback -1 --backup           # Backup then rollback
  $0 rollback -1 --no-backup        # Explicitly skip backup, then stop and rollback

Environment:
  ENV_FILE            Path to .env file (default: .env)
  COMPOSE_FILE        Path to docker-compose file (default: docker-compose.yml)
  IMAGE_REPOSITORY_PREFIX  Image repository prefix (default: shuhao07)

Note: after a successful rollback, do NOT run 'docker compose up/restart' until the
old version is deployed: the backend startup command runs 'alembic upgrade head' and
would immediately re-apply the rolled-back migrations.
EOF
    exit 1
    ;;
esac
