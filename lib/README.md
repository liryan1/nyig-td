# lib

Tournament director tools for US Go tournaments. A Python library for managing Go tournament pairings, handicaps, and standings using Swiss and McMahon systems.

## Features

- **Go Rank System** - Full support for kyu/dan ranks (30k to 9d) with arithmetic operations
- **Handicap Calculation** - AGA-compliant handicap and komi calculation
- **Swiss Pairing** - Score-based pairing with repeat prevention and color balancing
- **McMahon Pairing** - Rank-based initial scores with configurable bar
- **Standings Calculator** - Configurable tiebreakers (SOS, SODOS, Extended SOS)
- **Cross-Division Play** - Players paired across divisions with division-specific prizes

## Installation

```bash
uv add nyig-td
```

Or with pip:

```bash
pip install nyig-td
```

## Quick Start

### Basic Swiss Tournament

```python
from nyig_td import (
    Tournament, TournamentSettings, Player,
    PairingAlgorithm, GameResult, RoundStatus,
    SwissPairingEngine, StandingsCalculator
)

# Create a 4-round Swiss tournament
settings = TournamentSettings(
    num_rounds=4,
    pairing_algorithm=PairingAlgorithm.SWISS,
    handicap_enabled=True
)
tournament = Tournament.create("Club Championship", settings)

# Register players
tournament.add_player(Player.create("Alice", "3d", club="NYC Go Club"))
tournament.add_player(Player.create("Bob", "2d", club="Brooklyn Go"))
tournament.add_player(Player.create("Carol", "1k", club="Queens Go"))
tournament.add_player(Player.create("Dave", "5k", club="NYC Go Club"))

# Generate round 1 pairings
engine = SwissPairingEngine()
result = engine.generate_pairings(tournament, round_number=1)

# Print pairings
for pairing in result.pairings:
    black = tournament.players[pairing.black_player_id]
    white = tournament.players[pairing.white_player_id]
    print(f"Board {pairing.board_number}: {black.name} (B) vs {white.name} (W)")
    if pairing.handicap_stones > 0:
        print(f"  Handicap: {pairing.handicap_stones} stones")

# Record results
round1 = tournament.get_round(1)
round1.pairings = result.pairings
round1.pairings[0].result = GameResult.WHITE_WIN
round1.pairings[1].result = GameResult.BLACK_WIN
round1.status = RoundStatus.COMPLETED

# Calculate standings
calc = StandingsCalculator()
standings = calc.calculate(tournament)
for s in standings:
    print(f"{s.rank}. {s.player.name} - {s.wins}-{s.losses}")
```

### McMahon Tournament

McMahon pairing assigns initial scores based on rank, allowing players of different strengths to compete fairly:

```python
from nyig_td import (
    Tournament, TournamentSettings, Player,
    PairingAlgorithm, McMahonPairingEngine
)

settings = TournamentSettings(
    num_rounds=5,
    pairing_algorithm=PairingAlgorithm.MCMAHON,
    mcmahon_bar="3d",  # Players at 3d+ start at score 0
    handicap_enabled=True
)
tournament = Tournament.create("US Go Congress Open", settings)

# Add players - they'll get initial McMahon scores based on rank
tournament.add_player(Player.create("Strong Dan", "5d"))  # Starts at 0
tournament.add_player(Player.create("At Bar", "3d"))      # Starts at 0
tournament.add_player(Player.create("Below Bar", "1k"))   # Starts at -3

engine = McMahonPairingEngine(bar_rank="3d")

# Check initial McMahon scores
for player in tournament.players.values():
    score = engine.get_initial_mcmahon_score(player)
    print(f"{player.name} ({player.rank}): MM score = {score}")
```

## Core Concepts

### Ranks

Go ranks are represented with the `Rank` class:

```python
from nyig_td import Rank, RankType, validate_rank

# Create ranks
r1 = Rank.from_string("5k")      # 5 kyu
r2 = Rank.from_dan(3)            # 3 dan
r3 = Rank.from_kyu(10)           # 10 kyu

# Rank properties
print(r1.rank_type)              # RankType.KYU
print(r2.level)                  # 3

# Rank comparison (higher rank = stronger)
print(r2 > r1)                   # True (3d > 5k)

# Rank difference
print(r2.difference(r1))         # 7 (3d is 7 stones stronger than 5k)
print(r1.stones_difference(r2))  # 7 (absolute difference)

# Validation
print(validate_rank("5k"))       # True
print(validate_rank("15d"))      # False
```

### Handicap Calculation

Calculate appropriate handicap for games between players of different ranks:

```python
from nyig_td import Rank, HandicapCalculator

calc = HandicapCalculator()

# Standard calculation
white = Rank.from_string("3d")  # Stronger player
black = Rank.from_string("5k")  # Weaker player
handicap = calc.calculate(white, black)

print(handicap.stones)  # 7 (capped at 9)
print(handicap.komi)    # 0.5

# Convenience method with strings
handicap = calc.calculate_from_strings("3d", "1k")

# Custom settings
calc = HandicapCalculator(
    even_komi=7.5,        # Komi for even games
    handicap_komi=0.5,    # Komi for handicap games
    max_stones=9,         # Maximum handicap stones
    reduction=1           # Reduce calculated handicap by 1
)
```

### Players

Players have ranks, optional club affiliations, and AGA IDs:

```python
from nyig_td import Player, Rank

# Create with string rank
player = Player.create(
    name="Alice Chen",
    rank="3d",
    club="NYC Go Club",
    aga_id="12345",
    rating=2150.5
)

# Create with Rank object
rank = Rank.from_dan(3)
player = Player.create("Alice Chen", rank)

# Partial round participation (for players who can't play all rounds)
player.rounds_participating = {1, 2, 4}  # Only plays rounds 1, 2, and 4
```

### Tournament Configuration

```python
from nyig_td import TournamentSettings, PairingAlgorithm, StandingsWeights

settings = TournamentSettings(
    num_rounds=5,                              # 1-10 rounds
    pairing_algorithm=PairingAlgorithm.MCMAHON,
    handicap_enabled=True,
    handicap_reduction=0,                      # Reduce all handicaps by N
    mcmahon_bar="3d",                          # McMahon bar rank
    standings_weights=StandingsWeights(
        wins=1.0,
        sos=0.1,        # Sum of Opponents' Scores
        sodos=0.05,     # Sum of Defeated Opponents' Scores
        extended_sos=0.01
    )
)
```

### Pairing Results

The pairing engine returns pairings, byes, and warnings:

```python
result = engine.generate_pairings(tournament, round_number=1)

# Pairings
for pairing in result.pairings:
    print(f"Board {pairing.board_number}")
    print(f"  Black: {pairing.black_player_id}")
    print(f"  White: {pairing.white_player_id}")
    print(f"  Handicap: {pairing.handicap_stones} stones, {pairing.komi} komi")

# Byes (odd number of players)
for bye in result.byes:
    print(f"Bye: {bye.player_id} ({bye.points} points)")

# Warnings (repeat pairings, etc.)
for warning in result.warnings:
    print(f"Warning: {warning}")
```

### Recording Results

```python
from nyig_td import GameResult, RoundStatus

round1 = tournament.get_round(1)

# Set results
round1.pairings[0].result = GameResult.BLACK_WIN
round1.pairings[1].result = GameResult.WHITE_WIN
round1.pairings[2].result = GameResult.DRAW          # Rare in Go
round1.pairings[3].result = GameResult.BLACK_WIN_FORFEIT
round1.pairings[4].result = GameResult.BOTH_LOSE     # Double forfeit

# Mark round complete
round1.status = RoundStatus.COMPLETED
```

### Standings

Calculate standings with configurable tiebreakers:

```python
from nyig_td import StandingsCalculator, StandingsWeights

# Default weights
calc = StandingsCalculator()

# Custom weights
weights = StandingsWeights(
    wins=1.0,
    sos=0.2,         # Higher SOS weight
    sodos=0.1,
    extended_sos=0.05
)
calc = StandingsCalculator(weights=weights)

# Calculate through specific round
standings = calc.calculate(tournament, through_round=3)

# Or auto-detect last completed round
standings = calc.calculate(tournament)

# Print standings
for s in standings:
    print(f"{s.rank}. {s.player.name} ({s.player.rank})")
    print(f"   Record: {s.wins}-{s.losses}")
    print(f"   SOS: {s.sos:.1f}, SODOS: {s.sodos:.1f}")
    print(f"   Total Score: {s.total_score:.3f}")
```

## Advanced Usage

### Cross-Division McMahon Tournament

In McMahon tournaments, players are paired across divisions based on score, but prizes are awarded within divisions:

```python
from nyig_td import Rank
from nyig_td.standings import PlayerStanding

# Define divisions for prizes
class Division:
    def __init__(self, name: str, min_rank: Rank, max_rank: Rank):
        self.name = name
        self.min_rank = min_rank
        self.max_rank = max_rank

    def contains(self, rank: Rank) -> bool:
        return self.min_rank.value <= rank.value <= self.max_rank.value

    def filter_standings(self, standings: list) -> list:
        return [s for s in standings if self.contains(s.player.rank)]

divisions = [
    Division("Dan", Rank.from_dan(1), Rank.from_dan(9)),
    Division("SDK", Rank.from_kyu(9), Rank.from_kyu(1)),
    Division("DDK", Rank.from_kyu(30), Rank.from_kyu(10)),
]

# Get overall standings (pairing is cross-division)
overall = calc.calculate(tournament)

# Filter for each division's prizes
for div in divisions:
    div_standings = div.filter_standings(overall)
    print(f"\n{div.name} Division Winner: {div_standings[0].player.name}")
```

### Custom McMahon Initial Scores

Override automatic McMahon score calculation for specific players:

```python
player = Player.create("Special Case", "5k")
player.initial_mcmahon_score = 0  # Place at bar regardless of rank

tournament.add_player(player)
```

### Factory Function for Pairing Engines

```python
from nyig_td import get_pairing_engine, PairingAlgorithm

# Get appropriate engine based on settings
engine = get_pairing_engine(
    algorithm=PairingAlgorithm.MCMAHON,
    bar_rank="2d"
)
```

## Examples

See the `examples/` directory for complete working examples:

- **`swiss_tournament.py`** - 4-round Swiss tournament with 8 players
- **`mcmahon_tournament.py`** - 5-round McMahon tournament with 16 players
- **`mcmahon_divisions.py`** - Cross-division McMahon with division prizes

Run an example:

```bash
python examples/swiss_tournament.py
```

## API Reference

### Main Classes

| Class | Description |
|-------|-------------|
| `Rank` | Go rank representation (kyu/dan) |
| `Player` | Tournament participant |
| `Tournament` | Full tournament state |
| `TournamentSettings` | Tournament configuration |
| `Pairing` | A game pairing between two players |
| `Round` | A tournament round with pairings and byes |

### Pairing Engines

| Class | Description |
|-------|-------------|
| `SwissPairingEngine` | Swiss system pairing |
| `McMahonPairingEngine` | McMahon system pairing |
| `get_pairing_engine()` | Factory function |

### Calculators

| Class | Description |
|-------|-------------|
| `HandicapCalculator` | Calculate handicap stones and komi |
| `StandingsCalculator` | Calculate tournament standings |

### Enums

| Enum | Values |
|------|--------|
| `RankType` | `KYU`, `DAN` |
| `GameResult` | `BLACK_WIN`, `WHITE_WIN`, `DRAW`, `NO_RESULT`, `BLACK_WIN_FORFEIT`, `WHITE_WIN_FORFEIT`, `BOTH_LOSE` |
| `RoundStatus` | `PENDING`, `PAIRED`, `IN_PROGRESS`, `COMPLETED` |
| `PairingAlgorithm` | `SWISS`, `MCMAHON` |
| `TournamentStatus` | `SETUP`, `REGISTRATION`, `IN_PROGRESS`, `COMPLETED` |

## Requirements

- Python 3.11+

## License

MIT License - see LICENSE file for details.

## Contributing

See [DEVELOPMENT.md](DEVELOPMENT.md) for development setup and contribution guidelines.
