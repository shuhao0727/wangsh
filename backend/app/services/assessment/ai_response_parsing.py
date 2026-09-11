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
    """解析 AI 评分返回的 JSON"""
    import re

    text = raw_text.strip()

    # 尝试提取 JSON 对象
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    try:
        data = json.loads(text)
        score = int(data.get("score", 0))
        score = max(0, min(score, max_score))
        return {
            "score": score,
            "is_correct": bool(data.get("is_correct", False)),
            "feedback": str(data.get("feedback", "")),
        }
    except (json.JSONDecodeError, ValueError, TypeError):
        pass

    # 尝试从 markdown 代码块提取
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1))
            score = max(0, min(int(data.get("score", 0)), max_score))
            return {
                "score": score,
                "is_correct": bool(data.get("is_correct", False)),
                "feedback": str(data.get("feedback", "")),
            }
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

    logger.warning(f"无法解析 AI 评分 JSON: {raw_text[:200]}")
    return {"score": 0, "is_correct": False, "feedback": "AI 评分解析失败"}
