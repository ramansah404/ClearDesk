"""FastAPI router for Grounded Document Q&A (Ask View).

Implements Phase 2 cited question answering strictly scoped by workspace session.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers.files import get_current_workspace
from app.schemas import AskRequest, AskResponse, ErrorResponse
from app.services.qa import answer_question

router = APIRouter(tags=["Ask"])


@router.post(
    "/ask",
    response_model=AskResponse,
    summary="Ask Question with Source Citations",
    description="Submits a question over uploaded workspace files. Returns cited answer or strict 'Not found in your files'.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid question input"},
        500: {"model": ErrorResponse, "description": "Server or Gemini configuration error"},
        502: {"model": ErrorResponse, "description": "Upstream Gemini API error"},
    },
)
def ask(
    payload: AskRequest,
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> AskResponse:
    """Answer question strictly grounded in current workspace document chunks."""
    question = payload.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question must not be empty.",
        )

    try:
        response = answer_question(
            question=question,
            workspace_id=workspace_id,
            language=payload.language,
        )
        return response
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(val_err),
        ) from val_err
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(run_err),
        ) from run_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected QA error: {str(exc)}",
        ) from exc