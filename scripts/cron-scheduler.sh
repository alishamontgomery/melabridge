#!/usr/bin/env bash
# Background scheduler — processes scheduled guest messages and reliability
# checks every 5 minutes. Reliability checks are non-destructive.
# Reads CRON_SECRET from the environment.
# Waits for the app to become available before starting the loop.

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:5000}"
ENDPOINT="${APP_URL}/api/cron/process-scheduled-messages"
MONITOR_INTERVAL="${RELIABILITY_MONITOR_INTERVAL_SECONDS:-900}"
MONITOR_ELAPSED=0
INTERVAL="${CRON_INTERVAL_SECONDS:-300}"  # 5 minutes default

echo "[cron-scheduler] Starting. Interval: ${INTERVAL}s. Endpoint: ${ENDPOINT}"

# ── Wait for the app to be ready ────────────────────────────────────────────
MAX_WAIT=120  # seconds
WAITED=0
until curl -sf "${APP_URL}/" -o /dev/null 2>/dev/null; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "[cron-scheduler] App not ready after ${MAX_WAIT}s — will try endpoint anyway."
    break
  fi
  echo "[cron-scheduler] Waiting for app… (${WAITED}s elapsed)"
  sleep 5
  WAITED=$((WAITED + 5))
done

echo "[cron-scheduler] App ready. Entering loop."

while true; do
  sleep "${INTERVAL}"

  if [ -z "${CRON_SECRET:-}" ]; then
    echo "[cron-scheduler] CRON_SECRET not set — skipping run."
    continue
  fi

  TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  echo "[cron-scheduler] ${TIMESTAMP} — calling ${ENDPOINT}"

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    "${ENDPOINT}" 2>&1) || true

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  echo "[cron-scheduler] HTTP ${HTTP_CODE}: ${BODY}"

  MONITOR_ELAPSED=$((MONITOR_ELAPSED + INTERVAL))
  if [ "$MONITOR_ELAPSED" -ge "$MONITOR_INTERVAL" ]; then
    echo "[cron-scheduler] ${TIMESTAMP} — running non-destructive reliability monitor"
    APP_URL="$APP_URL" CRON_SECRET="$CRON_SECRET" node scripts/reliability-synthetic.mjs || true
    MONITOR_ELAPSED=0
  fi
done
