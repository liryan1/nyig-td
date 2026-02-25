# FastAPI Stateless Pairing Service

This guide explains how to build a stateless microservice using **FastAPI** and `nyig-td`. This service acts as a "pure logic" engine: it receives tournament state from your main backend (which persists data to MongoDB), computes the next round or standings, and returns the result without storing any state itself.

## 1. Architectural Overview

- **Main Service (Node/Go/Python + MongoDB):** Owns the "Source of Truth". It manages the lifecycle of participants and matches.
- **Pairing Service (FastAPI + nyig-td):** A stateless worker. It receives a snapshot of the tournament and returns pairings/standings.

## 2. Implementation

### Basic FastAPI Wrapper

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from nyig_td.models import Participant, Match, Tournament, MatchResult, MetricsConfig

app = FastAPI(title="Tournament Logic Service")

# --- Request/Response Models ---

class ParticipantSchema(BaseModel):
    id: str
    name: str
    seed: Optional[int] = None
    metadata: Dict[str, Any] = {}

class MatchSchema(BaseModel):
    p1_id: str
    p2_id: Optional[str] = None
    round: int
    result: str # e.g., "P1WIN", "BYE"
    metadata: Dict[str, Any] = {}

class PairingRequest(BaseModel):
    participants: List[ParticipantSchema]
    matches: List[MatchSchema]
    type: str = "swiss" # "swiss" or "mcmahon"
    options: Dict[str, Any] = {}

# --- Logic ---

def hydrate_tournament(data: PairingRequest) -> Tournament:
    """Converts API request data into nyig-td domain models."""
    participants = [Participant(**p.model_dump()) for p in data.participants]

    t = Tournament(id="stateless", name="request", participants=participants)

    # Map MatchSchema back to domain Match objects
    for m in data.matches:
        p1 = t.get_participant(m.p1_id)
        p2 = t.get_participant(m.p2_id) if m.p2_id else None

        if not p1: continue

        match = Match(
            p1=p1,
            p2=p2,
            round=m.round,
            result=MatchResult[m.result],
            metadata=m.metadata
        )
        t.matches.append(match)
        t.current_round = max(t.current_round, m.round)

    return t

@app.post("/pairings")
async def generate_pairings(request: PairingRequest):
    t = hydrate_tournament(request)

    try:
        new_matches = t.create_round(type=request.type, **request.options)

        # Return serialized matches
        return [
            {
                "p1_id": m.p1.id,
                "p2_id": m.p2.id if m.p2 else None,
                "round": m.round,
                "result": m.result.name,
                "metadata": m.metadata
            } for m in new_matches
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/standings")
async def get_standings(request: PairingRequest):
    t = hydrate_tournament(request)
    config = MetricsConfig(**request.options) if request.options else None

    standings_map = t.get_standings(config)

    # standings_map is Dict[str, List[Standing]]
    return {
        div: [
            {
                "rank": s.rank,
                "participant_id": s.participant.id,
                "main_score": s.main_score,
                "record": s.record,
                "sos": s.sos,
                "sodos": s.sodos
            } for s in entries
        ] for div, entries in standings_map.items()
    }
```

## 3. Integration Logic (Main Backend)

When your main backend (e.g., using Mongoose/MongoDB) needs the next round:

1.  **Query MongoDB:** Fetch all participants and all previous matches for the specific tournament ID.
2.  **POST to FastAPI:** Send the JSON body matching the `PairingRequest` schema.
3.  **Handle Response:**
    - Receive the list of new `Match` objects.
    - Map the `p1_id` and `p2_id` back to your MongoDB `_id` or your internal IDs.
    - Save the new matches to your `Matches` collection in MongoDB.

## 4. Key Advantages

- **Concurrency:** FastAPI handles multiple pairing requests in parallel. Since it is stateless, you can scale this service horizontally with no shared state issues.
- **Validation:** Pydantic ensures the main backend sends valid data before the algorithm ever runs.
- **Decoupling:** You can update the pairing logic (e.g., changing tie-breaker rules in `nyig-td`) without touching your database schemas or main API.
