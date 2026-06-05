/**
 * 学生问题链分析结果页 — 教师主线、光束图、学生链摘要
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, BookOpenCheck, Lightbulb, Loader2, MessageSquare, Sparkles, Target, Users } from "lucide-react";
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
import type {
  AnalysisAgentStatus,
  BeamRangeQuestion,
  BeamStudentChain,
  ChainDeepAnalysis,
  DeepAnalysisStatus,
  MainQuestionChainItem,
  TeacherQuestionItem,
  TopicItem,
} from "../types";
import { formatTimeRange, mergeAnalysisDateAndClockTime } from "../normalize";

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
const shortText = (value: string | undefined, max = 18) => {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const hasChainDeepAnalysis = (deep: ChainDeepAnalysis) => Boolean(
  deep.executive_summary
  || (deep.cognitive_trajectories || []).length
  || (deep.teacher_question_evaluations || []).length
  || deep.intervention_plan?.whole_class?.length
  || deep.intervention_plan?.small_group?.length
  || deep.intervention_plan?.individual?.length,
);

const AgentDiagnosisStatus: React.FC<{
  agent?: AnalysisAgentStatus;
  status?: DeepAnalysisStatus;
}> = ({ agent, status }) => {
  const isReady = status?.status === "completed" || agent?.status === "completed";
  const label = isReady ? "认知路径智能体已接入" : status?.reason || agent?.reason || "未启用智能体诊断";
  return (
    <div className={`mt-4 rounded-2xl border px-3 py-2 text-xs leading-relaxed ${
      isReady
        ? "border-primary/20 bg-primary-soft/40 text-primary"
        : "border-border-secondary bg-surface/80 text-text-tertiary"
    }`}>
      <div className="font-semibold">{label}</div>
      {agent?.name && <div className="mt-0.5 opacity-80">{agent.name}{agent.model_name ? ` · ${agent.model_name}` : ""}</div>}
    </div>
  );
};

type EvidenceItem = {
  studentName: string;
  content: string;
  time?: string;
  relationLabel?: string;
  bloomLevel?: string;
  teacherQuestion?: string;
};

const TopicConstellation: React.FC<{ topics: TopicItem[] }> = ({ topics }) => {
  const visible = topics.slice(0, 9);
  const maxCount = Math.max(...visible.map((item) => item.count || 0), 1);

  if (visible.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border-secondary bg-surface-2/60 text-sm text-text-tertiary">
        暂无热点主题，可先生成一次热点分析
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-primary/15 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">认知路径焦点图</h2>
          <p className="mt-1 text-xs text-text-tertiary">主题大小来自提问频次，用来判断学生问题链在哪些概念上进入最近发展区或发生偏离。</p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{visible.length} 个认知焦点</span>
      </div>
      <div className="flex min-h-[210px] flex-wrap content-center items-center justify-center gap-3 rounded-2xl bg-[radial-gradient(circle_at_center,var(--ws-color-primary-muted),transparent_62%)] p-4">
        {visible.map((topic, index) => {
          const strength = Math.max(0.45, (topic.count || 1) / maxCount);
          const size = 12 + Math.round(strength * 18);
          const isPrimary = index === 0;
          return (
            <div
              key={`${topic.topic}-${index}`}
              className={`max-w-[210px] rounded-full border px-4 py-2 text-center shadow-sm transition-transform hover:-translate-y-0.5 ${
                isPrimary
                  ? "border-primary/35 bg-primary text-white"
                  : "border-primary/20 bg-surface/95 text-primary"
              }`}
              style={{ fontSize: size }}
              title={(topic.questions || []).slice(0, 2).join("\n")}
            >
              <span className="block truncate font-semibold">{topic.topic}</span>
              <span className={`mt-0.5 block text-[11px] ${isPrimary ? "text-white/80" : "text-text-tertiary"}`}>{topic.count} 次</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PulseRail: React.FC<{ chains: BeamStudentChain[] }> = ({ chains }) => {
  const buckets = useMemo(() => {
    const grouped = new Map<string, { label: string; count: number; students: Set<string>; questions: string[] }>();
    chains.forEach((chain) => {
      chain.nodes.forEach((node) => {
        const label = dayjs(node.time).format("HH:mm");
        const current = grouped.get(label) || { label, count: 0, students: new Set<string>(), questions: [] };
        current.count += 1;
        current.students.add(chain.studentName);
        current.questions.push(node.content);
        grouped.set(label, current);
      });
    });
    return [...grouped.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 10);
  }, [chains]);
  const maxCount = Math.max(...buckets.map((item) => item.count), 1);

  return (
    <div className="rounded-3xl border border-border/70 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">支架时机脉冲</h2>
          <p className="mt-1 text-xs text-text-tertiary">把连续提问转成节奏条，帮助定位何时该追问、示范、降阶或让学生同伴解释。</p>
        </div>
        <Activity className="h-5 w-5 text-primary" />
      </div>
      {buckets.length === 0 ? (
        <div className="flex h-[210px] items-center justify-center rounded-2xl bg-surface-2/70 text-sm text-text-tertiary">暂无时序脉冲</div>
      ) : (
        <div className="space-y-3">
          {buckets.map((bucket) => {
            const width = `${Math.max(16, Math.round((bucket.count / maxCount) * 100))}%`;
            const isPeak = bucket.count === maxCount && maxCount > 1;
            return (
              <div key={bucket.label} className="group">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold tabular-nums text-text-base">{bucket.label}</span>
                  <span className={isPeak ? "text-[var(--ws-color-danger)]" : "text-text-tertiary"}>
                    {bucket.count} 问 · {bucket.students.size} 人
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isPeak ? "bg-[var(--ws-color-danger)]" : "bg-primary"
                    }`}
                    style={{ width }}
                    title={bucket.questions.slice(0, 2).join("\n")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TeachingActionStack: React.FC<{
  topics: TopicItem[];
  evidence: EvidenceItem[];
  interventionPlan?: ChainDeepAnalysis["intervention_plan"];
}> = ({ topics, evidence, interventionPlan }) => {
  const leadTopic = topics[0]?.topic || "核心困惑";
  const secondTopic = topics[1]?.topic || evidence[0]?.content || "课堂追问";
  const quote = evidence[0]?.content || topics[0]?.questions?.[0] || "暂无学生原问";
  const deepActions = [
    ...(interventionPlan?.whole_class || []).slice(0, 1).map((item) => ({
      title: item.target_gap ? `全班修补「${shortText(item.target_gap, 14)}」` : "全班层干预",
      body: item.action || "围绕共性漏洞安排一次全班即时诊断。",
      tag: item.when ? `全班 · ${item.when}` : "全班",
      evidence: quote,
    })),
    ...(interventionPlan?.small_group || []).slice(0, 1).map((item) => ({
      title: item.common_issue ? `小组处理「${shortText(item.common_issue, 14)}」` : "小组层干预",
      body: item.action || "把相同卡点的学生组织成小组，用同伴解释和半成品示例推进。",
      tag: `小组 · ${(item.target_students || []).slice(0, 2).join("、") || "待分组"}`,
      evidence: evidence[1]?.content || quote,
    })),
    ...(interventionPlan?.individual || []).slice(0, 1).map((item) => ({
      title: item.student ? `个体跟进：${item.student}` : "个体层干预",
      body: item.action || item.goal || "对该学生进行一次短时一对一追问，确认当前认知状态。",
      tag: `个体 · ${item.urgency || "中"}`,
      evidence: evidence[2]?.content || quote,
    })),
  ];
  const fallbackActions = [
    {
      title: `定位「${shortText(leadTopic, 12)}」的认知卡点`,
      body: "先让学生说出自己的推理步骤，再用反例制造认知冲突，确认问题是概念误解还是程序性失误。",
      tag: "认知诊断",
      evidence: quote,
    },
    {
      title: `为「${shortText(secondTopic, 12)}」设置最近发展区支架`,
      body: "把学生还差一步才能完成的问题拆成提示、半成品示例、独立解释三层，逐步撤掉支架。",
      tag: "脚手架",
      evidence: evidence[1]?.content || topics[1]?.questions?.[0] || quote,
    },
    {
      title: "用学生原问做迁移检验",
      body: "挑 2 个代表性问题让学生互评解释路径，再换一个相似情境，观察能否从跟随教师转向独立应用。",
      tag: "近迁移",
      evidence: evidence[2]?.content || quote,
    },
  ];
  const actions = deepActions.length > 0 ? deepActions : fallbackActions;

  return (
    <div className="rounded-3xl border border-[var(--ws-color-warning)]/20 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">认知支架动作</h2>
          <p className="mt-1 text-xs text-text-tertiary">每条建议都绑定学生原问，用来决定何时补支架、何时撤支架、何时做迁移检验。</p>
        </div>
        <BookOpenCheck className="h-5 w-5 text-[var(--ws-color-warning)]" />
      </div>
      <div className="space-y-3">
        {actions.map((action, index) => (
          <div key={action.title} className="rounded-2xl border border-border-secondary bg-surface-2/70 p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-snug text-text-base">{index + 1}. {action.title}</h3>
              <span className="shrink-0 rounded-full bg-[var(--ws-color-warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ws-color-warning)]">{action.tag}</span>
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">{action.body}</p>
            <div className="mt-2 border-l-2 border-primary/35 pl-2 text-[11px] leading-relaxed text-text-tertiary">
              “{shortText(action.evidence, 42)}”
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RangeEvidenceStrip: React.FC<{ items: EvidenceItem[] }> = ({ items }) => (
  <aside className="rounded-3xl border border-border/70 bg-surface/95 p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold text-text-base">认知路径证据</h3>
        <p className="mt-1 text-[11px] text-text-tertiary">随光束图时间范围同步更新，显示当前支架窗口内的学生原问</p>
      </div>
      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{items.length} 条</span>
    </div>
    {items.length === 0 ? (
      <div className="flex h-[260px] items-center justify-center rounded-2xl bg-surface-2/70 text-xs text-text-tertiary">选择时间段后显示学生原问</div>
    ) : (
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {items.slice(0, 8).map((item, index) => (
          <button
            key={`${item.studentName}-${item.time}-${index}`}
            type="button"
            className="w-full rounded-2xl border border-border-secondary bg-surface-2/80 p-3 text-left transition hover:border-primary/30 hover:bg-primary-soft/25"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-semibold text-text-base">{item.studentName}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-text-tertiary">{item.time ? dayjs(item.time).format("HH:mm") : ""}</span>
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">{item.content}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.relationLabel && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary">{item.relationLabel}</span>}
              {item.bloomLevel && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-text-secondary">层次：{item.bloomLevel}</span>}
              {item.teacherQuestion && <span className="rounded-full bg-[var(--ws-color-warning-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--ws-color-warning)]">教师触发</span>}
            </div>
          </button>
        ))}
      </div>
    )}
  </aside>
);

const RangeLearningCoach: React.FC<{
  questions: BeamRangeQuestion[];
  teacherAnchorCount: number;
  evidenceOnly?: boolean;
}> = ({ questions, teacherAnchorCount, evidenceOnly }) => {
  const studentCount = new Set(questions.map((item) => item.studentName)).size;
  const relationText = questions.map((item) => `${item.relationLabel || ""} ${item.relationType || ""}`);
  const levelText = questions.map((item) => item.bloomLevel || "");
  const diagnosticCount = relationText.filter((text) => /偏离|调试|质疑|off_track|debug|challenge/.test(text)).length;
  const scaffoldCount = relationText.filter((text) => /澄清|跟进|clarify|follow_up/.test(text)).length;
  const transferCount = levelText.filter((text) => /应用|分析|评价|创造/.test(text)).length;
  const foundationalCount = levelText.filter((text) => /了解|知道|理解/.test(text)).length;
  const evidenceLevel = studentCount >= 5
    ? "可作为班级趋势"
    : studentCount >= 2
      ? "适合作为小组线索"
      : "仅作个别线索";

  const insight = (() => {
    if (questions.length === 0) {
      return {
        title: "先选择一个支架窗口",
        body: "框选或拖动时间条后，再判断学生追问是在靠近教师主线、进入迁移，还是发生偏离。",
        action: "先看教师锚点前后 3-5 分钟的学生原问。",
      };
    }
    if (diagnosticCount > 0 && foundationalCount >= transferCount) {
      return {
        title: "优先做偏离诊断",
        body: "当前区间同时出现基础层次问题和调试/质疑信号，不宜直接加难度；先让学生说出推理步骤，再用反例澄清。",
        action: "用“你认为哪一步开始不成立？”追问，再补最小必要支架。",
      };
    }
    if (transferCount >= scaffoldCount && transferCount > 0) {
      return {
        title: "可以尝试撤除部分支架",
        body: "学生问题已经进入应用、分析或创造层次，适合安排近迁移任务检验是否真正理解。",
        action: "先让学生同伴解释路径，再换一个相似情境独立完成。",
      };
    }
    return {
      title: "保留轻量脚手架",
      body: "当前区间仍以澄清和跟进为主，说明学生正在接近最近发展区，但还需要提示、半成品示例或关键条件提醒。",
      action: "用提示语而不是直接讲答案，观察学生能否完成下一步推理。",
    };
  })();

  return (
    <aside className="rounded-3xl border border-primary/15 bg-primary-soft/25 p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-base">区间支架判断</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">
          基于当前时间段内学生原问做形成性判断，避免把单个漂亮路径误读成全班已经掌握。
        </p>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { label: "学生", value: `${studentCount} 人` },
          { label: "问题", value: `${questions.length} 条` },
          { label: "教师锚点", value: `${teacherAnchorCount} 个` },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border-secondary bg-surface/85 px-3 py-2">
            <div className="text-[10px] text-text-tertiary">{item.label}</div>
            <div className="mt-0.5 text-sm font-semibold text-primary">{item.value}</div>
          </div>
        ))}
      </div>
      {questions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {["了解/知道", "理解", "应用", "分析", "评价", "创造"].map((level) => {
            const count = levelText.filter((item) => item === level).length;
            if (count === 0) return null;
            return (
              <span key={level} className="rounded-full bg-surface/85 px-2 py-0.5 text-[11px] text-text-secondary">
                {level} {count}
              </span>
            );
          })}
        </div>
      )}
      <div className="rounded-2xl border border-border-secondary bg-surface/90 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{evidenceLevel}</span>
          {evidenceOnly && <span className="rounded-full bg-[var(--ws-color-warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ws-color-warning)]">证据链恢复</span>}
        </div>
        <h4 className="mt-2 text-sm font-semibold text-text-base">{insight.title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{insight.body}</p>
        <p className="mt-2 border-l-2 border-primary/35 pl-2 text-[11px] leading-relaxed text-text-tertiary">下一步校验：{insight.action}</p>
      </div>
    </aside>
  );
};

const ChainDeepDiagnosticPanel: React.FC<{ deep: ChainDeepAnalysis }> = ({ deep }) => {
  const trajectories = deep.cognitive_trajectories || [];
  const evaluations = deep.teacher_question_evaluations || [];
  const universalGaps = deep.learning_gaps?.universal_gaps || [];
  const categories = deep.participation_profile?.student_categories || {};
  const hasContent = hasChainDeepAnalysis(deep) || Object.keys(categories).length > 0 || universalGaps.length > 0;
  if (!hasContent) return null;

  return (
    <section className="rounded-[2rem] border border-primary/15 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">智能体认知路径诊断</h2>
          <p className="mt-1 text-xs text-text-tertiary">把光束图路径进一步解释为学生轨迹、教师提问效果和学习漏洞优先级。</p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">cognitive agent</span>
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.9fr_1.15fr_0.95fr]">
        <div className="rounded-2xl border border-border-secondary bg-surface-2/70 p-4">
          <div className="mb-2 text-xs font-semibold text-primary">参与画像</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-surface/85 px-3 py-2">
              <div className="text-lg font-bold text-text-base">{deep.participation_profile?.total_students_with_questions || 0}</div>
              <div className="text-[11px] text-text-tertiary">提问学生</div>
            </div>
            <div className="rounded-xl bg-surface/85 px-3 py-2">
              <div className="text-lg font-bold text-text-base">{deep.participation_profile?.avg_questions_per_student || 0}</div>
              <div className="text-[11px] text-text-tertiary">人均提问</div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {Object.entries(categories).slice(0, 5).map(([name, value]) => (
              <div key={name} className="flex items-center justify-between rounded-xl bg-surface/75 px-3 py-1.5 text-xs">
                <span className="font-medium text-text-secondary">{name}</span>
                <span className="text-primary">{value?.count || 0} 人</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border-secondary bg-surface-2/70 p-4">
          <div className="mb-2 text-xs font-semibold text-primary">代表性认知轨迹</div>
          <div className="space-y-2">
            {trajectories.slice(0, 4).map((item, index) => (
              <div key={`${item.student_name}-${index}`} className="rounded-xl bg-surface/85 px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-text-base">{item.student_name || `学生 ${index + 1}`}</span>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                    {item.trajectory_type || "待判断"} · {item.confidence || "中"}
                  </span>
                </div>
                {item.root_cause && <p className="text-xs leading-relaxed text-text-secondary">根因：{item.root_cause}</p>}
                {item.learning_suggestion && <p className="mt-1 text-xs leading-relaxed text-primary">建议：{item.learning_suggestion}</p>}
              </div>
            ))}
            {trajectories.length === 0 && <p className="text-sm text-text-tertiary">暂无可推断轨迹。</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)]/55 p-4">
          <div className="mb-2 text-xs font-semibold text-[var(--ws-color-warning)]">教师提问与漏洞</div>
          <div className="space-y-2">
            {evaluations.slice(0, 2).map((item, index) => (
              <div key={`${item.teacher_question_id}-${index}`} className="rounded-xl bg-surface/85 px-3 py-2">
                <div className="text-sm font-semibold text-text-base">{shortText(item.teacher_question, 36)}</div>
                <div className="mt-0.5 text-[11px] text-text-tertiary">触发 {item.triggered_count || 0} 问 · 效果 {item.effectiveness_score ?? "-"} 分</div>
                {item.improvement_suggestion && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{item.improvement_suggestion}</p>}
              </div>
            ))}
            {universalGaps.slice(0, 2).map((gap, index) => (
              <div key={`${gap.gap_name}-${index}`} className="rounded-xl bg-surface/85 px-3 py-2">
                <div className="text-sm font-semibold text-text-base">{gap.gap_name || `学习漏洞 ${index + 1}`}</div>
                <div className="mt-0.5 text-[11px] text-text-tertiary">{gap.severity || "中"}优先级 · 影响 {gap.affected_count || 0} 人</div>
                {gap.intervention && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{gap.intervention}</p>}
              </div>
            ))}
            {evaluations.length === 0 && universalGaps.length === 0 && <p className="text-sm text-text-tertiary">暂无教师提问评估或漏洞诊断。</p>}
          </div>
        </div>
      </div>
    </section>
  );
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
  const chainDeepAnalysis = useMemo(
    () => (resultData.deep_analysis || {}) as ChainDeepAnalysis,
    [resultData.deep_analysis],
  );
  const chainDeepAnalysisReady = useMemo(
    () => hasChainDeepAnalysis(chainDeepAnalysis),
    [chainDeepAnalysis],
  );

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
  const insightTopics = useMemo(() => {
    const merged = [...hotThemes, ...uncovered];
    const seen = new Set<string>();
    return merged
      .filter((item) => {
        const key = item.topic.trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.count - a.count);
  }, [hotThemes, uncovered]);
  const allBeamEvidence = useMemo<EvidenceItem[]>(() => (
    beamStudentChains
      .flatMap((chain) => chain.nodes.map((node) => ({
        studentName: chain.studentName,
        content: node.content,
        time: node.time,
        relationLabel: node.relationLabel,
        bloomLevel: node.bloomLevel,
        teacherQuestion: node.teacherQuestion,
      })))
      .sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf())
  ), [beamStudentChains]);
  const selectedEvidence = useMemo<EvidenceItem[]>(() => {
    if (activeBeamQuestions.length === 0) return allBeamEvidence;
    return activeBeamQuestions.map((item: BeamRangeQuestion) => ({
      studentName: item.studentName,
      content: item.content,
      time: item.time,
      relationLabel: item.relationLabel,
      bloomLevel: item.bloomLevel,
      teacherQuestion: item.teacherQuestion,
    }));
  }, [activeBeamQuestions, allBeamEvidence]);
  const insightDiagnosis = useMemo(() => {
    if (chainDeepAnalysis.executive_summary) return shortText(chainDeepAnalysis.executive_summary, 60);
    const lead = insightTopics[0]?.topic || savedMainQuestionChain[0]?.question || "课堂追问";
    const second = insightTopics[1]?.topic || uncovered[0]?.topic || activeBeamQuestions[0]?.content || "边界情况";
    return `${shortText(lead, 14)}进入最近发展区，${shortText(second, 14)}是脚手架窗口`;
  }, [activeBeamQuestions, chainDeepAnalysis.executive_summary, insightTopics, savedMainQuestionChain, uncovered]);

  useEffect(() => {
    if (!beamRange?.startAt || !beamRange?.endAt || beamRange.source === "manual") return;
    setBeamRangeInputs({
      start: formatInputTime(beamRange.startAt),
      end: formatInputTime(beamRange.endAt),
    });
  }, [beamRange]);

  const handleApplyBeamRange = () => {
    const base = beamRange?.startAt || beamStudentChains[0]?.startAt || detail?.start_at || detail?.created_at;
    const startAt = mergeAnalysisDateAndClockTime(base, beamRangeInputs.start);
    const endAt = mergeAnalysisDateAndClockTime(base, beamRangeInputs.end);
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
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-primary/15 bg-surface/85 p-5 shadow-md backdrop-blur">
          <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(480px,0.8fr)]">
            <div className="rounded-[1.5rem] border border-primary/20 bg-[linear-gradient(135deg,var(--ws-color-primary-muted),var(--ws-color-surface))] p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">光束图认知路径分析</p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-base">{insightDiagnosis}</h1>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">
                {chainDeepAnalysis.executive_summary || "光束图关注“学生沿着教师主线怎样追问”：用澄清、跟进、应用、迁移、偏离等关系识别认知路径，并判断何时该投放或撤除支架。"}
              </p>
              <AgentDiagnosisStatus agent={resultData.analysis_agent} status={resultData.deep_analysis_status} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard icon={<Users className="h-4 w-4" />} label="参与学生" value={studentTotal} hint="提交问题的学生数" />
              <SummaryCard icon={<MessageSquare className="h-4 w-4" />} label="提问总数" value={questionTotal} hint="学生提问总条数" />
              <SummaryCard icon={<Target className="h-4 w-4" />} label="问题链" value={chainCount} hint="可追踪的学生链路" />
              <SummaryCard icon={<Lightbulb className="h-4 w-4" />} label="教师锚点" value={teacherAnchorCount} hint="教师主线问题数" />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr_0.95fr]">
            <TopicConstellation topics={insightTopics} />
            <PulseRail chains={beamStudentChains} />
            <TeachingActionStack topics={insightTopics} evidence={selectedEvidence} interventionPlan={chainDeepAnalysis.intervention_plan} />
          </div>
        </section>

        {/* 语义光束图 */}
        <section className="rounded-[2rem] border border-primary/15 bg-surface/90 p-5 shadow-md">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <ArrowRight className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-semibold text-text-base">学生认知路径光束图</h2>
              </div>
              <p className="text-sm text-text-tertiary">橙色中轴是教师问题链，彩色路径按学习层次上下展开；澄清、跟进、调试、质疑等只作为问题关系标签辅助判断。</p>
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
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-border-secondary bg-surface-2/70 px-3 py-2">
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
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-surface">
              {loadingBeam ? (
                <div className="flex h-[540px] items-center justify-center text-sm text-text-tertiary">正在加载链条数据...</div>
              ) : (
                <StudentBeamChart
                  height={540}
                  teacherAnchors={beamTeacherAnchors}
                  studentChains={beamStudentChains}
                  burstPoints={resultData.burst_points || []}
                  manualRange={beamManualRange}
                  onRangeChange={handleBeamRangeChange}
                  onStudentClick={handleStudentClick}
                />
              )}
            </div>
            <div className="space-y-3">
              <RangeLearningCoach
                questions={activeBeamQuestions}
                teacherAnchorCount={visibleBeamTeacherAnchors.length}
                evidenceOnly={hasEvidenceOnlyChains}
              />
              <RangeEvidenceStrip items={selectedEvidence} />
            </div>
          </div>
        </section>

        {chainDeepAnalysisReady && <ChainDeepDiagnosticPanel deep={chainDeepAnalysis} />}

        {/* 教师主线 + AI 主线 */}
        <div className="grid gap-3 xl:grid-cols-2">
          <CollapsibleTeacherMainline items={teacherQuestions} />
          <CollapsibleAiMainline items={savedMainQuestionChain} />
        </div>

        {/* 区间内学生生发性问题 */}
        {(uncovered.length > 0 || activeBeamQuestions.length > 0) && (
          <CollapsibleSection
            title="区间内认知冲突与生发问题"
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
                <p className="text-xs font-medium text-primary mb-1.5">当前区间关联的热点主题</p>
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
              教学建议：优先关注当前区间里学生集中转向、追问或偏离教师主线的节点，把它们作为最近发展区证据来决定支架投放时机。
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
