"""FastAPI router for 3-Level Notes & Multilingual Translation.

Implements Section 8 and Section 9.3 of PROJECT_SPEC.md:
- GET /notes/{file_id}?lang=en|hi|te
- POST /notes/{file_id}/regenerate
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers.files import get_current_workspace
from app.schemas import NotesResponse, ErrorResponse
from app.services.notes import get_or_generate_notes

router = APIRouter(tags=["Notes"])


@router.get(
    "/notes/{file_id}",
    response_model=NotesResponse,
    summary="Get 3-Level Notes",
    description="Retrieves or generates structured 3-level keyword notes for a document in the requested language (en, hi, te).",
    responses={
        400: {"model": ErrorResponse, "description": "Document is not ready"},
        404: {"model": ErrorResponse, "description": "File not found in current workspace"},
        500: {"model": ErrorResponse, "description": "Server or Gemini configuration error"},
        502: {"model": ErrorResponse, "description": "Upstream Gemini API error"},
    },
)
def get_notes(
    file_id: str,
    lang: Optional[str] = Query("en", description="Language code: 'en' (English), 'hi' (Hindi), or 'te' (Telugu)"),
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> NotesResponse:
    """Retrieve 3-level notes for an uploaded document."""
    try:
        notes_res = get_or_generate_notes(
            file_id=file_id,
            workspace_id=workspace_id,
            language=lang or "en",
            force_regenerate=False,
            db=db,
        )
        return notes_res
    except ValueError as val_err:
        err_msg = str(val_err)
        if "not found in current workspace" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=err_msg,
            ) from val_err
        if "is not ready" in err_msg.lower() or "unsupported language" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_msg,
            ) from val_err
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=err_msg,
        ) from val_err
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(run_err),
        ) from run_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected notes error: {str(exc)}",
        ) from exc


@router.post(
    "/notes/{file_id}/regenerate",
    response_model=NotesResponse,
    summary="Regenerate 3-Level Notes",
    description="Forces regeneration of 3-level keyword notes for a document from scratch.",
    responses={
        400: {"model": ErrorResponse, "description": "Document is not ready"},
        404: {"model": ErrorResponse, "description": "File not found in current workspace"},
        500: {"model": ErrorResponse, "description": "Server or Gemini configuration error"},
        502: {"model": ErrorResponse, "description": "Upstream Gemini API error"},
    },
)
def regenerate_notes(
    file_id: str,
    lang: Optional[str] = Query("en", description="Target language: en, hi, te"),
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> NotesResponse:
    """Force re-generate 3-level notes for a document."""
    try:
        notes_res = get_or_generate_notes(
            file_id=file_id,
            workspace_id=workspace_id,
            language=lang or "en",
            force_regenerate=True,
            db=db,
        )
        return notes_res
    except ValueError as val_err:
        err_msg = str(val_err)
        if "not found in current workspace" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=err_msg,
            ) from val_err
        if "is not ready" in err_msg.lower() or "unsupported language" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_msg,
            ) from val_err
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=err_msg,
        ) from val_err
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(run_err),
        ) from run_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected notes error: {str(exc)}",
        ) from exc
