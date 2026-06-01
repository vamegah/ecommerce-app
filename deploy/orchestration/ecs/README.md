# ECS/Fargate Orchestration Plan

## Selected Platform

Chosen target: **AWS ECS on Fargate**.

## Rationale

- No node management overhead compared with Kubernetes.
- Native IAM integration for task roles and least-privilege access.
- Smooth integration with ALB, CloudWatch logs, autoscaling, and Secrets Manager.
- Good fit for current team size and operational maturity.

## Required Artifacts

- `taskdef-web.json`: Django web service task definition
- `taskdef-worker.json`: Celery worker task definition
- `taskdef-beat.json`: Celery beat task definition
- `service-web.json`: ALB-backed web ECS service
- `service-worker.json`: background worker ECS service
- `service-beat.json`: scheduler ECS service

## Deployment Notes

1. Push images through `.github/workflows/publish-images.yml`.
2. Update image tags in task definition files.
3. Deploy task definitions and services:
   - `aws ecs register-task-definition --cli-input-json file://taskdef-web.json`
   - `aws ecs update-service --cluster <cluster> --service greatkart-web --force-new-deployment`
4. Validate `/healthz/` through ALB target group health.
