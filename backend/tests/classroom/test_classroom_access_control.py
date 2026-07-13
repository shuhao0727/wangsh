"""课堂对象级权限与学生班级隔离回归测试。"""

import asyncio
import inspect
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.endpoints.classroom import admin as admin_api
from app.api.endpoints.classroom import plan as plan_api
from app.api.endpoints.classroom import student as student_api
from app.core.deps import require_student
from app.schemas.classroom import ResponseSubmit
from app.services import classroom_plan as plan_svc


class _FakeResult:
    def __init__(self, values=None):
        self._values = values or []

    def scalars(self):
        return self

    def all(self):
        return self._values


class _FakeDB:
    def __init__(self, values=None):
        self._values = values or []

    async def execute(self, _stmt):
        return _FakeResult(self._values)


def _activity(activity_id, class_name, created_by=10, correct_answer="A"):
    return SimpleNamespace(
        id=activity_id,
        title=f"活动 {activity_id}",
        activity_type="vote",
        class_name=class_name,
        description=None,
        time_limit=60,
        status="active",
        started_at=None,
        options=[{"key": "A", "text": "选项 A"}],
        correct_answer=correct_answer,
        allow_multiple=False,
        created_by=created_by,
    )


def _plan(plan_id, class_names, created_by=10):
    items = [
        SimpleNamespace(
            id=plan_id * 100 + index,
            activity_id=plan_id * 10 + index,
            order_index=index,
            status="pending",
            activity=_activity(plan_id * 10 + index, class_name, created_by=created_by),
        )
        for index, class_name in enumerate(class_names)
    ]
    return SimpleNamespace(
        id=plan_id,
        title=f"计划 {plan_id}",
        status="active",
        current_item_id=None,
        created_by=created_by,
        created_at=None,
        items=items,
    )


def _depends_on(endpoint, dependency):
    parameter = inspect.signature(endpoint).parameters["current_user"]
    return parameter.default.dependency is dependency


@pytest.mark.parametrize(
    "endpoint",
    [
        student_api.get_active_activities,
        student_api.student_stream,
        student_api.get_activity,
        student_api.submit_response,
        student_api.get_result,
        plan_api.get_active_plan,
    ],
)
def test_student_classroom_endpoints_require_student(endpoint):
    assert _depends_on(endpoint, require_student)


@pytest.mark.parametrize(
    ("student_class", "activity_class"),
    [
        ("高一(1)班", "高一(2)班"),
        ("高一(1)班", None),
        (None, "高一(1)班"),
        (None, None),
    ],
)
def test_student_activity_access_rejects_cross_class_and_null_class(
    student_class,
    activity_class,
):
    activity = _activity(1, activity_class)
    user = {"id": 100, "role_code": "student", "class_name": student_class}

    with pytest.raises(HTTPException) as exc_info:
        student_api._assert_student_activity_access(activity, user)

    assert exc_info.value.status_code == 403


def test_student_activity_access_allows_exact_non_null_class_match():
    activity = _activity(1, "高一(1)班")
    user = {"id": 100, "role_code": "student", "class_name": "高一(1)班"}

    student_api._assert_student_activity_access(activity, user)


def test_student_activity_access_normalizes_class_name_whitespace():
    activity = _activity(1, " 高一(1)班 ")
    user = {"id": 100, "role_code": "student", "class_name": "高一(1)班"}

    student_api._assert_student_activity_access(activity, user)


def test_classroom_stream_channels_are_normalized_and_role_scoped():
    assert student_api._student_stream_channel(
        {"id": 100, "role_code": "student", "class_name": " 高一(1)班 "}
    ) == "student_高一(1)班"
    assert admin_api._admin_stream_channel(
        {"id": 10, "role_code": "teacher"}
    ) == "admin_10"
    assert admin_api._admin_stream_channel(
        {"id": 20, "role_code": "admin"}
    ) == "admin_global"


def test_admin_stream_static_route_precedes_activity_id_route():
    paths = [route.path for route in admin_api.router.routes]

    assert paths.index("/stream") < paths.index("/{activity_id}")


@pytest.mark.parametrize(
    ("endpoint", "extra_args"),
    [
        (student_api.get_activity, ()),
        (student_api.submit_response, (ResponseSubmit(answer="A"),)),
        (student_api.get_result, ()),
    ],
)
def test_student_detail_respond_and_result_reject_cross_class_before_data_access(
    monkeypatch,
    endpoint,
    extra_args,
):
    calls = {"user_response": 0, "submit": 0, "statistics": 0}

    async def fake_get_activity(_db, _activity_id):
        return _activity(1, "高一(2)班")

    async def fake_user_response(*_args, **_kwargs):
        calls["user_response"] += 1

    async def fake_submit(*_args, **_kwargs):
        calls["submit"] += 1

    async def fake_statistics(*_args, **_kwargs):
        calls["statistics"] += 1

    monkeypatch.setattr(student_api.svc, "get_activity", fake_get_activity)
    monkeypatch.setattr(student_api.svc, "get_user_response", fake_user_response)
    monkeypatch.setattr(student_api.svc, "submit_response", fake_submit)
    monkeypatch.setattr(student_api.svc, "get_statistics", fake_statistics)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            endpoint(
                1,
                *extra_args,
                db=object(),
                current_user={
                    "id": 100,
                    "role_code": "student",
                    "class_name": "高一(1)班",
                },
            )
        )

    assert exc_info.value.status_code == 403
    assert calls == {"user_response": 0, "submit": 0, "statistics": 0}


def test_active_plan_is_selected_by_exact_student_class():
    foreign_plan = _plan(1, ["高一(2)班"])
    matching_plan = _plan(2, ["高一(1)班", "高一(1)班"])
    db = _FakeDB([foreign_plan, matching_plan])

    result = asyncio.run(plan_svc.get_active_plan(db, class_name="高一(1)班"))

    assert result is matching_plan


@pytest.mark.parametrize("class_names", [[None], ["高一(1)班", None], ["高一(1)班", "高一(2)班"]])
def test_active_plan_rejects_null_or_mixed_class_items(class_names):
    db = _FakeDB([_plan(1, class_names)])

    result = asyncio.run(plan_svc.get_active_plan(db, class_name="高一(1)班"))

    assert result is None


def test_active_plan_returns_none_for_student_without_class():
    db = _FakeDB([_plan(1, ["高一(1)班"])])

    result = asyncio.run(plan_svc.get_active_plan(db, class_name=None))

    assert result is None


def test_plan_service_rejects_missing_actor_identity():
    plan = _plan(1, ["高一(1)班"])

    with pytest.raises(
        plan_svc.ClassroomPlanPermissionError,
        match="缺少操作者身份",
    ):
        plan_svc._assert_plan_manageable(
            plan,
            owner_id=None,
            is_global_manager=False,
        )


def test_student_active_plan_never_contains_correct_answer():
    payload = plan_api._format_plan(_plan(1, ["高一(1)班"]), include_correct_answer=False)

    assert payload["items"]
    assert all("correct_answer" not in item["activity"] for item in payload["items"])


@pytest.mark.parametrize("endpoint", [student_api.get_activity, student_api.get_result])
def test_student_ended_activity_payload_never_contains_correct_answer(monkeypatch, endpoint):
    activity = _activity(1, "高一(1)班")
    activity.status = "ended"

    async def fake_get_activity(_db, _activity_id):
        return activity

    async def fake_user_response(*_args, **_kwargs):
        return SimpleNamespace(answer="A", is_correct=True)

    async def fake_statistics(*_args, **kwargs):
        assert kwargs.get("include_correct_answers") is False
        return {
            "blank_slot_stats": [{"correct_answer": "secret"}],
            "correct_rate": 100.0,
        }

    monkeypatch.setattr(student_api.svc, "get_activity", fake_get_activity)
    monkeypatch.setattr(student_api.svc, "get_user_response", fake_user_response)
    monkeypatch.setattr(student_api.svc, "get_statistics", fake_statistics)

    result = asyncio.run(
        endpoint(
            1,
            db=object(),
            current_user={
                "id": 100,
                "role_code": "student",
                "class_name": "高一(1)班",
            },
        )
    )

    assert "correct_answer" not in result
    if "stats" in result:
        assert all("correct_answer" not in item for item in result["stats"]["blank_slot_stats"])


def test_teacher_cannot_manage_another_teachers_activity(monkeypatch):
    async def fake_get_activity(_db, _activity_id):
        return _activity(1, "高一(1)班", created_by=20)

    monkeypatch.setattr(admin_api.svc, "_get_activity", fake_get_activity)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            admin_api._assert_can_manage_activity(
                object(),
                1,
                {"id": 10, "role_code": "teacher"},
            )
        )

    assert exc_info.value.status_code == 403


@pytest.mark.parametrize("role_code", ["admin", "super_admin"])
def test_admin_roles_can_manage_any_activity(monkeypatch, role_code):
    async def fake_get_activity(_db, _activity_id):
        return _activity(1, "高一(1)班", created_by=20)

    monkeypatch.setattr(admin_api.svc, "_get_activity", fake_get_activity)

    asyncio.run(
        admin_api._assert_can_manage_activity(
            object(),
            1,
            {"id": 10, "role_code": role_code},
        )
    )


def test_teacher_cannot_manage_another_teachers_plan(monkeypatch):
    async def fake_get_plan(_db, _plan_id):
        return _plan(1, ["高一(1)班"], created_by=20)

    monkeypatch.setattr(plan_api.svc, "get_plan", fake_get_plan)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            plan_api._assert_can_manage_plan(
                object(),
                1,
                {"id": 10, "role_code": "teacher"},
            )
        )

    assert exc_info.value.status_code == 403


@pytest.mark.parametrize("role_code", ["admin", "super_admin"])
def test_admin_roles_can_manage_any_plan(monkeypatch, role_code):
    async def fake_get_plan(_db, _plan_id):
        return _plan(1, ["高一(1)班"], created_by=20)

    monkeypatch.setattr(plan_api.svc, "get_plan", fake_get_plan)

    asyncio.run(
        plan_api._assert_can_manage_plan(
            object(),
            1,
            {"id": 10, "role_code": role_code},
        )
    )


def test_teacher_cannot_build_plan_from_another_teachers_activity(monkeypatch):
    async def fake_get_activity(_db, _activity_id):
        return _activity(1, "高一(1)班", created_by=20)

    monkeypatch.setattr(plan_api.activity_svc, "_get_activity", fake_get_activity)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            plan_api._assert_activities_manageable(
                object(),
                [1],
                {"id": 10, "role_code": "teacher"},
            )
        )

    assert exc_info.value.status_code == 403


@pytest.mark.parametrize(
    "class_names",
    [
        ["高一(1)班", "高一(2)班"],
        ["高一(1)班", None],
    ],
)
def test_plan_activities_must_share_one_non_empty_class(monkeypatch, class_names):
    activities = {
        index + 1: _activity(index + 1, class_name)
        for index, class_name in enumerate(class_names)
    }

    async def fake_get_activity(_db, activity_id):
        return activities[activity_id]

    monkeypatch.setattr(plan_api.activity_svc, "_get_activity", fake_get_activity)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            plan_api._assert_activities_manageable(
                object(),
                list(activities),
                {"id": 10, "role_code": "teacher"},
            )
        )

    assert exc_info.value.status_code == 400


def test_existing_mixed_class_plan_cannot_start():
    with pytest.raises(HTTPException) as exc_info:
        plan_api._assert_plan_class_scope(
            _plan(1, ["高一(1)班", "高一(2)班"])
        )

    assert exc_info.value.status_code == 400
