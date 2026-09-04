#!/bin/bash
cd "$(dirname "$0")/src/server"

# Load .env.local if present (DATA_SYNC_URL, WORKER_API_TOKEN, etc.)
if [ -f "$(dirname "$0")/.env.local" ]; then
  set -a
  source "$(dirname "$0")/.env.local"
  set +a
  echo "[env] Loaded .env.local"
fi

PORT=8787 node start.js
