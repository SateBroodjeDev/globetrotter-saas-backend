# 📖 Globetrotter - Complete Installation Guide

Detailed step-by-step guide to install and configure the complete Globetrotter stack (backend + frontend).

---

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Backend Installation](#backend-installation)
3. [Frontend Installation](#frontend-installation)
4. [Database Setup](#database-setup)
5. [Running the Stack](#running-the-stack)
6. [Configuration](#configuration)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Hardware
- **CPU:** 2+ cores recommended
- **RAM:** 2GB minimum, 4GB+ recommended
- **Disk:** 1GB free space

### Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.0+ | Backend runtime |
| npm | 9.0+ | Package manager |
| PostgreSQL | 13.0+ | Primary database |
| Redis | 6.0+ | Session/cache storage |
| Git | 2.0+ | Version control |

### Operating System
- ✅ macOS (Intel & Apple Silicon)
- ✅ Linux (Ubuntu, Debian, CentOS, etc.)
- ✅ Windows (with WSL2)

---

## Installation Steps

### 1. Verify Prerequisites

```bash
# Check Node.js
node --version
# Expected: v18.0.0 or higher

# Check npm
npm --version
# Expected: v9.0.0 or higher

# Check PostgreSQL
psql --version
# Expected: psql (PostgreSQL) 13.0 or higher

# Check Redis
redis-server --version
# Expected: Redis server v=6.0.0 or higher

# Check Git
git --version
# Expected: git version 2.0.0 or higher
```

If any are missing, install from:
- **Node.js + npm:** https://nodejs.org/
- **PostgreSQL:** https://www.postgresql.org/download/
- **Redis:** https://redis.io/download
- **Git:** https://git-scm.com/

---

## Backend Installation

### Step 1.1: Clone Repository

```bash
# Choose a directory for your projects
mkdir -p ~/projects/globetrotter
cd ~/projects/globetrotter

# Clone backend repository
git clone https://github.com/SateBroodjeDev/globetrotter-saas-backend.git
cd globetrotter-saas-backend

# Verify clone was successful
ls -la
# Should show: src/, frontend/, scripts/, Dockerfile, package.json, etc.
```

### Step 1.2: Install Dependencies

```bash
# Install all npm packages
npm install

# This will install:
# - express (web framework)
# - sequelize (ORM for database)
# - passport (authentication)
# - stripe (payment processing)
# - sendgrid (email service)
# - redis (session storage)
# - jwt (token authentication)
# - and 50+ more packages

# Verify installation
npm list | head -20
# Should show list of installed packages
```

### Step 1.3: Create Environment File

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
# or
code .env        # Visual Studio Code
# or
vim .env         # Vim editor
```

**Essential Environment Variables:**

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/globetrotter
DATABASE_DIALECT=postgres

# Redis
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# JWT Authentication
JWT_SECRET=your-super-secret-key-change-in-production-min-32-chars
ACCESS_TOKEN_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# Frontend URL (for CORS and email links)
FRONTEND_URL=http://localhost:3000

# API URLs
API_URL=http://localhost:3000/api
ADMIN_DASHBOARD_URL=http://localhost:3000/admin/dashboard.html

# Email Configuration (optional - for development use console)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@globetrotter.io

# Payment Processing (optional - for development)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx

# Other Services (optional)
SENTRY_DSN=
OPENEXCHANGERATES_APP_ID=
AWS_REGION=us-east-1
AWS_S3_BUCKET=
```

**⚠️ Important Security Notes:**
- Generate new JWT_SECRET: `openssl rand -base64 32`
- Never commit .env file to git
- Use strong, unique values in production
- Keep Stripe/SendGrid keys secret

---

## Frontend Installation

### Step 2.1: Clone Frontend Repository

```bash
# Back to projects directory
cd ~/projects/globetrotter

# Clone frontend repository
git clone https://github.com/SateBroodjeDev/GlobeTrotr.git
cd GlobeTrotr

# Verify clone
ls -la *.html
# Should show: index.html, login.html, register.html, etc.

ls -la js/
# Should show: auth.js, trips.js, forms.js, etc.

ls -la css/
# Should show: main.css, auth.css, etc.
```

### Step 2.2: Frontend Configuration

Since this is static HTML, minimal configuration needed:

```bash
# Check frontend structure
tree GlobeTrotr/ -I 'node_modules'

# Expected structure:
# GlobeTrotr/
# ├── index.html (main dashboard)
# ├── auth/
# │   ├── register.html
# │   ├── login.html
# │   ├── forgot-password.html
# │   ├── reset-password.html
# │   └── verify-email.html
# ├── workspace/
# │   ├── settings.html
# │   ├── analytics.html
# │   ├── invite.html
# │   └── trip-shares.html
# ├── trips/
# │   ├── view.html
# │   ├── edit.html
# │   └── create.html
# ├── admin/
# │   ├── dashboard.html
# │   ├── users.html
# │   └── workspaces.html
# ├── js/
# │   ├── auth.js (authentication utilities)
# │   ├── api.js (API calls)
# │   ├── trips.js (trip functions)
# │   ├── forms.js (form validation)
# │   └── shared.js (shared utilities)
# └── css/
#     ├── main.css
#     ├── auth.css
#     └── responsive.css
```

---

## Database Setup

### Step 3.1: Start PostgreSQL

#### macOS (with Homebrew)
```bash
# Start PostgreSQL service
brew services start postgresql

# Verify it's running
brew services list | grep postgresql

# Should show: postgresql started /path/to/postgresql
```

#### Linux (Ubuntu/Debian)
```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Verify it's running
sudo systemctl status postgresql

# Should show: active (running)
```

#### Windows (WSL2)
```bash
# Inside WSL2 terminal
sudo service postgresql start

# Verify
sudo service postgresql status
```

### Step 3.2: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# At postgres=# prompt, create database:
CREATE DATABASE globetrotter;

# Create user (optional, for production security):
CREATE USER globetrotter_user WITH PASSWORD 'strong-password-here';
GRANT ALL PRIVILEGES ON DATABASE globetrotter TO globetrotter_user;

# Exit psql
\q
```

Or use one-liner:

```bash
createdb globetrotter

# Verify database created
psql -U postgres -l | grep globetrotter
# Should show: globetrotter | postgres | UTF8 | ...
```

### Step 3.3: Test Database Connection

```bash
# Back in backend directory
cd ~/projects/globetrotter/globetrotter-saas-backend

# Test connection with psql
psql postgresql://postgres:postgres@localhost:5432/globetrotter -c "SELECT 1 as connection_test;"

# Should return: connection_test
#                     1
```

### Step 3.4: Run Database Migrations

```bash
# Run migrations (creates all tables)
npm run migrate

# Output should show:
# ✓ Running migrations...
# ✓ Connected to database
# ✓ Syncing models...
# ✓ Database ready

# Verify tables created
psql -U postgres -d globetrotter -c "\dt"

# Should show tables:
# - Users
# - Workspaces
# - WorkspaceUsers
# - Trips
# - TripMembers
# - Expenses
# - Settlements
# - Bookings
# - Checklists
# - Days
# - (and more...)
```

### Step 3.5: Seed Test Data

```bash
# Seed database with admin user and sample data
npm run seed

# Output should show:
# ✓ Seeding database...
# ✓ Admin user created (admin@globetrotter.io)
# ✓ Sample workspace created
# ✓ Sample trips created
# ✓ Database seeded successfully

# Verify admin user
psql -U postgres -d globetrotter -c "SELECT id, email, firstName, role FROM Users WHERE role='admin';"

# Should show:
# id                                   | email                  | firstName | role
# xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx | admin@globetrotter.io | Admin     | admin
```

---

## Redis Setup

### Step 4.1: Start Redis

#### macOS (with Homebrew)
```bash
# Start Redis
brew services start redis

# Verify running
redis-cli ping
# Should return: PONG
```

#### Linux (Ubuntu/Debian)
```bash
# Start Redis
sudo systemctl start redis-server

# Verify running
redis-cli ping
# Should return: PONG
```

#### Manual Start (All OS)
```bash
# In a terminal window
redis-server

# Should show:
# * Ready to accept connections tcp
# * Listening on port 6379
```

### Step 4.2: Test Redis Connection

```bash
# Test connection
redis-cli ping
# Should return: PONG

# Test set/get
redis-cli SET testkey "Hello Redis"
redis-cli GET testkey
# Should return: Hello Redis

# Clean up
redis-cli DEL testkey
```

---

## Running the Complete Stack

### Setup (One-time)

```bash
# Terminal 1: Start PostgreSQL
brew services start postgresql    # macOS
sudo systemctl start postgresql   # Linux

# Terminal 2: Start Redis
redis-server
# or
brew services start redis         # macOS

# Back to Terminal 1: Setup backend
cd ~/projects/globetrotter/globetrotter-saas-backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run migrate
npm run seed
```

### Start Backend

```bash
# Terminal 3: Start backend server
cd ~/projects/globetrotter/globetrotter-saas-backend
npm start

# Expected output:
# ✓ Server running on http://localhost:3000
# ✓ Database connected
# ✓ Redis connected
# ✓ Email service initialized
# ✓ Stripe service initialized
# ✓ Email jobs scheduler started
```

### Start Frontend

The frontend is **static HTML** served by the backend. No separate server needed!

Access it at:
```
http://localhost:3000/index.html
```

---

## Configuration

### Environment Variables Reference

**Core Settings**
- `NODE_ENV` - development/production/testing
- `PORT` - Server port (default: 3000)

**Database**
- `DATABASE_URL` - PostgreSQL connection string
- `DATABASE_DIALECT` - Always 'postgres'
- `DATABASE_POOL_MIN` - Min connections (default: 5)
- `DATABASE_POOL_MAX` - Max connections (default: 10)

**Redis**
- `REDIS_URL` - Redis connection string
- `REDIS_DB` - Database number (default: 0)
- `REDIS_CACHE_TTL` - Cache TTL in seconds (default: 3600)

**Authentication**
- `JWT_SECRET` - Signing key for JWT tokens
- `ACCESS_TOKEN_EXPIRY` - Access token lifetime
- `REFRESH_TOKEN_EXPIRY` - Refresh token lifetime

**Email**
- `EMAIL_PROVIDER` - sendgrid/smtp/console
- `SENDGRID_API_KEY` - SendGrid API key
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `FROM_EMAIL` - Sender email address

**Payments**
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret

**URLs**
- `FRONTEND_URL` - Frontend base URL
- `API_URL` - API base URL
- `ADMIN_DASHBOARD_URL` - Admin dashboard URL

**Logging**
- `LOG_LEVEL` - debug/info/warn/error
- `SENTRY_DSN` - Sentry error tracking (optional)

---

## Verification Checklist

Run these commands to verify everything works:

```bash
# 1. Backend running?
curl http://localhost:3000/api/health
# Should return: {"status":"ok"}

# 2. Database connected?
curl http://localhost:3000/api/admin/system-health
# Should include: "database": "connected"

# 3. Redis connected?
redis-cli ping
# Should return: PONG

# 4. Frontend accessible?
curl http://localhost:3000/index.html | head -5
# Should return: <!DOCTYPE html>

# 5. Admin user exists?
psql -U postgres -d globetrotter -c "SELECT COUNT(*) FROM Users WHERE role='admin';"
# Should return: 1

# 6. Login works?
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@globetrotter.io","password":"admin123"}'
# Should return: {"accessToken":"...","refreshToken":"..."}

# 7. All tables created?
psql -U postgres -d globetrotter -c "\dt" | wc -l
# Should return: 20+ (number of tables)
```

---

## Troubleshooting

### Database Connection Issues

**Error: "FATAL: role 'postgres' does not exist"**
```bash
# On macOS, create postgres role
createuser postgres

# Or specify different user
psql -U <your-username> -d globetrotter
```

**Error: "Cannot connect to database"**
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1;"

# If error, start PostgreSQL
brew services start postgresql    # macOS
sudo systemctl start postgresql   # Linux

# Check connection string in .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/globetrotter
```

### Redis Connection Issues

**Error: "Cannot connect to Redis"**
```bash
# Check Redis is running
redis-cli ping

# Start Redis if not running
redis-server
# or
brew services start redis

# Verify Redis listening on port 6379
lsof -i :6379
```

### Port Already in Use

**Error: "Port 3000 already in use"**
```bash
# Find process using port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### Environment Variables Not Loading

**Error: "JWT_SECRET is undefined"**
```bash
# Verify .env file exists
ls -la .env

# Verify .env is in correct directory (repo root)
pwd
cat .env | head -5

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Start again
npm start
```

### Frontend Not Loading

**Error: "Cannot GET /"**
```bash
# Verify backend running
curl http://localhost:3000/api/health

# Verify frontend files in /frontend directory
ls -la frontend/*.html

# Check logs for errors
tail -f logs/application.log
```

---

## Next Steps

1. **Learn the Architecture:** Read `docs/ARCHITECTURE.md`
2. **API Reference:** Check `docs/API.md`
3. **Full-Stack Guide:** See `docs/FULL-STACK-SETUP.md`
4. **Deployment:** Review `docs/DEPLOYMENT.md`

---

## Support

For issues:
1. Check `docs/TROUBLESHOOTING.md`
2. Review logs: `tail -f logs/application.log`
3. Check GitHub issues: https://github.com/SateBroodjeDev/globetrotter-saas-backend/issues

---

**Happy coding! 🚀**
