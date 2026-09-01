# Globetrotter SaaS

Full-stack multi-tenant SaaS application for travel planning, expense splitting, and team coordination.

## Features

✅ **Multi-Tenant Architecture** - Isolated workspaces  
✅ **RBAC (4 Roles)** - Owner, Admin, Editor, Viewer  
✅ **JWT Authentication** - Secure token-based auth  
✅ **Trip Management** - Multi-trip planning with day-by-day itineraries  
✅ **Expense Splitting** - Automatic balance calculation & settlement  
✅ **White-Label Support** - Custom branding for agencies  
✅ **PostgreSQL + Redis** - Robust data storage & caching  
✅ **Docker Ready** - One-command deployment  
✅ **Audit Logging** - Full compliance tracking  
✅ **Public Sharing** - Share trips with read-only links  

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **ORM**: Sequelize
- **Auth**: JWT + bcrypt
- **Frontend**: HTML5 + Tailwind CSS + Alpine.js
- **Deployment**: Docker & Docker Compose

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start services
docker-compose up -d

# Run migrations
npm run db:migrate

# Start dev server
npm run dev
```

API: http://localhost:3000  
Frontend: http://localhost:8080

### Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete VPS setup guide.

## API Documentation

### Authentication
```bash
# Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "Jan",
  "lastName": "Jansen"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}

# Response
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": { ... },
  "workspaces": [ ... ]
}
```

### Workspaces (Multi-Tenant)
```bash
# Create workspace
POST /api/workspaces
Authorization: Bearer <token>
{
  "name": "Family Trip Planning",
  "slug": "family-trips"
}

# Invite member with role
POST /api/workspaces/:workspaceId/members/invite
{
  "email": "friend@example.com",
  "role": "editor"
}

# Update member role
PATCH /api/workspaces/:workspaceId/members/:userId/role
{
  "role": "admin"
}
```

### Trips
```bash
# Create trip
POST /api/trips
{
  "workspaceId": "uuid",
  "title": "Japan Cherry Blossom Tour",
  "startDate": "2024-04-05",
  "endDate": "2024-04-20",
  "type": "city_break",
  "description": "Tokyo, Kyoto, Osaka"
}

# Get workspace trips
GET /api/trips/workspace/:workspaceId

# Add day to trip
POST /api/trips/:tripId/days
{
  "date": "2024-04-05",
  "location": "Tokyo, Japan",
  "activities": ["Visit Senso-ji", "Shibuya Crossing"]
}
```

### Expenses & Settlement
```bash
# Add expense
POST /api/expenses
{
  "tripId": "uuid",
  "description": "Hotel booking",
  "amount": 150,
  "currency": "USD",
  "category": "accommodation",
  "date": "2024-04-05",
  "splitBetween": ["user1-id", "user2-id"]
}

# Calculate balances & settlements
GET /api/expenses/trip/:tripId/balances

Response:
{
  "balances": { "user1": 50.00, "user2": -50.00 },
  "transfers": [
    {
      "from": "user2",
      "to": "user1",
      "amount": 50.00
    }
  ]
}
```

## Role-Based Access Control

### Permissions Matrix

| Action | Owner | Admin | Editor | Viewer |
|--------|-------|-------|--------|--------|
| Create Trip | ✅ | ✅ | ✅ | ❌ |
| Edit Trip | ✅ | ✅ | ✅ | ❌ |
| Delete Trip | ✅ | ✅ | ❌ | ❌ |
| Manage Members | ✅ | ✅ | ❌ | ❌ |
| View Finances | ✅ | ✅ | ✅ | ❌ |
| Export Data | ✅ | ✅ | ✅ | ❌ |
| Manage Settings | ✅ | ❌ | ❌ | ❌ |
| Read-Only Access | ✅ | ✅ | ✅ | ✅ |

## Database Schema

```
users
├── id (UUID PK)
├── email (UNIQUE)
├── password_hash
├── first_name
├── last_name
├── avatar_url
├── email_verified
├── two_factor_enabled
├── last_login
├── created_at
└── updated_at

workspaces
├── id (UUID PK)
├── owner_id (FK → users)
├── name
├── slug (UNIQUE)
├── subdomain (UNIQUE)
├── plan_tier (starter|pro|business)
├── branding_config (JSONB)
├── stripe_customer_id
├── subscription_status
├── created_at
└── updated_at

workspace_users (N:M junction)
├── id (UUID PK)
├── user_id (FK)
├── workspace_id (FK)
├── role (owner|admin|editor|viewer)
├── permissions (JSONB)
├── invitation_token
└── created_at

trips
├── id (UUID PK)
├── workspace_id (FK)
├── created_by (FK → users)
├── title
├── slug (UNIQUE)
├── description
├── type (roadtrip|backpacking|city_break|safari|cruise)
├── status (planning|ongoing|completed)
├── start_date
├── end_date
├── budget
├── currency (EUR|USD|etc)
├── is_public
├── share_token
├── created_at
└── updated_at

expenses
├── id (UUID PK)
├── trip_id (FK)
├── paid_by (FK → users)
├── description
├── category
├── amount
├── currency
├── amount_eur (normalized)
├── exchange_rate
├── split_between (JSONB array of user IDs)
├── receipt_url
├── date
├── created_at
└── updated_at

days
├── id (UUID PK)
├── trip_id (FK)
├── date
├── location
├── activities (JSONB array)
├── weather (JSONB)
├── notes
├── created_at
└── updated_at

audit_logs
├── id (UUID PK)
├── workspace_id (FK)
├── user_id (FK)
├── action
├── resource
├── resource_id
├── changes (JSONB)
├── ip_address
├── user_agent
├── status (success|failure)
├── created_at
```

## Expense Splitting Algorithm

The system uses a greedy algorithm to calculate minimum number of transfers:

```
1. Calculate each person's balance (paid - owed)
2. Separate into debtors and creditors
3. Sort by amount (largest first)
4. Match debtors with creditors
5. Generate minimal transaction list
```

Example:
```
Trip costs: €300
Participants: A, B, C

A paid €180 (owes €100)
B paid €60 (owes €100)  
C paid €60 (owes €100)

Balances:
A: +80 (gets €80 back)
B: -40 (owes €40)
C: -40 (owes €40)

Settlements:
B → A: €40
C → A: €40
```

## White-Label Features

- Custom app name & logo
- Brand color customization
- Custom domain support
- Remove "Powered by Globetrotter" watermarks
- Custom email sender

## Subscription Tiers

### Starter (Free)
- 2 active trips
- 3 workspace members
- Basic expense tracking
- 7-day data retention

### Pro (€9.99/month)
- Unlimited trips
- 10 workspace members
- Full expense management
- PDF/CSV export
- Analytics dashboard
- 2-year data retention
- API access (100 req/day)

### Business (€99/month)
- All Pro features
- Unlimited members
- White-label branding
- Custom domain
- SSO/SAML support
- Advanced analytics
- Priority support
- 5 year data retention
- API access (10,000 req/day)

## Development

### Project Structure
```
.
├── src/
│   ├── server.js              # Main entry point
│   ├── config/                # Database, Redis config
│   ├── models/                # Sequelize models
│   ├── routes/                # API routes
│   ├── middleware/            # Auth, validation, error handling
│   ├── services/              # Business logic
│   └── constants/             # Exchange rates, etc
├── frontend/
│   └── index.html             # Single-page app
├── scripts/
│   ├── migrate.js             # Database migrations
│   └── seed.js                # Test data seeding
├── docker-compose.yml         # Local dev stack
├── docker-compose.prod.yml    # Production stack
└── README.md
```

### Testing

```bash
# Run tests
npm test

# With coverage
npm run test:coverage
```

### Code Standards

- ESLint configuration included
- Prettier for code formatting
- 2-space indentation
- Async/await for async operations

## Security

- ✅ JWT tokens with expiration
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ CORS enabled for frontend origin
- ✅ Helmet.js for HTTP headers
- ✅ Rate limiting on auth endpoints
- ✅ SQL injection prevention (Sequelize ORM)
- ✅ XSS protection
- ✅ CSRF tokens for state-changing operations
- ✅ Audit logging for compliance
- ✅ Data encryption at rest (PostgreSQL)
- ✅ Data encryption in transit (HTTPS/TLS)

## Performance

- Redis caching for frequently accessed data
- Database connection pooling
- Query optimization with indexes
- Lazy loading of relationships
- Paginated API responses
- CDN-ready static assets

## Monitoring

- Health check endpoint: `GET /health`
- Sentry integration for error tracking
- Request logging with Winston
- Database query logging
- Performance metrics

## License

MIT License - See LICENSE file

## Support

- **Documentation**: https://docs.globetrotter.io
- **Issues**: https://github.com/SateBroodjeDev/globetrotter-saas-backend/issues
- **Email**: support@globetrotter.io
- **Status Page**: https://status.globetrotter.io

---

**Made with ❤️ by SateBroodjeDev**  
**© 2024 Globetrotter SaaS. All rights reserved.**
