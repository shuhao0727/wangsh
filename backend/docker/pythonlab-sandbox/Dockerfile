ARG PYTHON_IMAGE=public.ecr.aws/docker/library/python:3.11-slim
FROM ${PYTHON_IMAGE}

ARG PIP_INDEX_URL=https://pypi.org/simple
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV http_proxy=
ENV https_proxy=
ENV HTTP_PROXY=
ENV HTTPS_PROXY=
ENV all_proxy=
ENV ALL_PROXY=
ENV NO_PROXY=

RUN apt-get -o Acquire::Retries=5 -o Acquire::http::Proxy=false -o Acquire::https::Proxy=false update \
    && apt-get -o Acquire::Retries=5 -o Acquire::http::Proxy=false -o Acquire::https::Proxy=false install -y --no-install-recommends tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy -u ALL_PROXY \
    pip install --retries 5 --timeout 30 debugpy==1.8.1

RUN useradd -m -u 1000 sandbox
USER 1000:1000

ENTRYPOINT ["/usr/bin/tini", "--"]
WORKDIR /workspace
