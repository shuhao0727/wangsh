from app.api.endpoints.content.categories.categories import router


def test_static_category_routes_are_registered_before_dynamic_id_route():
    paths = [route.path for route in router.routes]

    search_index = paths.index("/search")
    popular_index = paths.index("/popular")
    dynamic_index = paths.index("/{category_id}")

    assert search_index < dynamic_index
    assert popular_index < dynamic_index
