#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION required}"
: "${ECS_CLUSTER:?ECS_CLUSTER required}"
: "${ECS_SERVICE_WEB:?ECS_SERVICE_WEB required}"

echo "Simulating dependency outage drill by scaling web service down to 0 then back."
orig=$(aws ecs describe-services --region "$AWS_REGION" --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE_WEB" --query 'services[0].desiredCount' --output text)

aws ecs update-service --region "$AWS_REGION" --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE_WEB" --desired-count 0 >/dev/null
sleep 30
aws ecs update-service --region "$AWS_REGION" --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE_WEB" --desired-count "$orig" >/dev/null
aws ecs wait services-stable --region "$AWS_REGION" --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE_WEB"

echo "Dependency outage drill completed."
