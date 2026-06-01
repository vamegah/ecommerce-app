# Security Pipeline Runbook

## Scope

Task 9 implementation:

- SAST via CodeQL
- Dependency + container + IaC scanning
- Secret scanning with Gitleaks
- Optional DAST via OWASP ZAP baseline
- Security thresholds and exception workflow

## Workflows

- CodeQL: `.github/workflows/security-codeql.yml`
- Security scans: `.github/workflows/security-scans.yml`
- DAST (optional): `.github/workflows/security-dast-zap.yml`

## Scanners

- SAST: CodeQL (Python, JavaScript/TypeScript)
- Dependency: `pip-audit`, `npm audit`
- Container: Trivy SARIF scans
- Secrets: Gitleaks with `.gitleaks.toml`
- IaC: Checkov for `infra/terraform`
- DAST: ZAP baseline against staging

## Gate Policy

Gate script:

- `security/policy/enforce_security_gates.py`

Current behavior:

- Validates exception entries for required fields and non-expired status.
- Fails pipeline on warning/error Trivy SARIF findings.

## Exception Process

File:

- `security/exceptions/security-exceptions.yaml`

Required fields per exception:

- `id`
- `approved_by`
- `justification`
- `expires_on`

Exceptions must be time-bounded and reviewed before expiry.
