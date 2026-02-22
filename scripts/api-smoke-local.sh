#!/bin/bash
set -euo pipefail

BASE="${BASE:-http://localhost:8000}"
API="${API:-${BASE}/api/v1}"

curl -fsS "${BASE}/health" > /dev/null
echo "OK health"

code="$(curl -s -o /dev/null -w "%{http_code}" "${API}/auth/me" || true)"
echo "auth/me -> ${code}"

code="$(curl -s -o /dev/null -w "%{http_code}" "${API}/openapi.json" || true)"
echo "api openapi.json -> ${code}"

code="$(curl -s -o /dev/null -w "%{http_code}" "${API}/articles" || true)"
echo "articles -> ${code}"

code="$(curl -s -o /dev/null -w "%{http_code}" "${API}/categories" || true)"
echo "categories -> ${code}"
