#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Tool check ──────────────────────────────────────────────────────────────

missing=()
if ! command -v uv &>/dev/null; then missing+=("uv"); fi
if ! command -v npm &>/dev/null; then missing+=("npm"); fi

if [ ${#missing[@]} -gt 0 ]; then
    echo -e "${RED}${BOLD}Missing required tools:${NC}"
    for tool in "${missing[@]}"; do
        case "$tool" in
            uv)  echo -e "  ${RED}✗${NC} uv  — install: ${BLUE}https://docs.astral.sh/uv/getting-started/installation/${NC}" ;;
            npm) echo -e "  ${RED}✗${NC} npm — install Node.js: ${BLUE}https://nodejs.org/${NC}" ;;
        esac
    done
    exit 1
fi

echo -e "${GREEN}${BOLD}All required tools found${NC}"
echo -e "  uv  $(uv --version 2>/dev/null)"
echo -e "  npm $(npm --version 2>/dev/null)"
echo ""

# ── Setup packages in parallel ──────────────────────────────────────────────

LOG_DIR=$(mktemp -d)
PACKAGES="lib pairing-api td-api web"

# PIDs and results stored in plain files (bash 3 compatible)
echo -e "${BOLD}Setting up packages...${NC}"
echo ""

# lib
(cd "$ROOT_DIR/lib" && uv sync) > "$LOG_DIR/lib.log" 2>&1 &
pid_lib=$!
echo -e "  ${BLUE}⟳${NC} lib"

# pairing-api
(cd "$ROOT_DIR/pairing-api" && uv sync) > "$LOG_DIR/pairing-api.log" 2>&1 &
pid_pairing_api=$!
echo -e "  ${BLUE}⟳${NC} pairing-api"

# td-api
(cd "$ROOT_DIR/td-api" && npm install) > "$LOG_DIR/td-api.log" 2>&1 &
pid_td_api=$!
echo -e "  ${BLUE}⟳${NC} td-api"

# web
(cd "$ROOT_DIR/web" && npm install) > "$LOG_DIR/web.log" 2>&1 &
pid_web=$!
echo -e "  ${BLUE}⟳${NC} web"

echo ""

# Wait for each and record exit codes
result_lib=0;          wait $pid_lib          || result_lib=$?
result_pairing_api=0;  wait $pid_pairing_api  || result_pairing_api=$?
result_td_api=0;       wait $pid_td_api       || result_td_api=$?
result_web=0;          wait $pid_web          || result_web=$?

# ── Summary ─────────────────────────────────────────────────────────────────

echo -e "${BOLD}Setup Summary${NC}"
echo -e "─────────────────────────────────"

has_failure=false
has_warning=false

for pkg in $PACKAGES; do
    log="$LOG_DIR/$pkg.log"
    result_var="result_${pkg//-/_}"
    result=${!result_var}

    if [ "$result" -eq 0 ]; then
        if grep -qiE 'warn|deprecated' "$log" 2>/dev/null; then
            echo -e "  ${YELLOW}⚠${NC}  $pkg  ${YELLOW}(warnings)${NC}"
            has_warning=true
        else
            echo -e "  ${GREEN}✓${NC}  $pkg"
        fi
    else
        echo -e "  ${RED}✗${NC}  $pkg  ${RED}FAILED${NC}"
        has_failure=true
    fi
done

echo ""

# Print warnings
if $has_warning; then
    for pkg in $PACKAGES; do
        log="$LOG_DIR/$pkg.log"
        result_var="result_${pkg//-/_}"
        result=${!result_var}
        if [ "$result" -eq 0 ]; then
            warnings=$(grep -iE 'warn|deprecated' "$log" 2>/dev/null || true)
            if [ -n "$warnings" ]; then
                echo -e "${YELLOW}${BOLD}Warnings from $pkg:${NC}"
                echo "$warnings" | head -20
                echo ""
            fi
        fi
    done
fi

# Print failure logs
if $has_failure; then
    for pkg in $PACKAGES; do
        result_var="result_${pkg//-/_}"
        result=${!result_var}
        if [ "$result" -ne 0 ]; then
            echo -e "${RED}${BOLD}Failure log for $pkg:${NC}"
            tail -30 "$LOG_DIR/$pkg.log"
            echo ""
        fi
    done
    echo -e "${RED}${BOLD}Setup failed.${NC} See errors above."
    rm -rf "$LOG_DIR"
    exit 1
fi

rm -rf "$LOG_DIR"
echo -e "${GREEN}${BOLD}Setup complete!${NC} Run ${BLUE}./dev.sh${NC} to start all services."
