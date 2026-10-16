// Data normalization and transformation utilities for TaskAnalysisResultPage
import dayjs from "dayjs";
import type {
  TaskAnalysisDetail, TaskAnalysisResult, TopicItem,
  MainQuestionChainItem, TeacherQuestionItem,
  StudentQuestionChainItem, ChainSummary, ChainSession,
  BeamNode, WordCloudItem, BeamTeacherAnchor, BeamStudentChain, BeamQuestionNode, BeamRelationType,
} from "./types";

export const WC_COLORS = ["#0D9488", "#7C3AED", "#3B82F6", "#06B6D4", "#EC4899", "#F59E0B", "#10B981", "#8B5CF6"];

export const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export const shortText = (value: string | undefined, max = 24) => {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

export const safeFilePart = (value: string) => value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 80) || "report";

export const wordColor = (word: string) => {
  let hash = 0;
  for (let i = 0; i < word.length; i += 1) hash = (hash * 31 + word.charCodeAt(i)) | 0;
  return WC_COLORS[Math.abs(hash) % WC_COLORS.length];
};

export const normalizeTopics = (value: unknown): TopicItem[] => Array.isArray(value)
  ? value.map((item: any) => ({
    topic: String(item.topic || item.theme || "未命名主题"),
    questions: Array.isArray(item.questions)
      ? item.questions
      : Array.isArray(item.representative_questions)
        ? item.representative_questions
        : item.representative_question
          ? [String(item.representative_question)]
          : [],
    count: Number(item.count ?? item.question_count ?? 0),
    unique_students: Number(item.unique_students || 0) || undefined,
    evidence_ids: Array.isArray(item.evidence_ids) ? item.evidence_ids : undefined,
    representative_question: item.representative_question ? String(item.representative_question) : undefined,
  }))
  : [];

export const normalizeWords = (detail: TaskAnalysisDetail | null): WordCloudItem[] => {
  const result = detail?.result?.result || detail?.result;
  const raw = result?.word_cloud || result?.wordCloud || result?.keywords || result?.hot_words || detail?.word_cloud || [];
  const words = raw
    .map((item: any) => ({ word: String(item.word || item.name || "").trim(), count: Number(item.count ?? item.value ?? 0) }))
    .filter((item) => item.word && item.count > 0)
    .sort((a, b) => b.count - a.count);

  if (words.length > 0) return words;

  const topicItems = normalizeTopics(result?.covered || detail?.covered).concat(normalizeTopics(result?.uncovered || detail?.uncovered));
  return topicItems
    .flatMap((item) => [item.topic, ...(item.questions || [])].map((word) => ({ word: word.slice(0, 18), count: Math.max(item.count, 1) })))
    .filter((item) => item.word.trim())
    .slice(0, 50);
};

export const normalizeMainQuestionChain = (
  detail: TaskAnalysisDetail | null, covered: TopicItem[], uncovered: TopicItem[], chains: ChainSummary[],
): MainQuestionChainItem[] => {
  const result = detail?.result?.result || detail?.result;
  const aiChain = Array.isArray(result?.main_question_chain) ? result.main_question_chain : [];
  const normalized = aiChain
    .map((item: any) => ({
      stage: String(item.stage || item.title || "主线阶段").trim(),
      question: String(item.question || item.topic || "").trim(),
      reason: item.reason ? String(item.reason) : undefined,
      evidence: Array.isArray(item.evidence) ? item.evidence.map((text: unknown) => String(text)).filter(Boolean).slice(0, 2) : [],
    }))
    .filter((item) => item.question);
  if (normalized.length > 0) return normalized;

  const topicFallback = uncovered.concat(covered).slice(0, 5).map((item, index) => ({
    stage: index === 0 ? "核心困惑" : `延伸问题 ${index + 1}`,
    question: item.topic,
    reason: index === 0 ? "学生提问中最值得优先处理的方向" : "由学生提问延伸出的后续理解路径",
    evidence: (item.questions || []).slice(0, 2),
  }));
  if (topicFallback.length > 0) return topicFallback;

  return chains.slice(0, 5).map((chain, index) => ({
    stage: index === 0 ? "起始问题" : `追问 ${index + 1}`,
    question: chain.questions[0]?.content || chain.studentName,
    reason: `${chain.studentName} 的连续提问形成了一个可追踪的问题路径`,
    evidence: chain.questions.slice(0, 2).map((question) => question.content),
  }));
};

export const deriveChainSummaries = (sessions: ChainSession[]): ChainSummary[] => sessions
  .map((session) => {
    const questions = session.messages
      .filter((message) => message.message_type === "question" && message.content.trim())
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return {
      sessionId: session.session_id,
      studentName: session.user_name || session.session_id,
      className: session.class_name,
      questionCount: questions.length,
      startAt: questions[0]?.created_at,
      endAt: questions[questions.length - 1]?.created_at || session.last_at,
      questions,
    };
  })
  .filter((session) => session.questionCount > 0)
  .sort((a, b) => b.questionCount - a.questionCount);

export const formatTimeRange = (startAt?: string, endAt?: string) => {
  if (!startAt && !endAt) return "暂无时间";
  if (!startAt || !endAt || startAt === endAt) return dayjs(startAt || endAt).format("HH:mm");
  return `${dayjs(startAt).format("HH:mm")} - ${dayjs(endAt).format("HH:mm")}`;
};

export const addMinutesIso = (base: string, minutes: number) => dayjs(base).add(minutes, "minute").toISOString();

export const baseAnalysisTime = (detail: TaskAnalysisDetail | null) => (
  detail?.start_at || detail?.created_at || dayjs().toISOString()
);

export const mergeAnalysisDateAndClockTime = (
  baseIso: string | undefined,
  timeText: string,
) => {
  const match = timeText.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;

  const base = dayjs(baseIso || undefined);
  const localBase = base.isValid() ? base : dayjs();
  return localBase
    .hour(hour)
    .minute(minute)
    .second(second)
    .millisecond(0)
    .toISOString();
};

const normalizeAnalysisTime = (
  value: string | undefined,
  detail: TaskAnalysisDetail | null,
  fallbackMinutes = 0,
) => {
  const trimmed = String(value || "").trim();
  if (trimmed) {
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      const merged = mergeAnalysisDateAndClockTime(baseAnalysisTime(detail), trimmed);
      if (merged) return merged;
    }

    const parsed = dayjs(trimmed);
    if (parsed.isValid()) return parsed.toISOString();
  }
  return addMinutesIso(baseAnalysisTime(detail), fallbackMinutes);
};

export const positiveNumber = (...values: Array<number | undefined>) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return 0;
};

export const relationForQuestion = (value?: string, fallbackIndex = 0): BeamRelationType => {
  const text = String(value || "").toLowerCase();
  if (/debug|调试|报错|错误|运行/.test(text)) return "debug";
  if (/challenge|质疑|评价|判断|更好/.test(text)) return "challenge";
  if (/transfer|迁移|换成|其他|类似/.test(text)) return "transfer";
  if (/extend|延伸|拓展|扩展|生成|创造/.test(text)) return "extend";
  if (/apply|应用|实现|怎么写|使用/.test(text)) return "apply";
  if (/clarify|澄清|理解|不懂|解释|是什么|什么意思/.test(text)) return "clarify";
  if (/follow|跟进|追问|为什么|关系|区别|分析/.test(text)) return "follow_up";
  return ["clarify", "follow_up", "apply", "debug", "transfer", "extend"][fallbackIndex % 6] as BeamRelationType;
};

export const laneForQuestion = relationForQuestion;

export const normalizeLearningLevel = (value?: string) => {
  const text = String(value || "").toLowerCase();
  if (!text.trim()) return undefined;
  if (/创造|创作|create|设计|生成|创新/.test(text)) return "创造";
  if (/评价|评估|evaluate|判断|论证|反思/.test(text)) return "评价";
  if (/分析|analy[sz]e|拆解|区别|对比|比较|为什么|归因|原因|关系|原理|本质/.test(text)) return "分析";
  if (/应用|apply|使用|实现|怎么写|如何写|代码|程序|迁移|换成|类似|解决/.test(text)) return "应用";
  if (/理解|understand|解释|说明|举例|例子|示例|意思/.test(text)) return "理解";
  if (/了解|知道|记忆|remember|识别|列举|定义|概念|是什么/.test(text)) return "了解/知道";
  return undefined;
};

export const inferLearningLevel = (
  question: string | undefined,
  relation?: BeamRelationType,
  explicitLevel?: string,
) => {
  const normalized = normalizeLearningLevel(explicitLevel) || normalizeLearningLevel(question);
  if (normalized) return normalized;
  if (relation === "transfer" || relation === "extend") return "创造";
  if (relation === "challenge") return "评价";
  if (relation === "debug") return "分析";
  if (relation === "apply") return "应用";
  if (relation === "clarify" || relation === "follow_up") return "理解";
  return "了解/知道";
};

export const relationLabel = (relation: BeamRelationType) => ({
  clarify: "澄清",
  follow_up: "跟进",
  apply: "应用",
  debug: "调试",
  challenge: "质疑",
  transfer: "迁移",
  extend: "延伸",
  off_track: "偏离",
}[relation]);

export const buildDisplayTeacherQuestions = (
  result: TaskAnalysisResult,
  _mainChain: MainQuestionChainItem[],
  detail: TaskAnalysisDetail | null,
): TeacherQuestionItem[] => {
  const raw = result.teacher_mainline || result.teacher_questions || result.teacher_marks || [];
  const normalized = raw
    .map((item, index) => ({
      id: item.id || `teacher-${index}`,
      time: normalizeAnalysisTime(item.time, detail, index * 8),
      question: String(item.question || "").trim(),
      source: item.source,
      user_name: item.user_name,
    }))
    .filter((item) => item.question);
  if (normalized.length > 0) return normalized;

  const beamTeacherQuestions = (result.beam_nodes || [])
    .filter((node) => node.kind === "teacher_anchor" && String(node.label || "").trim())
    .map((node, index) => ({
      id: node.id || `teacher-beam-${index}`,
      time: normalizeAnalysisTime(node.time, detail, index * 8),
      question: String(node.label || "").trim(),
      source: "beam" as const,
      user_name: "由光束图证据恢复",
  }));
  if (beamTeacherQuestions.length > 0) return beamTeacherQuestions;

  return [];
};

export const convertLiveChainsToSaved = (chains: ChainSummary[]): StudentQuestionChainItem[] => chains.map((chain) => ({
  session_id: chain.sessionId,
  student_name: chain.studentName,
  class_name: chain.className,
  question_count: chain.questionCount,
  start_at: chain.startAt,
  end_at: chain.endAt,
  summary: `${chain.studentName} 连续提出 ${chain.questionCount} 个问题。`,
  source: "live" as const,
  nodes: chain.questions.map((question) => ({
    question: question.content,
    time: question.created_at,
    question_type_label: laneForQuestion(question.content),
    bloom_level: inferLearningLevel(question.content, laneForQuestion(question.content)),
  })),
}));

export const convertBeamNodesToSaved = (
  nodes: BeamNode[],
  detail: TaskAnalysisDetail | null,
): StudentQuestionChainItem[] => {
  const studentNodes = nodes
    .filter((node) => node.kind !== "teacher_anchor" && String(node.label || "").trim())
    .sort((a, b) => dayjs(normalizeAnalysisTime(a.time, detail)).valueOf() - dayjs(normalizeAnalysisTime(b.time, detail)).valueOf());
  const grouped = new Map<string, BeamNode[]>();
  studentNodes.forEach((node) => {
    const key = node.student_name || "未知学生";
    grouped.set(key, [...(grouped.get(key) || []), node]);
  });

  return [...grouped.entries()].map(([studentName, items], chainIndex) => {
    const startAt = normalizeAnalysisTime(items[0]?.time, detail, chainIndex * 5 + 1);
    const chainNodes = items.map((node, nodeIndex) => ({
      question: String(node.label || "").trim(),
      time: normalizeAnalysisTime(node.time, detail, chainIndex * 5 + nodeIndex * 2 + 1),
      question_type_label: node.question_type_label || laneForQuestion(node.question_type || node.lane || node.label, nodeIndex),
      bloom_level: node.bloom_level,
      teacher_anchor_id: node.teacher_anchor_id,
      teacher_anchor_question: node.teacher_anchor_question || node.teacher_question,
      evidence_ids: node.evidence_ids || [],
    })).filter((node) => node.question);
    return {
      session_id: `beam-${chainIndex}`,
      student_name: studentName,
      question_count: chainNodes.length,
      start_at: startAt,
      end_at: chainNodes[chainNodes.length - 1]?.time || startAt,
      summary: `由已保存的光束图证据恢复 ${chainNodes.length} 个学生问题。`,
      source: "beam" as const,
      nodes: chainNodes,
    };
  }).filter((chain) => (chain.nodes || []).length > 0);
};

const collectEvidenceTexts = (items: Array<string | undefined>, limit = 8) => {
  const seen = new Set<string>();
  const results: string[] = [];
  items.forEach((value) => {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    results.push(text);
  });
  return results.slice(0, limit);
};

const timelineBucketTimes = (result: TaskAnalysisResult, detail: TaskAnalysisDetail | null) => {
  const buckets = Array.isArray(result.timeline_buckets) ? result.timeline_buckets : [];
  return buckets
    .map((bucket, index) => normalizeAnalysisTime(bucket.bucket_start || bucket.start_at, detail, index * 4))
    .filter(Boolean);
};

export const normalizeTimelineBuckets = (
  result: TaskAnalysisResult,
  detail: TaskAnalysisDetail | null,
) => {
  const buckets = Array.isArray(result.timeline_buckets) ? result.timeline_buckets : [];
  return buckets
    .map((bucket, index) => {
      const start = normalizeAnalysisTime(bucket.bucket_start || bucket.start_at, detail, index * 4);
      const rawEnd = bucket.bucket_end || bucket.end_at;
      const end = rawEnd
        ? normalizeAnalysisTime(rawEnd, detail, index * 4 + 3)
        : addMinutesIso(start, 3);
      const topQuestions = Array.isArray(bucket.top_questions) ? bucket.top_questions : [];
      const questionCount = Number(bucket.question_count || 0);
      return {
        ...bucket,
        bucket_start: start,
        bucket_end: end,
        question_count: questionCount,
        unique_students: Number(bucket.unique_students || 0),
        top_questions: topQuestions
          .map((item: any) => ({
            question: String(item?.question || "").trim(),
            count: Number(item?.count || 0),
          }))
          .filter((item) => item.question),
        is_burst: Boolean(bucket.is_burst),
        near_teacher_mark: bucket.near_teacher_mark || null,
      };
    })
    .filter((bucket) => dayjs(bucket.bucket_start).isValid())
    .sort((a, b) => dayjs(a.bucket_start).valueOf() - dayjs(b.bucket_start).valueOf());
};

export const normalizeTimelineTeacherMarks = (
  result: TaskAnalysisResult,
  detail: TaskAnalysisDetail | null,
) => buildDisplayTeacherQuestions(result, [], detail)
  .map((item) => ({
    time: item.time || baseAnalysisTime(detail),
    question: item.question,
  }))
  .filter((item) => item.question && dayjs(item.time).isValid());

export const buildEvidenceDisplayChains = (
  result: TaskAnalysisResult,
  uncoveredTopics: TopicItem[],
  mainChain: MainQuestionChainItem[],
  detail: TaskAnalysisDetail | null,
): StudentQuestionChainItem[] => {
  const bucketTimes = timelineBucketTimes(result, detail);
  const fallbackBase = baseAnalysisTime(detail);
  const timeFor = (index: number) => bucketTimes[index]
    || addMinutesIso(fallbackBase, index * 4 + 2);

  const mainEvidence = mainChain
    .flatMap((item) => collectEvidenceTexts([item.question, ...(item.evidence || [])], 3))
    .filter(Boolean);
  const timelineEvidence = (result.timeline_buckets || [])
    .flatMap((bucket) => (bucket.top_questions || []).map((question) => question.question))
    .filter(Boolean) as string[];
  const uncoveredEvidence = uncoveredTopics
    .flatMap((topic) => collectEvidenceTexts([topic.topic, ...(topic.questions || [])], 3))
    .filter(Boolean);

  const sources = [
    {
      id: "main",
      name: "课堂证据链 1",
      label: "主问题链证据",
      summary: "由旧分析记录中的 AI 主问题链和代表问题恢复，用于展示课堂问题走势；旧记录未保存真实学生身份。",
      questions: collectEvidenceTexts(mainEvidence, 8),
    },
    {
      id: "timeline",
      name: "课堂证据链 2",
      label: "时序热点证据",
      summary: "由旧分析记录中的时间桶代表问题恢复，用于展示热点在课堂时间中的推进；旧记录未保存真实学生身份。",
      questions: collectEvidenceTexts(timelineEvidence, 8),
    },
    {
      id: "uncovered",
      name: "课堂证据链 3",
      label: "生发问题证据",
      summary: "由旧分析记录中的学生生发性问题恢复，用于观察偏离、迁移和延伸趋势；旧记录未保存真实学生身份。",
      questions: collectEvidenceTexts(uncoveredEvidence, 8),
    },
  ];

  return sources
    .map((source, sourceIndex) => {
      const nodes = source.questions
        .map((question, questionIndex) => ({
          question,
          time: timeFor(questionIndex + sourceIndex),
          question_type_label: laneForQuestion(question, questionIndex + sourceIndex),
        }))
        .filter((node) => node.question);
      return {
        session_id: `evidence-${source.id}`,
        student_name: source.name,
        question_count: nodes.length,
        start_at: nodes[0]?.time,
        end_at: nodes[nodes.length - 1]?.time,
        summary: source.summary,
        source: "evidence" as const,
        source_label: source.label,
        is_evidence_only: true,
        nodes,
      };
    })
    .filter((chain) => (chain.nodes || []).length > 0);
};

export const buildDisplayStudentChains = (
  result: TaskAnalysisResult,
  _uncoveredTopics: TopicItem[],
  _mainChain: MainQuestionChainItem[],
  liveChains: ChainSummary[],
  detail: TaskAnalysisDetail | null,
): StudentQuestionChainItem[] => {
  const rawStudentChains = (result.student_question_chains || []).length > 0
    ? result.student_question_chains || []
    : result.student_chains || [];
  const saved = rawStudentChains
    .map((chain, index) => ({
      ...chain,
      session_id: chain.session_id || `saved-chain-${index}`,
      student_name: chain.student_name || "未知学生",
      question_count: positiveNumber(chain.question_count, chain.nodes?.length, chain.questions?.length),
      source: chain.source || ("saved" as const),
      nodes: (chain.nodes || chain.questions || []).map((node, nodeIndex) => ({
        ...node,
        question: String(node.question || "").trim(),
        time: normalizeAnalysisTime(node.time, detail, nodeIndex * 2),
        question_type_label: node.question_type_label || node.question_type || laneForQuestion(node.question, nodeIndex),
        teacher_anchor_question: node.teacher_anchor_question || node.teacherQuestion,
        teacherTime: node.teacherTime,
      })).filter((node) => node.question),
    }))
    .filter((chain) => (chain.nodes || []).length > 0);
  if (saved.length > 0) return saved;

  if (liveChains.length > 0) return convertLiveChainsToSaved(liveChains);

  const beamChains = convertBeamNodesToSaved(result.beam_nodes || [], detail);
  if (beamChains.length > 0) return beamChains;

  return buildEvidenceDisplayChains(result, _uncoveredTopics, _mainChain, detail);
};

export const buildBeamTeacherAnchors = (
  teacherQuestions: TeacherQuestionItem[],
  detail: TaskAnalysisDetail | null,
): BeamTeacherAnchor[] => teacherQuestions
  .map((item, index) => ({
    id: item.id || `teacher-anchor-${index}`,
    time: item.time || addMinutesIso(baseAnalysisTime(detail), index * 8),
    question: String(item.question || "").trim(),
    label: `T${index + 1}`,
  }))
  .filter((item) => item.question);

export const buildBeamStudentChains = (
  chains: StudentQuestionChainItem[],
  detail: TaskAnalysisDetail | null,
): BeamStudentChain[] => chains
  .map((chain, chainIndex) => {
    const startAt = chain.start_at || addMinutesIso(baseAnalysisTime(detail), chainIndex * 5);
    const nodes = (chain.nodes || [])
      .map((node, nodeIndex): BeamQuestionNode | null => {
        const content = String(node.question || "").trim();
        if (!content) return null;
        const relation = relationForQuestion(node.question_type_label || content, nodeIndex);
        const bloomLevel = inferLearningLevel(content, relation, node.bloom_level);
        return {
          id: `${chain.session_id || chainIndex}-${nodeIndex}`,
          time: node.time || addMinutesIso(startAt, nodeIndex * 2),
          content,
          relationType: relation,
          relationLabel: relationLabel(relation),
          bloomLevel,
          teacherQuestion: node.teacher_anchor_question || node.teacherQuestion,
          teacherTime: node.teacherTime,
          isUncovered: false,
          evidenceIds: node.evidence_ids || [],
        };
      })
      .filter(Boolean) as BeamQuestionNode[];
    return {
      id: chain.session_id || `student-chain-${chainIndex}`,
      studentName: chain.student_name || "未知学生",
      className: chain.class_name,
      startAt: chain.start_at || nodes[0]?.time,
      endAt: chain.end_at || nodes[nodes.length - 1]?.time,
      questionCount: positiveNumber(chain.question_count, nodes.length),
      summary: chain.summary,
      source: chain.source,
      sourceLabel: chain.source_label,
      isEvidenceOnly: chain.is_evidence_only,
      nodes,
    };
  })
  .filter((chain) => chain.nodes.length > 0);
