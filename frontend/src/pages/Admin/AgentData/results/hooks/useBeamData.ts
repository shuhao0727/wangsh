import { useEffect, useMemo, useState } from "react";
import { agentDataApi } from "@services/znt/api";
import { showMessage } from "@/lib/toast";
import type {
  TaskAnalysisDetail, TaskAnalysisResult, ChainSession,
  BeamRangeSelection, BeamTeacherAnchor, BeamStudentChain,
} from "../../types";
import {
  buildDisplayTeacherQuestions, buildDisplayStudentChains,
  buildBeamTeacherAnchors, buildBeamStudentChains, positiveNumber,
  deriveChainSummaries,
} from "../../normalize";

export function useBeamData(detail: TaskAnalysisDetail | null, isBeamView: boolean) {
  const [loadingBeam, setLoadingBeam] = useState(false);
  const [beamSessions, setBeamSessions] = useState<ChainSession[]>([]);
  const [beamRange, setBeamRange] = useState<BeamRangeSelection | null>(null);
  const [beamManualRange, setBeamManualRange] = useState<{ startAt?: string; endAt?: string } | null>(null);

  const resultData = useMemo(() => (detail?.result?.result || detail?.result || {}) as TaskAnalysisResult, [detail]);
  const chainSummaries = useMemo(() => deriveChainSummaries(beamSessions), [beamSessions]);

  const hasPersistedBeamData = useMemo(
    () => (resultData.student_question_chains || []).length > 0
      || (resultData.student_chains || []).length > 0
      || (resultData.beam_nodes || []).some((node) => node.kind !== "teacher_anchor"),
    [resultData],
  );

  const savedStudentChains = useMemo(
    () => buildDisplayStudentChains(resultData, [], [], hasPersistedBeamData ? [] : chainSummaries, detail),
    [resultData, hasPersistedBeamData, chainSummaries, detail],
  );

  const canRenderBeamFromSavedResult = hasPersistedBeamData;

  const hasEvidenceOnlyChains = useMemo(
    () => savedStudentChains.some((chain) => chain.is_evidence_only || chain.source === "evidence"),
    [savedStudentChains],
  );

  const teacherQuestions = useMemo(
    () => buildDisplayTeacherQuestions(resultData, [], detail),
    [resultData, detail],
  );

  const beamTeacherAnchors: BeamTeacherAnchor[] = useMemo(
    () => buildBeamTeacherAnchors(teacherQuestions, detail),
    [teacherQuestions, detail],
  );

  const beamStudentChains: BeamStudentChain[] = useMemo(
    () => buildBeamStudentChains(savedStudentChains, detail),
    [savedStudentChains, detail],
  );

  const studentChainSummary = useMemo(() => resultData.student_chain_summary || {}, [resultData]);

  const questionTotal = useMemo(() => {
    const liveTotal = chainSummaries.reduce((sum, chain) => sum + chain.questionCount, 0);
    const savedTotal = savedStudentChains.reduce((sum, chain) => sum + positiveNumber(chain.question_count, chain.nodes?.length), 0);
    return positiveNumber(studentChainSummary.question_count, liveTotal, savedTotal);
  }, [chainSummaries, savedStudentChains, studentChainSummary]);

  const studentTotal = useMemo(() => {
    if (
      hasEvidenceOnlyChains
      && chainSummaries.length === 0
      && !(resultData.student_question_chains || []).length
      && !(resultData.student_chains || []).length
    ) return 0;
    const liveTotal = new Set(chainSummaries.map((chain) => chain.studentName)).size;
    const savedTotal = new Set(savedStudentChains
      .filter((chain) => !(chain.is_evidence_only || chain.source === "evidence"))
      .map((chain) => chain.student_name || chain.session_id)).size;
    return positiveNumber(studentChainSummary.unique_students, liveTotal, savedTotal);
  }, [chainSummaries, hasEvidenceOnlyChains, resultData, savedStudentChains, studentChainSummary]);

  const chainCount = useMemo(
    () => positiveNumber(studentChainSummary.chain_count, savedStudentChains.length, chainSummaries.length),
    [studentChainSummary, savedStudentChains, chainSummaries],
  );

  const teacherAnchorCount = useMemo(
    () => positiveNumber(studentChainSummary.teacher_anchor_count, teacherQuestions.length),
    [studentChainSummary, teacherQuestions],
  );

  useEffect(() => {
    if (!isBeamView || !detail?.agent_id || canRenderBeamFromSavedResult) {
      setBeamSessions((current) => (current.length > 0 ? [] : current));
      setLoadingBeam((current) => (current ? false : current));
      return;
    }
    let cancelled = false;
    setBeamSessions([]);
    setLoadingBeam(true);
    void agentDataApi.analyzeStudentChains({
      agent_id: detail.agent_id,
      start_at: detail.start_at,
      end_at: detail.end_at,
      class_name: detail.class_name || undefined,
      limit_sessions: 20,
    }).then((response) => {
      if (cancelled) return;
      if (response.success) setBeamSessions((response.data || []) as ChainSession[]);
      else {
        setBeamSessions([]);
        showMessage.error(response.message || "获取链条失败");
      }
    }).catch(() => {
      if (!cancelled) {
        setBeamSessions([]);
        showMessage.error("获取链条失败");
      }
    }).finally(() => {
      if (!cancelled) setLoadingBeam(false);
    });
    return () => { cancelled = true; };
  }, [canRenderBeamFromSavedResult, detail, isBeamView]);

  return {
    loadingBeam,
    beamRange, setBeamRange,
    beamManualRange, setBeamManualRange,
    resultData,
    chainSummaries,
    savedStudentChains,
    hasEvidenceOnlyChains,
    canRenderBeamFromSavedResult,
    teacherQuestions,
    beamTeacherAnchors,
    beamStudentChains,
    studentChainSummary,
    questionTotal,
    studentTotal,
    chainCount,
    teacherAnchorCount,
  };
}
