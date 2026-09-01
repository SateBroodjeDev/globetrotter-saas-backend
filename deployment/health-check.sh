#!/bin/bash
# Globetrotter SaaS - System Health Check
# Usage: bash health-check.sh
# Returns exit 0 if healthy, exit 1 if any service is down

ERRORS=0
API_URL="${API_URL:-http://localhost:3000}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@globetrotter.nl}"

check() {
    local name="$1"
    local cmd="$2"
    if eval "$cmd" &>/dev/null; then
        echo "  ✅ ${name}: OK"
    else
        echo "  ❌ ${name}: FAILED"
        ERRORS=$((ERRORS + 1))
    fi
}

echo "=== Globetrotter Health Check [$(date)] ==="

# API
check "API /health endpoint" "curl -sf ${API_URL}/health"

# PostgreSQL
check "PostgreSQL" "pg_isready -U globetrotter -d globetrotter"

# Redis
check "Redis" "redis-cli ping | grep -q PONG"

# Nginx
check "Nginx" "systemctl is-active --quiet nginx"

# Disk space (warn if > 85%)
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "${DISK_USAGE}" -lt 85 ]; then
    echo "  ✅ Disk space: ${DISK_USAGE}% used"
else
    echo "  ⚠️  Disk space: ${DISK_USAGE}% used (high!)"
    ERRORS=$((ERRORS + 1))
fi

# Memory
FREE_MEM=$(free -m | awk 'NR==2{printf "%.0f", $7/$2*100}')
echo "  ℹ️  Free memory: ${FREE_MEM}%"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All systems operational"
    exit 0
else
    echo "❌ ${ERRORS} issue(s) detected"
    if command -v mail &>/dev/null && [ -n "${ALERT_EMAIL}" ]; then
        echo "Globetrotter health check failed: ${ERRORS} issue(s) at $(date)" | \
            mail -s "⚠️ Globetrotter Alert" "${ALERT_EMAIL}"
    fi
    exit 1
fi
