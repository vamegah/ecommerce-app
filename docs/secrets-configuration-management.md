# Secrets and Configuration Management Runbook

## Scope

This runbook covers Task 4:

- GitHub Environments for CI/CD secret injection
- AWS Secrets Manager for runtime secret retrieval
- No persistent `.env` secrets on application servers
- Key rotation process
- Access auditing and least-privilege controls

## GitHub Environments

Create environments:

- `ci`
- `shared-deploy`
- `staging`
- `production`

Add secrets:

- `CI_SECRET_KEY`
- `CI_EMAIL_HOST_USER`
- `CI_EMAIL_HOST_PASSWORD`
- `CD_SECRET_KEY`
- `CD_EMAIL_HOST_USER`
- `CD_EMAIL_HOST_PASSWORD`
- Existing deploy secrets for staging/production SSH

## Runtime Secret Loading

Services use:

- `deploy/runtime/scripts/render_runtime_env_from_secretsmanager.sh`

Bootstrap file with non-secret pointers only:

- `/etc/greatkart/runtime-bootstrap.env`
  - `AWS_REGION=<region>`
  - `SECRETS_MANAGER_SECRET_ID=greatkart/runtime/prod`

Generated runtime file:

- `/run/greatkart/runtime.env` (ephemeral, mode `0600`)

## Rotation Procedure

1. Prepare updated JSON payload for runtime secret.
2. Run:
   - `NEW_SECRET_JSON='<json>' AWS_REGION=<region> SECRETS_MANAGER_SECRET_ID=greatkart/runtime/prod deploy/runtime/scripts/rotate_secretsmanager_secret.sh`
3. Restart services:
   - `sudo systemctl restart greatkart-gunicorn greatkart-celery-worker greatkart-celery-beat`
4. Validate app health and background task processing.

## Access Auditing

- Least-privilege IAM template:
  - `deploy/runtime/security/iam/least-privilege-secrets-policy.json`
- Audit access events:
  - `AWS_REGION=<region> SECRETS_MANAGER_SECRET_ID=greatkart/runtime/prod deploy/runtime/scripts/audit_secrets_access.sh`

## Server Policy

- Do not store production secrets in `.env` on server disks.
- Keep only non-secret metadata in `/etc/greatkart/runtime-bootstrap.env`.
- Restrict service role access to only required secret paths and KMS keys.
