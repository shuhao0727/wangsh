"""Remove provider reasoning envelopes from assistant answers.

Dify's DeepSeek plugin may encode ``reasoning_content`` inside ``<think>``
blocks in the same text stream as the user-visible answer.  The incremental
filter is used for SSE deltas; ``sanitize_assistant_answer`` protects storage
and read boundaries for complete strings.
"""

from __future__ import annotations

from typing import Any

_START_TAG = "<think>"
_END_TAG = "</think>"
_DIFY_REASONING_MARKER = "<!--dify-deepseek-reasoning-->"
_VISIBLE_MARKERS = (_START_TAG, _DIFY_REASONING_MARKER)


def _index_ignore_case(value: str, needle: str) -> int:
    return value.lower().find(needle.lower())


def _longest_marker_prefix_suffix(value: str, markers: tuple[str, ...]) -> int:
    lower_value = value.lower()
    longest = 0
    for marker in markers:
        lower_marker = marker.lower()
        max_length = min(len(lower_value), len(lower_marker) - 1)
        for length in range(max_length, longest, -1):
            if lower_value.endswith(lower_marker[:length]):
                longest = length
                break
    return longest


class ReasoningContentFilter:
    """Stateful filter that is safe when protected markers cross chunks."""

    def __init__(self) -> None:
        self._buffer = ""
        self._hidden = False
        self._finished = False

    def push(self, chunk: str) -> str:
        if self._finished or not chunk:
            return ""
        self._buffer += chunk
        output: list[str] = []

        while self._buffer:
            if self._hidden:
                end_index = _index_ignore_case(self._buffer, _END_TAG)
                if end_index >= 0:
                    self._buffer = self._buffer[end_index + len(_END_TAG) :]
                    self._hidden = False
                    continue
                pending_length = _longest_marker_prefix_suffix(
                    self._buffer, (_END_TAG,)
                )
                self._buffer = self._buffer[len(self._buffer) - pending_length :]
                break

            start_index = _index_ignore_case(self._buffer, _START_TAG)
            marker_index = _index_ignore_case(
                self._buffer, _DIFY_REASONING_MARKER
            )
            candidates = [index for index in (start_index, marker_index) if index >= 0]
            if candidates:
                next_index = min(candidates)
                output.append(self._buffer[:next_index])
                if next_index == start_index:
                    self._buffer = self._buffer[next_index + len(_START_TAG) :]
                    self._hidden = True
                else:
                    self._buffer = self._buffer[
                        next_index + len(_DIFY_REASONING_MARKER) :
                    ]
                continue

            pending_length = _longest_marker_prefix_suffix(
                self._buffer, _VISIBLE_MARKERS
            )
            output.append(self._buffer[: len(self._buffer) - pending_length])
            self._buffer = self._buffer[len(self._buffer) - pending_length :]
            break

        return "".join(output)

    def finish(self) -> str:
        if self._finished:
            return ""
        self._finished = True
        if self._hidden:
            self._buffer = ""
            return ""

        pending_length = _longest_marker_prefix_suffix(
            self._buffer, _VISIBLE_MARKERS
        )
        output = "" if pending_length == len(self._buffer) else self._buffer
        self._buffer = ""
        return output


def sanitize_assistant_answer(content: str | None) -> str:
    if not content:
        return ""
    reasoning_filter = ReasoningContentFilter()
    return reasoning_filter.push(content) + reasoning_filter.finish()


def sanitize_reasoning_strings(value: Any) -> Any:
    """Recursively sanitize strings in a JSON-compatible response payload."""

    if isinstance(value, str):
        return sanitize_assistant_answer(value)
    if isinstance(value, list):
        return [sanitize_reasoning_strings(item) for item in value]
    if isinstance(value, dict):
        return {
            key: sanitize_reasoning_strings(item)
            for key, item in value.items()
        }
    return value
