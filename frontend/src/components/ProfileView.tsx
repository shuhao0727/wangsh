/**
 * 画像展示组件 - 初级画像 & 三维画像
 * 管理端统计页和学生端浮动窗口共用
 */
import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { FlaskConical, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import RadarChart from "@components/RadarChart";
import type { BasicProfileResponse } from "@services/assessment";
import type { StudentProfile } from "@services/assessment";

const CircleProgress: React.FC<{
  percent: number;
  size?: number;
  color?: string;
}> = ({ percent, size = 64, color = "var(--ws-color-primary)" }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
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
        className="fill-text text-xs font-semibold"
      >
        {clamped}%
      </text>
    </svg>
  );
};

const LineProgress: React.FC<{ percent: number; color?: string }> = ({
  percent,
  color = "var(--ws-color-primary)",
}) => {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
};

// ─── 初级画像 ───

interface BasicProfileViewProps {
  data: BasicProfileResponse;
}

export const BasicProfileView: React.FC<BasicProfileViewProps> = ({ data }) => {
  const pct = data.total_score > 0 ? Math.round(data.earned_score / data.total_score * 100) : 0;

  const kpDetails = useMemo(() => {
    if (!data.knowledge_scores) return [];
    try {
      const raw = JSON.parse(data.knowledge_scores) as Record<string, { earned: number; total: number }>;
      return Object.entries(raw).map(([name, d]) => ({
        name, earned: d.earned, total: d.total,
        pct: d.total > 0 ? Math.round(d.earned / d.total * 100) : 0,
        classPct: data.class_knowledge_rates?.[name] ?? null,
      }));
    } catch { return []; }
  }, [data]);

  const weakPoints = useMemo(() => {
    if (!data.wrong_points) return [];
    try { return JSON.parse(data.wrong_points) as string[]; } catch { return []; }
  }, [data]);

  const radarDims = useMemo(() => {
    if (!data.knowledge_scores) return null;
    try {
      const raw = JSON.parse(data.knowledge_scores) as Record<string, { earned: number; total: number }>;
      const dims: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) dims[k] = v.total > 0 ? Math.round(v.earned / v.total * 100) : 0;
      return Object.keys(dims).length >= 3 ? dims : null;
    } catch { return null; }
  }, [data]);

  const classRates = useMemo(() => {
    const cr = data.class_knowledge_rates;
    return cr && Object.keys(cr).length >= 3 ? cr : null;
  }, [data]);

  const radarSize = 240;

  return (
    <div>
      {/* 得分概览 */}
      <div className="flex items-center gap-4 mb-5 rounded-lg bg-surface-2 px-5 py-4">
        <CircleProgress percent={pct} size={64} color={pct >= 60 ? "var(--ws-color-success)" : "var(--ws-color-error)"} />
        <div className="flex-1 min-w-0">
          <div className="text-xl font-semibold">
            {data.earned_score} <span className="text-sm text-text-tertiary font-normal">/ {data.total_score}</span>
          </div>
          <div className="text-xs text-text-tertiary mt-0.5">{new Date(data.created_at).toLocaleString("zh-CN")}</div>
        </div>
        {weakPoints.length > 0 && (
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-text-tertiary mb-1">薄弱知识点</div>
            <div className="flex flex-wrap gap-1 justify-end">
              {weakPoints.map(p => <Badge key={p} variant="warning" className="!m-0">{p}</Badge>)}
            </div>
          </div>
        )}
      </div>

      {/* 雷达图 + 知识点进度条（左右布局） */}
      {kpDetails.length > 0 && (
        <div className="flex gap-5 mb-6 items-start">
          {radarDims && (
            <div className="flex-shrink-0 text-center">
              {classRates ? (
                <RadarChart series={[
                  { name: "学生水平", data: radarDims, color: "var(--ws-color-primary)" },
                  { name: "班级平均", data: classRates, color: "var(--ws-color-warning)" },
                ]} size={radarSize} />
              ) : (
                <RadarChart dimensions={radarDims} size={radarSize} />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold mb-2">
              <BookOpen className="h-4 w-4 mr-1 inline" />知识点得分
            </div>
            {kpDetails.map(kp => (
              <div key={kp.name} className="mb-1.5">
                <div className="flex justify-between text-xs mb-0.5">
                  <span style={{ color: weakPoints.includes(kp.name) ? "var(--ws-color-error)" : "var(--ws-color-text)" }}>{kp.name}</span>
                  <span className="text-text-tertiary">
                    {kp.earned}/{kp.total}
                    {kp.classPct != null && <span className="ml-1.5" style={{ color: "var(--ws-color-warning)" }}>班均{kp.classPct}%</span>}
                  </span>
                </div>
                <LineProgress percent={kp.pct} color={kp.pct >= 60 ? "var(--ws-color-success)" : "var(--ws-color-error)"} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI 评语 */}
      {data.ai_summary && (
        <div className="rounded-lg bg-surface-2 px-5 py-3.5" style={{ borderLeft: "3px solid var(--ws-color-primary)" }}>
          <div className="text-xs text-text-tertiary mb-2">AI 评语</div>
          <div className="text-sm leading-loose text-text-secondary">
            <ReactMarkdown>{data.ai_summary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 三维画像 ───

const DATA_SOURCE_MAP: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  assessment: { label: "测评数据", variant: "info" },
  discussion: { label: "讨论数据", variant: "success" },
  agent_chat: { label: "AI对话", variant: "violet" },
};

function parseDataSources(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch {}
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

interface AdvancedProfileViewProps {
  profile: StudentProfile;
}

export const AdvancedProfileView: React.FC<AdvancedProfileViewProps> = ({ profile }) => {
  const radarDims = useMemo(() => {
    if (!profile.scores) return null;
    try {
      const obj = JSON.parse(profile.scores);
      return obj?.dimensions && Object.keys(obj.dimensions).length >= 3 ? obj.dimensions : null;
    } catch { return null; }
  }, [profile]);

  const sources = parseDataSources(profile.data_sources);

  return (
    <div>
      {/* 头部信息 */}
      <div className="mb-4 flex items-center justify-between rounded-lg bg-surface-2 px-4 py-2.5">
        <div className="flex gap-1 flex-wrap">
          {sources.map(s => {
            const m = DATA_SOURCE_MAP[s];
            return (
              <Badge
                key={s}
                variant={m?.variant || "neutral"}
              >
                {m?.label || s}
              </Badge>
            );
          })}
        </div>
        <span className="text-xs text-text-tertiary">
          {new Date(profile.created_at).toLocaleString("zh-CN")}
          {profile.config_title && ` · ${profile.config_title}`}
        </span>
      </div>

      {/* 雷达图 */}
      {radarDims && (
        <div className="text-center mb-6">
          <RadarChart dimensions={radarDims} size={260} />
        </div>
      )}

      {/* 画像内容 */}
      {profile.result_text && (
        <div className="advanced-profile-md rounded-lg bg-surface-2 px-5 py-4 text-sm leading-loose text-text-secondary">
          <style>{`
            .advanced-profile-md h1, .advanced-profile-md h2, .advanced-profile-md h3,
            .advanced-profile-md h4, .advanced-profile-md h5, .advanced-profile-md h6 {
              font-size: var(--ws-text-sm);
              font-weight: 600;
              margin: 12px 0 6px;
              line-height: 1.6;
            }
          `}</style>
          <ReactMarkdown>{profile.result_text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

// ─── 三维画像空状态 ───

interface AdvancedProfileEmptyProps {
  onGenerate?: () => void;
  loading?: boolean;
}

export const AdvancedProfileEmpty: React.FC<AdvancedProfileEmptyProps> = ({ onGenerate, loading }) => (
  <div className="text-center py-10">
    <div className="text-5xl text-border-secondary mb-3"><FlaskConical className="h-12 w-12" /></div>
    <div className="text-text-tertiary mb-4">尚未生成三维画像</div>
    {onGenerate && (
      <Button onClick={onGenerate} disabled={loading}>
        <FlaskConical className="h-4 w-4" />
        生成三维画像
      </Button>
    )}
  </div>
);
