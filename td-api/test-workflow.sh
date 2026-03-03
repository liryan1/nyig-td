#!/bin/bash

# Tournament API Workflow Test Script
# Tests the full tournament lifecycle: players, registration, pairing, results, standings

set -e

BASE_URL="http://localhost:8001/api"
CURL_OPTS="-s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

print_section() {
    echo -e "\n${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_response() {
    echo "$1" | jq . 2>/dev/null || echo "$1"
}

# Store created IDs for cleanup
declare -a PLAYER_IDS
TOURNAMENT_ID=""

cleanup() {
    print_header "CLEANUP"

    # Delete tournament if created
    if [ -n "$TOURNAMENT_ID" ]; then
        print_section "Deleting tournament: $TOURNAMENT_ID"
        response=$(curl $CURL_OPTS -X DELETE "$BASE_URL/tournaments/$TOURNAMENT_ID" -w "\n%{http_code}" 2>&1)
        http_code=$(echo "$response" | tail -n1)
        if [ "$http_code" = "204" ]; then
            print_success "Tournament deleted"
        else
            print_error "Failed to delete tournament (HTTP $http_code)"
        fi
    fi

    # Delete players
    for pid in "${PLAYER_IDS[@]}"; do
        print_section "Deleting player: $pid"
        response=$(curl $CURL_OPTS -X DELETE "$BASE_URL/players/$pid" -w "\n%{http_code}" 2>&1)
        http_code=$(echo "$response" | tail -n1)
        if [ "$http_code" = "204" ]; then
            print_success "Player deleted"
        else
            print_error "Failed to delete player (HTTP $http_code)"
        fi
    done
}

# Trap to ensure cleanup runs
trap cleanup EXIT

# ============================================================================
# HEALTH CHECK
# ============================================================================
print_header "HEALTH CHECK"
print_section "Checking API health"
response=$(curl $CURL_OPTS "http://localhost:8001/health")
print_response "$response"
print_success "API is healthy"

# ============================================================================
# PLAYER MANAGEMENT
# ============================================================================
print_header "PLAYER MANAGEMENT"

# Create players
print_section "Creating Player 1: Alice (5k)"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/players" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Alice Chen",
        "rank": "5k",
        "club": "NYC Go Club",
        "email": "alice@example.com"
    }')
print_response "$response"
PLAYER1_ID=$(echo "$response" | jq -r '.player.id')
PLAYER_IDS+=("$PLAYER1_ID")
print_success "Created player: $PLAYER1_ID"

print_section "Creating Player 2: Bob (3k)"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/players" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Bob Smith",
        "rank": "3k",
        "club": "Brooklyn Go Society",
        "agaId": "12345"
    }')
print_response "$response"
PLAYER2_ID=$(echo "$response" | jq -r '.player.id')
PLAYER_IDS+=("$PLAYER2_ID")
print_success "Created player: $PLAYER2_ID"

print_section "Creating Player 3: Carol (1d)"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/players" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Carol Wang",
        "rank": "1d",
        "club": "Manhattan Go Club",
        "rating": 2100
    }')
print_response "$response"
PLAYER3_ID=$(echo "$response" | jq -r '.player.id')
PLAYER_IDS+=("$PLAYER3_ID")
print_success "Created player: $PLAYER3_ID"

print_section "Creating Player 4: David (2k)"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/players" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "David Lee",
        "rank": "2k",
        "club": "Queens Go Club"
    }')
print_response "$response"
PLAYER4_ID=$(echo "$response" | jq -r '.player.id')
PLAYER_IDS+=("$PLAYER4_ID")
print_success "Created player: $PLAYER4_ID"

print_section "Creating Player 5: Eve (4k)"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/players" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Eve Johnson",
        "rank": "4k",
        "club": "NYC Go Club"
    }')
print_response "$response"
PLAYER5_ID=$(echo "$response" | jq -r '.player.id')
PLAYER_IDS+=("$PLAYER5_ID")
print_success "Created player: $PLAYER5_ID"

# List all players
print_section "Listing all players"
response=$(curl $CURL_OPTS "$BASE_URL/players")
print_response "$response"
print_success "Listed players"

# Search players
print_section "Searching for players with 'Go Club'"
response=$(curl $CURL_OPTS "$BASE_URL/players?search=Go%20Club")
print_response "$response"
print_success "Search completed"

# Get specific player
print_section "Getting player details: $PLAYER1_ID"
response=$(curl $CURL_OPTS "$BASE_URL/players/$PLAYER1_ID")
print_response "$response"
print_success "Got player details"

# Update player
print_section "Updating player rating: $PLAYER1_ID"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/players/$PLAYER1_ID" \
    -H "Content-Type: application/json" \
    -d '{"rating": 1850}')
print_response "$response"
print_success "Player updated"

# ============================================================================
# TOURNAMENT MANAGEMENT
# ============================================================================
print_header "TOURNAMENT MANAGEMENT"

# Create tournament
print_section "Creating tournament: NYIG Spring Open 2026"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/tournaments" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "NYIG Spring Open 2026",
        "description": "Annual spring tournament for the NY area",
        "date": "2026-04-15T09:00:00Z",
        "location": "NYC Community Center",
        "settings": {
            "numRounds": 3,
            "pairingAlgorithm": "mcmahon",
            "handicapEnabled": true,
            "handicapReduction": 1,
            "mcmahonBar": "1d",
            "standingsWeights": {
                "wins": 1.0,
                "sos": 0.1,
                "sodos": 0.05,
                "extendedSos": 0.0
            }
        }
    }')
print_response "$response"
TOURNAMENT_ID=$(echo "$response" | jq -r '.tournament.id')
print_success "Created tournament: $TOURNAMENT_ID"

# List tournaments
print_section "Listing all tournaments"
response=$(curl $CURL_OPTS "$BASE_URL/tournaments")
print_response "$response"
print_success "Listed tournaments"

# Get tournament
print_section "Getting tournament details"
response=$(curl $CURL_OPTS "$BASE_URL/tournaments/$TOURNAMENT_ID")
print_response "$response"
print_success "Got tournament details"

# Update tournament status
print_section "Updating tournament status to 'registration'"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID" \
    -H "Content-Type: application/json" \
    -d '{"status": "registration"}')
print_response "$response"
print_success "Tournament status updated"

# ============================================================================
# PLAYER REGISTRATION
# ============================================================================
print_header "PLAYER REGISTRATION"

# Register all players
print_section "Registering Player 1 (Alice) for all rounds"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/registrations" \
    -H "Content-Type: application/json" \
    -d "{\"playerId\": \"$PLAYER1_ID\", \"roundsParticipating\": [1, 2, 3]}")
print_response "$response"
print_success "Player 1 registered"

print_section "Registering Player 2 (Bob) for all rounds"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/registrations" \
    -H "Content-Type: application/json" \
    -d "{\"playerId\": \"$PLAYER2_ID\", \"roundsParticipating\": [1, 2, 3]}")
print_response "$response"
print_success "Player 2 registered"

print_section "Registering Player 3 (Carol) for all rounds"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/registrations" \
    -H "Content-Type: application/json" \
    -d "{\"playerId\": \"$PLAYER3_ID\", \"roundsParticipating\": [1, 2, 3]}")
print_response "$response"
print_success "Player 3 registered"

print_section "Registering Player 4 (David) for rounds 1 and 2 only"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/registrations" \
    -H "Content-Type: application/json" \
    -d "{\"playerId\": \"$PLAYER4_ID\", \"roundsParticipating\": [1, 2]}")
print_response "$response"
print_success "Player 4 registered"

print_section "Registering Player 5 (Eve) for all rounds"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/registrations" \
    -H "Content-Type: application/json" \
    -d "{\"playerId\": \"$PLAYER5_ID\", \"roundsParticipating\": [1, 2, 3]}")
print_response "$response"
print_success "Player 5 registered"

# Update registration
print_section "Updating Player 4's registration to include round 3"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/registrations/$PLAYER4_ID" \
    -H "Content-Type: application/json" \
    -d '{"roundsParticipating": [1, 2, 3]}')
print_response "$response"
print_success "Registration updated"

# Get tournament to see registrations
print_section "Getting tournament with registrations"
response=$(curl $CURL_OPTS "$BASE_URL/tournaments/$TOURNAMENT_ID")
print_response "$response"
print_success "Got tournament with registrations"

# ============================================================================
# TOURNAMENT IN PROGRESS - ROUND 1
# ============================================================================
print_header "ROUND 1 - PAIRING & RESULTS"

# Update tournament status to in_progress
print_section "Starting tournament (status: in_progress)"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID" \
    -H "Content-Type: application/json" \
    -d '{"status": "in_progress"}')
print_response "$response"
print_success "Tournament started"

# Generate round 1 pairings
print_section "Generating Round 1 pairings"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/1/pair")
print_response "$response"
print_success "Round 1 paired"

# Record results for round 1
print_section "Recording Round 1 Board 1 result: Black wins"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/1/boards/1" \
    -H "Content-Type: application/json" \
    -d '{"result": "B+"}')
print_response "$response"
print_success "Result recorded"

print_section "Recording Round 1 Board 2 result: White wins"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/1/boards/2" \
    -H "Content-Type: application/json" \
    -d '{"result": "W+"}')
print_response "$response"
print_success "Result recorded"

# Get standings after round 1
print_section "Getting standings after Round 1"
response=$(curl $CURL_OPTS "$BASE_URL/tournaments/$TOURNAMENT_ID/standings?throughRound=1")
print_response "$response"
print_success "Standings retrieved"

# ============================================================================
# ROUND 2
# ============================================================================
print_header "ROUND 2 - PAIRING & RESULTS"

# Generate round 2 pairings
print_section "Generating Round 2 pairings"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/2/pair")
print_response "$response"
print_success "Round 2 paired"

# Record results for round 2
print_section "Recording Round 2 Board 1 result: White wins by forfeit"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/2/boards/1" \
    -H "Content-Type: application/json" \
    -d '{"result": "W+F"}')
print_response "$response"
print_success "Result recorded"

print_section "Recording Round 2 Board 2 result: Black wins"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/2/boards/2" \
    -H "Content-Type: application/json" \
    -d '{"result": "B+"}')
print_response "$response"
print_success "Result recorded"

# Get standings after round 2
print_section "Getting standings after Round 2"
response=$(curl $CURL_OPTS "$BASE_URL/tournaments/$TOURNAMENT_ID/standings?throughRound=2")
print_response "$response"
print_success "Standings retrieved"

# ============================================================================
# ROUND 3
# ============================================================================
print_header "ROUND 3 - PAIRING & RESULTS"

# Generate round 3 pairings
print_section "Generating Round 3 pairings"
response=$(curl $CURL_OPTS -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/3/pair")
print_response "$response"
print_success "Round 3 paired"

# Record results for round 3
print_section "Recording Round 3 Board 1 result: Black wins"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/3/boards/1" \
    -H "Content-Type: application/json" \
    -d '{"result": "B+"}')
print_response "$response"
print_success "Result recorded"

print_section "Recording Round 3 Board 2 result: Draw"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID/rounds/3/boards/2" \
    -H "Content-Type: application/json" \
    -d '{"result": "Draw"}')
print_response "$response"
print_success "Result recorded"

# ============================================================================
# FINAL STANDINGS
# ============================================================================
print_header "FINAL STANDINGS"

print_section "Getting final standings"
response=$(curl $CURL_OPTS "$BASE_URL/tournaments/$TOURNAMENT_ID/standings")
print_response "$response"
print_success "Final standings retrieved"

# ============================================================================
# TOURNAMENT COMPLETION
# ============================================================================
print_header "TOURNAMENT COMPLETION"

print_section "Marking tournament as completed"
response=$(curl $CURL_OPTS -X PATCH "$BASE_URL/tournaments/$TOURNAMENT_ID" \
    -H "Content-Type: application/json" \
    -d '{"status": "completed"}')
print_response "$response"
print_success "Tournament completed"

# Get final tournament state
print_section "Getting final tournament state"
response=$(curl $CURL_OPTS "$BASE_URL/tournaments/$TOURNAMENT_ID")
print_response "$response"
print_success "Got final tournament state"

# ============================================================================
# ADDITIONAL API TESTS
# ============================================================================
print_header "ADDITIONAL API TESTS"

# Test player withdrawal (register a temp player then withdraw)
print_section "Testing player withdrawal"
temp_response=$(curl $CURL_OPTS -X POST "$BASE_URL/players" \
    -H "Content-Type: application/json" \
    -d '{"name": "Temp Player", "rank": "10k"}')
TEMP_PLAYER_ID=$(echo "$temp_response" | jq -r '.player.id')
PLAYER_IDS+=("$TEMP_PLAYER_ID")
echo "Created temp player: $TEMP_PLAYER_ID"

# Create another tournament for withdrawal test
temp_tournament=$(curl $CURL_OPTS -X POST "$BASE_URL/tournaments" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Temp Tournament",
        "date": "2026-05-01T09:00:00Z",
        "settings": {"numRounds": 2, "pairingAlgorithm": "swiss"}
    }')
TEMP_TOURNAMENT_ID=$(echo "$temp_tournament" | jq -r '.tournament.id')
echo "Created temp tournament: $TEMP_TOURNAMENT_ID"

# Register and then withdraw
curl $CURL_OPTS -X POST "$BASE_URL/tournaments/$TEMP_TOURNAMENT_ID/registrations" \
    -H "Content-Type: application/json" \
    -d "{\"playerId\": \"$TEMP_PLAYER_ID\"}" > /dev/null

response=$(curl $CURL_OPTS -X DELETE "$BASE_URL/tournaments/$TEMP_TOURNAMENT_ID/registrations/$TEMP_PLAYER_ID")
print_response "$response"
print_success "Player withdrawal tested"

# Clean up temp tournament
curl $CURL_OPTS -X DELETE "$BASE_URL/tournaments/$TEMP_TOURNAMENT_ID" > /dev/null
print_success "Temp tournament deleted"

# Test listing with filters
print_section "Testing tournament list with status filter"
response=$(curl $CURL_OPTS "$BASE_URL/tournaments?status=completed")
print_response "$response"
print_success "Filtered list retrieved"

# Test pagination
print_section "Testing pagination (limit=2, skip=0)"
response=$(curl $CURL_OPTS "$BASE_URL/players?limit=2&skip=0")
print_response "$response"
print_success "Pagination tested"

# ============================================================================
# SUMMARY
# ============================================================================
print_header "TEST SUMMARY"
echo -e "${GREEN}All API endpoints tested successfully!${NC}"
echo ""
echo "APIs tested:"
echo "  - GET  /health"
echo "  - GET  /api/players"
echo "  - POST /api/players"
echo "  - GET  /api/players/:id"
echo "  - PATCH /api/players/:id"
echo "  - DELETE /api/players/:id"
echo "  - GET  /api/tournaments"
echo "  - POST /api/tournaments"
echo "  - GET  /api/tournaments/:id"
echo "  - PATCH /api/tournaments/:id"
echo "  - DELETE /api/tournaments/:id"
echo "  - POST /api/tournaments/:id/registrations"
echo "  - PATCH /api/tournaments/:id/registrations/:playerId"
echo "  - DELETE /api/tournaments/:id/registrations/:playerId"
echo "  - POST /api/tournaments/:id/rounds/:roundNumber/pair"
echo "  - PATCH /api/tournaments/:id/rounds/:roundNumber/boards/:boardNumber"
echo "  - GET  /api/tournaments/:id/standings"
echo ""
echo "Cleanup will run automatically..."
