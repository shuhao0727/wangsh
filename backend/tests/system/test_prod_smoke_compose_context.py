import importlib.util
from pathlib import Path
import stat
import sys


SCRIPT_PATH = Path(__file__).resolve().parents[3] / "scripts" / "prod-smoke" / "run.py"
SPEC = importlib.util.spec_from_file_location("prod_smoke_run", SCRIPT_PATH)
assert SPEC and SPEC.loader
prod_smoke = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = prod_smoke
SPEC.loader.exec_module(prod_smoke)

GROUP_SMOKE_PATH = (
    Path(__file__).resolve().parents[2] / "scripts" / "smoke_group_discussion.py"
)
GROUP_SMOKE_SPEC = importlib.util.spec_from_file_location(
    "smoke_group_discussion",
    GROUP_SMOKE_PATH,
)
assert GROUP_SMOKE_SPEC and GROUP_SMOKE_SPEC.loader
group_smoke = importlib.util.module_from_spec(GROUP_SMOKE_SPEC)
sys.modules[GROUP_SMOKE_SPEC.name] = group_smoke
GROUP_SMOKE_SPEC.loader.exec_module(group_smoke)

PHASEC_SOAK_PATH = (
    Path(__file__).resolve().parents[2] / "scripts" / "soak_pythonlab_phasec.py"
)
PHASEC_SOAK_SPEC = importlib.util.spec_from_file_location(
    "soak_pythonlab_phasec",
    PHASEC_SOAK_PATH,
)
assert PHASEC_SOAK_SPEC and PHASEC_SOAK_SPEC.loader
phasec_soak = importlib.util.module_from_spec(PHASEC_SOAK_SPEC)
sys.modules[PHASEC_SOAK_SPEC.name] = phasec_soak
PHASEC_SOAK_SPEC.loader.exec_module(phasec_soak)


def test_compose_command_preserves_isolated_project_and_paths_with_spaces():
    config = {
        "PROD_SMOKE_COMPOSE_PROJECT_NAME": "wangsh_sim",
        "PROD_SMOKE_COMPOSE_ENV_FILE": "/tmp/wangsh smoke/runtime.env",
        "PROD_SMOKE_COMPOSE_FILE": "/tmp/wangsh smoke/compose.yml",
    }

    assert prod_smoke.compose_command(config, "logs", "backend") == [
        "docker",
        "compose",
        "--project-name",
        "wangsh_sim",
        "--env-file",
        "/tmp/wangsh smoke/runtime.env",
        "-f",
        "/tmp/wangsh smoke/compose.yml",
        "logs",
        "backend",
    ]


def test_compose_command_keeps_default_production_behavior_without_overrides():
    assert prod_smoke.compose_command({}, "exec", "-T", "backend", "python") == [
        "docker",
        "compose",
        "exec",
        "-T",
        "backend",
        "python",
    ]


def test_redact_sensitive_output_removes_tokens_from_collected_logs():
    raw = (
        'uri="/api/v1/admin/stream?token=header.payload.signature&mode=live" '
        '"Authorization":["Bearer header.payload.signature"] '
        '"access_token":"access-secret" '
        '"refresh_token": "refresh-secret" '
        'password="two word secret" '
        'api_key: "two word key" '
        'client_secret="don\'t leak this" '
        "token=yes "
        "token: expected identifier"
    )

    redacted = prod_smoke.redact_sensitive_output(raw)

    assert "header.payload.signature" not in redacted
    assert "access-secret" not in redacted
    assert "refresh-secret" not in redacted
    assert "two word secret" not in redacted
    assert "two word key" not in redacted
    assert "don't leak this" not in redacted
    assert "?token=<redacted>&mode=live" in redacted
    assert '"Authorization":["Bearer <redacted>"]' in redacted
    assert '"access_token":"<redacted>"' in redacted
    assert '"refresh_token": "<redacted>"' in redacted
    assert 'password="<redacted>"' in redacted
    assert 'api_key: "<redacted>"' in redacted
    assert 'client_secret="<redacted>"' in redacted
    assert "token=yes" in redacted
    assert "token: expected identifier" in redacted


def test_redact_sensitive_output_handles_escaped_structures():
    raw = (
        r'{\"x-api-key\":\"escaped-api-key\",'
        r'\"Cookie\":\"session=escaped-cookie\"}'
    )

    redacted = prod_smoke.redact_sensitive_output(raw)

    assert "escaped-api-key" not in redacted
    assert "escaped-cookie" not in redacted
    assert r'\"x-api-key\":\"<redacted>\"' in redacted
    assert r'\"Cookie\":\"<redacted>\"' in redacted


def test_known_short_value_redaction_does_not_damage_normal_diagnostics():
    raw = "production mode; password=required; api_key=invalid; known=prod"

    redacted = prod_smoke.redact_sensitive_output(raw, ["prod"])

    assert "production mode" in redacted
    assert "password=required" in redacted
    assert "api_key=invalid" in redacted
    assert "known=<redacted>" in redacted


def test_child_environment_does_not_broadcast_unrelated_host_secrets():
    child_env = prod_smoke.build_child_env(
        {
            "PATH": "/usr/bin",
            "HOME": "/tmp/home",
            "LANG": "C.UTF-8",
            "NO_PROXY": "127.0.0.1",
            "OPENROUTER_API_KEY": "personal-openrouter-secret",
            "GITHUB_TOKEN": "personal-github-secret",
        }
    )

    assert child_env["PATH"] == "/usr/bin"
    assert child_env["HOME"] == "/tmp/home"
    assert child_env["LANG"] == "C.UTF-8"
    assert child_env["NO_PROXY"] == "127.0.0.1"
    assert "OPENROUTER_API_KEY" not in child_env
    assert "GITHUB_TOKEN" not in child_env


def test_group_discussion_admin_login_uses_only_the_injected_password(monkeypatch):
    attempted_passwords: list[str] = []

    def fake_login(_base_url, *, username, password, login_label):
        attempted_passwords.append(password)
        return 200, {"access_token": "synthetic-token"}

    monkeypatch.setattr(group_smoke, "_login_with_backoff", fake_login)

    token = group_smoke._admin_login(
        "http://localhost:8000/api/v1",
        username="admin",
        password="injected-password",
    )

    assert token == "synthetic-token"
    assert attempted_passwords == ["injected-password"]


def test_redact_sensitive_payload_cleans_nested_child_reports():
    payload = {
        "url": "wss://example.test/ws?session_token=nested-token",
        "diagnostics": [
            {"error": "Authorization: Bearer nested-bearer-secret"},
            {"status": "token=yes"},
        ],
        "count": 2,
    }

    redacted = prod_smoke.redact_sensitive_payload(payload)

    assert "nested-token" not in redacted["url"]
    assert "nested-bearer-secret" not in redacted["diagnostics"][0]["error"]
    assert redacted["diagnostics"][1]["status"] == "token=yes"
    assert redacted["count"] == 2


def test_write_json_uses_private_file_permissions(tmp_path):
    path = tmp_path / "private.json"

    prod_smoke.write_json(path, {"status": "PASS"})

    assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_phasec_soak_redacts_each_round_log_before_writing():
    redacted = phasec_soak.redact_for_log(
        "WebSocket failed: wss://example.test/ws?token=phasec-secret\n"
    )

    assert "phasec-secret" not in redacted
    assert "token=<redacted>" in redacted
