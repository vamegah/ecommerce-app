#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${ECS_CLUSTER:?ECS_CLUSTER is required}"
: "${ECS_SERVICE_WEB:?ECS_SERVICE_WEB is required}"
: "${ECS_SERVICE_WORKER:?ECS_SERVICE_WORKER is required}"
: "${ECS_SERVICE_BEAT:?ECS_SERVICE_BEAT is required}"
: "${WEB_TASKDEF_ARN:?WEB_TASKDEF_ARN is required}"
: "${WORKER_TASKDEF_ARN:?WORKER_TASKDEF_ARN is required}"
: "${BEAT_TASKDEF_ARN:?BEAT_TASKDEF_ARN is required}"

aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE_WEB}" \
  --task-definition "${WEB_TASKDEF_ARN}" \
  --force-new-deployment >/dev/null

aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE_WORKER}" \
  --task-definition "${WORKER_TASKDEF_ARN}" \
  --force-new-deployment >/dev/null

aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE_BEAT}" \
  --task-definition "${BEAT_TASKDEF_ARN}" \
  --force-new-deployment >/dev/null

aws ecs wait services-stable \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE_WEB}" "${ECS_SERVICE_WORKER}" "${ECS_SERVICE_BEAT}"

echo "Rolling deployment completed and services are stable."
