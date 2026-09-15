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


def _dependency_calls(dependant):
    for dependency in dependant.dependencies:
        if dependency.call is not None:
            yield dependency.call
        yield from _dependency_calls(dependency)


def test_every_ai_agent_route_has_server_side_authentication():
    from app.core.deps import get_current_user, get_current_user_sse

    unauthenticated = []
    for route in router.routes:
        dependant = getattr(route, "dependant", None)
        if dependant is None:
            continue
        calls = set(_dependency_calls(dependant))
        if get_current_user not in calls and get_current_user_sse not in calls:
            unauthenticated.append((sorted(route.methods), route.path))

    assert unauthenticated == []
