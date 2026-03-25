import pytest

from app.api.endpoints.debug.ws import _normalize_client_conn_id


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("abc", "abc"),
        ("A_B-1.2", "A_B-1.2"),
        ("  abc_123  ", "abc_123"),
        ("x" * 64, "x" * 64),
        ("x" * 80, "x" * 64),
        (None, None),
        ("", None),
        ("   ", None),
        ("中文", None),
        ("a b", None),
        ("a/b", None),
        ("a?b", None),
        ("a&b", None),
    ],
)
def test_normalize_client_conn_id(raw, expected):
    assert _normalize_client_conn_id(raw) == expected
