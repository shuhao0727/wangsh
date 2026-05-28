from collections import Counter

from app.api.endpoints.agents.ai_agents import router


def test_ai_agents_routes_are_not_registered_twice():
    registered_routes = [
        (sorted(route.methods), route.path)
        for route in router.routes
        if hasattr(route, "methods")
    ]

    duplicate_routes = [
        route
        for route, count in Counter((tuple(methods), path) for methods, path in registered_routes).items()
        if count > 1
    ]

    assert duplicate_routes == []
