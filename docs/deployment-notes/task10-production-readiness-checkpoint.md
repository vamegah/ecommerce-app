# Task 10 Checkpoint Evidence

Date: 2026-05-31

## 1) CDN/object storage cutover

- Confirm static/media served from CDN domain
- Confirm no broken media URLs
- Evidence: _pending_

## 2) Autoscaling responsiveness

- Trigger load above CPU target and verify scale-out
- Verify scale-in after cooldown
- Evidence: _pending_

## 3) WAF/rate-limiting effectiveness

- Execute abuse simulation and verify blocking
- Validate low false positives on normal traffic
- Evidence: _pending_

## 4) Load-test budget compliance

- Run `performance-load-baseline` workflow
- Verify thresholds pass
- Evidence: _pending_

## 5) Resilience objectives

- Run three drills:
  - dependency outage
  - DB failover
  - cache miss storm
- Record recovery times and compare to targets
- Evidence: _pending_
