#!/bin/bash
# =============================================================================
# Globetrotter SaaS – Ubuntu 22.04 VPS Setup & Deployment Script
# Usage: bash deploy.sh [--update]
# =============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-globetrotter.nl}"
API_SUBDOMAIN="api.${DOMAIN}"
APP_SUBDOMAIN="app.${DOMAIN}"
ADMIN_SUBDOMAIN="admin.${DOMAIN}"
APP_DIR="/srv/globetrotter"
REPO_URL="${REPO_URL:-https://github.com/SateBroodjeDev/globetrotter-saas-backend.git}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@${DOMAIN}}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --- Root check ---
[[ $EUID -ne 0 ]] && error "Run as root: sudo bash deploy.sh"

UPDATE_ONLY=false
[[ "${1:-}" == "--update" ]] && UPDATE_ONLY=true

if ! $UPDATE_ONLY; then
  info "=== Phase 1: System Update ==="
  apt-get update -y && apt-get upgrade -y
  apt-get install -y curl git unzip htop ufw fail2ban

  info "=== Phase 2: Install Docker ==="
  if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker && systemctl start docker
  else
    info "Docker already installed"
  fi

  if ! command -v docker-compose &>/dev/null; then
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
    curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
  fi

  info "=== Phase 3: Install Nginx ==="
  apt-get install -y nginx certbot python3-certbot-nginx
  systemctl enable nginx && systemctl start nginx

  info "=== Phase 4: Firewall ==="
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable

  info "=== Phase 5: Clone/update repo ==="
  if [[ -d "${APP_DIR}/.git" ]]; then
    git -C "$APP_DIR" pull
  else
    git clone "$REPO_URL" "$APP_DIR"
  fi

  info "=== Phase 6: Environment ==="
  if [[ ! -f "${APP_DIR}/.env" ]]; then
    cp "${APP_DIR}/.env.production" "${APP_DIR}/.env"
    warn "Edit ${APP_DIR}/.env with your secrets before continuing!"
    warn "Then re-run: bash deploy.sh --update"
    exit 0
  fi

else
  info "=== Update mode: pulling latest code ==="
  git -C "$APP_DIR" pull
fi

info "=== Phase 7: Deploy containers ==="
cd "$APP_DIR"
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --build

info "=== Phase 8: Nginx config ==="
cp "${APP_DIR}/nginx.conf" /etc/nginx/sites-available/globetrotter
ln -sf /etc/nginx/sites-available/globetrotter /etc/nginx/sites-enabled/globetrotter
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

info "=== Phase 9: SSL certificates ==="
certbot --nginx \
  -d "$API_SUBDOMAIN" \
  -d "$APP_SUBDOMAIN" \
  -d "$ADMIN_SUBDOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL" \
  --redirect || warn "Certbot failed – check DNS propagation and try: certbot --nginx"

info "=== Phase 10: Backup cron ==="
CRON_JOB="0 3 * * * docker exec globetrotter_db pg_dump -U postgres globetrotter_db | gzip > /srv/backups/db-\$(date +\%Y\%m\%d).sql.gz"
(crontab -l 2>/dev/null | grep -v 'globetrotter_db'; echo "$CRON_JOB") | crontab -
mkdir -p /srv/backups

info "=== Phase 11: Systemd service ==="
cat > /etc/systemd/system/globetrotter.service << 'UNIT'
[Unit]
Description=Globetrotter SaaS
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/srv/globetrotter
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable globetrotter

info ""
info "✅ Deployment complete!"
info "  API:   https://${API_SUBDOMAIN}"
info "  App:   https://${APP_SUBDOMAIN}"
info "  Admin: https://${ADMIN_SUBDOMAIN}"
info ""
info "Logs: docker-compose -f ${APP_DIR}/docker-compose.prod.yml logs -f api"
