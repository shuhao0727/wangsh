/**
 * 活动详情 Drawer - 管理端复用组件
 */
import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Activity, ActivityStats } from "@services/classroom";

const ANALYSIS_STATUS_MAP: Record<string, { variant: React.ComponentProps<typeof Badge>["variant"]; text: string }> = {
  pending:        { variant: "neutral", text: "待分析" },
  running:        { variant: "info", text: "分析中" },
  success:        { variant: "success", text: "分析完成" },
  failed:         { variant: "danger", text: "分析失败" },
  skipped:        { variant: "warning", text: "已跳过" },
  not_applicable: { variant: "neutral", text: "不适用" },
};

const parseBlankAnswers = (raw?: string | null): string[] => {
  const text = String(raw || "").trim();
  if (!text) return [];
  if (!text.startsWith("[") && !text.startsWith("{")) return [text];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? "").trim());
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => String((parsed as any)[k] ?? "").trim());
    }
  } catch {
    return [text];
  }
  return [text];
};

const formatCorrectAnswer = (raw?: string | null): string => {
  const blanks = parseBlankAnswers(raw);
  if (blanks.length <= 1) return String(raw || "");
  return blanks.map((v, i) => `(${i + 1}) ${v}`).join("；");
};

const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  return (
    <div className="text-sm leading-relaxed text-text-secondary">
      {text.split(/\n{2}/).map((para, i) => {
        if (para.startsWith("```")) {
          const code = para.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
          return (
            <pre key={i} className="my-2 overflow-auto rounded-md bg-surface-2 px-3 py-2 text-xs">
              {code}
            </pre>
          );
        }
        return (
          <p key={i} className="my-1.5 whitespace-pre-wrap">
            {para.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part,
            )}
          </p>
        );
      })}
    </div>
  );
};

const CircleProgress: React.FC<{ percent: number; size?: number; color?: string; label?: string }> = ({
  percent,
  size = 100,
  color = "var(--ws-color-primary)",
  label,
}) => {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--ws-color-border-secondary)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-text text-sm font-semibold"
        >
          {clamped}%
        </text>
      </svg>
      {label ? <div className="text-xs text-text-tertiary">{label}</div> : null}
    </div>
  );
};

const LineProgress: React.FC<{ percent: number; color?: string }> = ({ percent, color = "var(--ws-color-primary)" }) => {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
};

export const ActivityDetailContent: React.FC<{ activity: Activity; stats: ActivityStats | null }> = ({ activity, stats }) => {
  const analysisContext = activity.analysis_context || {};
  const riskSlots = Array.isArray(analysisContext.risk_slots) ? analysisContext.risk_slots : [];
  const commonMistakes = Array.isArray(analysisContext.common_mistakes) ? analysisContext.common_mistakes : [];
  const analysisStatus = ANALYSIS_STATUS_MAP[String(activity.analysis_status || "")] || ANALYSIS_STATUS_MAP.pending;
  const codeOpt = Array.isArray(activity.options) ? (activity.options as any[]).find((o) => o.key === "__code__") : null;

  const lifecycle =
    activity.status === "active"
      ? { text: "进行中", dot: "bg-primary" }
      : activity.status === "ended"
        ? { text: "已结束", dot: "bg-[var(--ws-color-success)]" }
        : { text: "草稿", dot: "bg-text-tertiary" };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant={activity.activity_type === "vote" ? "info" : "success"}>
          {activity.activity_type === "vote" ? "投票" : "填空"}
        </Badge>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-secondary">
          <span className={`inline-block h-2 w-2 rounded-full ${lifecycle.dot}`} />
          {lifecycle.text}
        </span>
        {activity.time_limit > 0 && <Badge variant="secondary">{activity.time_limit}s</Badge>}
      </div>

      {activity.activity_type === "vote" && Array.isArray(activity.options) && activity.options.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs text-text-tertiary">选项</div>
          {(activity.options as any[]).map((opt: any) => {
            const isCorrect = activity.correct_answer?.includes(opt.key);
            return (
              <div
                key={opt.key}
                className={cn(
                  "mb-1 rounded border px-2.5 py-1 text-sm",
                  isCorrect
                    ? "border-[var(--ws-color-success)]/30 bg-[var(--ws-color-success-soft)] text-[var(--ws-color-success)]"
                    : "border-border bg-surface-2 text-text-base",
                )}
              >
                <span className={cn(isCorrect && "font-semibold")}>{opt.key}. {opt.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {activity.correct_answer && (
        <div className="mb-3 rounded-md bg-[var(--ws-color-success-soft)] px-2.5 py-1.5 text-sm">
          <span className="font-medium text-[var(--ws-color-success)]">参考答案：</span>
          {formatCorrectAnswer(activity.correct_answer)}
        </div>
      )}

      {codeOpt && (
        <div className="mb-3">
          <div className="mb-1 text-xs text-text-tertiary">代码模板</div>
          <pre className="!m-0 overflow-x-auto rounded-md bg-code-bg px-3 py-2.5 text-xs text-code-text">{codeOpt.text}</pre>
        </div>
      )}

      {stats && (
        <div>
          <Separator className="my-3" />
          <div className="mb-2.5 text-sm font-semibold">答题统计（{stats.total_responses} 人参与）</div>
          {activity.activity_type === "vote" &&
            Array.isArray(activity.options) &&
            (activity.options as any[]).map((opt: any) => {
              const count = stats.option_counts?.[opt.key] || 0;
              const pct = stats.total_responses > 0 ? Math.round((count / stats.total_responses) * 100) : 0;
              const isCorrect = activity.correct_answer?.includes(opt.key);
              return (
                <div key={opt.key} className="mb-2.5">
                  <div className="mb-0.5 flex justify-between text-sm">
                    <span className={cn(isCorrect ? "font-semibold text-[var(--ws-color-success)]" : "text-text-base")}>
                      {opt.key}. {opt.text}
                    </span>
                    <span className="text-text-tertiary">
                      {count} 票 ({pct}%)
                    </span>
                  </div>
                  <LineProgress percent={pct} color={isCorrect ? "var(--ws-color-success)" : "var(--ws-color-primary)"} />
                </div>
              );
            })}

          {activity.activity_type === "fill_blank" && (
            <div>
              {stats.correct_rate != null ? (
                <div className="p-5 text-center">
                  <CircleProgress percent={stats.correct_rate} size={100} label="整体正确率" />
                </div>
              ) : (
                <div className="text-xs text-text-tertiary">暂无作答数据</div>
              )}
              {Array.isArray(stats.blank_slot_stats) &&
                stats.blank_slot_stats.map((slot: any) => (
                  <div key={slot.slot_index} className="mb-2 rounded-lg border border-border p-2">
                    <div className="mb-1 text-sm">
                      <Badge variant="violet" className="mr-1">空位 {slot.slot_index}</Badge>
                      标准答案：{slot.correct_answer}
                    </div>
                    <div className="mb-1 flex items-center gap-2 text-xs text-text-tertiary">
                      <span>{slot.correct_rate ?? 0}% 正确</span>
                    </div>
                    <LineProgress
                      percent={slot.correct_rate ?? 0}
                      color={
                        slot.correct_rate != null && slot.correct_rate >= 60
                          ? "var(--ws-color-success)"
                          : "var(--ws-color-error)"
                      }
                    />
                    {slot.top_wrong_answers?.length > 0 && (
                      <div className="mt-1 text-xs text-text-tertiary">
                        高频错答：{slot.top_wrong_answers.slice(0, 3).map((x: any) => `${x.answer}(${x.count})`).join("、")}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activity.analysis_status && activity.analysis_status !== "not_applicable" && (
        <div className="mt-4">
          <Separator className="my-3" />
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold">AI 分析</span>
            <Badge variant={analysisStatus.variant}>{analysisStatus.text}</Badge>
          </div>
          {activity.analysis_status === "success" && activity.analysis_result && (
            <div>
              <SimpleMarkdown text={activity.analysis_result} />
              {riskSlots.length > 0 && (
                <div className="mt-2 text-xs text-[var(--ws-color-warning)]">
                  薄弱空位：{riskSlots.map((s: any) => `空位${s.slot_index}(${s.correct_rate ?? 0}%)`).join("、")}
                </div>
              )}
              {commonMistakes.length > 0 && (
                <div className="mt-1 text-xs text-text-secondary">
                  高频错答：{commonMistakes.slice(0, 5).map((x: any) => `${x.answer}(${x.count})`).join("、")}
                </div>
              )}
            </div>
          )}
          {activity.analysis_status === "failed" && (
            <Alert variant="destructive">
              <AlertTitle>自动分析失败</AlertTitle>
              <AlertDescription>失败原因：{activity.analysis_error || "未知错误"}</AlertDescription>
            </Alert>
          )}
          {activity.analysis_status === "skipped" && (
            <Alert variant="warning">
              <AlertTitle>自动分析已跳过</AlertTitle>
              <AlertDescription>作答数据不足，已跳过分析</AlertDescription>
            </Alert>
          )}
          {(!activity.analysis_status || activity.analysis_status === "pending") && (
            <div className="text-xs text-text-tertiary">活动结束后将自动触发分析（需在活动中配置分析智能体）</div>
          )}
        </div>
      )}
    </div>
  );
};

interface Props {
  open: boolean;
  activity: Activity | null;
  stats: ActivityStats | null;
  onClose: () => void;
  extra?: React.ReactNode;
}

export const ActivityDetailDrawer: React.FC<Props> = ({ open, activity, stats, onClose, extra }) => (
  <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
    <SheetContent side="right" className="w-[min(92vw,680px)] p-0 sm:max-w-[680px]">
      <SheetHeader className="border-b border-border px-6 py-4">
        <SheetTitle>{activity?.title || "活动详情"}</SheetTitle>
      </SheetHeader>
      <div className="h-[calc(100vh-64px)] overflow-y-auto px-6 py-4">
        {activity ? <ActivityDetailContent activity={activity} stats={stats} /> : null}
        {extra}
      </div>
    </SheetContent>
  </Sheet>
);

export default ActivityDetailDrawer;
