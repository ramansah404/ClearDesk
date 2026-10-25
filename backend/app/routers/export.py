"""ClearDesk Export Router.

Provides endpoints for exporting compiled artifacts, including the
one-page A4 Revision Sheet PDF.
"""

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers.files import get_current_workspace
from app.services.revision_sheet import generate_revision_sheet_pdf

router = APIRouter(tags=["Export"])


@router.get(
    "/export/revision-sheet.pdf",
    summary="Download One-Page A4 Revision Sheet PDF",
    description="Generates and streams a guaranteed single-page A4 revision sheet PDF color-coded with topic priorities and 3-level notes.",
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "Generated single-page revision sheet PDF file.",
        }
    },
)
def export_revision_sheet(
    file_id: str = Query(..., description="Target document ID"),
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Generate and download single-page A4 revision PDF, enforcing workspace isolation."""
    pdf_bytes = generate_revision_sheet_pdf(
        file_id=file_id,
        workspace_id=workspace_id,
        db=db,
    )

    filename = f"revision_sheet_{file_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )
