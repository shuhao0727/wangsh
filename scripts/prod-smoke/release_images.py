"""Smoke the immutable 2.2.11 release on its dedicated GitHub-hosted job only."""

import argparse
import base64
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import secrets
import shutil
import signal
import socket
import stat
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from release_checks import (Client, DEBUG_SCENARIOS, SmokeFailure, healthy_candidate,
                            require_browser_report, smoke_accounts, verify_classroom, verify_typst)

BUILD = '15c818cbba840aee490198a2652a9fe66641d4fa'
MANIFEST_SHA = '090ff2346c3735313a98fa4557a6c57c41d8928b2dee03cb4690e9c305f7b502'
REPOS = {
    'backend': 'wangsh-backend', 'typst-worker': 'wangsh-typst-worker',
    'pythonlab-worker': 'wangsh-pythonlab-worker', 'pythonlab-sandbox': 'pythonlab-sandbox',
    'frontend': 'wangsh-frontend', 'gateway': 'wangsh-gateway',
}
INFRA_IMAGES = {'postgres': 'postgres:16-alpine', 'redis': 'redis:7-alpine'}
MANIFEST_FILE = 'wangsh-release-image-artifact/release-set.txt'
PROJECT, NETWORK, INGRESS, PORT = 'wangsh_sim', 'wangsh-network', 'wangsh-ingress', 16608
ORIGIN = f'http://127.0.0.1:{PORT}'
SOCKET = '/var/run/docker.sock'
WORKSPACE_TARGET = '/tmp/pythonlab/workspaces'
DB = 'wangsh_release_smoke'
PLATFORM = 'linux/amd64'
OWNER = 'wangsh.release-smoke.run'
HEX = r'sha256:[0-9a-f]{64}'
PHASES = ('inputs', 'isolation', 'startup', 'auth', 'classroom', 'typst',
          *(f'{engine}/{scenario}' for engine in ('chrome', 'webkit') for scenario in DEBUG_SCENARIOS), 'cleanup')


def require_runner(env):
    fixed = {
        'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'workflow_dispatch',
        'GITHUB_REPOSITORY': 'shuhao0727/wangsh', 'GITHUB_REF': 'refs/heads/main',
        'GITHUB_WORKFLOW_REF': 'shuhao0727/wangsh/.github/workflows/release-image-smoke.yml@refs/heads/main',
        'RUNNER_ENVIRONMENT': 'github-hosted', 'RUNNER_OS': 'Linux', 'RUNNER_ARCH': 'X64',
    }
    approved = env.get('REVIEWED_WORKFLOW_SHA', '')
    if (not all(env.get(k) == v for k, v in fixed.items()) or not re.fullmatch(r'[0-9a-f]{40}', approved)
            or approved != env.get('GITHUB_WORKFLOW_SHA') or approved != env.get('GITHUB_SHA')):
        raise SmokeFailure('requires reviewed main workflow_dispatch on GitHub-hosted Linux X64')


def load_manifest(path):
    with path.open('rb') as stream:
        raw = stream.read(4097)
    if hashlib.sha256(raw).hexdigest() != MANIFEST_SHA:
        raise SmokeFailure('release-set.txt checksum mismatch')
    header, version, *rows = raw.decode().splitlines()
    if (header, version, len(rows)) != ('format=wangsh-release-set-v1', 'version=2.2.11', 6):
        raise SmokeFailure('unexpected release-set format or version')
    names = {repo: service for service, repo in REPOS.items()}
    refs = {}
    for row in rows:
        item = re.fullmatch(rf'image=([a-z0-9-]+) ref=shuhao07/\1:2\.2\.11 digest=({HEX})', row)
        if not item or item[1] not in names or names[item[1]] in refs:
            raise SmokeFailure('unexpected or duplicate official image reference')
        refs[names[item[1]]] = f'shuhao07/{item[1]}@{item[2]}'
    return refs


def image_identity(info, ref):
    if (info.get('Os'), info.get('Architecture')) != ('linux', 'amd64'):
        raise SmokeFailure('unexpected local image platform')
    repo_digests = {item.removeprefix('docker.io/') for item in info.get('RepoDigests') or []}
    if ref.removeprefix('docker.io/') not in repo_digests or not re.fullmatch(HEX, info.get('Id', '')):
        raise SmokeFailure('local image does not match its release RepoDigest')
    return {'ref': ref, 'id': info['Id'], 'platform': PLATFORM}


def lock_compose(config, refs, workspace):
    """Pin the already-normalized candidate to the prechecked local image identities."""
    config = deepcopy(config)
    services = config['services']
    gateway_ports = [{'host_ip': '127.0.0.1', 'target': 80, 'published': str(PORT), 'protocol': 'tcp'}]
    if config['name'] != PROJECT or set(services) != set(refs) or set(config['networks']) != {NETWORK}:
        raise SmokeFailure('unexpected normalized project, service set or network')
    config['networks'][NETWORK]['internal'] = True
    # Moby publishes ports through a non-internal gateway endpoint. Keep every other service internal.
    config['networks'][INGRESS] = {'driver': 'bridge', 'internal': False}
    for name, service in services.items():
        service['networks'] = {NETWORK: {}}
        if name == 'gateway':
            service['networks'][INGRESS] = {'gw_priority': 1}
        ports = service.get('ports', [])
        if ports != (gateway_ports if name == 'gateway' else []):
            raise SmokeFailure('unexpected publication outside the loopback gateway')
        binds = {m['target']: m['source'] for m in service.get('volumes', []) if m['type'] == 'bind'}
        pythonlab = name in ('backend', 'pythonlab-worker')
        if binds != ({SOCKET: SOCKET, WORKSPACE_TARGET: str(workspace)} if pythonlab else {}):
            raise SmokeFailure('unexpected host bind in simulation')
        service.update(image=refs[name], pull_policy='never', restart='no')
        service.pop('extra_hosts', None)
        if name in ('backend', 'typst-worker', 'pythonlab-worker') and service['environment'].get('REDIS_HOST') != 'redis':
            raise SmokeFailure('normalized Redis target is not the isolated service')
        if pythonlab:
            service['environment']['PYTHONLAB_SANDBOX_IMAGE'] = refs['pythonlab-sandbox']
    return config


def owns_sandbox(container, workspace):
    if not container['Name'].startswith(f'/{PROJECT}_'):
        return False
    for mount in container['Mounts']:
        if mount['Type'] != 'bind' or mount['Destination'] != '/workspace':
            continue
        source = Path(mount['Source'])
        return source != workspace and '..' not in source.parts and source.is_relative_to(workspace)
    return False


CHECK_CONNECTIONS = '''
import json
import socket
from urllib.parse import urlsplit
from app.core.config import settings

db = urlsplit(str(settings.DATABASE_URL))
broker = urlsplit(settings.CELERY_BROKER_URL)
cache = urlsplit(settings.REDIS_URL)
if (db.hostname, db.port, db.path) != ('postgres', 5432, '/wangsh_release_smoke'):
    raise SystemExit(1)
if (broker.hostname, broker.port, cache.hostname, cache.port) != ('redis', 6379, 'redis', 6379):
    raise SystemExit(1)
print('SMOKE_TARGETS ' + json.dumps([socket.gethostbyname('postgres'), socket.gethostbyname('redis')]))
'''
AUTH_ENROLL = '''
import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal
from app.services.auth import bootstrap_durable_auth_authority

async def main():
    async with AsyncSessionLocal() as db:
        if (await db.scalar(text('SELECT version_num FROM alembic_version'))) != '20261026_0001':
            raise SystemExit(1)
    async with AsyncSessionLocal() as db:
        await bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
    async with AsyncSessionLocal() as db:
        if (await db.scalar(text('SELECT ready FROM auth_authority WHERE id = 1'))) is not True:
            raise SystemExit(1)

asyncio.run(main())
'''


class Job:
    def __init__(self, source, scratch):
        self.source, self.scratch = source, scratch
        self.phase = 'inputs'
        self.stages = dict.fromkeys(PHASES, 'not-run')
        self.images = {}
        self.workspace = None
        self.started = False
        self.resources = {'volumes': [], 'networks': []}
        self.residual = None
        self.deadline = time.monotonic() + 16 * 60
        self.owner = f"{os.environ['GITHUB_RUN_ID']}-{os.environ['GITHUB_RUN_ATTEMPT']}"
        self.admin_password = 'R1!a7' + secrets.token_urlsafe(24)
        docker_config = scratch / 'docker-config'
        docker_config.mkdir(exist_ok=True)
        # Do not forward workflow tokens, proxy settings or Docker context overrides.
        self.env = {'PATH': os.environ['PATH'], 'HOME': os.environ['HOME'], 'DOCKER_CONFIG': str(docker_config)}
        self.docker = ['docker', '--host', f'unix://{SOCKET}']
        self.compose = [*self.docker, 'compose', '--project-name', PROJECT, '--project-directory', str(source),
                        '--env-file', str(scratch / 'empty.env'), '-f', str(scratch / 'compose.json')]
        (scratch / 'empty.env').touch()

    def note(self, text):
        # Keep live stage evidence in native logs even if the summary cannot run.
        print(text, flush=True)

    def step(self, phase):
        self.phase = phase
        self.stages[phase] = 'in-progress'
        self.note(f'{phase}: start')

    def passed(self):
        self.stages[self.phase] = 'passed'
        self.note(f'{self.phase}: passed')

    def run(self, args, *, timeout=30, input=None, env=None):
        remaining = self.deadline - time.monotonic() if self.phase != 'cleanup' else timeout
        if remaining <= 0:
            raise SmokeFailure('smoke time budget exhausted before cleanup')
        result = subprocess.run(args, env=self.env if env is None else env, cwd=self.scratch,
                                input=input, capture_output=True, text=True, timeout=min(timeout, remaining))
        if result.returncode:
            raise SmokeFailure(f'command failed (exit {result.returncode})')
        return result.stdout.strip()

    def project_resources(self):
        label = f'label=com.docker.compose.project={PROJECT}'
        return [item for args in (('ps', '-aq'), ('network', 'ls', '-q'), ('volume', 'ls', '-q'))
                for item in self.run([*self.docker, *args, '--filter', label]).splitlines()]

    def require_unused_names(self, config):
        for section, kind in (('volumes', 'volume'), ('networks', 'network')):
            present = set(self.run([*self.docker, kind, 'ls', '--format', '{{.Name}}']).splitlines())
            if present.intersection(resource['name'] for resource in config[section].values()):
                raise SmokeFailure(f'canonical {kind} name is already occupied')

    def pull_images(self, refs):
        for service, reference in {**refs, **INFRA_IMAGES}.items():
            self.note(f'inputs: pull {service}')
            downloaded = self.run([*self.docker, 'pull', '--platform', PLATFORM, reference], timeout=210)
            if service not in refs:
                digest = re.search(rf'^Digest: ({HEX})$', downloaded, re.M)
                if not digest:
                    raise SmokeFailure('official infrastructure pull missing digest')
                reference = f'{service}@{digest[1]}'
            row = self.run([*self.docker, 'image', 'inspect', '--format', '{{json .}}', reference])
            self.images[service] = image_identity(json.loads(row), reference)

    def configure(self):
        if self.project_resources() or self.sandbox_ids():
            raise SmokeFailure('simulation project or sandbox namespace is already occupied')
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', PORT))
        parent = self.source / 'data/pythonlab/simulations'
        parent.mkdir(parents=True)
        self.workspace = Path(tempfile.mkdtemp(prefix='run.', dir=parent))
        self.save_ownership()
        self.run(['sudo', '-n', 'chown', '1000:1000', '--', str(self.workspace)])
        render_env = {
            **self.env, 'COMPOSE_PROJECT_NAME': PROJECT, 'APP_VERSION': '2.2.11', 'IMAGE_TAG': '2.2.11',
            'REACT_APP_VERSION': '2.2.11', 'WEB_PORT': str(PORT), 'REDIS_HOST': 'redis',
            'POSTGRES_DB': DB, 'POSTGRES_USER': 'admin', 'POSTGRES_PASSWORD': secrets.token_urlsafe(32),
            'SECRET_KEY': secrets.token_urlsafe(48), 'SUPER_ADMIN_USERNAME': 'admin',
            'SUPER_ADMIN_PASSWORD': self.admin_password,
            'AGENT_API_KEY_ENCRYPTION_KEY': base64.urlsafe_b64encode(secrets.token_bytes(32)).decode(),
            'PYTHONLAB_CONTAINER_NAMESPACE': PROJECT, 'HOST_WORKSPACE_ROOT': str(self.workspace),
            'PYTHONLAB_HOST_WORKSPACE_ROOT': str(self.workspace), 'DOCKER_SOCK_GID': str(Path(SOCKET).stat().st_gid),
            'COOKIE_SECURE': 'false', 'CORS_ORIGINS': json.dumps([ORIGIN]),
        }
        canonical = self.run([*self.docker, 'compose', '--project-name', PROJECT, '--project-directory', str(self.source),
                              '--env-file', str(self.scratch / 'empty.env'), '-f', str(self.source / 'docker-compose.yml'),
                              'config', '--format', 'json'], env=render_env)
        normalized = self.run([sys.executable, '-I', '-B', str(self.source / 'scripts/prepare-production-simulation.py'),
                               '--workspace', str(self.workspace), '--port', str(PORT)], input=canonical)
        config = lock_compose(json.loads(normalized), {k: v['ref'] for k, v in self.images.items()}, self.workspace)
        for section in ('services', 'volumes', 'networks'):
            for item in config[section].values():
                item.setdefault('labels', {})[OWNER] = self.owner
        (self.scratch / 'compose.json').write_text(json.dumps(config) + '\n')
        effective = json.loads(self.run([*self.compose, 'config', '--format', 'json']))
        if effective['name'] != PROJECT or len(effective['services']) != 8:
            raise SmokeFailure('effective compose scope differs from isolated job')
        self.require_unused_names(effective)
        self.resources = {key: sorted(item['name'] for item in effective[key].values()) for key in ('volumes', 'networks')}
        self.mounts = {
            service: {(mount['type'], mount['target'],
                       effective['volumes'][mount['source']]['name'] if mount['type'] == 'volume' else mount['source'])
                      for mount in item.get('volumes', [])}
            for service, item in effective['services'].items()
        }

    def save_ownership(self):
        marker = self.scratch / 'owned-resources.tmp'
        marker.write_text(json.dumps({'workspace': str(self.workspace), 'started': self.started, 'resources': self.resources}))
        marker.replace(self.scratch / 'owned-resources.json')

    def startup(self):
        self.started = True
        self.save_ownership()
        self.run([*self.compose, 'up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '180'], timeout=210)
        ids = self.run([*self.compose, 'ps', '-q']).splitlines()
        if len(ids) != 8:
            raise SmokeFailure('expected eight running services')
        rows = json.loads(self.run([*self.docker, 'inspect', *ids]))
        by_service = {row['Config']['Labels']['com.docker.compose.service']: row for row in rows}
        network = f'{PROJECT}_{NETWORK}'
        if set(by_service) != set(self.images):
            raise SmokeFailure('running service set differs from manifest')
        for service, row in by_service.items():
            state = row['State']
            expected_networks = {network, f'{PROJECT}_{INGRESS}'} if service == 'gateway' else {network}
            published = {key: values for key, values in (row['NetworkSettings']['Ports'] or {}).items() if values}
            expected_ports = {'80/tcp': [{'HostIp': '127.0.0.1', 'HostPort': str(PORT)}]} if service == 'gateway' else {}
            mounts = {(m['Type'], m['Destination'], m.get('Name') if m['Type'] == 'volume' else m['Source']) for m in row['Mounts']}
            if (row['Image'] != self.images[service]['id'] or not state['Running'] or mounts != self.mounts[service]
                    or set(row['NetworkSettings']['Networks']) != expected_networks or published != expected_ports
                    or (service != 'pythonlab-sandbox' and state.get('Health', {}).get('Status') != 'healthy')):
                raise SmokeFailure(f'{service} running identity, mount, network or health differs')
        expected_targets = [by_service[s]['NetworkSettings']['Networks'][network]['IPAddress'] for s in ('postgres', 'redis')]
        for service in ('backend', 'typst-worker', 'pythonlab-worker'):
            result = self.run([*self.compose, 'exec', '-T', service, 'python', '-B', '-'], input=CHECK_CONNECTIONS)
            targets = [json.loads(line.removeprefix('SMOKE_TARGETS ')) for line in result.splitlines() if line.startswith('SMOKE_TARGETS ')]
            if targets != [expected_targets]:
                raise SmokeFailure(f'{service} effective data target differs')
        self.run([*self.compose, 'exec', '-T', 'backend', 'python', '-B', '-'], input=AUTH_ENROLL)
        if not healthy_candidate(Client(ORIGIN).json('GET', '/api/health')):
            raise SmokeFailure('gateway does not report healthy official 2.2.11')

    def sandbox_ids(self):
        return self.run([*self.docker, 'ps', '-aq', '--no-trunc', '--filter', f'name=^/{PROJECT}_']).splitlines()

    def sandbox_metadata(self):
        # A session may stop between ps and inspect. Re-list once only in that case.
        for _ in range(2):
            ids = self.sandbox_ids()
            if not ids:
                return []
            result = subprocess.run([*self.docker, 'inspect', *ids], env=self.env, text=True,
                                    capture_output=True, timeout=15)
            if result.returncode == 0:
                return json.loads(result.stdout)
            if not any(item in result.stderr.lower() for item in ('no such object', 'no such container')):
                break
        raise SmokeFailure('could not verify runtime sandbox metadata')

    def browser(self, engine, user, scenario):
        username, password, user_id = user
        if self.sandbox_ids():
            raise SmokeFailure('sandbox residue before debug scenario')
        report = self.scratch / f'{engine}-{scenario}.json'
        command = ['node', str(self.source / 'frontend/scripts/pythonlab-debug-smoke.mjs'), '--base-url', ORIGIN,
                   '--browser', engine, '--username', username, '--report-path', str(report),
                   '--screenshots-dir', str(self.scratch / f'{engine}-screenshots'), '--scenario', scenario]
        observed = set()
        expected_image = self.images['pythonlab-sandbox']['id']
        deadline = min(time.monotonic() + 140, self.deadline)
        child_env = {**self.env, 'ADMIN_PASSWORD': password}
        time.sleep(2.1)  # The API applies a two-second login interval to this loopback IP.
        with subprocess.Popen(command, cwd=self.source / 'frontend', env=child_env,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as process:
            try:
                while process.poll() is None:
                    if time.monotonic() >= deadline:
                        raise SmokeFailure('browser smoke timed out')
                    for row in self.sandbox_metadata():
                        if row['Name'] != f'/{PROJECT}_u{user_id}' or not owns_sandbox(row, self.workspace):
                            raise SmokeFailure('dynamic sandbox is not owned by this scenario account and job')
                        if (row['Image'] != expected_image or row['Config']['Labels'].get('wangsh.pythonlab.runtime-mode') != 'debug'
                                or row['HostConfig']['NetworkMode'] != 'none' or row['HostConfig']['PortBindings']):
                            raise SmokeFailure('dynamic sandbox image or network boundary differs')
                        if row['State']['Running']:
                            observed.add(row['Id'])
                    time.sleep(0.5)
                if process.returncode or not observed:
                    raise SmokeFailure('browser failed or no running sandbox was observed')
                require_browser_report(json.loads(report.read_text()), engine, ORIGIN, (scenario,))
            finally:
                if process.poll() is None:
                    process.kill()
        deadline = min(time.monotonic() + 30, self.deadline)
        while self.sandbox_ids():
            if time.monotonic() >= deadline:
                raise SmokeFailure('sandbox remains after browser stop')
            time.sleep(0.5)

    def cleanup(self):
        failed = False
        if self.started:
            try:
                self.remove_compose_resources()
            except (SmokeFailure, subprocess.TimeoutExpired):
                failed = True
            try:
                owned = [row['Id'] for row in self.sandbox_metadata() if owns_sandbox(row, self.workspace)]
                if owned:
                    self.run([*self.docker, 'rm', '-f', *owned])
            except (SmokeFailure, subprocess.TimeoutExpired):
                failed = True
        if self.workspace is not None and not failed:
            self.run(['sudo', '-n', 'rm', '-rf', '--', str(self.workspace)])
        self.residual = int(self.workspace is not None and self.workspace.exists())
        if self.started:
            self.residual += len(self.project_resources()) + len(self.sandbox_ids())
        if failed or self.residual:
            raise SmokeFailure('job resources could not be fully reclaimed')
        (self.scratch / 'owned-resources.json').unlink(missing_ok=True)

    def remove_compose_resources(self):
        owner_filter = f'label={OWNER}={self.owner}'
        project_filter = f'label=com.docker.compose.project={PROJECT}'
        containers = self.run([*self.docker, 'ps', '-aq', '--no-trunc', '--filter', project_filter]).splitlines()
        if containers:
            rows = json.loads(self.run([*self.docker, 'inspect', *containers]))
            if {row['Id'] for row in rows} != set(containers) or any(
                row['Config']['Labels'].get(OWNER) != self.owner for row in rows
            ):
                raise SmokeFailure('unexpected container in cleanup project')
        volumes = []
        for section, kind in (('volumes', 'volume'), ('networks', 'network')):
            command = [*self.docker, kind, 'ls', '--format', '{{.Name}}']
            planned = set(self.resources[section])
            present = planned.intersection(self.run(command).splitlines())
            owned = planned.intersection(self.run([*command, '--filter', owner_filter]).splitlines())
            if present != owned:
                raise SmokeFailure('refusing cleanup of resource without this job label')
            if kind == 'volume':
                volumes = sorted(owned)
        self.run([*self.compose, 'down', '--timeout', '10'], timeout=50)
        if volumes:
            self.run([*self.docker, 'volume', 'rm', *volumes])


def check_source(job):
    if job.run(['git', '-C', str(job.source), 'rev-parse', 'HEAD']) != BUILD or (job.source / '.env').exists():
        raise SmokeFailure('candidate must be the fixed clean release checkout without .env')
    job.run(['git', '-C', str(job.source), 'diff', '--quiet', 'HEAD', '--'])
    if platform.machine() != 'x86_64' or platform.system() != 'Linux' or not stat.S_ISSOCK(Path(SOCKET).stat().st_mode):
        raise SmokeFailure('runner does not have the approved local Linux x86_64 daemon socket')
    if job.run([*job.docker, 'info', '--format', '{{.OSType}}/{{.Architecture}}']) not in ('linux/x86_64', 'linux/amd64'):
        raise SmokeFailure('daemon platform differs from the hosted job')
    job.run([*job.docker, 'compose', 'version', '--short'])


def execute(source, manifest, scratch, report):
    job = Job(source, scratch)
    ok = False
    try:
        job.step('inputs')
        refs = load_manifest(manifest)
        check_source(job)
        job.pull_images(refs)
        job.passed()
        job.step('isolation')
        job.configure()
        job.passed()
        job.step('startup')
        job.startup()
        job.passed()
        client = Client(ORIGIN)
        job.step('auth')
        classroom, teacher, student, users = smoke_accounts(client, job.admin_password)
        job.passed()
        job.step('classroom')
        verify_classroom(client, classroom, teacher, student)
        job.passed()
        job.step('typst')
        verify_typst(client, teacher)
        job.passed()
        for engine, user in zip(('chrome', 'webkit'), users, strict=True):
            for scenario in DEBUG_SCENARIOS:
                job.step(f'{engine}/{scenario}')
                job.browser(engine, user, scenario)
                job.passed()
        ok = True
    except (SmokeFailure, OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as error:
        job.stages[job.phase] = 'failed'
        job.note(f'{job.phase}: failed ({error if isinstance(error, SmokeFailure) else type(error).__name__})')
    finally:
        job.step('cleanup')
        try:
            job.cleanup()
            job.passed()
        except (SmokeFailure, OSError, subprocess.TimeoutExpired):
            ok = False
            job.stages['cleanup'] = 'failed'
            job.note('cleanup: failed')
        (report / 'summary.json').write_text(json.dumps({
            'version': '2.2.11', 'build': BUILD, 'manifest_sha256': MANIFEST_SHA,
            'result': 'passed' if ok else 'failed', 'images': job.images,
            'stages': job.stages, 'residual': job.residual,
        }, indent=2) + '\n')
    return 0 if ok else 1


def read_evidence(path):
    try:
        evidence = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}  # An early failure or interruption may leave no complete JSON.
    return evidence if isinstance(evidence, dict) else {}


def recover_cleanup(source, scratch, report):
    marker = scratch / 'owned-resources.json'
    if not marker.is_file():
        return
    state = json.loads(marker.read_text())
    workspace = Path(state['workspace'])
    if (workspace.parent != source / 'data/pythonlab/simulations'
            or not re.fullmatch(r'run\.[A-Za-z0-9_-]+', workspace.name)
            or workspace.parent.resolve() != workspace.parent or type(state['started']) is not bool):
        raise SmokeFailure('cleanup ownership does not match this job workspace')
    expected = {'volumes': [], 'networks': []}
    if state['started']:
        expected = {
            'volumes': [f'{PROJECT}_{name}' for name in ('simulation_postgres', 'simulation_redis', 'typst_pdfs', 'uploads_data')],
            'networks': sorted((f'{PROJECT}_{NETWORK}', f'{PROJECT}_{INGRESS}')),
        }
    if state['resources'] != expected:
        raise SmokeFailure('cleanup ownership does not match canonical job resources')
    job = Job(source, scratch)
    job.workspace, job.started, job.resources = workspace, state['started'], state['resources']
    job.step('cleanup')
    job.cleanup()
    job.note('cleanup: reclaimed after earlier step did not finish')
    summary = report / 'summary.json'
    evidence = read_evidence(summary) or {
        'version': '2.2.11', 'build': BUILD, 'manifest_sha256': MANIFEST_SHA,
        'stages': {**job.stages, 'cleanup': 'passed'}, 'interrupted': True,
    }
    evidence.update(residual=job.residual, result='failed')
    summary.write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')


def publish_summary(report_path, manifest_path, target, *, job_status, smoke, recovery):
    """Write only allowlisted evidence to the public job summary and logs."""
    report = read_evidence(report_path)
    try:
        release_refs = load_manifest(manifest_path)
    except (SmokeFailure, OSError):
        release_refs = {}

    statuses = ('success', 'failure', 'cancelled')
    job_status = job_status if job_status in statuses else 'not recorded'
    step_outcomes = (*statuses, 'skipped')
    smoke = smoke if smoke in step_outcomes else 'not recorded'
    recovery = recovery if recovery in step_outcomes else 'not recorded'
    reported_stages = report.get('stages')
    if not isinstance(reported_stages, dict):
        reported_stages = {}
    stages = {phase: reported_stages.get(phase) for phase in PHASES}

    services = (*REPOS, *INFRA_IMAGES)
    images = report.get('images')
    if not isinstance(images, dict):
        images = {}
    verified_refs = {}
    for service in services:
        image = images.get(service)
        if not isinstance(image, dict) or image.get('platform') != PLATFORM or not isinstance(image.get('ref'), str):
            continue
        ref = image['ref']
        if service in REPOS:
            if ref != release_refs.get(service):
                continue
        elif not re.fullmatch(rf'{service}@{HEX}', ref):
            continue
        verified_refs[service] = ref

    inputs_verified = (
        (report.get('version'), report.get('build'), report.get('manifest_sha256')) == ('2.2.11', BUILD, MANIFEST_SHA)
        and stages['inputs'] == 'passed' and len(verified_refs) == len(services)
    )
    residual = report.get('residual')
    if type(residual) is not int or residual < 0:
        residual = 'not recorded'
    passed = (job_status == smoke == recovery == 'success' and inputs_verified and residual == 0
              and all(status == 'passed' for status in stages.values())
              and report.get('result') == 'passed' and report.get('interrupted', False) is False)

    provenance = 'verified' if inputs_verified else 'expected'
    lines = [
        '## WangSh 2.2.11 official-image smoke', '',
        '**Result: PASS**' if passed else '**Result: NOT PASSED**', '',
        'Accept only when the final GitHub job conclusion is `success`.', '',
        f'- Job status at summary: `{job_status}`',
        f'- Smoke step: `{smoke}`', f'- Recovery step: `{recovery}`',
        f'- Candidate build ({provenance}): `{BUILD}`',
        f'- Release-set SHA-256 ({provenance}): `{MANIFEST_SHA}`',
        f'- Residual resources: `{residual}`', '',
        '| Stage | Result |', '| --- | --- |',
    ]
    for phase, status in stages.items():
        safe_status = status if status in ('passed', 'failed', 'in-progress', 'not-run') else 'not recorded'
        lines.append(f'| `{phase}` | {safe_status} |')
    lines.extend(('', '| Image | Registry digest reference | Platform |', '| --- | --- | --- |'))
    for service in services:
        if service in verified_refs:
            lines.append(f'| `{service}` | `{verified_refs[service]}` | `{PLATFORM}` |')
        else:
            lines.append(f'| `{service}` | not verified | — |')
    text = '\n'.join(lines) + '\n'
    with target.open('a', encoding='utf-8') as summary:
        summary.write(text)
    print(text, end='', flush=True)
    return 0 if passed else 1


def _interrupted(_signum, _frame):
    raise SmokeFailure('job was interrupted')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-context', action='store_true')
    parser.add_argument('--cleanup', action='store_true')
    parser.add_argument('--summary', action='store_true')
    parser.add_argument('--source', type=Path)
    parser.add_argument('--release-set', type=Path)
    args = parser.parse_args()
    try:
        require_runner(os.environ)
        if args.check_context:
            return 0
        temp = Path(os.environ['RUNNER_TEMP']).resolve()
        report = temp / 'wangsh-release-image-report'
        if args.summary:
            return publish_summary(report / 'summary.json', temp / MANIFEST_FILE, Path(os.environ['GITHUB_STEP_SUMMARY']),
                                   job_status=os.environ.get('JOB_STATUS'), smoke=os.environ.get('SMOKE_OUTCOME'),
                                   recovery=os.environ.get('RECOVERY_OUTCOME'))
        source = args.source.resolve()
        if source != Path(os.environ['GITHUB_WORKSPACE']).resolve() / 'candidate':
            raise SmokeFailure('unexpected checkout path')
        os.umask(0o077)
        scratch = temp / 'wangsh-official-image-session'
        identity = scratch / 'job-id'
        owner = f"{os.environ['GITHUB_RUN_ID']}-{os.environ['GITHUB_RUN_ATTEMPT']}"
        if args.cleanup:
            if not scratch.exists():
                return 0
            if scratch.resolve() != scratch or not identity.is_file() or identity.read_text() != owner:
                raise SmokeFailure('unexpected recovery state path or job owner')
            recover_cleanup(source, scratch, report)
            shutil.rmtree(scratch)
            return 0
        manifest = args.release_set.resolve()
        if manifest != temp / MANIFEST_FILE:
            raise SmokeFailure('unexpected manifest path')
        scratch.mkdir()
        identity.write_text(owner)
        report.mkdir()
        signal.signal(signal.SIGTERM, _interrupted)
        signal.signal(signal.SIGINT, _interrupted)
        return execute(source, manifest, scratch, report)
    except (SmokeFailure, OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.TimeoutExpired) as error:
        print(error if isinstance(error, SmokeFailure) else type(error).__name__, file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
