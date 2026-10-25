"""ClearDesk FastAPI Main Application.

Configures CORS, lifespan events, structured error handlers, and core health checks.
"""

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db, init_db
from app.schemas import HealthResponse, ErrorResponse



@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager to initialize DB and directories."""
    # Ensure local storage and chroma directories exist
    os.makedirs(settings.storage_dir, exist_ok=True)
    os.makedirs(settings.chroma_dir, exist_ok=True)

    # Initialize SQLite database schema
    init_db()

    yield
    # Cleanup on shutdown if needed


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered document intelligence workspace for students and office workers.",
    lifespan=lifespan,
)

# Configure CORS
origins = settings.cors_origins if isinstance(settings.cors_origins, list) else [settings.cors_origins]
cors_kwargs = {
    "allow_methods": ["*"],
    "allow_headers": ["*"],
    "expose_headers": ["*"],
    "max_age": 86400,
}
if "*" in origins:
    cors_kwargs["allow_origins"] = ["*"]
    cors_kwargs["allow_credentials"] = False
else:
    cors_kwargs["allow_origins"] = origins
    cors_kwargs["allow_credentials"] = True

if settings.cors_origin_regex:
    cors_kwargs["allow_origin_regex"] = settings.cors_origin_regex

app.add_middleware(CORSMiddleware, **cors_kwargs)


# Global Exception Handlers returning structured ErrorResponse
@app.exception_handler(StarletteHTTPException)
async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle standard HTTPExceptions (including 404s) with a structured envelope."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=True,
            message=str(exc.detail),
            detail=None,
        ).model_dump(),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle FastAPI HTTPExceptions with a structured envelope."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=True,
            message=str(exc.detail),
            detail=None,
        ).model_dump(),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors with clear error details."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ErrorResponse(
            error=True,
            message="Request validation error",
            detail=exc.errors(),
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected server errors gracefully."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error=True,
            message="An unexpected server error occurred",
            detail=str(exc) if settings.environment == "development" else None,
        ).model_dump(),
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Service Health Check",
    description="Validates FastAPI service and verifies live SQLite database connectivity.",
)
def get_health(db: Session = Depends(get_db)) -> HealthResponse:
    """Check backend service and database health."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"disconnected: {exc}"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unreachable ({db_status})",
        )

    return HealthResponse(
        status="ok",
        database=db_status,
        version=settings.app_version,
        timestamp=datetime.now(timezone.utc),
    )


from app.routers import files, ask, notes, actions, exam, quiz, export  # noqa: E402
app.include_router(files.router)
app.include_router(ask.router)
app.include_router(notes.router)
app.include_router(actions.router)
app.include_router(exam.router)
app.include_router(quiz.router)
app.include_router(export.router)


@app.get("/", tags=["System"])
def root() -> dict:
    """Root info endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }



