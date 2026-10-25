"""FastAPI router for Exam Radar.

Implements Section 8 and Section 9.5 of PROJECT_SPEC.md:
- POST /exam/build: {exam_date, hours_per_day} builds topics and day-wise plan
- GET /exam/plan: Topics, priorities, day-wise plan
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers.files import get_current_workspace
from app.schemas import ExamBuildRequest, ExamPlanResponse, ErrorResponse
from app.services.exam import build_exam_plan, get_exam_plan

router = APIRouter(prefix="/exam", tags=["Exam Radar"])


@router.post(
    "/build",
    response_model=ExamPlanResponse,
    summary="Build or Regenerate Exam Study Plan",
    description="Analyzes syllabus documents and past papers to extract topics, compute grounded priority scores, and generate a day-wise study schedule.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input parameters"},
        500: {"model": ErrorResponse, "description": "Server or database error"},
        502: {"model": ErrorResponse, "description": "Upstream Gemini API error"},
    },
)
def build_plan(
    req: ExamBuildRequest,
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> ExamPlanResponse:
    """Build day-wise study plan and prioritized topics."""
    try:
        return build_exam_plan(
            workspace_id=workspace_id,
            exam_date_str=req.exam_date,
            hours_per_day=req.hours_per_day,
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
            detail=f"Internal server error generating exam plan: {exc}",
        ) from exc


@router.get(
    "/plan",
    response_model=ExamPlanResponse,
    summary="Get Exam Study Plan",
    description="Retrieves prioritized syllabus topics, past paper evidence, and day-wise schedule for current workspace.",
    responses={
        500: {"model": ErrorResponse, "description": "Server or database error"},
    },
)
def get_plan(
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> ExamPlanResponse:
    """Retrieve existing exam plan and prioritized topics."""
    try:
        return get_exam_plan(workspace_id=workspace_id, db=db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error retrieving exam plan: {exc}",
        ) from exc
