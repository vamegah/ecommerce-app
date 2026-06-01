#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${ECS_CLUSTER:?ECS_CLUSTER is required}"
: "${ECS_SERVICE_WEB:?ECS_SERVICE_WEB is required}"
: "${ECS_SERVICE_WORKER:?ECS_SERVICE_WORKER is required}"
: "${ECS_SERVICE_BEAT:?ECS_SERVICE_BEAT is required}"
: "${PREV_WEB_TASKDEF_ARN:?PREV_WEB_TASKDEF_ARN is required}"
: "${PREV_WORKER_TASKDEF_ARN:?PREV_WORKER_TASKDEF_ARN is required}"
: "${PREV_BEAT_TASKDEF_ARN:?PREV_BEAT_TASKDEF_ARN is required}"

aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE_WEB}" \
  --task-definition "${PREV_WEB_TASKDEF_ARN}" \
  --force-new-deployment >/dev/null

aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE_WORKER}" \
  --task-definition "${PREV_WORKER_TASKDEF_ARN}" \
  --force-new-deployment >/dev/null

aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE_BEAT}" \
  --task-definition "${PREV_BEAT_TASKDEF_ARN}" \
  --force-new-deployment >/dev/null

aws ecs wait services-stable \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE_WEB}" "${ECS_SERVICE_WORKER}" "${ECS_SERVICE_BEAT}"

echo "Rollback completed and services returned to previous task definitions."
