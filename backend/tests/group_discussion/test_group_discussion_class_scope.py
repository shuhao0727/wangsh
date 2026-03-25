import pytest
from fastapi import HTTPException

import app.services.agents.group_discussion as gd


def test_resolve_target_class_name_admin_uses_profile_class_when_missing_payload():
    user = {"id": 1, "role_code": "admin", "class_name": "高一(1)班"}
    assert gd.resolve_target_class_name(user=user, class_name=None) == "高一(1)班"


def test_resolve_target_class_name_admin_prefers_explicit_payload():
    user = {"id": 1, "role_code": "admin", "class_name": "高一(1)班"}
    assert gd.resolve_target_class_name(user=user, class_name="高二(2)班") == "高二(2)班"


def test_resolve_target_class_name_student_always_stays_in_own_class():
    user = {"id": 2, "role_code": "student", "class_name": "高一(3)班"}
    assert gd.resolve_target_class_name(user=user, class_name=None) == "高一(3)班"
    assert gd.resolve_target_class_name(user=user, class_name="高一(3)班") == "高一(3)班"


def test_resolve_target_class_name_student_rejects_cross_class_payload():
    user = {"id": 2, "role_code": "student", "class_name": "高一(3)班"}
    with pytest.raises(HTTPException) as exc:
        gd.resolve_target_class_name(user=user, class_name="高二(1)班")
    assert exc.value.status_code == 403


def test_resolve_target_class_name_admin_requires_class_when_profile_empty():
    user = {"id": 3, "role_code": "admin", "class_name": ""}
    with pytest.raises(HTTPException) as exc:
        gd.resolve_target_class_name(user=user, class_name=None)
    assert exc.value.status_code == 422
