# Task 2 Checkpoint Evidence

Date: 2026-05-31

## 1) PostgreSQL-only verification

- Command: `python manage.py diffsettings | grep DATABASES`
- Evidence: _pending in staging/prod_

## 2) Redis cache/session verification

- Commands:
  - `python manage.py shell -c "from django.core.cache import cache; cache.set('health','ok',60); print(cache.get('health'))"`
  - `redis-cli -u $REDIS_URL ping`
- Evidence: _pending in staging/prod_

## 3) Backup and restore drill verification

- Commands:
  - `deploy/runtime/scripts/postgres_backup.sh`
  - `BACKUP_FILE=<latest_backup> deploy/runtime/scripts/postgres_restore_drill.sh`
- Evidence: _pending in staging/prod_

## 4) Worker/scheduler restart verification

- Commands:
  - `sudo systemctl restart greatkart-celery-worker greatkart-celery-beat`
  - `sudo systemctl status greatkart-celery-worker greatkart-celery-beat`
- Evidence: _pending in staging/prod_

## 5) Backup freshness alert verification

- Commands:
  - `sudo systemctl start greatkart-backup-verify.service`
  - `sudo journalctl -u greatkart-backup-verify.service -n 100 --no-pager`
- Evidence: _pending in staging/prod_
