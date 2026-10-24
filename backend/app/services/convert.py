"""Document to PDF conversion service using headless LibreOffice.

Converts PPTX and DOCX files into PDF format for source viewer parity.
Honestly reports when LibreOffice is unavailable.
"""

import os
import shutil
import subprocess
from typing import Optional

from app.config import settings


def get_libreoffice_executable() -> Optional[str]:
    """Find the path to the LibreOffice soffice executable."""
    if settings.libreoffice_path and os.path.isfile(settings.libreoffice_path):
        return settings.libreoffice_path

    which_path = shutil.which("soffice")
    if which_path:
        return which_path

    # Common Windows installation directories
    candidate_paths = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for p in candidate_paths:
        if os.path.isfile(p):
            return p

    return None


def is_libreoffice_available() -> bool:
    """Check whether LibreOffice is installed and executable."""
    return get_libreoffice_executable() is not None


def convert_to_pdf(input_path: str, output_dir: str) -> Optional[str]:
    """Convert a DOCX or PPTX document to PDF using headless LibreOffice.

    Returns the path to the converted PDF file, or None if conversion failed or LibreOffice is unavailable.
    """
    soffice = get_libreoffice_executable()
    if not soffice:
        return None

    os.makedirs(output_dir, exist_ok=True)
    input_filename = os.path.basename(input_path)
    base_name = os.path.splitext(input_filename)[0]
    expected_output_pdf = os.path.join(output_dir, f"{base_name}.pdf")

    cmd = [
        soffice,
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        output_dir,
        input_path,
    ]

    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        if result.returncode == 0 and os.path.isfile(expected_output_pdf):
            return expected_output_pdf
    except Exception:
        pass

    return None
