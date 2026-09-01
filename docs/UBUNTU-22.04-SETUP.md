# 🐧 Ubuntu 22.04 LTS - Complete Globetrotter Setup Guide

> **Step-by-step installation guide for Ubuntu 22.04 LTS**

This guide walks you through everything needed to install and run Globetrotter on a fresh Ubuntu 22.04 system.

---

## 📋 Table of Contents

1. [Prerequisites Check](#prerequisites-check)
2. [System Updates](#system-updates)
3. [Install Node.js & npm](#install-nodejs--npm)
4. [Install PostgreSQL](#install-postgresql)
5. [Install Redis](#install-redis)
6. [Install Git](#install-git)
7. [Clone & Setup Backend](#clone--setup-backend)
8. [Clone & Setup Frontend](#clone--setup-frontend)
9. [Verify Installation](#verify-installation)
10. [Running the Stack](#running-the-stack)
11. [Troubleshooting](#troubleshooting)
12. [Production Setup](#production-setup)

---

## Prerequisites Check

Open a terminal and verify your Ubuntu version:

```bash
# Check Ubuntu version (should be 22.04)
lsb_release -a

# Output should show:
# Distributor ID: Ubuntu
# Release: 22.04
# Codename: jammy

# Check CPU cores
nproc
# Should show: 2 or more

# Check available RAM
free -h
# Should show at least 2GB available

# Check disk space
df -h
# Should show at least 1GB free in root partition
```

---

## System Updates

Before installing anything, update your system:

```bash
# Update package lists
sudo apt update

# Upgrade all packages
sudo apt upgrade -y

# This may take 5-10 minutes depending on your connection
# When prompted, press 'Y' and Enter to continue

# Optional: Install essential build tools
sudo apt install -y build-essential curl wget git
```

**Expected output:** "Processing triggers..." followed by a return to prompt.

---

## Install Node.js & npm

Ubuntu 22.04 comes with an old Node.js. We'll install the latest LTS version:

### Option A: Using NodeSource Repository (Recommended)

```bash
# Download NodeSource setup script
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js (includes npm)
sudo apt install -y nodejs

# Verify installation
node --version
# Should show: v18.x.x or higher

npm --version
# Should show: v9.x.x or higher
```

### Option B: Using Snap (Easier)

```bash
# Install via Snap
sudo snap install node --classic

# Verify
node --version
npm --version
```

**✅ Node.js & npm installed!**

---

## Install PostgreSQL

### Step 1: Add PostgreSQL Repository

```bash
# Download and add PostgreSQL key
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Import GPG key
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Update package lists
sudo apt update
```

### Step 2: Install PostgreSQL

```bash
# Install PostgreSQL 13 (and related tools)
sudo apt install -y postgresql-13 postgresql-contrib-13 postgresql-client-13

# Expected: Installation takes 2-3 minutes
```

### Step 3: Verify PostgreSQL Installation

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Expected output includes: "active (running)"

# If not running, start it:
sudo systemctl start postgresql

# Enable on boot
sudo systemctl enable postgresql
```

### Step 4: Create Database User & Database

```bash
# Switch to postgres user
sudo -u postgres psql

# At postgres=# prompt, type:
CREATE USER globetrotter WITH PASSWORD 'secure_password_here';

# Create database
CREATE DATABASE globetrotter OWNER globetrotter;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE globetrotter TO globetrotter;

# Exit psql
\q
```

**Or use a shortcut:**

```bash
# Create database in one command
sudo -u postgres createdb globetrotter

# Create user in one command
sudo -u postgres psql -c "CREATE USER globetrotter WITH PASSWORD 'secure_password_here';"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE globetrotter TO globetrotter;"
```

### Step 5: Test PostgreSQL Connection

```bash
# Test connection with new user
psql -U globetrotter -d globetrotter -h localhost -c "SELECT 1 as connection_test;"

# Expected output: connection_test
#                       1

# If connection fails, check:
sudo pg_isready -U globetrotter -d globetrotter -h localhost
# Should show: "accepting connections"
```

**✅ PostgreSQL installed and configured!**

---

## Install Redis

### Step 1: Install Redis

```bash
# Install Redis server
sudo apt install -y redis-server

# Verify installation
redis-server --version
# Should show: Redis server v=6.x.x or higher
```

### Step 2: Verify Redis is Running

```bash
# Check if Redis is running
sudo systemctl status redis-server

# Expected: "active (running)"

# Start if not running
sudo systemctl start redis-server

# Enable on boot
sudo systemctl enable redis-server
```

### Step 3: Test Redis Connection

```bash
# Connect to Redis
redis-cli

# At 127.0.0.1:6379> prompt, type:
ping

# Expected response: PONG

# Test SET/GET
SET test_key "hello"
GET test_key

# Exit Redis CLI
exit
```

**✅ Redis installed and running!**

---

## Install Git

```bash
# Install Git
sudo apt install -y git

# Verify installation
git --version
# Should show: git version 2.x.x or higher

# Configure Git (optional)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**✅ Git installed!**

---

## Clone & Setup Backend

### Step 1: Create Projects Directory

```bash
# Create a directory for projects
mkdir -p ~/projects/globetrotter
cd ~/projects/globetrotter

# Verify
pwd
# Should show: /home/yourusername/projects/globetrotter
```

### Step 2: Clone Backend Repository

```bash
# Clone the backend
git clone https://github.com/SateBroodjeDev/globetrotter-saas-backend.git

# Enter backend directory
cd globetrotter-saas-backend

# Verify clone
ls -la
# Should show: src/, frontend/, scripts/, package.json, .env.example, etc.
```

### Step 3: Install Dependencies

```bash
# Install npm packages
npm install

# This takes 2-3 minutes
# Look for "added XXX packages" at the end

# Verify installation
npm list | head -20
# Should show list of installed packages
```

### Step 4: Create Environment File

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env

# In nano editor, scroll through and set these values:

# ========== CORE SETTINGS ==========
NODE_ENV=development
PORT=3000

# ========== DATABASE ==========
DATABASE_URL=postgresql://globetrotter:secure_password_here@localhost:5432/globetrotter
DATABASE_DIALECT=postgres

# ========== REDIS ==========
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# ========== JWT ==========
JWT_SECRET=your-super-secret-key-min-32-characters-change-in-production
ACCESS_TOKEN_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# ========== URLs ==========
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3000/api

# ========== EMAIL (optional - leave for now) ==========
EMAIL_PROVIDER=console
# SENDGRID_API_KEY=SG.xxxxx (add later if needed)

# ========== STRIPE (optional - add later) ==========
# STRIPE_SECRET_KEY=sk_test_xxxxx
# STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# To save in nano:
# Press Ctrl+X, then Y, then Enter
```

**✅ Backend cloned and configured!**

---

## Clone & Setup Frontend

### Step 1: Clone Frontend Repository

```bash
# Go back to projects directory
cd ~/projects/globetrotter

# Clone frontend
git clone https://github.com/SateBroodjeDev/GlobeTrotr.git

# Enter frontend directory
cd GlobeTrotr

# Verify clone
ls -la *.html
# Should show: index.html, login.html, register.html, etc.

# Check JavaScript files
ls -la js/

# Check CSS files
ls -la css/
```

**Note:** Frontend is static HTML - no npm install needed!

**✅ Frontend cloned!**

---

## Verify Installation

### Check All Services

```bash
# Terminal 1: Check PostgreSQL
psql -U globetrotter -d globetrotter -c "SELECT 1 as db_check;"
# Expected: db_check
#                1

# Terminal 1: Check Redis
redis-cli ping
# Expected: PONG

# Terminal 1: Check Node.js
node --version
npm --version

# Terminal 1: Check Git
git --version
```

### Verify Backend Files

```bash
cd ~/projects/globetrotter/globetrotter-saas-backend

# Check critical files exist
test -f .env && echo "✓ .env exists"
test -f package.json && echo "✓ package.json exists"
test -d src && echo "✓ src/ directory exists"
test -d frontend && echo "✓ frontend/ directory exists"
test -d node_modules && echo "✓ node_modules/ installed"
```

### Verify Frontend Files

```bash
cd ~/projects/globetrotter/GlobeTrotr

# Check critical files exist
test -f index.html && echo "✓ index.html exists"
test -d auth && echo "✓ auth/ directory exists"
test -d js && echo "✓ js/ directory exists"
test -d css && echo "✓ css/ directory exists"
```

---

## Running the Stack

### Terminal Setup

You'll need **3 terminal windows** open:

**Terminal 1: PostgreSQL (auto-starting, just verify)**

```bash
sudo systemctl status postgresql
# Should show: active (running)
```

**Terminal 2: Redis (auto-starting, just verify)**

```bash
sudo systemctl status redis-server
# Should show: active (running)
```

**Terminal 3: Backend Server**

```bash
cd ~/projects/globetrotter/globetrotter-saas-backend

# Run migrations (first time only)
npm run migrate

# Expected: "✓ Database synced"

# Seed test data (first time only)
npm run seed

# Expected: "✓ Admin user created"
#           "✓ Sample workspace created"

# Start the server
npm start

# Expected output:
# ✓ Server running on http://localhost:3000
# ✓ Database connected
# ✓ Redis connected
# ✓ Email service initialized
```

### Access the Application

Open your web browser and navigate to:

**Main Dashboard**
```
http://localhost:3000/
```

**Test Admin Account**
```
Email:    admin@globetrotter.io
Password: admin123
```

**Other Pages to Test**
```
http://localhost:3000/index.html              (Dashboard)
http://localhost:3000/auth/register.html      (Register)
http://localhost:3000/auth/login.html         (Login)
http://localhost:3000/workspace/settings.html (Settings)
http://localhost:3000/admin/dashboard.html    (Admin)
```

---

## Testing the Installation

### Test Backend Health

```bash
# In Terminal 1 or 4, run:
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"..."}
```

### Test Database Connection

```bash
# Verify database has tables
psql -U globetrotter -d globetrotter -c "\dt"

# Should show 20+ tables (Users, Workspaces, Trips, Expenses, etc.)
```

### Test API Endpoint

```bash
# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@globetrotter.io","password":"admin123"}'

# Expected response includes:
# {"accessToken":"eyJ...","workspaceId":"..."}
```

### Test Frontend Pages

```bash
# In browser, test these flows:
1. Go to http://localhost:3000/auth/login.html
2. Login with admin credentials
3. Should redirect to dashboard
4. Click on workspace
5. Create new trip
6. Add expense
7. View settlements
```

---

## Troubleshooting

### PostgreSQL Issues

**Error: "could not connect to database"**

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# If not running, start it
sudo systemctl start postgresql

# Check if database exists
psql -U postgres -l | grep globetrotter

# If not, recreate it
createdb globetrotter
```

**Error: "role 'globetrotter' does not exist"**

```bash
# Create the user
sudo -u postgres createdb globetrotter
sudo -u postgres psql -c "CREATE USER globetrotter WITH PASSWORD 'password';"
```

**Error: "Connection refused" on port 5432**

```bash
# Check PostgreSQL is listening
sudo lsof -i :5432

# If nothing shows, restart PostgreSQL
sudo systemctl restart postgresql
```

### Redis Issues

**Error: "Connection refused" on port 6379**

```bash
# Check if Redis is running
sudo systemctl status redis-server

# Start Redis
sudo systemctl start redis-server

# Verify
redis-cli ping
# Should return: PONG
```

**Error: "Redis connection timeout"**

```bash
# Check Redis is listening
sudo lsof -i :6379

# Restart Redis
sudo systemctl restart redis-server
```

### Node.js Issues

**Error: "npm command not found"**

```bash
# Reinstall Node.js
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version
npm --version
```

**Error: "cannot find module"**

```bash
# Reinstall dependencies
cd ~/projects/globetrotter/globetrotter-saas-backend
rm -rf node_modules package-lock.json
npm install
```

### Backend Issues

**Error: "Port 3000 already in use"**

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm start
```

**Error: "Cannot load .env file"**

```bash
# Verify .env file exists
ls -la .env

# Verify it's in repo root
pwd
ls .env

# If missing, copy it
cp .env.example .env
```

**Error: "Database migrations failed"**

```bash
# Run migrations with verbose output
npm run migrate -- --verbose

# If still failing, check database connection
psql postgresql://globetrotter:password@localhost:5432/globetrotter -c "SELECT 1;"
```

### Connection Issues

**Cannot connect to http://localhost:3000**

```bash
# Verify backend is running (look for "Server running on http://localhost:3000")

# Check if port 3000 is listening
lsof -i :3000

# Try curl
curl http://localhost:3000/api/health

# If still failing, restart backend
# Stop it (Ctrl+C in backend terminal)
# Start it again: npm start
```

---

## Production Setup

### For Production Deployment

Once everything works locally, production setup involves:

1. **Database:** Use managed PostgreSQL (AWS RDS, DigitalOcean DB, etc.)
2. **Redis:** Use managed Redis (AWS ElastiCache, DigitalOcean)
3. **Server:** Linux VPS with nginx reverse proxy
4. **SSL:** Let's Encrypt certificates
5. **Process Manager:** PM2 or systemd services
6. **Monitoring:** Health checks and error tracking

See `docs/DEPLOYMENT.md` for full production guide.

---

## Next Steps

1. **Explore the application:** Create trips, add expenses, test features
2. **Read documentation:** Check `docs/INSTALLATION.md` for more details
3. **Understand architecture:** See `docs/ARCHITECTURE.md`
4. **Check API reference:** See `docs/API.md`
5. **Deploy to production:** See `docs/DEPLOYMENT.md`

---

## Summary

✅ **You now have:**
- Node.js 18+ with npm
- PostgreSQL 13 with globetrotter database
- Redis 6+ with persistence
- Git for version control
- Backend cloned and configured
- Frontend cloned and ready
- All services running on localhost

✅ **You can:**
- Access dashboard at http://localhost:3000
- Login with admin@globetrotter.io / admin123
- Create trips and track expenses
- Test all features locally
- Make changes and iterate

🚀 **Next:** Deploy to production when ready!

---

## Quick Reference

### Start All Services

```bash
# Terminal 1: Just verify PostgreSQL is running
sudo systemctl status postgresql

# Terminal 2: Just verify Redis is running
sudo systemctl status redis-server

# Terminal 3: Start backend
cd ~/projects/globetrotter/globetrotter-saas-backend
npm start
```

### Stop All Services

```bash
# Stop backend: Ctrl+C in terminal 3
# PostgreSQL: sudo systemctl stop postgresql
# Redis: sudo systemctl stop redis-server
```

### View Logs

```bash
# Backend logs
tail -f ~/projects/globetrotter/globetrotter-saas-backend/logs/application.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-13-main.log

# Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

### Database Commands

```bash
# Connect to database
psql -U globetrotter -d globetrotter

# List tables
\dt

# View table structure
\d tablename

# Exit
\q
```

---

**Need help? Check TROUBLESHOOTING section above!**

**Ready to code? Happy trip planning! 🌍✈️**
