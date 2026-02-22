# pythonlab-sandbox 镜像

本目录用于构建 PythonLab 调试沙箱镜像（V2：Docker + debugpy）。

## 构建

在仓库根目录执行：

```bash
docker build --build-arg http_proxy= --build-arg https_proxy= --build-arg HTTP_PROXY= --build-arg HTTPS_PROXY= --build-arg all_proxy= --build-arg ALL_PROXY= -t pythonlab-sandbox:py311 backend/docker/pythonlab-sandbox
```
