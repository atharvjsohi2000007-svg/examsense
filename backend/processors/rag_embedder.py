"""
RAG Embedder - Stores and searches paper chunks in ChromaDB
Uses google-genai 2.8.0 library
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import GEMINI_API_KEY, CHROMA_DIR
import chromadb
from google import genai
from google.genai import types

client = genai.Client(api_key=GEMINI_API_KEY)

chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
collection = chroma_client.get_or_create_collection(
    name="examsense",
    metadata={"hnsw:space": "cosine"}
)

def chunk_text(text, chunk_size=400, overlap=60):
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start = end - overlap
    return chunks

def get_embedding(text):
    try:
        result = client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT"
            )
        )
        return result.embeddings[0].values
    except Exception as e:
        print(f"Embedding error: {e}")
        return None

def embed_and_store(text, metadata):
    if not text or len(text.strip()) < 50:
        return 0

    chunks = chunk_text(text)
    stored = 0

    for i, chunk in enumerate(chunks):
        try:
            chunk_id = (
                f"{metadata.get('college','X')}_"
                f"{metadata.get('course','X')}_"
                f"{metadata.get('year','X')}_"
                f"{metadata.get('semester','X')}_"
                f"{metadata.get('filename','X')}_"
                f"chunk{i}"
            )

            existing = collection.get(ids=[chunk_id])
            if existing and existing['ids']:
                continue

            embedding = get_embedding(chunk)
            if embedding is None:
                continue

            collection.add(
                ids=[chunk_id],
                embeddings=[embedding],
                documents=[chunk],
                metadatas=[{
                    "college": metadata.get("college", ""),
                    "course": metadata.get("course", ""),
                    "year": str(metadata.get("year", "")),
                    "semester": metadata.get("semester", ""),
                    "filename": metadata.get("filename", ""),
                    "chunk_index": i
                }]
            )
            stored += 1

        except Exception as e:
            print(f"Error storing chunk {i}: {e}")
            continue

    return stored

def search(query, college, course,
           semester=None, top_k=10):
    try:
        query_embedding = client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=query,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY"
            )
        )
        query_vector = query_embedding.embeddings[0].values

        where_filter = {
            "$and": [
                {"college": {"$eq": college}},
                {"course": {"$eq": course}}
            ]
        }

        results = collection.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            where=where_filter
        )

        return results

    except Exception as e:
        print(f"Search error: {e}")
        return None

def get_topic_frequency(topic, college, course):
    try:
        results = search(topic, college, course,
                        top_k=50)
        if not results:
            return {"topic": topic,
                    "count": 0,
                    "years_found": [],
                    "total_years": 0}

        years = set()
        for meta in results.get("metadatas", [[]])[0]:
            year = meta.get("year", "")
            if year:
                years.add(year)

        return {
            "topic": topic,
            "years_found": list(years),
            "count": len(years),
            "total_years": len(years)
        }

    except Exception as e:
        print(f"Frequency error: {e}")
        return {"topic": topic, "count": 0,
                "years_found": [], "total_years": 0}

def get_stats():
    try:
        count = collection.count()
        return {
            "total_chunks": count,
            "total_documents": count,
            "by_college": {}
        }
    except Exception as e:
        print(f"Stats error: {e}")
        return {"total_chunks": 0,
                "total_documents": 0,
                "by_college": {}}