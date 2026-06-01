# Terraform Infrastructure

## Layout

- `modules/`: reusable building blocks
  - `networking`, `compute`, `database`, `cache`, `storage`, `dns`, `tls`, `iam`, `environment`
- `environments/`: environment-specific stacks
  - `dev`, `staging`, `prod`
- `policy/`: policy and scanning configuration

## Remote State

Each environment uses an S3 backend with DynamoDB locking:

- `backend.hcl.example` in each environment directory
- Required:
  - encrypted S3 bucket for state
  - DynamoDB lock table

## Usage

```bash
cd infra/terraform/environments/staging
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl
terraform plan
```

## CI/CD

- Plan workflow: `.github/workflows/terraform-plan.yml`
- Apply workflow: `.github/workflows/terraform-apply.yml`

Both workflows run format/validate/security/policy checks before plans/applies.
