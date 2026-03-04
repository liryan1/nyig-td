"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import handicap, pairing, standings, validation
from .schemas import HealthResponse

app = FastAPI(
    title="pairing-api",
    description="Stateless API for Go tournament management",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(handicap.router, prefix="/handicap", tags=["Handicap"])
app.include_router(pairing.router, prefix="/pair", tags=["Pairing"])
app.include_router(standings.router, prefix="/standings", tags=["Standings"])
app.include_router(validation.router, prefix="/validate", tags=["Validation"])


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="healthy", version="0.1.0")


@app.get("/", tags=["Health"])
async def root() -> dict[str, str]:
    """Root endpoint with API info."""
    return {
        "name": "pairing-api",
        "version": "0.1.0",
        "docs": "/docs",
    }
