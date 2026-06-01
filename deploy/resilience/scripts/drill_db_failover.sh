#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION required}"
: "${RDS_INSTANCE_ID:?RDS_INSTANCE_ID required}"

echo "Triggering RDS reboot with failover for resilience drill..."
aws rds reboot-db-instance --region "$AWS_REGION" --db-instance-identifier "$RDS_INSTANCE_ID" --force-failover >/dev/null
aws rds wait db-instance-available --region "$AWS_REGION" --db-instance-identifier "$RDS_INSTANCE_ID"
echo "DB failover drill completed."
