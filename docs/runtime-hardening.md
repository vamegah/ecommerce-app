# Runtime Hardening Runbook

## Scope

This runbook covers Task 1 of infrastructure modernization:

- Gunicorn + Nginx runtime
- systemd service lifecycle
- TLS via Let's Encrypt
- HTTP security headers
- fail2ban protection

## Prerequisites

- Ubuntu 22.04+ host
- DNS records for `example.com` and `www.example.com` pointed to host
- Application code deployed at `/opt/greatkart/current`
- Virtual environment at `/opt/greatkart/venv`
- Environment file at `/etc/greatkart/greatkart.env`

## Bootstrap

1. Review and adjust:
   - `deploy/runtime/nginx/greatkart.conf`
   - `deploy/runtime/systemd/greatkart-gunicorn.service`
   - `deploy/runtime/fail2ban/jail.local`
2. Run:
   - `sudo DEPLOY_USER=greatkart APP_ROOT=/opt/greatkart/current DOMAIN=example.com LETSENCRYPT_EMAIL=admin@example.com bash deploy/runtime/scripts/bootstrap_runtime_hardening.sh`

## Health and Recovery Commands

- Service status:
  - `sudo systemctl status greatkart-gunicorn nginx fail2ban`
- Service restart:
  - `sudo systemctl restart greatkart-gunicorn nginx fail2ban`
- Logs:
  - `sudo journalctl -u greatkart-gunicorn -n 200 --no-pager`
  - `sudo tail -n 200 /var/log/nginx/error.log`
  - `sudo fail2ban-client status`
- Cert renewal dry-run:
  - `sudo certbot renew --dry-run`

## Rollback

1. Restore previous Nginx and systemd service files from backup.
2. `sudo nginx -t && sudo systemctl reload nginx`
3. `sudo systemctl daemon-reload && sudo systemctl restart greatkart-gunicorn`
4. Verify home page and login routes return 200.

## Validation Checklist

- HTTPS redirect enabled
- Valid certificate installed
- HSTS and other headers present
- Gunicorn serving traffic through Nginx
- fail2ban jail active and banning on repeated auth failures
