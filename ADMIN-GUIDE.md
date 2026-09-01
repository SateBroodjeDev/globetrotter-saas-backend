# Admin Panel Guide – Globetrotter SaaS

## Toegang

URL: `https://admin.globetrotter.nl`

Gebruik een account met `isAdmin = true` in de database.

### Admin-account aanmaken via database

```sql
UPDATE "Users" SET "isAdmin" = true WHERE email = 'jouw@email.nl';
```

Of via Docker:
```bash
docker exec -it globetrotter_db psql -U postgres globetrotter_prod \
  -c "UPDATE \"Users\" SET \"isAdmin\" = true WHERE email = 'jouw@email.nl';"
```

---

## Functies

### Dashboard
- Platform statistieken: totaal gebruikers, workspaces, reizen, uitgaven
- User growth grafiek (lijn)
- Subscription breakdown (donut)

### Gebruikersbeheer
- Zoeken op naam of e-mail
- Paginatie (20 per pagina)
- **Bannen**: blokkeert inloggen (`isActive = false`)
- **Unbannen**: herstelt toegang
- **Wachtwoord reset**: stuurt resetlink per e-mail
- **Verwijderen**: soft-delete (data blijft in DB)

### Workspace overzicht
- Alle workspaces met plan, eigenaar, aanmaakdatum
- Plan badge: free (grijs) / starter (blauw) / pro (groen) / business (paars)

### Analytics
- MRR-schatting op basis van actieve abonnementen
- User growth per dag/week/maand
- Subscription breakdown

### Audit Logs
- Alle admin-acties worden gelogd
- Auto-refresh elke 30 seconden
- Exporteerbaar via CSV (browser)

### Systeemstatus
- Database connectie status
- API health endpoint
- Tijdstempel laatste check

---

## API Endpoints (Admin)

Alle admin-routes vereisen een ****** van een admin-gebruiker.

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| GET | `/api/admin/stats` | Platform statistieken |
| GET | `/api/admin/analytics/user-growth?days=30` | User growth |
| GET | `/api/admin/analytics/subscriptions` | Subscription breakdown |
| GET | `/api/admin/health` | Systeem gezondheid |
| GET | `/api/admin/users?search=&page=&limit=` | Gebruikerslijst |
| GET | `/api/admin/users/:id` | Gebruiker details |
| PATCH | `/api/admin/users/:id/ban` | Gebruiker bannen |
| PATCH | `/api/admin/users/:id/unban` | Gebruiker unbannen |
| POST | `/api/admin/users/:id/reset-password` | Reset e-mail sturen |
| DELETE | `/api/admin/users/:id` | Gebruiker verwijderen |
| GET | `/api/admin/workspaces?page=&limit=` | Workspacelijst |
| GET | `/api/admin/audit-logs?page=&limit=` | Audit logs |

---

## Beveiliging

- Alleen gebruikers met `isAdmin = true` hebben toegang
- Alle admin-acties worden gelogd in audit logs
- Aanbevolen: IP-whitelist in Nginx voor extra beveiliging

```nginx
# In nginx.conf, admin server block:
allow 1.2.3.4;  # Jouw IP
deny all;
```
