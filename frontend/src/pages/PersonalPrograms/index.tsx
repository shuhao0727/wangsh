import React, { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    (async () => {
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
      className="it-technology-page w-full flex-1 mx-auto px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)]"
      style={{ maxWidth: "var(--ws-shell-max-width)" }}
    >
      {loading ? (
        <div className="grid gap-[var(--ws-layout-gap)]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-2 p-[var(--ws-panel-padding)] space-y-[var(--ws-space-2)]">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-8/12" />
            </div>
          ))}
        </div>
      ) : xbkEnabled ? (
        <div className="grid gap-[var(--ws-layout-gap)]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          <AppLauncherCard
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
        <Card className="rounded-xl border-none bg-surface-2">
          <CardContent>
            <EmptyState
              description="暂无公开的个人程序"
              action={
                <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                  返回首页
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PersonalProgramsPage;
