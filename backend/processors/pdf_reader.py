"""
Extract text from exam PDFs — digital text layers and scanned/image pages.

Step 1–2: PyMuPDF (fitz) direct text extraction.
Step 3–4: If text is too short (< 150 chars), render pages to PNG and OCR via Gemini.
"""

import re
import sys
from collections import Counter
from pathlib import Path

import fitz  # PyMuPDF
import google.generativeai as genai

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import GEMINI_API_KEY  # noqa: E402

# Scanned PDFs usually yield almost no selectable text
MIN_USEFUL_TEXT_LENGTH = 150

# Higher render scale improves OCR accuracy on small scan text
PAGE_RENDER_SCALE = 2.0

GEMINI_OCR_PROMPT = (
    "This is a university exam question paper page. Extract ALL text from it "
    "exactly as written. Include question numbers, marks, and all content."
)

GEMINI_MODEL = "gemini-1.5-flash"


def _empty_result(filepath: Path, page_count: int = 0) -> dict:
    """Standard response shape with defaults."""
    return {
        "text": "",
        "method": "",
        "page_count": page_count,
        "filepath": str(filepath),
        "success": False,
        "error": None,
    }


def clean_text(text: str) -> str:
    """
    Step 5: Normalize whitespace, drop junk characters, and remove
    repeated header/footer lines that appear on many pages.
    """
    if not text:
        return ""

    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Drop control characters except newline and tab
    text = "".join(
        char
        for char in text
        if char in ("\n", "\t")
        or (ord(char) >= 32 and ord(char) != 127)
        or ord(char) > 127
    )

    # Collapse runs of blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    lines = text.split("\n")

    # Short lines repeated on many pages are often headers/footers (page numbers, college name)
    stripped_lines = [line.strip() for line in lines if line.strip()]
    repeated = {
        line
        for line, count in Counter(stripped_lines).items()
        if count >= 3 and len(line) < 80
    }
    if repeated:
        lines = [line for line in lines if line.strip() not in repeated]

    return "\n".join(lines).strip()


def _extract_direct_text(doc: fitz.Document) -> str:
    """
    Step 2: Loop every page and concatenate PyMuPDF text extraction output.
    """
    page_texts: list[str] = []
    for page in doc:
        page_texts.append(page.get_text())
    return "\n".join(page_texts)


def _page_to_png_bytes(page: fitz.Page) -> bytes:
    """Render one PDF page to PNG bytes for vision/OCR models."""
    matrix = fitz.Matrix(PAGE_RENDER_SCALE, PAGE_RENDER_SCALE)
    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    return pixmap.tobytes("png")


def _ocr_with_gemini(doc: fitz.Document) -> str:
    """
    Step 4: Convert each page to PNG and send to Gemini for text extraction.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set — required for scanned PDF OCR.")

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)

    page_texts: list[str] = []
    for page_index, page in enumerate(doc):
        png_bytes = _page_to_png_bytes(page)
        image_part = {"mime_type": "image/png", "data": png_bytes}

        response = model.generate_content([GEMINI_OCR_PROMPT, image_part])
        page_text = (response.text or "").strip()
        if page_text:
            page_texts.append(page_text)

    return "\n\n".join(page_texts)


def extract_text(filepath: str | Path) -> dict:
    """
    Extract full text from a PDF using direct parsing or Gemini OCR.

    Returns:
        {
            text: str,
            method: "direct" | "ocr" | "",
            page_count: int,
            filepath: str,
            success: bool,
            error: str | None,
        }
    """
    path = Path(filepath)
    result = _empty_result(path)

    if not path.exists():
        result["error"] = f"File not found: {path}"
        return result

    doc: fitz.Document | None = None
    try:
        # Step 1: Open the PDF
        doc = fitz.open(path)
        page_count = len(doc)
        result["page_count"] = page_count

        if page_count == 0:
            result["error"] = "PDF has no pages."
            return result

        # Step 2: Try direct text extraction first
        direct_text = _extract_direct_text(doc)

        # Step 3: Decide whether direct text is usable
        if len(direct_text.strip()) >= MIN_USEFUL_TEXT_LENGTH:
            result["text"] = clean_text(direct_text)
            result["method"] = "direct"
            result["success"] = bool(result["text"])
            if not result["success"]:
                result["error"] = "Direct extraction returned empty text after cleaning."
            return result

        # Step 4: Scanned PDF — OCR each page with Gemini
        try:
            ocr_text = _ocr_with_gemini(doc)
        except Exception as exc:
            result["error"] = f"OCR failed: {exc}"
            return result

        # Step 5: Clean combined OCR output
        cleaned = clean_text(ocr_text)
        result["text"] = cleaned
        result["method"] = "ocr"
        result["success"] = bool(cleaned)
        if not result["success"]:
            result["error"] = "OCR returned empty text after cleaning."
        return result

    except Exception as exc:
        result["error"] = str(exc)
        return result
    finally:
        if doc is not None:
            doc.close()


if __name__ == "__main__":
    result = extract_text("test.pdf")
    print(result)
