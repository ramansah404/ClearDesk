"""FastAPI router for Quiz Mode.

Implements Section 8 and Section 9.6 of PROJECT_SPEC.md:
- POST /quiz/generate: {topic_id?, count} generate quiz questions
- POST /quiz/answer: Record answer and update mastery and plan
- GET /quiz/progress: Overall quiz stats and mastery
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers.files import get_current_workspace
from app.schemas import (
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizAnswerRequest,
    QuizAnswerResponse,
    QuizProgressResponse,
    ErrorResponse,
)
from app.services.quiz import (
    generate_quiz_questions,
    submit_quiz_answer,
    get_quiz_progress,
)

router = APIRouter(prefix="/quiz", tags=["Quiz"])


@router.post(
    "/generate",
    response_model=QuizGenerateResponse,
    summary="Generate Quiz Questions",
    description="Generates MCQ or short-answer questions strictly grounded in document chunks with citations and explanations.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input parameters"},
        500: {"model": ErrorResponse, "description": "Server or database error"},
        502: {"model": ErrorResponse, "description": "Upstream Gemini API error"},
    },
)
def generate_quiz(
    req: QuizGenerateRequest,
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> QuizGenerateResponse:
    """Generate quiz questions grounded in workspace documents."""
    try:
        return generate_quiz_questions(
            workspace_id=workspace_id,
            topic_id=req.topic_id,
            count=req.count,
            question_type=req.question_type,
            db=db,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        ) from val_err
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini AI processing error: {run_err}",
        ) from run_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error generating quiz: {exc}",
        ) from exc


@router.post(
    "/answer",
    response_model=QuizAnswerResponse,
    summary="Submit Quiz Answer",
    description="Records user answer attempt, calculates correctness, updates topic mastery, and returns explanation and source citation.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid question or selection"},
        404: {"model": ErrorResponse, "description": "Question not found"},
        500: {"model": ErrorResponse, "description": "Server or database error"},
    },
)
def answer_question(
    req: QuizAnswerRequest,
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> QuizAnswerResponse:
    """Submit answer to a quiz question."""
    try:
        return submit_quiz_answer(
            workspace_id=workspace_id,
            question_id=req.question_id,
            selected_index=req.selected_index,
            db=db,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(val_err),
        ) from val_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error submitting quiz answer: {exc}",
        ) from exc


@router.get(
    "/progress",
    response_model=QuizProgressResponse,
    summary="Get Quiz Progress",
    description="Retrieves overall quiz accuracy, total attempts, and mastery breakdown by syllabus topic.",
    responses={
        500: {"model": ErrorResponse, "description": "Server or database error"},
    },
)
def get_progress(
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> QuizProgressResponse:
    """Retrieve quiz progress and topic mastery."""
    try:
        return get_quiz_progress(workspace_id=workspace_id, db=db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error retrieving quiz progress: {exc}",
        ) from exc
