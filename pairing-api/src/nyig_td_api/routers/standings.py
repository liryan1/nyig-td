"""Standings calculation endpoints."""

from fastapi import APIRouter, HTTPException

from nyig_td import (
    Tournament, TournamentSettings, Player, Round, Pairing, Bye,
    GameResult, RoundStatus,
    StandingsCalculator, StandingsWeights, Rank
)

from ..schemas import (
    StandingsRequest, StandingsResponse, PlayerStandingOutput,
    GameResultEnum
)

router = APIRouter()


def game_result_from_enum(result: GameResultEnum) -> GameResult:
    """Convert API enum to domain enum."""
    mapping = {
        GameResultEnum.BLACK_WIN: GameResult.BLACK_WIN,
        GameResultEnum.WHITE_WIN: GameResult.WHITE_WIN,
        GameResultEnum.BLACK_WIN_FORFEIT: GameResult.BLACK_WIN_FORFEIT,
        GameResultEnum.WHITE_WIN_FORFEIT: GameResult.WHITE_WIN_FORFEIT,
        GameResultEnum.DRAW: GameResult.DRAW,
        GameResultEnum.NO_RESULT: GameResult.NO_RESULT,
        GameResultEnum.BOTH_LOSE: GameResult.BOTH_LOSE,
    }
    return mapping[result]


@router.post("", response_model=StandingsResponse)
async def calculate_standings(request: StandingsRequest) -> StandingsResponse:
    """
    Calculate tournament standings.

    Provide all player and round data. Returns standings with
    configurable tiebreaker weights.
    """
    try:
        # Build tournament
        num_rounds = max(r.number for r in request.rounds) if request.rounds else 1
        settings = TournamentSettings(num_rounds=num_rounds)
        tournament = Tournament.create("temp", settings)

        # Add players
        for p in request.players:
            player = Player(
                id=p.id,
                name=p.name,
                rank=Rank.from_string(p.rank),
                club=p.club or "",
            )
            tournament.add_player(player)

        # Ensure enough round slots
        while len(tournament.rounds) < num_rounds:
            tournament.rounds.append(Round(number=len(tournament.rounds) + 1))

        # Populate rounds
        for round_input in request.rounds:
            if round_input.number > len(tournament.rounds):
                continue
            round_ = tournament.rounds[round_input.number - 1]
            round_.pairings = []
            round_.byes = []

            for pairing_input in round_input.pairings:
                pairing = Pairing.create(
                    black_player_id=pairing_input.black_player_id,
                    white_player_id=pairing_input.white_player_id,
                    board_number=len(round_.pairings) + 1,
                )
                pairing.result = game_result_from_enum(pairing_input.result)
                round_.pairings.append(pairing)

            for bye_input in round_input.byes:
                round_.byes.append(Bye(
                    player_id=bye_input.player_id,
                    points=bye_input.points
                ))

            round_.status = RoundStatus.COMPLETED

        # Calculate standings
        weights = StandingsWeights(
            wins=request.weights.wins,
            sos=request.weights.sos,
            sodos=request.weights.sodos,
            extended_sos=request.weights.extended_sos,
        )
        calculator = StandingsCalculator(weights=weights)

        standings = calculator.calculate(
            tournament,
            through_round=request.through_round
        )

        # Convert to response
        standings_out = [
            PlayerStandingOutput(
                rank=s.rank,
                player_id=s.player.id,
                player_name=s.player.name,
                player_rank=str(s.player.rank),
                wins=s.wins,
                losses=s.losses,
                sos=s.sos,
                sodos=s.sodos,
                extended_sos=s.extended_sos,
                total_score=s.total_score,
            )
            for s in standings
        ]

        return StandingsResponse(standings=standings_out)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Standings calculation failed: {str(e)}")
