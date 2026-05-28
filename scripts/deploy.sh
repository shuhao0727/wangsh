set -euo pipefail

cmd="${1:-}"
env_file="${ENV_FILE:-.env}"

# 部署脚本默认使用生产配置 (.env)
if [ -z "${env_file}" ]; then
  if [ -f ".env" ]; then
    env_file=".env"
  fi
fi

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

raw_env_value() {
  awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "${env_file}" 2>/dev/null || true
}

resolved_env_value() {
  docker compose --env-file "${env_file}" -f "${compose_file}" config --environment 2>/dev/null \
    | awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}

env_value() {
  local value
  value="$(resolved_env_value "$1" || true)"
  if [ -n "${value}" ]; then
    printf '%s' "${value}"
    return
  fi
  raw_env_value "$1"
}

compose() {
  app_version="$(env_value APP_VERSION)"
  tag="$(env_value IMAGE_TAG)"
  version="$(env_value VERSION)"
  react_version="$(env_value REACT_APP_VERSION)"

  if [ -z "${app_version}" ] && [ -n "${version}" ]; then
    app_version="${version}"
  fi
  if [ -z "${tag}" ] && [ -n "${app_version}" ]; then
    tag="${app_version}"
  fi
  if [ -z "${version}" ] && [ -n "${app_version}" ]; then
    version="${app_version}"
  fi
  if [ -z "${react_version}" ] && [ -n "${app_version}" ]; then
    react_version="${app_version}"
  fi

  APP_VERSION="${app_version}" IMAGE_TAG="${tag}" VERSION="${version}" REACT_APP_VERSION="${react_version}" \
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
    web_port="$(env_value WEB_PORT)"
    web_port="${web_port:-6608}"
    echo "web: http://localhost:${web_port}"
    ;;
  deploy-amd64)
    require_env_file
    DOCKER_DEFAULT_PLATFORM=linux/amd64 ENV_FILE="${env_file}" COMPOSE_FILE="${compose_file}" bash scripts/deploy.sh deploy
    ;;
  deploy-local)
    require_env_file
    require_docker
    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-wangsh_local}" compose up -d --no-build
    compose ps
    bash scripts/deploy.sh health
    web_port="$(env_value WEB_PORT)"
    web_port="${web_port:-6608}"
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
  up-no-build)
    require_env_file
    require_docker
    compose up -d --no-build
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
    prefix="$(env_value IMAGE_REPOSITORY_PREFIX)"
    if [ -z "${prefix}" ]; then
      registry="$(env_value DOCKER_REGISTRY)"
      ns="$(env_value DOCKERHUB_NAMESPACE)"
      if [ -n "${registry}" ] && [ "${registry}" != "docker.io" ]; then
        prefix="${registry%/}/${ns:-shuhao07}"
      else
        prefix="${ns:-shuhao07}"
      fi
    fi
    tag="$(env_value IMAGE_TAG)"
    if [ -z "${tag}" ]; then
      tag="$(env_value APP_VERSION)"
    fi
    if [ -z "${tag}" ]; then
      tag="$(env_value VERSION)"
    fi
    name_backend="$(env_value IMAGE_NAME_BACKEND)"
    name_frontend="$(env_value IMAGE_NAME_FRONTEND)"
    name_worker="$(env_value IMAGE_NAME_WORKER)"
    name_pythonlab_worker="$(env_value IMAGE_NAME_PYTHONLAB_WORKER)"
    name_gateway="$(env_value IMAGE_NAME_GATEWAY)"
    name_backend="${name_backend:-wangsh-backend}"
    name_frontend="${name_frontend:-wangsh-frontend}"
    name_worker="${name_worker:-wangsh-typst-worker}"
    name_pythonlab_worker="${name_pythonlab_worker:-wangsh-pythonlab-worker}"
    name_gateway="${name_gateway:-wangsh-gateway}"
    sandbox_image="$(env_value PYTHONLAB_SANDBOX_IMAGE)"
    sandbox_image="${sandbox_image:-${prefix}/pythonlab-sandbox:${tag}}"

    if [ -z "${prefix}" ] || [ -z "${tag}" ]; then
      echo "missing IMAGE_REPOSITORY_PREFIX/IMAGE_TAG in ${env_file}" >&2
      exit 2
    fi

    img_backend="${prefix}/${name_backend}:${tag}"
    img_frontend="${prefix}/${name_frontend}:${tag}"
    img_worker="${prefix}/${name_worker}:${tag}"
    img_pythonlab_worker="${prefix}/${name_pythonlab_worker}:${tag}"
    img_gateway="${prefix}/${name_gateway}:${tag}"

    retry 5 docker push "${img_backend}"
    retry 5 docker push "${img_frontend}"
    retry 5 docker push "${img_worker}"
    retry 5 docker push "${img_pythonlab_worker}"
    retry 5 docker push "${img_gateway}"
    retry 5 docker push "${sandbox_image}"
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
    web_port="$(env_value WEB_PORT)"
    web_port="${web_port:-6608}"
    curl -fsS "http://localhost:${web_port}/api/health"
    ;;
  simulate)
    require_docker
    tmp_env="$(mktemp -t wangsh_env_XXXXXX)"
    trap 'rm -f "${tmp_env}"' EXIT
    sim_web_port="${SIM_WEB_PORT:-16608}"
    sim_version="${SIM_VERSION:-1.5.16}"
    sim_image_prefix="${SIM_IMAGE_REPOSITORY_PREFIX:-shuhao07}"
    secret_key="$(rand)"
    fernet="$(fernet_key)"
    pg_password="$(rand)"
    admin_password="$(rand)"

cat > "${tmp_env}" <<EOF
PROJECT_NAME=WangSh
APP_VERSION=${sim_version}
IMAGE_TAG=${sim_version}
REACT_APP_VERSION=${sim_version}
API_V1_STR=/api/v1

IMAGE_REPOSITORY_PREFIX=${sim_image_prefix}
IMAGE_NAME_BACKEND=wangsh-backend
IMAGE_NAME_FRONTEND=wangsh-frontend
IMAGE_NAME_WORKER=wangsh-typst-worker
IMAGE_NAME_PYTHONLAB_WORKER=wangsh-pythonlab-worker
IMAGE_NAME_GATEWAY=wangsh-gateway
PYTHONLAB_SANDBOX_IMAGE=${sim_image_prefix}/pythonlab-sandbox:${sim_version}

TIMEZONE=Asia/Shanghai
LOG_LEVEL=INFO
SECRET_KEY=${secret_key}
AGENT_API_KEY_ENCRYPTION_KEY=${fernet}
POSTGRES_DB=wangsh_db
POSTGRES_USER=admin
POSTGRES_PASSWORD=${pg_password}
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD=${admin_password}
CORS_ORIGINS=["http://localhost:${sim_web_port}","http://127.0.0.1:${sim_web_port}"]
REACT_APP_API_URL=/api/v1
REACT_APP_ENV=production
WEB_PORT=${sim_web_port}
EOF

    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-wangsh_sim}" \
      ENV_FILE="${tmp_env}" \
      COMPOSE_FILE="${compose_file}" \
      bash scripts/deploy.sh down-v || true

    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-wangsh_sim}" \
      ENV_FILE="${tmp_env}" \
      COMPOSE_FILE="${compose_file}" \
      bash scripts/deploy.sh up-no-build

    for _ in $(seq 1 60); do
      if curl -fsS "http://localhost:${sim_web_port}/api/health" >/dev/null; then
        break
      fi
      sleep 1
    done
    curl -fsS "http://localhost:${sim_web_port}/api/health" >/dev/null

    BASE_URL="http://localhost:${sim_web_port}/api/v1" \
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
    db="$(env_value POSTGRES_DB)"
    db="${db:-wangsh_db}"
    user="$(env_value POSTGRES_USER)"
    user="${user:-admin}"
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
    db="$(env_value POSTGRES_DB)"
    db="${db:-wangsh_db}"
    user="$(env_value POSTGRES_USER)"
    user="${user:-admin}"
    case "${dump_path}" in
      *.sql) cat "${dump_path}" | compose exec -T postgres psql -U "${user}" -d "${db}" ;;
      *) cat "${dump_path}" | compose exec -T postgres pg_restore -U "${user}" -d "${db}" --clean --if-exists --no-owner --no-privileges ;;
    esac
    ;;
  *)
    echo "usage: $0 <deploy|deploy-amd64|deploy-local|up|up-no-build|pull-up|build|push|down|down-v|logs|health|simulate|backup-db|restore-db|up-amd64|pull-up-amd64|build-amd64|push-amd64|simulate-amd64>" >&2
    exit 2
    ;;
esac
