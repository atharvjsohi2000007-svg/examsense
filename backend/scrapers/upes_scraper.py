"""
Scrape question-paper PDFs from the UPES official library question bank.

Site: https://library.ddn.upes.ac.in/questionbank/

Each PDF is downloaded to /tmp, passed to process_and_delete(), then removed.
"""

import hashlib
import re
import sys
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import COLLEGE_SOURCES  # noqa: E402
from scrapers.github_scraper import (  # noqa: E402
    TEMP_ROOT,
    _safe_segment,
    process_and_delete,
)

COLLEGE = "UPES"
DEFAULT_COURSE = "BTech"
BASE_URL = COLLEGE_SOURCES[COLLEGE]["base_url"]

# Regex helpers to pull year / semester / subject hints from link or surrounding text
YEAR_PATTERN = re.compile(
    r"year[\s_-]?(\d+)|y(?:ear)?[\s_-]?(\d+)|(\d{4})|(\d+)(?:st|nd|rd|th)[\s_-]?year",
    re.IGNORECASE,
)
SEM_PATTERN = re.compile(
    r"sem(?:ester)?[\s_-]?(\d+)|s(?:em)?[\s_-]?(\d+)",
    re.IGNORECASE,
)
SUBJECT_PATTERN = re.compile(
    r"\b([A-Za-z]{2,8}\d{3,4}[A-Za-z]?)\b"  # course codes like CSE301, MA101
    r"|(?:subject|course)[\s:.-]*([A-Za-z0-9 &/+-]{3,60})",
    re.IGNORECASE,
)

# Browser-like headers — some campus sites block bare scripts with 403
SESSION_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
}

# Safety cap when the index page links into many subfolders
MAX_PAGES_TO_VISIT = 200


def _same_questionbank_site(page_url: str, candidate: str) -> bool:
    """Only follow links that stay on the UPES question-bank host and path."""
    base = urlparse(page_url)
    target = urlparse(candidate)
    if base.netloc != target.netloc:
        return False
    return "/questionbank" in target.path.lower()


def _is_pdf_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return path.endswith(".pdf") or ".pdf?" in url.lower()


def _link_label(anchor: BeautifulSoup) -> str:
    """Combine anchor text and nearby table/list context for metadata parsing."""
    chunks: list[str] = []
    text = anchor.get_text(" ", strip=True)
    if text:
        chunks.append(text)

    parent = anchor.parent
    for _ in range(4):
        if parent is None:
            break
        if parent.name in ("tr", "li", "div", "td", "th", "p", "span"):
            parent_text = parent.get_text(" ", strip=True)
            if parent_text and parent_text not in chunks:
                chunks.append(parent_text)
        parent = parent.parent

    title = anchor.get("title", "").strip()
    if title:
        chunks.append(title)

    return " | ".join(chunks)


def extract_year_semester_subject(context: str, filename: str) -> tuple[str, str, str]:
    """
    Parse year, semester, and subject from link text / surrounding HTML / filename.
    Falls back to 'unknown' when a field cannot be inferred.
    """
    combined = f"{context} {filename}"
    year = "unknown"
    semester = "unknown"
    subject = "unknown"

    year_match = YEAR_PATTERN.search(combined)
    if year_match:
        groups = [g for g in year_match.groups() if g is not None]
        token = groups[0]
        if len(token) == 4:  # calendar year e.g. 2023
            year = token
        else:
            year = f"year{token}"

    sem_match = SEM_PATTERN.search(combined)
    if sem_match:
        n = next(g for g in sem_match.groups() if g is not None)
        semester = f"sem{n}"

    subject_match = SUBJECT_PATTERN.search(combined)
    if subject_match:
        subject = next(g for g in subject_match.groups() if g).strip()
    else:
        # Use filename stem minus semester/year tokens as a weak subject hint
        stem = Path(filename).stem
        cleaned = SEM_PATTERN.sub("", YEAR_PATTERN.sub("", stem)).strip(" _-")
        if len(cleaned) >= 3:
            subject = _safe_segment(cleaned)

    return _safe_segment(year), _safe_segment(semester), _safe_segment(subject)


def build_metadata(context: str, pdf_url: str) -> dict:
    """Build the metadata dict expected by process_and_delete()."""
    filename = _safe_segment(Path(urlparse(pdf_url).path).name or "paper.pdf")
    year, semester, _subject = extract_year_semester_subject(context, filename)

    return {
        "college": COLLEGE,
        "course": DEFAULT_COURSE,
        "year": year,
        "semester": semester,
        "filename": filename,
    }


class UPESScraper:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url.rstrip("/") + "/"
        self.session = requests.Session()
        self.session.headers.update(SESSION_HEADERS)

    def fetch_html(self, url: str) -> BeautifulSoup | None:
        """Step 1: Download a page with requests and parse it with BeautifulSoup."""
        try:
            response = self.session.get(url, timeout=60)
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"{COLLEGE}: Failed to fetch {url} — {exc}")
            return None

        return BeautifulSoup(response.text, "html.parser")

    def collect_pdf_links(self) -> list[tuple[str, str]]:
        """
        Step 2: Starting at the question-bank index, visit HTML pages on the same
        site and collect every PDF href (library sites often split papers across
        subfolders linked from the main page).
        """
        to_visit = [self.base_url]
        visited: set[str] = set()
        pdf_entries: list[tuple[str, str]] = []  # (pdf_url, context_text)
        seen_pdfs: set[str] = set()

        while to_visit and len(visited) < MAX_PAGES_TO_VISIT:
            page_url = to_visit.pop(0)
            if page_url in visited:
                continue
            visited.add(page_url)

            soup = self.fetch_html(page_url)
            if soup is None:
                continue

            # ── Step 2a: Direct PDF anchors and embedded PDF sources ──────────
            for tag in soup.find_all(["a", "iframe", "embed"], href=True) + soup.find_all(
                ["iframe", "embed"], src=True
            ):
                raw_href = tag.get("href") or tag.get("src")
                if not raw_href:
                    continue

                absolute = urljoin(page_url, raw_href.strip())
                if _is_pdf_url(absolute):
                    if absolute not in seen_pdfs:
                        seen_pdfs.add(absolute)
                        context = _link_label(tag) if tag.name == "a" else tag.get("title", "")
                        pdf_entries.append((absolute, context))
                    continue

                # ── Step 2b: Queue same-site HTML subpages linked from the index ─
                if tag.name != "a":
                    continue
                if _is_pdf_url(absolute):
                    continue
                lowered = absolute.lower()
                if any(lowered.endswith(ext) for ext in (".jpg", ".png", ".zip", ".doc", ".docx")):
                    continue
                if _same_questionbank_site(self.base_url, absolute) and absolute not in visited:
                    to_visit.append(absolute)

        return pdf_entries

    def _download_to_temp(self, pdf_url: str) -> Path:
        """Step 3a: Stream the PDF into /tmp/examsense/UPES/."""
        temp_dir = TEMP_ROOT / COLLEGE
        temp_dir.mkdir(parents=True, exist_ok=True)

        unique = hashlib.md5(pdf_url.encode(), usedforsecurity=False).hexdigest()[:12]
        filename = _safe_segment(Path(urlparse(pdf_url).path).name or "paper.pdf")
        dest = temp_dir / f"{unique}_{filename}"

        response = self.session.get(pdf_url, stream=True, timeout=120)
        response.raise_for_status()

        with open(dest, "wb") as handle:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    handle.write(chunk)

        return dest

    def run(
        self,
        process_fn: Callable[[str | Path, dict], None] = process_and_delete,
    ) -> int:
        """
        Discover PDFs, download each to /tmp, call process_fn, delete the temp file.
        Returns the number of papers successfully processed.
        """
        pdf_links = self.collect_pdf_links()
        total = len(pdf_links)

        print(f"{COLLEGE}: Found {total} papers")

        if total == 0:
            print(f"{COLLEGE}: Done!")
            return 0

        processed = 0

        # ── Step 3–4: Download → callback → delete, one PDF at a time ─────────
        for index, (pdf_url, context) in enumerate(pdf_links, start=1):
            metadata = build_metadata(context, pdf_url)
            filename = metadata["filename"]
            temp_path: Path | None = None

            print(f"{COLLEGE}: Processing {index}/{total} - {filename}", flush=True)

            try:
                temp_path = self._download_to_temp(pdf_url)
                process_fn(temp_path, metadata)
                processed += 1
            except requests.RequestException as exc:
                print(f"  Skipped (download failed): {filename} — {exc}")
            except Exception as exc:
                print(f"  Skipped (processing failed): {filename} — {exc}")
            finally:
                if temp_path is not None and temp_path.exists():
                    try:
                        temp_path.unlink()
                    except OSError as exc:
                        print(f"  Warning: could not delete temp file — {exc}")

        print(f"{COLLEGE}: Done!")
        return processed


def run(
    process_fn: Callable[[str | Path, dict], None] = process_and_delete,
) -> int:
    """Entry point — start the UPES library scraper."""
    scraper = UPESScraper()
    return scraper.run(process_fn=process_fn)


if __name__ == "__main__":
    run()
