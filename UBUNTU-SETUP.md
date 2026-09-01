# Ubuntu 22.04 VPS Setup Guide for Globetrotter SaaS

## Prerequisites

- Fresh Ubuntu 22.04 LTS VPS (minimum 2 vCPU, 4 GB RAM, 40 GB SSD)
- Root or sudo access
- Domain `globetrotter.nl` pointing to your VPS IP (A records for `@`, `api`, `app`, `admin`)

## DNS Records Required

| Type | Name            | Value          |
|------|-----------------|----------------|
| A    | globetrotter.nl | YOUR_VPS_IP   |
| A    | api             | YOUR_VPS_IP   |
| A    | app             | YOUR_VPS_IP   |
| A    | admin           | YOUR_VPS_IP   |

## Quick Start (Automated)

```bash
git clone https://github.com/SateBroodjeDev/globetrotter-saas-backend.git
cd globetrotter-saas-backend
sudo bash deployment/deploy.sh
```

## Manual Step-by-Step

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # Should show v20.x.x
```

### 3. Install PostgreSQL & Redis

```bash
sudo apt install -y postgresql postgresql-contrib redis-server
sudo systemctl enable postgresql redis-server
sudo systemctl start postgresql redis-server
```

### 4. Create Database

```bash
sudo -u postgres psql
```

Inside psql:
```sql
CREATE USER globetrotter WITH PASSWORD 'YOUR_SECURE_PASSWORD';
CREATE DATABASE globetrotter OWNER globetrotter;
\q
```

### 5. Install Nginx

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 6. Clone & Configure Backend

```bash
sudo mkdir -p /var/www/globetrotter/{backend,frontend,logs,backups}
sudo chown -R www-data:www-data /var/www/globetrotter

# Copy backend files
sudo cp -r backend/* /var/www/globetrotter/backend/
cd /var/www/globetrotter/backend

# Create environment file
sudo cp .env.example .env
sudo nano .env  # Fill in DATABASE_URL, JWT_SECRET, etc.

# Install dependencies
sudo npm ci --omit=dev
```

### 7. Run Migrations

```bash
cd /var/www/globetrotter/backend
sudo node scripts/migrate.js
sudo node scripts/seed.js
```

### 8. Configure Nginx

```bash
sudo cp deployment/nginx.conf /etc/nginx/sites-available/globetrotter
sudo ln -s /etc/nginx/sites-available/globetrotter /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 9. SSL Certificates

```bash
sudo certbot certonly --nginx \
  -d globetrotter.nl \
  -d api.globetrotter.nl \
  -d app.globetrotter.nl \
  -d admin.globetrotter.nl \
  --email admin@globetrotter.nl \
  --agree-tos
```

Auto-renewal is configured by certbot. Test with:
```bash
sudo certbot renew --dry-run
```

### 10. Install Systemd Service

```bash
sudo cp deployment/systemd/globetrotter-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable globetrotter-api
sudo systemctl start globetrotter-api
sudo systemctl status globetrotter-api
```

### 11. Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### 12. Automated Backups

```bash
sudo cp deployment/backup.sh /usr/local/bin/globetrotter-backup.sh
sudo chmod +x /usr/local/bin/globetrotter-backup.sh
# Add to crontab (runs daily at 2 AM):
(crontab -l; echo "0 2 * * * /usr/local/bin/globetrotter-backup.sh") | crontab -
```

## Verification

```bash
# Check all services
sudo systemctl status nginx postgresql redis globetrotter-api

# Test API
curl https://api.globetrotter.nl/health

# Check logs
sudo journalctl -u globetrotter-api -f
```

## Updating the Application

```bash
cd /var/www/globetrotter/backend
sudo git pull
sudo npm ci --omit=dev
sudo node scripts/migrate.js
sudo systemctl restart globetrotter-api
```
