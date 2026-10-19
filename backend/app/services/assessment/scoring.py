"""测评计分与统计中的纯计算，不导入 ORM、配置或外部服务。"""


def _first_attempt_per_kp(answers) -> list:
    """自适应计分：同一知识点只保留首次尝试（attempt_seq==1 或 is_adaptive==False），
    后续自适应题仅作练习不计入总分。无知识点的题目直接保留。"""
    sorted_answers = sorted(
        answers,
        key=lambda a: (
            getattr(a, "session_id", 0) or 0,
            getattr(a, "knowledge_point", "") or "",
            getattr(a, "attempt_seq", 1) or 1,
            getattr(a, "id", 0) or 0,
        ),
    )
    seen_kp: set[tuple[int, str]] = set()
    result = []
    for a in sorted_answers:
        kp = getattr(a, "knowledge_point", None)
        if not kp:
            result.append(a)
            continue
        # 自适应追加题（attempt_seq > 1）跳过，不计分
        if getattr(a, "is_adaptive", False) and getattr(a, "attempt_seq", 1) > 1:
            continue
        skey = (getattr(a, "session_id", 0) or 0, kp)
        if skey in seen_kp:
            continue
        seen_kp.add(skey)
        result.append(a)
    return result


def _aggregate_knowledge_rates(answers) -> dict:
    """聚合已筛选答案的知识点得分率；知识点沿用关联题目字段。"""
    kp_data: dict[str, dict] = {}
    for a in answers:
        kp = a.question.knowledge_point if a.question else None
        if not kp:
            continue
        if kp not in kp_data:
            kp_data[kp] = {"earned": 0, "total": 0}
        kp_data[kp]["earned"] += a.ai_score or 0
        kp_data[kp]["total"] += a.max_score

    rates = {}
    for kp, d in kp_data.items():
        if d["total"] > 0:
            rates[kp] = round(d["earned"] / d["total"] * 100, 1)
    return rates


def _calc_score_distribution(scores: list[int], total_score: int) -> list[dict]:
    """将分数分成 10 个区间（等距），返回每个区间的计数"""
    if not scores or total_score <= 0:
        return []
    bucket_size = max(1, total_score // 10)
    buckets: dict[str, int] = {}
    for i in range(0, total_score, bucket_size):
        lo = i
        hi = min(i + bucket_size, total_score) if i + bucket_size <= total_score else total_score
        if lo == 0:
            lo = 0
        label = f"{lo}-{hi}"
        buckets[label] = 0
    # 确保最后一个区间为 total_score
    if total_score % bucket_size != 0:
        buckets[f"{total_score - (total_score % bucket_size)}-{total_score}"] = 0

    for s in scores:
        placed = False
        for label in buckets:
            parts = label.split("-")
            lo, hi = int(parts[0]), int(parts[1])
            if lo <= s <= hi:
                buckets[label] += 1
                placed = True
                break
        if not placed:
            # 兜底放到最后一个区间
            last_label = list(buckets.keys())[-1]
            buckets[last_label] += 1

    return [{"range": k, "count": v} for k, v in buckets.items()]
