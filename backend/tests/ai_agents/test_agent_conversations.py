from datetime import datetime, timezone

from pydantic import TypeAdapter

from app.api.endpoints.agents.ai_agents import conversations as conversations_api
from app.schemas.agents import (
    ConversationMessage,
    ConversationSummary,
    UsageFilterOptions,
)
from app.schemas.agents import ai_agent as legacy_agent_schemas


def _response_adapter(path: str) -> TypeAdapter:
    route = next(route for route in conversations_api.router.routes if route.path == path)
    return TypeAdapter(route.response_model)


def test_legacy_agent_schema_imports_use_canonical_conversation_models():
    assert legacy_agent_schemas.ConversationSummary is ConversationSummary
    assert legacy_agent_schemas.ConversationMessage is ConversationMessage
    assert legacy_agent_schemas.UsageFilterOptions is UsageFilterOptions


def test_conversation_list_response_matches_service_payload():
    adapter = _response_adapter("/conversations")
    payload = [
        {
            "session_id": "session-1",
            "agent_id": 7,
            "display_agent_name": "课堂助手",
            "display_user_name": "学生甲",
            "last_at": datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc),
            "turns": 3,
            "preview": "如何理解递归？",
        }
    ]

    validated = adapter.validate_python(payload)
    serialized = adapter.dump_python(validated, mode="json")

    assert serialized[0]["session_id"] == "session-1"
    assert serialized[0]["agent_id"] == 7
    assert serialized[0]["display_agent_name"] == "课堂助手"
    assert serialized[0]["display_user_name"] == "学生甲"
    assert serialized[0]["turns"] == 3
    assert serialized[0]["preview"] == "如何理解递归？"


def test_conversation_message_response_preserves_service_fields():
    adapter = _response_adapter("/conversations/{session_id}")
    payload = [
        {
            "id": 11,
            "session_id": "session-1",
            "user_id": 23,
            "agent_id": 7,
            "display_user_name": "学生甲",
            "display_agent_name": "课堂助手",
            "message_type": "question",
            "content": "如何理解递归？",
            "response_time_ms": 125,
            "created_at": datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc),
        }
    ]

    validated = adapter.validate_python(payload)
    serialized = adapter.dump_python(validated, mode="json")

    assert serialized[0]["session_id"] == "session-1"
    assert serialized[0]["user_id"] == 23
    assert serialized[0]["agent_id"] == 7
    assert serialized[0]["display_user_name"] == "学生甲"
    assert serialized[0]["display_agent_name"] == "课堂助手"
    assert serialized[0]["response_time_ms"] == 125
