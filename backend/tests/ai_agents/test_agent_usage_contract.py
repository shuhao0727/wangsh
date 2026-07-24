from pydantic import TypeAdapter

from app.api.endpoints.agents.ai_agents import usage as usage_api


def test_usage_list_response_preserves_pagination_fields():
    route = next(route for route in usage_api.router.routes if route.path == "/usage")
    adapter = TypeAdapter(route.response_model)
    payload = {
        "items": [],
        "total": 41,
        "page": 2,
        "page_size": 20,
        "total_pages": 3,
    }

    validated = adapter.validate_python(payload)
    serialized = adapter.dump_python(validated, mode="json")

    assert serialized["page"] == 2
    assert serialized["page_size"] == 20
    assert serialized["total_pages"] == 3
