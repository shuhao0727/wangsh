"""Student question-chain and semantic beam construction."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Tuple

from .agent_analysis_events import (
    QUESTION_TYPE_LABELS,
    ConversationEvent,
    _nearest_teacher,
    _term_similarity,
)


def _teacher_anchor_for_event(event: ConversationEvent, teacher_questions: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    teacher = _nearest_teacher(event, teacher_questions, max_minutes=30)
    if teacher:
        return teacher
    return {
        "id": "anchor-unassigned",
        "message_id": None,
        "time": event.created_at.isoformat(),
        "question": "未匹配到明确教师提问",
        "source": "system",
        "user_name": "系统",
        "delay_seconds": None,
        "evidence_ids": [],
    }


def _build_student_question_chains(
    student_questions: Sequence[ConversationEvent],
    teacher_questions: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    by_session: Dict[str, List[ConversationEvent]] = {}
    for event in student_questions:
        session_key = event.session_id or f"user-{event.user_id or event.user_name}"
        by_session.setdefault(session_key, []).append(event)

    chains: List[Dict[str, Any]] = []
    for session_id, items in by_session.items():
        sorted_items = sorted(items, key=lambda item: (item.created_at, item.message_id))
        if not sorted_items:
            continue
        nodes = []
        for idx, event in enumerate(sorted_items):
            anchor = _teacher_anchor_for_event(event, teacher_questions)
            previous = sorted_items[idx - 1] if idx > 0 else None
            relation = event.question_type
            if previous and _term_similarity(previous.terms, event.terms) >= 0.45 and relation == "follow_up":
                relation = "follow_up"
            nodes.append(
                {
                    "node_id": f"student-{event.message_id}",
                    "message_id": event.message_id,
                    "time": event.created_at.isoformat(),
                    "question": event.content,
                    "student_name": event.user_name,
                    "student_id": event.student_id,
                    "class_name": event.class_name,
                    "question_type": relation,
                    "question_type_label": QUESTION_TYPE_LABELS.get(relation, relation),
                    "bloom_level": event.bloom_level,
                    "teacher_anchor_id": anchor.get("id"),
                    "teacher_anchor_question": anchor.get("question"),
                    "delay_seconds": anchor.get("delay_seconds"),
                    "terms": list(event.terms),
                    "evidence_ids": [event.message_id],
                }
            )
        chains.append(
            {
                "session_id": session_id,
                "student_name": sorted_items[0].user_name,
                "student_id": sorted_items[0].student_id,
                "class_name": sorted_items[0].class_name,
                "question_count": len(nodes),
                "start_at": sorted_items[0].created_at.isoformat(),
                "end_at": sorted_items[-1].created_at.isoformat(),
                "dominant_question_type": _dominant([node["question_type"] for node in nodes]),
                "summary": _summarize_student_chain(nodes),
                "nodes": nodes,
                "evidence_ids": [event.message_id for event in sorted_items],
            }
        )
    chains.sort(key=lambda item: item["question_count"], reverse=True)
    return chains


def _dominant(values: Sequence[str]) -> str:
    counts: Dict[str, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return max(counts.items(), key=lambda item: item[1])[0] if counts else ""


def _summarize_student_chain(nodes: Sequence[Dict[str, Any]]) -> str:
    if not nodes:
        return "暂无问题链"
    start = nodes[0].get("question", "")
    end = nodes[-1].get("question", "")
    dominant = QUESTION_TYPE_LABELS.get(_dominant([str(node.get("question_type")) for node in nodes]), "追问")
    if len(nodes) == 1:
        return f"学生围绕「{start[:28]}」提出了单点{dominant}问题。"
    return f"学生从「{start[:28]}」出发，经过 {len(nodes)} 次{dominant}式追问，推进到「{end[:28]}」。"


def _build_ai_main_question_chain(
    themes: Sequence[Dict[str, Any]],
    teacher_questions: Sequence[Dict[str, Any]],
    student_chains: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    chain: List[Dict[str, Any]] = []
    for idx, teacher in enumerate(teacher_questions[:6]):
        related_nodes = [
            node
            for student_chain in student_chains
            for node in student_chain.get("nodes", [])
            if node.get("teacher_anchor_id") == teacher.get("id")
        ]
        if related_nodes:
            representative = related_nodes[0]
            chain.append(
                {
                    "stage": f"教师主线 {idx + 1}",
                    "question": teacher.get("question") or "教师提问",
                    "student_response_summary": f"{len(related_nodes)} 个学生问题围绕该提问展开",
                    "next_ai_question": representative.get("question"),
                    "reason": "教师提问后学生产生的集中追问节点",
                    "evidence": [node.get("question") for node in related_nodes[:3] if node.get("question")],
                    "evidence_ids": [eid for node in related_nodes[:8] for eid in node.get("evidence_ids", [])],
                }
            )
    if chain:
        return chain
    for idx, theme in enumerate(themes[:6]):
        chain.append(
            {
                "stage": f"问题阶段 {idx + 1}",
                "question": theme.get("topic"),
                "student_response_summary": f"{theme.get('count', 0)} 个问题聚合到该主题",
                "next_ai_question": (theme.get("questions") or [""])[0],
                "reason": "由学生问题聚类生成的课堂主问题链节点",
                "evidence": (theme.get("questions") or [])[:3],
                "evidence_ids": theme.get("evidence_ids", [])[:8],
            }
        )
    return chain


def _build_beam(
    teacher_questions: Sequence[Dict[str, Any]],
    student_chains: Sequence[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    lanes: Dict[str, Dict[str, Any]] = {}

    for idx, teacher in enumerate(teacher_questions):
        node_id = str(teacher.get("id") or f"teacher-{idx}")
        nodes.append(
            {
                "id": node_id,
                "kind": "teacher_anchor",
                "label": teacher.get("question") or "教师提问",
                "time": teacher.get("time"),
                "lane": "teacher-mainline",
                "x_order": idx,
                "y_order": 0,
                "source": teacher.get("source"),
                "evidence_ids": teacher.get("evidence_ids", []),
            }
        )
    lanes["teacher-mainline"] = {"lane_id": "teacher-mainline", "label": "教师主线", "kind": "teacher", "y_order": 0}

    relation_order = {
        "clarify": -3,
        "follow_up": -2,
        "debug": -1,
        "apply": 1,
        "transfer": 2,
        "extend": 3,
        "challenge": 4,
        "off_track": 5,
    }
    for chain in student_chains:
        previous_node_id: Optional[str] = None
        for idx, item in enumerate(chain.get("nodes", [])):
            relation = str(item.get("question_type") or "follow_up")
            lane_id = f"relation-{relation}"
            lanes.setdefault(
                lane_id,
                {
                    "lane_id": lane_id,
                    "label": QUESTION_TYPE_LABELS.get(relation, relation),
                    "kind": "student_relation",
                    "y_order": relation_order.get(relation, 1),
                },
            )
            node_id = str(item.get("node_id"))
            nodes.append(
                {
                    "id": node_id,
                    "kind": "student_question",
                    "label": item.get("question"),
                    "time": item.get("time"),
                    "lane": lane_id,
                    "x_order": idx,
                    "y_order": relation_order.get(relation, 1),
                    "student_name": item.get("student_name"),
                    "question_type": relation,
                    "question_type_label": item.get("question_type_label"),
                    "bloom_level": item.get("bloom_level"),
                    "teacher_anchor_id": item.get("teacher_anchor_id"),
                    "evidence_ids": item.get("evidence_ids", []),
                }
            )
            anchor_id = item.get("teacher_anchor_id")
            if anchor_id and anchor_id != "anchor-unassigned":
                edges.append(
                    {
                        "id": f"edge-{anchor_id}-{node_id}",
                        "source": anchor_id,
                        "target": node_id,
                        "relation": "teacher_trigger",
                        "label": "教师触发",
                    }
                )
            if previous_node_id:
                edges.append(
                    {
                        "id": f"edge-{previous_node_id}-{node_id}",
                        "source": previous_node_id,
                        "target": node_id,
                        "relation": "same_student_follow_up",
                        "label": "同学生追问",
                    }
                )
            previous_node_id = node_id
    return nodes, edges, sorted(lanes.values(), key=lambda lane: lane["y_order"])
