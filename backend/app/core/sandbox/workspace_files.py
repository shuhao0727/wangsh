"""Safe writes for PythonLab workspace files.

The workspace directory is mounted read-write into the student container, so
every name we write may already be a symlink planted by student code. Writes
must replace the directory entry instead of following it.
"""

import json
import os
import stat
import tempfile
from pathlib import Path
from typing import Any, Dict

from app.core.sandbox.base import get_sitecustomize_content

PLAIN_RUN_SCRIPT = "\n".join(
    [
        "#!/bin/sh",
        "stty echo 2>/dev/null || true",
        "python -u /workspace/main.py",
        "rc=$?",
        "printf '\\n__PYTHONLAB_DONE__:%s\\n' \"$rc\"",
    ]
) + "\n"


def _write_regular_file(ws_path: Path, name: str, content: str, mode: int) -> None:
    target = ws_path / name
    try:
        info = target.lstat()
    except FileNotFoundError:
        info = None
    if info is not None and not (stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode)):
        raise RuntimeError(f"workspace file {name} is not a regular file")

    # The temp file lives in the workspace parent, which is not mounted into the
    # student container; os.replace then swaps the directory entry atomically.
    fd, tmp_name = tempfile.mkstemp(
        dir=str(ws_path.parent),
        prefix=f".{ws_path.name}.{name}.",
        suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.chmod(tmp_name, mode)
        os.replace(tmp_name, target)
    finally:
        try:
            os.unlink(tmp_name)
        except FileNotFoundError:
            pass


def prepare_workspace_files(ws_path: Path, code: str, meta: Dict[str, Any]) -> None:
    if ws_path.is_symlink():
        raise RuntimeError("workspace path is a symlink; refusing to write")
    ws_path.mkdir(parents=True, exist_ok=True)

    _write_regular_file(ws_path, "main.py", code, 0o644)
    _write_regular_file(ws_path, "meta.json", json.dumps(meta, ensure_ascii=False), 0o644)
    _write_regular_file(ws_path, ".pythonlab_plain_run.sh", PLAIN_RUN_SCRIPT, 0o755)
    _write_regular_file(ws_path, "sitecustomize.py", get_sitecustomize_content(), 0o644)
    try:
        os.chmod(ws_path, 0o755)
    except OSError:
        pass
