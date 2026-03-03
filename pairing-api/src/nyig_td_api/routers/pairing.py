"""Pairing generation endpoints."""

from fastapi import APIRouter, HTTPException

from nyig_td import (
    Tournament, TournamentSettings, Player, Round, Pairing, Bye,
    PairingAlgorithm, GameResult, RoundStatus,
    get_pairing_engine, Rank
)

from ..schemas import (
    PairingRequest, PairingResponse, PairingOutput, ByeOutput,
    PairingAlgorithmEnum, GameResultEnum
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


def build_tournament(request: PairingRequest) -> Tournament:
    """Build tournament object from request data."""
    # Determine algorithm
    algorithm = (
        PairingAlgorithm.MCMAHON
        if request.algorithm == PairingAlgorithmEnum.MCMAHON
        else PairingAlgorithm.SWISS
    )

    settings = TournamentSettings(
        num_rounds=request.round_number,  # At least this many rounds
        pairing_algorithm=algorithm,
        handicap_enabled=request.handicap_enabled,
        handicap_reduction=request.handicap_reduction,
        mcmahon_bar=request.mcmahon_bar,
    )

    tournament = Tournament.create("temp", settings)

    # Add players
    for p in request.players:
        player = Player(
            id=p.id,
            name=p.name,
            rank=Rank.from_string(p.rank),
            club=p.club or "",
            aga_id=p.aga_id,
            rating=p.rating,
            rounds_participating=set(p.rounds_participating) if p.rounds_participating else set(),
            initial_mcmahon_score=p.initial_mcmahon_score,
        )
        tournament.add_player(player)

    # Rebuild previous rounds
    # Ensure we have enough round slots
    while len(tournament.rounds) < request.round_number:
        tournament.rounds.append(Round(number=len(tournament.rounds) + 1))

    for round_input in request.previous_rounds:
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

    return tournament


@router.post("", response_model=PairingResponse)
async def generate_pairings(request: PairingRequest) -> PairingResponse:
    """
    Generate pairings for a tournament round.

    This endpoint is stateless - provide all player and historical round data
    in the request. Returns generated pairings with handicaps.
    """
    try:
        tournament = build_tournament(request)

        # Get pairing engine
        algorithm = (
            PairingAlgorithm.MCMAHON
            if request.algorithm == PairingAlgorithmEnum.MCMAHON
            else PairingAlgorithm.SWISS
        )
        engine = get_pairing_engine(algorithm, bar_rank=request.mcmahon_bar)

        # Generate pairings
        result = engine.generate_pairings(tournament, request.round_number)

        # Convert to response
        pairings_out = [
            PairingOutput(
                black_player_id=p.black_player_id,
                white_player_id=p.white_player_id,
                board_number=p.board_number,
                handicap_stones=p.handicap_stones,
                komi=p.komi,
            )
            for p in result.pairings
        ]

        byes_out = [
            ByeOutput(player_id=b.player_id, points=b.points)
            for b in result.byes
        ]

        return PairingResponse(
            pairings=pairings_out,
            byes=byes_out,
            warnings=result.warnings,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pairing generation failed: {str(e)}")
