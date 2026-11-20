"""Pure parsing of assessment AI question and grading responses.

Re-exported by session_service for existing callers; no transaction or provider I/O.
"""
import json

from loguru import logger


def _parse_question_json(raw_text: str, knowledge_point: str, question_type: str, score: int) -> dict:
    """解析 AI 返回的题目 JSON"""
    import re as _re

    text = raw_text.strip()
    # 尝试从 markdown 代码块提取
    match = _re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, _re.DOTALL)
    if match:
        text = match.group(1)
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end > start:
            text = text[start:end + 1]

    try:
        data = json.loads(text)
        options = data.get("options")
        if isinstance(options, dict):
            options = json.dumps(options, ensure_ascii=False)
        elif isinstance(options, list):
            options = json.dumps(dict(zip("ABCD", options)), ensure_ascii=False)
        return {
            "content": str(data.get("content", "")),
            "options": options,
            "correct_answer": str(data.get("correct_answer", "")),
            "explanation": str(data.get("explanation", "")),
            "knowledge_point": knowledge_point,
            "question_type": question_type,
            "score": score,
        }
    except (json.JSONDecodeError, ValueError):
        logger.warning(f"无法解析 AI 出题 JSON: {raw_text[:200]}")
        # 返回一个兜底题目
        return {
            "content": f"关于「{knowledge_point}」的练习题（AI生成失败，请跳过）",
            "options": json.dumps({"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"}),
            "correct_answer": "A",
            "explanation": "",
            "knowledge_point": knowledge_point,
            "question_type": question_type,
            "score": score,
        }


def _parse_grading_json(raw_text: str, max_score: int) -> dict:
    """解析 AI 评分，只有明确提供的分数才视为有效。"""
    import re

    text = raw_text.strip()
    start = text.find("{")
    end = text.rfind("}")
    candidates = [text[start:end + 1] if 0 <= start < end else text]
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        candidates.append(match.group(1))

    for candidate in candidates:
        try:
            data = json.loads(candidate)
            score = data["score"]
            is_correct = data.get("is_correct", False)
            if type(score) not in (int, str) or not isinstance(is_correct, bool):
                continue
            score = int(score)
        except (KeyError, ValueError, TypeError):
            continue
        return {
            "score": max(0, min(score, max_score)),
            "is_correct": is_correct,
            "feedback": str(data.get("feedback", "")),
        }

    raise ValueError("AI 评分解析失败")
