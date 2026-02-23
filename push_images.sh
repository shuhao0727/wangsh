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

echo "==> All images pushed successfully."
