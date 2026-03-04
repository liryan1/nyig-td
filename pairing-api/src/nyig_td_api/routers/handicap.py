"""Handicap calculation endpoints."""

from fastapi import APIRouter, HTTPException

from nyig_td import HandicapCalculator, Rank, HandicapModifier, HandicapType, modifier_to_reduction

from ..schemas import HandicapRequest, HandicapResponse, HandicapTypeEnum, HandicapModifierEnum

router = APIRouter()


@router.post("", response_model=HandicapResponse)
async def calculate_handicap(request: HandicapRequest) -> HandicapResponse:
    """
    Calculate handicap for a game between two players.

    White is typically the stronger player.
    """
    try:
        if request.handicap_type == HandicapTypeEnum.NONE:
            # No handicap - return even game
            return HandicapResponse(
                stones=0,
                komi=7.5,
                description="Even game, komi 7.5",
            )

        modifier_mapping = {
            HandicapModifierEnum.NONE: HandicapModifier.NONE,
            HandicapModifierEnum.MINUS_1: HandicapModifier.MINUS_1,
            HandicapModifierEnum.MINUS_2: HandicapModifier.MINUS_2,
        }
        modifier = modifier_mapping[request.handicap_modifier]
        reduction = modifier_to_reduction(modifier)

        calculator = HandicapCalculator(reduction=reduction)
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
