import os
from pathlib import PurePosixPath


def normalize_asset_path(path: str) -> str:
    p = (path or "").replace("\\", "/").strip()
    p = p.lstrip("/")
    if not p:
        raise ValueError("资源路径不能为空")
    if "\x00" in p:
        raise ValueError("资源路径非法")
    if len(p) > 400:
        raise ValueError("资源路径过长")
    pp = PurePosixPath(p)
    parts = [x for x in pp.parts if x not in ("", ".")]
    if any(x == ".." for x in parts):
        raise ValueError("资源路径非法")
    norm = "/".join(parts)
    if not norm or norm.startswith("../") or norm.startswith("/"):
        raise ValueError("资源路径非法")
    return norm


def detect_mime_by_magic(ext: str, content: bytes) -> str | None:
    ext = (ext or "").lower().lstrip(".")
    head = content[:2048]
    if ext == "png":
        return "image/png" if head.startswith(b"\x89PNG\r\n\x1a\n") else None
    if ext in ("jpg", "jpeg"):
        return "image/jpeg" if head.startswith(b"\xff\xd8") else None
    if ext == "gif":
        return "image/gif" if head.startswith(b"GIF87a") or head.startswith(b"GIF89a") else None
    if ext == "webp":
        return "image/webp" if len(head) >= 12 and head.startswith(b"RIFF") and head[8:12] == b"WEBP" else None
    if ext == "pdf":
        return "application/pdf" if head.startswith(b"%PDF-") else None
    if ext == "svg":
        try:
            text = head.decode("utf-8", errors="ignore").lower()
        except Exception:
            return None
        return "image/svg+xml" if "<svg" in text else None
    return None


def validate_asset_upload(path: str, filename: str, content_type: str | None, content: bytes, max_bytes: int, allowed_exts: set[str]) -> tuple[str, str]:
    rel_path = normalize_asset_path(path)
    size = len(content or b"")
    if size <= 0:
        raise ValueError("资源内容为空")
    if size > int(max_bytes):
        raise ValueError("资源文件过大")

    ext = os.path.splitext(filename or rel_path)[1].lower().lstrip(".")
    if not ext:
        raise ValueError("资源缺少扩展名")
    if ext not in allowed_exts:
        raise ValueError("不支持的资源类型")

    detected = detect_mime_by_magic(ext, content)
    if not detected:
        raise ValueError("资源内容与扩展名不匹配")

    mime = (content_type or "").split(";")[0].strip().lower() or detected
    if mime != detected:
        mime = detected
    return rel_path, mime

