"""Handicap calculation endpoints."""

from fastapi import APIRouter, HTTPException

from nyig_td import HandicapCalculator, Rank

from ..schemas import HandicapRequest, HandicapResponse

router = APIRouter()


@router.post("", response_model=HandicapResponse)
async def calculate_handicap(request: HandicapRequest) -> HandicapResponse:
    """
    Calculate handicap for a game between two players.

    White is typically the stronger player.
    """
    try:
        calculator = HandicapCalculator(reduction=request.reduction)
        white_rank = Rank.from_string(request.white_rank)
        black_rank = Rank.from_string(request.black_rank)

        handicap = calculator.calculate(white_rank, black_rank)

        return HandicapResponse(
            stones=handicap.stones,
            komi=handicap.komi,
            description=str(handicap),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
