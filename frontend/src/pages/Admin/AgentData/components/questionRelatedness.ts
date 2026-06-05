export type RelatedQuestionSource = {
  studentName: string;
  content: string;
  time: number;
  bloomLevel: string;
  teacherQuestion?: string;
};

export type RelatedQuestionSummary = {
  studentName: string;
  content: string;
  time: number;
  bloomLevel: string;
  score: number;
  count?: number;
};

export type RelatedQuestionGroup = {
  total: number;
  top: RelatedQuestionSummary[];
};

const defaultRelatedWindowMs = 5 * 60 * 1000;
const questionStopTerms = new Set(["什么", "怎么", "如何", "能不", "不能", "是不", "不是", "可以", "一个", "请问", "请举", "举个", "说明", "解释"]);

const extractQuestionTerms = (value: string) => {
  const text = value.toLowerCase();
  const terms = new Set<string>();
  (text.match(/[a-z0-9_]{2,}/g) || []).forEach((term) => terms.add(term));
  (text.match(/[\u4e00-\u9fa5]{2,}/g) || []).forEach((chunk) => {
    for (let size = 2; size <= 3; size += 1) {
      if (chunk.length < size) continue;
      for (let index = 0; index <= chunk.length - size; index += 1) {
        const term = chunk.slice(index, index + size);
        if (!questionStopTerms.has(term)) terms.add(term);
      }
    }
  });
  return terms;
};

const termSimilarity = (left: Set<string>, right: Set<string>) => {
  if (left.size === 0 || right.size === 0) return 0;
  let hits = 0;
  left.forEach((term) => { if (right.has(term)) hits += 1; });
  return hits / Math.max(1, Math.min(left.size, right.size));
};

const normalizeQuestionKey = (value: string) => value
  .toLowerCase()
  .replace(/\s+/g, "")
  .replace(/[，。！？、,.?!:：；;""'（）()《》<>]/g, "");

const normalizeTeacherKey = (value?: string) => normalizeQuestionKey(value || "");

export const buildRelatedQuestionGroups = (
  items: RelatedQuestionSource[],
  windowMs = defaultRelatedWindowMs,
): RelatedQuestionGroup[] => {
  const questionTerms = items.map((item) => extractQuestionTerms(item.content));
  return items.map((item, itemIndex) => {
    const baseTeacherKey = normalizeTeacherKey(item.teacherQuestion);
    const grouped = new Map<string, RelatedQuestionSummary>();
    items.forEach((candidate, candidateIndex) => {
      if (candidateIndex === itemIndex) return;
      const timeDelta = Math.abs(candidate.time - item.time);
      if (timeDelta > windowMs) return;
      const sameTeacher = Boolean(baseTeacherKey && baseTeacherKey === normalizeTeacherKey(candidate.teacherQuestion));
      const similarity = termSimilarity(questionTerms[itemIndex], questionTerms[candidateIndex]);
      if (!sameTeacher && similarity < 0.16) return;
      const timeScore = 1 - timeDelta / windowMs;
      const score = similarity * 0.65 + timeScore * 0.25 + (sameTeacher ? 0.1 : 0);
      const key = normalizeQuestionKey(candidate.content);
      const existing = grouped.get(key);
      if (existing) {
        existing.count = (existing.count || 1) + 1;
        existing.score = Math.max(existing.score, score);
        return;
      }
      grouped.set(key, {
        studentName: candidate.studentName,
        content: candidate.content,
        time: candidate.time,
        bloomLevel: candidate.bloomLevel,
        score,
        count: 1,
      });
    });
    const sorted = [...grouped.values()].sort((a, b) => (b.count || 1) - (a.count || 1) || b.score - a.score);
    return { total: sorted.length, top: sorted.slice(0, 3) };
  });
};
