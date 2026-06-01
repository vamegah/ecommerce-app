# Task 3 Checkpoint Evidence

Date: 2026-05-31

## 1) Reproducible image builds from CI tags

- Workflow: `.github/workflows/publish-images.yml`
- Evidence: _pending after first tag/branch publish run_

## 2) Health probe gating

- Local command: `docker compose up --build`
- Health URL: `http://localhost:8080/healthz/`
- ECS: container health checks in task definitions
- Evidence: _pending in staging/prod_

## 3) Scale-down without downtime

- Command: `aws ecs update-service --cluster greatkart-cluster --service greatkart-web --desired-count 1`
- Expected: ALB remains healthy, no 5xx spike
- Evidence: _pending in staging/prod_

## 4) Resource limits stability

- Check task CPU/memory graphs and throttling metrics
- Expected: no sustained OOM or throttling under baseline load
- Evidence: _pending in staging/prod_

## 5) Artifact references

- `Dockerfile`
- `Dockerfile.worker`
- `docker-compose.yml`
- `deploy/orchestration/ecs/*`
- `docs/containerization-orchestration.md`
