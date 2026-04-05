import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import useAuth from "@hooks/useAuth";

const AdminEditorLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useAuth();

  const isArticleEditor = location.pathname.startsWith("/admin/articles/editor");
  const isTypstEditor = location.pathname.startsWith("/admin/informatics/editor");
  const isAssessmentEditor = location.pathname.startsWith("/admin/assessment/editor");
  const isFullscreenEditor = isTypstEditor || isArticleEditor;

  const backToList = () => {
    if (isTypstEditor) navigate("/admin/informatics");
    else if (isAssessmentEditor) navigate("/admin/assessment");
    else navigate("/admin/articles");
  };

  const title = (() => {
    if (isTypstEditor) return location.pathname.includes("/new") ? "新建 Typst 笔记" : "编辑 Typst 笔记";
    if (isArticleEditor) return location.pathname.includes("/new") ? "新建文章" : "编辑文章";
    if (isAssessmentEditor) return location.pathname.includes("/new") ? "新建测评" : "编辑测评";
    return "编辑";
  })();

  return (
    <div className="h-screen bg-surface">
      <header className="sticky top-0 z-[var(--ws-z-floating-panel)] flex h-14 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={backToList}>
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
          <span className="text-base font-semibold">
            {title}
          </span>
        </div>
      </header>
      <main
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          isFullscreenEditor ? "p-0" : "p-4"
        )}
        style={{ height: "calc(100vh - 56px)" }}
      >
        <div
          className={cn(
            "w-full",
            isFullscreenEditor ? "flex min-h-0 flex-1 flex-col" : "mx-auto max-w-[1600px]"
          )}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminEditorLayout;
