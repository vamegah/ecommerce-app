# Infrastructure as Code Runbook

## Scope

Task 7 implementation:

- Terraform root module composition
- Reusable `dev/staging/prod` environment stacks
- Remote state with locking/encryption
- Plan/apply workflows with approval gates
- Policy checks for naming/tagging/encryption/public exposure

## Key Paths

- Root: `infra/terraform`
- Modules: `infra/terraform/modules/*`
- Environments:
  - `infra/terraform/environments/dev`
  - `infra/terraform/environments/staging`
  - `infra/terraform/environments/prod`
- Policies:
  - `infra/terraform/policy/checkov.yaml`
  - `infra/terraform/policy/validate_tf_policies.sh`

## Workflows

- Plan: `.github/workflows/terraform-plan.yml`
- Apply: `.github/workflows/terraform-apply.yml`

## Governance

- Remote state backend uses encrypted S3 and DynamoDB lock table.
- `terraform-apply-*` environments should require manual approvals, especially production.
- Policy checks run in CI:
  - `terraform fmt`
  - `terraform validate`
  - `tflint`
  - `checkov`
  - custom policy script
