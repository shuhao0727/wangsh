from app.services.agents.assistant_answer_sanitizer import (
    ReasoningContentFilter,
    sanitize_assistant_answer,
    sanitize_reasoning_strings,
)


def test_sanitize_assistant_answer_removes_dify_reasoning_block():
    value = (
        "<think>\n<!--dify-deepseek-reasoning-->\ninternal reasoning"
        "\n</think>\nfinal answer"
    )
    assert sanitize_assistant_answer(value) == "\nfinal answer"


def test_incremental_filter_handles_split_markers():
    reasoning_filter = ReasoningContentFilter()
    output = "".join(
        [
            reasoning_filter.push("<th"),
            reasoning_filter.push("ink>hidden"),
            reasoning_filter.push("</thi"),
            reasoning_filter.push("nk>visible"),
            reasoning_filter.finish(),
        ]
    )
    assert output == "visible"


def test_unterminated_reasoning_fails_closed():
    assert sanitize_assistant_answer("<think>hidden") == ""


def test_sanitizer_preserves_normal_markdown():
    value = "## Result\n\n```html\n<thinking>example</thinking>\n```"
    assert sanitize_assistant_answer(value) == value


def test_recursive_sanitizer_protects_nested_outputs():
    payload = {
        "answer": "<think>hidden</think>visible",
        "data": {"outputs": {"text": "<think>secret</think>safe"}},
    }
    assert sanitize_reasoning_strings(payload) == {
        "answer": "visible",
        "data": {"outputs": {"text": "safe"}},
    }


def test_conversation_row_sanitizer_only_changes_answers():
    from app.services.agents.agent_conversations import _sanitize_conversation_row

    answer = _sanitize_conversation_row(
        {"message_type": "answer", "content": "<think>hidden</think>visible"}
    )
    question = _sanitize_conversation_row(
        {"message_type": "question", "content": "What does <think> mean?"}
    )

    assert answer["content"] == "visible"
    assert question["content"] == "What does <think> mean?"


def test_usage_response_sanitizes_persisted_answer():
    from app.services.agents.agent_usage import _build_usage_response_from_session

    response = _build_usage_response_from_session(
        {
            "id": 1,
            "user_id": 2,
            "agent_id": 3,
            "question": "question",
            "answer": "<think>hidden</think>visible",
        }
    )

    assert response["answer"] == "visible"


def test_create_agent_usage_sanitizes_before_persistence():
    import asyncio
    from types import SimpleNamespace

    from app.services.agents.agent_usage import create_agent_usage

    class _Result:
        def __init__(self, value):
            self.value = value

        def scalar_one_or_none(self):
            return self.value

    class _DB:
        def __init__(self):
            self.results = [
                _Result(SimpleNamespace(id=7, name="agent", agent_type="dify", model_name="", is_active=True)),
                _Result(SimpleNamespace(id=11, full_name="student", student_id="s1", study_year="1", class_name="A", is_active=True)),
            ]
            self.rows = []

        async def execute(self, _statement):
            return self.results.pop(0)

        def add(self, row):
            self.rows.append(row)

        async def commit(self):
            return None

        async def refresh(self, row):
            if row.id is None:
                row.id = len(self.rows)

    db = _DB()
    response = asyncio.run(
        create_agent_usage(
            db,
            agent_id=7,
            user_id=11,
            question="question with <think> text",
            answer="<think>hidden</think>visible",
            session_id="session-1",
        )
    )

    assert [row.message_type for row in db.rows] == ["question", "answer"]
    assert db.rows[0].content == "question with <think> text"
    assert db.rows[1].content == "visible"
    assert response["answer"] == "visible"

    reasoning_only_db = _DB()
    reasoning_only_response = asyncio.run(
        create_agent_usage(
            reasoning_only_db,
            agent_id=7,
            user_id=11,
            question="question",
            answer="<think>only reasoning</think>",
            session_id="session-2",
        )
    )

    assert [row.message_type for row in reasoning_only_db.rows] == ["question"]
    assert reasoning_only_response["answer"] == ""



def test_conversation_export_sanitizes_answers_but_preserves_questions():
    from app.api.endpoints.agents.ai_agents.export import (
        _sanitize_conversation_export_row,
    )

    answer = _sanitize_conversation_export_row(
        {"message_type": "answer", "content": "<think>hidden</think>visible"}
    )
    question = _sanitize_conversation_export_row(
        {"message_type": "question", "content": "What does <think> mean?"}
    )

    assert answer["content"] == "visible"
    assert question["content"] == "What does <think> mean?"
