#!/bin/bash
# Globetrotter SaaS - PostgreSQL Backup Script
# Schedule: 0 2 * * * /usr/local/bin/globetrotter-backup.sh

set -e

BACKUP_DIR="/var/www/globetrotter/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_USER="${POSTGRES_USER:-globetrotter}"
DB_NAME="${POSTGRES_DB:-globetrotter}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup..."

# PostgreSQL dump
pg_dump -U "${DB_USER}" "${DB_NAME}" > "${BACKUP_DIR}/db_${DATE}.sql"
gzip "${BACKUP_DIR}/db_${DATE}.sql"

echo "[$(date)] Backup created: db_${DATE}.sql.gz"

# Upload to S3 if configured
if [ -n "${S3_BUCKET}" ] && command -v aws &> /dev/null; then
    aws s3 cp "${BACKUP_DIR}/db_${DATE}.sql.gz" "s3://${S3_BUCKET}/backups/db_${DATE}.sql.gz"
    echo "[$(date)] Backup uploaded to S3: s3://${S3_BUCKET}/backups/"
fi

# Remove old backups
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime "+${KEEP_DAYS}" -delete
echo "[$(date)] Old backups cleaned (older than ${KEEP_DAYS} days)"

echo "[$(date)] Backup complete ✅"
