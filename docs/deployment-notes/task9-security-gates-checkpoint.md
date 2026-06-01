# Task 9 Checkpoint Evidence

Date: 2026-05-31

## 1) High-severity policy enforcement

- Trigger known high/critical finding in a test branch
- Confirm security pipeline fails
- Evidence: _pending_

## 2) Secret scan seeded test

- Add seeded fake secret in test branch
- Confirm Gitleaks fails pipeline
- Evidence: _pending_

## 3) Dependency/container actionable reports

- Confirm artifacts uploaded for:
  - `pip-audit`
  - `npm audit`
  - Trivy SARIF
- Evidence: _pending_

## 4) Exception workflow review + expiry

- Add sample exception missing expiry/approval and confirm gate fails
- Add valid exception and confirm gate passes
- Evidence: _pending_
