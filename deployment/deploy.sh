#!/bin/bash
# Globetrotter SaaS - Ubuntu 22.04 Automated Deployment Script
# Usage: sudo bash deploy.sh
# Domain: globetrotter.nl

set -e

DOMAIN="globetrotter.nl"
APP_DIR="/var/www/globetrotter"
DB_USER="globetrotter"
DB_NAME="globetrotter"

echo "🚀 Starting Globetrotter SaaS deployment on Ubuntu 22.04..."

# 1. Update system
echo "[1/12] Updating system packages..."
apt update && apt upgrade -y

# 2. Install base dependencies
echo "[2/12] Installing base dependencies..."
apt install -y curl wget git nginx postgresql postgresql-contrib redis-server \
    certbot python3-certbot-nginx ufw build-essential

# 3. Install Node.js 20 LTS
echo "[3/12] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 4. Create app user and directories
echo "[4/12] Creating app directories..."
mkdir -p ${APP_DIR}/{backend,frontend,logs,backups}
chown -R www-data:www-data ${APP_DIR}

# 5. Setup PostgreSQL
echo "[5/12] Setting up PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql

# Check if db user exists
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

# 6. Setup Redis
echo "[6/12] Starting Redis..."
systemctl enable redis-server
systemctl start redis-server

# 7. Install backend dependencies
echo "[7/12] Installing backend dependencies..."
cd ${APP_DIR}/backend
if [ -f package.json ]; then
    npm ci --omit=dev
fi

# 8. Setup Nginx
echo "[8/12] Configuring Nginx..."
cp "$(dirname "$0")/nginx.conf" /etc/nginx/sites-available/globetrotter
ln -sf /etc/nginx/sites-available/globetrotter /etc/nginx/sites-enabled/globetrotter
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 9. SSL Certificates via Let's Encrypt
echo "[9/12] Installing SSL certificates..."
certbot certonly --nginx --non-interactive --agree-tos \
    -m "admin@${DOMAIN}" \
    -d "${DOMAIN}" \
    -d "api.${DOMAIN}" \
    -d "app.${DOMAIN}" \
    -d "admin.${DOMAIN}" || echo "⚠️  SSL setup failed - run manually: certbot certonly --nginx"

# 10. Setup systemd services
echo "[10/12] Installing systemd services..."
cp "$(dirname "$0")/systemd/globetrotter-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable globetrotter-api

# 11. Setup backup cron
echo "[11/12] Setting up automated backups..."
cp "$(dirname "$0")/backup.sh" /usr/local/bin/globetrotter-backup.sh
chmod +x /usr/local/bin/globetrotter-backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/globetrotter-backup.sh >> /var/log/globetrotter-backup.log 2>&1") | crontab -

# 12. Configure firewall
echo "[12/12] Configuring UFW firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Copy your backend code to ${APP_DIR}/backend"
echo "  2. Copy your .env.production to ${APP_DIR}/backend/.env"
echo "  3. Copy your frontend to ${APP_DIR}/frontend"
echo "  4. Run: systemctl start globetrotter-api"
echo "  5. Visit: https://app.${DOMAIN}"
