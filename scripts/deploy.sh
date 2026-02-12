set -euo pipefail

cmd="${1:-}"
env_file="${ENV_FILE:-.env}"
compose_file="${COMPOSE_FILE:-docker-compose.yml}"

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

case "${cmd}" in
  deploy)
    require_env_file
    require_docker
    bash scripts/deploy.sh pull-up
    bash scripts/deploy.sh health
    web_port="$(awk -F= '/^WEB_PORT=/{print $2; exit}' "${env_file}" 2>/dev/null || echo 8080)"
    echo "web: http://localhost:${web_port}"
    ;;
  deploy-amd64)
    require_env_file
    DOCKER_DEFAULT_PLATFORM=linux/amd64 ENV_FILE="${env_file}" COMPOSE_FILE="${compose_file}" bash scripts/deploy.sh deploy
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
    registry="$(awk -F= '/^DOCKER_REGISTRY=/{print $2; exit}' "${env_file}" 2>/dev/null || true)"
    ns="$(awk -F= '/^DOCKERHUB_NAMESPACE=/{print $2; exit}' "${env_file}" 2>/dev/null || true)"
    tag="$(awk -F= '/^IMAGE_TAG=/{print $2; exit}' "${env_file}" 2>/dev/null || true)"
    tag_latest="$(awk -F= '/^IMAGE_TAG_LATEST=/{print $2; exit}' "${env_file}" 2>/dev/null || true)"
    name_backend="$(awk -F= '/^IMAGE_NAME_BACKEND=/{print $2; exit}' "${env_file}" 2>/dev/null || true)"
    name_frontend="$(awk -F= '/^IMAGE_NAME_FRONTEND=/{print $2; exit}' "${env_file}" 2>/dev/null || true)"
    name_worker="$(awk -F= '/^IMAGE_NAME_WORKER=/{print $2; exit}' "${env_file}" 2>/dev/null || true)"

    if [ -z "${registry}" ] || [ -z "${ns}" ] || [ -z "${tag}" ] || [ -z "${name_backend}" ] || [ -z "${name_frontend}" ] || [ -z "${name_worker}" ]; then
      echo "missing DOCKER_REGISTRY/DOCKERHUB_NAMESPACE/IMAGE_TAG/IMAGE_NAME_* in ${env_file}" >&2
      exit 2
    fi

    img_backend="${registry}/${ns}/${name_backend}:${tag}"
    img_frontend="${registry}/${ns}/${name_frontend}:${tag}"
    img_worker="${registry}/${ns}/${name_worker}:${tag}"

    retry 5 docker push "${img_backend}"
    retry 5 docker push "${img_frontend}"
    retry 5 docker push "${img_worker}"

    if [ -n "${tag_latest}" ]; then
      docker tag "${img_backend}" "${registry}/${ns}/${name_backend}:${tag_latest}"
      docker tag "${img_frontend}" "${registry}/${ns}/${name_frontend}:${tag_latest}"
      docker tag "${img_worker}" "${registry}/${ns}/${name_worker}:${tag_latest}"
      retry 5 docker push "${registry}/${ns}/${name_backend}:${tag_latest}"
      retry 5 docker push "${registry}/${ns}/${name_frontend}:${tag_latest}"
      retry 5 docker push "${registry}/${ns}/${name_worker}:${tag_latest}"
    fi
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
    web_port="$(awk -F= '/^WEB_PORT=/{print $2; exit}' "${env_file}" 2>/dev/null || echo 8080)"
    curl -fsS "http://localhost:${web_port}/api/health"
    ;;
  simulate)
    require_docker
    tmp_env="$(mktemp -t wangsh_env_XXXXXX)"
    trap 'rm -f "${tmp_env}"' EXIT
    secret_key="$(rand)"
    pg_password="$(rand)"
    admin_password="$(rand)"

    cat > "${tmp_env}" <<EOF
PROJECT_NAME=WangSh
VERSION=1.0.0
API_V1_STR=/api/v1

DOCKER_REGISTRY=docker.io
DOCKERHUB_NAMESPACE=local
IMAGE_TAG=1.0.0
IMAGE_TAG_LATEST=latest
IMAGE_NAME_BACKEND=wangsh-backend
IMAGE_NAME_FRONTEND=wangsh-frontend
IMAGE_NAME_WORKER=wangsh-typst-worker

TIMEZONE=Asia/Shanghai
LOG_LEVEL=INFO
SECRET_KEY=${secret_key}
POSTGRES_DB=wangsh_db
POSTGRES_USER=admin
POSTGRES_PASSWORD=${pg_password}
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD=${admin_password}
CORS_ORIGINS=["http://localhost:18080","http://127.0.0.1:18080"]
REACT_APP_API_URL=/api/v1
REACT_APP_ENV=production
REACT_APP_VERSION=1.0.0
WEB_PORT=18080
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
      if curl -fsS "http://localhost:18080/api/health" >/dev/null; then
        break
      fi
      sleep 1
    done
    curl -fsS "http://localhost:18080/api/health" >/dev/null

    BASE_URL="http://localhost:18080/api/v1" \
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
    echo "usage: $0 <deploy|deploy-amd64|up|pull-up|build|push|down|down-v|logs|health|simulate|backup-db|restore-db|up-amd64|pull-up-amd64|build-amd64|push-amd64|simulate-amd64>" >&2
    exit 2
    ;;
esac
