#!/usr/bin/env bash
set -euo pipefail

ENV_DIR="${1:?Environment directory required}"

if ! rg -n 'tags\s*=' "${ENV_DIR}/main.tf" >/dev/null; then
  echo "Policy check failed: tags must be passed into environment module."
  exit 1
fi

if rg -n 'publicly_accessible\s*=\s*true' infra/terraform/modules infra/terraform/environments >/dev/null; then
  echo "Policy check failed: publicly accessible database/resource found."
  exit 1
fi

if ! rg -n 'storage_encrypted\s*=\s*true|at_rest_encryption_enabled\s*=\s*true|encrypt\s*=\s*true' infra/terraform/modules infra/terraform/environments >/dev/null; then
  echo "Policy check failed: encryption controls not found."
  exit 1
fi

if ! rg -n 'name_prefix' "${ENV_DIR}/main.tf" >/dev/null; then
  echo "Policy check failed: naming prefix must be defined."
  exit 1
fi

echo "Custom Terraform policy checks passed for ${ENV_DIR}"
