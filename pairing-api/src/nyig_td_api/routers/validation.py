"""Rank validation endpoints."""

from fastapi import APIRouter

from nyig_td import Rank, validate_rank

from ..schemas import (
    RankValidationRequest, RankValidationResponse, RankValidationResult
)

router = APIRouter()


@router.post("/ranks", response_model=RankValidationResponse)
async def validate_ranks(request: RankValidationRequest) -> RankValidationResponse:
    """
    Validate a list of rank strings.

    Returns validation status and normalized format for each rank.
    """
    results = []
    all_valid = True

    for rank_str in request.ranks:
        if validate_rank(rank_str):
            normalized = str(Rank.from_string(rank_str))
            results.append(RankValidationResult(
                rank=rank_str,
                valid=True,
                normalized=normalized,
            ))
        else:
            all_valid = False
            results.append(RankValidationResult(
                rank=rank_str,
                valid=False,
                error="Invalid rank format. Expected format like '5k' or '3d'",
            ))

    return RankValidationResponse(results=results, all_valid=all_valid)
