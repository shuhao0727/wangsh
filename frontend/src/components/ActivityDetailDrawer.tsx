/**
 * 活动详情 Drawer - 管理端复用组件
 */
import React from "react";
import { Drawer, Tag, Badge, Divider, Progress, Alert } from "antd";
import { Activity, ActivityStats } from "@services/classroom";

const ANALYSIS_STATUS_MAP: Record<string, { color: string; text: string }> = {
  pending:        { color: "default",  text: "待分析" },
  running:        { color: "blue",     text: "分析中" },
  success:        { color: "success",  text: "分析完成" },
  failed:         { color: "red",      text: "分析失败" },
  skipped:        { color: "warning",  text: "已跳过" },
  not_applicable: { color: "default",  text: "不适用" },
};

const parseBlankAnswers = (raw?: string | null): string[] => {
  const text = String(raw || "").trim();
  if (!text) return [];
  if (!text.startsWith("[") && !text.startsWith("{")) return [text];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? "").trim());
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed).sort((a, b) => Number(a) - Number(b)).map((k) => String((parsed as any)[k] ?? "").trim());
    }
  } catch {}
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
    <div className="leading-relaxed text-sm text-gray-700">
      {text.split(/\n{2}/).map((para, i) => {
        if (para.startsWith("```")) {
          const code = para.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
          return <pre key={i} className="bg-gray-100 rounded-md px-3 py-2 text-xs my-2 overflow-auto">{code}</pre>;
        }
        return (
          <p key={i} className="my-1.5 whitespace-pre-wrap">
            {para.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part
            )}
          </p>
        );
      })}
    </div>
  );
};

export const ActivityDetailContent: React.FC<{ activity: Activity; stats: ActivityStats | null }> = ({ activity, stats }) => {
  const analysisContext = activity.analysis_context || {};
  const riskSlots = Array.isArray(analysisContext.risk_slots) ? analysisContext.risk_slots : [];
  const commonMistakes = Array.isArray(analysisContext.common_mistakes) ? analysisContext.common_mistakes : [];
  const analysisStatus = ANALYSIS_STATUS_MAP[String(activity.analysis_status || "")] || ANALYSIS_STATUS_MAP.pending;
  const codeOpt = Array.isArray(activity.options) ? (activity.options as any[]).find(o => o.key === "__code__") : null;

  return (
    <div>
      <div className="mb-3 flex gap-2 flex-wrap items-center">
        <Tag color={activity.activity_type === "vote" ? "blue" : "green"}>
          {activity.activity_type === "vote" ? "投票" : "填空"}
        </Tag>
        <Badge
          status={activity.status === "active" ? "processing" : activity.status === "ended" ? "success" : "default"}
          text={activity.status === "active" ? "进行中" : activity.status === "ended" ? "已结束" : "草稿"}
        />
        {activity.time_limit > 0 && <Tag color="default">{activity.time_limit}s</Tag>}
      </div>

      {activity.activity_type === "vote" && Array.isArray(activity.options) && activity.options.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-400 mb-1">选项</div>
          {(activity.options as any[]).map((opt: any) => (
            <div key={opt.key} className="px-2.5 py-1 mb-1 rounded text-sm" style={{
              background: activity.correct_answer?.includes(opt.key) ? "#f6ffed" : "#fafafa",
              border: `1px solid ${activity.correct_answer?.includes(opt.key) ? "#b7eb8f" : "#f0f0f0"}`,
            }}>
              <span style={{ color: activity.correct_answer?.includes(opt.key) ? "#52c41a" : "#333", fontWeight: activity.correct_answer?.includes(opt.key) ? 600 : undefined }}>
                {opt.key}. {opt.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {activity.correct_answer && (
        <div className="mb-3 px-2.5 py-1.5 bg-green-50 rounded-md text-sm">
          <span className="text-green-500 font-medium">参考答案：</span>{formatCorrectAnswer(activity.correct_answer)}
        </div>
      )}

      {codeOpt && (
        <div className="mb-3">
          <div className="text-xs text-gray-400 mb-1">代码模板</div>
          <pre className="bg-code-bg text-code-text rounded-md px-3 py-2.5 text-xs overflow-x-auto !m-0">{codeOpt.text}</pre>
        </div>
      )}

      {stats && (
        <div>
          <Divider className="!my-3" />
          <div className="text-sm font-semibold mb-2.5">答题统计（{stats.total_responses} 人参与）</div>
          {activity.activity_type === "vote" && Array.isArray(activity.options) && (activity.options as any[]).map((opt: any) => {
            const count = stats.option_counts?.[opt.key] || 0;
            const pct = stats.total_responses > 0 ? Math.round(count / stats.total_responses * 100) : 0;
            const isCorrect = activity.correct_answer?.includes(opt.key);
            return (
              <div key={opt.key} className="mb-2.5">
                <div className="flex justify-between text-sm mb-0.5">
                  <span style={{ color: isCorrect ? "#52c41a" : "#333", fontWeight: isCorrect ? 600 : undefined }}>{opt.key}. {opt.text}</span>
                  <span className="text-gray-400">{count} 票 ({pct}%)</span>
                </div>
                <Progress percent={pct} showInfo={false} strokeColor={isCorrect ? "#52c41a" : "#4096ff"} size="small" />
              </div>
            );
          })}
          {activity.activity_type === "fill_blank" && (
            <div>
              {stats.correct_rate != null ? (
                <div className="text-center p-5">
                  <Progress type="circle" percent={stats.correct_rate} size={100} format={(p) => `${p}%`} />
                  <div className="mt-2 text-gray-400">整体正确率</div>
                </div>
              ) : <div className="text-xs text-gray-400">暂无作答数据</div>}
              {Array.isArray(stats.blank_slot_stats) && stats.blank_slot_stats.map((slot: any) => (
                <div key={slot.slot_index} className="p-2 border border-gray-100 rounded-lg mb-2">
                  <div className="text-sm mb-1">
                    <Tag color="purple">空位 {slot.slot_index}</Tag>标准答案：{slot.correct_answer}
                  </div>
                  <Progress percent={slot.correct_rate ?? 0} size="small" format={(p) => `${p}% 正确`}
                    strokeColor={slot.correct_rate != null && slot.correct_rate >= 60 ? "#52c41a" : "#ff4d4f"} />
                  {slot.top_wrong_answers?.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
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
          <Divider className="!my-3" />
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold">AI 分析</span>
            <Tag color={analysisStatus.color}>{analysisStatus.text}</Tag>
          </div>
          {activity.analysis_status === "success" && activity.analysis_result && (
            <div>
              <SimpleMarkdown text={activity.analysis_result} />
              {riskSlots.length > 0 && <div className="mt-2 text-xs" style={{ color: "#d46b08" }}>薄弱空位：{riskSlots.map((s: any) => `空位${s.slot_index}(${s.correct_rate ?? 0}%)`).join("、")}</div>}
              {commonMistakes.length > 0 && <div className="text-xs text-gray-600 mt-1">高频错答：{commonMistakes.slice(0, 5).map((x: any) => `${x.answer}(${x.count})`).join("、")}</div>}
            </div>
          )}
          {activity.analysis_status === "failed" && (
            <Alert type="error" showIcon message="自动分析失败" description={`失败原因：${activity.analysis_error || "未知错误"}`} />
          )}
          {activity.analysis_status === "skipped" && (
            <Alert type="warning" showIcon message="自动分析已跳过" description="作答数据不足，已跳过分析" />
          )}
          {(!activity.analysis_status || activity.analysis_status === "pending") && (
            <div className="text-xs text-gray-300">活动结束后将自动触发分析（需在活动中配置分析智能体）</div>
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
  <Drawer title={activity?.title || "活动详情"} open={open} onClose={onClose} width={500}>
    {activity && <ActivityDetailContent activity={activity} stats={stats} />}
    {extra}
  </Drawer>
);

export default ActivityDetailDrawer;
