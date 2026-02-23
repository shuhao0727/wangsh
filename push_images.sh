#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-1.0.1}"
REGISTRY="shuhao07"

echo "==> Pushing images to ${REGISTRY} with version ${VERSION}..."

IMAGES=(
  "wangsh-backend"
  "wangsh-frontend"
  "wangsh-gateway"
  "wangsh-typst-worker"
  "wangsh-pythonlab-worker"
)

for IMG in "${IMAGES[@]}"; do
  echo "--> Pushing ${REGISTRY}/${IMG}:${VERSION} ..."
  docker push "${REGISTRY}/${IMG}:${VERSION}"
  
  echo "--> Pushing ${REGISTRY}/${IMG}:latest ..."
  docker push "${REGISTRY}/${IMG}:latest"
done

# Push sandbox image (Multi-Arch: amd64 + arm64)
# 沙箱镜像需要支持 x86_64 (amd64) 和 ARM64 (aarch64) 以兼容不同服务器
echo "--> Building and Pushing Multi-Arch Sandbox Image: ${REGISTRY}/pythonlab-sandbox:py311 ..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t "${REGISTRY}/pythonlab-sandbox:py311" \
  backend/docker/pythonlab-sandbox \
  --push

echo "==> All images pushed successfully."
