import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { AdminCard } from "@components/Admin";
import { systemMetricsApi } from "@services";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const pct = (x: number) => `${Math.round(x * 100)}%`;

const TypstMetricsPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await systemMetricsApi.typstMetrics();
      setData(res);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      showMessage.error(typeof d === "string" ? d : (e?.message || "加载 Typst 指标失败"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = data?.typst_compile?.counts;
  const dur = data?.typst_compile?.dur_ms;
  const waited = data?.typst_compile?.waited_ms;
  const q = data?.typst_compile?.queue_length;
  const hitRate = Number(data?.typst_compile?.cache_hit_rate_recent || 0);
  const http429 = Number(data?.http?.["429_total"] || 0);

  const statusTag = useMemo(() => {
    const fail = Number(counts?.fail || 0);
    const ql = Number(q?.typst || 0) + Number(q?.celery || 0);
    if (fail > 0) return <Badge variant="danger">有失败</Badge>;
    if (ql > 0) return <Badge variant="warning">排队中</Badge>;
    return <Badge variant="success">正常</Badge>;
  }, [counts?.fail, q?.typst, q?.celery]);

  const StatItem: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
      <div className="text-xs text-text-tertiary">{title}</div>
      <div className="mt-1 text-lg font-semibold text-text-base">{value}</div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="font-semibold">Typst 编译观测</span>
          {statusTag}
        </div>
        <div className="inline-flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const ok = window.confirm("会删除超过保留天数且未被任何笔记引用的 PDF。建议先预演，是否继续？");
              if (!ok) return;
              try {
                const res = await systemMetricsApi.typstPdfCleanup({ dry_run: true });
                showMessage.info(`预演完成：scanned=${res?.scanned ?? 0} removed=${res?.removed ?? 0}`);
              } catch (e: any) {
                showMessage.error(e?.message || "预演失败");
              }
            }}
          >
            清理 PDF
          </Button>
          <Button variant="outline" disabled={loading} onClick={load}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} 刷新
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <AdminCard title="计数与命中率">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatItem title="总编译次数" value={Number(counts?.total || 0)} />
              <StatItem title="近期命中率" value={pct(hitRate)} />
              <StatItem title="命中" value={Number(counts?.hit || 0)} />
              <StatItem title="未命中" value={Number(counts?.miss || 0)} />
              <StatItem title="失败" value={Number(counts?.fail || 0)} />
              <StatItem title="429 总次数" value={http429} />
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatItem title="队列(typst)" value={Number(q?.typst || 0)} />
              <StatItem title="队列(celery)" value={Number(q?.celery || 0)} />
            </div>
          </AdminCard>
        </div>

        <div>
          <AdminCard title="耗时分布">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatItem title="样本数" value={Number(dur?.n || 0)} />
              <StatItem title="p50(ms)" value={Number(dur?.p50 || 0)} />
              <StatItem title="p90(ms)" value={Number(dur?.p90 || 0)} />
              <StatItem title="p95(ms)" value={Number(dur?.p95 || 0)} />
              <StatItem title="max(ms)" value={Number(dur?.max || 0)} />
              <StatItem title="等待 p95(ms)" value={Number(waited?.p95 || 0)} />
            </div>
            <Separator className="my-4" />
            <p className="text-sm text-text-secondary">
              提示：等待时间高通常意味着并发受限或队列积压；命中率低且耗时高意味着需要优化缓存或资源引用。
            </p>
          </AdminCard>
        </div>
      </div>
    </div>
  );
};

export default TypstMetricsPanel;
