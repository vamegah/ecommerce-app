#!/usr/bin/env bash
set -euo pipefail

: "${PR_NUMBER:?PR_NUMBER is required}"
: "${AWS_REGION:?AWS_REGION is required}"
: "${PREVIEW_SECURITY_GROUP_ID:?PREVIEW_SECURITY_GROUP_ID is required}"
: "${PREVIEW_DB_PASSWORD:?PREVIEW_DB_PASSWORD is required}"
: "${PREVIEW_ZONE_ID:?PREVIEW_ZONE_ID is required}"
: "${PREVIEW_ALB_DNS_NAME:?PREVIEW_ALB_DNS_NAME is required}"
: "${PREVIEW_ALB_ZONE_ID:?PREVIEW_ALB_ZONE_ID is required}"
: "${PREVIEW_WEB_TASKDEF_ARN:?PREVIEW_WEB_TASKDEF_ARN is required}"

TEMPLATE="infra/terraform/environments/preview/terraform.tfvars.template"
OUT="infra/terraform/environments/preview/terraform.tfvars"

# PR-specific deterministic CIDR ranges in 10.200.0.0/16 with simple bucketing.
bucket=$((PR_NUMBER % 100))
base=$((bucket * 2))

sed \
  -e "s/__AWS_REGION__/${AWS_REGION}/g" \
  -e "s/__PR_NUMBER__/${PR_NUMBER}/g" \
  -e "s/__VPC_CIDR__/10.200.${bucket}.0\\/24/g" \
  -e "s/__PUB_A__/10.200.${bucket}.${base}\\/28/g" \
  -e "s/__PUB_B__/10.200.${bucket}.$((base + 16))\\/28/g" \
  -e "s/__PRIV_A__/10.200.${bucket}.$((base + 32))\\/28/g" \
  -e "s/__PRIV_B__/10.200.${bucket}.$((base + 48))\\/28/g" \
  -e "s/__AZ_A__/${AWS_REGION}a/g" \
  -e "s/__AZ_B__/${AWS_REGION}b/g" \
  -e "s/__SECURITY_GROUP_ID__/${PREVIEW_SECURITY_GROUP_ID}/g" \
  -e "s/__DB_INSTANCE_CLASS__/db.t4g.micro/g" \
  -e "s/__DB_ALLOCATED_STORAGE__/20/g" \
  -e "s/__DB_PASSWORD__/${PREVIEW_DB_PASSWORD}/g" \
  -e "s/__MEDIA_BUCKET__/greatkart-pr-${PR_NUMBER}-media/g" \
  -e "s/__DOMAIN_NAME__/pr-${PR_NUMBER}.preview.example.com/g" \
  -e "s/__ZONE_ID__/${PREVIEW_ZONE_ID}/g" \
  -e "s/__RECORD_NAME__/pr-${PR_NUMBER}.preview.example.com/g" \
  -e "s/__ALB_DNS_NAME__/${PREVIEW_ALB_DNS_NAME}/g" \
  -e "s/__ALB_ZONE_ID__/${PREVIEW_ALB_ZONE_ID}/g" \
  -e "s#__WEB_TASKDEF_ARN__#${PREVIEW_WEB_TASKDEF_ARN}#g" \
  "${TEMPLATE}" > "${OUT}"

echo "Generated ${OUT}"
