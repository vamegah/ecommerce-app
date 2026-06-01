#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-greatkart}"
APP_ROOT="${APP_ROOT:-/opt/greatkart/current}"
DOMAIN="${DOMAIN:-example.com}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@example.com}"

apt-get update
apt-get install -y nginx fail2ban certbot python3-certbot-nginx

if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${DEPLOY_USER}"
fi

mkdir -p /etc/greatkart /run/gunicorn /var/www/certbot
chown -R "${DEPLOY_USER}":www-data /etc/greatkart /run/gunicorn

cp "${APP_ROOT}/deploy/runtime/nginx/greatkart.conf" /etc/nginx/sites-available/greatkart.conf
ln -sf /etc/nginx/sites-available/greatkart.conf /etc/nginx/sites-enabled/greatkart.conf
nginx -t
systemctl enable nginx
systemctl restart nginx

cp "${APP_ROOT}/deploy/runtime/fail2ban/jail.local" /etc/fail2ban/jail.local
cp "${APP_ROOT}/deploy/runtime/fail2ban/filter.d/greatkart-auth.conf" /etc/fail2ban/filter.d/greatkart-auth.conf
systemctl enable fail2ban
systemctl restart fail2ban

cp "${APP_ROOT}/deploy/runtime/systemd/greatkart-gunicorn.service" /etc/systemd/system/greatkart-gunicorn.service
systemctl daemon-reload
systemctl enable greatkart-gunicorn
systemctl restart greatkart-gunicorn

certbot --nginx --agree-tos --redirect -m "${EMAIL}" -d "${DOMAIN}" -d "www.${DOMAIN}"
systemctl reload nginx

echo "Runtime hardening bootstrap completed."
