#!/usr/bin/env python3
from __future__ import annotations

import argparse
import codecs
import os
import selectors
import subprocess
import sys
import time

from run import collect_sensitive_values, redact_sensitive_output


def _stream_redacted_output(
    process: subprocess.Popen[bytes],
    sensitive_values: list[str],
) -> None:
    assert process.stdout is not None
    stdout = process.stdout
    fd = stdout.fileno()
    os.set_blocking(fd, False)
    selector = selectors.DefaultSelector()
    selector.register(fd, selectors.EVENT_READ)
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    text_buffer = ""
    held_line: str | None = None
    eof = False
    exit_seen_at: float | None = None

    def emit_complete_line(line: str) -> None:
        nonlocal held_line
        if held_line is None:
            held_line = line
            return
        redacted = redact_sensitive_output(
            f"{held_line}{line}",
            sensitive_values,
        )
        line_end = redacted.find("\n")
        if line_end < 0:
            held_line = redacted
            return
        sys.stdout.write(redacted[: line_end + 1])
        sys.stdout.flush()
        held_line = redacted[line_end + 1 :]

    def consume_text(text: str) -> None:
        nonlocal text_buffer
        text_buffer += text
        while "\n" in text_buffer:
            line, text_buffer = text_buffer.split("\n", 1)
            emit_complete_line(f"{line}\n")

    try:
        while True:
            events = selector.select(timeout=0.05) if not eof else []
            for key, _ in events:
                while True:
                    try:
                        chunk = os.read(key.fd, 65536)
                    except BlockingIOError:
                        break
                    if not chunk:
                        eof = True
                        selector.unregister(key.fd)
                        break
                    consume_text(decoder.decode(chunk))

            return_code = process.poll()
            if return_code is not None and exit_seen_at is None:
                exit_seen_at = time.monotonic()
            if eof and return_code is not None:
                break
            if exit_seen_at is not None and time.monotonic() - exit_seen_at >= 0.25:
                break
            if eof:
                time.sleep(0.01)
    finally:
        selector.close()
        stdout.close()

    consume_text(decoder.decode(b"", final=True))
    remaining = f"{held_line or ''}{text_buffer}"
    if remaining:
        sys.stdout.write(redact_sensitive_output(remaining, sensitive_values))
        sys.stdout.flush()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run a command while redacting its combined stdout and stderr.",
    )
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    command = list(args.command)
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        parser.error("a command is required after --")

    child_env = os.environ.copy()
    child_env.setdefault("PYTHONUNBUFFERED", "1")
    sensitive_values = collect_sensitive_values(child_env)

    try:
        process = subprocess.Popen(
            command,
            env=child_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=False,
            bufsize=0,
        )
    except OSError as exc:
        message = redact_sensitive_output(f"unable to execute command: {exc}\n", sensitive_values)
        sys.stderr.write(message)
        return 127

    _stream_redacted_output(process, sensitive_values)
    return_code = process.wait()
    if return_code < 0:
        return 128 + abs(return_code)
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
