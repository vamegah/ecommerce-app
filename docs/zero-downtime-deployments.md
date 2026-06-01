# Zero-Downtime Deployment Runbook

## Scope

Task 6 implementation:

- Rolling deployment flow on ECS
- Pre-deploy health/dependency checks
- Automatic rollback path
- Migration safety guardrails
- Post-deploy smoke verification

## Workflow

- `.github/workflows/deploy-ecs-rolling.yml`

Key stages:

1. Pre-deploy checks (`predeploy_checks.sh`)
2. Migration compatibility guard (`verify_backward_compatible_migrations.sh`)
3. Capture currently running ECS task definitions
4. Register new task definitions
5. Run locked migration (`run_migrations_safe.sh`)
6. Rolling update and wait-for-stable (`deploy_ecs_rolling.sh`)
7. Smoke tests (`smoke_tests.sh`)
8. Auto rollback on failure (`rollback_ecs_services.sh`)

## Scripts

- `deploy/zero-downtime/scripts/predeploy_checks.sh`
- `deploy/zero-downtime/scripts/verify_backward_compatible_migrations.sh`
- `deploy/zero-downtime/scripts/deploy_ecs_rolling.sh`
- `deploy/zero-downtime/scripts/smoke_tests.sh`
- `deploy/zero-downtime/scripts/rollback_ecs_services.sh`

## Migration Guardrail Model

- Reject risky migration ops by default:
  - `DeleteModel`
  - `RemoveField`
  - `AlterField`
- Allow override only with explicit `ALLOW_RISKY_MIGRATIONS=true` and approval.

## Required Environment Secrets

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `ECS_CLUSTER`
- `ECS_SERVICE_WEB`
- `ECS_SERVICE_WORKER`
- `ECS_SERVICE_BEAT`
- `PUBLIC_BASE_URL`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
