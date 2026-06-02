/**
 * 学生问题链分析结果页 — 教师主线、光束图、学生链摘要
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Loader2, MessageSquare, Target, Users } from "lucide-react";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import { showMessage } from "@/lib/toast";
import SharedResultLayout from "./SharedResultLayout";
import { useAnalysisDetail } from "./hooks/useAnalysisDetail";
import { useNormalizedResult } from "./hooks/useNormalizedResult";
import { useBeamData } from "./hooks/useBeamData";
import StudentBeamChart from "../components/StudentBeamChart";
import SummaryCard from "../components/SummaryCard";
import CollapsibleSection from "../components/CollapsibleSection";
import ChainThoughtPathCard from "../components/ChainThoughtPathCard";
import ChainCard from "../components/ChainCard";
import StudentProfileDrawer from "../components/StudentProfileDrawer";
import EngagementHeatmap from "../components/EngagementHeatmap";
import TrendDashboard from "../components/TrendDashboard";
import type { MainQuestionChainItem, TeacherQuestionItem } from "../types";
import { formatTimeRange } from "../normalize";

// ── Internal helper components ──

const CollapsibleTeacherMainline: React.FC<{ items: TeacherQuestionItem[] }> = ({ items }) => (
  <details className="group rounded-xl border border-border bg-surface shadow-sm">
    <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3">
      <div>
        <h2 className="text-base font-semibold text-text-base">教师主线</h2>
        <p className="mt-1 text-sm text-text-tertiary">课堂中教师/admin 提问形成的中心轴，光束图里的橙色粗线与锚点来自这里。</p>
      </div>
      <span className="shrink-0 rounded-full bg-[var(--ws-color-warning-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--ws-color-warning)]">{items.length} 个锚点</span>
    </summary>
    <div className="border-t border-border-secondary px-4 py-3">
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {items.map((item, index) => (
            <div key={`${item.id || item.time}-${index}`} className="rounded-lg border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning)]/8 px-3 py-2">
              <div className="mb-1 text-xs font-semibold text-[var(--ws-color-warning)]">T{index + 1}{item.time ? ` · ${dayjs(item.time).format("HH:mm")}` : ""}</div>
              <div className="text-sm font-medium leading-relaxed text-text-base">{item.question}</div>
              {item.user_name && <div className="mt-1 text-[11px] text-text-tertiary">{item.user_name}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border-secondary text-sm text-text-tertiary">暂无教师主线锚点</div>
      )}
    </div>
  </details>
);

const CollapsibleAiMainline: React.FC<{ items: MainQuestionChainItem[] }> = ({ items }) => (
  <details className="group rounded-xl border border-border bg-surface shadow-sm">
    <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3">
      <div>
        <h2 className="text-base font-semibold text-text-base">AI 主问题链</h2>
        <p className="mt-1 text-sm text-text-tertiary">AI 基于学生问题归纳出的课堂认知推进链，和教师主线分开阅读，避免混成一套逻辑。</p>
      </div>
      <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{items.length} 个阶段</span>
    </summary>
    <div className="border-t border-border-secondary px-4 py-3">
      {items.length > 0 ? (
        <div className="flex flex-col gap-3 overflow-x-auto pb-2 lg:flex-row lg:items-stretch lg:gap-4">
          {items.map((item, index) => (
            <div key={`${item.stage}-${index}`} className="flex w-full flex-col rounded-xl border border-border-secondary bg-surface-2 px-4 py-3 shadow-sm lg:min-w-[260px] lg:max-w-[330px] lg:flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white ring-4 ring-primary-soft">{index + 1}</span>
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{item.stage}</span>
              </div>
              <h3 className="text-sm font-semibold leading-relaxed text-text-base">{item.question}</h3>
              {item.reason && <p className="mt-2 text-xs leading-relaxed text-text-tertiary">{item.reason}</p>}
              {(item.evidence || []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {(item.evidence || []).slice(0, 2).map((evidence, evidenceIndex) => (
                    <div key={`${evidence}-${evidenceIndex}`} className="flex gap-2 rounded-lg border border-border-secondary bg-surface px-2.5 py-1.5 text-xs leading-relaxed text-text-secondary">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="break-words">{evidence}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border-secondary text-sm text-text-tertiary">暂无 AI 主问题链</div>
      )}
    </div>
  </details>
);

// ── Helper functions ──

const formatInputTime = (value?: string) => (value ? dayjs(value).format("HH:mm") : "");

const mergeDateAndTime = (baseIso: string | undefined, timeText: string) => {
  const match = timeText.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const local = dayjs().hour(hour).minute(minute).second(0).millisecond(0);
  return local.toISOString();
};

// ── Main page component ──

const ChainAnalysisResultPage: React.FC = () => {
  const { loading, detail, isBeamView } = useAnalysisDetail();
  const {
    loadingBeam,
    beamRange, setBeamRange,
    beamManualRange, setBeamManualRange,
    resultData,
    chainSummaries,
    savedStudentChains,
    hasEvidenceOnlyChains,
    teacherQuestions,
    beamTeacherAnchors,
    beamStudentChains,
    studentChainSummary,
    questionTotal,
    studentTotal,
    chainCount,
    teacherAnchorCount,
  } = useBeamData(detail, isBeamView);
  const { savedMainQuestionChain, uncovered, hotThemes } = useNormalizedResult(detail, chainSummaries);

  // ── stable onRangeChange to prevent infinite re-renders ──
  const prevBeamRangeRef = useRef<string | null>(null);
  const handleBeamRangeChange = React.useCallback((selection: any) => {
    const key = `${selection?.startAt || ''}|${selection?.endAt || ''}`;
    if (key === prevBeamRangeRef.current) return;
    prevBeamRangeRef.current = key;
    setBeamRange(selection);
  }, []);

  const [beamRangeInputs, setBeamRangeInputs] = useState({ start: "", end: "" });
  const [profileChain, setProfileChain] = useState<typeof beamStudentChains[0] | null>(null);

  const handleStudentClick = (identifier: string) => {
    const match = beamStudentChains.find(
      (c) => c.studentName === identifier || c.id === identifier,
    );
    if (match) setProfileChain(match);
  };

  const activeBeamQuestions = useMemo(() => beamRange?.questions || [], [beamRange]);
  const activeUncoveredQuestions = useMemo(
    () => activeBeamQuestions.filter((question) => question.isUncovered),
    [activeBeamQuestions],
  );
  const activeBeamStudentPaths = useMemo(() => {
    const grouped = new Map<string, typeof activeBeamQuestions>();
    activeBeamQuestions.forEach((question) => {
      grouped.set(question.studentName, [...(grouped.get(question.studentName) || []), question]);
    });
    const total = Math.max(activeBeamQuestions.length, 1);
    return [...grouped.entries()]
      .map(([studentName, questions]) => ({
        studentName,
        questions: questions.sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf()),
        percentage: Math.round((questions.length / total) * 100),
      }))
      .sort((a, b) => b.questions.length - a.questions.length);
  }, [activeBeamQuestions]);
  const visibleBeamTeacherAnchors = useMemo(() => beamRange?.teacherAnchors || [], [beamRange]);

  // Cross-module: correlate active beam questions with hot themes
  const relatedHotThemes = useMemo(() => {
    if (activeBeamQuestions.length === 0 || hotThemes.length === 0) return [];
    return hotThemes
      .map((theme) => {
        const themeWords = theme.topic.toLowerCase().split(/\s+/);
        const matches = activeBeamQuestions.filter((q) =>
          themeWords.some((w) => w.length > 1 && q.content.toLowerCase().includes(w)),
        );
        return { ...theme, matchCount: matches.length, matchedStudents: [...new Set(matches.map((q) => q.studentName))] };
      })
      .filter((t) => t.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 5);
  }, [activeBeamQuestions, hotThemes]);

  useEffect(() => {
    if (!beamRange?.startAt || !beamRange?.endAt || beamRange.source === "manual") return;
    setBeamRangeInputs({
      start: formatInputTime(beamRange.startAt),
      end: formatInputTime(beamRange.endAt),
    });
  }, [beamRange]);

  const handleApplyBeamRange = () => {
    const base = beamRange?.startAt || beamStudentChains[0]?.startAt || detail?.start_at || detail?.created_at;
    const startAt = mergeDateAndTime(base, beamRangeInputs.start);
    const endAt = mergeDateAndTime(base, beamRangeInputs.end);
    if (!startAt || !endAt) {
      showMessage.error("请输入正确的时间，例如 10:14");
      return;
    }
    setBeamManualRange({ startAt, endAt });
    setBeamRangeInputs({ start: formatInputTime(startAt), end: formatInputTime(endAt) });
  };

  const handleResetBeamRange = () => {
    setBeamManualRange(null);
    setBeamRangeInputs({
      start: formatInputTime(beamRange?.startAt),
      end: formatInputTime(beamRange?.endAt),
    });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!detail) return <div className="flex min-h-screen items-center justify-center text-sm text-text-tertiary">记录不存在</div>;

  return (
    <SharedResultLayout detail={detail}>
      {/* Summary cards */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<Users className="h-4 w-4" />} label="参与学生" value={studentTotal} hint="提交问题的学生数" />
        <SummaryCard icon={<MessageSquare className="h-4 w-4" />} label="提问总数" value={questionTotal} hint="学生提问总条数" />
        <SummaryCard icon={<Target className="h-4 w-4" />} label="问题链" value={chainCount} hint="可追踪的学生链路" />
        <SummaryCard icon={<Lightbulb className="h-4 w-4" />} label="教师锚点" value={teacherAnchorCount} hint="教师主线问题数" />
      </div>

      <div className="space-y-6">
        {/* 教师主线 + AI 主线 */}
        <div className="space-y-3">
          <CollapsibleTeacherMainline items={teacherQuestions} />
          <CollapsibleAiMainline items={savedMainQuestionChain} />
        </div>

        {/* 语义光束图 */}
        <section className="rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 p-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-base">语义光束图</h2>
              <p className="mt-1 text-sm text-text-tertiary">橙色粗线是教师问题链中轴，彩色波形是真实学生问题链。拖动底部时间条、框选或输入精准时间可查看区间趋势。</p>
            </div>
            {loadingBeam && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
          {!loadingBeam && hasEvidenceOnlyChains ? (
            <div className="mb-3 rounded-lg border border-primary/20 bg-primary-soft/45 px-3 py-2 text-xs leading-relaxed text-primary">
              当前记录缺少逐学生真实链，已使用已保存代表问题绘制"课堂证据链"；不会伪造学生身份。新生成的问题链记录会优先显示真实学生路径。
            </div>
          ) : !loadingBeam && beamStudentChains.length < 5 && (
            <div className="mb-3 rounded-lg border border-[var(--ws-color-warning)]/25 bg-[var(--ws-color-warning)]/8 px-3 py-2 text-xs text-[var(--ws-color-warning)]">
              当前真实学生链{beamStudentChains.length}条，不足 5 条，未使用模拟链补足。
            </div>
          )}
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-border-secondary bg-surface-2/70 px-3 py-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-tertiary">开始时间</label>
              <input
                type="time"
                value={beamRangeInputs.start}
                onChange={(event) => setBeamRangeInputs((current) => ({ ...current, start: event.target.value }))}
                className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-text-base outline-none transition-colors focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-tertiary">结束时间</label>
              <input
                type="time"
                value={beamRangeInputs.end}
                onChange={(event) => setBeamRangeInputs((current) => ({ ...current, end: event.target.value }))}
                className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-text-base outline-none transition-colors focus:border-primary"
              />
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={handleApplyBeamRange}>应用区间</Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleResetBeamRange}>同步当前选择</Button>
            <div className="min-w-[180px] flex-1 text-xs text-text-tertiary">
              当前区间：{beamRange?.startAt && beamRange?.endAt ? `${dayjs(beamRange.startAt).format("HH:mm")} - ${dayjs(beamRange.endAt).format("HH:mm")}` : "暂无"}
              {beamRange?.source === "manual" && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-primary">精准时间</span>}
            </div>
          </div>
          {loadingBeam ? (
            <div className="flex h-[520px] items-center justify-center text-sm text-text-tertiary">正在加载链条数据...</div>
          ) : (
            <StudentBeamChart
              height={520}
              teacherAnchors={beamTeacherAnchors}
              studentChains={beamStudentChains}
              burstPoints={resultData.burst_points || []}
              manualRange={beamManualRange}
              onRangeChange={handleBeamRangeChange}
              onStudentClick={handleStudentClick}
            />
          )}
        </section>

        {/* 区间内学生生发性问题 */}
        {(uncovered.length > 0 || activeBeamQuestions.length > 0) && (
          <CollapsibleSection
            title="区间内学生生发性问题"
            icon="&#x1F525;"
            badge={`${activeUncoveredQuestions.length || uncovered.length} 条/方向`}
            accent="warning"
            defaultExpanded={false}
          >
            <p className="mb-3 text-sm text-text-tertiary">
              {beamRange?.startAt && beamRange?.endAt
                ? `${dayjs(beamRange.startAt).format("HH:mm")} - ${dayjs(beamRange.endAt).format("HH:mm")} 内的学生问题随光束图时间区间变化。`
                : "拖动光束图底部时间条后，这里会只显示当前时间段里的学生问题。"}
            </p>

            {/* Cross-module: show related hot themes for active beam range */}
            {relatedHotThemes.length > 0 && (
              <div className="mb-3 rounded-lg border border-primary/20 bg-primary-soft/40 px-3 py-2">
                <p className="text-xs font-medium text-primary mb-1.5">📌 当前区间关联的热点主题</p>
                <div className="flex flex-wrap gap-1.5">
                  {relatedHotThemes.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary" title={`${t.matchedStudents.join("、")} 问过此主题`}>
                      {t.topic}
                      <span className="text-primary/60">({t.matchCount}问)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {activeBeamQuestions.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {(activeUncoveredQuestions.length > 0 ? activeUncoveredQuestions : activeBeamQuestions).slice(0, 8).map((question, index) => (
                  <div key={`${question.time}-${question.studentName}-${index}`} className={`rounded-lg border px-3.5 py-3 ${question.isUncovered ? "border-[var(--ws-color-danger)]/20 bg-[var(--ws-color-danger)]/8" : "border-border-secondary bg-surface"}`}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-text-base">{question.studentName}</span>
                      <span className="shrink-0 text-xs text-text-tertiary">{dayjs(question.time).format("HH:mm")}</span>
                    </div>
                    <div className="text-sm leading-relaxed text-text-secondary">{question.content}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-text-tertiary">
                      {question.relationLabel && <span>关系：{question.relationLabel}</span>}
                      {question.teacherQuestion && <span>关联教师：{question.teacherQuestion}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {uncovered.map((t, i) => (
                  <div key={i} className={`rounded-lg border px-3.5 py-3 ${t.count >= 3 ? "border-[var(--ws-color-danger)]/20 bg-[var(--ws-color-danger)]/8" : "border-border-secondary bg-surface"}`}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-medium text-text-base">{t.topic}</span>
                      <span className={`text-xs font-semibold ${t.count >= 3 ? "text-[var(--ws-color-danger)]" : "text-text-tertiary"}`}>{t.count}次</span>
                    </div>
                    {t.questions && t.questions.length > 0 && (
                      <div className="space-y-1">
                        {t.questions.slice(0, 2).map((q, qi) => (
                          <div key={qi} className="border-l-2 border-[var(--ws-color-warning)]/35 pl-2 text-xs text-text-secondary">"{q}"</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 rounded-lg bg-primary-soft/50 px-3 py-2 text-xs text-primary">
              教学建议：优先关注当前区间里学生集中转向、追问或偏离教师主线的节点，它们更能反映实时认知需求。
            </div>
          </CollapsibleSection>
        )}

        {/* 参与热力图 */}
        <CollapsibleSection title="学生参与热力图" icon="📊" badge={`${beamStudentChains.length} 人`} defaultExpanded={false}>
          <EngagementHeatmap studentChains={beamStudentChains} />
        </CollapsibleSection>

        {/* 学生问题链摘要 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-base">学生问题链摘要</h2>
              <p className="mt-1 text-sm text-text-tertiary">
                {beamRange?.startAt && beamRange?.endAt
                  ? `当前区间 ${dayjs(beamRange.startAt).format("HH:mm")} - ${dayjs(beamRange.endAt).format("HH:mm")} · ${activeBeamStudentPaths.length} 条${hasEvidenceOnlyChains ? "课堂证据链" : "真实学生链"} · ${activeBeamQuestions.length} 个问题 · ${visibleBeamTeacherAnchors.length} 个教师锚点`
                  : studentChainSummary.chain_count !== undefined
                    ? `${chainCount} 条链 · ${questionTotal} 个问题 · ${teacherAnchorCount} 个教师锚点`
                    : "最活跃的链路，辅助理解光束图中的路径。"}
              </p>
            </div>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
              {Math.min(activeBeamStudentPaths.length || savedStudentChains.length || chainSummaries.length, 5) > 0
                ? `Top ${Math.min(activeBeamStudentPaths.length || savedStudentChains.length || chainSummaries.length, 5)}`
                : "暂无"}
            </span>
          </div>

          {/* Teacher anchor chips */}
          {visibleBeamTeacherAnchors.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {visibleBeamTeacherAnchors.map((anchor, index) => (
                <span key={`${anchor.id}-${index}`} className="rounded-full border border-[var(--ws-color-warning)]/25 bg-[var(--ws-color-warning)]/8 px-2.5 py-1 text-xs text-[var(--ws-color-warning)]" title={anchor.question}>
                  {anchor.label || `T${index + 1}`} · {dayjs(anchor.time).format("HH:mm")}
                </span>
              ))}
            </div>
          )}

          {/* Active beam student paths (from chart interaction) */}
          {activeBeamStudentPaths.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {activeBeamStudentPaths.slice(0, 5).map((chain, index) => (
                <div key={chain.studentName} onClick={() => handleStudentClick(chain.studentName)} className="cursor-pointer">
                  <ChainThoughtPathCard chain={chain} index={index} isEvidenceOnly={hasEvidenceOnlyChains} />
                </div>
              ))}
            </div>
          ) : /* Saved student chains (from result data) */
          savedStudentChains.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {savedStudentChains.slice(0, 5).map((chain, index) => (
                <details key={chain.session_id} className="group cursor-pointer rounded-xl border border-border-secondary bg-surface px-4 py-3 shadow-sm" open={index === 0}
                  onClick={() => { handleStudentClick(chain.student_name || chain.session_id); }}>
                  <summary className="flex select-none items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-text-base">{chain.student_name || chain.session_id}</div>
                      <div className="text-xs text-text-tertiary">{formatTimeRange(chain.start_at, chain.end_at)} · {chain.question_count || chain.nodes?.length || 0} 个问题</div>
                    </div>
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">#{index + 1}</span>
                  </summary>
                  {chain.summary && <div className="mt-3 text-sm text-text-secondary">{chain.summary}</div>}
                  <div className="mt-3 space-y-2 border-t border-border-secondary pt-3">
                    {(chain.nodes || []).map((node, nodeIndex) => (
                      <div key={`${chain.session_id}-${node.time}-${nodeIndex}`} className="rounded-lg bg-surface-2 px-3 py-2">
                        <div className="mb-1 text-xs font-semibold text-primary">{node.time ? dayjs(node.time).format("HH:mm") : `节点 ${nodeIndex + 1}`}</div>
                        <div className="text-sm leading-relaxed text-text-base">{node.question}</div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ) : /* Live chain summaries (from beam analysis) */
          chainSummaries.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {chainSummaries.slice(0, 4).map((chain, index) => (
                <ChainCard key={chain.sessionId} chain={chain} index={index} />
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-border-secondary bg-surface text-sm text-text-tertiary">
              暂无可阅读的问题链
            </div>
          )}
        </section>

        {detail.agent_id && (
          <TrendDashboard agentId={detail.agent_id} analysisType="student_chains" />
        )}
      </div>

      <StudentProfileDrawer
        open={profileChain !== null}
        onClose={() => setProfileChain(null)}
        chain={profileChain}
      />
    </SharedResultLayout>
  );
};

export default ChainAnalysisResultPage;
