#!/usr/bin/env bash
# Start all services for local development:
#   pairing-api  (port 8000)
#   td-api       (port 8001)
#   web          (port 5173)
#
# Usage: ./dev.sh
# Stop:  Ctrl-C (kills all services)

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS=()

cleanup() {
  echo ""
  echo "Shutting down all services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo "All services stopped."
}

trap cleanup EXIT INT TERM

# Colors for log prefixes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "Starting all services..."
echo ""

# 1. pairing-api (FastAPI on port 8000)
echo -e "${RED}[pairing-api]${NC} Starting on port 8000..."
(cd "$ROOT_DIR/pairing-api" && uv run uvicorn pairing_api.main:app --reload --port 8000 2>&1 | sed "s/^/$(printf "${RED}[pairing-api]${NC} ")/") &
PIDS+=($!)

# 2. td-api (Express on port 8001)
echo -e "${GREEN}[td-api]${NC}     Starting on port 8001..."
(cd "$ROOT_DIR/td-api" && npm run dev 2>&1 | sed "s/^/$(printf "${GREEN}[td-api]${NC}     ")/") &
PIDS+=($!)

# 3. web (Vite on port 5173)
echo -e "${BLUE}[web]${NC}        Starting on port 5173..."
(cd "$ROOT_DIR/web" && VITE_API_URL=http://localhost:8001/api npm run dev 2>&1 | sed "s/^/$(printf "${BLUE}[web]${NC}        ")/") &
PIDS+=($!)

echo ""
echo "Services:"
echo "  pairing-api  → http://localhost:8000/docs"
echo "  td-api       → http://localhost:8001/api"
echo "  web          → http://localhost:5173"
echo ""
echo "Press Ctrl-C to stop all services."

wait
