#!/bin/bash

# Globetrotter SaaS Backend - Production Deployment Script

set -e

echo "[🚀] Starting Globetrotter SaaS deployment..."

# Load environment
export $(cat .env | xargs)

echo "[📦] Installing dependencies..."
npm ci --only=production

echo "[🔧] Running database migrations..."
node scripts/migrate.js

echo "[🌱] Seeding database with initial data..."
node scripts/seed.js

echo "[✅] Deployment complete!"
echo "[🌐] API available at: $API_URL"
echo "[🎯] Frontend: $FRONTEND_URL"

npm start
