# Task 6 Checkpoint Evidence

Date: 2026-05-31

## 1) Controlled zero-downtime deploy

- Execute `.github/workflows/deploy-ecs-rolling.yml` to staging
- Validate no customer-facing 5xx spike during rollout
- Evidence: _pending in staging/prod_

## 2) Forced health-check failure and auto rollback

- Deploy a canary image with known failing `/healthz/`
- Confirm workflow runs rollback job and restores previous task defs
- Evidence: _pending in staging/prod_

## 3) Migration guard against incompatible changes

- Introduce test migration with forbidden op
- Confirm guard script blocks release
- Evidence: _pending in staging/prod_

## 4) Smoke test gate

- Confirm `smoke_tests.sh` blocks promotion on route failure
- Evidence: _pending in staging/prod_

## 5) Artifact references

- `.github/workflows/deploy-ecs-rolling.yml`
- `deploy/zero-downtime/scripts/*`
- `docs/zero-downtime-deployments.md`
