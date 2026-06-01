#!/usr/bin/env bash
set -euo pipefail

MIGRATION_ROOTS=(accounts addresses carts category comparison coupons filters inventory_alerts orders recommendations store wishlist)
RISKY_PATTERNS=("DeleteModel" "RemoveField" "AlterField")
allow_risky="${ALLOW_RISKY_MIGRATIONS:-false}"

if [[ "${allow_risky}" == "true" ]]; then
  echo "Risky migration checks bypassed by ALLOW_RISKY_MIGRATIONS=true"
  exit 0
fi

for root in "${MIGRATION_ROOTS[@]}"; do
  if [[ ! -d "${root}/migrations" ]]; then
    continue
  fi
  for pattern in "${RISKY_PATTERNS[@]}"; do
    if rg -n "${pattern}" "${root}/migrations" -g "*.py" >/dev/null; then
      echo "Potentially backward-incompatible migration detected in ${root}/migrations (${pattern})."
      echo "Use expand/contract strategy or set ALLOW_RISKY_MIGRATIONS=true with explicit approval."
      exit 1
    fi
  done
done

echo "Migration compatibility guard passed"
