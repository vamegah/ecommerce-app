# Observability Runbook

## Scope

Task 5 implementation:

- Centralized structured logging
- Metrics scraping and dashboards
- Error tracking with Sentry
- Synthetic uptime checks
- Alert routing to Slack/PagerDuty
- Golden signals dashboard

## Application Wiring

- Request log middleware:
  - `greatkartecommerce/observability.py`
- Structured logging + Sentry setup:
  - `greatkartecommerce/settings.py`
- Endpoints:
  - `/healthz/`
  - `/metrics/`

## Platform Config

- Prometheus:
  - `deploy/observability/prometheus/prometheus.yml`
  - `deploy/observability/prometheus/alerts/greatkart-alerts.yml`
- Alertmanager:
  - `deploy/observability/alertmanager/alertmanager.yml`
- Loki/Promtail:
  - `deploy/observability/loki/promtail-config.yml`
- Grafana dashboard:
  - `deploy/observability/grafana/dashboards/greatkart-golden-signals.json`

## Sentry

Runtime environment variables:

- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SENTRY_PROFILES_SAMPLE_RATE`

## Uptime Checks

Workflow:

- `.github/workflows/synthetic-uptime.yml`

Required environment secrets:

- `STAGING_PUBLIC_URL`
- `PROD_PUBLIC_URL`

## Alert Routing

Alertmanager routes:

- Warning -> Slack (`SLACK_WEBHOOK_URL`)
- Critical -> PagerDuty (`PAGERDUTY_ROUTING_KEY`)
