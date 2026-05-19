import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { showMessage } from "@/lib/toast";
import BasicLayout from "@layouts/BasicLayout";
import AdminLayout from "@layouts/AdminLayout";
import AdminEditorLayout from "@layouts/AdminEditorLayout";
import AdminGuard from "@components/Auth/AdminGuard";
import GlobalErrorBoundary from "@components/Common/GlobalErrorBoundary";
import PageErrorBoundary from "@components/Common/PageErrorBoundary";
import { AUTH_EXPIRED_EVENT, type AuthExpiredKind } from "@services/api";

// 旧路由兼容重定向
const ArticleEditRedirect: React.FC = () => {
  const { id } = useParams();
  return <Navigate to={`/admin/articles/editor/${id}`} replace />;
};

// 页面懒加载
const HomePage = lazy(() => import("./pages/Home"));
const AIAgentsPage = lazy(() => import("./pages/AIAgents"));
const InformaticsPage = lazy(() => import("./pages/Informatics"));
const InformaticsDetailPage = lazy(() => import("./pages/Informatics/Detail"));
const ITTechnologyPage = lazy(() => import("./pages/ITTechnology"));
const ITTechnologyPythonLabPage = lazy(() => import("./pages/ITTechnology/PythonLab"));
const MLPage = lazy(() => import("./pages/ITTechnology/MLPage"));
const AIPage = lazy(() => import("./pages/ITTechnology/AIPage"));
const AgentsPage = lazy(() => import("./pages/ITTechnology/AgentsPage"));
const MLFullPage = lazy(() => import("./pages/ITTechnology/MLFullPage"));
const AIFullPage = lazy(() => import("./pages/ITTechnology/AIFullPage"));
const AgentsFullPage = lazy(() => import("./pages/ITTechnology/AgentsFullPage"));
const MindmapGalleryPage = lazy(() => import("./pages/MindmapGallery"));
const MindmapPreviewPage = lazy(() => import("./pages/MindmapPreview"));
const PersonalProgramsPage = lazy(() => import("./pages/PersonalPrograms"));
const ArticlesPage = lazy(() => import("./pages/Articles"));
const ArticleDetailPage = lazy(() => import("./pages/Articles/Detail"));
const XbkPage = lazy(() => import("./pages/Xbk"));
const NotFoundPage = lazy(() => import("./pages/NotFound"));

// 管理员页面懒加载
const AdminDashboardPage = lazy(() => import("./pages/Admin/Dashboard"));
const AdminUsersPage = lazy(() => import("./pages/Admin/Users"));
const AdminAIAgentsPage = lazy(() => import("./pages/Admin/AIAgents"));
const AdminAgentDataPage = lazy(() => import("./pages/Admin/AgentData"));
const TaskAnalysisResultPage = lazy(() => import("./pages/Admin/AgentData/TaskAnalysisResultPage"));
const TaskAnalysisNewPage = lazy(() => import("./pages/Admin/AgentData/TaskAnalysisNewPage"));
const LockCrackerPage = lazy(() => import("./pages/Games/LockCracker"));
const GamesPage = lazy(() => import("./pages/Games"));
const GameConfigPage = lazy(() => import("./pages/Games/GameConfig"));
const AdminGroupDiscussionPage = lazy(() => import("./pages/Admin/GroupDiscussion"));
const AdminInformaticsPage = lazy(() => import("./pages/Admin/Informatics"));
const AdminITTechnologyPage = lazy(() => import("./pages/Admin/ITTechnology"));
const AdminPersonalProgramsPage = lazy(
  () => import("./pages/Admin/PersonalPrograms"),
);
const AdminArticlesPage = lazy(() => import("./pages/Admin/Articles"));
const AdminArticleEditorPage = lazy(() => import("./pages/Admin/Articles/EditorPage"));
const AdminTypstEditorPage = lazy(() => import("./pages/Admin/Informatics/EditorPage"));
const AdminSystemPage = lazy(() => import("./pages/Admin/System"));
const AdminAssessmentPage = lazy(() => import("./pages/Admin/Assessment"));
const AdminAssessmentEditorPage = lazy(() => import("./pages/Admin/Assessment/EditorPage"));
const AdminAssessmentQuestionsPage = lazy(() => import("./pages/Admin/Assessment/QuestionsPage"));
const AdminAssessmentStatisticsPage = lazy(() => import("./pages/Admin/Assessment/StatisticsPage"));
const AdminLearningEditorPage = lazy(() => import("./pages/Admin/ITTechnology/learning/EditorPage"));
const AdminTabEditorPage = lazy(() => import("./pages/Admin/ITTechnology/learning/TabEditorPage"));
const AdminMindMapEditorPage = lazy(() => import("./pages/Admin/ITTechnology/learning/MindMapEditor"));
const AdminClassroomInteractionPage = lazy(() => import("./pages/Admin/ClassroomInteraction"));
const AdminClassroomPlanPage = lazy(() => import("./pages/Admin/ClassroomPlan/PlanPage"));
const AdminMLBookEditorPage = lazy(() => import("./pages/Admin/ITTechnology/ml/editor/MlBookEditor"));
const LoginPage = lazy(() => import("./pages/Auth/Login"));

// 加载中组件
const LoadingIndicator = (
  <div className="p-12 text-center">
    <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
  </div>
);

function App() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onAuthExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string; kind?: AuthExpiredKind }>).detail;
      const reason = typeof detail?.reason === "string" && detail.reason.trim()
        ? detail.reason.trim()
        : "登录已过期，请重新登录";
      if (detail?.kind === "replaced") {
        showMessage.error({ content: "你的账号已在其他地方登录，当前设备已下线，请重新登录", key: "auth-expired", duration: 6 });
        return;
      }
      if (detail?.kind === "ip_changed") {
        showMessage.error({ content: reason, key: "auth-expired", duration: 5 });
        return;
      }
      showMessage.warning({ content: reason, key: "auth-expired", duration: 4 });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired as EventListener);

    const cachedDetail = (
      window as typeof window & {
        __wsLastAuthExpiredDetail?: { reason?: string; kind?: AuthExpiredKind } | null;
      }
    ).__wsLastAuthExpiredDetail;
    if (cachedDetail) {
      onAuthExpired(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: cachedDetail }));
    }

    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired as EventListener);
  }, []);

  return (
    <div className="full-height">
      <div className="full-height">
        <GlobalErrorBoundary>
          <Suspense fallback={LoadingIndicator}>
            <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/it-technology/ml" element={<PageErrorBoundary pageName="ml"><MLFullPage /></PageErrorBoundary>} />
            <Route path="/it-technology/ai" element={<PageErrorBoundary pageName="ai"><AIFullPage /></PageErrorBoundary>} />
            <Route path="/it-technology/agents" element={<PageErrorBoundary pageName="agents"><AgentsFullPage /></PageErrorBoundary>} />
            <Route path="/task-analysis/new" element={<PageErrorBoundary pageName="task-analysis-new"><TaskAnalysisNewPage /></PageErrorBoundary>} />
            <Route path="/task-analysis/:analysisId" element={<PageErrorBoundary pageName="task-analysis-result"><TaskAnalysisResultPage /></PageErrorBoundary>} />
            <Route path="/games/lock-cracker" element={<PageErrorBoundary pageName="lock-cracker"><LockCrackerPage /></PageErrorBoundary>} />
            <Route path="/games" element={<PageErrorBoundary pageName="games"><GamesPage /></PageErrorBoundary>} />
            <Route path="/admin/games/config" element={<PageErrorBoundary pageName="game-config"><GameConfigPage /></PageErrorBoundary>} />
            <Route path="/mindmaps" element={<PageErrorBoundary pageName="mindmap-gallery"><MindmapGalleryPage /></PageErrorBoundary>} />
            <Route path="/mindmap-preview" element={<PageErrorBoundary pageName="mindmap-preview"><MindmapPreviewPage /></PageErrorBoundary>} />

            <Route element={<BasicLayout />}>
              <Route path="/home" element={<PageErrorBoundary pageName="home"><HomePage /></PageErrorBoundary>} />
              <Route path="/ai-agents" element={<PageErrorBoundary pageName="ai-agents"><AIAgentsPage /></PageErrorBoundary>} />
              <Route path="/informatics" element={<PageErrorBoundary pageName="informatics"><InformaticsPage /></PageErrorBoundary>} />
              <Route path="/informatics/:id" element={<PageErrorBoundary pageName="informatics-detail"><InformaticsDetailPage /></PageErrorBoundary>} />
              <Route path="/it-technology" element={<PageErrorBoundary pageName="it-technology"><ITTechnologyPage /></PageErrorBoundary>} />
              <Route path="/it-technology/python-lab" element={<PageErrorBoundary pageName="python-lab"><ITTechnologyPythonLabPage /></PageErrorBoundary>} />
              <Route path="/it-technology/python-lab/:id" element={<PageErrorBoundary pageName="python-lab"><ITTechnologyPythonLabPage /></PageErrorBoundary>} />
              <Route path="/personal-programs" element={<PageErrorBoundary pageName="personal-programs"><PersonalProgramsPage /></PageErrorBoundary>} />
              <Route path="/xbk" element={<PageErrorBoundary pageName="xbk"><XbkPage /></PageErrorBoundary>} />
              <Route path="/articles" element={<PageErrorBoundary pageName="articles"><ArticlesPage /></PageErrorBoundary>} />
              <Route path="/articles/:slug" element={<PageErrorBoundary pageName="article-detail"><ArticleDetailPage /></PageErrorBoundary>} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>

            <Route
              element={
                <AdminGuard>
                  <AdminLayout />
                </AdminGuard>
              }
            >
              <Route path="/admin/dashboard" element={<PageErrorBoundary pageName="admin-dashboard"><AdminDashboardPage /></PageErrorBoundary>} />
              <Route path="/admin/users" element={<PageErrorBoundary pageName="admin-users"><AdminUsersPage /></PageErrorBoundary>} />
              <Route path="/admin/ai-agents" element={<PageErrorBoundary pageName="admin-ai-agents"><AdminAIAgentsPage /></PageErrorBoundary>} />
              <Route path="/admin/agent-data" element={<PageErrorBoundary pageName="admin-agent-data"><AdminAgentDataPage /></PageErrorBoundary>} />
              <Route path="/admin/group-discussion" element={<PageErrorBoundary pageName="admin-group-discussion"><AdminGroupDiscussionPage /></PageErrorBoundary>} />
              <Route path="/admin/informatics" element={<PageErrorBoundary pageName="admin-informatics"><AdminInformaticsPage /></PageErrorBoundary>} />
              <Route path="/admin/it-technology" element={<PageErrorBoundary pageName="admin-it-technology"><AdminITTechnologyPage /></PageErrorBoundary>} />
              <Route path="/admin/personal-programs" element={<PageErrorBoundary pageName="admin-personal-programs"><AdminPersonalProgramsPage /></PageErrorBoundary>} />
              <Route path="/admin/articles" element={<PageErrorBoundary pageName="admin-articles"><AdminArticlesPage /></PageErrorBoundary>} />
              <Route path="/admin/assessment" element={<PageErrorBoundary pageName="admin-assessment"><AdminAssessmentPage /></PageErrorBoundary>} />
              <Route path="/admin/assessment/:id/questions" element={<PageErrorBoundary pageName="admin-assessment-questions"><AdminAssessmentQuestionsPage /></PageErrorBoundary>} />
              <Route path="/admin/assessment/:id/statistics" element={<PageErrorBoundary pageName="admin-assessment-statistics"><AdminAssessmentStatisticsPage /></PageErrorBoundary>} />
              <Route path="/admin/classroom-interaction" element={<PageErrorBoundary pageName="admin-classroom-interaction"><AdminClassroomInteractionPage /></PageErrorBoundary>} />
              <Route path="/admin/classroom-plan" element={<PageErrorBoundary pageName="admin-classroom-plan"><AdminClassroomPlanPage /></PageErrorBoundary>} />
              <Route path="/admin/it-technology/ml-book-editor" element={<PageErrorBoundary pageName="admin-ml-book-editor"><AdminMLBookEditorPage /></PageErrorBoundary>} />
              <Route path="/admin/system" element={<PageErrorBoundary pageName="admin-system"><AdminSystemPage /></PageErrorBoundary>} />
            </Route>

            <Route
              element={
                <AdminGuard>
                  <AdminEditorLayout />
                </AdminGuard>
              }
            >
              <Route path="/admin/articles/editor/new" element={<PageErrorBoundary pageName="article-editor"><AdminArticleEditorPage /></PageErrorBoundary>} />
              <Route path="/admin/articles/editor/:id" element={<PageErrorBoundary pageName="article-editor"><AdminArticleEditorPage /></PageErrorBoundary>} />
              <Route path="/admin/articles/new" element={<Navigate to="/admin/articles/editor/new" replace />} />
              <Route path="/admin/articles/edit/:id" element={<ArticleEditRedirect />} />
              <Route path="/admin/it-technology/learning/:moduleKey" element={<PageErrorBoundary pageName="learning-editor"><AdminLearningEditorPage /></PageErrorBoundary>} />
              <Route path="/admin/it-technology/learning/:moduleKey/:section" element={<PageErrorBoundary pageName="tab-editor"><AdminTabEditorPage /></PageErrorBoundary>} />
              <Route path="/admin/it-technology/mindmap/:moduleKey" element={<PageErrorBoundary pageName="mindmap-editor"><AdminMindMapEditorPage /></PageErrorBoundary>} />
              <Route path="/admin/informatics/editor/new" element={<PageErrorBoundary pageName="informatics-editor"><AdminTypstEditorPage /></PageErrorBoundary>} />
              <Route path="/admin/informatics/editor/:id" element={<PageErrorBoundary pageName="informatics-editor"><AdminTypstEditorPage /></PageErrorBoundary>} />
              <Route path="/admin/assessment/editor/new" element={<PageErrorBoundary pageName="assessment-editor"><AdminAssessmentEditorPage /></PageErrorBoundary>} />
              <Route path="/admin/assessment/editor/:id" element={<PageErrorBoundary pageName="assessment-editor"><AdminAssessmentEditorPage /></PageErrorBoundary>} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </GlobalErrorBoundary>
      </div>
    </div>
  );
}

export default App;
