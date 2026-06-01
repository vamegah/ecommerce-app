# Containerization and Orchestration Runbook

## Scope

This runbook covers Task 3:

- Production Docker images for web and worker roles
- Local parity stack with Docker Compose
- CI image publishing and smoke builds
- ECS/Fargate deployment definitions

## Local Stack

Start:

- `docker compose up --build`

Services:

- `nginx` on `http://localhost:8080`
- `web` Django app (internal 8000)
- `db` PostgreSQL
- `redis` Redis
- `worker` Celery worker
- `beat` Celery scheduler

Health:

- `http://localhost:8080/healthz/`

## Images

- Web image: `Dockerfile`
- Worker image: `Dockerfile.worker`
- Publish workflow: `.github/workflows/publish-images.yml`

## Orchestration Target

Selected target: **AWS ECS/Fargate**.

Definitions:

- `deploy/orchestration/ecs/taskdef-web.json`
- `deploy/orchestration/ecs/taskdef-worker.json`
- `deploy/orchestration/ecs/taskdef-beat.json`
- `deploy/orchestration/ecs/service-web.json`
- `deploy/orchestration/ecs/service-worker.json`
- `deploy/orchestration/ecs/service-beat.json`

## Resource and Health Controls

- Web task: `cpu=1024`, `memory=2048`, HTTP health check on `/healthz/`
- Worker task: `cpu=1024`, `memory=2048`, Celery ping health check
- Beat task: `cpu=512`, `memory=1024`

## Deployment Flow

1. Merge to `main` (CI + docker smoke builds pass)
2. Publish workflow pushes versioned images to GHCR
3. Register ECS task definition revisions
4. Update ECS services to new task revision
