import { useMemo } from "react";
import type { TaskAnalysisDetail, TaskAnalysisResult, TopicItem, MainQuestionChainItem, WordCloudItem, ChainSummary } from "../../types";
import { normalizeWords, normalizeTopics, normalizeMainQuestionChain } from "../../normalize";

export function useNormalizedResult(detail: TaskAnalysisDetail | null, chainSummaries: ChainSummary[] = []) {
  const wc: WordCloudItem[] = useMemo(() => normalizeWords(detail), [detail]);

  const resultData = useMemo(() => (detail?.result?.result || detail?.result || {}) as TaskAnalysisResult, [detail]);

  const covered: TopicItem[] = useMemo(
    () => normalizeTopics(resultData.covered || detail?.covered),
    [resultData, detail],
  );

  const uncovered: TopicItem[] = useMemo(
    () => normalizeTopics(resultData.uncovered || detail?.uncovered),
    [resultData, detail],
  );

  const mainQuestionChain: MainQuestionChainItem[] = useMemo(
    () => normalizeMainQuestionChain(detail, covered, uncovered, chainSummaries),
    [detail, covered, uncovered, chainSummaries],
  );

  const hotThemes: TopicItem[] = useMemo(
    () => normalizeTopics(resultData.themes || uncovered),
    [resultData, uncovered],
  );

  const courseSequence = useMemo(() => resultData.course_hotspot_sequence || [], [resultData]);
  const teachingSuggestions = useMemo(() => resultData.teaching_suggestions || [], [resultData]);

  const savedMainQuestionChain: MainQuestionChainItem[] = useMemo(() => {
    const items = resultData.ai_main_question_chain || [];
    if (items.length === 0) return mainQuestionChain;
    return items.map((item, index) => ({
      stage: item.stage || `主线 ${index + 1}`,
      question: item.next_ai_question || item.question || "",
      reason: item.student_response_summary || item.reason,
      evidence: item.evidence || [],
    })).filter((item) => item.question);
  }, [resultData, mainQuestionChain]);

  return {
    wc,
    resultData,
    covered,
    uncovered,
    mainQuestionChain,
    hotThemes,
    courseSequence,
    teachingSuggestions,
    savedMainQuestionChain,
  };
}
