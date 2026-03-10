import json
import os
import re
import statistics
import subprocess
import sys
from pathlib import Path

API_URL = os.getenv("API_URL", "http://localhost:8000")
ROUNDS = int(os.getenv("ROUNDS", "50"))
TIMEOUT_SECONDS = os.getenv("TIMEOUT_SECONDS", "20")
USERNAME = os.getenv("USERNAME", "admin")
PASSWORD = os.getenv("PASSWORD", "wangshuhao0727")
LOG_DIR = Path(os.getenv("LOG_DIR", "/tmp/phasec_soak"))

TIME_RE = re.compile(r"^\[(\d\d):(\d\d):(\d\d)\] (.*)$")


def log(msg: str) -> None:
    print(msg, flush=True)


def to_seconds(ts: str) -> int:
    h, m, s = ts.split(":")
    return int(h) * 3600 + int(m) * 60 + int(s)


def delta(start: str | None, end: str | None) -> int | None:
    if not start or not end:
        return None
    d = to_seconds(end) - to_seconds(start)
    if d < 0:
        d += 24 * 3600
    return d


def run_once(idx: int) -> dict:
    env = os.environ.copy()
    env["API_URL"] = API_URL
    env["TIMEOUT_SECONDS"] = TIMEOUT_SECONDS
    env["USERNAME"] = USERNAME
    env["PASSWORD"] = PASSWORD
    proc = subprocess.run(
        [sys.executable, "scripts/smoke_pythonlab_print_visibility_probe.py"],
        cwd=str(Path(__file__).resolve().parents[1]),
        env=env,
        capture_output=True,
        text=True,
    )
    output = (proc.stdout or "") + ("\n" if proc.stdout and proc.stderr else "") + (proc.stderr or "")
    log_path = LOG_DIR / f"run_{idx}.log"
    log_path.write_text(output, encoding="utf-8")

    marks: dict[str, str] = {}
    for line in output.splitlines():
        m = TIME_RE.match(line)
        if not m:
            continue
        ts = ":".join(m.groups()[:3])
        msg = m.group(4)
        if msg.endswith("session ready") and "ready" not in marks:
            marks["ready"] = ts
        if msg.endswith("initialize ok") and "init" not in marks:
            marks["init"] = ts
        if msg.endswith("configurationDone ok") and "cfg" not in marks:
            marks["cfg"] = ts
        if "output[stdout]:" in msg and "out" not in marks:
            marks["out"] = ts
        if msg.endswith("phase c probe passed") and "pass" not in marks:
            marks["pass"] = ts

    rec = {
        "round": idx,
        "exit_code": proc.returncode,
        "passed": proc.returncode == 0,
        "ready_to_init": delta(marks.get("ready"), marks.get("init")),
        "init_to_cfg": delta(marks.get("init"), marks.get("cfg")),
        "cfg_to_first_output": delta(marks.get("cfg"), marks.get("out")),
        "total_ready_to_pass": delta(marks.get("ready"), marks.get("pass")),
        "log_file": str(log_path),
    }
    log(
        "round={round} code={exit_code} pass={passed} ready_to_init={ready_to_init} "
        "init_to_cfg={init_to_cfg} cfg_to_first_output={cfg_to_first_output} total_ready_to_pass={total_ready_to_pass}".format(
            **rec
        )
    )
    return rec


def avg(values: list[int]) -> float | None:
    if not values:
        return None
    return round(statistics.mean(values), 2)


def main() -> int:
    if ROUNDS <= 0:
        log("ROUNDS must be positive")
        return 2
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    records = [run_once(i) for i in range(1, ROUNDS + 1)]
    passed = [r for r in records if r["passed"]]
    failed = [r for r in records if not r["passed"]]

    summary = {
        "rounds": ROUNDS,
        "passed": len(passed),
        "failed": len(failed),
        "pass_rate": round(len(passed) * 100.0 / ROUNDS, 1),
        "avg_ready_to_init": avg([int(r["ready_to_init"]) for r in passed if r["ready_to_init"] is not None]),
        "avg_init_to_cfg": avg([int(r["init_to_cfg"]) for r in passed if r["init_to_cfg"] is not None]),
        "avg_cfg_to_first_output": avg(
            [int(r["cfg_to_first_output"]) for r in passed if r["cfg_to_first_output"] is not None]
        ),
        "avg_total_ready_to_pass": avg(
            [int(r["total_ready_to_pass"]) for r in passed if r["total_ready_to_pass"] is not None]
        ),
        "log_dir": str(LOG_DIR),
    }
    (LOG_DIR / "summary.json").write_text(
        json.dumps({"summary": summary, "records": records}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log("SUMMARY " + json.dumps(summary, ensure_ascii=False))
    if failed:
        log("FAILED_ROUNDS " + ",".join(str(r["round"]) for r in failed))
        return int(failed[0]["exit_code"] or 1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
