"""Offline contracts for the manual official-image smoke; no daemon or network."""

import importlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

RELEASE_SET = b'''format=wangsh-release-set-v1
version=2.2.11
image=wangsh-backend ref=shuhao07/wangsh-backend:2.2.11 digest=sha256:53b0f380ca3d79eb42b36f734469759c14fb7384a138d119a683bf638a059065
image=wangsh-typst-worker ref=shuhao07/wangsh-typst-worker:2.2.11 digest=sha256:a08377c0d4b4ddcb1fc9e8cf3bfcf1502cbc83c7a0663eb4db0ad3e886721c60
image=wangsh-pythonlab-worker ref=shuhao07/wangsh-pythonlab-worker:2.2.11 digest=sha256:60882ab044994b556b4668630ff6d20910f712a27237e34bc93e51a068c2ec5d
image=pythonlab-sandbox ref=shuhao07/pythonlab-sandbox:2.2.11 digest=sha256:e5a337079ea611ff5b2740eff4a7b234e400174bed9f1bd0e35fc58fbef5749f
image=wangsh-frontend ref=shuhao07/wangsh-frontend:2.2.11 digest=sha256:899e5c4203637e865669f908863b7c6752be5e160e610c27bb8222e844615d78
image=wangsh-gateway ref=shuhao07/wangsh-gateway:2.2.11 digest=sha256:06cbfa5e77502224ddc543ef1fafb6f712d0c76eb269ce4ca1de160b6acf071f
'''
RUNNER = {
    'GITHUB_ACTIONS': 'true',
    'GITHUB_REPOSITORY': 'shuhao0727/wangsh',
    'GITHUB_EVENT_NAME': 'workflow_dispatch',
    'GITHUB_REF': 'refs/heads/main',
    'GITHUB_WORKFLOW_REF': 'shuhao0727/wangsh/.github/workflows/release-image-smoke.yml@refs/heads/main',
    'GITHUB_SHA': 'b' * 40,
    'GITHUB_WORKFLOW_SHA': 'b' * 40,
    'REVIEWED_WORKFLOW_SHA': 'b' * 40,
    'RUNNER_ENVIRONMENT': 'github-hosted',
    'RUNNER_OS': 'Linux',
    'RUNNER_ARCH': 'X64',
}


class ReleaseImagesContract(unittest.TestCase):
    def load(self, name='release_images'):
        self.assertTrue((HERE / f'{name}.py').is_file(), f'{name} implementation is missing')
        return importlib.import_module(name)

    def test_workflow_reads_existing_artifact_and_uses_native_evidence(self):
        text = (ROOT / '.github/workflows/release-image-smoke.yml').read_text()
        self.assertIn('uses: actions/download-artifact@v4', text)
        self.assertIn('run-id: 44002776220', text)
        self.assertNotIn('actions/upload-artifact', text)
        self.assertNotIn('actions/cache', text)
        self.assertNotRegex(text, r'(?m)^\s*cache:')
        self.assertGreater(text.index('--summary'), text.index('--cleanup'))
        self.assertIn('JOB_STATUS: ${{ job.status }}', text)

    def complete_evidence(self):
        images = {}
        for row in RELEASE_SET.decode().splitlines()[2:]:
            label, reference, digest = (word.split('=', 1)[1] for word in row.split())
            images[label.removeprefix('wangsh-')] = {
                'ref': f'{reference.removesuffix(":2.2.11")}@{digest}', 'platform': 'linux/amd64',
            }
        for service in ('postgres', 'redis'):
            images[service] = {'ref': f'{service}@sha256:' + 'a' * 64, 'platform': 'linux/amd64'}
        stages = {phase: 'passed' for phase in (
            'inputs', 'isolation', 'startup', 'auth', 'classroom', 'typst',
            'chrome/debug-happy-path', 'chrome/debug-multi-breakpoint-continue-to-end',
            'webkit/debug-happy-path', 'webkit/debug-multi-breakpoint-continue-to-end', 'cleanup',
        )}
        return {
            'version': '2.2.11', 'build': '15c818cbba840aee490198a2652a9fe66641d4fa',
            'manifest_sha256': '090ff2346c3735313a98fa4557a6c57c41d8928b2dee03cb4690e9c305f7b502',
            'result': 'passed', 'images': images, 'stages': stages, 'residual': 0,
        }

    def run_summary(self, payload, *, smoke='success', recovery='success', job='success',
                    runner=RUNNER, manifest=RELEASE_SET):
        with tempfile.TemporaryDirectory() as tmp:
            temp = Path(tmp)
            report = temp / 'wangsh-release-image-report' / 'summary.json'
            target = temp / 'job-summary.md'
            if payload is not None:
                report.parent.mkdir()
                report.write_bytes(payload if isinstance(payload, bytes) else json.dumps(payload).encode())
            if manifest is not None:
                release_set = temp / 'wangsh-release-image-artifact' / 'release-set.txt'
                release_set.parent.mkdir()
                release_set.write_bytes(manifest)
            result = subprocess.run(
                [sys.executable, '-I', '-B', str(HERE / 'release_images.py'), '--summary'],
                env={**runner, 'RUNNER_TEMP': tmp, 'GITHUB_STEP_SUMMARY': str(target),
                     'SMOKE_OUTCOME': smoke, 'RECOVERY_OUTCOME': recovery, 'JOB_STATUS': job},
                capture_output=True, text=True, timeout=10,
            )
            return result, target.read_text() if target.exists() else ''

    def test_complete_evidence_is_written_to_summary_and_stdout_without_private_fields(self):
        report = self.complete_evidence()
        report['private_log'] = report['images']['backend']['id'] = 'synthetic-secret-not-for-publication'
        result, summary = self.run_summary(report)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(summary, result.stdout)
        self.assertIn('**Result: PASS**', summary)
        for field in ('build', 'manifest_sha256'):
            self.assertIn(report[field], summary)
        for image in report['images'].values():
            self.assertIn(image['ref'], summary)
        for stage in report['stages']:
            self.assertIn(f'| `{stage}` | passed |', summary)
        self.assertIn('Residual resources: `0`', summary)
        self.assertNotIn('synthetic-secret-not-for-publication', summary)

    def test_missing_or_invalid_report_is_not_a_pass(self):
        for payload in (None, b'{"private": "synthetic-secret', [], {'images': 'synthetic-secret'}):
            with self.subTest(payload=payload):
                result, summary = self.run_summary(payload)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertEqual(summary, result.stdout)
                self.assertIn('**Result: NOT PASSED**', summary)
                self.assertNotIn('synthetic-secret', summary)

    def test_success_requires_release_identity_complete_stages_and_zero_residual(self):
        clean = self.complete_evidence()
        images = clean['images']
        bad_ref = {**images, 'gateway': {'ref': 'private-log-fragment', 'platform': 'linux/amd64'}}
        missing_stage = {phase: value for phase, value in clean['stages'].items()
                         if phase != 'webkit/debug-multi-breakpoint-continue-to-end'}
        for delta in (
            {'manifest_sha256': 'wrong-digest'}, {'stages': missing_stage},
            {'images': {name: image for name, image in images.items() if name != 'redis'}},
            {'images': bad_ref}, {'result': 'failed'}, {'interrupted': True},
            {'residual': 1}, {'residual': False},
        ):
            with self.subTest(delta=delta):
                result, summary = self.run_summary({**clean, **delta})
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn('**Result: NOT PASSED**', summary)
                self.assertNotIn('private-log-fragment', summary)

    def test_summary_requires_all_official_image_digests_to_match_the_original_manifest(self):
        report = self.complete_evidence()
        wrong_refs = self.complete_evidence()
        wrong_ref = 'shuhao07/wangsh-backend@sha256:' + 'a' * 64
        wrong_refs['images']['backend']['ref'] = wrong_ref
        for reason, payload, manifest in (
            ('wrong image digest', wrong_refs, RELEASE_SET),
            ('missing original manifest', report, None),
            ('changed original manifest bytes', report, RELEASE_SET + b'\n'),
        ):
            with self.subTest(reason=reason):
                result, summary = self.run_summary(payload, manifest=manifest)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn('**Result: NOT PASSED**', summary)
                self.assertNotIn(wrong_ref, summary)

    def test_cleanup_or_cancelled_job_cannot_get_a_pass_from_report_alone(self):
        for smoke, recovery, job in (
            ('cancelled', 'success', 'cancelled'), ('skipped', 'success', 'failure'),
            ('success', 'failure', 'failure'), ('success', 'success', 'cancelled'),
        ):
            with self.subTest(smoke=smoke, recovery=recovery, job=job):
                result, summary = self.run_summary(self.complete_evidence(), smoke=smoke, recovery=recovery, job=job)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn('**Result: NOT PASSED**', summary)
                self.assertIn(f'Smoke step: `{smoke}`', summary)
                self.assertIn(f'Recovery step: `{recovery}`', summary)
                self.assertIn(f'Job status at summary: `{job}`', summary)

    def test_summary_respects_reviewed_runner_context(self):
        result, summary = self.run_summary(self.complete_evidence(), runner={**RUNNER, 'GITHUB_REF': 'refs/heads/feature'})
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn('requires reviewed main workflow_dispatch', result.stderr)
        self.assertEqual(summary, '')

    def test_only_reviewed_main_ref_on_hosted_x64_passes(self):
        mod = self.load()
        mod.require_runner(RUNNER)
        for key, value in (
            ('RUNNER_ENVIRONMENT', 'self-hosted'), ('RUNNER_ARCH', 'ARM64'),
            ('GITHUB_REF', 'refs/heads/feature'), ('GITHUB_WORKFLOW_SHA', 'a' * 40),
            ('GITHUB_REPOSITORY', 'other/wangsh'), ('GITHUB_EVENT_NAME', 'push'),
            ('REVIEWED_WORKFLOW_SHA', ''),
        ):
            with self.subTest(key=key), self.assertRaises(mod.SmokeFailure):
                mod.require_runner({**RUNNER, key: value})

    def test_only_exact_release_set_bytes_can_select_images(self):
        mod = self.load()
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'release-set.txt'
            p.write_bytes(RELEASE_SET)
            repos = mod.load_manifest(p)
            self.assertEqual({'backend', 'typst-worker', 'pythonlab-worker', 'pythonlab-sandbox', 'frontend', 'gateway'}, set(repos))
            self.assertEqual(repos['gateway'], 'shuhao07/wangsh-gateway@sha256:06cbfa5e77502224ddc543ef1fafb6f712d0c76eb269ce4ca1de160b6acf071f')
            p.write_bytes(RELEASE_SET + b'\n')
            with self.assertRaises(mod.SmokeFailure):
                mod.load_manifest(p)

    def test_image_inspection_requires_registry_digest_and_platform_not_id(self):
        mod = self.load()
        ref = 'shuhao07/wangsh-gateway@sha256:' + 'a' * 64
        template = {'Id': 'sha256:' + 'b' * 64, 'Os': 'linux', 'Architecture': 'amd64', 'RepoDigests': [ref]}
        self.assertEqual(mod.image_identity(template, ref)['id'], template['Id'])
        for broken in ({**template, 'Architecture': 'arm64'}, {**template, 'RepoDigests': [], 'Id': ref.split('@')[1]}):
            with self.assertRaises(mod.SmokeFailure):
                mod.image_identity(broken, ref)

    def test_auth_enrollment_uses_fresh_transaction_after_revision_check(self):
        mod = self.load()
        ready = False

        class Session:
            read = False

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                pass

            async def scalar(self, sql):
                self.read = True
                return '20261026_0001' if 'alembic_version' in sql else ready

        async def enroll(db, *, legacy_writers_stopped):
            nonlocal ready
            # The released service refuses enrollment if the session already ran a query.
            if db.read or not legacy_writers_stopped:
                raise ValueError('Cutover requires a fresh dedicated transaction')
            ready = True

        with mock.patch.dict(sys.modules, {
            'sqlalchemy': SimpleNamespace(text=str),
            'app.db.database': SimpleNamespace(AsyncSessionLocal=Session),
            'app.services.auth': SimpleNamespace(bootstrap_durable_auth_authority=enroll),
        }):
            exec(mod.AUTH_ENROLL, {})
        self.assertTrue(ready)

    def test_compose_locks_dynamic_image_and_rejects_non_loopback(self):
        mod = self.load()
        work = Path('/runner/testing/run.only')
        origin = {
            'name': 'wangsh_sim',
            'services': {name: {'image': 'placeholder', 'environment': {'REDIS_HOST': 'redis'}} for name in (
                'postgres', 'redis', 'backend', 'typst-worker', 'pythonlab-worker', 'pythonlab-sandbox', 'frontend', 'gateway')},
            'networks': {'wangsh-network': {'driver': 'bridge'}},
        }
        for name in ('backend', 'pythonlab-worker'):
            origin['services'][name]['volumes'] = [
                {'type': 'bind', 'source': '/var/run/docker.sock', 'target': '/var/run/docker.sock'},
                {'type': 'bind', 'source': str(work), 'target': '/tmp/pythonlab/workspaces'},
            ]
        port = {'host_ip': '127.0.0.1', 'target': 80, 'published': '16608', 'protocol': 'tcp'}
        origin['services']['gateway']['ports'] = [port]
        refs = {name: f'docker.io/example/{name}@sha256:' + 'a' * 64 for name in origin['services']}
        out = mod.lock_compose(origin, refs, work)
        self.assertTrue(out['networks']['wangsh-network']['internal'])
        self.assertFalse(out['networks']['wangsh-ingress']['internal'])
        for name, service in out['services'].items():
            self.assertEqual(set(service['networks']), {'wangsh-network', 'wangsh-ingress'} if name == 'gateway' else {'wangsh-network'})
        self.assertEqual(out['services']['gateway']['networks']['wangsh-ingress']['gw_priority'], 1)
        for name in ('backend', 'pythonlab-worker'):
            self.assertEqual(out['services'][name]['environment']['PYTHONLAB_SANDBOX_IMAGE'], refs['pythonlab-sandbox'])
        self.assertTrue(all(service['pull_policy'] == 'never' for service in out['services'].values()))
        port['host_ip'] = '0.0.0.0'
        with self.assertRaises(mod.SmokeFailure):
            mod.lock_compose(origin, refs, work)

    def test_existing_unlabelled_canonical_volume_blocks_startup(self):
        mod = self.load()
        job = object.__new__(mod.Job)
        job.docker = ['docker']
        # The old volume is visible by name but is not labelled as part of this project.
        job.run = lambda cmd: 'wangsh_sim_simulation_postgres' if cmd[1:3] == ['volume', 'ls'] else ''
        config = {'volumes': {'simulation_postgres': {'name': 'wangsh_sim_simulation_postgres'}}, 'networks': {}}
        with self.assertRaises(mod.SmokeFailure):
            job.require_unused_names(config)

    def test_cleanup_will_not_down_or_remove_an_unowned_volume(self):
        mod = self.load()
        job = object.__new__(mod.Job)
        job.docker, job.compose, job.owner = ['docker'], ['docker', 'compose'], 'test-run'
        job.resources = {'volumes': ['wangsh_sim_simulation_postgres'], 'networks': []}
        commands = []

        def run(command, **_kwargs):
            commands.append(command)
            if command[1:3] == ['volume', 'ls'] and '--filter' not in command:
                return 'wangsh_sim_simulation_postgres'
            return ''

        job.run = run
        with self.assertRaises(mod.SmokeFailure):
            job.remove_compose_resources()
        self.assertFalse(any('down' in cmd or 'rm' in cmd for cmd in commands))

    def test_interrupted_run_recovery_does_not_publish_a_pass(self):
        mod = self.load()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            source, scratch, report = root / 'candidate', root / 'scratch', root / 'report'
            scratch.mkdir()
            report.mkdir()
            workspace = source / 'data/pythonlab/simulations/run.owned'
            workspace.mkdir(parents=True)
            marker = scratch / 'owned-resources.json'
            marker.write_text(json.dumps({'workspace': str(workspace), 'started': False,
                                          'resources': {'volumes': [], 'networks': []}}))
            fake_job = mock.Mock(stages={}, residual=0)
            with mock.patch.object(mod, 'Job', return_value=fake_job):
                mod.recover_cleanup(source, scratch, report)
            summary = json.loads((report / 'summary.json').read_text())
            self.assertEqual((summary['result'], summary['interrupted'], summary['stages']['cleanup']), ('failed', True, 'passed'))
            fake_job.cleanup.assert_called_once()
            state = json.loads(marker.read_text())
            state['workspace'] = str(root / 'unrelated')
            marker.write_text(json.dumps(state))
            with mock.patch.object(mod, 'Job') as unsafe, self.assertRaises(mod.SmokeFailure):
                mod.recover_cleanup(source, scratch, report)
            unsafe.assert_not_called()

    def test_recovery_refreshes_residual_without_promoting_failed_smoke(self):
        mod = self.load()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            source, scratch, report = root / 'candidate', root / 'scratch', root / 'report'
            scratch.mkdir()
            report.mkdir()
            workspace = source / 'data/pythonlab/simulations/run.owned'
            workspace.mkdir(parents=True)
            (scratch / 'owned-resources.json').write_text(json.dumps({
                'workspace': str(workspace), 'started': False, 'resources': {'volumes': [], 'networks': []},
            }))
            previous = self.complete_evidence()
            previous['stages']['cleanup'] = 'failed'
            path = report / 'summary.json'
            path.write_text(json.dumps({**previous, 'result': 'failed', 'residual': 2}))
            fake_job = mock.Mock(stages={}, residual=0)
            with mock.patch.object(mod, 'Job', return_value=fake_job):
                mod.recover_cleanup(source, scratch, report)
            fake_job.cleanup.assert_called_once()
            updated = json.loads(path.read_text())
            self.assertEqual((updated['result'], updated['residual'], updated['stages']['cleanup']), ('failed', 0, 'failed'))

    def test_browser_scenario_requires_its_own_completed_report(self):
        checks = self.load('release_checks')
        report = {
            'browser': 'chrome', 'baseUrl': 'http://127.0.0.1:16608', 'login': {'status': 'PASS'},
            'summary': {'total': 1, 'pass': 1, 'fail': 0},
            'scenarios': [{'id': 'debug-happy-path', 'status': 'PASS', 'stage': 'complete', 'remoteSessionCountAfterFinish': 0}],
        }
        with self.assertRaises(checks.SmokeFailure):
            checks.require_browser_report(report, 'chrome', report['baseUrl'], ('debug-multi-breakpoint-continue-to-end',))
        checks.require_browser_report(report, 'chrome', report['baseUrl'], ('debug-happy-path',))

    def test_docker_runtime_bind_ownership_does_not_trust_prefix_alone(self):
        mod = self.load()
        root = Path('/runner/testing/run.only')
        container = {'Name': '/wangsh_sim_u1_fixture', 'Mounts': [
            {'Type': 'bind', 'Source': str(root / 'u1' / 'fixture'), 'Destination': '/workspace'},
        ]}
        self.assertTrue(mod.owns_sandbox(container, root))
        container['Mounts'][0]['Source'] = '/runner/testing/run.other/u1/fixture'
        self.assertFalse(mod.owns_sandbox(container, root))

    def test_requires_completed_async_pdf_not_existing_file(self):
        mod = self.load('release_checks')
        self.assertFalse(mod.async_pdf_ready({'state': 'RUNNING', 'pdf_ready': True}))
        self.assertFalse(mod.async_pdf_ready({'state': 'SUCCESS', 'pdf_ready': False}))
        self.assertTrue(mod.async_pdf_ready({'state': 'SUCCESS', 'pdf_ready': True}))

    def test_http_failure_logs_do_not_include_task_identifier_or_body(self):
        checks = self.load('release_checks')
        client = checks.Client('http://127.0.0.1:16608')
        path = '/api/v1/informatics/typst-notes/compile-jobs/synthetic-task-identifier'
        error = checks.urllib.error.HTTPError(client.origin + path, 500, 'untrusted-server-diagnostic', None, None)
        with mock.patch.object(client.opener, 'open', side_effect=error), self.assertRaises(checks.SmokeFailure) as raised:
            client.json('GET', path)
        self.assertIn('HTTP 500', str(raised.exception))
        self.assertNotIn('synthetic-task-identifier', str(raised.exception))
        self.assertNotIn('untrusted-server-diagnostic', str(raised.exception))

    def test_typst_worker_result_must_precede_a_valid_pdf(self):
        mod = self.load('release_checks')

        class Client:
            def __init__(self, ready):
                self.ready = ready
                self.exported = False

            def json(self, method, path, **_kwargs):
                if (method, path) == ('POST', '/api/v1/informatics/typst-notes'):
                    return {'id': 8}
                if (method, path) == ('POST', '/api/v1/informatics/typst-notes/8/compile-async'):
                    return {'note_id': 8, 'job_id': 'job-1'}
                if (method, path) == ('GET', '/api/v1/informatics/typst-notes/compile-jobs/job-1'):
                    return {'note_id': 8, 'job_id': 'job-1', 'state': 'SUCCESS', 'pdf_ready': self.ready,
                            'result': {'note_id': 8, 'compiled_hash': 'verified', 'pdf_bytes': 10}}
                raise AssertionError('unexpected Typst route')

            def request(self, method, path, **_kwargs):
                if (method, path) != ('GET', '/api/v1/informatics/typst-notes/8/export.pdf'):
                    raise AssertionError('unexpected PDF route')
                self.exported = True
                return b'%PDF-fixture', 'application/pdf'

        clean, incomplete = Client(True), Client(False)
        mod.verify_typst(clean, 'session')
        self.assertTrue(clean.exported)
        with self.assertRaises(mod.SmokeFailure):
            mod.verify_typst(incomplete, 'session')
        self.assertFalse(incomplete.exported)

    def test_browser_report_requires_two_finished_actual_debug_scenarios(self):
        mod = self.load('release_checks')
        origin = 'http://127.0.0.1:16608'
        report = {
            'browser': 'webkit', 'baseUrl': origin, 'login': {'status': 'PASS'},
            'summary': {'total': 2, 'pass': 2, 'fail': 0},
            'scenarios': [
                {'id': scenario, 'status': 'PASS', 'stage': 'complete', 'remoteSessionCountAfterFinish': 0}
                for scenario in ('debug-happy-path', 'debug-multi-breakpoint-continue-to-end')
            ],
        }
        mod.require_browser_report(report, 'webkit', origin)
        report['scenarios'][1]['remoteSessionCountAfterFinish'] = 1
        with self.assertRaises(mod.SmokeFailure):
            mod.require_browser_report(report, 'webkit', origin)

    def test_classroom_stops_before_writes_if_student_can_access_staff_listing(self):
        mod = self.load('release_checks')

        class Client:
            def request(self, method, path, *, token, status):
                self.probe = (method, path, token, status)
                actual = 200  # Represents a regression in the synthetic role contract.
                if actual != status:
                    raise mod.SmokeFailure('unexpected status for synthetic request')

            def json(self, *_args, **_kwargs):
                raise AssertionError('classroom writes must not follow a failed role check')

        probe = Client()
        with self.assertRaises(mod.SmokeFailure):
            mod.verify_classroom(probe, 'CI', 'teacher-session', 'student-session')
        self.assertEqual(probe.probe, ('GET', '/api/v1/classroom/admin/', 'student-session', 403))

    def test_health_does_not_accept_degraded_or_previous_version(self):
        mod = self.load('release_checks')
        clean = {'status': 'healthy', 'system': {'version': '2.2.11'}, 'checks': {'database': 'healthy', 'redis': 'healthy'}}
        self.assertTrue(mod.healthy_candidate(clean))
        self.assertFalse(mod.healthy_candidate({**clean, 'status': 'degraded'}))
        self.assertFalse(mod.healthy_candidate({**clean, 'system': {'version': '2.2.10'}}))


if __name__ == '__main__':
    unittest.main()
