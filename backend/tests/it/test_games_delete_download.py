import asyncio
import os

import pytest

from app.models.it.game import GameDownloadLog, GameResource
from app.services.it import games


class FakeSession:
    def __init__(self, game, *, commit_error: Exception | None = None):
        self.game = game
        self.commit_error = commit_error
        self.added = []
        self.deleted = []
        self.rollback_calls = 0
        self.executed = []

    async def get(self, _model, _id):
        return self.game

    async def execute(self, query):
        self.executed.append(query)

        class Result:
            def scalar_one_or_none(inner_self):
                return self.game

        return Result()

    def add(self, value):
        self.added.append(value)

    async def delete(self, value):
        self.deleted.append(value)

    async def commit(self):
        if self.commit_error:
            raise self.commit_error

    async def rollback(self):
        self.rollback_calls += 1


def _game(game_id: int, stored_path: str, *, count: int = 0):
    return GameResource(
        id=game_id,
        title="Game",
        category="tool",
        filename="game.zip",
        stored_path=stored_path,
        file_size=10,
        file_mime="application/zip",
        download_count=count,
        is_active=True,
    )


def test_resolver_rejects_path_traversal_that_targets_another_game_file(tmp_path):
    games.GAMES_UPLOAD_DIR = tmp_path
    other_game = tmp_path / "8_other.zip"
    other_game.write_bytes(b"data")
    game = _game(7, "../../8_other.zip")

    assert games.resolve_game_file_path(game) is None
    assert other_game.exists()


def test_resolver_rejects_symlink_that_targets_another_game_file(tmp_path):
    games.GAMES_UPLOAD_DIR = tmp_path
    other_game = tmp_path / "8_other.zip"
    other_game.write_bytes(b"data")
    alias = tmp_path / "7_alias.zip"
    alias.symlink_to(other_game.name)
    game = _game(7, alias.name)

    assert games.resolve_game_file_path(game) is None
    assert other_game.read_bytes() == b"data"


def test_delete_never_removes_database_supplied_path_outside_upload_dir(tmp_path):
    games.GAMES_UPLOAD_DIR = tmp_path / "games"
    games.GAMES_UPLOAD_DIR.mkdir()
    outside = tmp_path / "7_outside.zip"
    outside.write_bytes(b"do not delete")
    game = _game(7, str(outside))
    db = FakeSession(game)

    assert asyncio.run(games.delete_game(db, 7)) is True

    assert outside.read_bytes() == b"do not delete"
    assert db.deleted == [game]


def test_delete_commit_failure_restores_quarantined_file(tmp_path):
    games.GAMES_UPLOAD_DIR = tmp_path
    stored = tmp_path / "7_game.zip"
    stored.write_bytes(b"game")
    game = _game(7, str(stored))
    db = FakeSession(game, commit_error=RuntimeError("commit failed"))

    with pytest.raises(RuntimeError, match="commit failed"):
        asyncio.run(games.delete_game(db, 7))

    assert stored.read_bytes() == b"game"
    assert db.rollback_calls == 1
    assert list(tmp_path.iterdir()) == [stored]


def test_delete_uses_portable_unique_quarantine_names_for_max_length_files(
    monkeypatch,
    tmp_path,
):
    games.GAMES_UPLOAD_DIR = tmp_path
    original_replace = os.replace
    quarantine_paths = []

    def track_replace(source, destination):
        quarantine_paths.append(destination)
        return original_replace(source, destination)

    monkeypatch.setattr(games.os, "replace", track_replace)

    for game_id in (7, 8):
        prefix = f"{game_id}_"
        suffix = ".zip"
        stored_name = (
            prefix
            + ("a" * (games.MAX_GAME_FILENAME_BYTES - len(prefix) - len(suffix)))
            + suffix
        )
        stored = tmp_path / stored_name
        stored.write_bytes(b"game")
        game = _game(game_id, str(stored))

        assert asyncio.run(games.delete_game(FakeSession(game), game_id)) is True

    quarantine_names = [path.name for path in quarantine_paths]
    assert len(quarantine_names) == 2
    assert len(set(quarantine_names)) == 2
    assert all(len(name.encode("utf-8")) <= 255 for name in quarantine_names)
    assert list(tmp_path.iterdir()) == []


def test_record_download_persists_log_and_truncates_user_agent():
    game = _game(7, "7_game.zip", count=4)
    db = FakeSession(game)

    result = asyncio.run(
        games.record_download(
            db,
            game_id=7,
            user_id=3,
            ip_address="127.0.0.1",
            user_agent="x" * 600,
        )
    )

    assert result is game
    assert db.executed
    assert game.download_count == 5
    assert len(db.added) == 1
    log = db.added[0]
    assert isinstance(log, GameDownloadLog)
    assert log.game_id == 7
    assert log.user_id == 3
    assert log.ip_address == "127.0.0.1"
    assert log.user_agent == "x" * 500


def test_record_download_commit_failure_rolls_back_counter_and_transaction():
    game = _game(7, "7_game.zip", count=4)
    db = FakeSession(game, commit_error=RuntimeError("commit failed"))

    with pytest.raises(RuntimeError, match="commit failed"):
        asyncio.run(
            games.record_download(
                db,
                game_id=7,
                user_id=3,
                ip_address="127.0.0.1",
            )
        )

    assert game.download_count == 4
    assert db.rollback_calls == 1
