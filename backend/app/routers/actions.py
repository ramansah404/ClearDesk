"""FastAPI router for Action Board & Conflict Detection.

Implements Section 8 and Section 9.4 of PROJECT_SPEC.md:
- GET /actions: Action items and conflicts
- POST /actions/rescan: Force re-extract actions and detect conflicts
- GET /actions/calendar.ics: RFC 5545 iCalendar file download
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers.files import get_current_workspace
from app.models import ActionItem
from app.schemas import ActionsBoardResponse, ErrorResponse
from app.services.actions import get_action_board, generate_calendar_ics

router = APIRouter(tags=["Actions"])


@router.get(
    "/actions",
    response_model=ActionsBoardResponse,
    summary="Get Action Board",
    description="Retrieves auto-extracted deadlines, deliverables, missing information, and cross-document conflict alerts for current workspace.",
    responses={
        500: {"model": ErrorResponse, "description": "Server or configuration error"},
        502: {"model": ErrorResponse, "description": "Upstream Gemini API error"},
    },
)
def get_actions(
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> ActionsBoardResponse:
    """Retrieve action board items and conflicts."""
    try:
        board = get_action_board(
            workspace_id=workspace_id,
            db=db,
            force_rescan=False,
        )
        return board
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
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
            detail=f"Unexpected action board error: {str(exc)}",
        ) from exc


@router.post(
    "/actions/rescan",
    response_model=ActionsBoardResponse,
    summary="Rescan Documents for Action Items",
    description="Forces re-extraction of action items and re-evaluates cross-document conflicts for the workspace.",
    responses={
        500: {"model": ErrorResponse, "description": "Server or configuration error"},
        502: {"model": ErrorResponse, "description": "Upstream Gemini API error"},
    },
)
def rescan_actions(
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> ActionsBoardResponse:
    """Force re-scan all ready documents in the workspace."""
    try:
        board = get_action_board(
            workspace_id=workspace_id,
            db=db,
            force_rescan=True,
        )
        return board
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
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
            detail=f"Unexpected action board rescan error: {str(exc)}",
        ) from exc


@router.get(
    "/actions/calendar.ics",
    summary="Export Calendar (.ics)",
    description="Generates an RFC 5545 iCalendar (.ics) file containing all dated action items and deadlines.",
    responses={
        200: {"content": {"text/calendar": {}}, "description": "iCalendar file download"},
    },
)
def export_calendar_ics(
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> Response:
    """Download calendar .ics file."""
    try:
        items = (
            db.query(ActionItem)
            .filter(ActionItem.workspace_id == workspace_id, ActionItem.due_date.isnot(None))
            .order_by(ActionItem.due_date.asc())
            .all()
        )
        ics_text = generate_calendar_ics(items=items, db=db)

        return Response(
            content=ics_text,
            media_type="text/calendar",
            headers={
                "Content-Disposition": "attachment; filename=cleardesk-actions.ics",
                "Cache-Control": "no-cache",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate calendar: {str(exc)}",
        ) from exc
