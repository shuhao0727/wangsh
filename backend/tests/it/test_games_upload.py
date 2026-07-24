import asyncio
import hashlib
import io
import os
import struct
import zipfile

import pytest

from app.core.config import Settings
from app.models.it.game import GameResource
from app.services.it import games


class FakeUpload:
    def __init__(self, filename: str, content: bytes, *, on_read=None):
        self.filename = filename
        self.content_type = "application/octet-stream"
        self._chunks = [content[index:index + 17] for index in range(0, len(content), 17)]
        self._index = 0
        self.read_sizes = []
        self.on_read = on_read

    async def read(self, size: int = -1) -> bytes:
        self.read_sizes.append(size)
        if self.on_read:
            self.on_read(self._index)
        if self._index >= len(self._chunks):
            return b""
        chunk = self._chunks[self._index]
        self._index += 1
        return chunk


class FakeSession:
    def __init__(
        self,
        *,
        game_id: int = 7,
        commit_error: Exception | None = None,
        refresh_error: Exception | None = None,
    ):
        self.game_id = game_id
        self.commit_error = commit_error
        self.refresh_error = refresh_error
        self.added = []
        self.flush_calls = 0
        self.commit_calls = 0
        self.refresh_calls = 0
        self.rollback_calls = 0

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        self.flush_calls += 1
        for value in self.added:
            if isinstance(value, GameResource) and value.id is None:
                value.id = self.game_id

    async def commit(self):
        self.commit_calls += 1
        if self.commit_error:
            raise self.commit_error

    async def refresh(self, _value):
        self.refresh_calls += 1
        if self.refresh_error:
            raise self.refresh_error

    async def rollback(self):
        self.rollback_calls += 1


def _zip_bytes(*names: str) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in names:
            archive.writestr(name, b"content")
    return buffer.getvalue()


def _pe_bytes() -> bytes:
    content = bytearray(128)
    content[:2] = b"MZ"
    struct.pack_into("<I", content, 0x3C, 0x50)
    content[0x50:0x54] = b"PE\0\0"
    return bytes(content)


def _iso_bytes() -> bytes:
    content = bytearray(0x8001 + 5)
    content[0x8001:0x8006] = b"CD001"
    return bytes(content)


def _dmg_bytes() -> bytes:
    content = bytearray(1024)
    content[-512:-508] = b"koly"
    return bytes(content)


def _create(tmp_path, filename: str, content: bytes, *, db=None, title="Game"):
    games.GAMES_UPLOAD_DIR = tmp_path
    session = db or FakeSession()
    upload = FakeUpload(filename, content)
    game = asyncio.run(
        games.create_game(
            session,
            title=title,
            description=None,
            category="tool",
            file=upload,
            uploaded_by=3,
        )
    )
    return game, session, upload


def test_create_game_facade_persists_metadata_and_commits(tmp_path):
    content = _zip_bytes("game.txt")

    game, session, _upload = _create(
        tmp_path,
        "lesson.zip",
        content,
        title="Lesson Game",
    )

    assert session.added == [game]
    assert session.flush_calls == 2
    assert session.commit_calls == 1
    assert session.refresh_calls == 1
    assert session.rollback_calls == 0
    assert game.title == "Lesson Game"
    assert game.filename == "lesson.zip"
    assert game.stored_path == str(tmp_path / "7_lesson_game.zip")
    assert game.file_size == len(content)
    assert game.file_sha256 == hashlib.sha256(content).hexdigest()


def test_game_upload_limit_defaults_to_500mb_and_can_be_lowered(monkeypatch, tmp_path):
    configured = Settings(
        DEBUG=True,
        IT_GAME_MAX_UPLOAD_BYTES=64,
    )
    assert configured.IT_GAME_MAX_UPLOAD_BYTES == 64
    assert Settings(DEBUG=True).IT_GAME_MAX_UPLOAD_BYTES == 500 * 1024 * 1024

    assert hasattr(games.settings, "IT_GAME_MAX_UPLOAD_BYTES")
    monkeypatch.setattr(games.settings, "IT_GAME_MAX_UPLOAD_BYTES", 64)
    games.GAMES_UPLOAD_DIR = tmp_path
    db = FakeSession()

    with pytest.raises(ValueError, match="文件过大"):
        asyncio.run(
            games.create_game(
                db,
                title="Too large",
                description=None,
                category="tool",
                file=FakeUpload("large.zip", _zip_bytes("payload.bin")),
                uploaded_by=3,
            )
        )

    assert db.rollback_calls == 1
    assert list(tmp_path.iterdir()) == []


def test_upload_writes_each_chunk_to_a_temporary_file_before_reading_next(tmp_path):
    games.GAMES_UPLOAD_DIR = tmp_path
    content = _zip_bytes("game.txt")
    observed_partial_sizes = []

    def observe(read_index: int):
        if read_index < 1:
            return
        files = list(tmp_path.iterdir())
        if files:
            observed_partial_sizes.append(max(path.stat().st_size for path in files))

    upload = FakeUpload("game.zip", content, on_read=observe)
    db = FakeSession()
    game = asyncio.run(
        games.create_game(
            db,
            title="Streamed",
            description=None,
            category="tool",
            file=upload,
            uploaded_by=3,
        )
    )

    assert observed_partial_sizes
    assert observed_partial_sizes[0] == len(upload._chunks[0])
    assert all(size == games.UPLOAD_CHUNK_SIZE for size in upload.read_sizes)
    assert game.file_size == len(content)


def test_upload_hash_is_incremental_and_file_is_atomically_renamed(monkeypatch, tmp_path):
    games.GAMES_UPLOAD_DIR = tmp_path
    content = _zip_bytes("game.txt")
    replace_calls = []
    original_replace = os.replace

    def tracked_replace(source, destination):
        replace_calls.append((source, destination))
        return original_replace(source, destination)

    monkeypatch.setattr(games.os, "replace", tracked_replace)
    if hasattr(games, "_compute_sha256"):
        monkeypatch.setattr(
            games,
            "_compute_sha256",
            lambda _path: (_ for _ in ()).throw(AssertionError("hash must not reread the file")),
        )

    game, _, _ = _create(tmp_path, "game.zip", content)

    final_path = tmp_path / "7_game.zip"
    assert replace_calls
    assert final_path.read_bytes() == content
    assert game.file_sha256 == hashlib.sha256(content).hexdigest()
    assert [path for path in tmp_path.iterdir() if path != final_path] == []


@pytest.mark.parametrize(
    ("filename", "content"),
    [
        ("game.zip", _zip_bytes("game.txt")),
        ("game.apk", _zip_bytes("AndroidManifest.xml", "classes.dex")),
        ("game.exe", _pe_bytes()),
        ("game.msi", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\0" * 64),
        ("game.7z", b"7z\xbc\xaf'\x1c" + b"\0" * 32),
        ("game.rar", b"Rar!\x1a\x07\x01\x00" + b"\0" * 32),
        ("game.iso", _iso_bytes()),
        ("game.dmg", _dmg_bytes()),
        ("game.pkg", b"xar!" + b"\0" * 32),
    ],
)
def test_supported_formats_accept_their_real_signatures(tmp_path, filename, content):
    game, _, _ = _create(tmp_path, filename, content)
    assert game.filename == filename


@pytest.mark.parametrize(
    ("filename", "content"),
    [
        ("fake.zip", b"not-a-zip"),
        ("fake.apk", _zip_bytes("readme.txt")),
        ("fake.exe", b"MZ" + b"\0" * 126),
        ("fake.msi", b"PK\x03\x04" + b"\0" * 32),
        ("fake.7z", b"Rar!\x1a\x07\x00"),
        ("fake.rar", b"7z\xbc\xaf'\x1c"),
        ("fake.iso", b"CD001" + b"\0" * 64),
        ("fake.dmg", b"x\x00" + b"\0" * 1022),
        ("fake.pkg", b"x\x00" + b"\0" * 64),
    ],
)
def test_spoofed_or_structurally_invalid_formats_are_rejected_and_cleaned(
    tmp_path,
    filename,
    content,
):
    games.GAMES_UPLOAD_DIR = tmp_path
    db = FakeSession()

    with pytest.raises(ValueError, match="签名|格式|扩展名"):
        asyncio.run(
            games.create_game(
                db,
                title="Fake",
                description=None,
                category="tool",
                file=FakeUpload(filename, content),
                uploaded_by=3,
            )
        )

    assert db.rollback_calls == 1
    assert list(tmp_path.iterdir()) == []


def test_commit_failure_rolls_back_and_removes_renamed_file(tmp_path):
    games.GAMES_UPLOAD_DIR = tmp_path
    db = FakeSession(commit_error=RuntimeError("database unavailable"))

    with pytest.raises(RuntimeError, match="database unavailable"):
        asyncio.run(
            games.create_game(
                db,
                title="Game",
                description=None,
                category="tool",
                file=FakeUpload("game.zip", _zip_bytes("game.txt")),
                uploaded_by=3,
            )
        )

    assert db.rollback_calls == 1
    assert list(tmp_path.iterdir()) == []


def test_refresh_failure_after_commit_preserves_the_committed_upload(tmp_path):
    games.GAMES_UPLOAD_DIR = tmp_path
    db = FakeSession(refresh_error=RuntimeError("refresh failed"))
    content = _zip_bytes("game.txt")
    expected_path = tmp_path / "7_game.zip"

    with pytest.raises(RuntimeError, match="refresh failed"):
        asyncio.run(
            games.create_game(
                db,
                title="Game",
                description=None,
                category="tool",
                file=FakeUpload("game.zip", content),
                uploaded_by=3,
            )
        )

    assert db.flush_calls == 2
    assert db.refresh_calls == 1
    assert db.commit_calls == 1
    assert db.rollback_calls == 0
    assert expected_path.read_bytes() == content


def test_atomic_rename_failure_rolls_back_and_cleans_temp_file(monkeypatch, tmp_path):
    games.GAMES_UPLOAD_DIR = tmp_path
    db = FakeSession()
    monkeypatch.setattr(
        games.os,
        "replace",
        lambda *_args: (_ for _ in ()).throw(OSError("disk full")),
    )

    with pytest.raises(OSError, match="disk full"):
        asyncio.run(
            games.create_game(
                db,
                title="Game",
                description=None,
                category="tool",
                file=FakeUpload("game.zip", _zip_bytes("game.txt")),
                uploaded_by=3,
            )
        )

    assert db.rollback_calls == 1
    assert list(tmp_path.iterdir()) == []


def test_long_multibyte_title_produces_a_portable_filename(tmp_path):
    game, _, _ = _create(
        tmp_path,
        "game.zip",
        _zip_bytes("game.txt"),
        title="超长中文游戏标题" * 30,
    )

    stored_name = os.path.basename(game.stored_path)
    assert len(stored_name.encode("utf-8")) <= games.MAX_GAME_FILENAME_BYTES
    assert (tmp_path / stored_name).is_file()
