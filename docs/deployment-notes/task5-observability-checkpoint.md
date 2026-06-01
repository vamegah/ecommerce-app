# Task 5 Checkpoint Evidence

Date: 2026-05-31

## 1) Correlated logs + metrics + errors

- Validate a single request path across:
  - structured app logs
  - Prometheus metrics
  - Sentry event stream
- Evidence: _pending in staging/prod_

## 2) Warning and critical test alerts

- Trigger Prometheus test alerts for both severities
- Confirm Alertmanager routes:
  - warning -> Slack
  - critical -> PagerDuty
- Evidence: _pending in staging/prod_

## 3) On-call delivery

- Confirm alert receipt by expected on-call channel/escalation policy
- Evidence: _pending in staging/prod_

## 4) Golden signals dashboards

- Confirm dashboard availability and data for staging and production
- Evidence: _pending in staging/prod_

## 5) Artifact references

- `greatkartecommerce/observability.py`
- `greatkartecommerce/settings.py`
- `deploy/observability/*`
- `.github/workflows/synthetic-uptime.yml`
- `docs/observability.md`
