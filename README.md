# Globetrotter SaaS Backend

> Full-stack multi-tenant SaaS platform for travel planning, expense splitting, and group coordination

## Features

✅ **Multi-Tenant Architecture** - Isolated workspaces per customer  
✅ **RBAC (Role-Based Access Control)** - Owner, Admin, Editor, Viewer roles  
✅ **JWT Authentication** - Secure token-based auth  
✅ **Expense Splitting** - Automatic balance calculation & settlement suggestions  
✅ **Trip Management** - Multi-trip planning with day-by-day itineraries  
✅ **Booking Tracking** - Flights, hotels, rentals, activities  
✅ **White-Label Support** - Custom branding for B2B agencies  
✅ **PostgreSQL + Redis** - Robust data storage & caching  
✅ **Docker Ready** - Complete containerization for VPS deployment  
✅ **Audit Logging** - Full activity tracking for compliance  

## Tech Stack

- **Runtime:** Node.js 18+
- **Database:** PostgreSQL 15
- **Cache:** Redis 7
- **ORM:** Sequelize
- **Auth:** JWT + bcrypt
- **API:** Express.js
- **Validation:** Express Validator
- **Security:** Helmet, CORS
- **Containerization:** Docker & Docker Compose

## Quick Start (Local Development)

```bash
# Clone and install
git clone https://github.com/SateBroodjeDev/globetrotter-saas-backend.git
cd globetrotter-saas-backend
npm install

# Setup environment
cp .env.example .env

# Start with Docker Compose
docker-compose up -d

# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed

# Start development server
npm run dev
```

API running at `http://localhost:3000`

## Production Deployment (Linux VPS)

### Prerequisites
- Ubuntu 20.04+ or CentOS 8+
- Docker & Docker Compose installed
- Domain name (for SSL)
- Nginx (reverse proxy)

### Step 1: Setup VPS

```bash
ssh root@your-vps-ip

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 2: Deploy Application

```bash
# Create app directory
sudo mkdir -p /srv/globetrotter
cd /srv/globetrotter

# Clone repository
sudo git clone https://github.com/SateBroodjeDev/globetrotter-saas-backend.git .

# Setup environment
sudo cp .env.example .env
sudo nano .env  # Edit with your production values

# Start services
sudo docker-compose -f docker-compose.prod.yml up -d

# Check logs
sudo docker-compose logs -f api
```

### Step 3: Setup Nginx Reverse Proxy

```bash
sudo apt-get install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/globetrotter
```

```nginx
upstream globetrotter_api {
  server localhost:3000;
}

server {
    listen 80;
    server_name api.globetrotter.io;

    location / {
        proxy_pass http://globetrotter_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/globetrotter /etc/nginx/sites-enabled/

# Test Nginx
sudo nginx -t

# Reload
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.globetrotter.io
```

### Step 4: Setup Systemd Service (Auto-restart)

```bash
sudo nano /etc/systemd/system/globetrotter.service
```

```ini
[Unit]
Description=Globetrotter SaaS Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/srv/globetrotter
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
Restart=always
RestartSec=10s
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable globetrotter
sudo systemctl start globetrotter
```

### Step 5: Monitor Application

```bash
# View logs
sudo docker-compose -f docker-compose.prod.yml logs -f api

# Check health
curl https://api.globetrotter.io/health

# Database backup
sudo docker-compose exec postgres pg_dump -U globetrotter globetrotter_db > backup-$(date +%Y%m%d).sql
```

## API Endpoints

### Authentication
```
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # Login user
POST   /api/auth/logout            # Logout (blacklist token)
POST   /api/auth/verify-email/:token
```

### Workspaces
```
POST   /api/workspaces             # Create workspace
GET    /api/workspaces/:id         # Get workspace
PUT    /api/workspaces/:id         # Update workspace
PUT    /api/workspaces/:id/branding # Update white-label branding
POST   /api/workspaces/:id/members/invite
GET    /api/workspaces/:id/members
PATCH  /api/workspaces/:id/members/:userId/role
```

### Trips
```
POST   /api/trips                  # Create trip
GET    /api/trips/workspace/:id    # List workspace trips
GET    /api/trips/public/:shareToken # Public trip view
GET    /api/trips/:id/stats        # Trip statistics
POST   /api/trips/:id/days         # Add day
POST   /api/trips/:id/share        # Generate share token
```

### Expenses
```
POST   /api/expenses               # Create expense
GET    /api/expenses/trip/:id      # Get trip expenses
GET    /api/expenses/trip/:id/balances # Calculate balances
DELETE /api/expenses/:id           # Delete expense
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/globetrotter_db

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRY=7d
REFRESH_TOKEN_SECRET=refresh-secret

# Server
PORT=3000
NODE_ENV=production
API_URL=https://api.globetrotter.io
FRONTEND_URL=https://app.globetrotter.io

# Payment (Stripe)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLIC_KEY=pk_live_...

# Email (SendGrid)
SENDGRID_API_KEY=SG...
```

## Subscription Plans

| Plan | Price | Trips | Members | Features |
|------|-------|-------|---------|----------|
| **Starter** | Free | 2 | 3 | Basic planning |
| **Pro** | €9.99/m | ∞ | 10 | Export, analytics, API |
| **Business** | €99/m | ∞ | ∞ | White-label, custom domain, SSO |

## Database Schema

```
Users
  ├── Workspaces (1:N)
  │   ├── WorkspaceUsers (N:M)
  │   ├── Trips (1:N)
  │   │   ├── Days (1:N)
  │   │   ├── Expenses (1:N)
  │   │   ├── Bookings (1:N)
  │   │   ├── Checklists (1:N)
  │   │   └── TripMembers (N:M)
  │   └── AuditLogs (1:N)
```

## Support & Contributing

For issues, feature requests, or contributions:
- GitHub Issues: https://github.com/SateBroodjeDev/globetrotter-saas-backend/issues
- Email: support@globetrotter.io

## License

MIT License - See LICENSE file

---

**Made with ❤️ by SateBroodjeDev**
