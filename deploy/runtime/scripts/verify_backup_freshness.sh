#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/greatkart/postgres}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-26}"

LATEST_FILE="$(find "${BACKUP_DIR}" -type f -name "greatkart_*.sql.gz" -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"

if [[ -z "${LATEST_FILE}" ]]; then
  echo "No backup files found in ${BACKUP_DIR}"
  exit 2
fi

NOW_EPOCH="$(date +%s)"
FILE_EPOCH="$(date -r "${LATEST_FILE}" +%s)"
AGE_HOURS="$(( (NOW_EPOCH - FILE_EPOCH) / 3600 ))"

if (( AGE_HOURS > MAX_AGE_HOURS )); then
  echo "Latest backup is stale (${AGE_HOURS}h old): ${LATEST_FILE}"
  exit 2
fi

echo "Backup freshness OK (${AGE_HOURS}h old): ${LATEST_FILE}"
