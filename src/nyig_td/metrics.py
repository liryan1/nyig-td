from functools import cmp_to_key

from .models import (
    Tournament,
    Standing,
    MetricsConfig,
    TieBreaker,
    Match,
    MatchResult,
    Participant,
)


def calculate_standings(
    tournament: Tournament, config: MetricsConfig | None = None
) -> dict[str, list[Standing]]:
    """
    Calculates tournament standings.
    Returns a dictionary where keys are division names (or 'General' if no divisions).
    """
    if config is None:
        config = MetricsConfig()

    # Base tournament points (win=1, tie=0.5, etc.)
    base_points = tournament.get_scores(bye_points=config.bye_points)

    # Calculate Main Score (Points or MMS)
    main_scores: dict[str, float] = {}
    for p in tournament.participants:
        p_points = base_points.get(p.id, 0.0)
        if config.use_mcmahon:
            rank = p.metadata.get(config.rank_metadata_key, 0)
            effective_rank = rank
            if config.top_bar is not None:
                effective_rank = min(effective_rank, config.top_bar)
            if config.bottom_bar is not None:
                effective_rank = max(effective_rank, config.bottom_bar)
            main_scores[p.id] = float(effective_rank) + p_points
        else:
            main_scores[p.id] = p_points

    history = tournament.get_history()

    # Step 1: Pre-calculate match mapping for performance
    match_map: dict[str, list[Match]] = {p.id: [] for p in tournament.participants}
    for match in tournament.matches:
        if match.p1.id in match_map:
            match_map[match.p1.id].append(match)
        if match.p2 and match.p2.id in match_map:
            match_map[match.p2.id].append(match)

    # Step 2: Basic metrics for everyone
    stats = {}
    sodos = {}
    for p in tournament.participants:
        wins, losses, ties, byes = 0, 0, 0, 0
        p_sodos = 0.0
        p_matches = match_map.get(p.id, [])

        for m in p_matches:
            if m.result == MatchResult.BYE:
                if m.p1.id == p.id:
                    byes += 1
            elif m.result == MatchResult.P1WIN:
                if m.p1.id == p.id:
                    wins += 1
                    if m.p2:
                        p_sodos += main_scores.get(m.p2.id, 0.0)
                else:
                    losses += 1
            elif m.result == MatchResult.P2WIN:
                if m.p2 and m.p2.id == p.id:
                    wins += 1
                    p_sodos += main_scores.get(m.p1.id, 0.0)
                else:
                    losses += 1
            elif m.result == MatchResult.TIE:
                ties += 1
                if m.p1.id == p.id and m.p2:
                    p_sodos += main_scores.get(m.p2.id, 0.0) * 0.5
                elif m.p2 and m.p2.id == p.id:
                    p_sodos += main_scores.get(m.p1.id, 0.0) * 0.5

        stats[p.id] = {
            "wins": wins,
            "losses": losses,
            "ties": ties,
            "byes": byes,
            "main_score": main_scores[p.id],
        }
        sodos[p.id] = p_sodos

    # Step 3: Calculate SOS
    sos = {}
    for p in tournament.participants:
        opponents = history.get(p.id, set())
        sos[p.id] = sum(main_scores.get(opp_id, 0.0) for opp_id in opponents)

    # Step 4: Calculate SOSOS
    sosos = {}
    for p in tournament.participants:
        opponents = history.get(p.id, set())
        # SOSOS: Sum of SOS of opponents
        sosos[p.id] = sum(sos.get(opp_id, 0.0) for opp_id in opponents)

    # Step 4: Group into divisions
    division_map: dict[str, list[Participant]] = {}
    if not config.divisions:
        division_map["General"] = tournament.participants
    else:
        for p in tournament.participants:
            rank = p.metadata.get(config.rank_metadata_key)
            assigned = False
            if rank is not None:
                for div in config.divisions:
                    min_r = div.min_rank if div.min_rank is not None else -999
                    max_r = div.max_rank if div.max_rank is not None else 999
                    if min_r <= rank <= max_r:
                        division_map.setdefault(div.name, []).append(p)
                        assigned = True
                        break
            if not assigned:
                division_map.setdefault("Unassigned", []).append(p)

    # Step 5: Sort and create Standing objects per division
    results: dict[str, list[Standing]] = {}

    def compare_participants(p1: Participant, p2: Participant) -> int:
        for tb in config.tie_breakers:
            val1, val2 = 0.0, 0.0
            if tb == TieBreaker.MAIN_SCORE:
                val1, val2 = main_scores[p1.id], main_scores[p2.id]
            elif tb == TieBreaker.SOS:
                val1, val2 = sos[p1.id], sos[p2.id]
            elif tb == TieBreaker.SODOS:
                val1, val2 = sodos[p1.id], sodos[p2.id]
            elif tb == TieBreaker.SOSOS:
                val1, val2 = sosos[p1.id], sosos[p2.id]
            elif tb == TieBreaker.SEED:
                # Seed is usually lower-is-better, so we invert it for descending sort
                # If seed is None, treat it as very high (weak)
                val1 = -(p1.seed if p1.seed is not None else 999999)
                val2 = -(p2.seed if p2.seed is not None else 999999)

            if val1 > val2:
                return -1
            elif val1 < val2:
                return 1
        return 0

    for div_name, div_participants in division_map.items():
        sorted_participants = sorted(
            div_participants, key=cmp_to_key(compare_participants)
        )

        div_standings = []
        for i, p in enumerate(sorted_participants):
            p_stats = stats[p.id]
            standing = Standing(
                rank=i + 1,
                participant=p,
                main_score=p_stats["main_score"],
                sos=sos[p.id],
                sodos=sodos[p.id],
                sosos=sosos[p.id],
                record=f"{p_stats['wins']}-{p_stats['losses']}-{p_stats['ties']}",
                byes=int(p_stats["byes"]),
                division=div_name,
            )
            div_standings.append(standing)
        results[div_name] = div_standings

    return results
