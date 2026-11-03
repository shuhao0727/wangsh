#!/usr/bin/env python3
"""Conservatively identify/stop this checkout's local development processes.

API (stdout from list contains only one PID per line):
    python3 -I -B scripts/dev-processes.py --root ROOT list [--kind KIND] [--port PORT]
    python3 -I -B scripts/dev-processes.py --root ROOT stop [--port PORT]

Only same-UID, physical backend/frontend cwd and explicit uvicorn/Celery/Vite
invocations qualify. A port restricts initial selection, never subsequent
liveness checks. Missing evidence/query failures/changed identities fail closed
with one fixed diagnostic, without printing commands or environment values.

ps/lsof identity checks and signals are necessarily non-atomic. PID + UID +
lstart + cwd + command (also comm/ppid) and repeated checks narrow, but DO NOT
completely eliminate, PID-reuse/exec races; lstart itself has second resolution.
No process group signals, shell evaluation, environment loading or PID files.
"""

import argparse
from dataclasses import dataclass
from datetime import datetime
import os
from pathlib import Path
import shlex
import signal
import subprocess
import sys
import time


ERROR = "Unable to safely verify development processes."
TERM_POLLS = 10
KILL_POLLS = 5
POLL_INTERVAL = 0.2
PS = "/bin/ps"
LSOF = "/usr/sbin/lsof" if sys.platform == "darwin" else "/usr/bin/lsof"


class UnsafeProcess(Exception):
    """Evidence is unavailable, inconsistent, or insufficient."""


class UnsafeProject(UnsafeProcess):
    """A candidate is listable as this checkout's process but cannot be verified."""


@dataclass(frozen=True)
class Row:
    pid: int
    uid: int
    ppid: int
    comm: str


@dataclass(frozen=True)
class Identity:
    pid: int
    uid: int
    ppid: int
    birth: str
    cwd: str
    comm: str
    command: str


@dataclass(frozen=True)
class Owned:
    identity: Identity
    kind: str
    parents: tuple = ()
    reload: bool = False


def _number(value, minimum=0):
    if not value or not value.isascii() or not value.isdecimal():
        raise UnsafeProcess()
    result = int(value)
    if result < minimum:
        raise UnsafeProcess()
    return result


def _family(comm):
    name = os.path.basename(comm).lower()
    if name in ("node", "nodejs", "uvicorn", "celery"):
        return name
    if name == "python":
        return "python"
    if name.startswith("python"):
        version = name[len("python"):].split(".")
        if version and all(part and part.isascii() and part.isdecimal() for part in version):
            return "python"
    return None


def _run(argv, *, allow_stderr=False):
    try:
        result = subprocess.run(
            argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", errors="surrogateescape",
            timeout=5, check=False,
            env={"LC_ALL": "C", "PATH": "/usr/bin:/bin:/usr/sbin:/sbin"},
        )
    except (OSError, subprocess.SubprocessError, UnicodeError) as exc:
        raise UnsafeProcess() from exc
    # Never relay a tool's diagnostics: they may contain private argv/path data.
    if (result.stderr and not allow_stderr) or result.returncode not in (0, 1):
        raise UnsafeProcess()
    return result


def _table():
    result = _run([PS, "-ww", "-axo", "pid=,uid=,ppid=,comm="])
    if result.returncode != 0:
        raise UnsafeProcess()
    rows = {}
    for line in result.stdout.splitlines():
        fields = line.split(None, 3)
        if len(fields) != 4:
            raise UnsafeProcess()
        pid, uid, ppid = (_number(value) for value in fields[:3])
        if pid < 1 or pid in rows or not fields[3].strip():
            raise UnsafeProcess()
        rows[pid] = Row(pid, uid, ppid, fields[3].strip())
    return rows


def _physical(path):
    try:
        resolved = os.path.realpath(path, strict=True)
    except (OSError, ValueError) as exc:
        raise UnsafeProcess() from exc
    if not os.path.isabs(resolved) or not os.path.isdir(resolved):
        raise UnsafeProcess()
    return resolved


def _executable_tail(command, comm):
    """Consume a whole executable, including a literal unquoted spaced comm."""
    command = command.lstrip()
    for executable in sorted({comm, os.path.basename(comm)}, key=len, reverse=True):
        for spelling in (executable, shlex.quote(executable), '"' + executable + '"'):
            if command == spelling:
                return ""
            if command.startswith(spelling) and command[len(spelling):len(spelling) + 1].isspace():
                return command[len(spelling):].lstrip()
    # ps args often uses a venv alias whereas comm names the real interpreter.
    # Read only the first shell-style word, without evaluating anything.
    lexer = shlex.shlex(command, posix=True)
    lexer.whitespace_split = True
    lexer.commenters = ""
    try:
        executable = next(lexer)
    except (StopIteration, ValueError):
        return None
    if _family(executable) != _family(comm):
        return None
    # Find the literal end; this also handles quoted executable paths.
    for spelling in (executable, shlex.quote(executable), '"' + executable + '"'):
        if command == spelling:
            return ""
        if command.startswith(spelling) and command[len(spelling):len(spelling) + 1].isspace():
            return command[len(spelling):].lstrip()
    return None


def _python_alias_tail(identity):
    """Recover an unquoted spaced venv argv[0] only with filesystem proof.

    The alias's containing directory must physically belong to this backend;
    its executable target must be the exact interpreter reported by ps comm.
    An unparseable/unprovable interpreter is unknown, not an empty selection.
    """
    command = identity.command.lstrip()
    for end, character in enumerate(command):
        if not character.isspace():
            continue
        executable = command[:end]
        if _family(executable) != "python":
            continue
        path = Path(executable)
        if not path.is_absolute() or not os.path.isabs(identity.comm):
            raise UnsafeProcess()
        try:
            parent = path.parent.resolve(strict=True)
            backend = Path(identity.cwd)
            target = path.resolve(strict=True)
            interpreter = Path(identity.comm).resolve(strict=True)
            if (parent != backend and backend not in parent.parents
                    or target != interpreter or not target.is_file()
                    or not os.access(target, os.X_OK)):
                raise UnsafeProcess()
        except (OSError, RuntimeError, ValueError) as exc:
            raise UnsafeProcess() from exc
        return command[end:].lstrip()
    raise UnsafeProcess()


def _reload_code(tokens):
    """Only CPython's specific multiprocessing helpers, never arbitrary -c."""
    code = " ".join(tokens)
    prefix = "from multiprocessing.spawn import spawn_main;"
    if code.startswith(prefix):
        rest = code[len(prefix):].lstrip()
        if not rest.startswith("spawn_main(") or not rest.endswith(") --multiprocessing-fork"):
            return False
        arguments = rest[len("spawn_main("):-len(") --multiprocessing-fork")]
        seen = set()
        for item in arguments.split(","):
            parts = item.strip().split("=", 1)
            if len(parts) != 2 or parts[0] not in ("tracker_fd", "pipe_handle", "parent_pid"):
                return False
            if parts[0] in seen or not parts[1].strip().isascii() or not parts[1].strip().isdecimal():
                return False
            seen.add(parts[0])
        return "pipe_handle" in seen
    prefix = "from multiprocessing.resource_tracker import main;"
    if code.startswith(prefix):
        rest = code[len(prefix):].lstrip()
        return (rest.startswith("main(") and rest.endswith(")")
                and rest[5:-1].isascii() and rest[5:-1].isdecimal())
    return False


def _backend_command(identity):
    family = _family(identity.comm)
    tail = _executable_tail(identity.command, identity.comm)
    if tail is None and family == "python":
        tail = _python_alias_tail(identity)
    if tail is None:
        return None
    try:
        tokens = shlex.split(tail, comments=False, posix=True)
    except ValueError as exc:
        raise UnsafeProcess() from exc
    module = family
    if family == "python":
        while tokens and tokens[0] in ("-I", "-B", "-u", "-E", "-s", "-S", "-O", "-OO", "-q"):
            tokens.pop(0)
        if tokens[:1] == ["-c"]:
            return ("reload-child", False) if _reload_code(tokens[1:]) else None
        if tokens[:1] == ["-m"] and len(tokens) >= 2:
            module, tokens = tokens[1], tokens[2:]
        elif tokens and os.path.basename(tokens[0]) in ("uvicorn", "celery"):
            module, tokens = os.path.basename(tokens[0]), tokens[1:]
        else:
            return None
    if module == "uvicorn" and tokens[:1] == ["main:app"]:
        return "backend", "--reload" in tokens[1:]
    if (module == "celery" and tokens[:3] == ["-A", "app.core.celery_app:celery_app", "worker"]
            and not any(token in ("-A", "--app") or token.startswith("--app=")
                        or token.startswith("-A") for token in tokens[3:])):
        return "worker", False
    return None


class Inspector:
    def __init__(self, root):
        self.uid = os.getuid()
        self.root = _physical(root)
        self.backend = _physical(os.path.join(self.root, "backend"))
        self.frontend = _physical(os.path.join(self.root, "frontend"))
        self.rows = {}
        self.cache = {}
        self.classified = {}

    def _absent(self, pid):
        # ps exit 1 alone is not evidence that the process is gone.
        if pid in _table():
            raise UnsafeProcess()
        return True

    def _metadata(self, pid):
        result = _run([PS, "-ww", "-p", str(pid), "-o", "pid=,uid=,ppid=,lstart=,comm="])
        if result.returncode == 1 and not result.stdout:
            self._absent(pid)
            return None
        if result.returncode != 0 or len(result.stdout.splitlines()) != 1:
            raise UnsafeProcess()
        fields = result.stdout.strip().split(None, 8)
        if len(fields) != 9:
            raise UnsafeProcess()
        observed_pid, uid, ppid = (_number(value) for value in fields[:3])
        birth = " ".join(fields[3:8])
        try:
            datetime.strptime(birth, "%a %b %d %H:%M:%S %Y")
        except ValueError as exc:
            raise UnsafeProcess() from exc
        if observed_pid != pid or not fields[8].strip():
            raise UnsafeProcess()
        return observed_pid, uid, ppid, birth, fields[8].strip()

    def read(self, pid, initial=None):
        before = self._metadata(pid)
        if before is None:
            return None
        if before[1] != self.uid:
            raise UnsafeProcess()
        if initial is not None and (before[0], before[1], before[2], before[4]) != (
                initial.pid, initial.uid, initial.ppid, initial.comm):
            raise UnsafeProcess()
        result = _run([PS, "-ww", "-p", str(pid), "-o", "args="])
        if result.returncode == 1 and not result.stdout:
            self._absent(pid)
            return None
        command = result.stdout.rstrip("\n")
        if (result.returncode != 0 or not command.strip()
                or any(character in command for character in ("\n", "\r", "\x00"))):
            raise UnsafeProcess()
        result = _run([LSOF, "-a", "-p", str(pid), "-d", "cwd", "-Fn"], allow_stderr=True)
        if result.returncode == 1 and not result.stdout:
            self._absent(pid)
            return None
        lines = result.stdout.splitlines()
        names = [line[1:] for line in lines if line.startswith("n")]
        if (result.returncode != 0 or not lines or lines[0] != f"p{pid}"
                or len(names) != 1 or not os.path.isabs(names[0])
                or lines[1:] not in (["n" + names[0]], ["fcwd", "n" + names[0]])):
            raise UnsafeProcess()
        cwd = _physical(names[0])
        after = self._metadata(pid)
        if after is None:
            return None
        if before != after:
            raise UnsafeProcess()
        return Identity(before[0], before[1], before[2], before[3], cwd, before[4], command.strip())

    def _vite(self, identity):
        tail = _executable_tail(identity.command, identity.comm)
        if not tail:
            return False
        canonical = Path(self.frontend) / "node_modules/vite/bin/vite.js"
        try:
            canonical = canonical.resolve(strict=True)
        except OSError:
            return False
        if canonical.name != "vite.js":
            return False
        candidates = []
        try:
            words = shlex.split(tail, comments=False, posix=True)
            if words:
                candidates.append(words[0])
        except ValueError as exc:
            raise UnsafeProcess() from exc
        # macOS ps does not quote argv. Accept a complete literal CLI prefix,
        # including spaces/aliases, only if its physical file is this Vite CLI.
        for suffix in ("node_modules/.bin/vite", "node_modules/vite/bin/vite.js"):
            end = tail.find(suffix)
            if end >= 0:
                end += len(suffix)
                if end == len(tail) or tail[end].isspace():
                    candidates.append(tail[:end])
        for candidate in candidates:
            if os.path.basename(candidate) not in ("vite", "vite.js"):
                continue
            path = Path(candidate)
            if not path.is_absolute():
                path = Path(identity.cwd) / path
            try:
                if path.resolve(strict=True) == canonical and canonical.is_file():
                    return True
            except (OSError, ValueError):
                continue
        return False

    def _identity(self, pid):
        if pid not in self.cache:
            row = self.rows.get(pid)
            if row is None or row.uid != self.uid or _family(row.comm) is None:
                raise UnsafeProcess()
            self.cache[pid] = self.read(pid, row)
        return self.cache[pid]

    def _looks_project(self, pid):
        """Best-effort proof that an unreadable candidate may be this checkout's."""
        try:
            result = _run([PS, "-ww", "-p", str(pid), "-o", "args="], allow_stderr=True)
        except UnsafeProcess:
            result = None
        if result is not None and result.returncode == 0:
            command = result.stdout.strip()
            if any(path in command for path in (self.root, self.backend, self.frontend)):
                return True
            if any(marker in command for marker in (
                "uvicorn main:app", "app.core.celery_app:celery_app",
                "node_modules/.bin/vite", "node_modules/vite/bin/vite.js",
                "multiprocessing.spawn",
            )):
                return True
        try:
            result = _run([LSOF, "-a", "-p", str(pid), "-d", "cwd", "-Fn"], allow_stderr=True)
        except UnsafeProcess:
            return False
        if result.returncode != 0:
            return False
        names = [line[1:] for line in result.stdout.splitlines() if line.startswith("n")]
        if len(names) != 1 or not os.path.isabs(names[0]):
            return False
        try:
            cwd = _physical(names[0])
        except UnsafeProcess:
            return False
        return cwd in (self.backend, self.frontend)

    def classify(self, pid, visiting=frozenset()):
        if pid in visiting:
            raise UnsafeProcess()
        if pid in self.classified:
            return self.classified[pid]
        identity = self._identity(pid)
        owned = None
        if identity is not None:
            family = _family(identity.comm)
            if identity.cwd == self.frontend and family in ("node", "nodejs"):
                try:
                    vite = self._vite(identity)
                except UnsafeProcess as exc:
                    raise UnsafeProject() from exc
                if vite:
                    owned = Owned(identity, "frontend")
            elif identity.cwd == self.backend and family in ("python", "uvicorn", "celery"):
                try:
                    description = _backend_command(identity)
                except UnsafeProcess as exc:
                    raise UnsafeProject() from exc
                if description is not None:
                    kind, reload = description
                    if kind == "reload-child":
                        try:
                            parent = self.classify(identity.ppid, visiting | {pid})
                        except UnsafeProcess as exc:
                            raise UnsafeProject() from exc
                        if parent is None or parent.kind != "backend" or not parent.reload:
                            raise UnsafeProject()
                        owned = Owned(identity, "backend", (parent.identity,) + parent.parents, True)
                    else:
                        owned = Owned(identity, kind, reload=reload)
        self.classified[pid] = owned
        return owned

    def collect(self, port=None, kind="all"):
        self.rows = _table()
        selected = None
        if port is not None:
            result = _run([LSOF, "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"])
            if result.returncode == 1:
                if result.stdout:
                    raise UnsafeProcess()
                selected = set()
            else:
                selected = {_number(line.strip(), 1) for line in result.stdout.splitlines()}
            # A listener omitted by ps is not assumed foreign or already gone.
            for pid in selected - self.rows.keys():
                self._absent(pid)
        result = []
        for pid, row in sorted(self.rows.items()):
            if (row.uid != self.uid or _family(row.comm) is None or pid <= 1
                    or pid == os.getpid() or (selected is not None and pid not in selected)):
                continue
            try:
                owned = self.classify(pid)
            except UnsafeProcess:
                # Unrelated desktop apps may be unreadable or exit mid-scan; preserve
                # them. A port-selected candidate or an obvious project process stays
                # fail-closed because it could be the service we are about to stop.
                if selected is not None or self._looks_project(pid):
                    raise
                continue
            if owned is not None and (kind == "all" or owned.kind == kind):
                result.append(owned)
        return result

    def verify(self, owned):
        current = self.read(owned.identity.pid)
        if current is None:
            return False
        if current != owned.identity:
            raise UnsafeProcess()
        for parent in owned.parents:
            if self.read(parent.pid) != parent:
                raise UnsafeProcess()
        return True

    def send(self, owned, signum):
        if not self.verify(owned):
            return
        try:
            os.kill(owned.identity.pid, signum)
        except ProcessLookupError:
            if self.read(owned.identity.pid) is not None:
                raise UnsafeProcess()
        except OSError as exc:
            raise UnsafeProcess() from exc

    def wait(self, owned, polls):
        remaining = owned
        for _ in range(polls):
            if not remaining:
                break
            time.sleep(POLL_INTERVAL)
            remaining = [process for process in remaining if self.verify(process)]
        return remaining

    def stop(self, owned):
        # Preflight every selected identity before signalling any of them.
        remaining = [process for process in owned if self.verify(process)]
        # Verified children first, so signalling a parent does not invalidate an
        # otherwise-live child's provenance before its TERM opportunity.
        remaining.sort(key=lambda process: (-len(process.parents), process.identity.pid))
        for process in remaining:
            self.send(process, signal.SIGTERM)
        remaining = self.wait(remaining, TERM_POLLS)
        for process in remaining:
            self.send(process, signal.SIGKILL)
        if self.wait(remaining, KILL_POLLS):
            raise UnsafeProcess()


class Parser(argparse.ArgumentParser):
    def error(self, _message):
        raise UnsafeProcess()


def main(argv=None):
    try:
        parser = Parser(description=__doc__, allow_abbrev=False)
        parser.add_argument("--root", required=True)
        subparsers = parser.add_subparsers(dest="action", required=True, parser_class=Parser)
        listing = subparsers.add_parser("list", allow_abbrev=False)
        listing.add_argument("--kind", choices=("backend", "frontend", "worker", "all"), default="all")
        stopping = subparsers.add_parser("stop", allow_abbrev=False)
        for command in (listing, stopping):
            command.add_argument("--port", type=int)
        args = parser.parse_args(argv)
        if args.port is not None and not 1 <= args.port <= 65535:
            raise UnsafeProcess()
        inspector = Inspector(args.root)
        owned = inspector.collect(args.port, getattr(args, "kind", "all"))
        if args.action == "list":
            output = "".join(f"{process.identity.pid}\n" for process in owned)
            sys.stdout.write(output)
        else:
            inspector.stop(owned)
        return 0
    except (UnsafeProcess, OSError, ValueError, UnicodeError):
        sys.stderr.write(ERROR + "\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
