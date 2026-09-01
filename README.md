# 🌍 Globetrotter - Travel Planner SaaS

> **An all-in-one travel planning platform for groups. Track expenses, split costs, plan trips, and share memories together.**

---

## 📋 Table of Contents

- [What is Globetrotter?](#what-is-globetrotter)
- [Features](#features)
- [Current Status](#current-status)
- [Quick Start](#quick-start)
- [What's Complete](#whats-complete)
- [What's Coming](#whats-coming)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Support](#support)

---

## What is Globetrotter?

Globetrotter is a **web-based SaaS platform** that helps groups of travelers:

🗺️ **Plan Trips Together**
- Create and manage group trips
- Organize days/activities
- Share itineraries with family & friends

💰 **Split Expenses**
- Track all shared expenses
- Automatically calculate who owes whom
- Mark payments as complete
- Generate settlement reports

📱 **Collaborate in Real-Time**
- Invite members to workspaces
- Add bookings (flights, hotels, rentals)
- Create shared checklists
- Leave comments & notes

🔗 **Share Publicly**
- Create public share links
- View trips without login
- Track analytics
- Let others comment

💳 **Manage Subscriptions**
- Multiple pricing tiers
- Stripe integration
- Automatic billing

🎛️ **Admin Dashboard**
- Manage users & workspaces
- View analytics & KPIs
- Monitor subscriptions
- Audit logs

---

## Features

### User Features ✅

| Feature | Status | Details |
|---------|--------|---------|
| User Registration | ✅ Complete | Sign up with email/password |
| Email Verification | ✅ Complete | Verify email before access |
| Password Reset | ✅ Complete | Forgot password flow |
| User Profile | ✅ Complete | Manage name, email, preferences |
| Workspace Management | ✅ Complete | Create/manage multiple workspaces |
| Workspace Invites | ✅ Complete | Invite users via email |
| Workspace Roles | ✅ Complete | Owner/Editor/Viewer roles |
| Session Management | ✅ Complete | Login/logout/refresh tokens |

### Trip Management ✅

| Feature | Status | Details |
|---------|--------|---------|
| Create Trip | ✅ Complete | Start a new trip |
| View Trip | ✅ Complete | See trip details |
| Edit Trip | 🟡 Phase 2 | Modify trip info |
| Delete Trip | 🟡 Phase 2 | Remove trip (soft delete) |
| Add Trip Days | ✅ Complete | Organize by day |
| Add Trip Members | ✅ Complete | Invite co-travelers |
| Trip Sharing | ✅ Complete | Public share links |
| Trip Analytics | ✅ Complete | View stats & insights |

### Expense Management ✅

| Feature | Status | Details |
|---------|--------|---------|
| Add Expense | ✅ Complete | Track spending |
| View Expenses | ✅ Complete | See all costs |
| Edit Expense | ✅ Complete | Update amount/description |
| Delete Expense | ✅ Complete | Remove mistake |
| Expense Categories | ✅ Complete | Organize by type |
| Expense Assignments | ✅ Complete | Assign to specific people |

### Settlement & Payments ✅

| Feature | Status | Details |
|---------|--------|---------|
| Calculate Settlements | ✅ Complete | Auto-calc who owes whom |
| Mark Paid | ✅ Complete | Record payments |
| Settlement Reminders | ✅ Complete | Weekly email reminders |
| Payment History | ✅ Complete | Track all payments |
| Settlement Reports | ✅ Complete | Export/view reports |

### Bookings ✅

| Feature | Status | Details |
|---------|--------|---------|
| Add Booking | ✅ Complete | Flights, hotels, rentals, etc |
| View Bookings | ✅ Complete | See all reservations |
| Edit Booking | ✅ Complete | Update details |
| Booking Types | ✅ Complete | Flight/Hotel/Rental/Train/Bus |

### Checklists ✅

| Feature | Status | Details |
|---------|--------|---------|
| Create Checklist | ✅ Complete | Task lists |
| Add Items | ✅ Complete | Sub-tasks |
| Mark Complete | ✅ Complete | Track progress |
| Assign Tasks | ✅ Complete | Delegate to members |

### Admin Features ✅

| Feature | Status | Details |
|---------|--------|---------|
| User Management | ✅ Complete | View/edit users |
| Workspace Management | ✅ Complete | Manage workspaces |
| Subscription Management | ✅ Complete | View/manage plans |
| Audit Logs | ✅ Complete | Track all actions |
| System Health | ✅ Complete | Monitor status |
| Analytics Dashboard | ✅ Complete | KPIs & metrics |

### Email & Notifications ✅

| Feature | Status | Details |
|---------|--------|---------|
| Welcome Email | ✅ Complete | New user onboarding |
| Verification Email | ✅ Complete | Email confirmation |
| Password Reset Email | ✅ Complete | Account recovery |
| Workspace Invite Email | ✅ Complete | Invite notifications |
| Payment Receipt Email | ✅ Complete | Invoice tracking |
| Settlement Reminders | ✅ Complete | Weekly payment reminders |

### Payments ✅

| Feature | Status | Details |
|---------|--------|---------|
| Stripe Integration | ✅ Complete | Payment processing |
| Subscription Plans | ✅ Complete | Pro/Business tiers |
| Webhook Handling | ✅ Complete | Payment confirmations |
| Invoice Tracking | ✅ Complete | Receipt history |
| Plan Features | ✅ Complete | Feature gating by plan |

---

## Current Status

### What's Complete (Ready to Use) ✅

```
Backend (Node.js/Express)
├─ REST API with 30+ endpoints
├─ Authentication & Authorization
├─ Database schema & ORM (Sequelize)
├─ Migrations system
├─ Seed data script
├─ Email service integration
├─ Stripe payment integration
├─ Redis session management
├─ Error handling & logging
├─ Audit logging
└─ Admin dashboard endpoints

Frontend (Static HTML/CSS/JS)
├─ Authentication pages (5 pages)
├─ Dashboard
├─ Workspace management
├─ Trip management
├─ Expense tracking
├─ Settlement views
├─ Admin dashboard
├─ Public sharing
└─ Responsive design

Database
├─ PostgreSQL schema (20+ tables)
├─ Relationships & constraints
├─ Indexes for performance
└─ Migration system

Infrastructure
├─ Docker setup
├─ Environment configuration
├─ Logging system
├─ Redis caching
└─ Error tracking ready
```

### What's in Progress (Phase 1 & 2) 🟡

Phase 1 (Critical Fixes):
- ✅ Stripe webhook raw body handling
- ✅ Workspace authorization enforcement
- ✅ Frontend auth token standardization
- ✅ Settlement reminder schema fixes

Phase 2 (High Priority):
- 🟡 Trip edit/delete endpoints
- 🟡 Invite acceptance flow
- 🟡 Frontend auth pages (register/login/forgot-password)
- 🟡 Input validation schemas

### What's Coming (Phase 3 & 4) 🔵

Phase 3 (Medium Priority):
- Plan gating fixes
- Password token management
- Docker image optimization
- Database migrations setup
- Error handling improvements

Phase 4 (Nice-to-Have):
- Advanced analytics
- Photo/document uploads
- Mobile app
- Payment plans customization
- Bulk operations
- API rate limiting
- Advanced reporting

---

## Quick Start

### ⚡ 5-Minute Setup (Ubuntu 22.04)

```bash
# 1. Install prerequisites (one command)
curl https://raw.githubusercontent.com/SateBroodjeDev/globetrotter-saas-backend/main/scripts/install-ubuntu-22.04.sh | bash

# 2. Clone and setup backend
git clone https://github.com/SateBroodjeDev/globetrotter-saas-backend.git
cd globetrotter-saas-backend
npm install
cp .env.example .env
npm run migrate
npm run seed

# 3. Start server
npm start

# 4. Access
http://localhost:3000
Login: admin@globetrotter.io / admin123
```

For detailed setup → See [SETUP.md](./SETUP.md) or [Ubuntu 22.04 Guide](./docs/UBUNTU-22.04-SETUP.md)

---

## What's Complete

### ✅ Ready for Production (Phase 1 Fixed)

- [x] User authentication (register/login/password reset)
- [x] Workspace management (create/invite/roles)
- [x] Trip planning (create/view/days/members)
- [x] Expense tracking (add/edit/delete/categorize)
- [x] Settlement calculation (auto-calc/payments/reminders)
- [x] Bookings management (flights/hotels/rentals/trains/buses)
- [x] Checklists (create/items/assign)
- [x] Public sharing (links/analytics/comments)
- [x] Stripe payments (webhooks/subscriptions/receipts)
- [x] Email service (welcome/invites/receipts/reminders)
- [x] Admin dashboard (users/workspaces/subscriptions)
- [x] Audit logging (all actions tracked)
- [x] Database migrations
- [x] Redis caching & sessions
- [x] Error handling
- [x] Security middleware (auth/workspace checks)
- [x] CORS configuration
- [x] Rate limiting ready

---

## What's Coming

### 🟡 Phase 2 - High Priority (In Progress)

Completing core user workflows:

- [ ] **Trip CRUD Complete**
  - [ ] GET /api/trips/:tripId (view single)
  - [ ] PUT /api/trips/:tripId (edit)
  - [ ] DELETE /api/trips/:tripId (delete)
  - [ ] Frontend pages (view/edit/create)

- [ ] **Workspace Invite Acceptance**
  - [ ] Public invite endpoint
  - [ ] Frontend invite page
  - [ ] Email link integration
  - [ ] Auto-add to workspace

- [ ] **Authentication Pages**
  - [ ] Register page (HTML)
  - [ ] Login page (HTML)
  - [ ] Forgot password page
  - [ ] Reset password page
  - [ ] Verify email page
  - [ ] Auth utilities (shared JS)

- [ ] **Input Validation**
  - [ ] Booking schema
  - [ ] Checklist schema
  - [ ] Comment schema
  - [ ] Checkout schema
  - [ ] Frontend validation

**ETA:** This week (3-4 hours)

### 🔵 Phase 3 - Medium Priority

- [ ] Plan gating bypass fix
- [ ] Password token revocation
- [ ] Docker image optimization
- [ ] Database migration guide
- [ ] Error handling improvements
- [ ] Duplicate endpoint cleanup

**ETA:** Next week (2-3 hours)

### 🟣 Phase 4 - Nice-to-Have

- [ ] Advanced analytics
- [ ] Photo/document uploads
- [ ] Mobile app template
- [ ] Payment plans customization
- [ ] Bulk operations
- [ ] API rate limiting
- [ ] Advanced reporting
- [ ] Two-factor authentication
- [ ] Social login (Google/GitHub)
- [ ] Dark mode

**ETA:** Backlog (ongoing)

---

## Tech Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 13+
- **ORM:** Sequelize
- **Cache:** Redis 6+
- **Authentication:** JWT + Passport
- **Payments:** Stripe API
- **Email:** SendGrid
- **Logging:** Winston
- **Error Tracking:** Sentry ready

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Responsive design, Tailwind ready
- **Vanilla JavaScript** - No framework dependency
- **Fetch API** - HTTP requests
- **localStorage** - Session persistence

### Infrastructure
- **Containerization:** Docker
- **Process Manager:** PM2
- **Reverse Proxy:** Nginx ready
- **Monitoring:** Health checks ready
- **CI/CD:** GitHub Actions ready

---

## Project Structure

```
globetrotter-saas-backend/
├── src/
│   ├── models/              # Database models (Sequelize)
│   ├── routes/              # API endpoints
│   ├── services/            # Business logic
│   ├── middleware/          # Express middleware
│   ├── utils/               # Helper functions
│   ├── jobs/                # Background jobs (email, cron)
│   ├── config/              # Configuration files
│   └── server.js            # Main entry point
│
├── frontend/                # Static HTML/CSS/JS (served by backend)
│   ├── index.html           # Dashboard
│   ├── auth/                # Authentication pages
│   ├── workspace/           # Workspace pages
│   ├── trips/               # Trip management pages
│   ├── admin/               # Admin dashboard
│   ├── js/                  # JavaScript utilities
│   └── css/                 # Stylesheets
│
├── scripts/
│   ├── migrate.js           # Run migrations
│   ├── seed.js              # Seed test data
│   ├── install-ubuntu-22.04.sh  # Ubuntu setup script
│   └── install-macos.sh     # macOS setup script
│
├── docs/
│   ├── INSTALLATION.md      # Setup guide
│   ├── UBUNTU-22.04-SETUP.md # Ubuntu-specific guide
│   ├── ARCHITECTURE.md      # System design
│   ├── API.md               # API reference
│   ├── FULL-STACK-SETUP.md  # Integration guide
│   └── TROUBLESHOOTING.md   # Common issues
│
├── SETUP.md                 # Quick start (5 minutes)
├── README.md                # This file
├── .env.example             # Environment template
├── package.json             # Dependencies
├── Dockerfile               # Container image
├── docker-compose.yml       # Container orchestration
└── .gitignore               # Git ignore rules

GlobeTrotr/                 # Frontend repository (static HTML)
├── index.html              # Main dashboard
├── auth/                   # Auth pages
├── workspace/              # Workspace pages
├── trips/                  # Trip pages
├── admin/                  # Admin pages
├── js/                     # Shared JavaScript
└── css/                    # Shared styles
```

---

## Getting Started

### For Users

1. **Register:** https://yourdomain.com/auth/register.html
2. **Create Workspace:** Set up a new workspace
3. **Invite Members:** Share invite links with friends
4. **Create Trip:** Start planning your next adventure
5. **Track Expenses:** Add costs and settle up

### For Developers

1. **Setup:** See [SETUP.md](./SETUP.md)
2. **Ubuntu 22.04:** See [docs/UBUNTU-22.04-SETUP.md](./docs/UBUNTU-22.04-SETUP.md)
3. **Architecture:** Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. **API Reference:** Check [docs/API.md](./docs/API.md)
5. **Troubleshooting:** See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

### For DevOps

1. **Installation:** [docs/UBUNTU-22.04-SETUP.md](./docs/UBUNTU-22.04-SETUP.md) or [docs/INSTALLATION.md](./docs/INSTALLATION.md)
2. **Deployment:** [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
3. **Docker:** [Dockerfile](./Dockerfile) & [docker-compose.yml](./docker-compose.yml)
4. **Monitoring:** Health checks at `/api/health`

---

## Deployment

### Quick Deploy (Ubuntu 22.04)

```bash
# See Ubuntu setup guide
docs/UBUNTU-22.04-SETUP.md

# Then deploy
npm start

# In production (with PM2)
pm2 start npm --name globetrotter -- start
pm2 save
pm2 startup
pm2 startup
```

### Docker Deploy

```bash
# Build image
docker build -t globetrotter-saas .

# Run container
docker-compose up -d

# Access
http://localhost:3000
```

### Cloud Deployment

- **Heroku:** Procfile ready
- **AWS:** RDS (PostgreSQL) + ElastiCache (Redis)
- **DigitalOcean:** App Platform ready
- **Azure:** App Service ready
- **Google Cloud:** Cloud Run ready

---

## Requirements

### System
- **OS:** Ubuntu 22.04 LTS (other Linux/macOS/Windows WSL2 supported)
- **CPU:** 2+ cores
- **RAM:** 2GB minimum, 4GB recommended
- **Disk:** 1GB free

### Software
- **Node.js:** 18.0 or higher
- **npm:** 9.0 or higher
- **PostgreSQL:** 13.0 or higher
- **Redis:** 6.0 or higher

---

## Configuration

All configuration is done via `.env` file:

```env
# See .env.example for complete list
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG_...
```

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout
- `POST /api/auth/forgot-password` - Request password reset
- `PUT /api/auth/reset-password` - Reset password

### Workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces` - List user's workspaces
- `GET /api/workspaces/:id` - Get workspace
- `PUT /api/workspaces/:id` - Update workspace
- `DELETE /api/workspaces/:id` - Delete workspace
- `GET /api/workspaces/:id/members` - List members
- `POST /api/workspaces/:id/members/invite` - Invite member
- `DELETE /api/workspaces/:id/members/:userId` - Remove member

### Trips
- `POST /api/trips` - Create trip
- `GET /api/trips/workspace/:workspaceId` - List trips
- `GET /api/trips/:tripId` - Get trip
- `PUT /api/trips/:tripId` - Update trip (Phase 2)
- `DELETE /api/trips/:tripId` - Delete trip (Phase 2)
- `POST /api/trips/:tripId/days` - Add day
- `GET /api/trips/:tripId/expenses` - List expenses
- `POST /api/trips/:tripId/expenses` - Add expense
- `PUT /api/trips/:tripId/expenses/:expenseId` - Update expense
- `DELETE /api/trips/:tripId/expenses/:expenseId` - Delete expense

### Settlements
- `GET /api/trips/:tripId/settlements` - List settlements
- `POST /api/trips/:tripId/settlements/:settlementId/mark-paid` - Mark paid
- `GET /api/trips/:tripId/settlements/summary` - Settlement summary

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:bookingId` - Get booking
- `PUT /api/bookings/:bookingId` - Update booking
- `DELETE /api/bookings/:bookingId` - Delete booking

### Checklists
- `POST /api/checklist` - Create checklist
- `GET /api/checklist/:id` - Get checklist
- `PUT /api/checklist/:id` - Update checklist
- `DELETE /api/checklist/:id` - Delete checklist

### Sharing
- `POST /api/shares` - Create public share
- `GET /api/public/shares/:token` - View public trip
- `POST /api/public/shares/:token/comments` - Add comment

### Payments
- `POST /api/payments/checkout` - Create checkout session
- `POST /api/payments/webhook` - Stripe webhook

### Admin
- `GET /api/admin/users` - List users
- `GET /api/admin/workspaces` - List workspaces
- `GET /api/admin/subscriptions` - List subscriptions
- `GET /api/admin/audit-logs` - View audit logs
- `GET /api/health` - Health check

---

## Support & Contributing

### Getting Help
1. Check [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
2. Review [docs/FAQ.md](./docs/FAQ.md) (coming soon)
3. Open GitHub issue: https://github.com/SateBroodjeDev/globetrotter-saas-backend/issues

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## License

Proprietary - All rights reserved

---

## Roadmap

### v1.0 (Current)
- ✅ Core functionality
- ✅ User authentication
- ✅ Trip planning
- ✅ Expense tracking
- ✅ Settlement calculation
- 🟡 Phase 2 (in progress)

### v1.1 (Next)
- 🔵 Phase 3 features
- 🔵 Enhanced error handling
- 🔵 Performance optimization

### v1.2+
- 🟣 Phase 4 features
- 🟣 Mobile app
- 🟣 Advanced analytics
- 🟣 Photo uploads
- 🟣 Payment customization

---

## Contact

- **Developer:** SateBroodjeDev
- **GitHub:** https://github.com/SateBroodjeDev
- **Email:** (Add contact email)

---

**Ready to explore the globe? 🌍✈️**

[Get Started](./SETUP.md) • [Documentation](./docs/) • [Issues](https://github.com/SateBroodjeDev/globetrotter-saas-backend/issues)
