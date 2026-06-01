# Performance and Resilience Runbook

## Scope

Task 10 implementation:

- CDN path and media/object storage configuration
- App/API rate limiting and abuse controls
- WAF integration
- Autoscaling and capacity alarms
- Load test baseline and performance budgets
- Resilience drills

## App Configuration

- Rate limiting middleware:
  - `greatkartecommerce/rate_limit.py`
- Settings updates:
  - `RATE_LIMIT_ENABLED`
  - `RATE_LIMIT_WINDOW_SECONDS`
  - `RATE_LIMIT_MAX_REQUESTS`
  - `CDN_DOMAIN`
  - `USE_S3_MEDIA`
  - `AWS_STORAGE_BUCKET_NAME`
  - `AWS_S3_CUSTOM_DOMAIN`

## Terraform Modules

- CDN: `infra/terraform/modules/cdn`
- WAF: `infra/terraform/modules/waf`
- Autoscaling + alarms: `infra/terraform/modules/autoscaling`
- Wired in: `infra/terraform/modules/environment/main.tf`

## Load Test Baseline

- Script: `performance/k6/load-baseline.js`
- Workflow: `.github/workflows/performance-load-baseline.yml`

### Baseline Budgets

- `http_req_failed < 1%`
- `p95 < 750ms`
- `p99 < 1500ms`

## Resilience Drills

- Dependency outage:
  - `deploy/resilience/scripts/drill_dependency_outage.sh`
- DB failover:
  - `deploy/resilience/scripts/drill_db_failover.sh`
- Cache miss storm:
  - `deploy/resilience/scripts/drill_cache_miss_storm.sh`

Run these in staging first, then production during maintenance windows with on-call coverage.
