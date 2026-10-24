"""Document ingestion pipeline orchestrating parsing, chunking, embedding, and storage.

Enforces transactional data integrity between SQLite and ChromaDB:
- Only marks a file 'ready' if parsing, chunking, embedding, and indexing all succeed.
- Rolls back partial vector records and SQLite chunks on any failure.
- Accurately records failed status with human-readable error messages.
"""

import os
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models import File, Chunk
from app.services.parsers import parse_document
from app.services.chunker import chunk_document
from app.services.embeddings import index_chunks_in_chroma, delete_file_from_chroma
from app.services.convert import convert_to_pdf, is_libreoffice_available


def process_file_pipeline(
    file_id: str,
    file_path: str,
    file_type: str,
    workspace_id: str,
) -> None:
    """Execute complete ingestion pipeline synchronously or in background task."""
    db: Session = SessionLocal()
    file_record = None

    try:
        file_record = db.query(File).filter(File.id == file_id).first()
        if not file_record:
            return

        file_record.status = "processing"
        file_record.error_message = None
        db.commit()

        # Step 1: Parse Document
        try:
            parsed_doc = parse_document(file_path, file_id, file_type)
        except Exception as parse_err:
            file_record.status = "failed"
            file_record.error_message = f"Parsing error: {str(parse_err)}"
            db.commit()
            return

        if not parsed_doc.pages or parsed_doc.total_text_length == 0:
            file_record.status = "failed"
            file_record.error_message = "No extractable text found in document."
            db.commit()
            return

        # Step 2: Chunk Document (Page boundaries strictly preserved)
        chunks = chunk_document(parsed_doc)
        if not chunks:
            file_record.status = "failed"
            file_record.error_message = "No valid text chunks produced from document content."
            db.commit()
            return

        # Step 3: Source Viewer PDF Conversion Preparation
        if file_type.lower() == "pdf":
            file_record.pdf_path = file_path
        elif file_type.lower() in ("pptx", "docx"):
            if is_libreoffice_available():
                conv_dir = os.path.join(os.path.dirname(file_path), "pdf_conversions")
                converted = convert_to_pdf(file_path, conv_dir)
                if converted:
                    file_record.pdf_path = converted

        # Step 4: Generate Embeddings and Index into ChromaDB
        try:
            index_chunks_in_chroma(
                chunks=chunks,
                file_name=file_record.name,
                workspace_id=workspace_id,
            )
        except Exception as embed_err:
            # Clean up any partial vectors
            delete_file_from_chroma(file_id)
            file_record.status = "failed"
            file_record.error_message = f"Indexing failed: {str(embed_err)}"
            db.commit()
            return

        # Step 5: Save SQLite Chunks with matching Chroma IDs
        # Remove any prior chunks for this file
        db.query(Chunk).filter(Chunk.file_id == file_id).delete()

        for c in chunks:
            chunk_row = Chunk(
                id=c.id,
                file_id=file_id,
                page_or_slide=c.page_or_slide,
                chunk_index=c.chunk_index,
                text=c.text,
                ocr_confidence=c.ocr_confidence,
            )
            db.add(chunk_row)

        file_record.page_count = parsed_doc.page_count
        file_record.status = "ready"
        file_record.error_message = None
        db.commit()

    except Exception as exc:
        db.rollback()
        # Clean up partial Chroma and SQLite artifacts on unexpected failure
        delete_file_from_chroma(file_id)
        if file_record:
            try:
                db.query(Chunk).filter(Chunk.file_id == file_id).delete()
                file_record.status = "failed"
                file_record.error_message = f"Unexpected processing error: {str(exc)}"
                db.commit()
            except Exception:
                pass
    finally:
        db.close()
