#!/usr/bin/env bash
set -euo pipefail

: "${TARGET_URL:?TARGET_URL is required}"

echo "Running pre-deploy health check against ${TARGET_URL}"
curl -fsS "${TARGET_URL}/healthz/" >/dev/null

echo "Running dependency checks"
python --version
pip --version

echo "Pre-deploy checks passed"
