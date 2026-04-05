import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


BASE_URL = os.environ.get("BASE_URL", "http://localhost:6608/api/v1").rstrip("/")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
PREFIX = os.environ.get("SMOKE_PREFIX", "smoke-assessment")
LOGIN_RETRY_ATTEMPTS = max(int(os.environ.get("LOGIN_RETRY_ATTEMPTS", "4") or "4"), 1)
LOGIN_RETRY_SLEEP_SECONDS = max(float(os.environ.get("LOGIN_RETRY_SLEEP_SECONDS", "2.2") or "2.2"), 0.5)


def _ok(msg: str) -> None:
    print(f"[OK] {msg}", flush=True)


def _warn(msg: str) -> None:
    print(f"[WARN] {msg}", flush=True)


def _fail(msg: str) -> None:
    print(f"[FAIL] {msg}", flush=True)


def _http_json(
    method: str,
    url: str,
    *,
    token: str | None = None,
    body: dict[str, Any] | None = None,
    timeout: int = 30,
) -> tuple[int, Any]:
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method.upper())
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8") if hasattr(e, "read") else ""
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = {"raw": raw}
        return e.code, payload


def _http_form(url: str, *, fields: dict[str, str], timeout: int = 20) -> tuple[int, Any]:
    data = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8") if hasattr(e, "read") else ""
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = {"raw": raw}
        return e.code, payload


def _login(username: str, password: str) -> str:
    last_code = 0
    last_payload: Any = None
    for attempt in range(1, LOGIN_RETRY_ATTEMPTS + 1):
        code, payload = _http_form(
            f"{BASE_URL}/auth/login",
            fields={"username": username, "password": password},
        )
        last_code, last_payload = code, payload
        if code == 200 and isinstance(payload, dict) and payload.get("access_token"):
            return str(payload["access_token"])
        if code == 429 and attempt < LOGIN_RETRY_ATTEMPTS:
            time.sleep(LOGIN_RETRY_SLEEP_SECONDS)
            continue
        break
    raise RuntimeError(f"login failed code={last_code} payload={last_payload}")


def _expect(code: int, payload: Any, expected: int, msg: str) -> None:
    if code != expected:
        raise RuntimeError(f"{msg}: http {code} payload={payload}")


def main() -> int:
    if not ADMIN_PASSWORD:
        raise SystemExit("missing ADMIN_PASSWORD")

    suffix = str(int(time.time()))
    title = f"{PREFIX}-{suffix}"
    student_name = f"{PREFIX}-student-{suffix}"
    student_id = f"S{suffix}"
    class_name = f"Smoke班-{suffix[-4:]}"

    created_config_id: int | None = None
    created_student_user_id: int | None = None
    admin_token = ""

    try:
        code, health = _http_json("GET", f"{BASE_URL}/health", timeout=20)
        _expect(code, health, 200, "assessment health")
        _ok("assessment health")

        admin_token = _login(ADMIN_USERNAME, ADMIN_PASSWORD)
        _ok("assessment admin login")

        code, config = _http_json(
            "POST",
            f"{BASE_URL}/assessment/admin/configs",
            token=admin_token,
            body={
                "title": title,
                "subject": "生产烟测",
                "grade": "高一",
                "teaching_objectives": "验证生产环境测评主流程",
                "knowledge_points": "变量,循环,条件判断",
                "total_score": 100,
                "time_limit_minutes": 20,
                "question_config": json.dumps({"choice": {"count": 1}, "fill": {"count": 1}, "short_answer": {"count": 1}}),
                "ai_prompt": "",
                "agent_id": None,
                "config_agent_ids": [],
            },
        )
        _expect(code, config, 200, "create assessment config")
        created_config_id = int(config["id"])
        _ok(f"assessment config create id={created_config_id}")

        questions = [
            {
                "question_type": "choice",
                "content": f"{title} 选择题：Python 定义函数使用哪个关键字？",
                "options": json.dumps({"A": "func", "B": "def", "C": "function", "D": "define"}),
                "correct_answer": "B",
                "score": 20,
                "difficulty": "easy",
                "knowledge_point": "函数",
                "explanation": "Python 使用 def 定义函数",
            },
            {
                "question_type": "fill",
                "content": f"{title} 填空题：Python 输出函数是 ____",
                "correct_answer": "print",
                "score": 30,
                "difficulty": "easy",
                "knowledge_point": "基础语法",
            },
            {
                "question_type": "short_answer",
                "content": f"{title} 简答题：简述 for 和 while 的区别",
                "correct_answer": "for 用于遍历可迭代对象，while 根据条件循环",
                "score": 50,
                "difficulty": "medium",
                "knowledge_point": "循环",
            },
        ]
        for idx, question in enumerate(questions, start=1):
            question["config_id"] = created_config_id
            code, payload = _http_json(
                "POST",
                f"{BASE_URL}/assessment/admin/questions",
                token=admin_token,
                body=question,
            )
            _expect(code, payload, 200, f"create assessment question {idx}")
            _ok(f"assessment question {idx} create")

        code, toggled = _http_json(
            "PUT",
            f"{BASE_URL}/assessment/admin/configs/{created_config_id}/toggle",
            token=admin_token,
        )
        _expect(code, toggled, 200, "toggle assessment config")
        _ok("assessment config enabled")

        code, user = _http_json(
            "POST",
            f"{BASE_URL}/users/",
            token=admin_token,
            body={
                "full_name": student_name,
                "student_id": student_id,
                "class_name": class_name,
                "study_year": "2026",
                "role_code": "student",
                "is_active": True,
            },
        )
        if code not in (200, 201):
            raise RuntimeError(f"create assessment student failed: http {code} payload={user}")
        created_student_user_id = int(user["id"])
        _ok(f"assessment student create id={created_student_user_id}")

        student_token = _login(student_name, student_id)
        _ok("assessment student login")

        code, available = _http_json("GET", f"{BASE_URL}/assessment/available", token=student_token)
        _expect(code, available, 200, "assessment available list")
        if not isinstance(available, list) or not any(item.get("id") == created_config_id for item in available if isinstance(item, dict)):
            raise RuntimeError(f"created config not visible in available list: payload={available}")
        _ok("assessment available contains smoke config")

        code, started = _http_json(
            "POST",
            f"{BASE_URL}/assessment/sessions/start",
            token=student_token,
            body={"config_id": created_config_id},
        )
        _expect(code, started, 200, "assessment session start")
        session_id = int(started["session_id"])
        _ok(f"assessment session start id={session_id}")

        code, qs = _http_json(
            "GET",
            f"{BASE_URL}/assessment/sessions/{session_id}/questions",
            token=student_token,
        )
        _expect(code, qs, 200, "assessment session questions")
        if not isinstance(qs, list) or len(qs) < 3:
            raise RuntimeError(f"assessment questions unexpected payload={qs}")
        _ok(f"assessment fetched questions count={len(qs)}")

        for idx, item in enumerate(qs, start=1):
            qtype = str(item.get("question_type") or "")
            if qtype == "choice":
                answer = "B"
            elif qtype == "fill":
                answer = "print"
            else:
                answer = "for 用于遍历可迭代对象，while 根据条件执行循环"
            code, answer_payload = _http_json(
                "POST",
                f"{BASE_URL}/assessment/sessions/{session_id}/answer",
                token=student_token,
                body={"answer_id": item["answer_id"], "student_answer": answer},
            )
            _expect(code, answer_payload, 200, f"submit assessment answer {idx}")
            _ok(f"assessment answer {idx} submit")

        code, submitted = _http_json(
            "POST",
            f"{BASE_URL}/assessment/sessions/{session_id}/submit",
            token=student_token,
        )
        _expect(code, submitted, 200, "submit assessment session")
        _ok("assessment session submit")

        code, result = _http_json(
            "GET",
            f"{BASE_URL}/assessment/sessions/{session_id}/result",
            token=student_token,
        )
        _expect(code, result, 200, "assessment session result")
        if result.get("status") != "graded":
            raise RuntimeError(f"assessment session not graded: payload={result}")
        _ok("assessment session graded")

        basic_ready = False
        for _ in range(30):
            code, status_payload = _http_json(
                "GET",
                f"{BASE_URL}/assessment/sessions/{session_id}/profile-status",
                token=student_token,
            )
            _expect(code, status_payload, 200, "assessment profile status")
            basic_ready = bool(status_payload.get("basic_ready"))
            if basic_ready:
                break
            time.sleep(1)
        if basic_ready:
            code, profile = _http_json(
                "GET",
                f"{BASE_URL}/assessment/sessions/{session_id}/basic-profile",
                token=student_token,
            )
            _expect(code, profile, 200, "assessment basic profile")
            _ok("assessment basic profile ready")
        else:
            _warn("assessment basic profile not ready within 30s")

        code, sessions = _http_json(
            "GET",
            f"{BASE_URL}/assessment/admin/configs/{created_config_id}/sessions",
            token=admin_token,
        )
        _expect(code, sessions, 200, "assessment admin sessions")
        _ok("assessment admin sessions listed")

        return 0
    except Exception as exc:
        _fail(str(exc))
        return 1
    finally:
        if created_config_id and admin_token:
            try:
                _http_json(
                    "DELETE",
                    f"{BASE_URL}/assessment/admin/configs/{created_config_id}",
                    token=admin_token,
                )
            except Exception:
                pass
        if created_student_user_id and admin_token:
            try:
                _http_json(
                    "DELETE",
                    f"{BASE_URL}/users/{created_student_user_id}",
                    token=admin_token,
                )
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
