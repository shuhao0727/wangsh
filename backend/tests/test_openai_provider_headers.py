from app.services.agents.providers.openai_provider import OpenAIProvider


def test_openrouter_headers_include_referer_and_title():
    provider = OpenAIProvider(
        "https://openrouter.ai/api/v1",
        "sk-or-test",
        is_openrouter=True,
    )

    headers = provider.build_headers()

    assert headers["Authorization"] == "Bearer sk-or-test"
    assert headers["HTTP-Referer"] == "https://github.com/wangsh"
    assert headers["X-Title"] == "WangSh AI"


def test_non_openrouter_headers_only_authorization():
    provider = OpenAIProvider(
        "https://api.openai.com/v1",
        "sk-test",
        is_openrouter=False,
    )

    headers = provider.build_headers()

    assert headers == {"Authorization": "Bearer sk-test"}
