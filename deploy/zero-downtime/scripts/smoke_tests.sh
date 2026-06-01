#!/usr/bin/env bash
set -euo pipefail

: "${TARGET_URL:?TARGET_URL is required}"

echo "Running smoke tests against ${TARGET_URL}"

curl -fsS "${TARGET_URL}/healthz/" >/dev/null
curl -fsS "${TARGET_URL}/" >/dev/null
curl -fsS "${TARGET_URL}/store/" >/dev/null

echo "Smoke tests passed"
