#!/usr/bin/env bash
set -euo pipefail

: "${PR_NUMBER:?PR_NUMBER is required}"
: "${AWS_REGION:?AWS_REGION is required}"
: "${TF_STATE_BUCKET:?TF_STATE_BUCKET is required}"
: "${TF_LOCK_TABLE:?TF_LOCK_TABLE is required}"

WORKDIR="infra/terraform/environments/preview"
cd "${WORKDIR}"

terraform init \
  -backend-config="bucket=${TF_STATE_BUCKET}" \
  -backend-config="key=previews/pr-${PR_NUMBER}.tfstate" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="dynamodb_table=${TF_LOCK_TABLE}" \
  -backend-config="encrypt=true" \
  -input=false

if [[ ! -f terraform.tfvars ]]; then
  echo "terraform.tfvars missing; nothing to destroy safely."
  exit 0
fi

terraform destroy -input=false -auto-approve
