"""
PDF Reader - Extracts text from PDFs
Handles both digital and scanned PDFs
Uses google-genai 2.8.0 for OCR
"""

import os
import sys
import fitz  # PyMuPDF
from pathlib import Path
import tempfile

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import GEMINI_API_KEY
from google import genai
from google.genai import types

client = genai.Client(api_key=GEMINI_API_KEY)

def extract_text(filepath):
    """
    Extract text from PDF.
    First tries direct extraction.
    If scanned, uses Gemini OCR.
    """
    try:
        doc = fitz.open(filepath)
        full_text = ""
        
        for page in doc:
            full_text += page.get_text()
        
        doc.close()
        
        # If enough text extracted, return it
        if len(full_text.strip()) > 150:
            return {
                "text": full_text.strip(),
                "method": "direct",
                "page_count": len(doc),
                "filepath": filepath,
                "success": True,
                "error": None
            }
        
        # Otherwise use Gemini OCR
        print(f"    → Scanned PDF detected, using OCR...")
        return extract_with_ocr(filepath)
        
    except Exception as e:
        return {
            "text": "",
            "method": "failed",
            "page_count": 0,
            "filepath": filepath,
            "success": False,
            "error": str(e)
        }

def extract_with_ocr(filepath):
    """Use Gemini to read scanned PDF pages"""
    try:
        doc = fitz.open(filepath)
        full_text = ""
        page_count = len(doc)
        
        for page_num in range(page_count):
            try:
                page = doc[page_num]
                
                # Convert page to image
                mat = fitz.Matrix(2, 2)  # 2x zoom for clarity
                pix = page.get_pixmap(matrix=mat)
                
                # Save to temp file
                with tempfile.NamedTemporaryFile(
                    suffix='.png', 
                    delete=False
                ) as tmp:
                    tmp_path = tmp.name
                    pix.save(tmp_path)
                
                # Read image file
                with open(tmp_path, 'rb') as f:
                    image_data = f.read()
                
                # Send to Gemini
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[
                        types.Part.from_bytes(
                            data=image_data,
                            mime_type="image/png"
                        ),
                        types.Part.from_text(
                            text="""This is a university exam question paper page.
                            Extract ALL text exactly as written.
                            Include question numbers, marks, and all content.
                            Return only the extracted text, nothing else."""
                        )
                    ]
                )
                
                page_text = response.text
                if page_text:
                    full_text += page_text + "\n\n"
                
                # Delete temp file
                os.unlink(tmp_path)
                
            except Exception as e:
                print(f"    → OCR failed for page {page_num}: {e}")
                continue
        
        doc.close()
        
        if full_text.strip():
            return {
                "text": full_text.strip(),
                "method": "ocr",
                "page_count": page_count,
                "filepath": filepath,
                "success": True,
                "error": None
            }
        else:
            return {
                "text": "",
                "method": "ocr_failed",
                "page_count": page_count,
                "filepath": filepath,
                "success": False,
                "error": "No text extracted via OCR"
            }
            
    except Exception as e:
        return {
            "text": "",
            "method": "ocr_failed",
            "page_count": 0,
            "filepath": filepath,
            "success": False,
            "error": str(e)
        }


if __name__ == "__main__":
    # Test with a sample PDF
    test_path = "test.pdf"
    if os.path.exists(test_path):
        result = extract_text(test_path)
        print(f"Method: {result['method']}")
        print(f"Success: {result['success']}")
        print(f"Text length: {len(result['text'])}")
        print(f"First 200 chars: {result['text'][:200]}")
    else:
        print("No test.pdf found")