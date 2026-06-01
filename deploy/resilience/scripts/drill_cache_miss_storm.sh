#!/usr/bin/env bash
set -euo pipefail

: "${REDIS_HOST:?REDIS_HOST required}"
: "${REDIS_PORT:?REDIS_PORT required}"

echo "Simulating cache miss storm by flushing cache and probing app."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" FLUSHALL >/dev/null

: "${TARGET_URL:?TARGET_URL required}"
for i in $(seq 1 100); do
  curl -fsS "${TARGET_URL}/" >/dev/null
done

echo "Cache miss storm drill completed."
