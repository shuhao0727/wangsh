#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${ROOT_DIR}/gateway/Caddyfile"
CADDY_IMAGE="${CADDY_IMAGE:-caddy:2.8.4}"

# server 级 write 必须是 0：write_timeout 是整个连接的绝对写截止时间，
# 30s（显式写或取默认 30s）会在第 3 个后端 keepalive 之前切断 SSE 长连接
# （浏览器报 ERR_INCOMPLETE_CHUNKED_ENCODING）。详见提交 c3a845a 与
# gateway/Caddyfile 顶部注释。route 级 transport write_timeout 由后面的
# 'write_timeout 30s' 单独覆盖，两者不是同一个东西。
for token in \
  'read_header 5s' \
  'read_body 30s' \
  'write 0' \
  'idle 2m' \
  'max_header_size 64KB' \
  'max_size 16MB' \
  'dial_timeout 5s' \
  'response_header_timeout 30s' \
  'read_timeout 60s' \
  'write_timeout 30s'; do
  grep -Fq "$token" "$CONFIG" || {
    echo "missing Caddy governance directive: $token" >&2
    exit 1
  }
done

# 反向断言：server 级 write 不允许写成非 0。上面的正断言是全文子串匹配，
# 若某处注释或其他块里再次出现 "write 0" 字样，仍可能被"误满足"；这里再按
# 行首指令形态卡一次，确保 c3a845a 之前的 `write 30s` 不会悄悄回来。
if grep -Eq '^[[:space:]]*write[[:space:]]+[1-9]' "$CONFIG"; then
  echo "server-level write must be 0 (non-zero write timeout would cut SSE streams)" >&2
  exit 1
fi

if ! grep -Eq '^[[:space:]]*request_body([[:space:]]|\{|$)' "$CONFIG"; then
  echo "missing site-wide request_body guard" >&2
  exit 1
fi

# Caddy OSS has no verified native general request-rate limiter in this image.
# Fail closed if an unverified/third-party-looking limiter is added silently.
if grep -Eq '^[[:space:]]*(rate_limit|rate-limit|rateLimit)([[:space:]]|\{|$)' "$CONFIG"; then
  echo "unsupported/unverified rate-limit directive in Caddyfile" >&2
  exit 1
fi

docker run --rm -i "$CADDY_IMAGE" caddy adapt \
  --config /dev/stdin --adapter caddyfile --validate < "$CONFIG" >/dev/null

echo "gateway Caddyfile contract: PASS"
