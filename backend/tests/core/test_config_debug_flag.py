from app.core.config import Settings


def test_debug_accepts_release_alias() -> None:
    settings = Settings(
        DEBUG="release",
        SECRET_KEY="x" * 32,
        POSTGRES_PASSWORD="postgres",
        SUPER_ADMIN_PASSWORD="admin-password",
        AGENT_API_KEY_ENCRYPTION_KEY="k" * 32,
    )

    assert settings.DEBUG is False


def test_debug_accepts_development_alias() -> None:
    settings = Settings(DEBUG="development")

    assert settings.DEBUG is True
