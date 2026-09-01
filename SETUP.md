# 🚀 Globetrotter - Complete Stack Quick Start

Get **Globetrotter backend + frontend** running locally in **10 minutes**.

## ⚡ Prerequisites

Ensure these are installed on your machine:

```bash
node --version        # v18+ required
npm --version         # v9+ required
postgres --version    # v13+ required  
redis-server --version # v6+ required
git --version
```

**Not installed?**
- [Node.js](https://nodejs.org/) (includes npm)
- [PostgreSQL](https://www.postgresql.org/download/)
- [Redis](https://redis.io/download)
- [Git](https://git-scm.com/)

---

## 🔧 Step 1: Setup Backend

```bash
# Clone backend repository
git clone https://github.com/SateBroodjeDev/globetrotter-saas-backend.git
cd globetrotter-saas-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env - set these critical variables:
# NODE_ENV=development
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/globetrotter
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=your-secret-key-change-in-production
nano .env
```

---

## 📦 Step 2: Setup Database

```bash
# Start PostgreSQL (if not already running)
# macOS:
brew services start postgresql

# Linux:
sudo systemctl start postgresql

# Create database
createdb globetrotter

# Verify connection
psql -U postgres -d globetrotter -c "SELECT 1;"

# Run migrations
npm run migrate

# Seed with test data (creates admin user + sample workspace)
npm run seed

echo "✅ Database ready!"
```

---

## 🎨 Step 3: Setup Frontend

```bash
# In a NEW terminal, clone frontend repository
git clone https://github.com/SateBroodjeDev/GlobeTrotr.git
cd GlobeTrotr

# No npm install needed - static HTML!
# Just verify frontend files exist
ls -la *.html
ls -la js/
ls -la css/

echo "✅ Frontend ready!"
```

---

## 🚀 Step 4: Start Redis

```bash
# In another NEW terminal
redis-server

# Or if using Homebrew:
brew services start redis

# Verify
redis-cli ping
# Should return: PONG

echo "✅ Redis running!"
```

---

## ⚙️ Step 5: Start Backend Server

```bash
# Back in backend directory
cd globetrotter-saas-backend

# Start server
npm start

# Expected output:
# ✓ Server running on http://localhost:3000
# ✓ Database connected
# ✓ Redis connected
# ✓ Email service initialized
# ✓ Stripe service initialized

echo "✅ Backend running!"
```

---

## 🌐 Step 6: Access Application

### Dashboard & Main Pages
```
http://localhost:3000/                    (Dashboard - redirects)
http://localhost:3000/index.html          (Dashboard)
http://localhost:3000/workspace/settings.html
http://localhost:3000/workspace/analytics.html
http://localhost:3000/admin/dashboard.html
```

### Authentication Pages
```
http://localhost:3000/auth/register.html
http://localhost:3000/auth/login.html
http://localhost:3000/auth/forgot-password.html
http://localhost:3000/auth/reset-password.html
http://localhost:3000/auth/verify-email.html
```

### Other Pages
```
http://localhost:3000/pricing.html
http://localhost:3000/trip/public.html
```

### Test Admin Account
```
Email:    admin@globetrotter.io
Password: admin123
```

⚠️ **Change admin password immediately in production!**

---

## 🧪 Step 7: Test Full Stack

### Test Backend
```bash
# Check API health
curl http://localhost:3000/api/health

# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

### Test Frontend
```bash
# Open browser to:
http://localhost:3000/auth/register.html

# Complete flow:
1. Register account
2. Check console for success
3. Navigate to login
4. Login with new account
5. See dashboard
```

---

## 📊 Terminal Windows Needed

You'll need **4 terminal windows** running:

```
Terminal 1: PostgreSQL
  brew services start postgresql

Terminal 2: Redis
  redis-server

Terminal 3: Backend Server
  cd globetrotter-saas-backend && npm start

Terminal 4: (For misc commands/testing)
  cd GlobeTrotr  (if you need to check frontend files)
```

---

## ✅ Verification Checklist

Run this to verify everything works:

```bash
# Backend running?
curl http://localhost:3000/api/health

# Database connected?
psql -U postgres -d globetrotter -c "SELECT COUNT(*) FROM Users;"

# Redis running?
redis-cli ping

# Frontend accessible?
curl http://localhost:3000/index.html | head -20

# Admin user exists?
psql -U postgres -d globetrotter -c "SELECT email FROM Users WHERE email='admin@globetrotter.io';"
```

All should return success! ✅

---

## 🛑 Stopping Everything

```bash
# Stop Backend (Ctrl+C in terminal 3)

# Stop Redis (Ctrl+C in terminal 2 or brew services stop redis)

# Stop PostgreSQL
brew services stop postgresql    # macOS
sudo systemctl stop postgresql   # Linux

# Note: Frontend is static, nothing to stop!
```

---

## 🐛 Quick Troubleshooting

### "Port 3000 in use"
```bash
# Find process
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### "Cannot connect to database"
```bash
# Check PostgreSQL running
psql -U postgres

# Verify database exists
psql -U postgres -l | grep globetrotter

# Re-create if needed
dropdb globetrotter
createdb globetrotter
npm run migrate
npm run seed
```

### "Cannot connect to Redis"
```bash
# Check Redis running
redis-cli ping

# Start Redis
redis-server
# or
brew services start redis
```

### "Frontend shows 404 errors"
```bash
# Backend must be running on port 3000
# Frontend files are served from there

# Check backend running:
curl http://localhost:3000/index.html

# If error, restart backend:
cd globetrotter-saas-backend
npm start
```

---

## 📚 Next Steps

1. **Read detailed docs:** `docs/INSTALLATION.md`
2. **Understand architecture:** `docs/ARCHITECTURE.md`
3. **API reference:** `docs/API.md`
4. **Full-stack setup:** `docs/FULL-STACK-SETUP.md`

---

## 🎯 What's Working Now?

✅ User registration & authentication
✅ Workspace creation & management
✅ Trip planning & sharing
✅ Expense tracking & settlements
✅ Payment processing (Stripe)
✅ Public trip sharing
✅ Email notifications
✅ Admin dashboard
✅ Analytics

---

## 💬 Still Having Issues?

Check detailed troubleshooting guide:
```bash
cat docs/TROUBLESHOOTING.md
```

View logs:
```bash
tail -f logs/application.log
```

---

**You're all set! Happy trip planning! 🌍✈️**
