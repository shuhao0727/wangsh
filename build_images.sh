#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-1.0.1}"
REGISTRY="shuhao07"
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
docker images | grep -E "wangsh-(backend|frontend|gateway|typst-worker|pythonlab-worker)" | grep "${VERSION}" || true
