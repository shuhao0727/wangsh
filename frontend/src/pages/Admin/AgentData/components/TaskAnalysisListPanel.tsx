/**
 * 任务分析列表面板 — 分析记录 + 搜索 + 新建按钮
 */
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ExternalLink, Trash2, Search, Download } from "lucide-react";
import dayjs from "dayjs";
import { agentDataApi } from "@services/znt/api";
import { showMessage } from "@/lib/toast";

type AnalysisRecord = {
  id: number;
  title: string;
  created_at: string;
  uncovered_count: number;
};

function generateReportHTML(d: any, wc: any[], cov: any[], uncov: any[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const wordData = JSON.stringify(wc.map((w: any) => ({ name: w.word, value: w.count })));
  const taskSheet = (d.task_sheet || "").replace(/\n/g, "<br>");
  const coveredRows = cov.map((c: any) =>
    `<div class="item"><span>${esc(c.topic)}</span><span class="count">${c.count}次</span></div>`
  ).join("");
  const uncoveredCards = uncov.map((u: any) => {
    const qs = (u.questions || []).map((q: string) => `<div class="q">· ${esc(q)}</div>`).join("");
    return `<div class="uc"><div class="tp">${esc(u.topic)} <span class="count">${u.count}次</span></div>${qs}</div>`;
  }).join("");
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>任务分析报告</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"Noto Sans SC","PingFang SC",sans-serif;max-width:860px;margin:0 auto;padding:48px 32px;color:#1e293b;background:#fff;line-height:1.6}
h1{font-size:26px;color:#0D9488;margin-bottom:4px;letter-spacing:-0.01em}
.meta{color:#94a3b8;font-size:13px;margin-bottom:32px}
h2{font-size:17px;color:#334155;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
.section{margin:28px 0}
#wordcloud{width:100%;height:380px;margin:0 auto;border-radius:12px;background:#fafdfc}
.item{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-radius:6px;margin-bottom:4px}
.item:nth-child(odd){background:#f8fafc}
.item .label{font-size:14px}.count{font-weight:600;font-size:13px;color:#f59e0b;background:#fffbeb;padding:2px 10px;border-radius:12px}
.uc{border:1px solid #fde68a;border-left:3px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:10px;background:#fffbeb}
.uc .tp{font-weight:600;font-size:15px;margin-bottom:6px}
.uc .q{font-size:13px;color:#64748b;padding-left:8px;margin-top:3px}
.tip{background:#f0fdfa;border:1px solid #99f6e4;border-left:3px solid #0D9488;border-radius:8px;padding:14px 16px;font-size:14px;color:#0f766e;margin-top:24px}
.footer{text-align:center;color:#cbd5e1;font-size:12px;margin-top:40px}
</style></head><body>
<h1>任务分析报告</h1><div class="meta">${d.title} · ${d.created_at || ""}</div>
<div class="section"><h2>词云</h2><div id="wordcloud"></div></div>
<div class="section"><h2>任务单</h2><p style="font-size:14px;line-height:1.8">${taskSheet}</p></div>
<div class="section"><h2>任务单已覆盖（${cov.length}）</h2>${coveredRows || '<p style="color:#94a3b8;font-size:13px">暂无</p>'}</div>
<div class="section"><h2>学生自发新问题（${uncov.length}）</h2>${uncoveredCards || '<p style="color:#94a3b8;font-size:13px">暂无</p>'}</div>
<div class="tip">以上自发问题为任务单未覆盖的方向，建议补充到下节课任务单中。这些是学生在任务单之外自然追问的内容，反映了学生真正的兴趣和困惑所在。</div>
<div class="footer">WangSh 任务分析 · 自动生成</div>
<script src="https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts-wordcloud@2.1.0/dist/echarts-wordcloud.min.js"></script>
<script>
var data = ${wordData};
var colors = ["#0D9488","#7C3AED","#3B82F6","#06B6D4","#EC4899","#F59E0B","#10B981","#8B5CF6"];
function wordColor(w){var h=0;for(var i=0;i<w.length;i++)h=h*31+w.charCodeAt(i);return colors[Math.abs(h)%colors.length];}
var chart = echarts.init(document.getElementById("wordcloud"));
chart.setOption({series:[{type:"wordCloud",shape:"circle",sizeRange:[14,56],rotationRange:[0,0],gridSize:10,drawOutOfBound:false,layoutAnimation:true,animationDuration:2000,animationEasing:"cubicOut",textStyle:{fontFamily:"sans-serif",fontWeight:"bold",color:function(p){return wordColor(p.name)}},emphasis:{focus:"self",scale:1.25,textStyle:{textShadowBlur:16,textShadowColor:"rgba(0,0,0,0.25)"}},data:data}]});
window.addEventListener("resize",function(){chart.resize()});
</script></body></html>`;
}

const TaskAnalysisListPanel: React.FC = () => {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await agentDataApi.listTaskAnalyses();
      if (res.success) setRecords(res.data as AnalysisRecord[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadRecords(); }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm("确定删除这条分析记录？")) return;
    const res = await agentDataApi.deleteTaskAnalysis(id);
    if (res.success) { showMessage.success("已删除"); void loadRecords(); }
    else showMessage.error("删除失败");
  };

  const handleDownload = async (id: number) => {
    const res = await agentDataApi.getTaskAnalysis(id);
    if (!res.success) { showMessage.error("获取失败"); return; }
    const d: any = res.data;
    const r = d.result || {};
    const wc = r.word_cloud || [];
    const cov = r.covered || [];
    const uncov = r.uncovered || [];
    const html = generateReportHTML(d, wc, cov, uncov);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `任务分析_${d.title}_${dayjs(d.created_at).format("YYYYMMDD")}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = search.trim()
    ? records.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    : records;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header: search + button */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-[340px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="搜索分析记录..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={() => window.open("/task-analysis/new", "_blank")}>
          <Plus className="h-4 w-4 mr-1" />
          新建分析
        </Button>
      </div>

      {/* Records */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-text-tertiary">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-text-tertiary">{search ? "未找到匹配记录" : "暂无分析记录"}</p>
          {!search && (
            <Button variant="outline" onClick={() => window.open("/task-analysis/new", "_blank")}>
              <Plus className="h-4 w-4 mr-1" />创建第一个分析
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 sticky top-0">
              <tr className="text-left text-xs text-text-tertiary">
                <th className="px-4 py-2.5 font-medium">标题</th>
                <th className="px-4 py-2.5 font-medium w-[120px]">时间</th>
                <th className="px-4 py-2.5 font-medium w-[100px]">发现</th>
                <th className="px-4 py-2.5 font-medium w-[140px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-secondary">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--ws-color-hover-bg)] transition-colors">
                  <td className="px-4 py-3 font-medium truncate max-w-[400px]">{r.title}</td>
                  <td className="px-4 py-3 text-text-tertiary text-xs">{dayjs(r.created_at).format("MM-DD HH:mm")}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: "var(--ws-color-warning-soft)", color: "var(--ws-color-warning)" }}>
                      {r.uncovered_count || 0} 个主题
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <a href={`/task-analysis/${r.id}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" />查看
                      </a>
                      <button onClick={() => handleDownload(r.id)} title="下载"
                        className="text-text-tertiary hover:text-primary transition-colors">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(r.id)}
                        className="text-text-tertiary hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TaskAnalysisListPanel;
