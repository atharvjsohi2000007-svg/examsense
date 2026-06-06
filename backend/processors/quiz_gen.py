"""
Generate MCQ quizzes from past exam paper content via RAG + Gemini.
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
from processors.rag_embedder import search  # noqa: E402

GEMINI_MODEL = "gemini-1.5-flash"
RAG_QUERY = "multiple choice questions mcq objective type"
SEARCH_TOP_K = 15
TOP_CONTEXT_CHUNKS = 15

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def _build_context(chunks: list[dict[str, Any]]) -> str:
    """Join top RAG chunks into one context block."""
    sections: list[str] = []
    for index, hit in enumerate(chunks[:TOP_CONTEXT_CHUNKS], start=1):
        meta = hit.get("metadata") or {}
        header = f"[Excerpt {index} | {meta.get('filename', 'unknown')}]"
        sections.append(f"{header}\n{hit.get('text', '')}")
    return "\n\n---\n\n".join(sections)


def _parse_quiz_json(raw_text: str) -> list[dict[str, Any]]:
    """Parse Gemini JSON output, stripping markdown fences if needed."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("Expected a JSON object.")

    questions = parsed.get("questions", [])
    if not isinstance(questions, list):
        raise ValueError("'questions' must be a list.")

    return questions


def _build_prompt(
    college: str,
    course: str,
    count: int,
    context: str,
) -> str:
    """Prompt Gemini to return MCQ questions as JSON only."""
    return f"""Create {count} MCQ questions from these {college} {course} past exam papers.

Past paper excerpts:
{context}

Return ONLY this JSON, nothing else:
{{
  "questions": [
    {{
      "id": 1,
      "question": "question text",
      "options": {{
        "A": "option text",
        "B": "option text",
        "C": "option text",
        "D": "option text"
      }},
      "correct": "A",
      "explanation": "brief explanation",
      "topic": "topic name",
      "marks": 2
    }}
  ]
}}"""


def generate_quiz(
    college: str,
    course: str,
    semester: str,
    count: int = 10,
) -> list[dict[str, Any]]:
    """
    Generate MCQ questions from RAG-retrieved past paper content.

    Returns a list of question dicts, or an empty list on failure.
    """
    if not GEMINI_API_KEY:
        print("generate_quiz: GEMINI_API_KEY is not set.")
        return []

    try:
        # Step 1: Retrieve MCQ-style content from ChromaDB
        try:
            hits = search(RAG_QUERY, college, course, semester, top_k=SEARCH_TOP_K)
        except Exception as exc:
            print(f"generate_quiz: RAG search failed: {exc}")
            return []

        if not hits:
            print("generate_quiz: no past paper content found.")
            return []

        context = _build_context(hits)

        # Step 2: Ask Gemini for structured MCQs
        prompt = _build_prompt(college, course, count, context)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        raw_text = (response.text or "").strip()

        if not raw_text:
            print("generate_quiz: Gemini returned empty text.")
            return []

        # Step 3: Parse JSON response
        try:
            return _parse_quiz_json(raw_text)
        except (json.JSONDecodeError, ValueError) as exc:
            print(f"generate_quiz: JSON parse failed: {exc}")
            return []

    except Exception as exc:
        print(f"generate_quiz failed: {exc}")
        return []
