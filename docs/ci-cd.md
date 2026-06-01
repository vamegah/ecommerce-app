# CI/CD Setup

This repository now includes a complete GitHub Actions pipeline:

- CI workflow: `.github/workflows/ci.yml`
- CD workflow: `.github/workflows/cd.yml`
- Dependency automation: `.github/dependabot.yml`

## CI pipeline

On push/PR, CI runs:

1. Django checks and tests:
   - `python manage.py check`
   - `python manage.py test filters coupons inventory_alerts addresses comparison recommendations wishlist orders`
2. Node tests and builds in:
   - `addresses`
   - `comparison`
   - `filters`
   - `inventory_alerts`
   - `orders/tracking`

Python dependencies are installed from `requirements-ci.txt`.

## CD pipeline

CD triggers when CI succeeds on `main`/`master` (or manually via `workflow_dispatch`):

1. Build deploy artifact (`greatkart-app.tar.gz`)
2. Upload artifact to GitHub Actions
3. Deploy to staging (if staging secrets exist)
4. Deploy to production (if production secrets exist)

Both deploy jobs are optional and gated by secrets.

## Required repository secrets

### Staging

- `STAGING_DEPLOY_HOST`
- `STAGING_DEPLOY_USER`
- `STAGING_DEPLOY_KEY`
- `STAGING_DEPLOY_PATH`

### Production

- `PROD_DEPLOY_HOST`
- `PROD_DEPLOY_USER`
- `PROD_DEPLOY_KEY`
- `PROD_DEPLOY_PATH`

## Deployment server expectation

The server deploy path should:

- be writable by the deploy user
- contain a `restart.sh` script if you want automatic service reload after upload/extract

The workflow executes `restart.sh` only if the file exists.

## Optional hardening

1. Add branch protection so `CI` must pass before merge.
2. Configure GitHub Environments (`staging`, `production`) with required reviewers.
3. Move Django production config/env handling into server-side `.env` and systemd service.
