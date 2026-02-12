import os
import tempfile
from pathlib import Path


def pdf_rel_path(note_id: int, compiled_hash: str) -> str:
    safe_hash = "".join(ch for ch in (compiled_hash or "") if ch.isalnum())
    safe_hash = safe_hash[:64] if safe_hash else "nohash"
    return f"{note_id}/{safe_hash}.pdf"


def ensure_dir(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def write_pdf_bytes(storage_dir: str, rel_path: str, pdf_bytes: bytes) -> str:
    storage_dir = storage_dir or "."
    abs_dir = os.path.abspath(storage_dir)
    abs_path = os.path.abspath(os.path.join(abs_dir, rel_path))
    if not abs_path.startswith(abs_dir + os.sep):
        raise ValueError("invalid pdf path")

    ensure_dir(os.path.dirname(abs_path))
    fd, tmp_path = tempfile.mkstemp(prefix="pdf_", suffix=".tmp", dir=os.path.dirname(abs_path))
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(pdf_bytes)
        os.replace(tmp_path, abs_path)
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
    return abs_path


def abs_pdf_path(storage_dir: str, rel_path: str) -> str:
    storage_dir = storage_dir or "."
    abs_dir = os.path.abspath(storage_dir)
    abs_path = os.path.abspath(os.path.join(abs_dir, rel_path))
    if not abs_path.startswith(abs_dir + os.sep):
        raise ValueError("invalid pdf path")
    return abs_path

