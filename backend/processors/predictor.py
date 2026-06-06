"""
Predict likely exam questions using RAG retrieval + Gemini analysis.

Uses past paper chunks from ChromaDB to build context, then asks Gemini
for ranked predictions in structured JSON.
"""

import json
import re
import sys
from pathlib import Path
from typing import Any

import google.generativeai as genai

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import GEMINI_API_KEY  # noqa: E402
from processors.rag_embedder import get_topic_frequency, search  # noqa: E402

GEMINI_MODEL = "gemini-1.5-flash"

# RAG queries used to gather exam-relevant chunks from past papers
RAG_SEARCH_QUERIES = [
    "important questions exam topics",
    "most asked questions marks",
    "unit wise questions syllabus",
]

TOP_CONTEXT_CHUNKS = 20
SEARCH_TOP_K = 15

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def _empty_prediction() -> dict[str, Any]:
    """Fallback structure when retrieval or Gemini fails."""
    return {
        "predicted_questions": [],
        "hot_topics": [],
        "safe_to_skip": [],
        "study_tip": "",
        "total_papers_analyzed": 0,
    }


def _dedupe_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicate chunks by ID, keeping the highest similarity score."""
    best_by_id: dict[str, dict[str, Any]] = {}
    for hit in results:
        chunk_id = hit.get("id") or hit.get("text", "")
        existing = best_by_id.get(chunk_id)
        if existing is None or hit.get("similarity", 0) > existing.get("similarity", 0):
            best_by_id[chunk_id] = hit
    return sorted(best_by_id.values(), key=lambda h: h.get("similarity", 0), reverse=True)


def _count_unique_papers(chunks: list[dict[str, Any]]) -> int:
    """Count distinct source PDFs represented in the retrieved chunks."""
    papers: set[tuple[str, str, str, str, str]] = set()
    for hit in chunks:
        meta = hit.get("metadata") or {}
        key = (
            str(meta.get("college", "")),
            str(meta.get("course", "")),
            str(meta.get("year", "")),
            str(meta.get("semester", "")),
            str(meta.get("filename", "")),
        )
        if key[-1]:
            papers.add(key)
    return len(papers)


def _build_context(chunks: list[dict[str, Any]]) -> str:
    """Step 2: Join the top chunk texts into one context block for Gemini."""
    sections: list[str] = []
    for index, hit in enumerate(chunks[:TOP_CONTEXT_CHUNKS], start=1):
        meta = hit.get("metadata") or {}
        header = (
            f"[Chunk {index} | {meta.get('filename', 'unknown')} | "
            f"year {meta.get('year', '?')} | similarity {hit.get('similarity', 0):.2f}]"
        )
        sections.append(f"{header}\n{hit.get('text', '')}")
    return "\n\n---\n\n".join(sections)


def _build_prompt(
    college: str,
    course: str,
    semester: str,
    context: str,
    papers_analyzed: int,
) -> str:
    """Step 3: Prompt Gemini to return ranked predictions as JSON only."""
    return f"""You are an expert exam analyst for {college} university India.

Analyze these past {course} exam papers for semester {semester} carefully.

Past paper excerpts ({papers_analyzed} unique papers represented):
{context}

Return ONLY a valid JSON object with exactly this structure, no other text:
{{
  "predicted_questions": [
    {{
      "question": "full question text",
      "topic": "topic name",
      "years_appeared": [2021, 2022, 2023],
      "frequency": 3,
      "total_years": 5,
      "probability_percent": 85,
      "priority": "MUST_PREPARE",
      "marks": 10,
      "tip": "one line exam writing tip"
    }}
  ],
  "hot_topics": ["topic1", "topic2", "topic3"],
  "safe_to_skip": ["topic4", "topic5"],
  "study_tip": "one overall study advice",
  "total_papers_analyzed": {papers_analyzed}
}}

Priority must be one of:
MUST_PREPARE, IMPORTANT, OPTIONAL

Give exactly 15 predicted questions.
Sort by probability_percent descending.
Return ONLY the JSON, nothing else."""


def _parse_gemini_json(raw_text: str) -> dict[str, Any]:
    """Step 4: Parse Gemini output, stripping markdown fences if present."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("Gemini response is not a JSON object.")
    return parsed


def _enrich_with_topic_frequency(
    prediction: dict[str, Any],
    college: str,
    course: str,
) -> dict[str, Any]:
    """
    Optional enrichment: fill frequency fields from ChromaDB when Gemini
    omits or approximates them.
    """
    questions = prediction.get("predicted_questions") or []
    for item in questions:
        if not isinstance(item, dict):
            continue
        topic = item.get("topic")
        if not topic:
            continue
        try:
            freq = get_topic_frequency(str(topic), college, course)
            if not item.get("years_appeared"):
                item["years_appeared"] = freq.get("years_found", [])
            if not item.get("frequency"):
                item["frequency"] = freq.get("count", 0)
            if not item.get("total_years"):
                item["total_years"] = freq.get("total_years", 0)
        except Exception:
            continue
    return prediction


def predict_questions(
    college: str,
    course: str,
    year: str,
    semester: str,
) -> dict[str, Any]:
    """
    Predict the 15 most likely exam questions for a college/course/semester.

    Args:
        college: e.g. "VIT"
        course: e.g. "CSE"
        year: target exam year (used for logging/context; RAG filters by semester)
        semester: e.g. "sem4"
    """
    _ = year  # reserved for future year-specific filtering / API responses

    if not GEMINI_API_KEY:
        result = _empty_prediction()
        result["study_tip"] = "GEMINI_API_KEY is not configured."
        return result

    try:
        # ── Step 1: Run multiple RAG searches and merge results ─────────────
        combined: list[dict[str, Any]] = []
        for query in RAG_SEARCH_QUERIES:
            try:
                hits = search(query, college, course, semester, top_k=SEARCH_TOP_K)
                combined.extend(hits)
            except Exception as exc:
                print(f"Search failed for '{query}': {exc}")

        deduped = _dedupe_results(combined)
        if not deduped:
            result = _empty_prediction()
            result["study_tip"] = (
                f"No past papers found in ChromaDB for {college} / {course} / {semester}."
            )
            return result

        papers_analyzed = _count_unique_papers(deduped)

        # ── Step 2: Build context from top chunks ───────────────────────────
        context = _build_context(deduped)

        # ── Step 3: Ask Gemini for structured predictions ─────────────────────
        prompt = _build_prompt(college, course, semester, context, papers_analyzed)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        raw_text = (response.text or "").strip()

        if not raw_text:
            result = _empty_prediction()
            result["total_papers_analyzed"] = papers_analyzed
            result["study_tip"] = "Gemini returned an empty response."
            return result

        # ── Step 4: Parse JSON safely ───────────────────────────────────────
        try:
            prediction = _parse_gemini_json(raw_text)
        except (json.JSONDecodeError, ValueError) as exc:
            print(f"Failed to parse Gemini JSON: {exc}")
            result = _empty_prediction()
            result["total_papers_analyzed"] = papers_analyzed
            result["study_tip"] = "Could not parse prediction response."
            return result

        prediction.setdefault("predicted_questions", [])
        prediction.setdefault("hot_topics", [])
        prediction.setdefault("safe_to_skip", [])
        prediction.setdefault("study_tip", "")
        prediction["total_papers_analyzed"] = prediction.get(
            "total_papers_analyzed", papers_analyzed
        )

        return _enrich_with_topic_frequency(prediction, college, course)

    except Exception as exc:
        print(f"predict_questions failed: {exc}")
        result = _empty_prediction()
        result["study_tip"] = f"Prediction failed: {exc}"
        return result
