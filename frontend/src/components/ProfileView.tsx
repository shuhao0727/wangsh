/**
 * 画像展示组件 - 初级画像 & 三维画像
 * 管理端统计页和学生端浮动窗口共用
 */
import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Tag, Progress, Button } from "antd";
import { ExperimentOutlined, BookOutlined } from "@ant-design/icons";
import RadarChart from "@components/RadarChart";
import type { BasicProfileResponse } from "@services/assessment";
import type { StudentProfile } from "@services/assessment";

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
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "16px 20px", background: "#f6f8fa", borderRadius: 8 }}>
        <Progress type="circle" percent={pct} size={64} strokeColor={pct >= 60 ? "#52c41a" : "#ff4d4f"} format={() => `${pct}%`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {data.earned_score} <span style={{ fontSize: 14, color: "#999", fontWeight: 400 }}>/ {data.total_score}</span>
          </div>
          <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{new Date(data.created_at).toLocaleString("zh-CN")}</div>
        </div>
        {weakPoints.length > 0 && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>薄弱知识点</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
              {weakPoints.map(p => <Tag key={p} color="warning" style={{ margin: 0 }}>{p}</Tag>)}
            </div>
          </div>
        )}
      </div>

      {/* 雷达图 + 知识点进度条（左右布局） */}
      {kpDetails.length > 0 && (
        <div style={{ display: "flex", gap: 20, marginBottom: 24, alignItems: "flex-start" }}>
          {radarDims && (
            <div style={{ flexShrink: 0, textAlign: "center" }}>
              {classRates ? (
                <RadarChart series={[
                  { name: "学生水平", data: radarDims, color: "#4096ff" },
                  { name: "班级平均", data: classRates, color: "#ff7a45" },
                ]} size={radarSize} />
              ) : (
                <RadarChart dimensions={radarDims} size={radarSize} />
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              <BookOutlined style={{ marginRight: 4 }} />知识点得分
            </div>
            {kpDetails.map(kp => (
              <div key={kp.name} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: weakPoints.includes(kp.name) ? "#ff4d4f" : "#333" }}>{kp.name}</span>
                  <span style={{ color: "#999" }}>
                    {kp.earned}/{kp.total}
                    {kp.classPct != null && <span style={{ marginLeft: 6, color: "#ff7a45" }}>班均{kp.classPct}%</span>}
                  </span>
                </div>
                <Progress percent={kp.pct} size="small" strokeColor={kp.pct >= 60 ? "#52c41a" : "#ff4d4f"} showInfo={false} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI 评语 */}
      {data.ai_summary && (
        <div style={{ padding: "14px 20px", background: "#fafafa", borderRadius: 8, borderLeft: "3px solid #4096ff" }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>AI 评语</div>
          <div style={{ fontSize: 14, lineHeight: 1.9, color: "#333" }}>
            <ReactMarkdown>{data.ai_summary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 三维画像 ───

const DATA_SOURCE_MAP: Record<string, { label: string; color: string }> = {
  assessment: { label: "测评数据", color: "blue" },
  discussion: { label: "讨论数据", color: "green" },
  agent_chat: { label: "AI对话", color: "purple" },
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "10px 16px", background: "#f6f8fa", borderRadius: 8 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {sources.map(s => {
            const m = DATA_SOURCE_MAP[s];
            return <Tag key={s} color={m?.color}>{m?.label || s}</Tag>;
          })}
        </div>
        <span style={{ fontSize: 12, color: "#999" }}>
          {new Date(profile.created_at).toLocaleString("zh-CN")}
          {profile.config_title && ` · ${profile.config_title}`}
        </span>
      </div>

      {/* 雷达图 */}
      {radarDims && (
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <RadarChart dimensions={radarDims} size={260} />
        </div>
      )}

      {/* 画像内容 */}
      {profile.result_text && (
        <div className="advanced-profile-md" style={{ padding: "16px 20px", background: "#fafafa", borderRadius: 8, fontSize: 14, lineHeight: 1.9, color: "#333" }}>
          <style>{`
            .advanced-profile-md h1, .advanced-profile-md h2, .advanced-profile-md h3,
            .advanced-profile-md h4, .advanced-profile-md h5, .advanced-profile-md h6 {
              font-size: 15px;
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
  <div style={{ textAlign: "center", padding: "40px 0" }}>
    <div style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 12 }}><ExperimentOutlined /></div>
    <div style={{ color: "#999", marginBottom: 16 }}>尚未生成三维画像</div>
    {onGenerate && (
      <Button type="primary" icon={<ExperimentOutlined />} onClick={onGenerate} loading={loading}>
        生成三维画像
      </Button>
    )}
  </div>
);
