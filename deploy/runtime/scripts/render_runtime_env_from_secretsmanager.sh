#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${SECRETS_MANAGER_SECRET_ID:?SECRETS_MANAGER_SECRET_ID is required}"

OUT_FILE="${1:-/run/greatkart/runtime.env}"
mkdir -p "$(dirname "${OUT_FILE}")"

SECRET_JSON="$(aws secretsmanager get-secret-value \
  --region "${AWS_REGION}" \
  --secret-id "${SECRETS_MANAGER_SECRET_ID}" \
  --query SecretString \
  --output text)"

python3 - "$OUT_FILE" "$SECRET_JSON" <<'PY'
import json
import shlex
import sys

out_file = sys.argv[1]
secret = json.loads(sys.argv[2])
with open(out_file, "w", encoding="utf-8") as f:
    for k, v in secret.items():
        if v is None:
            continue
        f.write(f"{k}={shlex.quote(str(v))}\n")
PY

chmod 600 "${OUT_FILE}"
