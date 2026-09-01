# Ubuntu 22.04 VPS – Complete Setup Guide

## Vereisten
- Ubuntu 22.04 VPS (minimaal 2 GB RAM, 20 GB opslag)
- Root of sudo toegang
- Domein `globetrotter.nl` met DNS A-records die naar het VPS-IP wijzen

## DNS Records instellen
Voeg toe in je DNS-beheer:

| Type | Naam | Waarde |
|------|------|--------|
| A | api | `<jouw VPS IP>` |
| A | app | `<jouw VPS IP>` |
| A | admin | `<jouw VPS IP>` |
| A | * | `<jouw VPS IP>` |

Wacht 5-30 minuten op DNS-propagatie.

## Stap 1: Verbinding maken met de VPS

```bash
ssh root@<jouw-vps-ip>
```

## Stap 2: Automatische Setup

```bash
# Download het deployment script
curl -fsSL https://raw.githubusercontent.com/SateBroodjeDev/globetrotter-saas-backend/main/scripts/deploy-ubuntu.sh -o deploy.sh

# Stel omgevingsvariabelen in (optioneel)
export DOMAIN=globetrotter.nl
export LETSENCRYPT_EMAIL=jouw@email.nl
export REPO_URL=https://github.com/SateBroodjeDev/globetrotter-saas-backend.git

# Voer uit als root
bash deploy.sh
```

Het script installeert automatisch:
- Docker + Docker Compose
- Nginx (reverse proxy)
- Certbot (SSL)
- UFW firewall
- Fail2ban
- Automatische backups (cron)
- Systemd service (auto-start)

## Stap 3: Configureer .env

Na de eerste run stopt het script en vraagt om de `.env` te configureren:

```bash
nano /srv/globetrotter/.env
```

Vereiste waardes:
- `JWT_SECRET` – genereer met `openssl rand -base64 64`
- `REFRESH_TOKEN_SECRET` – genereer met `openssl rand -base64 64`
- `POSTGRES_PASSWORD` – sterk wachtwoord
- `SENDGRID_API_KEY` – voor e-mail (optioneel)
- `STRIPE_SECRET_KEY` – voor betalingen (optioneel)

## Stap 4: Voltooi deployment

```bash
bash deploy.sh --update
```

## Stap 5: Controleer de status

```bash
# Containers bekijken
cd /srv/globetrotter
docker-compose -f docker-compose.prod.yml ps

# API logs
docker-compose -f docker-compose.prod.yml logs -f api

# Nginx status
systemctl status nginx

# SSL certificaten
certbot certificates
```

## Handmatig Beheer

### Containers herstarten
```bash
cd /srv/globetrotter
docker-compose -f docker-compose.prod.yml restart api
```

### Database backup
```bash
docker exec globetrotter_db pg_dump -U postgres globetrotter_prod | gzip > /srv/backups/manual-$(date +%Y%m%d).sql.gz
```

### Database restore
```bash
gunzip -c /srv/backups/db-20240101.sql.gz | docker exec -i globetrotter_db psql -U postgres globetrotter_prod
```

### SSL vernieuwen (automatisch via certbot cron)
```bash
certbot renew --dry-run
```

## Poorten & Firewall

| Poort | Service | Toegankelijk |
|-------|---------|--------------|
| 22 | SSH | Ja (extern) |
| 80 | HTTP | Ja (redirect naar HTTPS) |
| 443 | HTTPS | Ja (extern) |
| 3000 | API | Nee (alleen via Nginx) |
| 5432 | PostgreSQL | Nee (alleen intern) |
| 6379 | Redis | Nee (alleen intern) |

## Monitoring

```bash
# Systeem resources
htop

# Docker stats
docker stats

# Nginx access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log
docker-compose -f /srv/globetrotter/docker-compose.prod.yml logs --tail=100 api
```

## Automatische Backups

De backup cron draait dagelijks om 03:00:
```
0 3 * * * docker exec globetrotter_db pg_dump ... | gzip > /srv/backups/db-YYYYMMDD.sql.gz
```

Houd maximaal 30 dagen aan backups:
```bash
find /srv/backups -name "*.sql.gz" -mtime +30 -delete
```
