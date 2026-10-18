import React, { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@components/Common/EmptyState";
import AppLauncherCard from "@components/Common/AppLauncherCard";
import { xbkPublicConfigApi } from "@services";
import { useNavigate } from "react-router-dom";

const PersonalProgramsPage: React.FC = () => {
  const navigate = useNavigate();
  const [xbkEnabled, setXbkEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <div
      className="it-technology-page flex w-full flex-1 flex-col px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)]"
      style={{ maxWidth: "var(--ws-shell-max-width)" }}
    >
      {loading ? (
        <div className="border-y border-[var(--ws-color-border-secondary)]">
          <div className="flex min-h-[76px] items-center gap-3 py-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
        </div>
      ) : xbkEnabled ? (
        <div className="grid grid-cols-1">
          <AppLauncherCard
            layout="row"
            title="校本课（XBK）处理系统"
            description="校本课数据处理与管理。"
            icon={<LayoutGrid className="h-5 w-5" />}
            color="var(--ws-color-success)"
            bg="color-mix(in srgb, var(--ws-color-success) 8%, transparent)"
            ring="color-mix(in srgb, var(--ws-color-success) 22%, transparent)"
            onClick={() => window.open("/xbk", "_blank")}
          />
        </div>
      ) : (
        <div className="flex min-h-60 flex-1 items-center justify-center border-y border-[var(--ws-color-border-secondary)]">
          <EmptyState
            description="暂无公开的个人程序"
            action={
              <Button variant="outline" size="sm" onClick={() => navigate("/home")}>
                返回首页
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
};

export default PersonalProgramsPage;
