"""Load only the field mixin; never import app settings, dotenv files or a database."""

import importlib.util
import os
from pathlib import Path

from pydantic import BaseModel, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict
import pytest


_spec = importlib.util.spec_from_file_location(
    "services_settings_fields_under_test",
    Path(__file__).resolve().parents[2] / "app/core/config/_services.py",
)
_services = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_services)


class ServicesFields(_services.ServicesSettingsMixin, BaseModel):
    pass


class ServicesEnvironment(_services.ServicesSettingsMixin, BaseSettings):
    model_config = SettingsConfigDict(env_file=None, secrets_dir=None)


def test_unset_scoring_agent_is_none():
    assert ServicesFields().AI_PARTNER_SCORING_AGENT_ID is None


@pytest.mark.parametrize("value", [None, "", " ", "\t\r\n", " \u3000 "])
def test_blank_optional_scoring_agent_is_unconfigured(value):
    assert ServicesFields(AI_PARTNER_SCORING_AGENT_ID=value).AI_PARTNER_SCORING_AGENT_ID is None


@pytest.mark.parametrize("value,expected", [(1, 1), (42, 42), ("1", 1), (" 42 ", 42)])
def test_positive_scoring_agent_id_remains_supported(value, expected):
    assert ServicesFields(AI_PARTNER_SCORING_AGENT_ID=value).AI_PARTNER_SCORING_AGENT_ID == expected


@pytest.mark.parametrize("value", [0, -1, "0", "-1", "abc", "1.5", "None", "null", [], {}])
def test_nonempty_invalid_scoring_agent_still_fails(value):
    with pytest.raises(ValidationError):
        ServicesFields(AI_PARTNER_SCORING_AGENT_ID=value)


@pytest.mark.parametrize("value,expected", [("", None), (" \t ", None), ("37", 37)])
def test_environment_value_uses_field_validation_without_dotenv(monkeypatch, value, expected):
    monkeypatch.setattr(os, "environ", {"AI_PARTNER_SCORING_AGENT_ID": value})
    settings = ServicesEnvironment(_env_file=None, _secrets_dir=None)
    assert settings.AI_PARTNER_SCORING_AGENT_ID == expected


@pytest.mark.parametrize("field", ["AI_PARTNER_LEADERBOARD_DURATION_SECONDS", "DIFY_MAX_CONCURRENCY"])
def test_empty_strings_are_not_globally_ignored(monkeypatch, field):
    monkeypatch.setattr(os, "environ", {field: ""})
    with pytest.raises(ValidationError):
        ServicesEnvironment(_env_file=None, _secrets_dir=None)
