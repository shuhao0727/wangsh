set -euo pipefail

cmd="${1:-}"
env_file="${ENV_FILE:-.env}"
version_file="${VERSION_FILE:-VERSION}"

# 部署脚本默认使用生产配置 (.env)
if [ -z "${env_file}" ]; then
  if [ -f ".env" ]; then
    env_file=".env"
  fi
fi

compose_file="${COMPOSE_FILE:-docker-compose.yml}"

read_env_value() {
  local key="$1"
  local file="$2"
  awk -F= -v k="${key}" '$0 ~ ("^"k"=") {sub("^"k"=",""); print; exit}' "${file}" 2>/dev/null || true
}

read_repo_version() {
  if [ -f "${version_file}" ]; then
    tr -d '[:space:]' < "${version_file}"
    return
  fi
  echo ""
}

warn_version_conflict() {
  local key="$1"
  local env_val="$2"
  local canonical="$3"
  if [ -n "${env_val}" ] && [ "${env_val}" != "${canonical}" ]; then
    echo "warning: ${key} in ${env_file} (${env_val}) != VERSION (${canonical}), using VERSION" >&2
  fi
}

resolve_version_context() {
  local env_app env_tag env_version env_react repo_ver manual_ver
  env_app="$(read_env_value "APP_VERSION" "${env_file}")"
  env_tag="$(read_env_value "IMAGE_TAG" "${env_file}")"
  env_version="$(read_env_value "VERSION" "${env_file}")"
  env_react="$(read_env_value "REACT_APP_VERSION" "${env_file}")"
  repo_ver="$(read_repo_version)"
  manual_ver="${VERSION_OVERRIDE:-}"

  if [ -n "${manual_ver}" ]; then
    RESOLVED_APP_VERSION="${manual_ver}"
    RESOLVED_IMAGE_TAG="${manual_ver}"
    RESOLVED_VERSION="${manual_ver}"
    RESOLVED_REACT_APP_VERSION="${manual_ver}"
    return
  fi

  if [ -n "${repo_ver}" ]; then
    warn_version_conflict "APP_VERSION" "${env_app}" "${repo_ver}"
    warn_version_conflict "IMAGE_TAG" "${env_tag}" "${repo_ver}"
    warn_version_conflict "VERSION" "${env_version}" "${repo_ver}"
    warn_version_conflict "REACT_APP_VERSION" "${env_react}" "${repo_ver}"

    RESOLVED_APP_VERSION="${repo_ver}"
    RESOLVED_IMAGE_TAG="${repo_ver}"
    RESOLVED_VERSION="${repo_ver}"
    RESOLVED_REACT_APP_VERSION="${repo_ver}"
    return
  fi

  # 向后兼容：没有 VERSION 文件时沿用旧解析规则
  RESOLVED_APP_VERSION="${env_app}"
  if [ -z "${RESOLVED_APP_VERSION}" ] && [ -n "${env_version}" ]; then
    RESOLVED_APP_VERSION="${env_version}"
  fi

  RESOLVED_IMAGE_TAG="${env_tag}"
  if [ -z "${RESOLVED_IMAGE_TAG}" ] && [ -n "${RESOLVED_APP_VERSION}" ]; then
    RESOLVED_IMAGE_TAG="${RESOLVED_APP_VERSION}"
  fi

  RESOLVED_VERSION="${env_version}"
  if [ -z "${RESOLVED_VERSION}" ] && [ -n "${RESOLVED_APP_VERSION}" ]; then
    RESOLVED_VERSION="${RESOLVED_APP_VERSION}"
  fi

  RESOLVED_REACT_APP_VERSION="${env_react}"
  if [ -z "${RESOLVED_REACT_APP_VERSION}" ] && [ -n "${RESOLVED_APP_VERSION}" ]; then
    RESOLVED_REACT_APP_VERSION="${RESOLVED_APP_VERSION}"
  fi
}

require_env_file() {
  if [ ! -f "${env_file}" ]; then
    echo "${env_file} not found. run: cp .env.example ${env_file}" >&2
    exit 2
  fi
}

require_docker() {
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon not available. Please start Docker Desktop / Docker Engine first." >&2
    exit 3
  fi
}

compose() {
  resolve_version_context
  APP_VERSION="${RESOLVED_APP_VERSION}" \
    IMAGE_TAG="${RESOLVED_IMAGE_TAG}" \
    VERSION="${RESOLVED_VERSION}" \
    REACT_APP_VERSION="${RESOLVED_REACT_APP_VERSION}" \
    docker compose --env-file "${env_file}" -f "${compose_file}" "$@"
}

retry() {
  local attempts="${1:-3}"
  shift
  local n=1
  set +e
  while [ "${n}" -le "${attempts}" ]; do
    "$@"
    local rc=$?
    if [ $rc -eq 0 ]; then
      set -e
      return 0
    fi
    n=$((n + 1))
    sleep 2
  done
  set -e
  return 1
}

rand() {
  python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
}

fernet_key() {
  python3 - <<'PY'
import base64, os
print(base64.urlsafe_b64encode(os.urandom(32)).decode())
PY
}

case "${cmd}" in
  deploy)
    require_env_file
    require_docker
    bash scripts/deploy.sh pull-up
    bash scripts/deploy.sh health
    web_port="$(awk -F= '/^WEB_PORT=/{print $2; exit}' "${env_file}" 2>/dev/null || echo 6608)"
    echo "web: http://localhost:${web_port}"
    ;;
  deploy-amd64)
    require_env_file
    DOCKER_DEFAULT_PLATFORM=linux/amd64 ENV_FILE="${env_file}" COMPOSE_FILE="${compose_file}" bash scripts/deploy.sh deploy
    ;;
  deploy-local)
    require_env_file
    require_docker
    COMPOSE_PROJECT_NAME=wangsh_local compose up -d --no-build
    compose ps
    bash scripts/deploy.sh health
    web_port="$(awk -F= '/^WEB_PORT=/{print $2; exit}' "${env_file}" 2>/dev/null || echo 6608)"
    echo "web: http://localhost:${web_port}"
    ;;
  up-amd64)
    require_env_file
    DOCKER_DEFAULT_PLATFORM=linux/amd64 ENV_FILE="${env_file}" COMPOSE_FILE="${compose_file}" bash scripts/deploy.sh up
    ;;
  build-amd64)
    require_env_file
    DOCKER_DEFAULT_PLATFORM=linux/amd64 ENV_FILE="${env_file}" COMPOSE_FILE="${compose_file}" bash scripts/deploy.sh build
    ;;
  push-amd64)
    require_env_file
    DOCKER_DEFAULT_PLATFORM=linux/amd64 ENV_FILE="${env_file}" COMPOSE_FILE="${compose_file}" bash scripts/deploy.sh push
    ;;
  pull-up-amd64)
    require_env_file
    DOCKER_DEFAULT_PLATFORM=linux/amd64 ENV_FILE="${env_file}" COMPOSE_FILE="${compose_file}" bash scripts/deploy.sh pull-up
    ;;
  simulate-amd64)
    DOCKER_DEFAULT_PLATFORM=linux/amd64 ENV_FILE="${env_file}" COMPOSE_FILE="${compose_file}" bash scripts/deploy.sh simulate
    ;;
  up)
    require_env_file
    require_docker
    retry 3 compose up -d --build
    compose ps
    ;;
  pull-up)
    require_env_file
    require_docker
    compose pull
    compose up -d --no-build
    compose ps
    ;;
  build)
    require_env_file
    require_docker
    retry 3 compose build
    compose images
    ;;
  push)
    require_env_file
    require_docker
    registry="$(read_env_value "DOCKER_REGISTRY" "${env_file}")"
    ns="$(read_env_value "DOCKERHUB_NAMESPACE" "${env_file}")"
    resolve_version_context
    tag="${RESOLVED_IMAGE_TAG}"
    name_backend="$(read_env_value "IMAGE_NAME_BACKEND" "${env_file}")"
    name_frontend="$(read_env_value "IMAGE_NAME_FRONTEND" "${env_file}")"
    name_worker="$(read_env_value "IMAGE_NAME_WORKER" "${env_file}")"

    if [ -z "${registry}" ] || [ -z "${ns}" ] || [ -z "${tag}" ] || [ -z "${name_backend}" ] || [ -z "${name_frontend}" ] || [ -z "${name_worker}" ]; then
      echo "missing DOCKER_REGISTRY/DOCKERHUB_NAMESPACE/IMAGE_NAME_* in ${env_file} (version from VERSION/IMAGE_TAG)" >&2
      exit 2
    fi

    img_backend="${registry}/${ns}/${name_backend}:${tag}"
    img_frontend="${registry}/${ns}/${name_frontend}:${tag}"
    img_worker="${registry}/${ns}/${name_worker}:${tag}"

    retry 5 docker push "${img_backend}"
    retry 5 docker push "${img_frontend}"
    retry 5 docker push "${img_worker}"
    ;;
  down)
    require_env_file
    require_docker
    compose down
    ;;
  down-v)
    require_env_file
    require_docker
    compose down -v
    ;;
  logs)
    require_env_file
    require_docker
    compose logs -f --tail=200
    ;;
  health)
    require_env_file
    web_port="$(awk -F= '/^WEB_PORT=/{print $2; exit}' "${env_file}" 2>/dev/null || echo 6608)"
    curl -fsS "http://localhost:${web_port}/api/health"
    ;;
  simulate)
    require_docker
    tmp_env="$(mktemp -t wangsh_env_XXXXXX)"
    trap 'rm -f "${tmp_env}"' EXIT
    secret_key="$(rand)"
    fernet="$(fernet_key)"
    pg_password="$(rand)"
    admin_password="$(rand)"

    cat > "${tmp_env}" <<EOF
PROJECT_NAME=WangSh
APP_VERSION=1.0.0
API_V1_STR=/api/v1

DOCKER_REGISTRY=docker.io
DOCKERHUB_NAMESPACE=local
IMAGE_NAME_BACKEND=wangsh-backend
IMAGE_NAME_FRONTEND=wangsh-frontend
IMAGE_NAME_WORKER=wangsh-typst-worker

TIMEZONE=Asia/Shanghai
LOG_LEVEL=INFO
SECRET_KEY=${secret_key}
AGENT_API_KEY_ENCRYPTION_KEY=${fernet}
POSTGRES_DB=wangsh_db
POSTGRES_USER=admin
POSTGRES_PASSWORD=${pg_password}
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD=${admin_password}
CORS_ORIGINS=["http://localhost:16608","http://127.0.0.1:16608"]
REACT_APP_API_URL=/api/v1
REACT_APP_ENV=production
WEB_PORT=16608
EOF

    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-wangsh_sim}" \
      ENV_FILE="${tmp_env}" \
      COMPOSE_FILE="${compose_file}" \
      bash scripts/deploy.sh down-v || true

    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-wangsh_sim}" \
      ENV_FILE="${tmp_env}" \
      COMPOSE_FILE="${compose_file}" \
      bash scripts/deploy.sh up

    for _ in $(seq 1 60); do
      if curl -fsS "http://localhost:16608/api/health" >/dev/null; then
        break
      fi
      sleep 1
    done
    curl -fsS "http://localhost:16608/api/health" >/dev/null

    BASE_URL="http://localhost:16608/api/v1" \
      ADMIN_USERNAME="admin" \
      ADMIN_PASSWORD="${admin_password}" \
      python3 backend/scripts/smoke_typst_pipeline.py

    echo "ok"
    ;;
  backup-db)
    require_env_file
    require_docker
    mode="${2:-full}"
    out_dir="${BACKUP_DIR:-./backups}"
    ts="$(date +%Y%m%d_%H%M%S)"
    mkdir -p "${out_dir}"
    db="$(awk -F= '/^POSTGRES_DB=/{print $2; exit}' "${env_file}" 2>/dev/null || echo wangsh_db)"
    user="$(awk -F= '/^POSTGRES_USER=/{print $2; exit}' "${env_file}" 2>/dev/null || echo admin)"
    case "${mode}" in
      full) out="${out_dir}/${db}_${ts}.dump" ;;
      schema) out="${out_dir}/${db}_${ts}_schema.dump" ;;
      data) out="${out_dir}/${db}_${ts}_data.dump" ;;
      *) echo "usage: $0 backup-db [full|schema|data]" >&2; exit 2 ;;
    esac
    if [ "${mode}" = "schema" ]; then
      compose exec -T postgres pg_dump -U "${user}" -d "${db}" -Fc --schema-only -f - > "${out}"
    elif [ "${mode}" = "data" ]; then
      compose exec -T postgres pg_dump -U "${user}" -d "${db}" -Fc --data-only -f - > "${out}"
    else
      compose exec -T postgres pg_dump -U "${user}" -d "${db}" -Fc -f - > "${out}"
    fi
    echo "${out}"
    ;;
  restore-db)
    require_env_file
    require_docker
    dump_path="${2:-}"
    if [ -z "${dump_path}" ] || [ ! -f "${dump_path}" ]; then
      echo "usage: $0 restore-db <path-to-dump(.dump|.sql)>" >&2
      exit 2
    fi
    db="$(awk -F= '/^POSTGRES_DB=/{print $2; exit}' "${env_file}" 2>/dev/null || echo wangsh_db)"
    user="$(awk -F= '/^POSTGRES_USER=/{print $2; exit}' "${env_file}" 2>/dev/null || echo admin)"
    case "${dump_path}" in
      *.sql) cat "${dump_path}" | compose exec -T postgres psql -U "${user}" -d "${db}" ;;
      *) cat "${dump_path}" | compose exec -T postgres pg_restore -U "${user}" -d "${db}" --clean --if-exists --no-owner --no-privileges ;;
    esac
    ;;
  *)
    echo "usage: $0 <deploy|deploy-amd64|deploy-local|up|pull-up|build|push|down|down-v|logs|health|simulate|backup-db|restore-db|up-amd64|pull-up-amd64|build-amd64|push-amd64|simulate-amd64>" >&2
    exit 2
    ;;
esac
