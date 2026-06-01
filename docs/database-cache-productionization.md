# Database and Cache Productionization Runbook

## Scope

This runbook covers Task 2:

- PostgreSQL as primary database
- Redis cache/session backend
- Redis-backed Celery worker and scheduler
- Migration lock strategy
- Automated backup, restore drills, and freshness verification

## Environment Variables

Set in `/etc/greatkart/greatkart.env`:

- `DB_ENGINE=postgres`
- `POSTGRES_DB=greatkart`
- `POSTGRES_USER=greatkart`
- `POSTGRES_PASSWORD=<secret>`
- `POSTGRES_HOST=<host>`
- `POSTGRES_PORT=5432`
- `POSTGRES_CONN_MAX_AGE=60`
- `POSTGRES_SSLMODE=require`
- `CACHE_BACKEND=redis`
- `REDIS_URL=redis://<redis-host>:6379/1`
- `CELERY_BROKER_URL=redis://<redis-host>:6379/2`
- `CELERY_RESULT_BACKEND=redis://<redis-host>:6379/3`

## Service Units

Install and enable:

- `deploy/runtime/systemd/greatkart-celery-worker.service`
- `deploy/runtime/systemd/greatkart-celery-beat.service`
- `deploy/runtime/systemd/greatkart-postgres-backup.service`
- `deploy/runtime/systemd/greatkart-postgres-backup.timer`
- `deploy/runtime/systemd/greatkart-backup-verify.service`
- `deploy/runtime/systemd/greatkart-backup-verify.timer`

Commands:

- `sudo systemctl daemon-reload`
- `sudo systemctl enable --now greatkart-celery-worker greatkart-celery-beat`
- `sudo systemctl enable --now greatkart-postgres-backup.timer greatkart-backup-verify.timer`

## Migration Safety

Run migrations only through:

- `deploy/runtime/scripts/run_migrations_safe.sh`

This script acquires a PostgreSQL advisory lock before running `manage.py migrate`.

## Backup and Restore

- Daily backup script: `deploy/runtime/scripts/postgres_backup.sh`
- Restore drill script: `deploy/runtime/scripts/postgres_restore_drill.sh`
- Freshness verification: `deploy/runtime/scripts/verify_backup_freshness.sh`

## RTO / RPO Targets

- Target RPO: 24 hours (daily backup)
- Target RTO: 60 minutes (restore drill execution + app validation)

Review quarterly and tighten as business traffic grows.
