#!/usr/bin/env bash
set -euo pipefail

if [[ "${DB_ENGINE:-}" != "postgres" ]]; then
  echo "DB_ENGINE must be postgres for migration lock strategy."
  exit 1
fi

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_PORT:?POSTGRES_PORT is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

LOCK_KEY="${MIGRATION_LOCK_KEY:-84214621}"
WORKDIR="${WORKDIR:-/opt/greatkart/current}"
PYTHON_BIN="${PYTHON_BIN:-/opt/greatkart/venv/bin/python}"

export PGPASSWORD="${POSTGRES_PASSWORD}"

LOCK_RESULT="$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT pg_try_advisory_lock(${LOCK_KEY});")"
if [[ "${LOCK_RESULT}" != "t" ]]; then
  echo "Could not acquire migration advisory lock ${LOCK_KEY}. Aborting."
  exit 1
fi

cleanup() {
  psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT pg_advisory_unlock(${LOCK_KEY});" >/dev/null
}
trap cleanup EXIT

cd "${WORKDIR}"
"${PYTHON_BIN}" manage.py migrate --plan
"${PYTHON_BIN}" manage.py migrate --noinput
"${PYTHON_BIN}" manage.py check --deploy
