import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Spin, Layout } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import BasicLayout from "@layouts/BasicLayout";
import AdminLayout from "@layouts/AdminLayout";
import AdminEditorLayout from "@layouts/AdminEditorLayout";
import AdminGuard from "@components/Auth/AdminGuard";

// 页面懒加载
const HomePage = lazy(() => import("./pages/Home"));
const AIAgentsPage = lazy(() => import("./pages/AIAgents"));
const InformaticsPage = lazy(() => import("./pages/Informatics"));
const InformaticsDetailPage = lazy(() => import("./pages/Informatics/Detail"));
const ITTechnologyPage = lazy(() => import("./pages/ITTechnology"));
const ITTechnologyPythonLabPage = lazy(() => import("./pages/ITTechnology/PythonLab"));
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
const AdminGroupDiscussionPage = lazy(() => import("./pages/Admin/GroupDiscussion"));
const AdminInformaticsPage = lazy(() => import("./pages/Admin/Informatics"));
const AdminITTechnologyPage = lazy(() => import("./pages/Admin/ITTechnology"));
const AdminPersonalProgramsPage = lazy(
  () => import("./pages/Admin/PersonalPrograms"),
);
const AdminArticlesPage = lazy(() => import("./pages/Admin/Articles"));
const AdminArticleEditorPage = lazy(() => import("./pages/Admin/Articles/EditorPage"));
const AdminArticleLegacyEditRedirect = lazy(() => import("./pages/Admin/Articles/LegacyEditRedirect"));
const AdminTypstEditorPage = lazy(() => import("./pages/Admin/Informatics/EditorPage"));
const AdminSystemPage = lazy(() => import("./pages/Admin/System"));
const LoginPage = lazy(() => import("./pages/Auth/Login"));

const { Content } = Layout;

// 加载中组件
const LoadingIndicator = (
  <div style={{ textAlign: "center", padding: "50px" }}>
    <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />
  </div>
);

function App() {
  return (
    <Layout className="full-height">
      <Content className="full-height">
        <Suspense fallback={LoadingIndicator}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route element={<BasicLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/ai-agents" element={<AIAgentsPage />} />
              <Route path="/informatics" element={<InformaticsPage />} />
              <Route path="/informatics/:id" element={<InformaticsDetailPage />} />
              <Route path="/it-technology" element={<ITTechnologyPage />} />
              <Route path="/it-technology/python-lab" element={<ITTechnologyPythonLabPage />} />
              <Route path="/it-technology/python-lab/:id" element={<ITTechnologyPythonLabPage />} />
              <Route path="/personal-programs" element={<PersonalProgramsPage />} />
              <Route path="/xbk" element={<XbkPage />} />
              <Route path="/articles" element={<ArticlesPage />} />
              <Route path="/articles/:slug" element={<ArticleDetailPage />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>

            <Route
              element={
                <AdminGuard>
                  <AdminLayout />
                </AdminGuard>
              }
            >
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/ai-agents" element={<AdminAIAgentsPage />} />
              <Route path="/admin/agent-data" element={<AdminAgentDataPage />} />
              <Route path="/admin/group-discussion" element={<AdminGroupDiscussionPage />} />
              <Route path="/admin/informatics" element={<AdminInformaticsPage />} />
              <Route path="/admin/it-technology" element={<AdminITTechnologyPage />} />
              <Route path="/admin/personal-programs" element={<AdminPersonalProgramsPage />} />
              <Route path="/admin/articles" element={<AdminArticlesPage />} />
              <Route path="/admin/system" element={<AdminSystemPage />} />
            </Route>

            <Route
              element={
                <AdminGuard>
                  <AdminEditorLayout />
                </AdminGuard>
              }
            >
              <Route path="/admin/articles/editor/new" element={<AdminArticleEditorPage />} />
              <Route path="/admin/articles/editor/:id" element={<AdminArticleEditorPage />} />
              <Route path="/admin/articles/new" element={<Navigate to="/admin/articles/editor/new" replace />} />
              <Route path="/admin/articles/edit/:id" element={<AdminArticleLegacyEditRedirect />} />
              <Route path="/admin/informatics/editor/new" element={<AdminTypstEditorPage />} />
              <Route path="/admin/informatics/editor/:id" element={<AdminTypstEditorPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Content>
    </Layout>
  );
}

export default App;
