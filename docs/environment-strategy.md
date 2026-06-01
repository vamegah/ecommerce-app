# Environment Strategy Runbook

## Scope

Task 8 implementation:

- Isolated `dev`, `staging`, `prod` infrastructure stacks
- Branch protection and required CI gates
- Manual approvals for production changes
- Ephemeral preview environments for PRs
- Auto-destroy preview environments on PR close

## Isolation Model

Terraform environment stacks:

- `infra/terraform/environments/dev`
- `infra/terraform/environments/staging`
- `infra/terraform/environments/prod`
- `infra/terraform/environments/preview`

Each environment has separate state keys, tags, and domain records.

## Branch Protections

Use:

- `scripts/github/set_branch_protection.sh main`

Requires:

- `GITHUB_TOKEN`
- `GITHUB_REPOSITORY` (`owner/repo`)

This enforces required CI checks and PR reviews before merge.

## Production Approval Gates

Set required reviewers for these GitHub Environments:

- `production`
- `terraform-apply-prod`

## Preview Environments

Create/update on PR:

- `.github/workflows/preview-environment.yml`

Destroy on PR close:

- `.github/workflows/preview-destroy.yml`

Preview URL pattern:

- `https://pr-<number>.preview.example.com`

## Required Preview Secrets

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `TF_STATE_BUCKET`
- `TF_LOCK_TABLE`
- `PREVIEW_SECURITY_GROUP_ID`
- `PREVIEW_DB_PASSWORD`
- `PREVIEW_ZONE_ID`
- `PREVIEW_ALB_DNS_NAME`
- `PREVIEW_ALB_ZONE_ID`
- `PREVIEW_WEB_TASKDEF_ARN`
