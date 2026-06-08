"""
ExamSense — Multi-source Ingestion Script.

Runs one time to scrape all papers from GitHub, UPES Library, and Manipal Library,
extracting text and storing them into ChromaDB for RAG.
"""

import os
import sys
from pathlib import Path

# Add backend directory to sys.path to allow consistent imports
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scrapers import github_scraper, upes_scraper, manipal_scraper
from processors import pdf_reader, rag_embedder


def process_and_delete(filepath: str | Path, metadata: dict) -> None:
    """
    Callback function to extract text, embed, store, and then delete the temp file.
    """
    path = Path(filepath)
    filename = metadata.get("filename", path.name)

    try:
        # Step 1: Extract text from PDF
        result = pdf_reader.extract_text(path)

        if result.get("success"):
            # Step 2: Chunk, embed, and store in ChromaDB
            chunks_stored = rag_embedder.embed_and_store(result["text"], metadata)
            print(f"✅ {filename} - {chunks_stored} chunks stored")
        else:
            # Report failure
            error_msg = result.get("error", "Unknown extraction error")
            print(f"❌ {filename} - {error_msg}")

    except Exception as exc:
        print(f"❌ {filename} - unexpected error: {exc}")

    finally:
        # Step 3: Always delete the temporary file
        if path.exists():
            try:
                path.unlink()
            except OSError as exc:
                print(f"  Warning: could not delete temp file {path} — {exc}")


def run_ingestion():
    """
    Orchestrate the entire ingestion pipeline.
    """
    print("\n" + "=" * 50)
    print("🚀 ExamSense Ingestion Started")
    print("=" * 50)

    # Show initial stats
    print("\n[ChromaDB Initial Stats]")
    stats_before = rag_embedder.get_stats()
    print(f"Total chunks: {stats_before['total_chunks']}")
    print(f"Total papers: {stats_before['total_documents']}")

    # 1. GitHub Scraper (GraphicEra only)
    print("\n[1/3] Scraping GitHub (GraphicEra only)...")
    from config import GITHUB_TOKEN
    scraper = github_scraper.GitHubScraper("GraphicEra", "gehuhaldwani/pyqs", token=GITHUB_TOKEN)
    scraper.run(process_fn=process_and_delete)

    # 2. UPES Library Scraper (Skipped)
    print("\n[2/3] Scraping UPES Library... (Skipped)")
    # upes_scraper.run(process_fn=process_and_delete)

    # 3. Manipal Library Scraper (Skipped)
    print("\n[3/3] Scraping Manipal Library... (Skipped)")
    # manipal_scraper.run(process_fn=process_and_delete)

    # Final Summary
    print("\n" + "=" * 50)
    print("✅ Ingestion Complete!")
    print("=" * 50)

    stats_after = rag_embedder.get_stats()
    print(f"Total chunks stored: {stats_after['total_chunks']}")
    print(f"Total papers stored: {stats_after['total_documents']}")
    
    print("\n[Breakdown by College]")
    for college, count in stats_after.get("by_college", {}).items():
        diff = count - stats_before.get("by_college", {}).get(college, 0)
        print(f"- {college}: {count} chunks (new: {diff})")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    run_ingestion()
