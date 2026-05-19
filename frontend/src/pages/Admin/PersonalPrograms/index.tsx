import { showMessage } from "@/lib/toast";
import React, { useEffect, useState } from "react";

import { LayoutGrid, ArrowRight } from "lucide-react";
import { xbkPublicConfigApi } from "@services";
import { AdminAppCard, AdminPage } from "@/components/Admin";

const AdminPersonalPrograms: React.FC = () => {
  const [xbkEnabled, setXbkEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const config = await xbkPublicConfigApi.get();
        if (!mounted) return;
        setXbkEnabled(Boolean(config.enabled));
      } catch {
        if (!mounted) return;
        setXbkEnabled(false);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleXbk = async (nextEnabled: boolean) => {
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
    <AdminPage padding="var(--ws-space-4)">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <AdminAppCard
          title="校本课 (XBK)"
          description="校本课程作业提交与处理系统"
          icon={<LayoutGrid className="h-4 w-4" />}
          enabled={xbkEnabled}
          loading={loading || saving}
          onToggle={handleToggleXbk}
          color="var(--ws-color-warning)"
          actionLabel="打开"
          actionIcon={<ArrowRight className="h-4 w-4" />}
          onAction={() => window.open("/xbk", "_blank")}
        />
      </div>
    </AdminPage>
  );
};

export default AdminPersonalPrograms;
