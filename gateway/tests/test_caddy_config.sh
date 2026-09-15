#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${ROOT_DIR}/gateway/Caddyfile"
CADDY_IMAGE="${CADDY_IMAGE:-caddy:2.8.4}"

for token in \
  'read_header 5s' \
  'read_body 30s' \
  'write 30s' \
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
