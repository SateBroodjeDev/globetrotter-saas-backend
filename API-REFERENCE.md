# API Reference – Globetrotter SaaS

Base URL: `https://api.globetrotter.nl/api`

Authentication: `Authorization: ******

---

## Auth

### POST /auth/register
Create user + default workspace.
```json
{ "email": "user@example.com", "password": "secret123", "firstName": "Jan", "lastName": "Jansen" }
```
Response: `{ user, workspace, accessToken }`

### POST /auth/login
```json
{ "email": "user@example.com", "password": "secret123" }
```
Response: `{ accessToken, workspaces, user }`

### POST /auth/logout
Blacklists the current token.

### POST /auth/verify-email/:token
Verifies email address.

### POST /auth/forgot-password
```json
{ "email": "user@example.com" }
```
Sends reset link by email (always returns 200).

### POST /auth/reset-password
```json
{ "token": "...", "password": "newpassword" }
```

---

## Workspaces

### GET /workspaces/:workspaceId
Get workspace details including members.

### PATCH /workspaces/:workspaceId
Update workspace (owner/admin only).
```json
{ "name": "My Agency", "plan": "pro" }
```

### POST /workspaces/:workspaceId/members
Invite member.
```json
{ "email": "new@example.com", "role": "editor" }
```

---

## Trips

### GET /trips/workspace/:workspaceId
List all workspace trips.

### POST /trips
```json
{ "workspaceId": "...", "title": "Japan 2025", "startDate": "2025-04-01", "endDate": "2025-04-14", "type": "stedentrip" }
```

### GET /trips/:tripId
Trip details with days, expenses, bookings.

### PATCH /trips/:tripId
Update trip.

### DELETE /trips/:tripId
Soft-delete trip.

### GET /trips/public/:shareToken
Public read-only trip view (no auth required).

---

## Expenses

### GET /expenses/trip/:tripId
List trip expenses.

### POST /expenses
```json
{
  "tripId": "...",
  "description": "Dinner",
  "amount": 45.50,
  "currency": "EUR",
  "amountEur": 45.50,
  "paidBy": "Jan",
  "splitBetween": ["Jan", "Kees", "Lisa"],
  "category": "food"
}
```

### PATCH /expenses/:expenseId
Update expense.

### DELETE /expenses/:expenseId
Delete expense.

### GET /expenses/trip/:tripId/settlement
Returns settlement transactions (who owes whom).

---

## Stripe Webhooks

### POST /stripe/webhook
Stripe sends events here. Requires `stripe-signature` header.

Handled events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

---

## Admin (Platform Admin Only)

See [ADMIN-GUIDE.md](./ADMIN-GUIDE.md) for full admin API reference.

---

## Error Responses

```json
{ "error": "Error message", "message": "Detail", "requestId": "uuid" }
```

HTTP Status Codes:
- `200` – Success
- `201` – Created
- `400` – Bad Request
- `401` – Unauthorized
- `403` – Forbidden
- `404` – Not Found
- `409` – Conflict
- `422` – Validation Error
- `429` – Rate Limited
- `500` – Server Error
