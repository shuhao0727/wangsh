from fastapi.testclient import TestClient

from main import app


def test_auth_me_uses_session_guard():
    async def fake_get_current_user():
        return {
            "id": 3,
            "role_code": "student",
            "username": None,
            "full_name": "张三",
            "is_active": True,
            "created_at": "2026-03-26T07:33:24.595414+00:00",
            "updated_at": "2026-03-26T07:34:09.162472+00:00",
            "student_id": "2026212",
            "class_name": "高一(1)",
            "study_year": "2026",
        }

    from app.api.endpoints.auth.auth import require_current_user

    app.dependency_overrides.clear()
    app.dependency_overrides[require_current_user] = fake_get_current_user
    client = TestClient(app)

    try:
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 200
        assert response.json() == {
            "id": 3,
            "role_code": "student",
            "username": None,
            "full_name": "张三",
            "is_active": True,
            "created_at": "2026-03-26T07:33:24.595414+00:00",
            "updated_at": "2026-03-26T07:34:09.162472+00:00",
            "student_id": "2026212",
            "class_name": "高一(1)",
            "study_year": "2026",
        }
    finally:
        app.dependency_overrides.clear()
