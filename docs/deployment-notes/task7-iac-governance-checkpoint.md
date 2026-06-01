# Task 7 Checkpoint Evidence

Date: 2026-05-31

## 1) Deterministic terraform plan

- Run `terraform plan` twice per environment and compare outputs
- Evidence: _pending in dev/staging/prod_

## 2) Remote state lock protection

- Start concurrent apply attempts and verify lock contention
- Evidence: _pending in dev/staging/prod_

## 3) Policy checks enforce failures

- Introduce intentional violation (e.g. public DB flag / missing tags)
- Confirm CI fails on policy checks
- Evidence: _pending in CI_

## 4) Manual approval gate for prod apply

- Verify `terraform-apply-prod` environment requires explicit reviewer approval
- Evidence: _pending in GitHub environment settings_

## 5) Artifact references

- `infra/terraform/**`
- `.github/workflows/terraform-plan.yml`
- `.github/workflows/terraform-apply.yml`
- `docs/infrastructure-as-code.md`
