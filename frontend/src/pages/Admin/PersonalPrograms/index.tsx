import { showMessage } from "@/lib/toast";
import React, { useEffect, useState } from "react";

import { LayoutGrid, ArrowRight } from "lucide-react";
import { xbkPublicConfigApi } from "@services";
import { AdminAppCard, AdminPage } from "@/components/Admin";
import { Button } from "@/components/ui/button";

const AdminPersonalPrograms: React.FC = () => {
  const [xbkEnabled, setXbkEnabled] = useState<boolean | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void (async () => {
      try {
        const config = await xbkPublicConfigApi.get();
        if (!mounted) return;
        setXbkEnabled(Boolean(config.enabled));
      } catch {
        if (!mounted) return;
        setXbkEnabled(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadAttempt]);

  const handleToggleXbk = async (nextEnabled: boolean) => {
    if (xbkEnabled === null || loading || saving) return;
    const prev = xbkEnabled;
    setXbkEnabled(nextEnabled);
    setSaving(true);
    try {
      const res = await xbkPublicConfigApi.set(nextEnabled);
      setXbkEnabled(Boolean(res.enabled));
      showMessage.success(res.enabled ? "已开启前台 XBK 入口" : "已关闭前台 XBK 入口");
    } catch (_e) {
      setXbkEnabled(prev);
      showMessage.error("更新失败，请确认已登录管理员账号");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage padding="var(--ws-panel-padding)">
      <div className="ws-personal-programs-shell">
      {!loading && xbkEnabled === null && (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          无法读取 XBK 公开设置，入口状态未知。
          <Button variant="outline" size="sm" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>重试</Button>
        </div>
      )}
      <div className="ws-personal-programs-grid">
        <AdminAppCard
          title="校本课 (XBK)"
          description="校本课程作业提交与处理系统"
          icon={<LayoutGrid className="h-4 w-4" />}
          enabled={xbkEnabled}
          loading={loading || saving}
          onToggle={handleToggleXbk}
          color="var(--ws-color-warning)"
          className="ws-it-admin-card"
          actionLabel="打开"
          actionIcon={<ArrowRight className="h-4 w-4" />}
          onAction={() => window.open("/xbk", "_blank")}
        />
      </div>
      </div>
    </AdminPage>
  );
};

export default AdminPersonalPrograms;
