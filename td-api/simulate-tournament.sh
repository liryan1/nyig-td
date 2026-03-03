#!/bin/bash

# Live Tournament Simulation Script
# Simulates a full tournament with native divisions:
#   - Open Division (Dan players)
#   - Kyu Division (Kyu players)
# One tournament with crossDivisionPairing=false, divisions paired separately.

set -e

BASE_URL="http://localhost:8001/api"
CURL_OPTS="-s"
DELAY=2  # seconds between actions to simulate "live" feel

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Track created resources for cleanup
declare -a PLAYER_IDS
TOURNAMENT_ID=""

# ── Helpers ──────────────────────────────────────────────────────────────────

print_banner() {
    echo ""
    echo -e "${MAGENTA}${BOLD}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}${BOLD}║                                                                   ║${NC}"
    echo -e "${MAGENTA}${BOLD}║       🏆  NYIG SPRING OPEN 2026 — LIVE TOURNAMENT SIMULATION  🏆  ║${NC}"
    echo -e "${MAGENTA}${BOLD}║                                                                   ║${NC}"
    echo -e "${MAGENTA}${BOLD}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_header() {
    echo ""
    echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
}

print_division() {
    echo ""
    echo -e "${CYAN}${BOLD}  ┌─────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}${BOLD}  │  $1${NC}"
    echo -e "${CYAN}${BOLD}  └─────────────────────────────────────────┘${NC}"
}

print_section() {
    echo -e "  ${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "  ${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "  ${RED}✗ $1${NC}"
}

print_info() {
    echo -e "  ${DIM}  $1${NC}"
}

print_result() {
    echo -e "  ${BOLD}  Board $1: $2 ${NC}${DIM}($3)${NC}"
}

print_standing() {
    echo -e "    ${BOLD}$1.${NC} $2 ${DIM}($3)${NC} — ${GREEN}$4W${NC}/${RED}$5L${NC}  score: $6"
}

live_pause() {
    sleep "$DELAY"
}

api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    if [ -n "$data" ]; then
        curl $CURL_OPTS -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl $CURL_OPTS -X "$method" "$BASE_URL$endpoint"
    fi
}

# Random result generator — weighted toward decisive results
random_result() {
    local r=$((RANDOM % 100))
    if [ $r -lt 45 ]; then
        echo "B+"
    elif [ $r -lt 90 ]; then
        echo "W+"
    elif [ $r -lt 95 ]; then
        echo "B+F"
    elif [ $r -lt 98 ]; then
        echo "W+F"
    else
        echo "Draw"
    fi
}

result_description() {
    case "$1" in
        "B+")   echo "Black wins" ;;
        "W+")   echo "White wins" ;;
        "B+F")  echo "Black wins by forfeit" ;;
        "W+F")  echo "White wins by forfeit" ;;
        "Draw") echo "Draw" ;;
        *)      echo "Unknown" ;;
    esac
}

cleanup() {
    echo ""
    print_header "CLEANUP — Removing simulation data"

    if [ -n "$TOURNAMENT_ID" ]; then
        print_section "Deleting tournament"
        curl $CURL_OPTS -X DELETE "$BASE_URL/tournaments/$TOURNAMENT_ID" > /dev/null 2>&1 || true
        print_success "Tournament deleted"
    fi

    for pid in "${PLAYER_IDS[@]}"; do
        curl $CURL_OPTS -X DELETE "$BASE_URL/players/$pid" > /dev/null 2>&1 || true
    done
    print_success "All ${#PLAYER_IDS[@]} players deleted"

    echo ""
    echo -e "${DIM}Simulation data cleaned up. Goodbye!${NC}"
    echo ""
}

trap cleanup EXIT

# ── Health Check ─────────────────────────────────────────────────────────────

print_banner

print_section "Checking API health..."
health=$(curl $CURL_OPTS "http://localhost:8001/health" 2>&1) || {
    print_error "API is not running at http://localhost:8001"
    print_info "Start the dev server first: cd td-api && npm run dev"
    exit 1
}
print_success "API is healthy"
live_pause

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1: PLAYER REGISTRATION
# ══════════════════════════════════════════════════════════════════════════════

print_header "PHASE 1: PLAYER CHECK-IN"

# ── Open Division players (Dan level) ────────────────────────────────────────
print_division "OPEN DIVISION — Dan Players"

declare -a OPEN_PLAYERS
declare -a KYU_PLAYERS

create_player() {
    local name="$1" rank="$2" club="$3" extra="$4"
    local data="{\"name\": \"$name\", \"rank\": \"$rank\", \"club\": \"$club\""
    if [ -n "$extra" ]; then
        data="$data, $extra"
    fi
    data="$data}"
    local response
    response=$(api_call POST "/players" "$data")
    local id
    id=$(echo "$response" | jq -r '.player.id')
    PLAYER_IDS+=("$id")
    echo "$id"
}

print_section "Players checking in..."
live_pause

id=$(create_player "Takeshi Yamamoto" "4d" "Manhattan Go Club" '"rating": 2400')
OPEN_PLAYERS+=("$id")
print_success "Takeshi Yamamoto (4d) checked in"

id=$(create_player "Wei Chen" "3d" "Brooklyn Go Society" '"agaId": "20001"')
OPEN_PLAYERS+=("$id")
print_success "Wei Chen (3d) checked in"

id=$(create_player "Sarah Kim" "2d" "NYC Go Club" '"rating": 2200')
OPEN_PLAYERS+=("$id")
print_success "Sarah Kim (2d) checked in"

id=$(create_player "James Park" "3d" "Queens Go Association")
OPEN_PLAYERS+=("$id")
print_success "James Park (3d) checked in"

id=$(create_player "Mei Lin" "1d" "Manhattan Go Club" '"rating": 2050')
OPEN_PLAYERS+=("$id")
print_success "Mei Lin (1d) checked in"

id=$(create_player "David Cho" "2d" "Brooklyn Go Society" '"agaId": "20045"')
OPEN_PLAYERS+=("$id")
print_success "David Cho (2d) checked in"

live_pause

# ── Kyu Division players ─────────────────────────────────────────────────────
print_division "KYU DIVISION — Kyu Players"

print_section "Players checking in..."
live_pause

id=$(create_player "Alex Rivera" "1k" "NYC Go Club" '"rating": 1900')
KYU_PLAYERS+=("$id")
print_success "Alex Rivera (1k) checked in"

id=$(create_player "Emma Thompson" "3k" "Brooklyn Go Society")
KYU_PLAYERS+=("$id")
print_success "Emma Thompson (3k) checked in"

id=$(create_player "Ryan Patel" "5k" "Queens Go Association" '"rating": 1500')
KYU_PLAYERS+=("$id")
print_success "Ryan Patel (5k) checked in"

id=$(create_player "Lisa Chang" "2k" "Manhattan Go Club")
KYU_PLAYERS+=("$id")
print_success "Lisa Chang (2k) checked in"

id=$(create_player "Tom Wilson" "4k" "NYC Go Club" '"rating": 1600')
KYU_PLAYERS+=("$id")
print_success "Tom Wilson (4k) checked in"

id=$(create_player "Yuki Tanaka" "6k" "Brooklyn Go Society")
KYU_PLAYERS+=("$id")
print_success "Yuki Tanaka (6k) checked in"

id=$(create_player "Carlos Gomez" "3k" "Queens Go Association" '"rating": 1700')
KYU_PLAYERS+=("$id")
print_success "Carlos Gomez (3k) checked in"

id=$(create_player "Nina Volkov" "7k" "Manhattan Go Club")
KYU_PLAYERS+=("$id")
print_success "Nina Volkov (7k) checked in"

live_pause

echo ""
echo -e "  ${BOLD}Total players: ${#OPEN_PLAYERS[@]} Open + ${#KYU_PLAYERS[@]} Kyu = $((${#OPEN_PLAYERS[@]} + ${#KYU_PLAYERS[@]})) players${NC}"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: TOURNAMENT SETUP (single tournament with divisions)
# ══════════════════════════════════════════════════════════════════════════════

print_header "PHASE 2: TOURNAMENT SETUP"

NUM_ROUNDS=3

# ── Create single tournament with crossDivisionPairing=false ─────────────────
print_section "Creating tournament with native divisions..."
response=$(api_call POST "/tournaments" "{
    \"name\": \"NYIG Spring Open 2026\",
    \"description\": \"Open and Kyu divisions. Swiss pairing, ${NUM_ROUNDS} rounds. Divisions paired separately.\",
    \"date\": \"2026-04-15T09:00:00Z\",
    \"location\": \"NYC Community Center\",
    \"settings\": {
        \"numRounds\": ${NUM_ROUNDS},
        \"pairingAlgorithm\": \"swiss\",
        \"handicapEnabled\": true,
        \"handicapReduction\": 1,
        \"standingsWeights\": {
            \"wins\": 1.0,
            \"sos\": 0.1,
            \"sodos\": 0.05,
            \"extendedSos\": 0.0
        },
        \"crossDivisionPairing\": false
    }
}")
TOURNAMENT_ID=$(echo "$response" | jq -r '.tournament.id')
print_success "Tournament created (ID: $TOURNAMENT_ID)"

live_pause

# ── Add divisions ────────────────────────────────────────────────────────────
print_section "Adding divisions..."

response=$(api_call POST "/tournaments/$TOURNAMENT_ID/divisions" \
    '{"name": "Open Division", "description": "Dan-level players"}')
OPEN_DIV_ID=$(echo "$response" | jq -r '.division.id')
print_success "Open Division created (ID: $OPEN_DIV_ID)"

response=$(api_call POST "/tournaments/$TOURNAMENT_ID/divisions" \
    '{"name": "Kyu Division", "description": "Kyu-level players"}')
KYU_DIV_ID=$(echo "$response" | jq -r '.division.id')
print_success "Kyu Division created (ID: $KYU_DIV_ID)"

live_pause

# ── Move to registration ─────────────────────────────────────────────────────
print_section "Opening registration..."
api_call PATCH "/tournaments/$TOURNAMENT_ID" '{"status": "registration"}' > /dev/null
print_success "Registration is open"

live_pause

# ── Register players with their divisions ─────────────────────────────────────
print_section "Registering Open Division players..."
rounds_json=$(printf '%s' "[$(seq -s',' 1 $NUM_ROUNDS)]")
for pid in "${OPEN_PLAYERS[@]}"; do
    api_call POST "/tournaments/$TOURNAMENT_ID/registrations" \
        "{\"playerId\": \"$pid\", \"divisionId\": \"$OPEN_DIV_ID\", \"roundsParticipating\": $rounds_json}" > /dev/null
done
print_success "${#OPEN_PLAYERS[@]} players registered for Open Division"

print_section "Registering Kyu Division players..."
for pid in "${KYU_PLAYERS[@]}"; do
    api_call POST "/tournaments/$TOURNAMENT_ID/registrations" \
        "{\"playerId\": \"$pid\", \"divisionId\": \"$KYU_DIV_ID\", \"roundsParticipating\": $rounds_json}" > /dev/null
done
print_success "${#KYU_PLAYERS[@]} players registered for Kyu Division"

live_pause

# ── Start tournament ─────────────────────────────────────────────────────────
print_section "Starting tournament..."
api_call PATCH "/tournaments/$TOURNAMENT_ID" '{"status": "in_progress"}' > /dev/null
print_success "Tournament is now IN PROGRESS"

live_pause

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: ROUNDS
# ══════════════════════════════════════════════════════════════════════════════

run_round() {
    local round_num="$1"

    print_header "ROUND $round_num OF $NUM_ROUNDS"

    echo -e "\n${DIM}  Clocks start... Round $round_num is underway.${NC}"
    live_pause

    # Generate pairings (per-division since crossDivisionPairing=false)
    print_section "Generating pairings (per-division)..."
    live_pause
    local pairings_response
    pairings_response=$(api_call POST "/tournaments/$TOURNAMENT_ID/rounds/$round_num/pair")

    # Extract pairings info
    local num_pairings
    num_pairings=$(echo "$pairings_response" | jq '.round.pairings | length')
    local num_byes
    num_byes=$(echo "$pairings_response" | jq '.round.byes | length')

    print_success "Pairings generated: $num_pairings boards ($num_byes byes)"
    if [ "$num_byes" -gt 0 ]; then
        print_info "Bye: $num_byes player(s) receive a bye"
    fi

    # Show pairings
    echo ""
    echo -e "  ${BOLD}  Pairings:${NC}"
    for ((b = 0; b < num_pairings; b++)); do
        local board=$((b + 1))
        local black_id white_id handicap komi
        black_id=$(echo "$pairings_response" | jq -r ".round.pairings[$b].blackPlayerId")
        white_id=$(echo "$pairings_response" | jq -r ".round.pairings[$b].whitePlayerId")
        handicap=$(echo "$pairings_response" | jq -r ".round.pairings[$b].handicapStones")
        komi=$(echo "$pairings_response" | jq -r ".round.pairings[$b].komi")
        board=$(echo "$pairings_response" | jq -r ".round.pairings[$b].boardNumber")

        # Look up player names
        local black_name white_name
        black_name=$(curl $CURL_OPTS "$BASE_URL/players/$black_id" | jq -r '.player.name + " (" + .player.rank + ")"')
        white_name=$(curl $CURL_OPTS "$BASE_URL/players/$white_id" | jq -r '.player.name + " (" + .player.rank + ")"')

        local handi_str=""
        if [ "$handicap" != "0" ] && [ "$handicap" != "null" ]; then
            handi_str=" H${handicap}"
        fi
        echo -e "    ${DIM}Board $board:${NC} ${BOLD}⚫ $black_name${NC}  vs  ${BOLD}⚪ $white_name${NC}${DIM}  K${komi}${handi_str}${NC}"
    done
    echo ""

    # Simulate games being played
    print_section "Games in progress..."
    live_pause
    live_pause

    # Record results
    print_section "Recording results..."
    for ((b = 0; b < num_pairings; b++)); do
        local board
        board=$(echo "$pairings_response" | jq -r ".round.pairings[$b].boardNumber")
        local result
        result=$(random_result)
        local desc
        desc=$(result_description "$result")

        api_call PATCH "/tournaments/$TOURNAMENT_ID/rounds/$round_num/boards/$board" \
            "{\"result\": \"$result\"}" > /dev/null

        local black_id white_id
        black_id=$(echo "$pairings_response" | jq -r ".round.pairings[$b].blackPlayerId")
        white_id=$(echo "$pairings_response" | jq -r ".round.pairings[$b].whitePlayerId")
        local black_name white_name
        black_name=$(curl $CURL_OPTS "$BASE_URL/players/$black_id" | jq -r '.player.name')
        white_name=$(curl $CURL_OPTS "$BASE_URL/players/$white_id" | jq -r '.player.name')

        local winner_name=""
        case "$result" in
            B+|B+F) winner_name="$black_name" ;;
            W+|W+F) winner_name="$white_name" ;;
            Draw)   winner_name="Draw" ;;
        esac

        print_result "$board" "$desc" "$winner_name"
        live_pause
    done

    # Show standings per division
    echo ""
    print_division "OPEN DIVISION — Standings after Round $round_num"
    local standings
    standings=$(api_call GET "/tournaments/$TOURNAMENT_ID/divisions/$OPEN_DIV_ID/standings?throughRound=$round_num")
    local num_standings
    num_standings=$(echo "$standings" | jq '.standings | length')
    for ((s = 0; s < num_standings; s++)); do
        local p_name p_rank_go wins losses score
        p_name=$(echo "$standings" | jq -r ".standings[$s].playerName")
        p_rank_go=$(echo "$standings" | jq -r ".standings[$s].playerRank")
        wins=$(echo "$standings" | jq -r ".standings[$s].wins")
        losses=$(echo "$standings" | jq -r ".standings[$s].losses")
        score=$(echo "$standings" | jq -r ".standings[$s].totalScore")
        print_standing "$((s + 1))" "$p_name" "$p_rank_go" "$wins" "$losses" "$score"
    done

    print_division "KYU DIVISION — Standings after Round $round_num"
    standings=$(api_call GET "/tournaments/$TOURNAMENT_ID/divisions/$KYU_DIV_ID/standings?throughRound=$round_num")
    num_standings=$(echo "$standings" | jq '.standings | length')
    for ((s = 0; s < num_standings; s++)); do
        local p_name p_rank_go wins losses score
        p_name=$(echo "$standings" | jq -r ".standings[$s].playerName")
        p_rank_go=$(echo "$standings" | jq -r ".standings[$s].playerRank")
        wins=$(echo "$standings" | jq -r ".standings[$s].wins")
        losses=$(echo "$standings" | jq -r ".standings[$s].losses")
        score=$(echo "$standings" | jq -r ".standings[$s].totalScore")
        print_standing "$((s + 1))" "$p_name" "$p_rank_go" "$wins" "$losses" "$score"
    done
    echo ""
}

for round in $(seq 1 $NUM_ROUNDS); do
    run_round "$round"
done

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4: FINAL RESULTS
# ══════════════════════════════════════════════════════════════════════════════

print_header "FINAL RESULTS"

# Mark tournament as completed
api_call PATCH "/tournaments/$TOURNAMENT_ID" '{"status": "completed"}' > /dev/null

# ── Open Division Final Standings ─────────────────────────────────────────────
print_division "OPEN DIVISION — Final Standings"
standings=$(api_call GET "/tournaments/$TOURNAMENT_ID/divisions/$OPEN_DIV_ID/standings")
num_standings=$(echo "$standings" | jq '.standings | length')
for ((s = 0; s < num_standings; s++)); do
    p_rank=$((s + 1))
    p_name=$(echo "$standings" | jq -r ".standings[$s].playerName")
    p_rank_go=$(echo "$standings" | jq -r ".standings[$s].playerRank")
    wins=$(echo "$standings" | jq -r ".standings[$s].wins")
    losses=$(echo "$standings" | jq -r ".standings[$s].losses")
    score=$(echo "$standings" | jq -r ".standings[$s].totalScore")
    sos=$(echo "$standings" | jq -r ".standings[$s].sos")
    sodos=$(echo "$standings" | jq -r ".standings[$s].sodos")

    medal=""
    if [ $p_rank -eq 1 ]; then medal="  🥇"; fi
    if [ $p_rank -eq 2 ]; then medal="  🥈"; fi
    if [ $p_rank -eq 3 ]; then medal="  🥉"; fi

    echo -e "    ${BOLD}$p_rank.${NC} $p_name ${DIM}($p_rank_go)${NC} — ${GREEN}${wins}W${NC}/${RED}${losses}L${NC}  score: $score  ${DIM}SOS: $sos  SODOS: $sodos${NC}${medal:-}"
done

# ── Kyu Division Final Standings ──────────────────────────────────────────────
print_division "KYU DIVISION — Final Standings"
standings=$(api_call GET "/tournaments/$TOURNAMENT_ID/divisions/$KYU_DIV_ID/standings")
num_standings=$(echo "$standings" | jq '.standings | length')
for ((s = 0; s < num_standings; s++)); do
    p_rank=$((s + 1))
    p_name=$(echo "$standings" | jq -r ".standings[$s].playerName")
    p_rank_go=$(echo "$standings" | jq -r ".standings[$s].playerRank")
    wins=$(echo "$standings" | jq -r ".standings[$s].wins")
    losses=$(echo "$standings" | jq -r ".standings[$s].losses")
    score=$(echo "$standings" | jq -r ".standings[$s].totalScore")
    sos=$(echo "$standings" | jq -r ".standings[$s].sos")
    sodos=$(echo "$standings" | jq -r ".standings[$s].sodos")

    medal=""
    if [ $p_rank -eq 1 ]; then medal="  🥇"; fi
    if [ $p_rank -eq 2 ]; then medal="  🥈"; fi
    if [ $p_rank -eq 3 ]; then medal="  🥉"; fi

    echo -e "    ${BOLD}$p_rank.${NC} $p_name ${DIM}($p_rank_go)${NC} — ${GREEN}${wins}W${NC}/${RED}${losses}L${NC}  score: $score  ${DIM}SOS: $sos  SODOS: $sodos${NC}${medal:-}"
done

echo ""
echo -e "${MAGENTA}${BOLD}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}${BOLD}║                                                                   ║${NC}"
echo -e "${MAGENTA}${BOLD}║            Tournament complete! Thanks for playing.                ║${NC}"
echo -e "${MAGENTA}${BOLD}║                                                                   ║${NC}"
echo -e "${MAGENTA}${BOLD}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
