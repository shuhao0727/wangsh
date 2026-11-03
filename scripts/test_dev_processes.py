#!/usr/bin/env python3
"""Isolated stdlib tests; no real process queries, signals, or sleeps.

Run: python3 -I -B scripts/test_dev_processes.py
"""

import contextlib
import importlib.util
import io
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


SPEC = importlib.util.spec_from_file_location(
    "wangsh_dev_processes", Path(__file__).with_name("dev-processes.py")
)
helper = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = helper
SPEC.loader.exec_module(helper)


class ProcessTests(unittest.TestCase):
    UID = 501
    BIRTH = "Mon Nov  2 10:00:00 2026"

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="dev processes ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "physical project"
        self.backend = self.root / "backend"
        self.frontend = self.root / "frontend"
        self.backend.mkdir(parents=True)
        (self.frontend / "node_modules/vite/bin").mkdir(parents=True)
        (self.frontend / "node_modules/.bin").mkdir()
        self.vite = self.frontend / "node_modules/vite/bin/vite.js"
        self.vite.write_text("// fixture\n", encoding="utf-8")
        self.bin_vite = self.frontend / "node_modules/.bin/vite"
        self.bin_vite.symlink_to("../vite/bin/vite.js")
        self.logical = Path(self.temp.name) / "logical project"
        self.logical.symlink_to(self.root, target_is_directory=True)
        self.processes = {}
        self.listeners = set()
        self.calls = []
        self.signals = []
        self.args_reads = {}
        self.query_failure = None
        self.cwd_fields = None
        self.on_args = None
        self.on_term = None
        self.on_kill = None
        self.on_sleep = None
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        self.run_mock = self.patches.enter_context(
            mock.patch.object(helper.subprocess, "run", side_effect=self.fake_run)
        )
        for name in ("Popen", "check_output", "check_call", "call"):
            self.patches.enter_context(mock.patch.object(
                helper.subprocess, name, side_effect=AssertionError("unexpected subprocess API")
            ))
        self.kill_mock = self.patches.enter_context(
            mock.patch.object(helper.os, "kill", side_effect=self.fake_kill)
        )
        self.patches.enter_context(mock.patch.object(helper.os, "getuid", return_value=self.UID))
        self.sleep_mock = self.patches.enter_context(
            mock.patch.object(helper.time, "sleep", side_effect=self.fake_sleep)
        )

    def add(self, pid, *, command=None, comm="python3", cwd=None, uid=UID,
            birth=BIRTH, ppid=1, survives=False):
        self.processes[pid] = {
            "pid": pid, "uid": uid, "ppid": ppid, "birth": birth,
            "comm": comm, "command": command or "python3 -m uvicorn main:app --reload",
            "cwd": str(cwd or self.backend), "survives": survives,
        }
        return self.processes[pid]

    def frontend_process(self, pid=41003, *, cli=None, cwd=None, comm="node", **kwargs):
        return self.add(pid, comm=comm, cwd=cwd or self.frontend,
                        command=f"{comm} {cli or self.bin_vite} --port 6608", **kwargs)

    def fake_run(self, argv, **kwargs):
        argv = list(argv)
        self.calls.append(argv)
        self.assertFalse(kwargs.get("shell", False))
        executable = Path(argv[0]).name
        self.assertIn(executable, ("ps", "lsof"), "only mocked ps/lsof are permitted")
        if self.query_failure and self.query_failure(argv):
            return subprocess.CompletedProcess(argv, 2, "", "private-command SECRET=value")
        if executable == "ps":
            if "-axo" in argv:
                output = "".join(
                    f"{p['pid']} {p['uid']} {p['ppid']} {p['comm']}\n"
                    for p in sorted(self.processes.values(), key=lambda row: row["pid"])
                )
                return subprocess.CompletedProcess(argv, 0, output, "")
            self.assertIn("-p", argv)
            pid = int(argv[argv.index("-p") + 1])
            row = self.processes.get(pid)
            if row is None:
                return subprocess.CompletedProcess(argv, 1, "", "")
            field = argv[argv.index("-o") + 1]
            if field == "args=":
                count = self.args_reads.get(pid, 0) + 1
                self.args_reads[pid] = count
                if self.on_args:
                    self.on_args(pid, count)
                row = self.processes.get(pid)
                if row is None:
                    return subprocess.CompletedProcess(argv, 1, "", "")
                output = (row["command"] or "") + "\n"
            else:
                self.assertEqual(field, "pid=,uid=,ppid=,lstart=,comm=")
                output = (f"{pid} {row['uid']} {row['ppid']} "
                          f"{row['birth'] or '-'} {row['comm']}\n")
            return subprocess.CompletedProcess(argv, 0, output, "")
        if "-p" in argv:
            pid = int(argv[argv.index("-p") + 1])
            row = self.processes.get(pid)
            if row is None or row["cwd"] is None:
                return subprocess.CompletedProcess(argv, 1, "", "")
            fields = self.cwd_fields or (f"p{pid}", f"n{row['cwd']}")
            return subprocess.CompletedProcess(argv, 0, "\n".join(fields) + "\n", "")
        self.assertIn("-sTCP:LISTEN", argv)
        self.assertTrue(any(arg.startswith("-iTCP:") for arg in argv))
        output = "".join(f"{pid}\n" for pid in sorted(self.listeners))
        return subprocess.CompletedProcess(argv, 0 if output else 1, output, "")

    def fake_kill(self, pid, signum):
        self.assertIn(signum, (signal.SIGTERM, signal.SIGKILL))
        self.assertIn(pid, self.processes, "no process outside explicit fixtures may be signalled")
        self.signals.append((pid, signum))
        if signum == signal.SIGTERM:
            if self.on_term:
                self.on_term(pid)
            elif not self.processes[pid]["survives"]:
                self.processes.pop(pid)
                self.listeners.discard(pid)
        elif self.on_kill:
            self.on_kill(pid)
        else:
            self.processes.pop(pid)
            self.listeners.discard(pid)

    def fake_sleep(self, _seconds):
        if self.on_sleep:
            self.on_sleep()

    def cli(self, *args, root=None):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            result = helper.main(["--root", str(root or self.root), *args])
        return result, out.getvalue(), err.getvalue()

    def assert_error(self, result):
        self.assertEqual(result, (1, "", helper.ERROR + "\n"))
        self.assertNotIn("SECRET", result[2])
        self.assertNotIn("private-command", result[2])

    def test_empty_list_and_stop_are_successful_and_silent(self):
        self.assertEqual(self.cli("list"), (0, "", ""))
        self.assertEqual(self.cli("stop"), (0, "", ""))
        self.kill_mock.assert_not_called()

    def test_owned_backend_worker_and_status_counts(self):
        self.add(41001)
        self.add(41002, command="python3 -m celery -A app.core.celery_app:celery_app worker -Q celery,typst")
        self.frontend_process()
        self.assertEqual(self.cli("list"), (0, "41001\n41002\n41003\n", ""))
        for kind, pid in (("backend", 41001), ("worker", 41002), ("frontend", 41003)):
            with self.subTest(kind=kind):
                code, output, error = self.cli("list", "--kind", kind)
                self.assertEqual((code, output, error), (0, f"{pid}\n", ""))
                self.assertEqual(len(output.splitlines()), 1)
        self.kill_mock.assert_not_called()

    def test_explicit_cli_and_python_flags(self):
        self.add(41001, command="python3 -I -u -m uvicorn main:app --reload")
        self.add(41002, command="python3 /usr/local/bin/celery -A app.core.celery_app:celery_app worker")
        self.add(41003, comm="celery", command="celery -A app.core.celery_app:celery_app worker")
        self.add(41004, comm="uvicorn", command="uvicorn main:app --reload")
        self.assertEqual(self.cli("list"), (0, "41001\n41002\n41003\n41004\n", ""))

    def python_alias(self):
        interpreter = Path(self.temp.name) / "Python Runtime/bin/python3.11"
        interpreter.parent.mkdir(parents=True, exist_ok=True)
        interpreter.write_text("# synthetic executable, never run\n", encoding="utf-8")
        interpreter.chmod(0o755)
        alias = self.backend / "venv/bin/python"
        alias.parent.mkdir(parents=True, exist_ok=True)
        alias.symlink_to(interpreter)
        return interpreter, alias

    def test_spaced_python_venv_alias_resolves_to_comm_for_backend_and_worker(self):
        interpreter, alias = self.python_alias()
        self.add(41001, comm=str(interpreter), command=f"{alias} -I -u -m uvicorn main:app --reload")
        logical_alias = self.logical / "backend/venv/bin/python"
        self.add(41002, comm=str(interpreter), command=f"{logical_alias} -m celery -A app.core.celery_app:celery_app worker")
        self.assertEqual(self.cli("list"), (0, "41001\n41002\n", ""))
        self.assertEqual(self.cli("stop"), (0, "", ""))
        self.assertEqual(self.signals, [(41001, signal.SIGTERM), (41002, signal.SIGTERM)])

    def test_spaced_python_alias_missing_mismatched_or_nonexecutable_is_unknown(self):
        interpreter, alias = self.python_alias()
        row = self.add(41001, comm=str(interpreter), command=f"{alias} -m uvicorn main:app")
        for case in ("missing", "mismatched", "nonexecutable"):
            with self.subTest(case=case):
                if case == "missing":
                    alias.unlink()
                elif case == "mismatched":
                    other = interpreter.with_name("python3.12")
                    other.write_text("# fixture\n", encoding="utf-8")
                    other.chmod(0o755)
                    alias.symlink_to(other)
                else:
                    alias.unlink()
                    alias.symlink_to(interpreter)
                    interpreter.chmod(0o644)
                row["command"] = f"{alias} -m uvicorn main:app"
                self.assert_error(self.cli("stop"))
                self.kill_mock.assert_not_called()

    def test_spaced_python_alias_outside_tree_is_not_accepted(self):
        interpreter, _alias = self.python_alias()
        foreign = Path(self.temp.name) / "foreign venv/bin/python"
        foreign.parent.mkdir(parents=True)
        foreign.symlink_to(interpreter)
        self.add(41001, comm=str(interpreter), command=f"{foreign} -m uvicorn main:app")
        self.assert_error(self.cli("stop"))
        self.kill_mock.assert_not_called()

    def test_foreign_python_even_in_backend_is_not_owned(self):
        for pid, command in enumerate((
            "python3 -m http.server 8000", "python3 notes.py uvicorn main:app",
            "python3 -c print('uvicorn main:app')", "python3 -m uvicorn other:app",
            "python3 -m celery -A other_app worker",
            "python3 -m celery -A app.core.celery_app:celery_app beat",
        ), start=41010):
            self.add(pid, command=command)
        self.assertEqual(self.cli("stop"), (0, "", ""))
        self.kill_mock.assert_not_called()

    def test_other_cwd_and_other_uid_are_preserved(self):
        self.add(41001, cwd=self.root)
        self.add(41002, uid=self.UID + 1)
        self.assertEqual(self.cli("stop"), (0, "", ""))
        detailed_pids = {int(call[call.index("-p") + 1]) for call in self.calls if "-p" in call}
        self.assertNotIn(41002, detailed_pids)
        self.kill_mock.assert_not_called()

    def test_missing_cwd_uid_birth_or_command_is_unknown(self):
        for field in ("cwd", "uid", "birth", "command"):
            with self.subTest(field=field):
                self.processes.clear()
                row = self.add(41001)
                row[field] = None
                self.assert_error(self.cli("list"))
                self.assert_error(self.cli("stop"))
                self.kill_mock.assert_not_called()

    def test_unknown_candidate_prevents_partial_stop(self):
        self.add(41001)
        self.add(41002, birth=None)
        self.assert_error(self.cli("stop"))
        self.kill_mock.assert_not_called()

    def test_vite_only_exact_cli_not_vitest_or_foreign_node(self):
        self.frontend_process(41001)
        for pid, cli in enumerate((
            self.frontend / "node_modules/vitest/vitest.mjs",
            self.frontend / "node_modules/.bin/vitest",
            self.frontend / "node_modules/vite/bin/vite.js.extra",
            self.root / "other/node_modules/vite/bin/vite.js",
            self.frontend / "server.js",
        ), start=41010):
            self.frontend_process(pid, cli=cli)
        self.assertEqual(self.cli("list", "--kind", "frontend"), (0, "41001\n", ""))

    def test_physical_cwd_logical_symlink_and_unquoted_space_paths(self):
        cli = self.logical / "frontend/node_modules/.bin/vite"
        self.frontend_process(41001, cli=cli, cwd=self.frontend)
        self.assertEqual(self.cli("list", root=self.logical), (0, "41001\n", ""))
        self.assertEqual(self.cli("list", root=self.root), (0, "41001\n", ""))
        self.processes[41001]["cwd"] = str(self.logical / "frontend")
        self.assertEqual(self.cli("list", root=self.root), (0, "41001\n", ""))

    def test_space_in_node_executable_and_quoted_cli(self):
        node = str(Path(self.temp.name) / "Node Runtime/bin/node")
        self.frontend_process(41001, comm=node)
        self.frontend_process(41002, cli=f'"{self.vite}"')
        self.assertEqual(self.cli("list"), (0, "41001\n41002\n", ""))

    def test_vite_symlink_to_vitest_is_not_owned(self):
        self.bin_vite.unlink()
        target = self.frontend / "node_modules/vitest/vitest.mjs"
        target.parent.mkdir()
        target.write_text("// fixture\n", encoding="utf-8")
        self.bin_vite.symlink_to(target)
        self.frontend_process()
        self.assertEqual(self.cli("list"), (0, "", ""))

    def test_verified_reload_child_is_owned_but_unrelated_python_is_not(self):
        self.add(41001)
        spawn = "python3 -c from multiprocessing.spawn import spawn_main; spawn_main(tracker_fd=4, pipe_handle=8) --multiprocessing-fork"
        self.add(41002, command=spawn, ppid=41001)
        self.add(41003, command="python3 unrelated.py", ppid=41001)
        self.assertEqual(self.cli("list", "--kind", "backend"), (0, "41001\n41002\n", ""))

    def test_reload_child_without_verifiable_parent_is_unknown(self):
        self.add(41002, command="python3 -c from multiprocessing.spawn import spawn_main; spawn_main(tracker_fd=4, pipe_handle=8) --multiprocessing-fork", ppid=41999)
        self.assert_error(self.cli("stop"))
        self.kill_mock.assert_not_called()

    def test_port_limits_initial_candidates_not_post_term_liveness(self):
        self.add(41001, survives=True)
        self.add(41002)
        self.listeners = {41001}
        self.on_term = lambda pid: self.listeners.discard(pid)
        self.assertEqual(self.cli("stop", "--port", "8000"), (0, "", ""))
        self.assertEqual(self.signals, [(41001, signal.SIGTERM), (41001, signal.SIGKILL)])
        self.assertIn(41002, self.processes)
        listener_calls = [call for call in self.calls if "-sTCP:LISTEN" in call]
        self.assertEqual(len(listener_calls), 1)

    def test_list_port_and_kind_intersect_and_empty_port_is_normal(self):
        self.add(41001)
        self.frontend_process()
        self.listeners = {41003}
        self.assertEqual(self.cli("list", "--port", "6608"), (0, "41003\n", ""))
        self.assertEqual(self.cli("list", "--kind", "backend", "--port", "6608"), (0, "", ""))
        self.listeners.clear()
        self.assertEqual(self.cli("stop", "--port", "8000"), (0, "", ""))
        self.kill_mock.assert_not_called()

    def test_term_success_does_not_need_kill(self):
        self.add(41001)
        self.assertEqual(self.cli("stop"), (0, "", ""))
        self.assertEqual(self.signals, [(41001, signal.SIGTERM)])

    def test_birth_uid_cwd_and_command_changes_before_term_are_preserved(self):
        for field, value in (("birth", "Mon Nov  2 10:00:01 2026"), ("uid", 502),
                             ("cwd", str(self.root)), ("command", "python3 foreign.py")):
            with self.subTest(field=field):
                self.processes.clear()
                self.args_reads.clear()
                self.add(41001)
                def change(pid, count):
                    if count == 2:
                        self.processes[pid][field] = value
                self.on_args = change
                self.assert_error(self.cli("stop"))
                self.kill_mock.assert_not_called()

    def test_recycled_pid_after_term_is_never_killed(self):
        self.add(41001, survives=True)
        self.on_term = lambda pid: self.processes[pid].update(birth="Mon Nov  2 10:00:01 2026")
        self.assert_error(self.cli("stop"))
        self.assertEqual(self.signals, [(41001, signal.SIGTERM)])

    def test_identity_rechecked_immediately_before_kill(self):
        self.add(41001, survives=True)
        def change(pid, count):
            if self.signals and self.sleep_mock.call_count >= helper.TERM_POLLS:
                self.processes[pid]["birth"] = "Mon Nov  2 10:00:01 2026"
        self.on_args = change
        self.assert_error(self.cli("stop"))
        self.assertEqual(self.signals, [(41001, signal.SIGTERM)])

    def test_final_identity_change_or_survival_is_not_success(self):
        for recycled in (False, True):
            with self.subTest(recycled=recycled):
                self.processes.clear()
                self.signals.clear()
                self.add(41001, survives=True)
                self.on_kill = (lambda pid: self.processes[pid].update(
                    birth="Mon Nov  2 10:00:01 2026")) if recycled else (lambda pid: None)
                self.assert_error(self.cli("stop"))
                self.assertEqual(self.signals, [(41001, signal.SIGTERM), (41001, signal.SIGKILL)])

    def test_query_failures_are_fixed_generic_and_do_not_signal(self):
        self.add(41001)
        for predicate, args in (
            (lambda argv: "-axo" in argv, ("stop",)),
            (lambda argv: "args=" in argv, ("stop",)),
            (lambda argv: Path(argv[0]).name == "lsof", ("stop",)),
            (lambda argv: "-sTCP:LISTEN" in argv, ("list", "--port", "8000")),
        ):
            with self.subTest(args=args):
                self.query_failure = predicate
                self.assert_error(self.cli(*args))
                self.kill_mock.assert_not_called()

    def test_query_failure_after_term_does_not_kill_or_report_stopped(self):
        self.add(41001, survives=True)
        def fail_after_term(pid):
            self.query_failure = lambda argv: Path(argv[0]).name == "ps"
        self.on_term = fail_after_term
        self.assert_error(self.cli("stop"))
        self.assertEqual(self.signals, [(41001, signal.SIGTERM)])

    def test_lsof_optional_cwd_descriptor_is_accepted(self):
        self.add(41001)
        self.cwd_fields = ("p41001", "fcwd", f"n{self.backend}")
        self.assertEqual(self.cli("list"), (0, "41001\n", ""))

    def test_lsof_wrong_or_duplicate_descriptor_is_unknown(self):
        self.add(41001)
        for fields in (
            ("p41001", "f3", f"n{self.backend}"),
            ("p41001", "fcwd", "fcwd", f"n{self.backend}"),
            ("p41001", "p41999", f"n{self.backend}"),
            ("p41001", f"n{self.backend}", f"n{self.backend}"),
        ):
            with self.subTest(fields=fields):
                self.cwd_fields = fields
                self.assert_error(self.cli("stop"))
                self.kill_mock.assert_not_called()

    def test_reload_parent_exit_retains_unverifiable_child_and_reports_error(self):
        self.add(41001)
        self.add(41002, ppid=41001, survives=True, command="python3 -c from multiprocessing.spawn import spawn_main; spawn_main(tracker_fd=4, pipe_handle=8) --multiprocessing-fork")
        self.assert_error(self.cli("stop"))
        self.assertEqual(self.signals, [(41002, signal.SIGTERM), (41001, signal.SIGTERM)])
        self.assertIn(41002, self.processes)

    def test_reload_child_port_selection_verifies_unselected_parent(self):
        self.add(41001)
        self.add(41002, ppid=41001, command="python3 -c from multiprocessing.spawn import spawn_main; spawn_main(tracker_fd=4, pipe_handle=8) --multiprocessing-fork")
        self.listeners = {41002}
        self.assertEqual(self.cli("stop", "--port", "8000"), (0, "", ""))
        self.assertEqual(self.signals, [(41002, signal.SIGTERM)])
        self.assertIn(41001, self.processes)

    def test_signal_permission_failure_is_generic(self):
        self.add(41001)
        self.kill_mock.side_effect = PermissionError("SECRET=value")
        self.assert_error(self.cli("stop"))

    def test_invalid_cli_is_generic_and_does_not_query(self):
        for args in (("list", "--port", "0"), ("list", "--port", "65536"),
                     ("list", "--kind", "other"), ("stop", "--kind", "backend")):
            with self.subTest(args=args):
                self.assert_error(self.cli(*args))
        self.run_mock.assert_not_called()
        self.kill_mock.assert_not_called()


    def test_unreadable_unrelated_desktop_app_is_preserved_not_fatal(self):
        """Unreadable non-project Node/Python must not block a normal startup."""
        self.add(41001, comm="node", cwd="ANY", command="node /opt/unrelated/app.js")
        self.processes[41001]["cwd"] = None
        self.assertEqual(self.cli("list"), (0, "", ""))
        self.assertEqual(self.cli("stop"), (0, "", ""))
        self.kill_mock.assert_not_called()

    def test_unreadable_project_owned_candidate_stays_fail_closed(self):
        """A process whose argv/cwd proves this checkout must never be silently skipped."""
        self.add(41001, command=f"python3 -m uvicorn main:app --reload")
        self.processes[41001]["cwd"] = None
        self.assert_error(self.cli("stop"))
        self.kill_mock.assert_not_called()

    def test_port_selected_unreadable_candidate_stays_fail_closed(self):
        self.add(41001)
        self.processes[41001]["cwd"] = None
        self.listeners = {41001}
        self.assert_error(self.cli("stop", "--port", "8000"))
        self.kill_mock.assert_not_called()

    def test_utf8_and_non_utf8_cwd_paths_are_decoded_without_crashing(self):
        """LC_ALL=C lsof can return non-ASCII bytes; decoding must not abort the scan."""
        self.add(41001, cwd=self.backend)
        original = self.fake_run

        def fake_run(argv, **kwargs):
            result = original(argv, **kwargs)
            if Path(argv[0]).name == "lsof" and "-d" in argv and "cwd" in argv:
                raw = f"p41001\nfcwd\nn{self.backend}\n".encode("utf-8")
                return subprocess.CompletedProcess(argv, 0, raw.decode("utf-8"), "")
            return result

        self.run_mock.side_effect = fake_run
        self.assertEqual(self.cli("list"), (0, "41001\n", ""))


if __name__ == "__main__":
    unittest.main(verbosity=2)
