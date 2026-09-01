# Globetrotter SaaS - Quick Start Guide

## 🚀 Production Deployment (Linux VPS)

### Prerequisites
```bash
Ubuntu 20.04+ | Docker | Docker Compose | Git
```

### Step 1: SSH into VPS
```bash
ssh root@your-vps-ip
cd /srv
```

### Step 2: Clone & Setup
```bash
git clone https://github.com/SateBroodjeDev/globetrotter-saas-backend.git
cd globetrotter-saas-backend

# Copy environment
cp .env.example .env
nano .env  # Edit all values
```

### Step 3: Start Services
```bash
# Build and run
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose logs -f api
```

### Step 4: Setup Nginx
```bash
sudo apt-get install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/globetrotter
```

**Paste this:**
```nginx
upstream api {
  server localhost:3000;
}

server {
    listen 80;
    server_name api.yourdomain.com app.yourdomain.com;

    location / {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable and start
sudo ln -s /etc/nginx/sites-available/globetrotter /etc/nginx/sites-enabled/
sudo systemctl reload nginx

# SSL with Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
```

### Step 5: Verify
```bash
# API health check
curl https://api.yourdomain.com/health

# Logs
docker-compose logs api

# Database backup
docker-compose exec postgres pg_dump -U globetrotter globetrotter_db > backup.sql
```

## 📊 API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
```

### Workspaces (Multi-Tenant)
```
POST   /api/workspaces
GET    /api/workspaces/:id
PUT    /api/workspaces/:id/branding
POST   /api/workspaces/:id/members/invite
GET    /api/workspaces/:id/members
PATCH  /api/workspaces/:id/members/:userId/role
```

### Trips
```
POST   /api/trips
GET    /api/trips/workspace/:workspaceId
GET    /api/trips/:id/stats
POST   /api/trips/:id/days
POST   /api/trips/:id/share
```

### Expenses & Settlement
```
POST   /api/expenses
GET    /api/expenses/trip/:tripId
GET    /api/expenses/trip/:tripId/balances
DELETE /api/expenses/:id
```

## 🔐 Role-Based Access Control (RBAC)

| Role | Trips | Members | Expenses | Settings |
|------|-------|---------|----------|----------|
| **Owner** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Admin** | ✅ Full | ✅ Full | ✅ Full | ❌ No |
| **Editor** | ✅ Create/Edit | ❌ No | ✅ Full | ❌ No |
| **Viewer** | ❌ Read-only | ❌ No | ❌ Read-only | ❌ No |

## 💾 Database Schema

```
Users
├── Workspaces (1:N)
│   ├── WorkspaceUsers (N:M, with RBAC)
│   ├── Trips (1:N)
│   │   ├── Days (1:N)
│   │   ├── Expenses (1:N)
│   │   ├── Bookings (1:N)
│   │   ├── Checklists (1:N)
│   │   └── TripMembers (N:M)
│   └── AuditLogs (1:N)
```

## 📱 Frontend Setup

```bash
# Deploy frontend separately or use same domain
cd frontend

# Option 1: With Node.js
npm install -g http-server
http-server . -p 8080 -c-1

# Option 2: With Nginx
sudo cp index.html /var/www/html/
```

## 🎯 Multi-Tenant Architecture

- **Subdomain Routing**: `jan.globetrotter.io` → User's workspace
- **Data Isolation**: PostgreSQL row-level security per workspace
- **White-Label Support**: Custom branding per tenant
- **Audit Logging**: Full compliance & activity tracking

## 💳 Subscription Plans

```yaml
Starter (Free):
  - 2 trips
  - 3 members
  - Basic features

Pro (€9.99/month):
  - Unlimited trips
  - 10 members
  - Export, analytics, API

Business (€99/month):
  - Everything Pro
  - White-label branding
  - Custom domain
  - SSO/SAML
  - Priority support
```

## 🛠️ Maintenance

### Daily
```bash
# Check logs
docker-compose logs --tail=50 api
```

### Weekly
```bash
# Database backup
docker-compose exec postgres pg_dump -U globetrotter globetrotter_db > backup-$(date +%Y%m%d).sql
```

### Monthly
```bash
# Update containers
docker-compose pull
docker-compose -f docker-compose.prod.yml up -d
```

## 🔒 Security Checklist

- ✅ Use strong JWT_SECRET (generate: `openssl rand -base64 32`)
- ✅ Enable HTTPS/SSL with Let's Encrypt
- ✅ Use environment variables (never commit .env)
- ✅ Enable 2FA for admin accounts
- ✅ Regular database backups
- ✅ Monitor audit logs
- ✅ Use strong database password
- ✅ Keep Docker images updated

## 📞 Support

- Issues: https://github.com/SateBroodjeDev/globetrotter-saas-backend/issues
- Email: support@globetrotter.io
- Docs: https://docs.globetrotter.io

---

**Built with ❤️ by SateBroodjeDev**
