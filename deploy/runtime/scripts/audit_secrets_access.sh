#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${SECRETS_MANAGER_SECRET_ID:?SECRETS_MANAGER_SECRET_ID is required}"

LOOKBACK_HOURS="${LOOKBACK_HOURS:-24}"
START_TIME="$(date -u -d "-${LOOKBACK_HOURS} hours" +"%Y-%m-%dT%H:%M:%SZ")"

aws cloudtrail lookup-events \
  --region "${AWS_REGION}" \
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetSecretValue \
  --start-time "${START_TIME}" \
  --query "Events[?contains(CloudTrailEvent, \`${SECRETS_MANAGER_SECRET_ID}\`)].{Time:EventTime,User:Username,EventId:EventId}" \
  --output table
