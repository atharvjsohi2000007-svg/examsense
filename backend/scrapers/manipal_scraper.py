"""
Scrape question-paper PDFs from the MIT Manipal library portal (JavaScript / ASP.NET).

Site: https://libportal.manipal.edu/mit/Question%20Paper.aspx

Uses headless Selenium because folders and files load via postbacks.
Each PDF is downloaded to /tmp, passed to process_and_delete(), then removed.
"""

import hashlib
import re
import sys
import time
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin

import requests
from selenium import webdriver
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import COLLEGE_SOURCES  # noqa: E402
from scrapers.github_scraper import (  # noqa: E402
    TEMP_ROOT,
    _safe_segment,
    process_and_delete,
)

COLLEGE = "Manipal"
DEFAULT_COURSE = "BTech"
BASE_URL = COLLEGE_SOURCES[COLLEGE]["base_url"]

YEAR_MIN = 2006
YEAR_MAX = 2025

# Pull semester hints from folder names or link text (e.g. "Sem 4", "Semester-3")
SEM_PATTERN = re.compile(
    r"sem(?:ester)?[\s._-]*(\d+)|s(?:em)?[\s._-]*(\d+)",
    re.IGNORECASE,
)

# ASP.NET FileGrid selectors (folder rows use folder.png; files use lbFileItem or .pdf href)
GRID_TABLE_ID = "ctl00_ctl00_chmain_MITContent_FileGridCS_gvFiles"
FOLDER_LINK_XPATH = (
    "//a[starts-with(@id, 'ctl') and contains(@href, '__doPostBack') "
    "and .//img[contains(@src, 'folder')]]"
)
FILE_LINK_XPATH = (
    "//a["
    "contains(@id, 'lbFileItem') or "
    "contains(translate(@href, 'PDF', 'pdf'), '.pdf')"
    "]"
)
BACK_LINK_XPATH = "//a[contains(normalize-space(.), '..')]"

WAIT_SECONDS = 20
MAX_FOLDER_DEPTH = 25


def extract_semester(path_parts: list[str], link_text: str) -> str:
    """Try to infer semester from breadcrumb folders or the PDF link label."""
    combined = " ".join(path_parts + [link_text])
    match = SEM_PATTERN.search(combined)
    if not match:
        return "unknown"
    n = next(group for group in match.groups() if group is not None)
    return f"sem{n}"


def build_metadata(year: str, path_parts: list[str], link_text: str) -> dict:
    """Build metadata dict for process_and_delete()."""
    filename = _safe_segment(link_text.strip() or "paper.pdf")
    if not filename.lower().endswith(".pdf"):
        filename = f"{filename}.pdf"

    return {
        "college": COLLEGE,
        "course": DEFAULT_COURSE,
        "year": _safe_segment(year),
        "semester": extract_semester(path_parts, link_text),
        "filename": filename,
    }


class ManipalScraper:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.temp_dir = TEMP_ROOT / COLLEGE
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.driver: webdriver.Chrome | None = None
        self.wait: WebDriverWait | None = None
        self.http = requests.Session()

    def _create_driver(self) -> webdriver.Chrome:
        """Step 1: Launch headless Chrome; webdriver_manager installs ChromeDriver."""
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")

        # Route browser downloads into our temp folder when a click triggers a save
        prefs = {
            "download.default_directory": str(self.temp_dir.resolve()),
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "plugins.always_open_pdf_externally": True,
            "safebrowsing.enabled": True,
        }
        options.add_experimental_option("prefs", prefs)

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)

        # Headless Chrome needs CDP to allow downloads
        driver.execute_cdp_cmd(
            "Page.setDownloadBehavior",
            {"behavior": "allow", "downloadPath": str(self.temp_dir.resolve())},
        )
        return driver

    def _sync_http_session(self) -> None:
        """Copy Selenium cookies into requests for direct PDF URL downloads."""
        assert self.driver is not None
        self.http.cookies.clear()
        for cookie in self.driver.get_cookies():
            self.http.cookies.set(cookie["name"], cookie["value"])
        self.http.headers["User-Agent"] = self.driver.execute_script(
            "return navigator.userAgent;"
        )

    def _wait_for_grid(self) -> None:
        """Wait until the ASP.NET file grid is present after navigation."""
        assert self.wait is not None
        self.wait.until(EC.presence_of_element_located((By.ID, GRID_TABLE_ID)))

    def _open_portal(self) -> None:
        """Step 2: Open the Manipal question-paper page."""
        assert self.driver is not None and self.wait is not None
        self.driver.get(self.base_url)
        self._wait_for_grid()
        time.sleep(1)

    def _folder_labels(self) -> list[str]:
        """Read visible folder names in the current grid (excluding '..')."""
        assert self.driver is not None
        labels: list[str] = []
        for element in self.driver.find_elements(By.XPATH, FOLDER_LINK_XPATH):
            text = element.text.strip()
            if text and text != "..":
                labels.append(text)
        return labels

    def _click_folder(self, label: str) -> bool:
        """Click a folder row by its visible name; re-query DOM to avoid stale nodes."""
        assert self.driver is not None and self.wait is not None
        for attempt in range(3):
            try:
                for element in self.driver.find_elements(By.XPATH, FOLDER_LINK_XPATH):
                    if element.text.strip() == label:
                        self.wait.until(EC.element_to_be_clickable(element)).click()
                        self._wait_for_grid()
                        time.sleep(1)
                        return True
            except (StaleElementReferenceException, ElementClickInterceptedException):
                time.sleep(1)
                if attempt == 2:
                    raise
        return False

    def _click_parent_folder(self) -> bool:
        """Navigate up one level using the '..' folder link."""
        assert self.driver is not None and self.wait is not None
        back_links = self.driver.find_elements(By.XPATH, BACK_LINK_XPATH)
        if not back_links:
            return False
        try:
            self.wait.until(EC.element_to_be_clickable(back_links[0])).click()
            self._wait_for_grid()
            time.sleep(1)
            return True
        except WebDriverException:
            return False

    def _open_year_folder(self, year: int) -> bool:
        """Step 3: From RootFolder, click the year folder (2006–2025)."""
        label = str(year)
        if not self._click_folder(label):
            print(f"{COLLEGE}: Year folder {year} not found, skipping.")
            return False
        return True

    def _download_via_url(self, url: str, filename: str) -> Path:
        """Download a PDF when the grid exposes a direct HTTP(S) link."""
        absolute = urljoin(self.base_url, url)
        unique = hashlib.md5(absolute.encode(), usedforsecurity=False).hexdigest()[:10]
        dest = self.temp_dir / f"{unique}_{filename}"

        self._sync_http_session()
        response = self.http.get(absolute, stream=True, timeout=120)
        response.raise_for_status()

        with open(dest, "wb") as handle:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    handle.write(chunk)
        return dest

    def _download_via_click(self, element, filename: str) -> Path:
        """Click a postback file row and wait for Chrome to save the PDF."""
        assert self.driver is not None and self.wait is not None

        before = {p.name for p in self.temp_dir.glob("*")}
        self.wait.until(EC.element_to_be_clickable(element)).click()

        deadline = time.time() + WAIT_SECONDS
        downloaded: Path | None = None
        while time.time() < deadline:
            candidates = [
                p
                for p in self.temp_dir.iterdir()
                if p.is_file()
                and p.name not in before
                and not p.name.endswith(".crdownload")
            ]
            if candidates:
                downloaded = max(candidates, key=lambda p: p.stat().st_mtime)
                break
            time.sleep(0.25)

        if downloaded is None:
            raise TimeoutException(f"Timed out waiting for download: {filename}")

        unique = hashlib.md5(filename.encode(), usedforsecurity=False).hexdigest()[:10]
        dest = self.temp_dir / f"{unique}_{filename}"
        if dest.exists():
            dest.unlink()
        downloaded.rename(dest)
        return dest

    def _process_pdf_element(
        self,
        element,
        year: str,
        path_parts: list[str],
        process_fn: Callable[[str | Path, dict], None],
        paper_index: int,
    ) -> bool:
        """Download one PDF, invoke the callback, and remove the temp copy."""
        link_text = element.text.strip() or "paper.pdf"
        metadata = build_metadata(year, path_parts, link_text)
        filename = metadata["filename"]
        href = (element.get_attribute("href") or "").strip()
        temp_path: Path | None = None

        try:
            if href and not href.lower().startswith("javascript") and ".pdf" in href.lower():
                temp_path = self._download_via_url(href, filename)
            else:
                temp_path = self._download_via_click(element, filename)

            process_fn(temp_path, metadata)
            print(f"{COLLEGE}: Downloaded paper {paper_index} - {filename}", flush=True)
            return True
        finally:
            if temp_path is not None and temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError as exc:
                    print(f"  Warning: could not delete temp file — {exc}")

    def _crawl_folder(
        self,
        year: str,
        path_parts: list[str],
        process_fn: Callable[[str | Path, dict], None],
        processed_count: int,
        depth: int = 0,
    ) -> int:
        """
        Step 4: Inside the current folder, download PDFs then recurse into subfolders.
        Uses '..' to return after each subfolder visit.
        """
        assert self.driver is not None

        if depth > MAX_FOLDER_DEPTH:
            print(f"{COLLEGE}: Max folder depth reached at {'/'.join(path_parts)}")
            return processed_count

        # ── Step 4a: Download every PDF visible in this folder ──────────────
        pdf_elements = self.driver.find_elements(By.XPATH, FILE_LINK_XPATH)
        for element in pdf_elements:
            try:
                if self._process_pdf_element(
                    element, year, path_parts, process_fn, processed_count + 1
                ):
                    processed_count += 1
            except Exception as exc:
                name = element.text.strip() or "unknown.pdf"
                print(f"  Skipped (download failed): {name} — {exc}")

        # ── Step 4b: Recurse into each subfolder listed in the grid ───────────
        subfolder_labels = self._folder_labels()
        for label in subfolder_labels:
            try:
                if not self._click_folder(label):
                    print(f"  Skipped folder: {label}")
                    continue

                processed_count = self._crawl_folder(
                    year,
                    path_parts + [label],
                    process_fn,
                    processed_count,
                    depth + 1,
                )

                if not self._click_parent_folder():
                    print(f"{COLLEGE}: Could not navigate up from {label}; reloading portal.")
                    self._open_portal()
                    self._open_year_folder(int(year))
                    for part in path_parts:
                        if not self._click_folder(part):
                            break

            except Exception as exc:
                print(f"  Skipped folder {label} — {exc}")
                try:
                    self._open_portal()
                    self._open_year_folder(int(year))
                    for part in path_parts:
                        self._click_folder(part)
                except Exception:
                    pass

        return processed_count

    def run(
        self,
        process_fn: Callable[[str | Path, dict], None] = process_and_delete,
    ) -> int:
        """
        Open the portal, iterate years 2006–2025, crawl each year tree, process PDFs.
        """
        processed_total = 0
        self.driver = self._create_driver()
        self.wait = WebDriverWait(self.driver, WAIT_SECONDS)

        try:
            self._open_portal()

            # ── Step 3–4: Process each year folder one at a time ──────────────
            for year in range(YEAR_MIN, YEAR_MAX + 1):
                print(f"{COLLEGE}: Processing year {year}...", flush=True)

                try:
                    self._open_portal()
                    if not self._open_year_folder(year):
                        continue

                    processed_total = self._crawl_folder(
                        year=str(year),
                        path_parts=[],
                        process_fn=process_fn,
                        processed_count=processed_total,
                    )
                except Exception as exc:
                    print(f"{COLLEGE}: Year {year} failed — {exc}; continuing.")

        finally:
            if self.driver is not None:
                self.driver.quit()

        print(f"{COLLEGE}: Done! Processed {processed_total} papers")
        return processed_total


def run(
    process_fn: Callable[[str | Path, dict], None] = process_and_delete,
) -> int:
    """Entry point — start the Manipal library scraper."""
    scraper = ManipalScraper()
    return scraper.run(process_fn=process_fn)


if __name__ == "__main__":
    run()
