#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required (owner/repo)}"

BRANCH="${1:-main}"

IFS='/' read -r OWNER REPO <<< "${GITHUB_REPOSITORY}"

curl -fsS -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
  -d @- <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      {"context": "Django Tests"},
      {"context": "Node Tests (addresses)"},
      {"context": "Node Tests (comparison)"},
      {"context": "Node Tests (filters)"},
      {"context": "Node Tests (inventory_alerts)"},
      {"context": "Node Tests (orders/tracking)"},
      {"context": "Docker Build Smoke"}
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "Branch protection updated for ${OWNER}/${REPO}:${BRANCH}"
