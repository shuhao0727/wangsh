#!/usr/bin/env bash
set -euo pipefail

cmd="${1:-}"
env_file="${ENV_FILE:-.env}"

compose_file="${COMPOSE_FILE:-docker-compose.yml}"
release_set_default="${RELEASE_SET_FILE:-release-set.txt}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

release_image_names=(
  wangsh-backend
  wangsh-typst-worker
  wangsh-pythonlab-worker
  pythonlab-sandbox
  wangsh-frontend
  wangsh-gateway
)

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

registry_manifest_digest() {
  local image_ref="$1"
  local inspect_output
  local digest

  inspect_output="$(docker buildx imagetools inspect "${image_ref}")" || {
    echo "failed to inspect registry manifest: ${image_ref}" >&2
    return 1
  }
  digest="$(printf '%s\n' "${inspect_output}" | awk '$1 == "Digest:" && $2 ~ /^sha256:[0-9a-fA-F]{64}$/ { print $2; exit }')"
  if [ -z "${digest}" ]; then
    echo "registry manifest digest missing for ${image_ref}" >&2
    return 1
  fi
  printf '%s' "${digest}"
}

release_set_image_index() {
  local image_name="$1"
  local index
  for index in "${!release_image_names[@]}"; do
    if [ "${release_image_names[${index}]}" = "${image_name}" ]; then
      printf '%s' "${index}"
      return 0
    fi
  done
  return 1
}

verify_release_set() {
  local release_set_file="${1:-${release_set_default}}"
  local expected_version
  local release_version=""
  local release_format=""
  local line
  local image_name
  local image_ref
  local image_digest
  local row_count=0
  local index
  local compose_output
  local compose_count
  local compose_name_count
  local registry_digest
  local -a release_refs=()
  local -a release_digests=()
  local -a release_seen=()
  local -a compose_images=()

  if [ ! -f "${release_set_file}" ]; then
    echo "release-set file not found: ${release_set_file}" >&2
    return 2
  fi

  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%$'\r'}"
    [ -z "${line}" ] && continue
    case "${line}" in
      format=*)
        if [ -n "${release_format}" ]; then
          echo "duplicate release-set format" >&2
          return 2
        fi
        release_format="${line#format=}"
        ;;
      version=*)
        if [ -n "${release_version}" ]; then
          echo "duplicate release-set version" >&2
          return 2
        fi
        release_version="${line#version=}"
        ;;
      image=*)
        if [[ ! "${line}" =~ ^image=([^[:space:]]+)[[:space:]]ref=([^[:space:]]+)[[:space:]]digest=(sha256:[0-9a-fA-F]{64})$ ]]; then
          echo "invalid release-set image row: ${line}" >&2
          return 2
        fi
        image_name="${BASH_REMATCH[1]}"
        image_ref="${BASH_REMATCH[2]}"
        image_digest="${BASH_REMATCH[3]}"
        if ! index="$(release_set_image_index "${image_name}")"; then
          echo "unexpected release-set image: ${image_name}" >&2
          return 2
        fi
        if [ "${release_seen[${index}]:-0}" = "1" ]; then
          echo "duplicate release-set image: ${image_name}" >&2
          return 2
        fi
        release_seen[${index}]=1
        release_refs[${index}]="${image_ref}"
        release_digests[${index}]="${image_digest}"
        row_count=$((row_count + 1))
        ;;
      *)
        echo "invalid release-set line: ${line}" >&2
        return 2
        ;;
    esac
  done < "${release_set_file}"

  if [ "${release_format}" != "wangsh-release-set-v1" ]; then
    echo "unsupported or missing release-set format" >&2
    return 2
  fi
  if [ -z "${release_version}" ]; then
    echo "missing release-set version" >&2
    return 2
  fi
  if [ "${row_count}" -ne "${#release_image_names[@]}" ]; then
    echo "release-set must contain exactly six images" >&2
    return 2
  fi
  for index in "${!release_image_names[@]}"; do
    if [ "${release_seen[${index}]:-0}" != "1" ]; then
      echo "missing release-set image: ${release_image_names[${index}]}" >&2
      return 2
    fi
  done

  expected_version="$(env_value IMAGE_TAG)"
  if [ -z "${expected_version}" ]; then
    expected_version="$(env_value APP_VERSION)"
  fi
  if [ -z "${expected_version}" ]; then
    expected_version="$(env_value VERSION)"
  fi
  if [ -z "${expected_version}" ] || [ "${release_version}" != "${expected_version}" ]; then
    echo "release-set version mismatch: release=${release_version} expected=${expected_version:-<missing>}" >&2
    return 2
  fi

  for index in "${!release_image_names[@]}"; do
    if [[ "${release_refs[${index}]}" != *":${release_version}" ]]; then
      echo "release-set tag mismatch for ${release_image_names[${index}]}: ${release_refs[${index}]}" >&2
      return 2
    fi
  done

  compose_output="$(compose config --images)" || {
    echo "failed to render compose image references" >&2
    return 1
  }
  while IFS= read -r line; do
    [ -n "${line}" ] && compose_images+=("${line}")
  done <<< "${compose_output}"

  for index in "${!release_image_names[@]}"; do
    compose_count="$(printf '%s\n' "${compose_images[@]}" | awk -v ref="${release_refs[${index}]}" '$0 == ref { count += 1 } END { print count + 0 }')"
    if [ "${compose_count}" -ne 1 ]; then
      echo "compose image reference mismatch for ${release_image_names[${index}]}: expected exactly one ${release_refs[${index}]}, found ${compose_count}" >&2
      return 2
    fi
    compose_name_count="$(printf '%s\n' "${compose_images[@]}" | awk -v image="${release_image_names[${index}]}" '
      {
        ref = $0
        sub(/^.*\//, "", ref)
        sub(/:.*/, "", ref)
        if (ref == image) count += 1
      }
      END { print count + 0 }
    ')"
    if [ "${compose_name_count}" -ne 1 ]; then
      echo "compose image name mismatch for ${release_image_names[${index}]}" >&2
      return 2
    fi
  done

  for index in "${!release_image_names[@]}"; do
    registry_digest="$(registry_manifest_digest "${release_refs[${index}]}" )" || return 1
    if [ "${registry_digest}" != "${release_digests[${index}]}" ]; then
      echo "registry manifest digest mismatch for ${release_refs[${index}]}: release-set=${release_digests[${index}]} registry=${registry_digest}" >&2
      return 2
    fi
  done

  echo "release-set verified: ${release_set_file} version=${release_version} images=${row_count}"
}

verify_local_images() {
  local compose_output
  local sandbox_image
  local image_ref
  local image_count=0
  local missing=0

  compose_output="$(compose config --images)" || {
    echo "failed to render compose image references" >&2
    return 1
  }
  sandbox_image="$(env_value PYTHONLAB_SANDBOX_IMAGE)"

  while IFS= read -r image_ref; do
    [ -z "${image_ref}" ] && continue
    image_count=$((image_count + 1))
    if ! docker image inspect "${image_ref}" >/dev/null 2>&1; then
      echo "local image missing: ${image_ref}" >&2
      missing=1
    fi
  done < <(
    {
      printf '%s\n' "${compose_output}"
      [ -n "${sandbox_image}" ] && printf '%s\n' "${sandbox_image}"
    } | sort -u
  )

  if [ "${image_count}" -eq 0 ]; then
    echo "no local image references found" >&2
    return 2
  fi
  if [ "${missing}" -ne 0 ]; then
    return 2
  fi
  echo "local images verified: ${image_count}"
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
    verify_release_set "${2:-${release_set_default}}"
    compose up -d --no-build
    compose ps
    ;;
  pull-up)
    require_env_file
    require_docker
    verify_release_set "${2:-${release_set_default}}"
    compose pull
    compose up -d --no-build
    compose ps
    ;;
  verify-release-set)
    require_env_file
    require_docker
    verify_release_set "${2:-${release_set_default}}"
    ;;
  verify-local-images)
    require_env_file
    require_docker
    verify_local_images
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
    sim_web_port="${SIM_WEB_PORT:-16608}"
    sim_version="${SIM_VERSION:-1.6.0}"
    sim_image_prefix="${SIM_IMAGE_REPOSITORY_PREFIX:-shuhao07}"
    sim_project="wangsh_sim"
    sim_namespace="wangsh_sim"
    simulation_root="${repo_root}/data/pythonlab/simulations"
    sim_lock_dir="${TMPDIR:-/tmp}/wangsh-production-simulate.lock"
    sim_lock_acquired=false
    tmp_env=""
    sim_workspace_dir=""
    simulation_started=false

    run_sim_deploy() {
      COMPOSE_PROJECT_NAME="${sim_project}" \
        APP_VERSION="${sim_version}" \
        VERSION="${sim_version}" \
        IMAGE_TAG="${sim_version}" \
        REACT_APP_VERSION="${sim_version}" \
        IMAGE_REPOSITORY_PREFIX="${sim_image_prefix}" \
        PYTHONLAB_SANDBOX_IMAGE="${sim_image_prefix}/pythonlab-sandbox:${sim_version}" \
        WEB_PORT="${sim_web_port}" \
        PYTHONLAB_CONTAINER_NAMESPACE="${sim_namespace}" \
        PYTHONLAB_WORKSPACE_ROOT="/tmp/pythonlab/workspaces" \
        HOST_WORKSPACE_ROOT="${sim_workspace_dir}" \
        PYTHONLAB_HOST_WORKSPACE_ROOT="${sim_workspace_dir}" \
        SECRET_KEY="${secret_key}" \
        AGENT_API_KEY_ENCRYPTION_KEY="${fernet}" \
        POSTGRES_DB="wangsh_db" \
        POSTGRES_USER="admin" \
        POSTGRES_PASSWORD="${pg_password}" \
        SUPER_ADMIN_USERNAME="admin" \
        SUPER_ADMIN_PASSWORD="${admin_password}" \
        ENV_FILE="${tmp_env}" \
        COMPOSE_FILE="${compose_file}" \
        bash scripts/deploy.sh "$@"
    }

    run_sim_compose() {
      COMPOSE_PROJECT_NAME="${sim_project}" \
        APP_VERSION="${sim_version}" \
        VERSION="${sim_version}" \
        IMAGE_TAG="${sim_version}" \
        REACT_APP_VERSION="${sim_version}" \
        IMAGE_REPOSITORY_PREFIX="${sim_image_prefix}" \
        PYTHONLAB_SANDBOX_IMAGE="${sim_image_prefix}/pythonlab-sandbox:${sim_version}" \
        WEB_PORT="${sim_web_port}" \
        PYTHONLAB_CONTAINER_NAMESPACE="${sim_namespace}" \
        PYTHONLAB_WORKSPACE_ROOT="/tmp/pythonlab/workspaces" \
        HOST_WORKSPACE_ROOT="${sim_workspace_dir}" \
        PYTHONLAB_HOST_WORKSPACE_ROOT="${sim_workspace_dir}" \
        SECRET_KEY="${secret_key}" \
        AGENT_API_KEY_ENCRYPTION_KEY="${fernet}" \
        POSTGRES_DB="wangsh_db" \
        POSTGRES_USER="admin" \
        POSTGRES_PASSWORD="${pg_password}" \
        SUPER_ADMIN_USERNAME="admin" \
        SUPER_ADMIN_PASSWORD="${admin_password}" \
        docker compose --env-file "${tmp_env}" -f "${compose_file}" "$@"
    }

    cleanup_sim_sandboxes() {
      local container_ids
      container_ids="$(docker ps -aq --filter "name=^/${sim_namespace}_")"
      if [ -z "${container_ids}" ]; then
        return 0
      fi
      docker rm -f ${container_ids}
      if [ -n "$(docker ps -aq --filter "name=^/${sim_namespace}_")" ]; then
        echo "failed to remove all simulation PythonLab containers" >&2
        return 1
      fi
    }

    cleanup_simulation() {
      local rc=$?
      local cleanup_rc=0
      local command_rc=0
      trap - EXIT
      set +e

      if [ "${simulation_started}" = "true" ] \
        && { [ "${SIM_CLEANUP:-false}" = "true" ] || [ "${rc}" -ne 0 ]; }; then
        run_sim_deploy down-v
        command_rc=$?
        if [ "${command_rc}" -ne 0 ]; then
          cleanup_rc="${command_rc}"
        fi
        cleanup_sim_sandboxes
        command_rc=$?
        if [ "${command_rc}" -ne 0 ] && [ "${cleanup_rc}" -eq 0 ]; then
          cleanup_rc="${command_rc}"
        fi
      fi

      if [ "${simulation_started}" != "true" ] \
        || [ "${SIM_CLEANUP:-false}" = "true" ] \
        || [ "${rc}" -ne 0 ]; then
        if [ -n "${sim_workspace_dir}" ]; then
          rm -rf -- "${sim_workspace_dir}"
          command_rc=$?
          if [ "${command_rc}" -ne 0 ] && [ "${cleanup_rc}" -eq 0 ]; then
            cleanup_rc="${command_rc}"
          fi
        fi
      fi

      if [ -n "${tmp_env}" ]; then
        rm -f "${tmp_env}"
        command_rc=$?
        if [ "${command_rc}" -ne 0 ] && [ "${cleanup_rc}" -eq 0 ]; then
          cleanup_rc="${command_rc}"
        fi
      fi

      if [ "${sim_lock_acquired}" = "true" ]; then
        rm -rf -- "${sim_lock_dir}"
        command_rc=$?
        if [ "${command_rc}" -ne 0 ] && [ "${cleanup_rc}" -eq 0 ]; then
          cleanup_rc="${command_rc}"
        fi
      fi

      if [ "${rc}" -ne 0 ]; then
        exit "${rc}"
      fi
      exit "${cleanup_rc}"
    }
    trap cleanup_simulation EXIT

    if ! mkdir "${sim_lock_dir}" 2>/dev/null; then
      lock_pid="$(cat "${sim_lock_dir}/pid" 2>/dev/null || true)"
      if [ -n "${lock_pid}" ] && kill -0 "${lock_pid}" 2>/dev/null; then
        echo "another production simulation is already running (pid ${lock_pid})" >&2
        exit 4
      fi
      stale_lock_dir="${sim_lock_dir}.stale.$$"
      if mv "${sim_lock_dir}" "${stale_lock_dir}" 2>/dev/null; then
        rm -rf -- "${stale_lock_dir}"
      fi
      if ! mkdir "${sim_lock_dir}" 2>/dev/null; then
        echo "failed to acquire production simulation lock: ${sim_lock_dir}" >&2
        exit 4
      fi
    fi
    sim_lock_acquired=true
    printf '%s\n' "$$" > "${sim_lock_dir}/pid"

    tmp_env="$(mktemp -t wangsh_env_XXXXXX)"
    mkdir -p "${simulation_root}"
    sim_workspace_dir="$(mktemp -d "${simulation_root}/run.XXXXXX")"
    secret_key="$(rand)"
    fernet="$(fernet_key)"
    pg_password="$(rand)"
    admin_password="$(rand)"

cat > "${tmp_env}" <<EOF
PROJECT_NAME=WangSh
COMPOSE_PROJECT_NAME=${sim_project}
APP_VERSION=${sim_version}
VERSION=${sim_version}
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
PYTHONLAB_CONTAINER_NAMESPACE=${sim_namespace}
PYTHONLAB_WORKSPACE_ROOT=/tmp/pythonlab/workspaces
HOST_WORKSPACE_ROOT=${sim_workspace_dir}
PYTHONLAB_HOST_WORKSPACE_ROOT=${sim_workspace_dir}

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

    run_sim_deploy verify-local-images
    run_sim_deploy down-v
    cleanup_sim_sandboxes

    for stale_workspace in "${simulation_root}"/run.*; do
      [ -d "${stale_workspace}" ] || continue
      [ "${stale_workspace}" = "${sim_workspace_dir}" ] && continue
      rm -rf -- "${stale_workspace}"
    done

    simulation_started=true
    run_sim_compose up -d --no-build

    for _ in $(seq 1 60); do
      if curl -fsS "http://localhost:${sim_web_port}/api/health" >/dev/null; then
        break
      fi
      sleep 1
    done
    curl -fsS "http://localhost:${sim_web_port}/api/health" >/dev/null

    if [ "${SIM_RUN_PROD_SMOKE:-false}" = "true" ]; then
      PROD_SMOKE_ORIGIN="http://localhost:${sim_web_port}" \
        PROD_SMOKE_COMPOSE_PROJECT_NAME="${sim_project}" \
        PROD_SMOKE_COMPOSE_ENV_FILE="${tmp_env}" \
        PROD_SMOKE_COMPOSE_FILE="${compose_file}" \
        SUPER_ADMIN_USERNAME="admin" \
        SUPER_ADMIN_PASSWORD="${admin_password}" \
        ./scripts/prod-smoke/run.sh
    else
      BASE_URL="http://localhost:${sim_web_port}/api/v1" \
        ADMIN_USERNAME="admin" \
        ADMIN_PASSWORD="${admin_password}" \
        USE_BEARER="true" \
        python3 backend/scripts/smoke_typst_pipeline.py
    fi

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
    echo "usage: $0 <deploy|deploy-amd64|deploy-local|up|up-no-build|pull-up|verify-release-set|verify-local-images|build|push|down|down-v|logs|health|simulate|backup-db|restore-db|up-amd64|pull-up-amd64|build-amd64|push-amd64|simulate-amd64>" >&2
    exit 2
    ;;
esac
