"""Pydantic schemas for request/response serialization and validation."""

from datetime import datetime, timezone
from typing import Any, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str = Field(default="ok", description="Overall service status")
    database: str = Field(default="connected", description="Database connection status")
    version: str = Field(..., description="API Version")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Current UTC timestamp"
    )

    model_config = ConfigDict(from_attributes=True)



class ErrorResponse(BaseModel):
    """Standardized error envelope returned on all HTTP failures."""

    error: bool = Field(default=True, description="Indicates an error occurred")
    message: str = Field(..., description="Human-readable error description")
    detail: Optional[Any] = Field(default=None, description="Detailed error trace or validation errors")

    model_config = ConfigDict(from_attributes=True)


class WorkspaceCreate(BaseModel):
    """Workspace initialization payload."""

    workspace_id: Optional[str] = None


class WorkspaceResponse(BaseModel):
    """Workspace metadata response."""

    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileResponse(BaseModel):
    """File item response schema."""

    id: str
    workspace_id: str
    name: str
    type: str
    role: str
    page_count: int
    file_size: int = 0
    status: str
    error_message: Optional[str] = None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)

