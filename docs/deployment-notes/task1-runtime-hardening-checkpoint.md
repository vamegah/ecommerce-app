# Task 1 Checkpoint Evidence

Date: 2026-05-31

## 1) TLS grade and auto-renew

- Command: `sudo certbot renew --dry-run`
- Evidence: _pending in target environment_

## 2) systemd restart/reboot survivability

- Commands:
  - `sudo systemctl restart greatkart-gunicorn nginx fail2ban`
  - `sudo systemctl enable greatkart-gunicorn nginx fail2ban`
- Evidence: _pending in target environment_

## 3) Security headers

- Command: `curl -I https://example.com/`
- Expected headers:
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Content-Security-Policy`
- Evidence: _pending in target environment_

## 4) fail2ban controlled trigger

- Commands:
  - `sudo fail2ban-client status`
  - `sudo fail2ban-client status greatkart-auth`
- Evidence: _pending in target environment_

## 5) Artifact references

- Nginx config: `deploy/runtime/nginx/greatkart.conf`
- systemd service: `deploy/runtime/systemd/greatkart-gunicorn.service`
- Gunicorn config: `deploy/runtime/gunicorn/gunicorn.conf.py`
- fail2ban configs:
  - `deploy/runtime/fail2ban/jail.local`
  - `deploy/runtime/fail2ban/filter.d/greatkart-auth.conf`
- Runbook: `docs/runtime-hardening.md`
