# 镜像与 Tag 约定

该项目生产部署使用 Docker Hub 镜像（默认 namespace：shuhao07）：

- `shuhao07/wangsh-backend:<tag>`
- `shuhao07/wangsh-frontend:<tag>`
- `shuhao07/wangsh-typst-worker:<tag>`

推荐：

- 生产部署建议用固定版本号（例如 `IMAGE_TAG=1.0.2`）
- 需要始终拉最新时用 `IMAGE_TAG=latest`
