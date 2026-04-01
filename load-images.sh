#!/bin/bash
# 从本地缓存恢复 Docker 镜像（Docker 重启后使用）
set -euo pipefail

IMG_DIR="$(cd "$(dirname "$0")" && pwd)/data/docker-images"

if [ ! -d "$IMG_DIR" ]; then
  echo "镜像缓存目录不存在: $IMG_DIR"
  exit 1
fi

echo "==> 恢复基础镜像..."
for f in "$IMG_DIR"/*.tar.gz; do
  [ -f "$f" ] || continue
  echo "  Loading $(basename "$f")..."
  docker load < "$f"
done

echo "==> 恢复完成"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
