# Task 8 Checkpoint Evidence

Date: 2026-05-31

## 1) Dev/staging/prod isolation

- Confirm separate Terraform state keys and DNS records
- Confirm no cross-environment secret reuse
- Evidence: _pending_

## 2) Branch protection enforcement

- Attempt merge without required checks
- Confirm merge is blocked
- Evidence: _pending_

## 3) PR preview auto-create

- Open PR and confirm preview workflow comment with URL
- Evidence: _pending_

## 4) PR preview auto-destroy

- Close PR and confirm destroy workflow completed
- Evidence: _pending_

## 5) Production approval requirements

- Confirm deploys to `production` and `terraform-apply-prod` require reviewers
- Evidence: _pending_
