"""
RAG embedding layer — chunk PDF text, embed with Gemini, store in ChromaDB.

Imported by predictor.py, flashcard_gen.py, quiz_gen.py, ask_engine.py.
"""

import re
import sys
from pathlib import Path
from typing import Any

import chromadb
import google.generativeai as genai

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import CHROMA_DIR, GEMINI_API_KEY  # noqa: E402

COLLECTION_NAME = "examsense"
EMBEDDING_MODEL = "models/text-embedding-004"

CHUNK_WORDS = 400
CHUNK_OVERLAP_WORDS = 60

# ── Step 2: ChromaDB persistent client + collection ───────────────────────────
_chroma_path = (BACKEND_DIR / CHROMA_DIR.lstrip("./")).resolve()
_chroma_path.mkdir(parents=True, exist_ok=True)

_chroma_client = chromadb.PersistentClient(path=str(_chroma_path))
_collection = _chroma_client.get_or_create_collection(
    name=COLLECTION_NAME,
    metadata={"hnsw:space": "cosine"},
)

# ── Step 3: Gemini API client ─────────────────────────────────────────────────
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def chunk_text(text: str) -> list[str]:
    """
    Step 4: Split text into 400-word chunks with 60-word overlap between chunks.
    """
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    step = CHUNK_WORDS - CHUNK_OVERLAP_WORDS
    start = 0

    while start < len(words):
        end = start + CHUNK_WORDS
        piece = words[start:end]
        if piece:
            chunks.append(" ".join(piece))
        if end >= len(words):
            break
        start += step

    return chunks


def _safe_id_part(value: str) -> str:
    """Make metadata values safe for ChromaDB document IDs."""
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", str(value).strip())
    return cleaned or "unknown"


def _make_chunk_id(metadata: dict[str, Any], chunk_index: int) -> str:
    """Unique ID: college_course_year_sem_filename_chunkN"""
    filename = Path(str(metadata.get("filename", "paper.pdf"))).stem
    parts = [
        metadata.get("college", "unknown"),
        metadata.get("course", "unknown"),
        metadata.get("year", "unknown"),
        metadata.get("semester", "unknown"),
        filename,
        f"chunk{chunk_index}",
    ]
    return "_".join(_safe_id_part(part) for part in parts)


def _embed_texts(texts: list[str], task_type: str) -> list[list[float]]:
    """Generate embeddings with Gemini text-embedding-004."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")

    if not texts:
        return []

    if len(texts) == 1:
        response = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=texts[0],
            task_type=task_type,
        )
        return [response["embedding"]]

    response = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=texts,
        task_type=task_type,
    )
    embeddings = response["embedding"]
    if embeddings and isinstance(embeddings[0], (int, float)):
        return [embeddings]
    return embeddings


def _distance_to_similarity(distance: float) -> float:
    """Convert Chroma cosine distance to a similarity score in [0, 1]."""
    return max(0.0, min(1.0, 1.0 - distance))


def embed_and_store(text: str, metadata: dict[str, Any]) -> int:
    """
    Step 5: Chunk text, embed new chunks, and persist them in ChromaDB.

    metadata must include: college, course, year, semester, filename
    """
    filename = metadata.get("filename", "unknown.pdf")
    chunks = chunk_text(text)
    if not chunks:
        print(f"Stored 0 chunks for {filename}")
        return 0

    stored = 0
    pending_ids: list[str] = []
    pending_embeddings: list[list[float]] = []
    pending_documents: list[str] = []
    pending_metadatas: list[dict[str, Any]] = []

    for index, chunk in enumerate(chunks, start=1):
        chunk_id = _make_chunk_id(metadata, index)

        # Skip chunks we already indexed for this paper
        existing = _collection.get(ids=[chunk_id])
        if existing["ids"]:
            continue

        embedding = _embed_texts([chunk], task_type="retrieval_document")[0]

        chunk_metadata = {
            "college": str(metadata.get("college", "")),
            "course": str(metadata.get("course", "")),
            "year": str(metadata.get("year", "")),
            "semester": str(metadata.get("semester", "")),
            "filename": str(metadata.get("filename", "")),
            "chunk_index": index,
        }

        pending_ids.append(chunk_id)
        pending_embeddings.append(embedding)
        pending_documents.append(chunk)
        pending_metadatas.append(chunk_metadata)
        stored += 1

    if pending_ids:
        _collection.add(
            ids=pending_ids,
            embeddings=pending_embeddings,
            documents=pending_documents,
            metadatas=pending_metadatas,
        )

    print(f"Stored {stored} chunks for {filename}")
    return stored


def search(
    query: str,
    college: str,
    course: str,
    semester: str,
    top_k: int = 10,
) -> list[dict[str, Any]]:
    """
    Step 6: Embed the query and return the top_k most similar chunks
    filtered by college, course, and semester.
    """
    if _collection.count() == 0:
        return []

    query_embedding = _embed_texts([query], task_type="retrieval_query")[0]
    n_results = min(top_k, _collection.count())

    results = _collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        where={
            "$and": [
                {"college": college},
                {"course": course},
                {"semester": semester},
            ]
        },
        include=["documents", "metadatas", "distances"],
    )

    hits: list[dict[str, Any]] = []
    ids = results.get("ids", [[]])[0]
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for doc_id, document, meta, distance in zip(ids, documents, metadatas, distances):
        hits.append(
            {
                "id": doc_id,
                "text": document,
                "metadata": meta,
                "similarity": _distance_to_similarity(distance),
            }
        )

    return hits


def _normalize_year(value: str) -> str | int:
    """Prefer numeric years in frequency output when possible."""
    match = re.search(r"(20\d{2})", str(value))
    if match:
        return int(match.group(1))
    if str(value).isdigit():
        return int(value)
    return value


def get_topic_frequency(topic: str, college: str, course: str) -> dict[str, Any]:
    """
    Step 7: Find which years a topic appears in for a college/course
    (searches across all semesters and years).
    """
    filter_clause = {"$and": [{"college": college}, {"course": course}]}
    total_in_scope = _collection.get(where=filter_clause, include=[]).get("ids", [])
    total_in_scope_count = len(total_in_scope)
    n_results = min(max(total_in_scope_count, 1), 1000)

    if total_in_scope_count == 0:
        return {
            "topic": topic,
            "years_found": [],
            "count": 0,
            "total_years": 0,
        }

    query_embedding = _embed_texts([topic], task_type="retrieval_query")[0]
    results = _collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        where=filter_clause,
        include=["metadatas", "distances"],
    )

    # Unique years where the topic shows up in similar chunks
    years_found_set: set[str | int] = set()
    for meta, distance in zip(
        results.get("metadatas", [[]])[0],
        results.get("distances", [[]])[0],
    ):
        if _distance_to_similarity(distance) < 0.35:
            continue
        year = meta.get("year")
        if year:
            years_found_set.add(_normalize_year(str(year)))

    years_found = sorted(years_found_set, key=lambda y: (isinstance(y, str), y))

    # All distinct years indexed for this college + course
    all_records = _collection.get(where=filter_clause, include=["metadatas"])
    all_years: set[str | int] = set()
    for meta in all_records.get("metadatas", []):
        year = meta.get("year")
        if year:
            all_years.add(_normalize_year(str(year)))

    return {
        "topic": topic,
        "years_found": years_found,
        "count": len(years_found),
        "total_years": len(all_years),
    }


def get_stats() -> dict[str, Any]:
    """
    Step 8: Return total chunk count and per-college breakdown.
    """
    total_chunks = _collection.count()
    records = _collection.get(include=["metadatas"])

    by_college: dict[str, int] = {}
    unique_documents: set[tuple[str, str, str, str, str]] = set()

    for meta in records.get("metadatas", []):
        college = meta.get("college", "unknown")
        by_college[college] = by_college.get(college, 0) + 1

        doc_key = (
            str(meta.get("college", "")),
            str(meta.get("course", "")),
            str(meta.get("year", "")),
            str(meta.get("semester", "")),
            str(meta.get("filename", "")),
        )
        unique_documents.add(doc_key)

    return {
        "total_chunks": total_chunks,
        "total_documents": len(unique_documents),
        "by_college": dict(sorted(by_college.items())),
    }
