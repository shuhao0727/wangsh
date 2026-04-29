from app.schemas.agents import UsageFilterOptions


def test_usage_filter_options_accepts_only_filter_lists():
    options = UsageFilterOptions(
        class_names=["21"],
        grades=["2026"],
        agent_names=["minmax"],
    )

    assert options.class_names == ["21"]
    assert options.grades == ["2026"]
    assert options.agent_names == ["minmax"]
