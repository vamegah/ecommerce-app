# Task 4 Checkpoint Evidence

Date: 2026-05-31

## 1) No filesystem `.env` production secrets

- Verify `/etc/greatkart/runtime-bootstrap.env` contains only region/secret-id pointers.
- Verify `/run/greatkart/runtime.env` is ephemeral and mode `0600`.
- Evidence: _pending in staging/prod_

## 2) App boots from managed secrets

- Restart:
  - `sudo systemctl restart greatkart-gunicorn greatkart-celery-worker greatkart-celery-beat`
- Validate:
  - `curl -fsS https://<domain>/healthz/`
- Evidence: _pending in staging/prod_

## 3) Secret rotation with no downtime

- Rotate via `deploy/runtime/scripts/rotate_secretsmanager_secret.sh`
- Perform rolling service restart
- Validate no user-facing outage
- Evidence: _pending in staging/prod_

## 4) Access audit logs

- Command:
  - `AWS_REGION=<region> SECRETS_MANAGER_SECRET_ID=greatkart/runtime/prod deploy/runtime/scripts/audit_secrets_access.sh`
- Evidence: _pending in staging/prod_

## 5) Artifact references

- `deploy/runtime/scripts/render_runtime_env_from_secretsmanager.sh`
- `deploy/runtime/scripts/rotate_secretsmanager_secret.sh`
- `deploy/runtime/scripts/audit_secrets_access.sh`
- `deploy/runtime/security/iam/least-privilege-secrets-policy.json`
- `docs/secrets-configuration-management.md`
