# Globetrotter SaaS - API Reference

Base URL: `https://api.globetrotter.nl/api`

All protected endpoints require: `Authorization: ******

---

## Authentication

### POST /auth/register
Create a new account.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "Jan",
  "lastName": "Janssen"
}
```

**Response 201:**
```json
{
  "message": "Registration successful",
  "user": { "id": "uuid", "email": "user@example.com" },
  "workspace": { "id": "uuid", "name": "Jan's Workspace" },
  "accessToken": "eyJ..."
}
```

---

### POST /auth/login
Login and receive tokens.

**Body:**
```json
{ "email": "user@example.com", "password": "SecurePass123!" }
```

**Response 200:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "uuid", "email": "...", "firstName": "Jan" },
  "workspaces": [{ "id": "uuid", "name": "Jan's Workspace", "role": "owner" }]
}
```

---

### POST /auth/logout
Invalidate the current token.

---

### POST /auth/verify-email/:token
Verify email address with the token sent via email.

---

## Workspaces

### GET /workspaces/:workspaceId
Get workspace details including members.

### POST /workspaces
Create a new workspace.

**Body:** `{ "name": "My Team", "slug": "my-team", "description": "..." }`

### PATCH /workspaces/:workspaceId/branding
Update workspace branding (owner/admin only).

### GET /workspaces/:workspaceId/members
List workspace members.

### POST /workspaces/:workspaceId/members/invite
Invite a member by email.

**Body:** `{ "email": "colleague@example.com", "role": "editor" }`

Roles: `owner`, `admin`, `editor`, `viewer`

---

## Trips

### GET /trips/workspace/:workspaceId
List all trips in a workspace.

### POST /trips
Create a new trip.

**Body:**
```json
{
  "workspaceId": "uuid",
  "title": "Japan 2025",
  "startDate": "2025-04-01",
  "endDate": "2025-04-15",
  "type": "city_break",
  "description": "Cherry blossom season"
}
```

Trip types: `roadtrip`, `backpacking`, `city_break`, `safari`, `cruise`, `other`

### GET /trips/public/:shareToken
Get public read-only trip view (no auth required).

### POST /trips/:tripId/days
Add an itinerary day.

**Body:** `{ "date": "2025-04-01", "location": "Tokyo", "activities": [], "notes": "..." }`

### POST /trips/:tripId/share
Generate a public share token for a trip.

### GET /trips/:tripId/stats
Get trip statistics (budget, expenses, days).

---

## Expenses

### GET /expenses/trip/:tripId
List trip expenses (supports `startDate`, `endDate`, `category`, `participant` query filters).

### POST /expenses
Add an expense.

**Body:**
```json
{
  "tripId": "uuid",
  "description": "Hotel Shinjuku",
  "amount": 120.00,
  "originalCurrency": "USD",
  "date": "2025-04-01",
  "category": "hotel",
  "splitType": "equal",
  "participants": ["user-id-1", "user-id-2"],
  "receipt": "https://cdn.example.com/receipts/123.jpg"
}
```

Categories: `food`, `transport`, `hotel`, `activities`, `shopping`, `drinks`, `services`, `other`

### GET /expenses/trip/:tripId/summary
Get category breakdown and totals.

### PUT /expenses/:expenseId
Update an expense.

### GET /expenses/:expenseId/receipt
Get expense receipt image URL.

### POST /trips/:tripId/calculate-settlement
Calculate and persist settlement transactions.

### GET /trips/:tripId/balances
Get per-person balances and settlement plan.

### POST /settlements/:settlementId/mark-paid
Mark settlement as paid (optional `proofImage` in body).

### GET /settlements/:tripId/history
Get settlement history with timestamps and proof images.

### DELETE /expenses/:expenseId
Soft-delete an expense.

---

## Bookings

### GET /bookings/trip/:tripId
List all bookings for a trip.

### POST /bookings
Add a booking.

**Body:**
```json
{
  "tripId": "uuid",
  "type": "flight",
  "provider": "KLM",
  "bookingReference": "ABC123",
  "date": "2025-04-01",
  "location": "Amsterdam → Tokyo",
  "price": 850.00,
  "currency": "EUR",
  "status": "confirmed"
}
```

Types: `flight`, `hotel`, `rental_car`, `train`, `activity`, `other`
Statuses: `confirmed`, `pending`, `cancelled`

### PATCH /bookings/:bookingId
Update a booking.

### DELETE /bookings/:bookingId
Delete a booking.

---

## Checklist

### GET /checklist/trip/:tripId
Get all checklists for a trip.

### POST /checklist
Create a checklist.

**Body:**
```json
{
  "tripId": "uuid",
  "title": "Packing List",
  "items": [
    { "id": 1, "text": "Passport", "done": false }
  ]
}
```

### PATCH /checklist/:checklistId
Update checklist (e.g. toggle items).

### DELETE /checklist/:checklistId
Delete a checklist.

---

## Public Endpoints

### GET /public/trips/:shareToken
View a shared trip (no auth required).

### GET /currency/exchange
Get current/historical exchange rates (`?date=YYYY-MM-DD`).

### GET /currency/supported
Get supported common travel currencies for dropdowns.

---

## Admin Endpoints

*Requires admin role (`role: "admin"` on user).*

### GET /admin/users
Paginated list of all users. Query: `?page=1&limit=20`

### POST /admin/users
Create a user.

### PATCH /admin/users/:id
Update user fields.

### DELETE /admin/users/:id
Soft-delete a user.

### POST /admin/users/:id/reset-password
Force reset a user's password.

### PATCH /admin/users/:id/ban
Ban or unban a user. Body: `{ "banned": true }`

### GET /admin/workspaces
List all workspaces with owner info.

### GET /admin/analytics
System-wide metrics (users, workspaces, trips).

### GET /admin/health
System health (database, redis, uptime, memory).

### GET /admin/audit-logs
Paginated audit log. Query: `?page=1&limit=50`

---

## Error Responses

All errors follow this format:
```json
{
  "error": "Short error description",
  "message": "Detailed message (development only)"
}
```

| Status | Meaning               |
|--------|-----------------------|
| 400    | Bad request / validation error |
| 401    | Unauthorized (no/expired token) |
| 403    | Forbidden (insufficient role) |
| 404    | Resource not found |
| 409    | Conflict (duplicate) |
| 429    | Rate limit exceeded |
| 500    | Internal server error |
