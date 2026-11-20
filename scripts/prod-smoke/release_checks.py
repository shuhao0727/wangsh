"""Stateful smoke cases for the pinned official release's loopback fixture."""

import json
import re
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

API = '/api/v1'
DEBUG_SCENARIOS = ('debug-happy-path', 'debug-multi-breakpoint-continue-to-end')


class SmokeFailure(RuntimeError):
    """Safe, credential-free diagnostic suitable for public CI logs."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    def __init__(self, origin):
        if origin != 'http://127.0.0.1:16608':
            raise SmokeFailure('release smoke must use its fixed loopback gateway')
        self.origin = origin
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())

    def request(self, method, path, *, token=None, payload=None, form=None, status=200):
        if not path.startswith(('/api/v1/', '/api/health')):
            raise SmokeFailure('unexpected smoke API path')
        headers = {}
        data = None
        if token:
            headers['Authorization'] = f'Bearer {token}'
        if form is not None:
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
            data = urllib.parse.urlencode(form).encode()
        elif payload is not None:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(payload).encode()
        req = urllib.request.Request(self.origin + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(req, timeout=10) as response:
                if response.status != status:
                    raise SmokeFailure(f'{method}: unexpected HTTP {response.status}')
                body = response.read(2 * 1024 * 1024 + 1)
                if len(body) > 2 * 1024 * 1024:
                    raise SmokeFailure(f'{method}: smoke response too large')
                return body, response.headers.get_content_type()
        except urllib.error.HTTPError as error:
            with error:
                if error.code == status:
                    return b'', error.headers.get_content_type()
                raise SmokeFailure(f'{method}: unexpected HTTP {error.code}') from None
        except urllib.error.URLError:
            raise SmokeFailure(f'{method}: loopback request failed') from None

    def json(self, method, path, **kwargs):
        body, mime = self.request(method, path, **kwargs)
        if mime != 'application/json':
            raise SmokeFailure(f'{method}: expected JSON')
        decoded = json.loads(body, object_pairs_hook=_unique_json_object)
        if not isinstance(decoded, dict):
            raise SmokeFailure(f'{method}: expected a JSON object')
        return decoded


def _unique_json_object(pairs):
    result = dict(pairs)
    if len(result) != len(pairs):
        raise SmokeFailure('gateway returned a duplicate JSON key')
    return result


def healthy_candidate(health):
    return (health.get('status') == 'healthy' and health.get('system', {}).get('version') == '2.2.11'
            and all(health.get('checks', {}).get(key) == 'healthy' for key in ('database', 'redis')))


def async_pdf_ready(payload):
    return payload.get('state') == 'SUCCESS' and payload.get('pdf_ready') is True


def verify_typst(client, token):
    # A real async completion is required; the general smoke's sync fallback is not acceptable here.
    notes = f'{API}/informatics/typst-notes'
    note_id = require_id(client.json('POST', notes, token=token, payload={
        'title': 'Official image Typst smoke', 'content_typst': '= Smoke\nHello',
    }))
    job = client.json('POST', f'{notes}/{note_id}/compile-async', token=token)
    job_id = job.get('job_id', '')
    if job.get('note_id') != note_id or not re.fullmatch(r'[a-zA-Z0-9-]{1,96}', job_id):
        raise SmokeFailure('async compile did not create the expected note job')
    deadline = time.monotonic() + 75
    while time.monotonic() < deadline:
        result = client.json('GET', f'{notes}/compile-jobs/{job_id}', token=token)
        if result.get('state') == 'SUCCESS':
            info = result.get('result') or {}
            if (not async_pdf_ready(result) or result.get('note_id') != note_id or result.get('job_id') != job_id
                    or info.get('note_id') != note_id or not info.get('compiled_hash') or info.get('pdf_bytes', 0) <= 0):
                raise SmokeFailure('Typst worker result lacks verified PDF metadata')
            data, mime = client.request('GET', f'{notes}/{note_id}/export.pdf', token=token)
            if mime != 'application/pdf' or not data.startswith(b'%PDF-'):
                raise SmokeFailure('Typst export is not a PDF')
            return
        if result.get('state') in ('FAILURE', 'REVOKED'):
            raise SmokeFailure('Typst async job did not succeed')
        time.sleep(1)
    raise SmokeFailure('Typst async job did not finish before the deadline')


def require_browser_report(report, engine, origin, expected=DEBUG_SCENARIOS):
    scenarios = report.get('scenarios', [])
    count = len(expected)
    if (report.get('browser') != engine or report.get('baseUrl') != origin
            or (report.get('login') or {}).get('status') != 'PASS'
            or report.get('summary') != {'total': count, 'pass': count, 'fail': 0}
            or len(scenarios) != count or {result['id'] for result in scenarios} != set(expected)
            or not all(result.get('status') == 'PASS' and result.get('stage') == 'complete'
                       and result.get('remoteSessionCountAfterFinish') == 0 for result in scenarios)):
        raise SmokeFailure('browser report lacks the required completed debug scenario')


def require_id(payload):
    value = payload.get('id')
    if type(value) is not int or value <= 0:
        raise SmokeFailure('unexpected synthetic resource id')
    return value


def smoke_accounts(client, admin_password):
    def login(username, password, role):
        time.sleep(2.1)  # The release allows only one login per source IP every 2 seconds.
        grant = client.json('POST', f'{API}/auth/login', form={'username': username, 'password': password})
        token, refresh = grant.get('access_token'), grant.get('refresh_token')
        if not all(isinstance(value, str) and value for value in (token, refresh)):
            raise SmokeFailure('synthetic login did not issue both tokens')
        me = client.json('GET', f'{API}/auth/me', token=token)
        if me.get('role_code') != role or me.get('username') != username:
            raise SmokeFailure('synthetic identity or role differs')
        return token, refresh, require_id(me)

    client.request('GET', f'{API}/auth/me', status=401)
    admin, refresh, admin_id = login('admin', admin_password, 'super_admin')
    classroom = 'release-smoke-class'
    teacher_password = 'T!a7' + secrets.token_urlsafe(20)
    student_password = 'S!a7' + secrets.token_urlsafe(20)
    for role, password in (('teacher', teacher_password), ('student', student_password)):
        data = {'username': f'ci-smoke-{role}', 'password': password, 'full_name': f'CI {role}',
                'role_code': role, 'class_name': classroom, 'is_active': True}
        if role == 'student':
            data['student_id'] = 'CI-SMOKE-01'
        created = client.json('POST', f'{API}/users/', token=admin, payload=data)
        if not created.get('id') or created.get('role_code') != role or created.get('class_name') != classroom:
            raise SmokeFailure('synthetic account was not created in the intended class')
    client.request('POST', f'{API}/auth/logout', token=admin)
    client.request('GET', f'{API}/auth/me', token=admin, status=401)
    client.request('POST', f'{API}/auth/refresh', payload={'refresh_token': refresh}, status=401)
    teacher, _, teacher_id = login('ci-smoke-teacher', teacher_password, 'teacher')
    student, _, _ = login('ci-smoke-student', student_password, 'student')
    return classroom, teacher, student, (('ci-smoke-teacher', teacher_password, teacher_id), ('admin', admin_password, admin_id))


def verify_classroom(client, classroom, teacher, student):
    activities = f'{API}/classroom/admin'
    client.request('GET', f'{activities}/', token=student, status=403)
    activity = client.json('POST', f'{activities}/', token=teacher, payload={
        'activity_type': 'vote', 'title': 'CI release poll', 'class_name': classroom,
        'options': [{'key': 'A', 'text': 'Choice A'}, {'key': 'B', 'text': 'Choice B'}],
        'correct_answer': 'A', 'allow_multiple': False, 'time_limit': 0,
    })
    if activity.get('status') != 'draft' or activity.get('class_name') != classroom:
        raise SmokeFailure('classroom draft was not created for the synthetic class')
    aid = require_id(activity)
    active = client.json('POST', f'{activities}/{aid}/start', token=teacher)
    if active.get('id') != aid or active.get('status') != 'active':
        raise SmokeFailure('classroom activity did not start')
    response = client.json('POST', f'{API}/classroom/{aid}/respond', token=student, payload={'answer': 'A'})
    result = client.json('GET', f'{activities}/{aid}/statistics', token=teacher)
    if (response.get('answer') != 'A' or not response.get('submitted_at') or result.get('activity_id') != aid
            or result.get('total_responses') != 1 or result.get('option_counts') != {'A': 1, 'B': 0}):
        raise SmokeFailure('classroom response did not appear in the teacher statistics')
