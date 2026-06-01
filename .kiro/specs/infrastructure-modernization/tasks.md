# Infrastructure Modernization Epic

## Objective

Deliver a production-grade infrastructure platform for Great Kart Ecommerce covering security, reliability, scalability, observability, and safe delivery practices.

## Task Breakdown

- [ ] 1. Runtime Stack Hardening
  - [x] 1.1 Provision production host baseline (Ubuntu LTS, non-root deploy user, SSH hardening)
  - [x] 1.2 Deploy Django with `gunicorn` behind `nginx`
  - [x] 1.3 Manage services with `systemd` (`gunicorn`, `nginx`, workers/schedulers)
  - [x] 1.4 Configure TLS certificates and auto-renewal using Let's Encrypt
  - [x] 1.5 Add strict HTTP security headers (HSTS, CSP baseline, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
  - [x] 1.6 Install and tune `fail2ban` for SSH and web auth endpoints
  - [x] 1.7 Add hardening runbook and recovery procedures
  - [ ] 1.8 Checkpoint: Validate hardened runtime before Task 2
    - [ ] Confirm TLS grade is acceptable (A/A+) and cert auto-renew works
    - [ ] Confirm `gunicorn`/`nginx`/`systemd` restart cleanly and survive reboot
    - [ ] Confirm security headers are present on key routes
    - [ ] Confirm fail2ban bans are triggered in controlled test
    - [ ] Record evidence links/logs in deployment notes

- [ ] 2. Database and Cache Productionization
  - [x] 2.1 Migrate from SQLite to PostgreSQL with environment-specific settings
  - [x] 2.2 Add Redis for cache/session backend
  - [x] 2.3 Add Redis-backed background job execution (worker + scheduler)
  - [x] 2.4 Add DB migration safety checks and locking strategy
  - [x] 2.5 Configure automated PostgreSQL backups (daily + retention policy)
  - [x] 2.6 Configure restore drill pipeline and document RTO/RPO
  - [x] 2.7 Add backup verification alerts
  - [ ] 2.8 Checkpoint: Validate data layer reliability before Task 3
    - [ ] Confirm all app flows run on PostgreSQL (no SQLite fallback)
    - [ ] Confirm Redis-backed cache/session functionality under load
    - [ ] Run backup and full restore drill in staging with timing captured
    - [ ] Confirm worker/scheduler jobs execute and recover from restart
    - [ ] Record evidence links/logs in deployment notes

- [ ] 3. Containerization and Orchestration
  - [x] 3.1 Create production-ready Dockerfile(s) for Django app and worker
  - [x] 3.2 Add `docker-compose` for local parity (app, db, redis, nginx)
  - [x] 3.3 Publish versioned images through CI
  - [x] 3.4 Choose orchestrator target (ECS/Fargate, Fly.io, Render, or Kubernetes) and document rationale
  - [x] 3.5 Implement deploy manifests/service definitions for selected platform
  - [x] 3.6 Add container health probes and resource limits
  - [ ] 3.7 Checkpoint: Validate container runtime before Task 4
    - [ ] Confirm reproducible image builds from CI tags
    - [ ] Confirm health probes gate unhealthy instances
    - [ ] Confirm scaling one instance down does not cause downtime
    - [ ] Confirm resource limits do not break baseline traffic
    - [ ] Record evidence links/logs in deployment notes

- [ ] 4. Secrets and Configuration Management
  - [x] 4.1 Move environment secrets to GitHub Environments for CI/CD
  - [x] 4.2 Integrate cloud secret manager (AWS/GCP equivalent) for runtime secrets
  - [x] 4.3 Remove `.env` dependency from production servers
  - [x] 4.4 Implement key/secret rotation process and schedule
  - [x] 4.5 Add access audit controls and least-privilege policy
  - [ ] 4.6 Checkpoint: Validate secret handling before Task 5
    - [ ] Confirm no production secrets on filesystem `.env`
    - [ ] Confirm app boots using managed secrets only
    - [ ] Perform one secret rotation without service interruption
    - [ ] Confirm audit logs capture secret access events
    - [ ] Record evidence links/logs in deployment notes

- [ ] 5. Observability
  - [x] 5.1 Add centralized structured logging (CloudWatch/Loki/ELK)
  - [x] 5.2 Add metrics collection and dashboards (Prometheus + Grafana or managed equivalent)
  - [x] 5.3 Add application error tracking with Sentry
  - [x] 5.4 Configure uptime checks and synthetic probes
  - [x] 5.5 Route alerts to Slack/PagerDuty with severity levels and on-call ownership
  - [x] 5.6 Add golden signals dashboard (latency, traffic, errors, saturation)
  - [ ] 5.7 Checkpoint: Validate observability before Task 6
    - [ ] Confirm logs, metrics, and traces/errors correlate for one request path
    - [ ] Trigger test alerts for warning and critical severities
    - [ ] Confirm on-call notifications reach expected destination
    - [ ] Confirm dashboards show golden signals for staging and prod
    - [ ] Record evidence links/logs in deployment notes

- [ ] 6. Zero-Downtime Deployment Strategy
  - [x] 6.1 Implement rolling or blue/green deployment flow
  - [x] 6.2 Add pre-deploy health and dependency checks
  - [x] 6.3 Add automatic rollback on failed health checks
  - [x] 6.4 Add migration guardrails (expand/contract migrations, backward compatibility checks)
  - [x] 6.5 Add deployment verification tests (smoke + critical path)
  - [ ] 6.6 Checkpoint: Validate release safety before Task 7
    - [ ] Execute controlled deploy with zero customer-visible downtime
    - [ ] Force health-check failure and confirm auto-rollback
    - [ ] Run migration safety gate against backward-incompatible test case
    - [ ] Confirm smoke tests gate promotion successfully
    - [ ] Record evidence links/logs in deployment notes

- [ ] 7. Infrastructure as Code
  - [x] 7.1 Create Terraform root modules for networking, compute, DB, cache, storage, DNS, TLS, IAM
  - [x] 7.2 Create reusable environment modules (`dev`, `staging`, `prod`)
  - [x] 7.3 Add remote Terraform state with locking and encryption
  - [x] 7.4 Add Terraform plan/apply workflows with approval gates
  - [x] 7.5 Add policy checks (naming, tagging, encryption, public exposure rules)
  - [ ] 7.6 Checkpoint: Validate IaC governance before Task 8
    - [ ] Confirm `terraform plan` is clean and deterministic per environment
    - [ ] Confirm remote state locking prevents concurrent apply
    - [ ] Confirm policy checks fail on intentional violations
    - [ ] Confirm manual approval is required for production apply
    - [ ] Record evidence links/logs in deployment notes

- [ ] 8. Environment Strategy
  - [x] 8.1 Define clear `dev/staging/prod` isolation (data, secrets, services, DNS)
  - [x] 8.2 Enforce branch protections and required CI checks
  - [x] 8.3 Require manual approvals for production deployment
  - [x] 8.4 Create ephemeral preview environments for pull requests
  - [x] 8.5 Auto-destroy preview environments on PR close/merge
  - [ ] 8.6 Checkpoint: Validate environment workflow before Task 9
    - [ ] Confirm dev/staging/prod isolation and DNS boundaries
    - [ ] Confirm branch protection blocks unverified merges
    - [ ] Confirm PR preview env auto-create and auto-destroy works
    - [ ] Confirm prod deployment requires designated approvers
    - [ ] Record evidence links/logs in deployment notes

- [ ] 9. Security Pipeline
  - [x] 9.1 Add SAST (CodeQL)
  - [x] 9.2 Add dependency vulnerability scanning (pip/npm + container scan with Trivy)
  - [x] 9.3 Add secret scanning (Gitleaks)
  - [x] 9.4 Add IaC security scanning for Terraform
  - [x] 9.5 Optionally add DAST (OWASP ZAP baseline) against staging
  - [x] 9.6 Add security gate thresholds and exception workflow
  - [ ] 9.7 Checkpoint: Validate security gates before Task 10
    - [ ] Confirm high-severity findings fail pipeline by policy
    - [ ] Confirm secret scan catches seeded test secret
    - [ ] Confirm container and dependency scans produce actionable reports
    - [ ] Confirm exception workflow requires review + expiry date
    - [ ] Record evidence links/logs in deployment notes

- [ ] 10. Performance and Resilience
  - [x] 10.1 Move media/static delivery to CDN (CloudFront/Cloudflare)
  - [x] 10.2 Store media assets in object storage (S3-compatible)
  - [x] 10.3 Add app/API rate limiting and abuse controls
  - [x] 10.4 Add WAF rules for common attack classes
  - [x] 10.5 Configure autoscaling policies and capacity alarms
  - [x] 10.6 Add load test baseline and performance budgets
  - [x] 10.7 Run resilience drills (dependency outage, DB failover, cache miss storm)
  - [ ] 10.8 Checkpoint: Final production readiness sign-off
    - [ ] Confirm CDN/object storage cutover with no broken media links
    - [ ] Confirm autoscaling reacts within defined thresholds
    - [ ] Confirm WAF/rate limiting blocks abuse patterns without false positives
    - [ ] Confirm load tests meet performance budgets
    - [ ] Confirm resilience drills meet recovery objectives
    - [ ] Publish final sign-off report with risks and mitigations

## Milestone Acceptance Criteria

- [ ] M1: Secure runtime operational in staging with TLS, hardened headers, and fail2ban
- [ ] M2: PostgreSQL + Redis live with tested backup/restore and background jobs
- [ ] M3: Containerized deployment running via selected orchestration platform
- [ ] M4: Secrets fully managed via GitHub Environments + cloud secret manager
- [ ] M5: Full observability and actionable alerting in place
- [ ] M6: Zero-downtime deployments with rollback and migration safety
- [ ] M7: Terraform-driven infra lifecycle with approval gates
- [ ] M8: Environment governance + preview environments active
- [ ] M9: Security scanning pipeline enforcing quality gates
- [ ] M10: Performance/resilience controls validated by load and failure drills

## Notes

- Sequence recommendation: `1 -> 2 -> 4 -> 3 -> 7 -> 6 -> 5 -> 8 -> 9 -> 10`
- Keep staging as the proving ground before production promotion.
