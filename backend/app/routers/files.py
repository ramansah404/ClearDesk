"""FastAPI router for file upload, retrieval, and PDF preview.

Enforces workspace isolation via X-Workspace-Id header.
"""

import os
import shutil
import uuid
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File as FastAPIFile,
    Form,
    Header,
    HTTPException,
    UploadFile,
    BackgroundTasks,
    status,
)
from fastapi.responses import FileResponse as FastApiFileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import File as DBFile, Workspace
from app.schemas import FileResponse, ErrorResponse
from app.services.pipeline import process_file_pipeline
from app.services.embeddings import delete_file_from_chroma, delete_workspace_from_chroma

router = APIRouter(tags=["Files"])

SUPPORTED_EXTENSIONS = {
    ".pdf": "pdf",
    ".pptx": "pptx",
    ".ppt": "pptx",
    ".docx": "docx",
    ".doc": "docx",
    ".png": "png",
    ".jpg": "jpg",
    ".jpeg": "jpeg",
}

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB limit


def get_current_workspace(
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
) -> str:
    """Validate or create workspace session ensuring strict workspace isolation."""
    if not x_workspace_id or not x_workspace_id.strip():
        # Generate default session ID if client sent none
        x_workspace_id = str(uuid.uuid4())

    ws_id = x_workspace_id.strip()
    ws = db.query(Workspace).filter(Workspace.id == ws_id).first()
    if not ws:
        ws = Workspace(id=ws_id)
        db.add(ws)
        db.commit()

    return ws_id


@router.post(
    "/files",
    response_model=List[FileResponse],
    summary="Upload Documents",
    description="Uploads mixed files (PDF, PPTX, DOCX, images) and triggers background parsing & indexing.",
)
async def upload_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = FastAPIFile(...),
    role: str = Form("material"),
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> List[FileResponse]:
    """Upload one or more files and trigger ingestion pipeline."""
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided in upload request.",
        )

    workspace_storage = os.path.join(settings.storage_dir, workspace_id)
    os.makedirs(workspace_storage, exist_ok=True)

    created_files: List[FileResponse] = []

    for upload_file in files:
        filename = upload_file.filename or "uploaded_file"
        _, ext = os.path.splitext(filename.lower())

        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}' for file '{filename}'. Supported: PDF, PPTX, DOCX, PNG, JPG, JPEG.",
            )

        file_type = SUPPORTED_EXTENSIONS[ext]
        file_id = str(uuid.uuid4())

        # Sanitize and create local target path
        safe_filename = "".join(c for c in filename if c.isalnum() or c in "._- ")
        saved_filename = f"{file_id}_{safe_filename}"
        saved_path = os.path.join(workspace_storage, saved_filename)

        # Write to disk while tracking size
        file_size = 0
        try:
            with open(saved_path, "wb") as buffer:
                while chunk := await upload_file.read(1024 * 1024):  # 1MB chunks
                    file_size += len(chunk)
                    if file_size > MAX_FILE_SIZE_BYTES:
                        buffer.close()
                        if os.path.exists(saved_path):
                            os.remove(saved_path)
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File '{filename}' exceeds maximum allowed size of 50 MB.",
                        )
                    buffer.write(chunk)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save file '{filename}': {str(exc)}",
            )

        # Create database record
        db_file = DBFile(
            id=file_id,
            workspace_id=workspace_id,
            name=filename,
            type=file_type,
            role=role if role in ("material", "syllabus", "past_paper", "other") else "material",
            page_count=0,
            file_size=file_size,
            status="processing",
            error_message=None,
        )
        db.add(db_file)
        db.commit()
        db.refresh(db_file)

        created_files.append(FileResponse.model_validate(db_file))

        # Launch background pipeline processing
        background_tasks.add_task(
            process_file_pipeline,
            file_id=file_id,
            file_path=saved_path,
            file_type=file_type,
            workspace_id=workspace_id,
        )

    return created_files


@router.get(
    "/files",
    response_model=List[FileResponse],
    summary="List Files",
    description="List all files in the current workspace with live processing statuses.",
)
def list_files(
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> List[FileResponse]:
    """Retrieve all files strictly scoped to the calling workspace."""
    files = (
        db.query(DBFile)
        .filter(DBFile.workspace_id == workspace_id)
        .order_by(DBFile.uploaded_at.desc())
        .all()
    )
    return [FileResponse.model_validate(f) for f in files]


@router.get(
    "/files/{file_id}/pdf",
    summary="Serve PDF for Viewer",
    description="Serves original or LibreOffice-converted PDF for document viewing.",
)
def get_file_pdf(
    file_id: str,
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Serve PDF version of a document, enforcing workspace isolation."""
    file_record = (
        db.query(DBFile)
        .filter(DBFile.id == file_id, DBFile.workspace_id == workspace_id)
        .first()
    )
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in current workspace.",
        )

    # Check for converted or original PDF
    pdf_path = file_record.pdf_path
    if pdf_path and os.path.isfile(pdf_path):
        return FastApiFileResponse(
            path=pdf_path,
            media_type="application/pdf",
            filename=f"{file_record.name}.pdf" if not file_record.name.lower().endswith(".pdf") else file_record.name,
        )

    if file_record.type == "pdf":
        # Check original location
        orig_path = os.path.join(settings.storage_dir, workspace_id, f"{file_id}_{file_record.name}")
        if os.path.isfile(orig_path):
            return FastApiFileResponse(
                path=orig_path,
                media_type="application/pdf",
                filename=file_record.name,
            )

    # If PPTX or DOCX could not be converted
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"PDF preview is unavailable for '{file_record.name}' because headless LibreOffice conversion is not configured on this server.",
    )


@router.delete(
    "/files/{file_id}",
    summary="Delete File",
    description="Permanently deletes a file, its SQLite chunks, and vector embeddings.",
)
def delete_file(
    file_id: str,
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Delete a single file and its vectors, enforcing workspace isolation."""
    file_record = (
        db.query(DBFile)
        .filter(DBFile.id == file_id, DBFile.workspace_id == workspace_id)
        .first()
    )
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in current workspace.",
        )

    # Delete ChromaDB vectors
    delete_file_from_chroma(file_id)

    # Delete storage file
    orig_path = os.path.join(settings.storage_dir, workspace_id, f"{file_id}_{file_record.name}")
    if os.path.isfile(orig_path):
        try:
            os.remove(orig_path)
        except Exception:
            pass

    if file_record.pdf_path and os.path.isfile(file_record.pdf_path) and file_record.pdf_path != orig_path:
        try:
            os.remove(file_record.pdf_path)
        except Exception:
            pass

    db.delete(file_record)
    db.commit()

    return {"success": True, "message": f"File '{file_record.name}' deleted successfully."}


@router.delete(
    "/workspace",
    summary="Delete Workspace Data",
    description="Wipes all documents, chunks, vectors, and metadata for the current workspace.",
)
def delete_workspace(
    workspace_id: str = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Erase all user data for the workspace session."""
    # Delete ChromaDB embeddings
    delete_workspace_from_chroma(workspace_id)

    # Delete storage directory
    ws_dir = os.path.join(settings.storage_dir, workspace_id)
    if os.path.isdir(ws_dir):
        try:
            shutil.rmtree(ws_dir)
        except Exception:
            pass

    # Delete SQLite records
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if ws:
        db.delete(ws)
        db.commit()

    return {"success": True, "message": "All workspace data permanently deleted."}
