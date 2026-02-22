FROM python:3.11-slim

ENV http_proxy=
ENV https_proxy=
ENV HTTP_PROXY=
ENV HTTPS_PROXY=
ENV all_proxy=
ENV ALL_PROXY=
ENV NO_PROXY=

RUN http_proxy= https_proxy= HTTP_PROXY= HTTPS_PROXY= all_proxy= ALL_PROXY= NO_PROXY= pip install --no-cache-dir --index-url https://pypi.org/simple debugpy==1.8.1

RUN useradd -m -u 1000 sandbox
USER 1000:1000

WORKDIR /workspace
