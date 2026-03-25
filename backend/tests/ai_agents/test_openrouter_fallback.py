from app.services.agents.providers.common import (
    openrouter_fallback_model,
    openrouter_free_model,
    openrouter_model_candidates,
    should_retry_openrouter_fallback,
)


def test_openrouter_fallback_model_strips_free_suffix():
    assert openrouter_fallback_model("minimax/minimax-m2.5:free") == "minimax/minimax-m2.5"
    assert openrouter_fallback_model("openai/gpt-4o-mini:free") == "openai/gpt-4o-mini"


def test_openrouter_fallback_model_non_free_returns_none():
    assert openrouter_fallback_model("minimax/minimax-m2.5") is None
    assert openrouter_fallback_model("") is None


def test_openrouter_free_model_appends_suffix():
    assert openrouter_free_model("minimax/minimax-m2.5") == "minimax/minimax-m2.5:free"
    assert openrouter_free_model("openai/gpt-4o-mini") == "openai/gpt-4o-mini:free"
    assert openrouter_free_model("openai/gpt-4o-mini:free") is None


def test_openrouter_model_candidates_bidirectional():
    assert openrouter_model_candidates("minimax/minimax-m2.5:free") == [
        "minimax/minimax-m2.5:free",
        "minimax/minimax-m2.5",
    ]
    assert openrouter_model_candidates("minimax/minimax-m2.5") == [
        "minimax/minimax-m2.5",
        "minimax/minimax-m2.5:free",
    ]


def test_should_retry_openrouter_fallback_for_free_model():
    assert should_retry_openrouter_fallback(
        404,
        "No endpoints available",
        "minimax/minimax-m2.5:free",
        "minimax/minimax-m2.5",
    )
    assert should_retry_openrouter_fallback(
        429,
        "rate limit",
        "minimax/minimax-m2.5:free",
        "minimax/minimax-m2.5",
    )
    assert should_retry_openrouter_fallback(
        503,
        "service unavailable",
        "minimax/minimax-m2.5:free",
        "minimax/minimax-m2.5",
    )


def test_should_retry_openrouter_fallback_for_non_free_model_to_free_alias():
    assert should_retry_openrouter_fallback(
        404,
        "Model not found",
        "minimax/minimax-m2.5",
        "minimax/minimax-m2.5:free",
    )
    assert should_retry_openrouter_fallback(
        503,
        "service unavailable",
        "minimax/minimax-m2.5",
        "minimax/minimax-m2.5:free",
    )


def test_should_not_retry_openrouter_fallback_for_auth_errors():
    assert not should_retry_openrouter_fallback(
        401,
        "invalid key",
        "minimax/minimax-m2.5:free",
        "minimax/minimax-m2.5",
    )
    assert not should_retry_openrouter_fallback(
        403,
        "forbidden",
        "minimax/minimax-m2.5",
        "minimax/minimax-m2.5:free",
    )


def test_should_not_retry_openrouter_fallback_for_unrelated_404_detail():
    assert not should_retry_openrouter_fallback(
        404,
        "route /api/v1/chat/completions not found",
        "minimax/minimax-m2.5",
        "minimax/minimax-m2.5:free",
    )
