#!/usr/bin/env bash
set -euo pipefail

read_env_value() {
  local key="$1"
  local file="${2:-.env}"
  if [ ! -f "${file}" ]; then
    return 0
  fi
  awk -F= -v k="${key}" '$0 ~ ("^"k"=") {sub("^"k"=",""); print; exit}' "${file}" 2>/dev/null || true
}

VERSION="${1:-}"
if [ -z "${VERSION}" ]; then
  VERSION="$(read_env_value "APP_VERSION" ".env")"
fi
if [ -z "${VERSION}" ]; then
  VERSION="unknown"
fi

REGISTRY="${DOCKERHUB_NAMESPACE:-$(read_env_value "DOCKERHUB_NAMESPACE" ".env")}"
if [ -z "${REGISTRY}" ]; then
  REGISTRY="shuhao07"
fi
PLATFORM="linux/amd64"

echo "==> Using VERSION=${VERSION}, PLATFORM=${PLATFORM}"
echo "==> Ensure docker buildx is available..."
docker buildx version >/dev/null 2>&1 || { echo "docker buildx is required"; exit 1; }

echo "==> Building backend (runtime) ..."
docker buildx build \
  --platform "${PLATFORM}" \
  --target backend_runtime \
  -t "${REGISTRY}/wangsh-backend:${VERSION}" \
  -t "${REGISTRY}/wangsh-backend:latest" \
  -f backend/Dockerfile.prod \
  --load \
  backend

echo "==> Building typst-worker ..."
docker buildx build \
  --platform "${PLATFORM}" \
  --target worker_runtime \
  -t "${REGISTRY}/wangsh-typst-worker:${VERSION}" \
  -t "${REGISTRY}/wangsh-typst-worker:latest" \
  -f backend/Dockerfile.prod \
  --load \
  backend

echo "==> Building pythonlab-worker ..."
docker buildx build \
  --platform "${PLATFORM}" \
  --target worker_runtime \
  -t "${REGISTRY}/wangsh-pythonlab-worker:${VERSION}" \
  -t "${REGISTRY}/wangsh-pythonlab-worker:latest" \
  -f backend/Dockerfile.prod \
  --load \
  backend

echo "==> Building pythonlab-sandbox (Multi-Arch) ..."
# 注意：沙箱镜像需要在生产环境支持 amd64 (x86_64) 和 arm64 (aarch64)
# 但 docker buildx load 不支持多架构同时加载，所以我们这里只构建本地架构用于测试
# 真正的多架构构建和推送在 push_images.sh 中进行
docker buildx build \
  --platform "${PLATFORM}" \
  -t "${REGISTRY}/pythonlab-sandbox:py311" \
  backend/docker/pythonlab-sandbox \
  --load

echo "==> Building frontend ..."
docker buildx build \
  --platform "${PLATFORM}" \
  -t "${REGISTRY}/wangsh-frontend:${VERSION}" \
  -t "${REGISTRY}/wangsh-frontend:latest" \
  --build-arg REACT_APP_VERSION="${VERSION}" \
  -f frontend/Dockerfile.prod \
  --load \
  frontend

echo "==> Building gateway ..."
docker buildx build \
  --platform "${PLATFORM}" \
  -t "${REGISTRY}/wangsh-gateway:${VERSION}" \
  -t "${REGISTRY}/wangsh-gateway:latest" \
  -f gateway/Dockerfile \
  --load \
  gateway

echo "==> Done. Local images built and loaded:"

IMAGES=(
  "wangsh-backend"
  "wangsh-frontend"
  "wangsh-gateway"
  "wangsh-typst-worker"
  "wangsh-pythonlab-worker"
  "pythonlab-sandbox:py311"
)

for IMG in "${IMAGES[@]}"; do
  echo "--> Checking ${IMG} ..."
  if [[ "${IMG}" == "pythonlab-sandbox:py311" ]]; then
     docker images | grep -E "pythonlab-sandbox" | grep "py311" || true
  else
     docker images | grep -E "wangsh-(backend|frontend|gateway|typst-worker|pythonlab-worker)" | grep "${VERSION}" || true
  fi
done
