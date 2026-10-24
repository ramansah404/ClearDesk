"""Embeddings and vector storage integration with Gemini and ChromaDB.

Adheres strictly to Phase 1 rules:
1. No deterministic or fake embeddings fallback. If GEMINI_API_KEY is missing or the API fails, raises clear errors and does not mark the file as ready.
2. Uses official google.genai SDK with configurable EMBED_MODEL.
3. Persistent ChromaDB indexing matching SQLite chunk IDs.
4. Clean deletion utilities for transactional integrity.
"""

from typing import List, Dict, Any, Optional
import chromadb
from google import genai
from google.genai.errors import APIError

from app.config import settings
from app.services.chunker import DocumentChunk

# Collection name for all document chunks
COLLECTION_NAME = "cleardesk_chunks"

_chroma_client: Optional[chromadb.ClientAPI] = None


def get_chroma_client() -> chromadb.ClientAPI:
    """Get or initialize persistent ChromaDB client."""
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=settings.chroma_dir)
    return _chroma_client


def get_chunks_collection() -> chromadb.Collection:
    """Retrieve or create the document chunks vector collection."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "ClearDesk document text chunks with source page metadata"},
    )


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate vector embeddings using official Google GenAI SDK.

    Raises clear error if GEMINI_API_KEY is not set or API returns an error.
    """
    if not texts:
        return []

    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is missing. File processing cannot generate vector embeddings without an active Gemini API key in .env."
        )

    try:
        client = genai.Client(api_key=api_key)
    except Exception as exc:
        raise ValueError(f"Failed to initialize Google GenAI client: {exc}") from exc

    model_name = settings.embed_model.strip() or "text-embedding-004"
    embeddings: List[List[float]] = []
    batch_size = 20

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        try:
            response = client.models.embed_content(
                model=model_name,
                contents=batch,
            )
            if not response.embeddings:
                raise RuntimeError(f"Embedding model '{model_name}' returned empty embeddings.")
            for item in response.embeddings:
                embeddings.append(item.values)
        except APIError as api_err:
            raise RuntimeError(
                f"Google Gemini Embedding API error (model: {model_name}): {api_err.message}"
            ) from api_err
        except Exception as exc:
            raise RuntimeError(
                f"Error calling embedding model '{model_name}': {exc}"
            ) from exc

    return embeddings


def index_chunks_in_chroma(
    chunks: List[DocumentChunk],
    file_name: str,
    workspace_id: str,
) -> None:
    """Embed chunks and index them into persistent ChromaDB.

    Maintains 1:1 ID correspondence with SQLite Chunk records.
    """
    if not chunks:
        return

    texts = [c.text for c in chunks]
    embeddings = generate_embeddings(texts)

    collection = get_chunks_collection()
    ids = [c.id for c in chunks]
    metadatas: List[Dict[str, Any]] = [
        {
            "file_id": c.file_id,
            "file_name": file_name,
            "page_or_slide": c.page_or_slide,
            "chunk_index": c.chunk_index,
            "workspace_id": workspace_id,
            "ocr_confidence": float(c.ocr_confidence) if c.ocr_confidence is not None else -1.0,
        }
        for c in chunks
    ]

    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas,
    )


def delete_file_from_chroma(file_id: str) -> None:
    """Remove all vector chunks for a specific file from ChromaDB."""
    try:
        collection = get_chunks_collection()
        collection.delete(where={"file_id": file_id})
    except Exception:
        pass


def delete_workspace_from_chroma(workspace_id: str) -> None:
    """Remove all vectors for a specific workspace from ChromaDB."""
    try:
        collection = get_chunks_collection()
        collection.delete(where={"workspace_id": workspace_id})
    except Exception:
        pass
