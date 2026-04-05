"""
系统管理 - Feature Flags 测试

覆盖场景：
1. FeatureFlagSchema 验证
2. feature_flags 路由注册检查
3. 公开端点不需要认证
4. 管理端点需要认证
"""

from app.api.endpoints.system.feature_flags import FeatureFlagSchema


def test_feature_flag_schema_basic():
    """FeatureFlagSchema 基本验证"""
    flag = FeatureFlagSchema(key="test_flag", value={"enabled": True})
    assert flag.key == "test_flag"
    assert flag.value == {"enabled": True}


def test_feature_flag_schema_string_value():
    """FeatureFlagSchema 支持字符串值"""
    flag = FeatureFlagSchema(key="version", value="1.0.0")
    assert flag.value == "1.0.0"


def test_feature_flag_schema_null_value():
    """FeatureFlagSchema 支持 None 值"""
    flag = FeatureFlagSchema(key="empty", value=None)
    assert flag.value is None


def test_feature_flag_schema_list_value():
    """FeatureFlagSchema 支持列表值"""
    flag = FeatureFlagSchema(key="items", value=[1, 2, 3])
    assert flag.value == [1, 2, 3]


def test_feature_flags_router_has_endpoints():
    """feature_flags 路由包含所有预期端点"""
    from app.api.endpoints.system.feature_flags import router

    paths = [route.path for route in router.routes if hasattr(route, "path")]
    assert "/system/feature-flags" in paths
    assert "/system/feature-flags/{key}" in paths
    assert "/system/public/feature-flags/{key}" in paths


def test_public_feature_flag_no_auth():
    """公开端点不需要认证"""
    from app.api.endpoints.system.feature_flags import router

    for route in router.routes:
        if not hasattr(route, "path"):
            continue
        if route.path == "/system/public/feature-flags/{key}":
            deps = [d.call for d in route.dependant.dependencies]  # type: ignore[union-attr]
            dep_names = [getattr(d, "__name__", str(d)) for d in deps]
            assert "require_admin" not in dep_names
            return
    assert False, "Public feature flag route not found"


def test_admin_feature_flags_require_auth():
    """管理端点需要管理员认证"""
    from app.api.endpoints.system.feature_flags import router

    admin_paths = {"/system/feature-flags", "/system/feature-flags/{key}"}
    for route in router.routes:
        if not hasattr(route, "path") or route.path not in admin_paths:
            continue
        methods = getattr(route, "methods", set())
        if "GET" not in methods and "POST" not in methods:
            continue
        deps = [d.call for d in route.dependant.dependencies]  # type: ignore[union-attr]
        dep_names = [getattr(d, "__name__", str(d)) for d in deps]
        assert "require_admin" in dep_names, f"{route.path} ({methods}) missing require_admin"
