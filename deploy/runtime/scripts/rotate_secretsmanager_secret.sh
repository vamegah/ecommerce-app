#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${SECRETS_MANAGER_SECRET_ID:?SECRETS_MANAGER_SECRET_ID is required}"
: "${NEW_SECRET_JSON:?NEW_SECRET_JSON is required}"

aws secretsmanager put-secret-value \
  --region "${AWS_REGION}" \
  --secret-id "${SECRETS_MANAGER_SECRET_ID}" \
  --secret-string "${NEW_SECRET_JSON}"

echo "Secret value rotated for ${SECRETS_MANAGER_SECRET_ID}"
